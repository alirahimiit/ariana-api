using ArianaAPI.Application.Dtos.Reports;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class DayBookRepository : IDayBookRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<DayBookRepository> _logger;

    public DayBookRepository(
        ITenantConnectionFactory factory,
        ILogger<DayBookRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<DayBookResultDto> GetReportAsync(
        long orgId, long fyId, DayBookRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var mode = (req.Mode ?? "aggregated").ToLowerInvariant();
        var level = (req.Level ?? "col").ToLowerInvariant();

        List<DayBookItemDto> items = mode == "persanad"
            ? await GetPerSanadAsync(conn, req, ct)
            : await GetAggregatedAsync(conn, req, level, ct);

        // ─── صفحه‌بندی سمت C# ───
        int totalCount = items.Count;
        int pageSize = Math.Max(1, req.PageSize);
        int totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (totalPages < 1) totalPages = 1;

        int page = Math.Max(1, Math.Min(req.Page, totalPages));
        var pagedItems = items.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new DayBookResultDto
        {
            Level = level,
            Mode = mode,
            FromDate = req.FromDate,
            ToDate = req.ToDate,
            Items = pagedItems,
            TotalBed = items.Sum(x => x.MabBed),
            TotalBes = items.Sum(x => x.MabBes),
            Page = page,
            TotalPages = totalPages,
            TotalCount = totalCount
        };
    }

    // ═══════════════════════════════════════════════════════════
    //  حالت تجمیعی — یک ردیف برای هر (Col / Moein / Tafzil / Tafzili2)
    // ═══════════════════════════════════════════════════════════
    private async Task<List<DayBookItemDto>> GetAggregatedAsync(
    System.Data.IDbConnection conn, DayBookRequestDto req, string level, CancellationToken ct)
    {
        var where = new List<string> { "S.Code_Col > 0" };
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.FromDate))
        { where.Add("P.Date_IN >= @FromDate"); p.Add("FromDate", req.FromDate); }
        if (!string.IsNullOrWhiteSpace(req.ToDate))
        { where.Add("P.Date_IN <= @ToDate"); p.Add("ToDate", req.ToDate); }
        if (req.NoFrom.HasValue)
        { where.Add("P.No_Sanad >= @NoFrom"); p.Add("NoFrom", req.NoFrom.Value); }
        if (req.NoTo.HasValue)
        { where.Add("P.No_Sanad <= @NoTo"); p.Add("NoTo", req.NoTo.Value); }
        if (req.Vazeit.HasValue)
        { where.Add("P.Vazeit = @Vazeit"); p.Add("Vazeit", req.Vazeit.Value); }

        // ─── تعریف SELECT / WHERE / GROUP BY بر اساس level ───
        string selectCodes, whereLevel, groupByCols, orderCols;
        switch (level)
        {
            case "moein":
                selectCodes = "S.Code_Col AS CodeCol, S.Code_Moein AS CodeMoein, NULL AS CodeTafzil, NULL AS CodeTafzili2";
                whereLevel = "AND S.Code_Moein > 0";
                groupByCols = "S.Code_Col, S.Code_Moein";
                orderCols = "CodeCol, CodeMoein";
                break;
            case "tafzil":
                selectCodes = "S.Code_Col AS CodeCol, S.Code_Moein AS CodeMoein, S.Code_Tafzil AS CodeTafzil, NULL AS CodeTafzili2";
                whereLevel = "AND S.Code_Moein > 0 AND S.Code_Tafzil > 0";
                groupByCols = "S.Code_Col, S.Code_Moein, S.Code_Tafzil";
                orderCols = "CodeCol, CodeMoein, CodeTafzil";
                break;
            case "tafzil2":
                selectCodes = "S.Code_Col AS CodeCol, S.Code_Moein AS CodeMoein, S.Code_Tafzil AS CodeTafzil, S.Code_Tafzili2 AS CodeTafzili2";
                whereLevel = "AND S.Code_Moein > 0 AND S.Code_Tafzil > 0 AND ISNULL(S.Code_Tafzili2, 0) > 0";
                groupByCols = "S.Code_Col, S.Code_Moein, S.Code_Tafzil, S.Code_Tafzili2";
                orderCols = "CodeCol, CodeMoein, CodeTafzil, CodeTafzili2";
                break;
            default: // col
                selectCodes = "S.Code_Col AS CodeCol, NULL AS CodeMoein, NULL AS CodeTafzil, NULL AS CodeTafzili2";
                whereLevel = "";
                groupByCols = "S.Code_Col";
                orderCols = "CodeCol";
                break;
        }

        // ─── JOIN ها بر اساس level ───
        var joins = new List<string>
    {
        "INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode",
        "LEFT JOIN Hesab HC ON HC.Code_Col = S.Code_Col AND HC.Code_Moein = 0 AND HC.Code_Tafzil = 0"
    };
        var nameSelects = new List<string> { "MAX(HC.Name) AS ColName" };

        if (level == "moein" || level == "tafzil" || level == "tafzil2")
        {
            joins.Add("LEFT JOIN Hesab HM ON HM.Code_Col = S.Code_Col AND HM.Code_Moein = S.Code_Moein AND HM.Code_Tafzil = 0");
            nameSelects.Add("MAX(HM.Name) AS MoeinName");
        }
        if (level == "tafzil" || level == "tafzil2")
        {
            joins.Add("LEFT JOIN Hesab HT ON HT.Code_Col = S.Code_Col AND HT.Code_Moein = S.Code_Moein AND HT.Code_Tafzil = S.Code_Tafzil");
            nameSelects.Add("MAX(HT.Name) AS TafzilName");
        }
        if (level == "tafzil2")
        {
            joins.Add("LEFT JOIN Tafzili2 HT2 ON HT2.Code = S.Code_Tafzili2");
            nameSelects.Add("MAX(HT2.Name) AS Tafzili2Name");
        }

        var joinsStr = string.Join("\n    ", joins);
        var nameSelectsStr = string.Join(", ", nameSelects);
        var whereStr = string.Join(" AND ", where);

        // ═══════════════════════════════════════════════════════════
        //  UNION ALL: اول همه‌ی Bed (Vazeit=1)، بعد همه‌ی Bes (Vazeit=2)
        //  ترتیب: Vazeit → Code_Col → Code_Moein → Code_Tafzil → Code_Tafzili2
        // ═══════════════════════════════════════════════════════════
        var sql = $@"
;WITH Agg AS (
    -- ═══ ردیف‌های بدهکار (Vazeit=1) ═══
    SELECT 
        {selectCodes},
        1 AS Vazeit,
        SUM(S.Mab_Bed) AS MabBed,
        CAST(0 AS DECIMAL(19,0)) AS MabBes,
        {nameSelectsStr}
    FROM Sanad S
    {joinsStr}
    WHERE {whereStr}
      {whereLevel}
    GROUP BY {groupByCols}
    
    UNION ALL
    
    -- ═══ ردیف‌های بستانکار (Vazeit=2) ═══
    SELECT 
        {selectCodes},
        2 AS Vazeit,
        CAST(0 AS DECIMAL(19,0)) AS MabBed,
        SUM(S.Mab_Bes) AS MabBes,
        {nameSelectsStr}
    FROM Sanad S
    {joinsStr}
    WHERE {whereStr}
      {whereLevel}
    GROUP BY {groupByCols}
)
SELECT * FROM Agg
WHERE MabBed <> 0 OR MabBes <> 0
ORDER BY Vazeit, {orderCols}";

        _logger.LogDebug("DayBook Agg SQL ({Level}): {Sql}", level, sql);

        var rows = (await conn.QueryAsync<RawRow>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        return rows.Select(r => new DayBookItemDto
        {
            CodeCol = r.CodeCol,
            CodeMoein = r.CodeMoein,
            CodeTafzil = r.CodeTafzil,
            CodeTafzili2 = r.CodeTafzili2,
            HesabName = BuildHesabName(level, r),
            MabBed = r.MabBed,
            MabBes = r.MabBes,
            Vazeit = r.Vazeit
        }).ToList();
    }

    // ═══════════════════════════════════════════════════════════
    //  حالت بصورت سند — یک ردیف برای هر (Sanad × Code_Col)
    // ═══════════════════════════════════════════════════════════
    private async Task<List<DayBookItemDto>> GetPerSanadAsync(
        System.Data.IDbConnection conn, DayBookRequestDto req, CancellationToken ct)
    {
        var where = new List<string> { "S.Code_Col > 0" };
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.FromDate))
        { where.Add("P.Date_IN >= @FromDate"); p.Add("FromDate", req.FromDate); }
        if (!string.IsNullOrWhiteSpace(req.ToDate))
        { where.Add("P.Date_IN <= @ToDate"); p.Add("ToDate", req.ToDate); }
        if (req.NoFrom.HasValue)
        { where.Add("P.No_Sanad >= @NoFrom"); p.Add("NoFrom", req.NoFrom.Value); }
        if (req.NoTo.HasValue)
        { where.Add("P.No_Sanad <= @NoTo"); p.Add("NoTo", req.NoTo.Value); }
        if (req.Vazeit.HasValue)
        { where.Add("P.Vazeit = @Vazeit"); p.Add("Vazeit", req.Vazeit.Value); }

        var hesabOption = (req.HesabOption ?? "all").ToLowerInvariant();
        string extraBed = hesabOption == "nozerogardesh" ? "AND S.Mab_Bed <> 0" : "";
        string extraBes = hesabOption == "nozerogardesh" ? "AND S.Mab_Bes <> 0" : "";

        var whereStr = string.Join(" AND ", where);

        // ⭐ نکته: No_Sanad و Date_In رو با CAST ساده می‌گیریم
        var sql = $@"
;WITH ColAgg AS (
    -- Bed
    SELECT 
        P.No_Sanad                       AS NoSanadNum,
        CAST(P.No_Sanad AS NVARCHAR(50)) AS NoSanad,
        CAST(P.Date_In  AS NVARCHAR(20)) AS DateIn,
        P.OtherParentSharh               AS OtherParentSharh,
        S.Code_Col                       AS CodeCol,
        1                                AS Vazeit,
        SUM(S.Mab_Bed)                   AS MabBed,
        CAST(0 AS DECIMAL(19,0))         AS MabBes,
        MAX(HC.Name)                     AS ColName,
        MAX(S.OtherSharh)                AS OtherSharh
    FROM Sanad S
    INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
    LEFT JOIN Hesab HC ON HC.Code_Col = S.Code_Col AND HC.Code_Moein = 0 AND HC.Code_Tafzil = 0
    WHERE {whereStr} {extraBed}
    GROUP BY P.ParentSanadID, P.No_Sanad, P.Date_In, P.OtherParentSharh, S.Code_Col

    UNION ALL

    -- Bes
    SELECT 
        P.No_Sanad                       AS NoSanadNum,
        CAST(P.No_Sanad AS NVARCHAR(50)) AS NoSanad,
        CAST(P.Date_In  AS NVARCHAR(20)) AS DateIn,
        P.OtherParentSharh               AS OtherParentSharh,
        S.Code_Col                       AS CodeCol,
        2                                AS Vazeit,
        CAST(0 AS DECIMAL(19,0))         AS MabBed,
        SUM(S.Mab_Bes)                   AS MabBes,
        MAX(HC.Name)                     AS ColName,
        MAX(S.OtherSharh)                AS OtherSharh
    FROM Sanad S
    INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
    LEFT JOIN Hesab HC ON HC.Code_Col = S.Code_Col AND HC.Code_Moein = 0 AND HC.Code_Tafzil = 0
    WHERE {whereStr} {extraBes}
    GROUP BY P.ParentSanadID, P.No_Sanad, P.Date_In, P.OtherParentSharh, S.Code_Col
)
SELECT 
    NoSanad, DateIn, OtherParentSharh, CodeCol, Vazeit, MabBed, MabBes, ColName, OtherSharh
FROM ColAgg
WHERE MabBed <> 0 OR MabBes <> 0
ORDER BY Vazeit, CodeCol, NoSanadNum, DateIn";

        _logger.LogDebug("DayBook PerSanad SQL: {Sql}", sql);

        var rows = (await conn.QueryAsync<RawRow>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        return rows.Select(r => new DayBookItemDto
        {
            NoSanad = r.NoSanad ?? "",
            DateIn = r.DateIn ?? "",
            OtherParentSharh = r.OtherParentSharh ?? "",
            CodeCol = r.CodeCol,
            HesabName = r.ColName ?? "",
            OtherSharh = r.OtherSharh ?? "",
            MabBed = r.MabBed,
            MabBes = r.MabBes,
            Vazeit = r.Vazeit
        }).ToList();
    }

    private static string BuildHesabName(string level, RawRow r)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(r.ColName)) parts.Add(r.ColName);
        if (level == "moein" || level == "tafzil" || level == "tafzil2")
            if (!string.IsNullOrEmpty(r.MoeinName)) parts.Add(r.MoeinName);
        if (level == "tafzil" || level == "tafzil2")
            if (!string.IsNullOrEmpty(r.TafzilName)) parts.Add(r.TafzilName);
        if (level == "tafzil2")
            if (!string.IsNullOrEmpty(r.Tafzili2Name)) parts.Add(r.Tafzili2Name);
        return string.Join(" - ", parts);
    }
    internal class RawRow
    {
        public int CodeCol { get; set; }
        public int? CodeMoein { get; set; }
        public int? CodeTafzil { get; set; }
        public long? CodeTafzili2 { get; set; }
        public decimal MabBed { get; set; }
        public decimal MabBes { get; set; }
        public string? ColName { get; set; }
        public string? MoeinName { get; set; }
        public string? TafzilName { get; set; }
        public string? Tafzili2Name { get; set; }
        // perSanad — همه string
        public string? NoSanad { get; set; }
        public string? DateIn { get; set; }
        public string? OtherParentSharh { get; set; }
        public string? OtherSharh { get; set; }
        public int Vazeit { get; set; }
        public int NoSanadNum { get; set; }
    }
}