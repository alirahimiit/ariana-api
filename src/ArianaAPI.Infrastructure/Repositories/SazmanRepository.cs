using ArianaAPI.Application.DTOs.Organizations;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository سازمان‌ها با Dapper
/// </summary>
public class SazmanRepository : IOrganizationRepository
{
    private readonly ITenantConnectionFactory _factory;

    public SazmanRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IEnumerable<OrganizationDto>> GetAllAsync(CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                SazmanID, Name, Arm, NationalCode, RegNo,
                PhoneNo, Address, EcoNo, PostalCode, CityName1, Ostan
            FROM Sazman
            ORDER BY Name";

        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryAsync<OrganizationDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<OrganizationDto?> GetByIdAsync(long orgId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                SazmanID, Name, Arm, NationalCode, RegNo,
                PhoneNo, Address, EcoNo, PostalCode, CityName1, Ostan
            FROM Sazman
            WHERE SazmanID = @orgId";

        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryFirstOrDefaultAsync<OrganizationDto>(
            new CommandDefinition(sql, new { orgId }, cancellationToken: ct));
    }

    public async Task<bool> ExistsAsync(long orgId, CancellationToken ct = default)
    {
        const string sql = "SELECT COUNT(*) FROM Sazman WHERE SazmanID = @orgId";

        await using var conn = _factory.CreatePermanentConnection();
        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, new { orgId }, cancellationToken: ct));
        return count > 0;
    }
}