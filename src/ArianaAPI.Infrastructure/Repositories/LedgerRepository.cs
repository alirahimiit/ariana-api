using System.Text;
using ArianaAPI.Application.DTOs.Ledger;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
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

        // ═══════════════════════════════════════════════
        //  ستون‌های GROUP BY و SELECT بر اساس سطح
        // ═══════════════════════════════════════════════
        string groupCols;
        string codeSelect;
        string nameSelect;
        string orderCols;

        switch (level)
        {
            case "col":
                groupCols = "S.Code_Col";
                codeSelect = "CAST(0 AS INT) AS CodeMoein, CAST(0 AS INT) AS CodeTafzil, CAST(0 AS INT) AS CodeTafzili2";
                nameSelect = "MAX(ISNULL(H1.Name, '')) AS ColName, '' AS MoeinName, '' AS TafzilName, '' AS Tafzili2Name";
                orderCols = "S.Code_Col";
                break;

            case "moein":
                groupCols = "S.Code_Col, S.Code_Moein";
                codeSelect = "S.Code_Moein AS CodeMoein, CAST(0 AS INT) AS CodeTafzil, CAST(0 AS INT) AS CodeTafzili2";
                nameSelect = "MAX(ISNULL(H1.Name, '')) AS ColName, MAX(ISNULL(H2.Name, '')) AS MoeinName, '' AS TafzilName, '' AS Tafzili2Name";
                orderCols = "S.Code_Col, S.Code_Moein";
                break;

            case "tafzil":
                groupCols = "S.Code_Col, S.Code_Moein, S.Code_Tafzil";
                codeSelect = "S.Code_Moein AS CodeMoein, S.Code_Tafzil AS CodeTafzil, CAST(0 AS INT) AS CodeTafzili2";
                nameSelect = "MAX(ISNULL(H1.Name, '')) AS ColName, MAX(ISNULL(H2.Name, '')) AS MoeinName, MAX(ISNULL(H3.Name, '')) AS TafzilName, '' AS Tafzili2Name";
                orderCols = "S.Code_Col, S.Code_Moein, S.Code_Tafzil";
                break;

            case "tafzil2":
            default:
                groupCols = "S.Code_Col, S.Code_Moein, S.Code_Tafzil, S.Code_Tafzili2, S.Tafzili2ID";
                codeSelect = "S.Code_Moein AS CodeMoein, S.Code_Tafzil AS CodeTafzil, S.Code_Tafzili2 AS CodeTafzili2";
                nameSelect = "MAX(ISNULL(H1.Name, '')) AS ColName, MAX(ISNULL(H2.Name, '')) AS MoeinName, MAX(ISNULL(H3.Name, '')) AS TafzilName, MAX(ISNULL(T2.Name, '')) AS Tafzili2Name";
                orderCols = "S.Code_Col, S.Code_Moein, S.Code_Tafzil, S.Code_Tafzili2";
                break;
        }

        // ═══════════════════════════════════════════════
        //  WHERE
        // ═══════════════════════════════════════════════
        var (whereSql, parameters) = BuildWhere(req, level);

        // ═══════════════════════════════════════════════
        //  صفحه‌بندی
        // ═══════════════════════════════════════════════
        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 100;
        if (req.PageSize > 100000) req.PageSize = 100000;

        // کوئری شمارش
        var countSql = $@"
             SELECT COUNT(*) FROM (
                SELECT 1 AS X
                    FROM Sanad S
                    INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
                    {whereSql}
                GROUP BY P.ParentSanadID, P.No_Sanad, P.Date_In, P.OtherParentSharh, {groupCols}
                 ) AS T";

        // پارامترهای صفحه — با نام جدا تا تداخل نکنه
        parameters.Add("startRow", (req.Page - 1) * req.PageSize + 1);
        parameters.Add("endRow", req.Page * req.PageSize);

        // کوئری اصلی با ROW_NUMBER
        var sql = $@"
            SELECT * FROM (
                SELECT 
                    MAX(S.SanadID)             AS SanadID,
                    P.ParentSanadID            AS ParentSanadID,
                    P.No_Sanad                 AS NoSanad,
                    P.Date_In                  AS DateIn,
                    P.OtherParentSharh         AS OtherParentSharh,
                    S.Code_Col                 AS CodeCol,
                    {codeSelect},
                    SUM(S.Mab_Bed)             AS MabBed,
                    SUM(S.Mab_Bes)             AS MabBes,
                    SUM(CASE 
                     WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar, 0)
                      WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar, 0)
                       ELSE 0    END) AS Meghdar,
                    MAX(S.OtherSharh)          AS OtherSharh,
                    MAX(ISNULL(S.TikRow,0))    AS TikRow,
                    {nameSelect},
                    ROW_NUMBER() OVER (
                        ORDER BY {orderCols}, P.Date_In, P.No_Sanad
                    ) AS RowNum
                FROM Sanad S
                INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
                LEFT JOIN Hesab H1 
                    ON H1.Code_Col = S.Code_Col 
                   AND H1.Code_Moein = 0 
                   AND H1.Code_Tafzil = 0
                LEFT JOIN Hesab H2 
                    ON H2.Code_Col = S.Code_Col 
                   AND H2.Code_Moein = S.Code_Moein 
                   AND H2.Code_Tafzil = 0
                LEFT JOIN Hesab H3 
                    ON H3.Code_Col = -1 
                   AND H3.Code_Tafzil = S.Code_Tafzil
                LEFT JOIN Tafzili2 T2 
                    ON T2.Code = S.Code_Tafzili2
                {whereSql}
                GROUP BY 
                    P.ParentSanadID, 
                    P.No_Sanad, 
                    P.Date_In, 
                    P.OtherParentSharh, 
                    {groupCols}
            ) AS T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        _logger.LogDebug("Ledger SQL:\n{Sql}", sql);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ═══════════════════════════════════════════════
        //  اجرای کوئری‌ها
        // ═══════════════════════════════════════════════
        var totalCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, parameters, cancellationToken: ct));

        var items = (await conn.QueryAsync<LedgerItemDto>(
            new CommandDefinition(sql, parameters, cancellationToken: ct))).ToList();

        _logger.LogInformation("Ledger Level={Level} Page={Page} Items={Count} Total={Total}",
            level, req.Page, items.Count, totalCount);

        // ═══════════════════════════════════════════════
        //  مانده تجمعی — per code group
        // ═══════════════════════════════════════════════
        var running = 0m;
        int? prevCol = null, prevMoein = null, prevTafzil = null, prevTafzili2 = null;
        bool first = true;

        foreach (var it in items)
        {
            bool sameGroup =
                !first &&
                prevCol == it.CodeCol &&
                (level == "col" || (
                    prevMoein == it.CodeMoein &&
                    (level == "moein" || (
                        prevTafzil == it.CodeTafzil &&
                        (level == "tafzil" || prevTafzili2 == it.CodeTafzili2)
                    ))
                ));

            if (!sameGroup)
            {
                running = 0m;
                prevCol = it.CodeCol;
                prevMoein = it.CodeMoein;
                prevTafzil = it.CodeTafzil;
                prevTafzili2 = it.CodeTafzili2;
                first = false;
            }

            running += (it.MabBes - it.MabBed);
            it.MabMan = running;
        }

        var totalPages = (int)Math.Ceiling(totalCount / (double)req.PageSize);

        return new LedgerResultDto
        {
            Level = level,
            Items = items,
            TotalBed = items.Sum(x => x.MabBed),
            TotalBes = items.Sum(x => x.MabBes),
            TotalMan = items.Sum(x => x.MabBes - x.MabBed),
            MandehBefore = null,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = totalCount,
            TotalPages = totalPages
        };
    }

    // ═══════════════════════════════════════════════════
    //  WHERE دینامیک
    // ═══════════════════════════════════════════════════
    private static (string Sql, DynamicParameters Params) BuildWhere(
        LedgerRequestDto req, string level, bool ignoreFromDate = false)
    {
        var sb = new StringBuilder(" WHERE S.Code_Col > 0 ");
        var p = new DynamicParameters();

        if (level == "tafzil" || level == "tafzil2")
        {
            sb.Append(" AND ISNULL(S.Code_Tafzil, 0) > 0 ");
        }

        if (level == "tafzil2")
        {
            sb.Append(" AND ISNULL(S.Code_Tafzili2, 0) > 0 ");
        }

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

        if (level is "moein" or "tafzil" or "tafzil2")
        {
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
        }

        if (level is "tafzil" or "tafzil2")
        {
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

        if (req.TikRow.HasValue)
        {
            sb.Append(" AND ISNULL(S.TikRow, 0) = @tikRow ");
            p.Add("tikRow", req.TikRow.Value);
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
            if (ignoreFromDate)
                sb.Append(" AND P.Date_In < @fromDate ");
            else
                sb.Append(" AND P.Date_In >= @fromDate ");
            p.Add("fromDate", req.FromDate);
        }
        if (!string.IsNullOrWhiteSpace(req.ToDate))
        {
            sb.Append(" AND P.Date_In <= @toDate ");
            p.Add("toDate", req.ToDate);
        }

        return (sb.ToString(), p);
    }
}