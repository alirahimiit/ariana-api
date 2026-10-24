using ArianaAPI.Application.DTOs.Lookup;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class LookupRepository : ILookupRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILicenseService _license;
    private readonly ILogger<LookupRepository> _logger;

    public LookupRepository(
        ITenantConnectionFactory factory,
        ILicenseService license,
        ILogger<LookupRepository> logger)
    {
        _factory = factory;
        _license = license;
        _logger = logger;
    }

    // ═══════════════════════════════════════════
    //  ⭐ جدید: لیست سازمان‌ها با محدودیت TOP
    // ═══════════════════════════════════════════
    public async Task<IEnumerable<OrganizationLookupDto>> GetOrganizationsAsync(
        CancellationToken ct = default)
    {
        var status = _license.GetStatus();
        if (!status.IsValid)
        {
            _logger.LogWarning("⚠️ لایسنس نامعتبر: {Msg}", status.ErrorMessage);
            return Enumerable.Empty<OrganizationLookupDto>();
        }

        var maxOrgs = _license.MaxOrgs;
        if (maxOrgs <= 0)
        {
            _logger.LogWarning("⚠️ لایسنس هیچ سازمان مجازی ندارد (maxOrgs={Max})", maxOrgs);
            return Enumerable.Empty<OrganizationLookupDto>();
        }

        const string sql = @"
            SELECT TOP (@maxOrgs)
                SazmanID AS Code,
                Name     AS Name
            FROM Sazman
            WHERE Report_App = 1
            ORDER BY SazmanID";

        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryAsync<OrganizationLookupDto>(
            new CommandDefinition(sql, new { maxOrgs }, cancellationToken: ct));
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

    public async Task<string?> GetOrganizationNameAsync(
        long orgId, CancellationToken ct = default)
    {
        const string sql = "SELECT Name FROM Sazman WHERE SazmanID = @orgId";
        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryFirstOrDefaultAsync<string>(
            new CommandDefinition(sql, new { orgId }, cancellationToken: ct));
    }

    public async Task<string?> GetFiscalYearNameAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT Name FROM DorehMali 
            WHERE SazmanCode = @orgId AND DorehMaliID = @fyId";
        await using var conn = _factory.CreatePermanentConnection();
        return await conn.QueryFirstOrDefaultAsync<string>(
            new CommandDefinition(sql, new { orgId, fyId }, cancellationToken: ct));
    }
}