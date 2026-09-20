using ArianaAPI.Application.DTOs.Dashboard;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class DashboardRepository : IDashboardRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<DashboardRepository> _logger;

    public DashboardRepository(
        ITenantConnectionFactory factory,
        ILogger<DashboardRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<DashboardStatsDto> GetStatsAsync(
    long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var stats = new DashboardStatsDto();

        // ═══ شمارش‌های کلی — با شمارش صحیح ═══
        stats.TotalSanads = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM ParentSanad", cancellationToken: ct));

        stats.TotalFactors = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM FactorParent", cancellationToken: ct));

        // ⭐ فقط حساب‌های کل (Code_Col > 0 و بدون معین و تفصیل)
        stats.TotalHesabs = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(@"
                SELECT COUNT(*) FROM Hesab 
                WHERE Code_Col > 0 
                  AND Code_Moein = 0 
                  AND Code_Tafzil = 0", cancellationToken: ct));

        // ⭐ تفصیلی‌ها (Code_Col = -1)
        stats.TotalTafzilis = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(@"
                SELECT COUNT(*) FROM Hesab 
                WHERE Code_Col = -1 
                  AND Code_Tafzil > 0", cancellationToken: ct));

        stats.TotalArticles = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM ArticleNew", cancellationToken: ct));

        // ═══ فاکتورها بر اساس نوع (تعداد) ═══
        var factorSql = @"
            SELECT 
                FactorKind AS Code,
                COUNT(*) AS Value
            FROM FactorParent
            GROUP BY FactorKind
            ORDER BY FactorKind";

        var factorRows = await conn.QueryAsync<(int Code, int Value)>(
            new CommandDefinition(factorSql, cancellationToken: ct));

        foreach (var row in factorRows)
        {
            stats.FactorsByKind.Add(new ChartItemDto
            {
                Code = row.Code,
                Label = FactorKindName(row.Code),
                Value = row.Value,
                IsMoney = false
            });
        }

        // ═══ اسناد بر اساس وضعیت ═══
        var vazeitSql = @"
            SELECT 
                ISNULL(Vazeit, 0) AS Code,
                COUNT(*) AS Value
            FROM ParentSanad
            GROUP BY ISNULL(Vazeit, 0)
            ORDER BY ISNULL(Vazeit, 0)";

        var vazeitRows = await conn.QueryAsync<(int Code, int Value)>(
            new CommandDefinition(vazeitSql, cancellationToken: ct));

        foreach (var row in vazeitRows)
        {
            stats.SanadsByVazeit.Add(new ChartItemDto
            {
                Code = row.Code,
                Label = VazeitName(row.Code),
                Value = row.Value,
                IsMoney = false
            });
        }

        // ═══ مبلغ گردش حساب‌ها بر اساس GroupType ═══
        // ساختار:
        //   Sanad → Code_Col → Hesab (کل) → Code_Group
        //   Hesab (Code_Col = 0) → GroupTypeCode
        //   GroupType → Name
        //
        // مقدار = جمع (Mab_Bed + Mab_Bes) همه‌ی Sanad های هر گروه
        var groupSql = @"
            SELECT 
                ISNULL(GT.Name, N'بدون گروه') AS Label,
                ISNULL(SUM(S.Mab_Bed + S.Mab_Bes), 0) AS Value
            FROM Sanad S
            INNER JOIN Hesab H 
                ON H.Code_Col = S.Code_Col 
               AND H.Code_Moein = 0 
               AND H.Code_Tafzil = 0
            INNER JOIN Hesab G 
                ON G.Code_Group = H.Code_Group 
               AND G.Code_Col = 0
               AND G.Code_Moein = 0
               AND G.Code_Tafzil = 0
            LEFT JOIN GroupType GT 
                ON GT.GroupTypeCode = G.GroupTypeCode
            WHERE S.Code_Col > 0
            GROUP BY GT.GroupTypeCode, GT.Name
            ORDER BY GT.GroupTypeCode";

        _logger.LogDebug("Dashboard group SQL:\n{Sql}", groupSql);

        var groupRows = await conn.QueryAsync<(string Label, decimal Value)>(
            new CommandDefinition(groupSql, cancellationToken: ct));

        foreach (var row in groupRows)
        {
            stats.AccountsByGroupType.Add(new ChartItemDto
            {
                Label = row.Label,
                Value = row.Value,
                IsMoney = false
            });
        }

        return stats;
    }

    private static string FactorKindName(int kind) => kind switch
    {
        0 => "خرید",
        1 => "فروش",
        2 => "برگشت از خرید",
        3 => "برگشت از فروش",
        4 => "پیش فاکتور",
        5 => "امانی ما نزد دیگران",
        6 => "امانی دیگران نزد ما",
        7 => "ارائه خدمات",
        8 => "دریافت خدمات",
        9 => "ضایعات",
        _ => $"نامشخص ({kind})"
    };

    private static string VazeitName(int vazeit) => vazeit switch
    {
        0 => "پیش‌نویس",
        1 => "رسیدگی",
        2 => "قطعی",
        _ => $"نامشخص ({vazeit})"
    };
}