using System.Text;
using ArianaAPI.Application.Dtos.Reports.PartyFactor;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class PartyFactorRepository : IPartyFactorRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<PartyFactorRepository> _logger;

    public PartyFactorRepository(
        ITenantConnectionFactory factory,
        ILogger<PartyFactorRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<PartyFactorResultDto?> GetAsync(
        long orgId, long fyId, PartyFactorRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var result = new PartyFactorResultDto { CodeTafzil = req.CodeTafzil };

        // ═══════════════════════════════════════════════════
        //  ۱. اطلاعات طرف حساب
        // ═══════════════════════════════════════════════════
        if (req.CodeTafzil is > 0)
        {
            const string hesabSql = @"
                SELECT 
                    Code_Tafzil      AS CodeTafzil,
                    Name             AS HesabName,
                    Phone            AS Phone,
                    Mobile           AS Mobile,
                    NationalCode     AS NationalCode,
                    EconomicCode     AS EconomicCode,
                    Address          AS Address
                FROM Tafzili_Customer_VIEW
                WHERE Code_Tafzil = @codeTafzil";

            var hesab = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(hesabSql,
                    new { codeTafzil = req.CodeTafzil.Value },
                    cancellationToken: ct));

            if (hesab is null) return null;

            var hd = (IDictionary<string, object>)hesab;
            result.HesabName = hd["HesabName"]?.ToString();
            result.Phone = hd["Phone"]?.ToString();
            result.Mobile = hd["Mobile"]?.ToString();
            result.NationalCode = hd["NationalCode"]?.ToString();
            result.EconomicCode = hd["EconomicCode"]?.ToString();
            result.Address = hd["Address"]?.ToString();
        }

        // ═══════════════════════════════════════════════════
        //  ۲. WHERE
        // ═══════════════════════════════════════════════════
        var where = new StringBuilder(" WHERE FP.FactorKind IN (0,1,2,3,9) ");
        var p = new DynamicParameters();

        if (req.CodeTafzil is > 0)
        {
            where.Append(" AND FP.CodeTafzil = @codeTafzil ");
            p.Add("codeTafzil", req.CodeTafzil.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.HesabName))
        {
            where.Append(" AND FP.HesabName LIKE '%' + @hesabName + '%' ");
            p.Add("hesabName", req.HesabName.Trim());
        }
        if (req.FactorKind.HasValue)
        {
            where.Append(" AND FP.FactorKind = @factorKind ");
            p.Add("factorKind", req.FactorKind.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            where.Append(" AND FP.Date_In >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            where.Append(" AND FP.Date_In <= @dateTo ");
            p.Add("dateTo", req.DateTo.Trim());
        }
        if (req.NoFrom is > 0)
        {
            where.Append(" AND FP.NoFactor >= @noFrom ");
            p.Add("noFrom", req.NoFrom.Value);
        }
        if (req.NoTo is > 0)
        {
            where.Append(" AND FP.NoFactor <= @noTo ");
            p.Add("noTo", req.NoTo.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.Descript))
        {
            where.Append(" AND FP.Descript LIKE '%' + @descript + '%' ");
            p.Add("descript", req.Descript.Trim());
        }
        if (req.OnlyWithoutSanad == true)
        {
            where.Append(" AND (FP.Parent_Sanad_ID IS NULL OR FP.Parent_Sanad_ID = 0) ");
        }

        // ═══════════════════════════════════════════════════
        //  ۳. حالت Grouped → کوئری متفاوت
        // ═══════════════════════════════════════════════════
        if (req.ViewMode == "grouped")
        {
            var groupedSql = $@"
            SELECT 
                FP.CodeTafzil                                        AS CodeTafzil,
                ISNULL(FP.HesabName, '')                             AS HesabName,
                FD.ArticleID                                         AS ArticleId,
                CAST(AN.Code AS NVARCHAR(50))                        AS ArticleCode,
                AN.Name                                              AS ArticleName,
                ISNULL(AN.ArticleUnitName, '')                       AS ArticleUnitName,
                ISNULL(SUM(CASE WHEN FP.FactorKind = 0 THEN FD.ArticleCount ELSE 0 END), 0) AS BuyQty,
                ISNULL(SUM(CASE WHEN FP.FactorKind = 0 THEN FD.CostItem ELSE 0 END), 0)     AS BuyAmount,
                ISNULL(SUM(CASE WHEN FP.FactorKind = 1 THEN FD.ArticleCount ELSE 0 END), 0) AS SellQty,
                ISNULL(SUM(CASE WHEN FP.FactorKind = 1 THEN FD.CostItem ELSE 0 END), 0)     AS SellAmount,
                ISNULL(SUM(CASE WHEN FP.FactorKind = 2 THEN FD.ArticleCount ELSE 0 END), 0) AS BackBuyQty,
                ISNULL(SUM(CASE WHEN FP.FactorKind = 2 THEN FD.CostItem ELSE 0 END), 0)     AS BackBuyAmount,
                ISNULL(SUM(CASE WHEN FP.FactorKind = 3 THEN FD.ArticleCount ELSE 0 END), 0) AS BackSellQty,
                ISNULL(SUM(CASE WHEN FP.FactorKind = 3 THEN FD.CostItem ELSE 0 END), 0)     AS BackSellAmount
            FROM FactorDetail_VIEW FD
            INNER JOIN FactorParent_View FP ON FP.ID = FD.FactorID
            INNER JOIN ArticleNew_VIEW AN   ON AN.ID = FD.ArticleID
            {where}
            GROUP BY 
                FP.CodeTafzil, FP.HesabName,
                FD.ArticleID, AN.Code, AN.Name, AN.ArticleUnitName
            ";

            // ORDER BY
            var groupedOrder = (req.GroupBy ?? "article").ToLower() == "party"
                ? " ORDER BY HesabName, ArticleName "
                : " ORDER BY ArticleName, HesabName ";
            groupedSql += groupedOrder;

            var articleItems = (await conn.QueryAsync<PartyArticleItemDto>(
                new CommandDefinition(groupedSql, p, cancellationToken: ct))).ToList();

            // محاسبه‌ی مانده
            foreach (var it in articleItems)
            {
                it.NetQty = it.BuyQty - it.SellQty - it.BackBuyQty + it.BackSellQty;
                it.NetAmount = it.BuyAmount - it.SellAmount - it.BackBuyAmount + it.BackSellAmount;
            }

            result.ArticleItems = articleItems;
            result.TotalCount = articleItems.Count;

            // جمع‌های کلی از داده‌ی grouped
            result.BuyCount = articleItems.Count(x => x.BuyQty > 0);
            result.SellCount = articleItems.Count(x => x.SellQty > 0);
            result.BackBuyCount = articleItems.Count(x => x.BackBuyQty > 0);
            result.BackSellCount = articleItems.Count(x => x.BackSellQty > 0);

            result.TotalBuyAmount = articleItems.Sum(x => x.BuyAmount);
            result.TotalSellAmount = articleItems.Sum(x => x.SellAmount);
            result.TotalBackBuyAmount = articleItems.Sum(x => x.BackBuyAmount);
            result.TotalBackSellAmount = articleItems.Sum(x => x.BackSellAmount);
            result.TotalFinalAmount = articleItems.Sum(x => x.BuyAmount + x.SellAmount
                                                            + x.BackBuyAmount + x.BackSellAmount);

            return result;
        }

        // ═══════════════════════════════════════════════════
        //  ۴. حالت Flat → کوئری فاکتورها
        // ═══════════════════════════════════════════════════
        var baseSql = $@"
        SELECT 
            FP.ID                        AS FactorId,
            FP.NoFactor                  AS NoFactor,
            FP.Date_In                   AS DateIn,
            FP.FactorKind                AS FactorKind,
            CASE FP.FactorKind
                WHEN 0 THEN N'خرید'
                WHEN 1 THEN N'فروش'
                WHEN 2 THEN N'برگشت از خرید'
                WHEN 3 THEN N'برگشت از فروش'
                WHEN 4 THEN N'پیش‌فاکتور'
                WHEN 9 THEN N'ضایعات'
                ELSE N'نامشخص'
            END                          AS FactorKindTitle,
            FP.CodeTafzil                AS CodeTafzil,
            ISNULL(FP.HesabName, '')     AS HesabName,
            ISNULL(FP.Descript, '')      AS Descript,
            ISNULL(FP.Cost, 0)           AS FinalAmount,
            FP.NO_Sanad                  AS NoSanad,
            FP.DateSanad                 AS DateSanad,
            ISNULL(FP.IsCaSh, 0)         AS IsCash,
            CASE ISNULL(FP.IsCaSh, 0)
                WHEN 1 THEN N'نقدی'
                WHEN 2 THEN N'غیرنقدی'
                ELSE N''
            END                          AS IsCashName,
            ISNULL(FP.MarkerName, '')    AS MarkerName,
            ISNULL(SUM(FD.CostItem), 0)  AS TotalCostItem,
            ISNULL(SUM(FD.Discount), 0)  AS TotalDiscount,
            ISNULL(SUM(FD.Tax), 0)       AS TotalTax,
            ISNULL(SUM(FD.TransCost), 0) AS TotalTransCost,
            COUNT(FD.ID)                 AS ItemCount
        FROM FactorParent_View FP
        LEFT JOIN FactorDetail_VIEW FD ON FD.FactorID = FP.ID
        {where}
        GROUP BY 
            FP.ID, FP.NoFactor, FP.Date_In, FP.FactorKind,
            FP.CodeTafzil, FP.HesabName, FP.Descript, FP.Cost,
            FP.NO_Sanad, FP.DateSanad, FP.IsCaSh, FP.MarkerName
        ";

        var orderBy = (req.OrderBy ?? "date").ToLower() switch
        {
            "no" => "NoFactor DESC",
            "amount" => "FinalAmount DESC",
            "name" => "HesabName, DateIn DESC",
            _ => "DateIn DESC, NoFactor DESC"
        };

        var fullSql = baseSql + $" ORDER BY {orderBy}";

        var allItems = (await conn.QueryAsync<PartyFactorItemDto>(
            new CommandDefinition(fullSql, p, cancellationToken: ct))).ToList();

        // جمع‌های کلی
        result.TotalCount = allItems.Count;
        result.BuyCount = allItems.Count(x => x.FactorKind == 0);
        result.SellCount = allItems.Count(x => x.FactorKind == 1);
        result.BackBuyCount = allItems.Count(x => x.FactorKind == 2);
        result.BackSellCount = allItems.Count(x => x.FactorKind == 3);

        result.TotalBuyAmount = allItems.Where(x => x.FactorKind == 0).Sum(x => x.FinalAmount);
        result.TotalSellAmount = allItems.Where(x => x.FactorKind == 1).Sum(x => x.FinalAmount);
        result.TotalBackBuyAmount = allItems.Where(x => x.FactorKind == 2).Sum(x => x.FinalAmount);
        result.TotalBackSellAmount = allItems.Where(x => x.FactorKind == 3).Sum(x => x.FinalAmount);

        result.TotalDiscount = allItems.Sum(x => x.TotalDiscount);
        result.TotalTax = allItems.Sum(x => x.TotalTax);
        result.TotalFinalAmount = allItems.Sum(x => x.FinalAmount);

        // صفحه‌بندی
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize < 1 ? 50 : (req.PageSize > 100000 ? 100000 : req.PageSize);

        result.Page = page;
        result.PageSize = pageSize;
        result.TotalPages = (int)Math.Ceiling(result.TotalCount / (double)pageSize);

        result.Items = allItems
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return result;
    }
}