using System.Text;
using ArianaAPI.Application.DTOs.Taraz;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class TarazRepository : ITarazRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<TarazRepository> _logger;

    public TarazRepository(
        ITenantConnectionFactory factory,
        ILogger<TarazRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<TarazResultDto> GetTarazAsync(
        long orgId, long fyId, TarazRequestDto req, CancellationToken ct = default)
    {
        var level = (req.Level ?? "moein").ToLowerInvariant();

        // ═══════════════════════════════════════════════
        //  WHERE مشترک
        // ═══════════════════════════════════════════════
        var (whereSql, parameters) = BuildWhere(req);

        _logger.LogDebug("Taraz Level={Level} SetDetail={SetDetail} Filter={Filter}",
            level, req.SetDetail, req.FilterOption);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ═══════════════════════════════════════════════
        //  ساخت temp table (مثل Delphi)
        // ═══════════════════════════════════════════════
        await conn.ExecuteAsync(@"
            CREATE TABLE #TarazPrint (
                Code_Col      INT,
                Code_Moein    INT,
                Code_Tafzil   INT,
                Code_Tafzili2 INT,
                Mab_Bed       DECIMAL(18,2),
                Mab_Bes       DECIMAL(18,2),
                Meghdar       DECIMAL(18,2)
            )");

        // ═══════════════════════════════════════════════
        //  ۱. سطرهای جزئی سطح جاری
        // ═══════════════════════════════════════════════
        var mainGroupCols = level switch
        {
            "col" => "S.Code_Col",
            "moein" => "S.Code_Col, S.Code_Moein",
            "tafzil" => "S.Code_Col, S.Code_Moein, S.Code_Tafzil",
            "tafzil2" => "S.Code_Col, S.Code_Moein, S.Code_Tafzil, S.Code_Tafzili2",
            _ => "S.Code_Col, S.Code_Moein"
        };

        var levelFilter = level switch
        {
            "moein" => " AND ISNULL(S.Code_Moein,0) > 0 ",
            "tafzil" => " AND ISNULL(S.Code_Tafzil,0) > 0 ",
            "tafzil2" => " AND ISNULL(S.Code_Tafzili2,0) > 0 ",
            _ => ""
        };

        var mainSql = $@"
            INSERT INTO #TarazPrint (Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Mab_Bed, Mab_Bes, Meghdar)
            SELECT 
                S.Code_Col,
                MAX(ISNULL(S.Code_Moein,0)),
                MAX(ISNULL(S.Code_Tafzil,0)),
                MAX(ISNULL(S.Code_Tafzili2,0)),
                SUM(S.Mab_Bed),
                SUM(S.Mab_Bes),
                SUM(CASE WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar,0)
                         WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar,0)
                         ELSE 0 END)
            FROM Sanad S
            INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
            {whereSql} {levelFilter}
            GROUP BY {mainGroupCols}";

        await conn.ExecuteAsync(new CommandDefinition(mainSql, parameters, cancellationToken: ct));

        // ═══════════════════════════════════════════════
        //  ۲. اگر SetDetail → سطرهای خلاصه سطوح بالاتر
        // ═══════════════════════════════════════════════
        if (req.SetDetail && level != "col")
        {
            // خلاصه سطح کل
            await conn.ExecuteAsync(new CommandDefinition($@"
                INSERT INTO #TarazPrint (Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Mab_Bed, Mab_Bes, Meghdar)
                SELECT 
                    S.Code_Col, 0, 0, 0,
                    SUM(S.Mab_Bed), SUM(S.Mab_Bes),
                    SUM(CASE WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar,0)
                             WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar,0)
                             ELSE 0 END)
                FROM Sanad S
                INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
                {whereSql}
                GROUP BY S.Code_Col",
                parameters, cancellationToken: ct));

            // خلاصه سطح معین (اگر سطح ≥ تفصیلی)
            if (level == "tafzil" || level == "tafzil2")
            {
                await conn.ExecuteAsync(new CommandDefinition($@"
                    INSERT INTO #TarazPrint (Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Mab_Bed, Mab_Bes, Meghdar)
                    SELECT 
                        S.Code_Col, S.Code_Moein, 0, 0,
                        SUM(S.Mab_Bed), SUM(S.Mab_Bes),
                        SUM(CASE WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar,0)
                                 WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar,0)
                                 ELSE 0 END)
                    FROM Sanad S
                    INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
                    {whereSql} AND ISNULL(S.Code_Moein,0) > 0
                    GROUP BY S.Code_Col, S.Code_Moein",
                    parameters, cancellationToken: ct));
            }

            // خلاصه سطح تفصیلی (اگر سطح = تفصیلی2)
            if (level == "tafzil2")
            {
                await conn.ExecuteAsync(new CommandDefinition($@"
                    INSERT INTO #TarazPrint (Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Mab_Bed, Mab_Bes, Meghdar)
                    SELECT 
                        S.Code_Col, S.Code_Moein, S.Code_Tafzil, 0,
                        SUM(S.Mab_Bed), SUM(S.Mab_Bes),
                        SUM(CASE WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar,0)
                                 WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar,0)
                                 ELSE 0 END)
                    FROM Sanad S
                    INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
                    {whereSql} AND ISNULL(S.Code_Tafzil,0) > 0
                    GROUP BY S.Code_Col, S.Code_Moein, S.Code_Tafzil",
                    parameters, cancellationToken: ct));
            }
        }

        // ═══════════════════════════════════════════════
        //  ۳. حساب‌های بدون گردش (از Hesab، فقط برای col و moein)
        // ═══════════════════════════════════════════════
        if (level == "col" || level == "moein")
        {
            var zeroFilter = level == "col"
                ? " H.Code_Moein = 0 AND H.Code_Tafzil = 0 "
                : " H.Code_Moein > 0 AND H.Code_Tafzil = 0 ";

            var zeroSql = $@"
                INSERT INTO #TarazPrint (Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Mab_Bed, Mab_Bes, Meghdar)
                SELECT 
                    H.Code_Col, 
                    CASE WHEN @lvl = 'moein' THEN H.Code_Moein ELSE 0 END,
                    0, 0, 0, 0, 0
                FROM Hesab H
                WHERE H.Code_Col > 0 AND {zeroFilter}
                  AND NOT EXISTS (
                      SELECT 1 FROM #TarazPrint T
                      WHERE T.Code_Col = H.Code_Col
                        AND T.Code_Moein = CASE WHEN @lvl = 'moein' THEN H.Code_Moein ELSE 0 END
                  )";

            await conn.ExecuteAsync(new CommandDefinition(
                zeroSql,
                new { lvl = level },
                cancellationToken: ct));
        }

        // ═══════════════════════════════════════════════
        //  ۴. خواندن نتیجه با نام‌ها
        // ═══════════════════════════════════════════════
        var resultSql = @"
            SELECT 
                T.Code_Col      AS CodeCol,
                T.Code_Moein    AS CodeMoein,
                T.Code_Tafzil   AS CodeTafzil,
                T.Code_Tafzili2 AS CodeTafzili2,
                ISNULL(H1.Name, '') AS ColName,
                ISNULL(H2.Name, '') AS MoeinName,
                ISNULL(H3.Name, '') AS TafzilName,
                ISNULL(T2.Name, '') AS Tafzili2Name,
                SUM(T.Mab_Bed)  AS MabBed,
                SUM(T.Mab_Bes)  AS MabBes,
                SUM(T.Meghdar)  AS Meghdar
            FROM #TarazPrint T
            LEFT JOIN Hesab H1 
                ON H1.Code_Col = T.Code_Col 
               AND H1.Code_Moein = 0 
               AND H1.Code_Tafzil = 0
            LEFT JOIN Hesab H2 
                ON H2.Code_Col = T.Code_Col 
               AND H2.Code_Moein = T.Code_Moein 
               AND H2.Code_Tafzil = 0
            LEFT JOIN Hesab H3 
                ON H3.Code_Col = -1 
               AND H3.Code_Tafzil = T.Code_Tafzil
            LEFT JOIN Tafzili2 T2 
                ON T2.Code = T.Code_Tafzili2
            GROUP BY 
                T.Code_Col, T.Code_Moein, T.Code_Tafzil, T.Code_Tafzili2,
                H1.Name, H2.Name, H3.Name, T2.Name
            ORDER BY 
                T.Code_Col, T.Code_Moein, T.Code_Tafzil, T.Code_Tafzili2";

        var allItems = (await conn.QueryAsync<TarazItemDto>(
            new CommandDefinition(resultSql, cancellationToken: ct))).ToList();

        await conn.ExecuteAsync("DROP TABLE #TarazPrint");

        // ═══════════════════════════════════════════════
        //  ۵. محاسبه مانده بدهکار/بستانکار
        // ═══════════════════════════════════════════════
        foreach (var it in allItems)
        {
            var diff = it.MabBes - it.MabBed;
            if (diff > 0)
            {
                it.MabManBes = diff;
                it.MabManBed = 0;
            }
            else if (diff < 0)
            {
                it.MabManBed = Math.Abs(diff);
                it.MabManBes = 0;
            }
            else
            {
                it.MabManBed = 0;
                it.MabManBes = 0;
            }

            // ساخت نام کامل حساب
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(it.ColName)) parts.Add(it.ColName);
            if (!string.IsNullOrWhiteSpace(it.MoeinName)) parts.Add(it.MoeinName);
            if (!string.IsNullOrWhiteSpace(it.TafzilName)) parts.Add(it.TafzilName);
            if (!string.IsNullOrWhiteSpace(it.Tafzili2Name)) parts.Add(it.Tafzili2Name);
            it.HesabName = string.Join(" - ", parts);
        }

        // ═══════════════════════════════════════════════
        //  ۶. فیلتر خروجی (all / noZeroMandeh / noZeroGardesh)
        // ═══════════════════════════════════════════════
        IEnumerable<TarazItemDto> filtered = allItems;

        switch (req.FilterOption)
        {
            case "noZeroMandeh":
                filtered = allItems.Where(x =>
                    (x.MabManBed != 0 || x.MabManBes != 0) &&
                    (x.MabBed != 0 || x.MabBes != 0));
                break;

            case "noZeroGardesh":
                filtered = allItems.Where(x =>
                    x.MabBed != 0 || x.MabBes != 0);
                break;
        }

        var finalList = filtered.ToList();

        // ═══════════════════════════════════════════════
        //  ۷. جمع کل (روی همه ردیف‌های فیلترشده)
        // ═══════════════════════════════════════════════
        var totalBed = finalList.Sum(x => x.MabBed);
        var totalBes = finalList.Sum(x => x.MabBes);
        var totalManBed = finalList.Sum(x => x.MabManBed);
        var totalManBes = finalList.Sum(x => x.MabManBes);
        var totalMeghdar = finalList.Sum(x => x.Meghdar);

        // ═══════════════════════════════════════════════
        //  ۸. صفحه‌بندی
        // ═══════════════════════════════════════════════
        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 500;
        if (req.PageSize > 100000) req.PageSize = 100000;

        var totalCount = finalList.Count;
        var totalPages = (int)Math.Ceiling(totalCount / (double)req.PageSize);
        var pagedItems = finalList
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .ToList();

        return new TarazResultDto
        {
            Level = level,
            Items = pagedItems,
            TotalBed = totalBed,
            TotalBes = totalBes,
            TotalManBed = totalManBed,
            TotalManBes = totalManBes,
            TotalMeghdar = totalMeghdar,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = totalCount,
            TotalPages = totalPages
        };
    }

    // ═══════════════════════════════════════════════════
    //  WHERE دینامیک
    // ═══════════════════════════════════════════════════
    private static (string Sql, DynamicParameters Params) BuildWhere(TarazRequestDto req)
    {
        var sb = new StringBuilder(" WHERE S.Code_Col > 0 ");
        var p = new DynamicParameters();

        if (req.FromCodeCol is > 0)
        {
            sb.Append(" AND S.Code_Col >= @fromCodeCol ");
            p.Add("fromCodeCol", req.FromCodeCol.Value);
        }
        if (req.ToCodeCol is > 0)
        {
            sb.Append(" AND S.Code_Col <= @toCodeCol ");
            p.Add("toCodeCol", req.ToCodeCol.Value);
        }

        if (req.FromCodeMoein is > 0)
        {
            sb.Append(" AND S.Code_Moein >= @fromCodeMoein ");
            p.Add("fromCodeMoein", req.FromCodeMoein.Value);
        }
        if (req.ToCodeMoein is > 0)
        {
            sb.Append(" AND S.Code_Moein <= @toCodeMoein ");
            p.Add("toCodeMoein", req.ToCodeMoein.Value);
        }

        if (req.FromCodeTafzil is > 0)
        {
            sb.Append(" AND S.Code_Tafzil >= @fromCodeTafzil ");
            p.Add("fromCodeTafzil", req.FromCodeTafzil.Value);
        }
        if (req.ToCodeTafzil is > 0)
        {
            sb.Append(" AND S.Code_Tafzil <= @toCodeTafzil ");
            p.Add("toCodeTafzil", req.ToCodeTafzil.Value);
        }

        if (req.CodeTafzili2 is > 0)
        {
            sb.Append(" AND S.Code_Tafzili2 = @codeTafzili2 ");
            p.Add("codeTafzili2", req.CodeTafzili2.Value);
        }

        if (req.TafziliGroupId is > 0)
        {
            sb.Append(@" AND S.Code_Tafzil IN (
                            SELECT Code_Tafzil FROM Hesab 
                            WHERE TafziliGroupCode = @tafziliGroupId AND Code_Tafzil > 0) ");
            p.Add("tafziliGroupId", req.TafziliGroupId.Value);
        }

        if (req.NoFrom is > 0)
        {
            sb.Append(" AND P.No_Sanad >= @noFrom ");
            p.Add("noFrom", req.NoFrom.Value);
        }
        if (req.NoTo is > 0)
        {
            sb.Append(" AND P.No_Sanad <= @noTo ");
            p.Add("noTo", req.NoTo.Value);
        }

        if (req.Vazeit.HasValue)
        {
            sb.Append(" AND P.Vazeit = @vazeit ");
            p.Add("vazeit", req.Vazeit.Value);
        }

        if (!string.IsNullOrWhiteSpace(req.FromDate))
        {
            sb.Append(" AND P.Date_In >= @fromDate ");
            p.Add("fromDate", req.FromDate);
        }
        if (!string.IsNullOrWhiteSpace(req.ToDate))
        {
            sb.Append(" AND P.Date_In <= @toDate ");
            p.Add("toDate", req.ToDate);
        }

        if (req.CodeVahed is > 0)
        {
            sb.Append(" AND S.CodeVahed = @codeVahed ");
            p.Add("codeVahed", req.CodeVahed.Value);
        }
        if (req.CodeMarkazHazine is > 0)
        {
            sb.Append(" AND S.CodeMarkazH = @codeMarkazH ");
            p.Add("codeMarkazH", req.CodeMarkazHazine.Value);
        }
        if (req.CodeProject is > 0)
        {
            sb.Append(" AND S.CodeProject = @codeProject ");
            p.Add("codeProject", req.CodeProject.Value);
        }

        return (sb.ToString(), p);
    }
}