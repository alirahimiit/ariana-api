using System.Text;
using ArianaAPI.Application.DTOs.Article;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class ArticleRepository : IArticleRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<ArticleRepository> _logger;

    public ArticleRepository(
        ITenantConnectionFactory factory,
        ILogger<ArticleRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════
    //  لیست کالاها
    // ═══════════════════════════════════════════
    public async Task<ArticleListResultDto> GetListAsync(
           long orgId, long fyId, ArticleRequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        // ─── کد کالا ───
        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            sb.Append(" AND CAST(AN.Code AS VARCHAR(50)) LIKE @code ");
            p.Add("code", "%" + req.Code + "%");
        }

        // ─── نام کالا ───
        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            sb.Append(" AND AN.Name LIKE @name ");
            p.Add("name", "%" + req.Name + "%");
        }

        // ─── شناسه مالیاتی ───
        if (!string.IsNullOrWhiteSpace(req.TaxId))
        {
            sb.Append(" AND CAST(AN.tax_id AS VARCHAR(50)) LIKE @taxId ");
            p.Add("taxId", "%" + req.TaxId + "%");
        }

        // ─── گروه ───
        if (req.GroupId is > 0)
        {
            sb.Append(" AND AN.ArticleGroupID = @groupId ");
            p.Add("groupId", req.GroupId.Value);
        }

        // ─── انبار ───
        if (req.StockTypeId is > 0)
        {
            sb.Append(" AND AN.StockTypeID = @stockTypeId ");
            p.Add("stockTypeId", req.StockTypeId.Value);
        }

        // ─── واحد ───
        if (req.UnitId is > 0)
        {
            sb.Append(" AND AN.ArticleUnitID = @unitId ");
            p.Add("unitId", req.UnitId.Value);
        }

        // ─── وضعیت ───
        if (req.Status.HasValue)
        {
            sb.Append(" AND AN.Status = @status ");
            p.Add("status", req.Status.Value);
        }

        // ─── فیلتر موجودی ───
        // ⚠️ این فیلتر روی مقدار Sum(FinallExistence) از Article_View اعمال می‌شه
        // چون باید در WHERE باشه، از زیرکوئری استفاده می‌کنیم
        switch ((req.StockFilter ?? "all").ToLower())
        {
            case "hasstock":
                sb.Append(@" AND ISNULL((SELECT SUM(A.FinallExistence) 
                                         FROM Article_View A 
                                         WHERE A.ArticleID = AN.ID), 0) > 0 ");
                break;
            case "nostock":
                sb.Append(@" AND ISNULL((SELECT SUM(A.FinallExistence) 
                                         FROM Article_View A 
                                         WHERE A.ArticleID = AN.ID), 0) = 0 ");
                break;
            case "negativestock":
                sb.Append(@" AND ISNULL((SELECT SUM(A.FinallExistence) 
                                         FROM Article_View A 
                                         WHERE A.ArticleID = AN.ID), 0) < 0 ");
                break;
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;

        _logger.LogDebug("Article list - where: {Where}", sb.ToString());

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ⭐ اول شمارش کل
        var countSql = $@"SELECT COUNT(*) FROM ArticleNew_VIEW AN {sb}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        // ⭐ پارامترهای صفحه
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
            SELECT * FROM (
                SELECT 
                    AN.ID                    AS Id,
                    AN.Code                  AS Code,
                    AN.Name                  AS Name,
                    AN.tax_id                AS TaxId,
                    AN.ArticleGroupID        AS ArticleGroupId,
                    AN.ArticleGroupName      AS ArticleGroupName,
                    AN.StockTypeID           AS StockTypeId,
                    AN.StockTypeName         AS StockTypeName,
                    AN.ArticleUnitID         AS ArticleUnitId,
                    AN.ArticleUnitName       AS ArticleUnitName,
                    AN.AmountSale            AS AmountSale,
                    AN.MarketerPercent       AS MarketerPercent,
                    AN.ArticleCoding         AS ArticleCoding,
                    AN.Status                AS Status,
                    AN.StatusName            AS StatusName,
                    (SELECT SUM(A.FinallExistence) 
                     FROM Article_View A 
                     WHERE A.ArticleID = AN.ID) AS FinallExistence,
                    ROW_NUMBER() OVER (ORDER BY AN.Code) AS RowNum
                FROM ArticleNew_VIEW AN
                {sb}
            ) AS T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        _logger.LogDebug("Article list SQL:\n{Sql}", sql);

        var items = (await conn.QueryAsync<ArticleListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new ArticleListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    // ═══════════════════════════════════════════
    //  جزئیات کالا
    // ═══════════════════════════════════════════
    public async Task<ArticleDetailDto?> GetDetailAsync(
        long orgId, long fyId, long articleId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        const string sql = @"
            SELECT 
                AN.ID                       AS Id,
                AN.Code                     AS Code,
                AN.Name                     AS Name,
                AN.ArticleCoding            AS ArticleCoding,
                AN.CodingStore              AS CodingStore,
                AN.CodingGroupStore         AS CodingGroupStore,

                AN.ArticleGroupID           AS ArticleGroupId,
                AN.ArticleGroupCode         AS ArticleGroupCode,
                AN.ArticleGroupName         AS ArticleGroupName,

                AN.StockTypeID              AS StockTypeId,
                AN.StockTypeCode            AS StockTypeCode,
                AN.StockTypeName            AS StockTypeName,
                AN.Kind                     AS StockTypeKind,

                AN.ArticleUnitID            AS ArticleUnitId,
                AN.ArticleUnitName          AS ArticleUnitName,
                AN.ArticleUnitID2           AS ArticleUnitId2,
                AN.ArticleUnitName2         AS ArticleUnitName2,
                AN.ArticleUnitID3           AS ArticleUnitId3,
                AN.ArticleUnitName3         AS ArticleUnitName3,
                AN.Tabdil1                  AS Tabdil1,
                AN.Tabdil2                  AS Tabdil2,
                AN.Tabdil3                  AS Tabdil3,

                AN.Code_Col                 AS CodeCol,
                AN.Code_Moein               AS CodeMoein,
                AN.Code_Tafzil              AS CodeTafzil,

                AN.Code_Col_Buy             AS CodeColBuy,
                AN.Code_Moein_Buy           AS CodeMoeinBuy,
                AN.Code_Tafzil_Buy          AS CodeTafzilBuy,

                AN.Code_Col_ReBuy           AS CodeColReBuy,
                AN.Code_Moein_ReBuy         AS CodeMoeinReBuy,
                AN.Code_Tafzil_ReBuy        AS CodeTafzilReBuy,

                AN.Code_Col_ReSale          AS CodeColReSale,
                AN.Code_Moein_ReSale        AS CodeMoeinReSale,
                AN.Code_Tafzil_ReSale       AS CodeTafzilReSale,

                AN.AmountFirst              AS AmountFirst,
                AN.CostFirst                AS CostFirst,
                AN.AmountSale               AS AmountSale,

                AN.MarketerPercent          AS MarketerPercent,
                AN.MaxCostOrderBy           AS MaxCostOrderBy,
                AN.MinCostOrderBy           AS MinCostOrderBy,

                AN.xIs_RegMinOrderToIn      AS XIsRegMinOrderToIn,
                AN.xIs_RegMaxOrderToOut     AS XIsRegMaxOrderToOut,
                AN.xIs_RegNegativKala       AS XIsRegNegativKala,
                AN.xNotCalcPerDiscount      AS XNotCalcPerDiscount,
                AN.xNotCalcArezeshafzode    AS XNotCalcArezeshafzode,
                AN.xIs_CalcUnit2            AS XIsCalcUnit2,
                AN.xIs_CalcUnit3            AS XIsCalcUnit3,

                AN.Depreciation             AS Depreciation,
                AN.DepreciationType         AS DepreciationType,
                AN.DepreciationTypeName     AS DepreciationTypeName,

                AN.Status                   AS Status,
                AN.StatusName               AS StatusName,
                AN.Kind                     AS Kind,
                AN.For_EST                  AS ForEst,

                (SELECT SUM(A.FirstExistence)   FROM Article_View A WHERE A.ArticleID = AN.ID) AS FirstExistence,
                (SELECT SUM(A.Inputed)          FROM Article_View A WHERE A.ArticleID = AN.ID) AS Inputed,
                (SELECT SUM(A.OutPuted)         FROM Article_View A WHERE A.ArticleID = AN.ID) AS OutPuted,
                (SELECT SUM(A.Loss1)            FROM Article_View A WHERE A.ArticleID = AN.ID) AS Loss1,
                (SELECT SUM(A.Loss2)            FROM Article_View A WHERE A.ArticleID = AN.ID) AS Loss2,
                (SELECT SUM(A.FinallExistence)  FROM Article_View A WHERE A.ArticleID = AN.ID) AS FinallExistence
            FROM ArticleNew_VIEW AN
            WHERE AN.ID = @articleId";

        return await conn.QueryFirstOrDefaultAsync<ArticleDetailDto>(
            new CommandDefinition(sql, new { articleId }, cancellationToken: ct));
    }
}