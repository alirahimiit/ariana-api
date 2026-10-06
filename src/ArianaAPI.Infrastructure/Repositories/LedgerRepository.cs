using System.Text;
using ArianaAPI.Application.DTOs.Ledger;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using ArianaAPI.Infrastructure.Models;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class LedgerRepository : ILedgerRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<LedgerRepository> _logger;

    public LedgerRepository(
        ITenantConnectionFactory factory,
        ILogger<LedgerRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<LedgerResultDto> GetLedgerAsync(
        long orgId, long fyId, LedgerRequestDto req, CancellationToken ct = default)
    {
        var level = (req.Level ?? "col").ToLowerInvariant();

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 100;
        if (req.PageSize > 100000) req.PageSize = 100000;

        var (whereSql, parameters) = BuildWhere(req, level);
        parameters.Add("startRow", (req.Page - 1) * req.PageSize + 1);
        parameters.Add("endRow", req.Page * req.PageSize);

        var isMonthly = req.MonthlyMode && level == "col";
        var innerSql = BuildInnerSelect(level, whereSql, isMonthly);
        var orderByExpr = BuildOrderBy(req.SortColumn, req.SortDirection, level, isMonthly);

        var sql = $@"
    SELECT * FROM (
        SELECT *, 
            ROW_NUMBER() OVER (ORDER BY {orderByExpr}) AS RowNum,
            COUNT(*) OVER () AS TotalCount
        FROM ({innerSql}) AS Inner1
    ) AS T
    WHERE T.RowNum BETWEEN @startRow AND @endRow
    ORDER BY T.RowNum";

        _logger.LogDebug("Ledger SQL:\n{Sql}", sql);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var rows = (await conn.QueryAsync<LedgerRowWithCount>(
            new CommandDefinition(sql, parameters, commandTimeout: 180, cancellationToken: ct))).ToList();

        var items = rows.Select(r => r.ToItem()).ToList();
        var totalCount = rows.Count > 0 ? rows[0].TotalCount : 0;

        // ⭐ محاسبه‌ی مانده‌ی قبل از این صفحه (per group)
        var openingBalances = new Dictionary<string, decimal>(StringComparer.Ordinal);
        if (req.Page > 1 && items.Count > 0)
        {
            var openSql = $@"
            SELECT 
                CAST(ISNULL(CodeCol, 0) AS VARCHAR(50)) + '|' + 
                CAST(ISNULL(CodeMoein, 0) AS VARCHAR(50)) + '|' + 
                CAST(ISNULL(CodeTafzil, 0) AS VARCHAR(50)) + '|' + 
                CAST(ISNULL(CodeTafzili2, 0) AS VARCHAR(50)) AS GrpKey,
                SUM(MabBes - MabBed) AS OpeningBal
            FROM (
                SELECT *, ROW_NUMBER() OVER (ORDER BY {orderByExpr}) AS RowNum
                FROM ({innerSql}) AS Inner1
            ) AS O
            WHERE O.RowNum < @startRow
            GROUP BY CodeCol, CodeMoein, CodeTafzil, CodeTafzili2";

            var openRows = await conn.QueryAsync<OpeningBalanceRow>(
                new CommandDefinition(openSql, parameters, commandTimeout: 180, cancellationToken: ct));

            foreach (var o in openRows)
                openingBalances[o.GrpKey] = o.OpeningBal;

            _logger.LogInformation("Ledger opening balances: Page={Page} Groups={Count}",
                req.Page, openingBalances.Count);
        }

        _logger.LogInformation("Ledger Level={Level} Page={Page} Items={Count} Total={Total}",
            level, req.Page, items.Count, totalCount);

        // ⭐ پاس دادن opening
        ApplyRunningBalance(items, level, openingBalances);

        var totalPages = (int)Math.Ceiling(totalCount / (double)req.PageSize);

        return new LedgerResultDto
        {
            Level = level,
            Items = items,
            TotalBed = items.Sum(x => x.MabBed),
            TotalBes = items.Sum(x => x.MabBes),
            TotalMan = items.Sum(x => x.MabBes - x.MabBed),
            MandehBefore = openingBalances.Values.Sum(),
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            IsMonthly = isMonthly
        };
    }

    public async Task<LedgerResultDto> GetLedgerFullAsync(
        long orgId, long fyId, LedgerRequestDto req, CancellationToken ct = default)
    {
        var level = (req.Level ?? "col").ToLowerInvariant();

        var (whereSql, parameters) = BuildWhere(req, level);

        var isMonthly = req.MonthlyMode && level == "col";
        var innerSql = BuildInnerSelect(level, whereSql, isMonthly);
        var orderByExpr = BuildOrderBy(req.SortColumn, req.SortDirection, level, isMonthly);

        var sql = $@"
                    SELECT * FROM ({innerSql}) AS T
                    ORDER BY {orderByExpr}";

        _logger.LogDebug("Ledger FULL SQL:\n{Sql}", sql);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var items = (await conn.QueryAsync<LedgerItemDto>(
            new CommandDefinition(sql, parameters, commandTimeout: 300, cancellationToken: ct))).ToList();

        // ⭐ برای FULL: ترتیب بر اساس SanadID نگه‌داری می‌شه
        ApplyRunningBalance(items, level);

        return new LedgerResultDto
        {
            Level = level,
            Items = items,
            TotalBed = items.Sum(x => x.MabBed),
            TotalBes = items.Sum(x => x.MabBes),
            TotalMan = items.Sum(x => x.MabBed - x.MabBes),
            MandehBefore = null,
            Page = 1,
            PageSize = items.Count,
            TotalCount = items.Count,
            IsMonthly = isMonthly,
            TotalPages = 1
        };
    }

    // ═══════════════════════════════════════════════════════
    //  ⭐ ساخت SELECT داخلی — کلید ماجرا
    //  برای col: GROUP BY + تفکیک Bed/Bes
    //  برای بقیه: ردیف خام Sanad
    // ═══════════════════════════════════════════════════════
    private static string BuildInnerSelect(string level, string whereSql, bool monthlyMode)
    {
        // ═══════════════════════════════════════════════════════
        //  ⭐ حالت ماهانه — فقط سطح col
        //  هر (ماه، کد) → دو ردیف: Bed و Bes
        // ═══════════════════════════════════════════════════════
        if (level == "col" && monthlyMode)
        {
            return $@"
            SELECT 
                CAST(0 AS BIGINT)             AS SanadID,
                CAST(0 AS BIGINT)             AS ParentSanadID,
                CAST(0 AS INT)                AS NoSanad,
                SUBSTRING(P.Date_In, 1, 7)    AS DateIn,
                ''                            AS OtherParentSharh,
                S.Code_Col                    AS CodeCol,
                CAST(0 AS INT)                AS CodeMoein,
                CAST(0 AS INT)                AS CodeTafzil,
                CAST(0 AS INT)                AS CodeTafzili2,
                SUM(S.Mab_Bed)                AS MabBed,
                SUM(S.Mab_Bes)                AS MabBes,
                SUM(CASE 
                    WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar, 0)
                    WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar, 0)
                    ELSE 0    
                END) AS Meghdar,
                'به شرح دفتر روزنامه'         AS OtherSharh,
                CAST(0 AS INT)                AS TikRow,
                ISNULL((SELECT TOP 1 Name FROM Hesab 
                        WHERE Code_Col = S.Code_Col AND Code_Moein = 0 AND Code_Tafzil = 0), '') AS ColName,
                '' AS MoeinName,
                '' AS TafzilName,
                '' AS Tafzili2Name,
                -- ⭐ این خط قبلاً نبود!
                CASE WHEN ISNULL(S.Mab_Bed, 0) > 0 THEN 1 ELSE 2 END AS RowKind
            FROM Sanad S
            INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
            {whereSql}
            GROUP BY 
                SUBSTRING(P.Date_In, 1, 7),
                S.Code_Col,
                CASE WHEN ISNULL(S.Mab_Bed, 0) > 0 THEN 1 ELSE 2 END";
        }

        // ═══════════════════════════════════════════════════════
        //  سطح col — روزانه (دقیقاً مثل قبل)
        // ═══════════════════════════════════════════════════════
        if (level == "col")
        {
            return $@"
            SELECT 
                MAX(S.SanadID)             AS SanadID,
                P.ParentSanadID            AS ParentSanadID,
                P.No_Sanad                 AS NoSanad,
                P.Date_In                  AS DateIn,
                P.OtherParentSharh         AS OtherParentSharh,
                S.Code_Col                 AS CodeCol,
                CAST(0 AS INT)             AS CodeMoein,
                CAST(0 AS INT)             AS CodeTafzil,
                CAST(0 AS INT)             AS CodeTafzili2,
                SUM(S.Mab_Bed)             AS MabBed,
                SUM(S.Mab_Bes)             AS MabBes,
                SUM(CASE 
                    WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar, 0)
                    WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar, 0)
                    ELSE 0    
                END) AS Meghdar,
                'به شرح دفتر روزنامه'      AS OtherSharh,
                MAX(ISNULL(S.TikRow,0))    AS TikRow,
                ISNULL((SELECT TOP 1 Name FROM Hesab 
                        WHERE Code_Col = S.Code_Col AND Code_Moein = 0 AND Code_Tafzil = 0), '') AS ColName,
                '' AS MoeinName,
                '' AS TafzilName,
                '' AS Tafzili2Name,
                1                          AS RowKind
            FROM Sanad S
            INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
            {whereSql}
            GROUP BY 
                P.ParentSanadID, P.No_Sanad, P.Date_In, P.OtherParentSharh, S.Code_Col,
                CASE WHEN S.Mab_Bed > 0 THEN 1 WHEN S.Mab_Bes > 0 THEN 2 ELSE 0 END";
        }

        // ═══════════════════════════════════════════════════════
        //  سطوح moein / tafzil / tafzil2 — هر Sanad = یه ردیف
        // ═══════════════════════════════════════════════════════
        string h2NameExpr = (level is "moein" or "tafzil" or "tafzil2")
            ? "ISNULL((SELECT TOP 1 Name FROM Hesab WHERE Code_Col = S.Code_Col AND Code_Moein = S.Code_Moein AND Code_Tafzil = 0), '') AS MoeinName"
            : "'' AS MoeinName";
        string h3NameExpr = (level is "tafzil" or "tafzil2")
            ? "ISNULL((SELECT TOP 1 Name FROM Hesab WHERE Code_Col = -1 AND Code_Tafzil = S.Code_Tafzil), '') AS TafzilName"
            : "'' AS TafzilName";
        string t2NameExpr = (level == "tafzil2")
            ? "ISNULL((SELECT TOP 1 Name FROM Tafzili2 WHERE Code = S.Code_Tafzili2), '') AS Tafzili2Name"
            : "'' AS Tafzili2Name";

        string moeinSel = (level is "moein" or "tafzil" or "tafzil2")
            ? "S.Code_Moein AS CodeMoein" : "CAST(0 AS INT) AS CodeMoein";
        string tafzilSel = (level is "tafzil" or "tafzil2")
            ? "S.Code_Tafzil AS CodeTafzil" : "CAST(0 AS INT) AS CodeTafzil";
        string tafzili2Sel = (level == "tafzil2")
            ? "S.Code_Tafzili2 AS CodeTafzili2" : "CAST(0 AS INT) AS CodeTafzili2";

        return $@"
        SELECT 
            S.SanadID                   AS SanadID,
            P.ParentSanadID             AS ParentSanadID,
            P.No_Sanad                  AS NoSanad,
            P.Date_In                   AS DateIn,
            P.OtherParentSharh          AS OtherParentSharh,
            S.Code_Col                  AS CodeCol,
            {moeinSel},
            {tafzilSel},
            {tafzili2Sel},
            S.Mab_Bed                   AS MabBed,
            S.Mab_Bes                   AS MabBes,
            CASE 
                WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar, 0)
                WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar, 0)
                ELSE 0    
            END AS Meghdar,
            S.OtherSharh                AS OtherSharh,
            ISNULL(S.TikRow, 0)         AS TikRow,
            ISNULL((SELECT TOP 1 Name FROM Hesab 
                    WHERE Code_Col = S.Code_Col AND Code_Moein = 0 AND Code_Tafzil = 0), '') AS ColName,
            {h2NameExpr},
            {h3NameExpr},
            {t2NameExpr},
            1                           AS RowKind
        FROM Sanad S
        INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
        {whereSql}";
    }
    // ═══════════════════════════════════════════════════════
    //  ⭐ محاسبه مانده تجمعی — per code group
    //  running += (Bes - Bed) → مثبت=بستانکار، منفی=بدهکار
    // ═══════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    //  ⭐ محاسبه مانده تجمعی — per code group
    //  چرا Dictionary؟ چون توی ماهانه، ترتیب «ماه → کد» هست
    //  و باید هر کد running خودش رو داشته باشه (مثل Delphi که
    //  برای هر Code_Col جدا Man حساب می‌کرد)
    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    //  ⭐ محاسبه مانده تجمعی — با پشتیبانی از opening page
    // ═══════════════════════════════════════════════════════════
    private static void ApplyRunningBalance(
        List<LedgerItemDto> items,
        string level,
        Dictionary<string, decimal>? initialBalances = null)
    {
        // ⭐ شروع از مقادیر صفحه‌ی قبل (اگه داشتیم)
        var runningByGroup = initialBalances != null
            ? new Dictionary<string, decimal>(initialBalances, StringComparer.Ordinal)
            : new Dictionary<string, decimal>(StringComparer.Ordinal);

        foreach (var it in items)
        {
            // ⭐ کلید یکسان با SQL: `{col}|{moein}|{tafzil}|{tafzili2}`
            var key = $"{it.CodeCol ?? 0}|{it.CodeMoein ?? 0}|{it.CodeTafzil ?? 0}|{it.CodeTafzili2 ?? 0}";

            if (!runningByGroup.TryGetValue(key, out var running))
                running = 0m;

            // ⭐ بستانکار - بدهکار (مثبت = بس، منفی = بد)
            running += (it.MabBes - it.MabBed);
            runningByGroup[key] = running;
            it.MabMan = running;
        }
    }
    // ═══════════════════════════════════════════════════════
    //  ⭐ ساخت ORDER BY امن (Whitelist — ضد SQL Injection)
    // ═══════════════════════════════════════════════════════
    private static string BuildOrderBy(string? sortCol, string? sortDir, string level, bool monthlyMode)
    {
        var dir = (sortDir ?? "asc").ToLowerInvariant() == "desc" ? "DESC" : "ASC";

        // ⭐ ترتیب پیش‌فرض — دقیقاً طبق Delphi (بدون SanadID)
        string defaultOrder;

        if (monthlyMode && level == "col")
        {
            // ماهانه: ماه → کد کل → Bed قبل از Bes (RowKind)
            defaultOrder = "DateIn, CodeCol, RowKind";
        }
        else
        {
            defaultOrder = level switch
            {
                "col" => "CodeCol, NoSanad, DateIn, RowKind",
                "moein" => "CodeCol, CodeMoein, NoSanad, DateIn",
                "tafzil" => "CodeCol, CodeMoein, CodeTafzil, NoSanad, DateIn",
                _ => "CodeCol, CodeMoein, CodeTafzil, CodeTafzili2, NoSanad, DateIn"
            };
        }

        if (string.IsNullOrEmpty(sortCol))
            return defaultOrder;

        // ⭐ Whitelist ستون‌ها
        var col = sortCol.ToLowerInvariant() switch
        {
            "datein" => "DateIn",
            "nosanad" => "NoSanad",
            "codecol" => "CodeCol",
            "codemoein" => "CodeMoein",
            "codetafzil" => "CodeTafzil",
            "codetafzili2" => "CodeTafzili2",
            "colname" => "ColName",
            "moeinname" => "MoeinName",
            "tafzilname" => "TafzilName",
            "othersharh" => "OtherSharh",
            "mabbed" => "MabBed",
            "mabbes" => "MabBes",
            "meghdar" => "Meghdar",
            _ => null
        };

        if (col == null) return defaultOrder;

        // ⭐ ستون انتخابی + ترتیب پیش‌فرض (بدون تکرار ستون)
        var parts = defaultOrder.Split(new[] { ", " }, StringSplitOptions.None)
                                .Where(p => !p.StartsWith(col + " ", StringComparison.OrdinalIgnoreCase)
                                         && p != col)
                                .ToList();

        return $"{col} {dir}, {string.Join(", ", parts)}";
    }
    // ═══════════════════════════════════════════════════════
    //  WHERE دینامیک — دست‌نخورده
    // ═══════════════════════════════════════════════════════
    private static (string Sql, DynamicParameters Params) BuildWhere(
        LedgerRequestDto req, string level, bool ignoreFromDate = false)
    {
        var sb = new StringBuilder(" WHERE S.Code_Col > 0 ");
        var p = new DynamicParameters();

        if (level == "tafzil" || level == "tafzil2")
            sb.Append(" AND ISNULL(S.Code_Tafzil, 0) > 0 ");

        if (level == "tafzil2")
            sb.Append(" AND ISNULL(S.Code_Tafzili2, 0) > 0 ");

        if (req.FromCodeCol is > 0) { sb.Append(" AND S.Code_Col >= @fromCodeCol "); p.Add("fromCodeCol", req.FromCodeCol.Value); }
        if (req.ToCodeCol is > 0) { sb.Append(" AND S.Code_Col <= @toCodeCol "); p.Add("toCodeCol", req.ToCodeCol.Value); }

        if (level is "moein" or "tafzil" or "tafzil2")
        {
            if (req.FromCodeMoein is > 0) { sb.Append(" AND S.Code_Moein >= @fromCodeMoein "); p.Add("fromCodeMoein", req.FromCodeMoein.Value); }
            if (req.ToCodeMoein is > 0) { sb.Append(" AND S.Code_Moein <= @toCodeMoein "); p.Add("toCodeMoein", req.ToCodeMoein.Value); }
        }

        if (level is "tafzil" or "tafzil2")
        {
            if (req.FromCodeTafzil is > 0) { sb.Append(" AND S.Code_Tafzil >= @fromCodeTafzil "); p.Add("fromCodeTafzil", req.FromCodeTafzil.Value); }
            if (req.ToCodeTafzil is > 0) { sb.Append(" AND S.Code_Tafzil <= @toCodeTafzil "); p.Add("toCodeTafzil", req.ToCodeTafzil.Value); }
        }

        if (req.CodeTafzili2 is > 0) { sb.Append(" AND S.Code_Tafzili2 = @codeTafzili2 "); p.Add("codeTafzili2", req.CodeTafzili2.Value); }

        if (req.TafziliGroupId is > 0)
        {
            sb.Append(@" AND S.Code_Tafzil IN (
                            SELECT Code_Tafzil FROM Hesab 
                            WHERE TafziliGroupCode = @tafziliGroupId AND Code_Tafzil > 0) ");
            p.Add("tafziliGroupId", req.TafziliGroupId.Value);
        }
        // ⭐ فیلترهای SpecialHesab
        if (req.CodeVahedId is > 0)
        {
            sb.Append(" AND ISNULL(S.CodeVahed, 0) = @codeVahedId ");
            p.Add("codeVahedId", req.CodeVahedId.Value);
        }
        if (req.CodeHazineId is > 0)
        {
            sb.Append(" AND ISNULL(S.CodeMarkazH, 0) = @codeHazineId ");
            p.Add("codeHazineId", req.CodeHazineId.Value);
        }
        if (req.CodeProjectId is > 0)
        {
            sb.Append(" AND ISNULL(S.CodeProject, 0) = @codeProjectId ");
            p.Add("codeProjectId", req.CodeProjectId.Value);
        }
        if (req.TikRow.HasValue) { sb.Append(" AND ISNULL(S.TikRow, 0) = @tikRow "); p.Add("tikRow", req.TikRow.Value); }
        if (req.NoFrom is > 0) { sb.Append(" AND P.No_Sanad >= @noFrom "); p.Add("noFrom", req.NoFrom.Value); }
        if (req.NoTo is > 0) { sb.Append(" AND P.No_Sanad <= @noTo "); p.Add("noTo", req.NoTo.Value); }
        if (req.Vazeit.HasValue) { sb.Append(" AND P.Vazeit = @vazeit "); p.Add("vazeit", req.Vazeit.Value); }

        if (!string.IsNullOrWhiteSpace(req.FromDate))
        {
            sb.Append(ignoreFromDate ? " AND P.Date_In < @fromDate " : " AND P.Date_In >= @fromDate ");
            p.Add("fromDate", req.FromDate);
        }
        if (!string.IsNullOrWhiteSpace(req.ToDate))
        {
            sb.Append(" AND P.Date_In <= @toDate ");
            p.Add("toDate", req.ToDate);
        }

        return (sb.ToString(), p);
    }
    // ⭐ کلاس کمکی برای نتیجه‌ی opening balance query
    private class OpeningBalanceRow
    {
        public string GrpKey { get; set; } = "";
        public decimal OpeningBal { get; set; }
    }
}