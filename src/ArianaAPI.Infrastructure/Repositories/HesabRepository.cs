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
    // ═══════════════════════════════════════════
    //  درخت کامل حساب‌ها
    // ═══════════════════════════════════════════
    public async Task<IEnumerable<HesabTreeDto>> GetTreeAsync(
     long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                H.HesabID     AS HesabId,
                H.Code_Col    AS CodeCol,
                H.Code_Moein  AS CodeMoein,
                H.Code_Tafzil AS CodeTafzil,
                H.Name        AS Name,
                H.Mahiat      AS Mahiat,
                H.Vaziat      AS Vaziat,
                ISNULL(H.HasTafzili, 0)  AS HasTafzili,
                ISNULL(H.HasTafzili2, 0) AS HasTafzili2,
                ISNULL(IsStock, 0) AS IsStock,

                -- ⭐ محاسبه‌ی پویا از Sanad
                CASE 
                    -- تفضیلی: جمع روی Code_Tafzil
                    WHEN H.Code_Col = -1 AND H.Code_Tafzil > 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) FROM Sanad S 
                                WHERE S.Code_Tafzil = H.Code_Tafzil), 0)
                    -- معین: جمع روی Code_Col + Code_Moein
                    WHEN H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col 
                                  AND S.Code_Moein = H.Code_Moein), 0)
                    -- کل: جمع روی Code_Col
                    WHEN H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col), 0)
                    ELSE 0
                END AS SumBed,

                CASE 
                    WHEN H.Code_Col = -1 AND H.Code_Tafzil > 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Tafzil = H.Code_Tafzil), 0)
                    WHEN H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col 
                                  AND S.Code_Moein = H.Code_Moein), 0)
                    WHEN H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col), 0)
                    ELSE 0
                END AS SumBes,

                 CASE 
                    WHEN H.Code_Col = -1 AND H.Code_Tafzil > 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) - SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Tafzil = H.Code_Tafzil), 0)
                    WHEN H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) - SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col 
                                  AND S.Code_Moein = H.Code_Moein), 0)
                    WHEN H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) - SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col), 0)
                    ELSE 0
                END AS MabMandeh,

                CASE 
                    WHEN H.Code_Col = -1 AND H.Code_Tafzil > 0 THEN 'tafzil'
                    WHEN H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0 THEN 'moein'
                    WHEN H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0 THEN 'col'
                    ELSE NULL
                END AS Level
            FROM Hesab H
            WHERE (H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0)
               OR (H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0)
               OR (H.Code_Col = -1 AND H.Code_Tafzil > 0)
            ORDER BY 
                CASE WHEN H.Code_Col = -1 THEN 9999 ELSE H.Code_Col END,
                H.Code_Moein,
                H.Code_Tafzil";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var result = await conn.QueryAsync<HesabTreeDto>(
            new CommandDefinition(sql, cancellationToken: ct));

        return result.Where(x => x.Level != null);
    }
}