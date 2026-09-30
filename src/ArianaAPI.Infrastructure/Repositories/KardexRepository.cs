using System.Data;
using System.Text;
using ArianaAPI.Application.Dtos.Reports.Kardex;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class KardexRepository : IKardexRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<KardexRepository> _logger;

    public KardexRepository(
        ITenantConnectionFactory factory,
        ILogger<KardexRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<KardexResultDto?> GetAsync(
        long orgId, long fyId, KardexRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        if (req.ArticleId is null or 0)
        {
            return await GetAllArticlesKardexAsync(conn, req, ct);
        }



        // ═══════════════════════════════════════════
        //  ۱. اطلاعات کالا
        // ═══════════════════════════════════════════
        const string articleSql = @"
            SELECT 
                AN.ID                    AS ArticleId,
                CAST(AN.Code AS NVARCHAR(50)) AS ArticleCode,
                AN.Name                  AS ArticleName,
                AN.ArticleUnitName       AS ArticleUnitName,
                AN.ArticleGroupName      AS ArticleGroupName,
                AN.StockTypeName         AS StockTypeName,
                ISNULL(AN.AmountFirst, 0) AS AmountFirst,
                ISNULL(AN.CostFirst, 0)   AS CostFirst
            FROM ArticleNew_VIEW AN
            WHERE AN.ID = @articleId";

        var info = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(articleSql,
                new { articleId = req.ArticleId }, cancellationToken: ct));

        if (info is null) return null;

        var infoDict = (IDictionary<string, object>)info;
        var result = new KardexResultDto
        {
            ArticleId = Convert.ToInt64(infoDict["ArticleId"] ?? 0L),
            ArticleCode = infoDict["ArticleCode"]?.ToString(),
            ArticleName = infoDict["ArticleName"]?.ToString(),
            ArticleUnitName = infoDict["ArticleUnitName"]?.ToString(),
            ArticleGroupName = infoDict["ArticleGroupName"]?.ToString(),
            StockTypeName = infoDict["StockTypeName"]?.ToString(),
            AmountFirst = GetDec(infoDict, "AmountFirst"),
            CostFirst = GetDec(infoDict, "CostFirst")
        };

        // ═══════════════════════════════════════════
        //  ۲. gathering همه‌ی حرکات
        // ═══════════════════════════════════════════
        var moves = new List<KardexItemDto>();

        // ─── الف) حرکات فاکتوری (FactorDetail + FactorParent) ───
        var factorMoves = await GetFactorMovesAsync(conn, req, ct);
        moves.AddRange(factorMoves);

        // ─── ب) حرکات انبار (Stock_Factor_Mat + Stock_Factor) ───
        try
        {
            var stockMoves = await GetStockMovesAsync(conn, req, ct);
            moves.AddRange(stockMoves);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "خطا در خواندن حرکات انبار (Stock_Factor) — احتمالاً جدول وجود ندارد");
        }

        // ─── ج) ردیف موجودی اولیه (اگه در بازه هست) ───
        if (result.AmountFirst != 0 || result.CostFirst != 0)
        {
            moves.Add(new KardexItemDto
            {
                Date = "",
                Time = "",
                DocType = "موجودی اولیه",
                DocNo = null,
                Descript = "موجودی اولیه انبار",
                HesabName = result.StockTypeName,
                InQty = result.AmountFirst,
                OutQty = 0,
                UnitCost = result.AmountFirst > 0
                    ? Math.Round(result.CostFirst / result.AmountFirst, 2)
                    : 0,
                InValue = result.CostFirst,
                OutValue = 0,
                SortKind = 1,   // همیشه اول
                SortId = 0
            });
        }

        // ═══════════════════════════════════════════
        //  ۳. مرتب‌سازی: تاریخ → زمان → نوع → ID
        // ═══════════════════════════════════════════
        var ordered = moves
            .OrderBy(m => m.SortKind == 1 ? "0000/00/00" : (m.Date ?? "0000/00/00"))
            .ThenBy(m => m.Time ?? "")
            .ThenBy(m => m.SortKind)
            .ThenBy(m => m.SortId)
            .ToList();

        // ═══════════════════════════════════════════
        //  ۴. محاسبه‌ی مانده‌ی تجمعی
        // ═══════════════════════════════════════════
        decimal runQty = 0, runVal = 0;
        for (int i = 0; i < ordered.Count; i++)
        {
            var it = ordered[i];
            runQty += it.InQty - it.OutQty;
            runVal += it.InValue - it.OutValue;
            it.RowNum = i + 1;
            it.Balance = runQty;
            it.BalanceValue = runVal;
        }

        // ⭐ اول جمع‌ها رو از ALL compute کن
        result.TotalInQty = ordered.Sum(x => x.InQty);
        result.TotalOutQty = ordered.Sum(x => x.OutQty);
        result.FinalQty = runQty;
        result.FinalValue = runVal;
        result.AvgUnitCost = runQty > 0 ? Math.Round(runVal / runQty, 2) : 0;

        // ⭐ بعد صفحه‌بندی
        result.TotalCount = ordered.Count;
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize < 1 ? 50 : (req.PageSize > 100000 ? 100000 : req.PageSize);
        result.Page = page;
        result.PageSize = pageSize;
        result.TotalPages = (int)Math.Ceiling(result.TotalCount / (double)pageSize);

        result.Items = ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return result;
    }

    // ═══════════════════════════════════════════════════════
    //  حرکات فاکتوری
    // ═══════════════════════════════════════════════════════
    private async Task<List<KardexItemDto>> GetFactorMovesAsync(
        SqlConnection conn, KardexRequestDto req, CancellationToken ct)
    {
        var sb = new StringBuilder(@"
        SELECT
            FP.Date_In                AS [Date],
            FP.FactorKind             AS FactorKind,
            FP.ID                     AS FactorId,
            FP.NoFactor               AS DocNo,
            ISNULL(FP.Descript, '')   AS Descript,
            ISNULL(FP.HesabName, '')  AS HesabName,
            FP.NO_Sanad               AS SanadNo,
            ISNULL(FD.ArticleCount, 0) AS ArticleCount,
            ISNULL(FD.Cost, 0)        AS UnitCost,
            ISNULL(FD.CostItem, 0)    AS CostItem
        FROM FactorDetail_VIEW FD
        INNER JOIN FactorParent_View FP ON FP.ID = FD.FactorID
        WHERE FD.ArticleID = @articleId
          AND FP.FactorKind IN (0, 1, 2, 3, 9) ");

        var p = new DynamicParameters();
        p.Add("articleId", req.ArticleId);

        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            sb.Append(" AND FP.Date_In >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            sb.Append(" AND FP.Date_In <= @dateTo ");
            p.Add("dateTo", req.DateTo.Trim());
        }
        // ⚠️ فیلتر انبار فعلاً حذف شده — چون ممکنه توی VIEW نباشه
        // اگه لازم شد، بعداً با JOIN به FactorDetail (جدول پایه) اضافه می‌کنیم

        sb.Append(" ORDER BY FP.Date_In, FP.ID ");

        var rows = await conn.QueryAsync<dynamic>(
            new CommandDefinition(sb.ToString(), p, cancellationToken: ct));

        var list = new List<KardexItemDto>();

        foreach (var r in rows)
        {
            var d = (IDictionary<string, object>)r;
            var kind = Convert.ToInt32(d["FactorKind"] ?? 0);
            var qty = GetDec(d, "ArticleCount");
            var unitCost = GetDec(d, "UnitCost");
            var costItem = GetDec(d, "CostItem");
            if (costItem == 0 && qty != 0) costItem = qty * unitCost;

            decimal inQty = 0, outQty = 0, inVal = 0, outVal = 0;

            switch (kind)
            {
                case 0: // خرید → ورودی
                case 3: // برگشت از فروش → ورودی
                    inQty = qty;
                    inVal = costItem;
                    break;

                case 1: // فروش → خروجی
                case 2: // برگشت از خرید → خروجی
                case 9: // ضایعات → خروجی
                    outQty = qty;
                    outVal = costItem;
                    break;
            }

            list.Add(new KardexItemDto
            {
                Date = d["Date"]?.ToString(),
                Time = "",              // ⚠️ Time_Op توی VIEW نیست
                DocType = GetFactorKindTitle(kind),
                DocNo = TryLong(d, "DocNo"),
                SanadNo = TryLong(d, "SanadNo"),
                Descript = d["Descript"]?.ToString(),
                HesabName = d["HesabName"]?.ToString(),
                InQty = inQty,
                OutQty = outQty,
                UnitCost = unitCost,
                InValue = inVal,
                OutValue = outVal,
                SortKind = 2,
                SortId = TryLong(d, "FactorId") ?? 0
            });
        }

        return list;
    }
    // ═══════════════════════════════════════════════════════
    //  حرکات انبار (رسید/حواله)
    // ═══════════════════════════════════════════════════════
    private async Task<List<KardexItemDto>> GetStockMovesAsync(
        SqlConnection conn, KardexRequestDto req, CancellationToken ct)
    {
        var sb = new StringBuilder(@"
            SELECT
                SF.DateIN                 AS [Date],
                CAST('' AS NVARCHAR(8))   AS [Time],
                SF.Kind                   AS StockKind,
                SF.ID                     AS StockFactorId,
                SF.Code                   AS DocNo,
                ISNULL(SF.Des, '')        AS Descript,
                ISNULL(ST.Name, '')       AS StockName,
                ISNULL(SFM.Val, 0)        AS Val,
                ISNULL(SFM.Cost, 0)       AS UnitCost,
                ISNULL(SF.StockTypeID, 0) AS StockId
            FROM Stock_Factor_Mat SFM
            INNER JOIN Stock_Factor SF ON SF.ID = SFM.StockFacorID
            LEFT JOIN StockType ST     ON ST.ID = SF.StockTypeID
            WHERE SFM.ArticleID = @articleId ");

        var p = new DynamicParameters();
        p.Add("articleId", req.ArticleId);

        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            sb.Append(" AND SF.DateIN >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            sb.Append(" AND SF.DateIN <= @dateTo ");
            p.Add("dateTo", req.DateTo.Trim());
        }
        if (req.StockId is > 0)
        {
            sb.Append(" AND ISNULL(SF.StockTypeID, 0) = @stockId ");
            p.Add("stockId", req.StockId.Value);
        }

        sb.Append(" ORDER BY SF.DateIN, SF.ID ");

        var rows = await conn.QueryAsync<dynamic>(
            new CommandDefinition(sb.ToString(), p, cancellationToken: ct));

        var list = new List<KardexItemDto>();

        foreach (var r in rows)
        {
            var d = (IDictionary<string, object>)r;
            var kind = Convert.ToInt32(d["StockKind"] ?? 0);  // 0=رسید، 1=حواله
            var qty = GetDec(d, "Val");
            var unitCost = GetDec(d, "UnitCost");
            var total = qty * unitCost;

            decimal inQty = 0, outQty = 0, inVal = 0, outVal = 0;
            string docType;

            if (kind == 0)
            {
                inQty = qty; inVal = total;
                docType = "رسید انبار";
            }
            else
            {
                outQty = qty; outVal = total;
                docType = "حواله انبار";
            }

            list.Add(new KardexItemDto
            {
                Date = d["Date"]?.ToString(),
                Time = d["Time"]?.ToString(),
                DocType = docType,
                DocNo = TryLong(d, "DocNo"),
                Descript = d["Descript"]?.ToString(),
                HesabName = d["StockName"]?.ToString(),
                InQty = inQty,
                OutQty = outQty,
                UnitCost = unitCost,
                InValue = inVal,
                OutValue = outVal,
                SortKind = 3,
                SortId = TryLong(d, "StockFactorId") ?? 0
            });
        }

        return list;
    }
    // ═══════════════════════════════════════════════════════
    //  کاردکس همه‌ی کالاها (بدون فیلتر کالا)
    // ═══════════════════════════════════════════════════════
    private async Task<KardexResultDto> GetAllArticlesKardexAsync(
        SqlConnection conn, KardexRequestDto req, CancellationToken ct)
    {
        var sb = new StringBuilder(@"
        SELECT
            AN.ID                        AS ArticleId,
            CAST(AN.Code AS NVARCHAR(50)) AS ArticleCode,
            AN.Name                       AS ArticleName,
            AN.ArticleUnitName            AS ArticleUnitName,
            FP.Date_In                    AS [Date],
            FP.FactorKind                 AS FactorKind,
            FP.ID                         AS FactorId,
            FP.NoFactor                   AS DocNo,
            ISNULL(FP.Descript, '')       AS Descript,
            ISNULL(FP.HesabName, '')      AS HesabName,
            FP.NO_Sanad                   AS SanadNo,
            ISNULL(FD.ArticleCount, 0)    AS ArticleCount,
            ISNULL(FD.Cost, 0)            AS UnitCost,
            ISNULL(FD.CostItem, 0)        AS CostItem
        FROM FactorDetail_VIEW FD
        INNER JOIN FactorParent_View FP ON FP.ID = FD.FactorID
        INNER JOIN ArticleNew_VIEW AN   ON AN.ID = FD.ArticleID
        WHERE FP.FactorKind IN (0, 1, 2, 3, 9) ");

        var p = new DynamicParameters();
        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            sb.Append(" AND FP.Date_In >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            sb.Append(" AND FP.Date_In <= @dateTo ");
            p.Add("dateTo", req.DateTo.Trim());
        }

        sb.Append(" ORDER BY AN.Name, FP.Date_In, FP.ID ");

        var rows = await conn.QueryAsync<dynamic>(
            new CommandDefinition(sb.ToString(), p, cancellationToken: ct));

        var items = new List<KardexItemDto>();
        var articleGroups = new Dictionary<long, List<KardexItemDto>>();
        var articleInfo = new Dictionary<long, (string Code, string Name, string Unit)>();

        foreach (var r in rows)
        {
            var d = (IDictionary<string, object>)r;
            var aid = Convert.ToInt64(d["ArticleId"] ?? 0L);
            var kind = Convert.ToInt32(d["FactorKind"] ?? 0);
            var qty = GetDec(d, "ArticleCount");
            var unitCost = GetDec(d, "UnitCost");
            var costItem = GetDec(d, "CostItem");
            if (costItem == 0 && qty != 0) costItem = qty * unitCost;

            decimal inQty = 0, outQty = 0, inVal = 0, outVal = 0;
            switch (kind)
            {
                case 0: case 3: inQty = qty; inVal = costItem; break;
                case 1: case 2: case 9: outQty = qty; outVal = costItem; break;
            }

            var it = new KardexItemDto
            {
                ArticleCode = d["ArticleCode"]?.ToString(),
                ArticleName = d["ArticleName"]?.ToString(),
                Date = d["Date"]?.ToString(),
                Time = "",
                DocType = GetFactorKindTitle(kind),
                DocNo = TryLong(d, "DocNo"),
                SanadNo = TryLong(d, "SanadNo"),
                Descript = d["Descript"]?.ToString(),
                HesabName = d["HesabName"]?.ToString(),
                InQty = inQty,
                OutQty = outQty,
                UnitCost = unitCost,
                InValue = inVal,
                OutValue = outVal,
                SortKind = 2,
                SortId = TryLong(d, "FactorId") ?? 0
            };

            if (!articleGroups.ContainsKey(aid))
            {
                articleGroups[aid] = new List<KardexItemDto>();
                articleInfo[aid] = (
                    d["ArticleCode"]?.ToString() ?? "",
                    d["ArticleName"]?.ToString() ?? "",
                    d["ArticleUnitName"]?.ToString() ?? ""
                );
            }
            articleGroups[aid].Add(it);
        }

        // ─── محاسبه‌ی مانده برای هر کالا ───
        var allRows = new List<KardexItemDto>();
        int rowNum = 1;
        foreach (var kv in articleGroups)
        {
            decimal runQty = 0, runVal = 0;
            foreach (var it in kv.Value.OrderBy(x => x.Date).ThenBy(x => x.SortId))
            {
                runQty += it.InQty - it.OutQty;
                runVal += it.InValue - it.OutValue;
                it.RowNum = rowNum++;
                it.Balance = runQty;
                it.BalanceValue = runVal;
                allRows.Add(it);
            }
        }

        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize < 1 ? 50 : (req.PageSize > 100000 ? 100000 : req.PageSize);

        var result = new KardexResultDto
        {
            ArticleId = 0,
            ArticleName = "همه‌ی کالاها",
            TotalInQty = allRows.Sum(x => x.InQty),
            TotalOutQty = allRows.Sum(x => x.OutQty),
            FinalQty = allRows.Sum(x => x.Balance),
            FinalValue = allRows.Sum(x => x.BalanceValue),
            TotalCount = allRows.Count,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(allRows.Count / (double)pageSize),
            Items = allRows
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList()
        };
        return result;
    }
    // ═══════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════
    private static string GetFactorKindTitle(int kind) => kind switch
    {
        0 => "فاکتور خرید",
        1 => "فاکتور فروش",
        2 => "برگشت از خرید",
        3 => "برگشت از فروش",
        4 => "پیش‌فاکتور",
        5 => "امانی ما نزد دیگران",
        6 => "امانی دیگران نزد ما",
        7 => "ارائه خدمات",
        8 => "دریافت خدمات",
        9 => "ضایعات",
        _ => "نامشخص"
    };

    private static decimal GetDec(IDictionary<string, object> d, string key)
    {
        if (!d.ContainsKey(key) || d[key] is null || d[key] is DBNull) return 0;
        try { return Convert.ToDecimal(d[key]); } catch { return 0; }
    }

    private static long? TryLong(IDictionary<string, object> d, string key)
    {
        if (!d.ContainsKey(key) || d[key] is null || d[key] is DBNull) return null;
        try { return Convert.ToInt64(d[key]); } catch { return null; }
    }
}