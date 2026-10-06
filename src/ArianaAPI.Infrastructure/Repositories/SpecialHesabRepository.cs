using ArianaAPI.Application.DTOs.SpecialHesab;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

public class SpecialHesabRepository : ISpecialHesabRepository
{
    private readonly ITenantConnectionFactory _factory;

    public SpecialHesabRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<List<SpecialHesabItemDto>> GetListAsync(
        long orgId, long fyId, SpecialHesabKind kind, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                ID                          AS Id,
                ISNULL(SpecialHesabName,'') AS Name,
                ISNULL(xSubGroupCode,0)     AS SubGroupCode,
                ISNULL(xGroupCode,0)        AS GroupCode,
                ISNULL(xDetailCode,0)       AS DetailCode,
                ISNULL(xHCode,'')           AS HCode,
                ISNULL(xIsChild,0)          AS IsChild,
                ISNULL(xKind,0)             AS Kind
            FROM SpecialHesab
            WHERE ISNULL(xKind, 0) = @kind
            ORDER BY xSubGroupCode, SpecialHesabName";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var rows = await conn.QueryAsync<SpecialHesabItemDto>(
            new CommandDefinition(sql, new { kind = (int)kind }, cancellationToken: ct));

        return rows.ToList();
    }
}