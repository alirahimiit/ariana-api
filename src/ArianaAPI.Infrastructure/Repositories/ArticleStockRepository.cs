using System.Text;
using ArianaAPI.Application.Dtos.Reports.ArticleStock;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class ArticleStockRepository : IArticleStockRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<ArticleStockRepository> _logger;

    public ArticleStockRepository(
        ITenantConnectionFactory factory,
        ILogger<ArticleStockRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<ArticleStockResultDto> GetAsync(
        long orgId, long fyId, ArticleStockRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var sb = new StringBuilder();
        var p = new DynamicParameters();

        // ═══════════════════════════════════════════════════
        //  CTE: FactorMoves + FactorPivot + StockMoves + StockPivot
        //  ⭐ ستون‌های جدید: InStockQty/Val, OutStockQty/Val
        // ═══════════════════════════════════════════════════
        sb.Append(@"
    ;WITH FactorMoves AS (
        SELECT 
            FD.ArticleID,
            FP.FactorKind,
            SUM(ISNULL(FD.ArticleCount, 0)) AS Qty,
            SUM(ISNULL(FD.CostItem, 0))     AS Val
        FROM FactorDetail_VIEW FD
        INNER JOIN FactorParent_View FP ON FP.ID = FD.FactorID
        WHERE FP.FactorKind IN (0,1,2,3,9)
        GROUP BY FD.ArticleID, FP.FactorKind
    ),
    FactorPivot AS (
        SELECT 
            ArticleID,
            SUM(CASE WHEN FactorKind = 0 THEN Qty ELSE 0 END) AS BuyQty,
            SUM(CASE WHEN FactorKind = 0 THEN Val ELSE 0 END) AS BuyVal,
            SUM(CASE WHEN FactorKind = 1 THEN Qty ELSE 0 END) AS SellQty,
            SUM(CASE WHEN FactorKind = 1 THEN Val ELSE 0 END) AS SellVal,
            SUM(CASE WHEN FactorKind = 2 THEN Qty ELSE 0 END) AS BuyBackQty,
            SUM(CASE WHEN FactorKind = 2 THEN Val ELSE 0 END) AS BuyBackVal,
            SUM(CASE WHEN FactorKind = 3 THEN Qty ELSE 0 END) AS SellBackQty,
            SUM(CASE WHEN FactorKind = 3 THEN Val ELSE 0 END) AS SellBackVal,
            SUM(CASE WHEN FactorKind = 9 THEN Qty ELSE 0 END) AS ScrapQty,
            SUM(CASE WHEN FactorKind = 9 THEN Val ELSE 0 END) AS ScrapVal
        FROM FactorMoves
        GROUP BY ArticleID
    ),
    StockMoves AS (
        SELECT 
            SFM.ArticleID,
            SF.Kind,  -- 0=رسید، 1=حواله، 2=رسید برگشتی
            SUM(ISNULL(SFM.Val, 0))                       AS Qty,
            SUM(ISNULL(SFM.Val, 0) * ISNULL(SFM.Cost, 0)) AS Val
        FROM Stock_Factor_Mat SFM
        INNER JOIN Stock_Factor SF ON SF.ID = SFM.StockFacorID
        GROUP BY SFM.ArticleID, SF.Kind
    ),
    StockPivot AS (
        SELECT 
            ArticleID,
            SUM(CASE WHEN Kind IN (0, 2) THEN Qty ELSE 0 END) AS InStockQty,
            SUM(CASE WHEN Kind IN (0, 2) THEN Val ELSE 0 END) AS InStockVal,
            SUM(CASE WHEN Kind = 1 THEN Qty ELSE 0 END)       AS OutStockQty,
            SUM(CASE WHEN Kind = 1 THEN Val ELSE 0 END)       AS OutStockVal
        FROM StockMoves
        GROUP BY ArticleID
    )

    SELECT 
        AN.ID                                     AS ArticleId,
        CAST(AN.Code AS NVARCHAR(50))             AS ArticleCode,
        AN.Name                                   AS ArticleName,
        AN.ArticleUnitName                        AS ArticleUnitName,
        CAST(AN.ArticleGroupCode AS NVARCHAR(50)) AS ArticleGroupCode,
        AN.ArticleGroupName                       AS ArticleGroupName,
        CAST(AN.StockTypeCode AS NVARCHAR(50))    AS StockTypeCode,
        AN.StockTypeName                          AS StockTypeName,
        ISNULL(AN.AmountFirst, 0)                 AS AmountFirst,
        ISNULL(AN.CostFirst, 0)                   AS CostFirst,
        ISNULL(AN.AmountSale, 0)                  AS SalePrice,
        ISNULL(FP.BuyQty, 0)                      AS TotalBuyQty,
        ISNULL(FP.BuyVal, 0)                      AS TotalBuyVal,
        ISNULL(FP.SellQty, 0)                     AS TotalSellQty,
        ISNULL(FP.SellVal, 0)                     AS TotalSellVal,
        ISNULL(FP.BuyBackQty, 0)                  AS BackBuyQty,
        ISNULL(FP.BuyBackVal, 0)                  AS BackBuyVal,
        ISNULL(FP.SellBackQty, 0)                 AS BackSellQty,
        ISNULL(FP.SellBackVal, 0)                 AS BackSellVal,
        ISNULL(FP.ScrapQty, 0)                    AS ScrapQty,
        ISNULL(FP.ScrapVal, 0)                    AS ScrapVal,
        ISNULL(SP.InStockQty, 0)                  AS InStockQty,
        ISNULL(SP.InStockVal, 0)                  AS InStockVal,
        ISNULL(SP.OutStockQty, 0)                 AS OutStockQty,
        ISNULL(SP.OutStockVal, 0)                 AS OutStockVal
    FROM ArticleNew_VIEW AN
    LEFT JOIN FactorPivot FP ON FP.ArticleID = AN.ID
    LEFT JOIN StockPivot  SP ON SP.ArticleID = AN.ID
    WHERE 1 = 1 ");

        // ═══ فیلترها (بدون تغییر) ═══
        if (req.StockId is > 0)
        {
            sb.Append(" AND AN.StockTypeID = @stockId ");
            p.Add("stockId", req.StockId.Value);
        }
        if (req.ArticleGroupId is > 0)
        {
            sb.Append(" AND AN.ArticleGroupID = @groupId ");
            p.Add("groupId", req.ArticleGroupId.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.ArticleCode))
        {
            sb.Append(" AND CAST(AN.Code AS NVARCHAR(50)) LIKE @code + '%' ");
            p.Add("code", req.ArticleCode.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.ArticleName))
        {
            sb.Append(" AND AN.Name LIKE '%' + @name + '%' ");
            p.Add("name", req.ArticleName.Trim());
        }

        var orderBy = (req.OrderBy ?? "name").ToLower() switch
        {
            "code" => "AN.Code",
            "stock" => @"(ISNULL(AN.AmountFirst, 0) 
              + ISNULL(FP.BuyQty, 0) + ISNULL(FP.SellBackQty, 0)
              + ISNULL(SP.InStockQty, 0)
              - ISNULL(FP.SellQty, 0) - ISNULL(FP.BuyBackQty, 0)
              - ISNULL(FP.ScrapQty, 0) - ISNULL(SP.OutStockQty, 0)) DESC",
            "value" => @"(ISNULL(AN.CostFirst, 0) 
              + ISNULL(FP.BuyVal, 0) + ISNULL(FP.SellBackVal, 0)
              + ISNULL(SP.InStockVal, 0)
              - ISNULL(FP.SellVal, 0) - ISNULL(FP.BuyBackVal, 0)
              - ISNULL(FP.ScrapVal, 0) - ISNULL(SP.OutStockVal, 0)) DESC",
            _ => "AN.Name"
        };
        sb.Append($" ORDER BY {orderBy} ");

        var rows = await conn.QueryAsync<dynamic>(
            new CommandDefinition(sb.ToString(), p, cancellationToken: ct));

        var items = new List<ArticleStockItemDto>();

        foreach (var r in rows)
        {
            var d = (IDictionary<string, object>)r;

            decimal amountFirst = GetDec(d, "AmountFirst");
            decimal costFirst = GetDec(d, "CostFirst");
            decimal buyQty = GetDec(d, "TotalBuyQty");
            decimal buyVal = GetDec(d, "TotalBuyVal");
            decimal sellQty = GetDec(d, "TotalSellQty");
            decimal sellVal = GetDec(d, "TotalSellVal");
            decimal bbQty = GetDec(d, "BackBuyQty");
            decimal bbVal = GetDec(d, "BackBuyVal");
            decimal bsQty = GetDec(d, "BackSellQty");
            decimal bsVal = GetDec(d, "BackSellVal");
            decimal scrapQty = GetDec(d, "ScrapQty");
            decimal scrapVal = GetDec(d, "ScrapVal");
            decimal inStockQty = GetDec(d, "InStockQty");
            decimal inStockVal = GetDec(d, "InStockVal");
            decimal outStockQty = GetDec(d, "OutStockQty");
            decimal outStockVal = GetDec(d, "OutStockVal");

            // ⭐ فرمول نهایی: موجودی اول + خرید + برگشت فروش + رسید − فروش − برگشت خرید − ضایعات − حواله
            decimal finalQty = amountFirst + buyQty + bsQty + inStockQty
                             - sellQty - bbQty - scrapQty - outStockQty;
            decimal finalVal = costFirst + buyVal + bsVal + inStockVal
                             - sellVal - bbVal - scrapVal - outStockVal;

            items.Add(new ArticleStockItemDto
            {
                ArticleId = GetLong(d, "ArticleId") ?? 0,
                ArticleCode = d["ArticleCode"]?.ToString(),
                ArticleName = d["ArticleName"]?.ToString(),
                ArticleUnitName = d["ArticleUnitName"]?.ToString(),
                ArticleGroupCode = d["ArticleGroupCode"]?.ToString(),
                ArticleGroupName = d["ArticleGroupName"]?.ToString(),
                StockTypeCode = d["StockTypeCode"]?.ToString(),
                StockTypeName = d["StockTypeName"]?.ToString(),

                AmountFirst = amountFirst,
                CostFirst = costFirst,
                TotalBuyQty = buyQty + inStockQty,      // ⭐ رسید هم جزء خرید
                TotalBuyVal = buyVal + inStockVal,
                TotalSellQty = sellQty + outStockQty,   // ⭐ حواله هم جزء فروش
                TotalSellVal = sellVal + outStockVal,

                FinalQty = finalQty,
                FinalVal = finalVal,
                AvgPrice = finalQty > 0 ? Math.Round(finalVal / finalQty, 2) : 0,
                SalePrice = GetDec(d, "SalePrice")
            });
        }

        // فیلتر موجودی
        if (req.StockFilter == 1) items = items.Where(x => x.FinalQty > 0).ToList();
        else if (req.StockFilter == 2) items = items.Where(x => x.FinalQty == 0).ToList();
        else if (req.StockFilter == 3) items = items.Where(x => x.FinalQty < 0).ToList();

        // جمع‌ها
        var result = new ArticleStockResultDto
        {
            TotalCount = items.Count,
            TotalFinalQty = items.Sum(x => x.FinalQty),
            TotalFinalVal = items.Sum(x => x.FinalVal),
            TotalCostFirst = items.Sum(x => x.CostFirst),
            WithStockCount = items.Count(x => x.FinalQty > 0),
            ZeroCount = items.Count(x => x.FinalQty == 0),
            NegativeCount = items.Count(x => x.FinalQty < 0)
        };

        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize < 1 ? 50 : (req.PageSize > 100000 ? 100000 : req.PageSize);

        result.Page = page;
        result.PageSize = pageSize;
        result.TotalPages = (int)Math.Ceiling(result.TotalCount / (double)pageSize);
        result.Items = items
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return result;
    }
    // ═══ Helpers ═══
    private static decimal GetDec(IDictionary<string, object> d, string key)
    {
        if (!d.ContainsKey(key) || d[key] is null || d[key] is DBNull) return 0;
        try { return Convert.ToDecimal(d[key]); } catch { return 0; }
    }

    private static long? GetLong(IDictionary<string, object> d, string key)
    {
        if (!d.ContainsKey(key) || d[key] is null || d[key] is DBNull) return null;
        try { return Convert.ToInt64(d[key]); } catch { return null; }
    }
}