using ArianaAPI.Application.DTOs.Lookup;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

public class LookupRepository : ILookupRepository
{
    private readonly ITenantConnectionFactory _factory;

    public LookupRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IEnumerable<OrganizationLookupDto>> GetOrganizationsAsync(CancellationToken ct = default)
    {
        const string sql = @"
            SELECT SazmanID AS Code, Name AS Name
            FROM Sazman
            ORDER BY SazmanID";

        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryAsync<OrganizationLookupDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<FiscalYearLookupDto>> GetFiscalYearsAsync(
        long orgId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                DorehMaliID AS Id,
                Name        AS Name,
                BeginDate   AS BeginDate,
                EndDate     AS EndDate,
                1           AS IsActive
            FROM DorehMali
            WHERE SazmanCode = @orgId
            ORDER BY DorehMaliID DESC";

        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryAsync<FiscalYearLookupDto>(
            new CommandDefinition(sql, new { orgId }, cancellationToken: ct));
    }

    public async Task<string?> GetOrganizationNameAsync(long orgId, CancellationToken ct = default)
    {
        const string sql = "SELECT Name FROM Sazman WHERE SazmanID = @orgId";

        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryFirstOrDefaultAsync<string>(
            new CommandDefinition(sql, new { orgId }, cancellationToken: ct));
    }

    public async Task<string?> GetFiscalYearNameAsync(long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT Name FROM DorehMali 
            WHERE SazmanCode = @orgId AND DorehMaliID = @fyId";

        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryFirstOrDefaultAsync<string>(
            new CommandDefinition(sql, new { orgId, fyId }, cancellationToken: ct));
    }
}