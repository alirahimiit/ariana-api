using System.Text;
using ArianaAPI.Application.Dtos.Reports.FactorProfitLoss;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class FactorProfitLossRepository : IFactorProfitLossRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<FactorProfitLossRepository> _logger;

    public FactorProfitLossRepository(
        ITenantConnectionFactory factory,
        ILogger<FactorProfitLossRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<FactorProfitLossResultDto> GetAsync(
        long orgId, long fyId, FactorProfitLossRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var sb = new StringBuilder();
        var p = new DynamicParameters();

        // ═══════════════════════════════════════════════════
        //  میانگین قیمت خرید هر کالا (تا تاریخ پایان گزارش)
        // ═══════════════════════════════════════════════════
        var avgCostCte = new StringBuilder(@"
        ;WITH AvgCost AS (
            SELECT 
                FD.ArticleID,
                SUM(ISNULL(FD.CostItem, 0)) AS TotalBuyAmount,
                SUM(ISNULL(FD.ArticleCount, 0)) AS TotalBuyQty
            FROM FactorDetail_VIEW FD
            INNER JOIN FactorParent_View FP ON FP.ID = FD.FactorID
            WHERE FP.FactorKind = 0  -- فقط خرید
        ");

        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            avgCostCte.Append(" AND FP.Date_In <= @dateTo ");
            p.Add("dateTo", req.DateTo.Trim());
        }

        avgCostCte.Append(@"
            GROUP BY FD.ArticleID
        )");

        // ═══════════════════════════════════════════════════
        //  WHERE فاکتورهای فروش
        // ═══════════════════════════════════════════════════
        var where = new StringBuilder(" WHERE FP.FactorKind = 1 ");  // فقط فروش

        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            where.Append(" AND FP.Date_In >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            // ⚠️ اگه قبلاً اضافه شده، دوباره اضافه نکن
            if (!p.ParameterNames.Contains("dateTo"))
            {
                where.Append(" AND FP.Date_In <= @dateTo ");
                p.Add("dateTo", req.DateTo.Trim());
            }
            else
            {
                where.Append(" AND FP.Date_In <= @dateTo ");
            }
        }
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
        if (req.ArticleId is > 0)
        {
            where.Append(" AND FP.ID IN (SELECT FactorID FROM FactorDetail WHERE ArticleID = @articleId) ");
            p.Add("articleId", req.ArticleId.Value);
        }

        // ═══════════════════════════════════════════════════
        //  Query اصلی
        // ═══════════════════════════════════════════════════
        var baseSql = avgCostCte.ToString() + $@"

        SELECT 
            FP.ID                                    AS FactorId,
            FP.NoFactor                              AS NoFactor,
            FP.Date_In                               AS DateIn,
            FP.CodeTafzil                            AS CodeTafzil,
            ISNULL(FP.HesabName, '')                 AS HesabName,
            FP.NO_Sanad                              AS NoSanad,
            COUNT(FD.ID)                             AS ItemCount,
            ISNULL(SUM(ISNULL(FD.CostItem, 0)), 0)   AS SaleAmount,
            ISNULL(SUM(ISNULL(FD.Discount, 0)), 0)   AS SaleDiscount,
            ISNULL(SUM(ISNULL(FD.Tax, 0)), 0)        AS SaleTax,
            ISNULL(SUM(ISNULL(FD.TransCost, 0)), 0)  AS SaleTransCost,
            ISNULL(SUM(
                ISNULL(FD.ArticleCount, 0) * 
                CASE 
                    WHEN ISNULL(AC.TotalBuyQty, 0) > 0 
                    THEN AC.TotalBuyAmount / AC.TotalBuyQty 
                    ELSE ISNULL(FD.Cost, 0)
                END
            ), 0)                                    AS CostAmount
        FROM FactorParent_View FP
        INNER JOIN FactorDetail_VIEW FD ON FD.FactorID = FP.ID
        LEFT JOIN AvgCost AC ON AC.ArticleID = FD.ArticleID
        {where}
        GROUP BY 
            FP.ID, FP.NoFactor, FP.Date_In, FP.CodeTafzil, 
            FP.HesabName, FP.NO_Sanad
        ";

        // ═══════════════════════════════════════════════════
        //  ORDER BY
        // ═══════════════════════════════════════════════════
        var orderBy = (req.OrderBy ?? "date").ToLower() switch
        {
            "profit" => "Profit DESC",
            "profitpct" => "ProfitPct DESC",
            "amount" => "SaleAmount DESC",
            _ => "DateIn DESC, NoFactor DESC"
        };

        var fullSql = baseSql + $" ORDER BY {orderBy}";

        // ═══════════════════════════════════════════════════
        //  اجرا
        // ═══════════════════════════════════════════════════
        var rawItems = (await conn.QueryAsync<dynamic>(
            new CommandDefinition(fullSql, p, cancellationToken: ct))).ToList();

        var items = new List<FactorProfitLossItemDto>();
        foreach (var r in rawItems)
        {
            var d = (IDictionary<string, object>)r;
            var saleAmount = GetDec(d, "SaleAmount");
            var costAmount = GetDec(d, "CostAmount");
            var profit = saleAmount - costAmount;

            items.Add(new FactorProfitLossItemDto
            {
                FactorId = GetLong(d, "FactorId") ?? 0,
                NoFactor = GetLong(d, "NoFactor"),
                DateIn = d["DateIn"]?.ToString(),
                CodeTafzil = GetLong(d, "CodeTafzil"),
                HesabName = d["HesabName"]?.ToString(),
                NoSanad = GetLong(d, "NoSanad"),
                ItemCount = (int)(GetLong(d, "ItemCount") ?? 0),

                SaleAmount = saleAmount,
                SaleDiscount = GetDec(d, "SaleDiscount"),
                SaleTax = GetDec(d, "SaleTax"),
                SaleWithTax = saleAmount + GetDec(d, "SaleTax") - GetDec(d, "SaleDiscount"),

                CostAmount = costAmount,
                Profit = profit,
                ProfitPct = saleAmount > 0 ? Math.Round(profit / saleAmount * 100, 2) : 0
            });
        }

        // ═══════════════════════════════════════════════════
        //  فیلتر سود/زیان
        // ═══════════════════════════════════════════════════
        if (req.ProfitFilter == 1)
            items = items.Where(x => x.Profit > 0).ToList();
        else if (req.ProfitFilter == 2)
            items = items.Where(x => x.Profit < 0).ToList();

        // ═══════════════════════════════════════════════════
        //  جمع‌ها
        // ═══════════════════════════════════════════════════
        var result = new FactorProfitLossResultDto
        {
            TotalCount = items.Count,
            TotalSaleAmount = items.Sum(x => x.SaleAmount),
            TotalSaleDiscount = items.Sum(x => x.SaleDiscount),
            TotalSaleTax = items.Sum(x => x.SaleTax),
            TotalSaleWithTax = items.Sum(x => x.SaleWithTax),
            TotalCostAmount = items.Sum(x => x.CostAmount),
            TotalProfit = items.Sum(x => x.Profit),
            ProfitCount = items.Count(x => x.Profit > 0),
            LossCount = items.Count(x => x.Profit < 0)
        };

        result.TotalProfitPct = result.TotalSaleAmount > 0
            ? Math.Round(result.TotalProfit / result.TotalSaleAmount * 100, 2)
            : 0;

        // ═══════════════════════════════════════════════════
        //  صفحه‌بندی
        // ═══════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════
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