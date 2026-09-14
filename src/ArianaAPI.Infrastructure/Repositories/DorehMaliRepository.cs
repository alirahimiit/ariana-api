using ArianaAPI.Application.DTOs.Organizations;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository دوره‌های مالی با Dapper
/// </summary>
public class DorehMaliRepository : IFiscalYearRepository
{
    private readonly ITenantConnectionFactory _factory;

    public DorehMaliRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IEnumerable<FiscalYearDto>> GetByOrgAsync(
        long orgId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                DorehMaliID, Name, BeginDate, EndDate, SazmanCode
            FROM DorehMali
            WHERE SazmanCode = @orgId
            ORDER BY DorehMaliID DESC";

        await using var conn = _factory.CreatePermanentConnection();
        var list = await conn.QueryAsync<FiscalYearDto>(
            new CommandDefinition(sql, new { orgId }, cancellationToken: ct));

        // اضافه کردن نام دیتابیس به هر آیتم
        foreach (var fy in list)
        {
            fy.DatabaseName = _factory.BuildTenantDbName(orgId, fy.DorehMaliID);
        }

        return list;
    }

    public async Task<FiscalYearDto?> GetByIdAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                DorehMaliID, Name, BeginDate, EndDate, SazmanCode
            FROM DorehMali
            WHERE SazmanCode = @orgId AND DorehMaliID = @fyId";

        await using var conn = _factory.CreatePermanentConnection();
        var fy = await conn.QueryFirstOrDefaultAsync<FiscalYearDto>(
            new CommandDefinition(sql, new { orgId, fyId }, cancellationToken: ct));

        if (fy is not null)
        {
            fy.DatabaseName = _factory.BuildTenantDbName(orgId, fy.DorehMaliID);
        }

        return fy;
    }
}