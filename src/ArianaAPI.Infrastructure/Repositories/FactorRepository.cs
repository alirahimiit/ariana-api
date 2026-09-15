using System.Text;
using ArianaAPI.Application.DTOs.Factor;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class FactorRepository : IFactorRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<FactorRepository> _logger;

    public FactorRepository(
        ITenantConnectionFactory factory,
        ILogger<FactorRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════
    //  لیست فاکتورها
    // ═══════════════════════════════════════════════════
    public async Task<FactorListResultDto> GetListAsync(
        long orgId, long fyId, FactorRequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        // ─── نوع فاکتور ───
        if (req.FactorKind.HasValue)
        {
            sb.Append(" AND FactorKind = @factorKind ");
            p.Add("factorKind", req.FactorKind.Value);
        }

        // ─── شماره فاکتور ───
        if (req.NoFrom is > 0)
        {
            sb.Append(" AND NoFactor >= @noFrom ");
            p.Add("noFrom", req.NoFrom.Value);
        }
        if (req.NoTo is > 0)
        {
            sb.Append(" AND NoFactor <= @noTo ");
            p.Add("noTo", req.NoTo.Value);
        }

        // ─── مبلغ ───
        if (req.CostFrom.HasValue)
        {
            sb.Append(" AND Cost >= @costFrom ");
            p.Add("costFrom", req.CostFrom.Value);
        }
        if (req.CostTo.HasValue)
        {
            sb.Append(" AND Cost <= @costTo ");
            p.Add("costTo", req.CostTo.Value);
        }

        // ─── تاریخ ───
        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            sb.Append(" AND Date_In >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom);
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            sb.Append(" AND Date_In <= @dateTo ");
            p.Add("dateTo", req.DateTo);
        }

        // ─── طرف حساب ───
        if (req.CodeTafzil is > 0)
        {
            sb.Append(" AND CodeTafzil = @codeTafzil ");
            p.Add("codeTafzil", req.CodeTafzil.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.HesabName))
        {
            sb.Append(" AND HesabName LIKE @hesabName ");
            p.Add("hesabName", "%" + req.HesabName + "%");
        }

        // ─── شرح ───
        if (!string.IsNullOrWhiteSpace(req.Descript))
        {
            sb.Append(" AND Descript LIKE @descript ");
            p.Add("descript", "%" + req.Descript + "%");
        }

        // ─── کالا (زیر‌کوئری) ───
        if (!string.IsNullOrWhiteSpace(req.ArticleName))
        {
            sb.Append(@" AND ID IN (
                SELECT DISTINCT FD.FactorID FROM FactorDetail FD
                INNER JOIN ArticleNew AN ON AN.ID = FD.ArticleID
                WHERE AN.Name LIKE @articleName) ");
            p.Add("articleName", "%" + req.ArticleName + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.ArticleCode))
        {
            sb.Append(@" AND ID IN (
                SELECT DISTINCT FD.FactorID FROM FactorDetail FD
                INNER JOIN ArticleNew AN ON AN.ID = FD.ArticleID
                WHERE AN.Code = @articleCode) ");
            p.Add("articleCode", req.ArticleCode);
        }

        // ─── صفحه‌بندی ───
        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;

        _logger.LogDebug("Factor list - where: {Where}", sb.ToString());

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ⭐ اول شمارش کل (با پارامترهای فعلی، بدون صفحه‌بندی)
        var countSql = $@"SELECT COUNT(*) FROM FactorParent_View {sb}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        // ⭐ بعد پارامترهای صفحه رو اضافه کن
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
            SELECT * FROM (
                SELECT 
                    ID             AS Id,
                    NoFactor       AS NoFactor,
                    Date_In        AS DateIn,
                    Descript       AS Descript,
                    FactorKind     AS FactorKind,
                    CASE FactorKind
                        WHEN 0 THEN N'خرید'
                        WHEN 1 THEN N'فروش'
                        WHEN 2 THEN N'برگشت از خرید'
                        WHEN 3 THEN N'برگشت از فروش'
                        WHEN 4 THEN N'پیش فاکتور'
                        WHEN 5 THEN N'امانی ما نزد دیگران'
                        WHEN 6 THEN N'امانی دیگران نزد ما'
                        WHEN 7 THEN N'ارائه خدمات'
                        WHEN 8 THEN N'دریافت خدمات'
                        WHEN 9 THEN N'ضایعات'
                        ELSE N'نامشخص'
                    END            AS FactorKindTitle,
                    CodeTafzil     AS CodeTafzil,
                    HesabName      AS HesabName,
                    IsCaSh         AS IsCash,
                    CASE ISNULL(IsCaSh, 0)
                        WHEN 1 THEN N'نقدی'
                        WHEN 2 THEN N'غیرنقدی'
                        ELSE N''
                    END            AS IsCashName,
                    Cost           AS Cost,
                    NO_Sanad       AS NoSanad,
                    DateSanad      AS DateSanad,
                    MarkerName     AS MarkerName,
                    ISNULL(TransCost, 0) AS TransCost,
                    ROW_NUMBER() OVER (ORDER BY NoFactor DESC, ID DESC) AS RowNum
                FROM FactorParent_View
                {sb}
            ) AS T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        _logger.LogDebug("Factor list SQL:\n{Sql}", sql);

        var items = (await conn.QueryAsync<FactorListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new FactorListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    // ═══════════════════════════════════════════════════
    //  جزئیات فاکتور
    // ═══════════════════════════════════════════════════
    public async Task<FactorResultDto?> GetDetailAsync(
        long orgId, long fyId, long factorId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ─── سر فاکتور ───
        const string headerSql = @"
            SELECT 
                ID           AS Id,
                NoFactor     AS NoFactor,
                Date_In      AS DateIn,
                Descript     AS Descript,
                FactorKind   AS FactorKind,
                CASE FactorKind
                    WHEN 0 THEN N'خرید'
                    WHEN 1 THEN N'فروش'
                    WHEN 2 THEN N'برگشت از خرید'
                    WHEN 3 THEN N'برگشت از فروش'
                    WHEN 4 THEN N'پیش فاکتور'
                    WHEN 5 THEN N'امانی ما نزد دیگران'
                    WHEN 6 THEN N'امانی دیگران نزد ما'
                    WHEN 7 THEN N'ارائه خدمات'
                    WHEN 8 THEN N'دریافت خدمات'
                    WHEN 9 THEN N'ضایعات'
                    ELSE N'نامشخص'
                END          AS FactorKindTitle,
                Cost         AS Cost,
                ISNULL(TransCost, 0) AS TransCost,
                CarInfo      AS CarInfo,
                CodeTafzil   AS CodeTafzil,
                HesabName    AS HesabName,
                Phone        AS Phone,
                Mobile       AS Mobile,
                EconomicCode AS EconomicCode,
                NationalCode AS NationalCode,
                PostalCode   AS PostalCode,
                Address      AS Address,
                StateName    AS StateName,
                CityName1    AS CityName1,
                CityName2    AS CityName2,
                Parent_Sanad_ID AS ParentSanadId,
                NO_Sanad     AS NoSanad,
                DateSanad    AS DateSanad,
                CodeTaf_Marketer AS CodeTafMarketer,
                MarkerName   AS MarkerName,
                MarkerMobile AS MarkerMobile
            FROM FactorParent_View
            WHERE ID = @factorId";

        var header = await conn.QueryFirstOrDefaultAsync<FactorDetailDto>(
            new CommandDefinition(headerSql, new { factorId }, cancellationToken: ct));

        if (header is null) return null;

        // ─── ردیف‌ها ───
        const string itemsSql = @"
            SELECT 
                ID              AS Id,
                ArticleID       AS ArticleId,
                ArticleCode     AS ArticleCode,
                ArticleName     AS ArticleName,
                ArticleUnitName AS ArticleUnitName,
                ArticleGroupName AS ArticleGroupName,
                ISNULL(ArticleCount, 0)  AS ArticleCount,
                ISNULL(ArticleCount2, 0) AS ArticleCount2,
                ISNULL(ArticleCount3, 0) AS ArticleCount3,
                ISNULL(Cost, 0)          AS Cost,
                ISNULL(CostItem, 0)      AS CostItem,
                ISNULL(Discount, 0)      AS Discount,
                ISNULL(Tax, 0)           AS Tax,
                ISNULL(TransCost, 0)     AS TransCost,
                ISNULL(CostTax, 0)       AS CostTax,
                ISNULL(FinallCost, 0)    AS FinallCost,
                ISNULL(PerDiscount, 0)   AS PerDiscount,
                ISNULL(MarketerPercent, 0) AS MarketerPercent,
                ISNULL(MarketerCosts, 0)   AS MarketerCosts,
                ISNULL(DegreeKala, 0)    AS DegreeKala,
                ISNULL(DropKala, 0)      AS DropKala,
                ISNULL(TaxFi, 0)         AS TaxFi
            FROM FactorDetail_VIEW
            WHERE FactorID = @factorId
            ORDER BY ID";

        var items = (await conn.QueryAsync<FactorItemDto>(
            new CommandDefinition(itemsSql, new { factorId }, cancellationToken: ct))).ToList();

        return new FactorResultDto
        {
            Header = header,
            Items = items,
            TotalRows = items.Count,
            TotalCostItem = items.Sum(x => x.CostItem),
            TotalDiscount = items.Sum(x => x.Discount),
            TotalTax = items.Sum(x => x.Tax),
            TotalTransCost = items.Sum(x => x.TransCost),
            TotalFinall = items.Sum(x => x.FinallCost)
        };
    }
}