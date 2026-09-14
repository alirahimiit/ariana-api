using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

public class SharhRepository : ISharhRepository
{
    private readonly ITenantConnectionFactory _factory;

    public SharhRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IEnumerable<SharhDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        // توجه: نام جدول و فیلدها ممکنه متفاوت باشه
        // اگه جدول Sharh فیلدش Sharh هست، اینجا تنظیم کن
        const string sql = @"
            SELECT 
                SharhID, 
                Sharh AS SharhText
            FROM Sharh
            ORDER BY Sharh";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<SharhDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }
}