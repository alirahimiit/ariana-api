using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository حساب‌ها با Dapper
/// </summary>
public class HesabRepository : IHesabRepository
{
    private readonly ITenantConnectionFactory _factory;

    public HesabRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IEnumerable<HesabDto>> GetAllColsAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                HesabID, Code_Col, Code_Moein, Code_Tafzil,
                Name, Discript, Mahiat, Vaziat,
                Sum_Bed, Sum_Bes, Mab_Mandeh,
                HasTafzili, HasTafzili2
            FROM Hesab
            WHERE Code_Col > 0 
              AND Code_Moein = 0 
              AND Code_Tafzil = 0
            ORDER BY Code_Col";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<HesabDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<HesabDto>> GetMoeinsAsync(
        long orgId, long fyId, int codeCol, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                HesabID, Code_Col, Code_Moein, Code_Tafzil,
                Name, Discript, Mahiat, Vaziat,
                Sum_Bed, Sum_Bes, Mab_Mandeh,
                HasTafzili, HasTafzili2
            FROM Hesab
            WHERE Code_Col = @codeCol 
              AND Code_Moein > 0 
              AND Code_Tafzil = 0
            ORDER BY Code_Moein";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<HesabDto>(
            new CommandDefinition(sql, new { codeCol }, cancellationToken: ct));
    }

    public async Task<IEnumerable<HesabDto>> GetTafzilsAsync(
        long orgId, long fyId, int? codeCol = null, CancellationToken ct = default)
    {
        var sql = @"
            SELECT 
                HesabID, Code_Col, Code_Moein, Code_Tafzil,
                Name, Discript, Mahiat, Vaziat,
                Sum_Bed, Sum_Bes, Mab_Mandeh,
                HasTafzili, HasTafzili2
            FROM Hesab
            WHERE Code_Tafzil > 0";

        if (codeCol.HasValue && codeCol.Value > 0)
        {
            sql += " AND Code_Col = @codeCol";
        }

        sql += " ORDER BY Code_Col, Code_Moein, Code_Tafzil";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<HesabDto>(
            new CommandDefinition(sql, new { codeCol }, cancellationToken: ct));
    }

    public async Task<IEnumerable<HesabDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                HesabID, Code_Col, Code_Moein, Code_Tafzil,
                Name, Discript, Mahiat, Vaziat,
                Sum_Bed, Sum_Bes, Mab_Mandeh,
                HasTafzili, HasTafzili2
            FROM Hesab
            WHERE Code_Col > 0
            ORDER BY Code_Col, Code_Moein, Code_Tafzil";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<HesabDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }
}