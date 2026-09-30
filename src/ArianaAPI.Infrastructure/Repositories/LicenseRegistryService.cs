using System.Data;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class LicenseRegistryService : ILicenseRegistryService
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<LicenseRegistryService> _logger;

    public LicenseRegistryService(
        ITenantConnectionFactory factory,
        ILogger<LicenseRegistryService> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<bool> IsRegisteredAsync(long productCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreatePermanentConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM T2 WHERE Number = @code",
                new { code = productCode },
                cancellationToken: ct));

        return count > 0;
    }

    public async Task RegisterAsync(
        long productCode,
        string systemId,
        string serial,
        CancellationToken ct = default)
    {
        await using var conn = _factory.CreatePermanentConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // چک قبلی
            var existing = await conn.QueryFirstOrDefaultAsync<string>(
                new CommandDefinition(
                    "SELECT TOP 1 MyStr FROM T2 WHERE Number = @code",
                    new { code = productCode },
                    transaction: tx, cancellationToken: ct));

            if (!string.IsNullOrEmpty(existing))
            {
                _logger.LogInformation("T2 قبلاً ثبت شده — skip");
                tx.Commit();
                return;
            }

            // T1: systemId
            var t1Id = await conn.QueryFirstOrDefaultAsync<long?>(
                new CommandDefinition(
                    "SELECT TOP 1 ID FROM T1 WHERE Name = @name",
                    new { name = systemId },
                    transaction: tx, cancellationToken: ct));

            if (t1Id == null)
            {
                await conn.ExecuteAsync(
                    new CommandDefinition(
                        "INSERT INTO T1 (Name) VALUES (@name)",
                        new { name = systemId },
                        transaction: tx, cancellationToken: ct));

                _logger.LogInformation("T1: systemId ثبت شد: {SysId}", systemId);
            }

            // T2: serial
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "INSERT INTO T2 (Number, MyStr, DateIN) VALUES (@num, @str, GETDATE())",
                    new { num = productCode, str = serial },
                    transaction: tx, cancellationToken: ct));

            _logger.LogInformation("T2: ثبت شد. Code={Code}", productCode);
            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
}