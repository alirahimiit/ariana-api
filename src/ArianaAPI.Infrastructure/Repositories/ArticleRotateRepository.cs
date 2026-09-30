using System.Text;
using ArianaAPI.Application.Dtos.Reports.ArticleRotate;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class ArticleRotateRepository : IArticleRotateRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<ArticleRotateRepository> _logger;

    public ArticleRotateRepository(
        ITenantConnectionFactory factory,
        ILogger<ArticleRotateRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<ArticleRotateResultDto> GetAsync(
        long orgId, long fyId, ArticleRotateRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var sb = new StringBuilder();
        var p = new DynamicParameters();

        // ═══════════════════════════════════════════════════
        //  جمع حرکات فاکتوری به تفکیک نوع
        // ═══════════════════════════════════════════════════
        sb.Append(@"
        ;WITH Moves AS (
            SELECT 
                FD.ArticleID,
                FP.FactorKind,
                SUM(ISNULL(FD.ArticleCount, 0)) AS Qty,
                SUM(ISNULL(FD.CostItem, 0))    AS Val
            FROM FactorDetail_VIEW FD
            INNER JOIN FactorParent_View FP ON FP.ID = FD.FactorID
            WHERE FP.FactorKind IN (0,1,2,3,9) ");

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

        sb.Append(@"
            GROUP BY FD.ArticleID, FP.FactorKind
        ),
        Pivoted AS (
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
            FROM Moves
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
            ISNULL(P.BuyQty, 0)                       AS BuyQty,
            ISNULL(P.BuyVal, 0)                       AS BuyVal,
            ISNULL(P.SellQty, 0)                      AS SellQty,
            ISNULL(P.SellVal, 0)                      AS SellVal,
            ISNULL(P.BuyBackQty, 0)                   AS BuyBackQty,
            ISNULL(P.BuyBackVal, 0)                   AS BuyBackVal,
            ISNULL(P.SellBackQty, 0)                  AS SellBackQty,
            ISNULL(P.SellBackVal, 0)                  AS SellBackVal,
            ISNULL(P.ScrapQty, 0)                     AS ScrapQty,
            ISNULL(P.ScrapVal, 0)                     AS ScrapVal
        FROM ArticleNew_VIEW AN
        LEFT JOIN Pivoted P ON P.ArticleID = AN.ID
        WHERE 1 = 1 ");

        // ═══ فیلترها ═══
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
        if (req.ArticleId is > 0)
        {
            sb.Append(" AND AN.ID = @articleId ");
            p.Add("articleId", req.ArticleId.Value);
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

        // ═══ ORDER BY ═══
        var orderBy = (req.OrderBy ?? "name").ToLower() switch
        {
            "code" => "AN.Code",
            "groupcode" => "AN.ArticleGroupCode, AN.Code",
            "groupname" => "AN.ArticleGroupName, AN.Name",
            _ => "AN.Name"
        };
        sb.Append($" ORDER BY {orderBy} ");

        var items = (await conn.QueryAsync<ArticleRotateItemDto>(
            new CommandDefinition(sb.ToString(), p, cancellationToken: ct))).ToList();

        // ═══ محاسبه‌ی نهایی در C# ═══
        foreach (var it in items)
        {
            it.FinalQty = it.AmountFirst + it.BuyQty + it.SellBackQty
                        - it.SellQty - it.BuyBackQty - it.ScrapQty;
            it.FinalVal = it.CostFirst + it.BuyVal + it.SellBackVal
                        - it.SellVal - it.BuyBackVal - it.ScrapVal;
        }

        // ═══ فیلتر موجودی ═══
        if (req.MandehFilter == 1)
            items = items.Where(x => x.FinalQty != 0 || x.FinalVal != 0).ToList();
        else if (req.MandehFilter == 2)
            items = items.Where(x => x.FinalQty == 0 && x.FinalVal == 0).ToList();

        // ═══ جمع‌های کلی (از ALL — نه فقط صفحه‌ی فعلی) ═══
        var totals = new
        {
            AmountFirst = items.Sum(x => x.AmountFirst),
            CostFirst = items.Sum(x => x.CostFirst),
            BuyQty = items.Sum(x => x.BuyQty),
            BuyVal = items.Sum(x => x.BuyVal),
            SellQty = items.Sum(x => x.SellQty),
            SellVal = items.Sum(x => x.SellVal),
            FinalQty = items.Sum(x => x.FinalQty),
            FinalVal = items.Sum(x => x.FinalVal)
        };

        // ═══ صفحه‌بندی ═══
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize < 1 ? 50 : (req.PageSize > 100000 ? 100000 : req.PageSize);
        var totalCount = items.Count;

        var pageItems = items
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new ArticleRotateResultDto
        {
            Items = pageItems,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            TotalAmountFirst = totals.AmountFirst,
            TotalCostFirst = totals.CostFirst,
            TotalBuyQty = totals.BuyQty,
            TotalBuyVal = totals.BuyVal,
            TotalSellQty = totals.SellQty,
            TotalSellVal = totals.SellVal,
            TotalFinalQty = totals.FinalQty,
            TotalFinalVal = totals.FinalVal
        };
    }
}