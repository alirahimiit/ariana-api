using ArianaAPI.Application.DTOs.Lookup;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

public class LocationRepository : ILocationRepository
{
    private readonly ITenantConnectionFactory _factory;

    public LocationRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IEnumerable<StateDto>> GetStatesAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                CAST(ID   AS BIGINT)  AS Id,
                Code                  AS Code,
                Name                  AS Name
            FROM State
            ORDER BY Name";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<StateDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<CityDto>> GetCitiesAsync(
        long orgId, long fyId, long? stateId, CancellationToken ct = default)
    {
        var sb = new System.Text.StringBuilder(@"
            SELECT 
                CAST(ID   AS BIGINT)  AS Id,
                Code                  AS Code,
                Name                  AS Name,
                CAST(StateID AS BIGINT) AS StateId
            FROM City");

        var p = new DynamicParameters();

        if (stateId is > 0)
        {
            sb.Append(" WHERE StateID = @stateId");
            p.Add("stateId", stateId.Value);
        }

        sb.Append(" ORDER BY Name");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<CityDto>(
            new CommandDefinition(sb.ToString(), p, cancellationToken: ct));
    }

    public async Task<decimal> GetNextStateCodeAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = "SELECT ISNULL(MAX(Code), 0) + 1 FROM State";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<decimal>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<decimal> GetNextCityCodeAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = "SELECT ISNULL(MAX(Code), 0) + 1 FROM City";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<decimal>(
            new CommandDefinition(sql, cancellationToken: ct));
    }
}