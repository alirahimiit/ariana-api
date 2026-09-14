using ArianaAPI.Infrastructure.Config;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ArianaAPI.Infrastructure.Data;

/// <summary>
/// ⭐ پیاده‌سازی Connection Factory
/// نکته: از Connection Pool داخلی ADO.NET استفاده می‌کنه
/// </summary>
public class TenantConnectionFactory : ITenantConnectionFactory
{
    private readonly AppSettings _settings;
    private readonly ILogger<TenantConnectionFactory> _logger;

    public TenantConnectionFactory(
        IOptions<AppSettings> settings,
        ILogger<TenantConnectionFactory> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════
    //  Permanent Connection
    // ═══════════════════════════════════════════════════

    public SqlConnection CreatePermanentConnection()
    {
        var connStr = BuildConnectionString(_settings.Database.DatabaseName);
        return new SqlConnection(connStr);
    }

    // ═══════════════════════════════════════════════════
    //  Tenant Connection
    // ═══════════════════════════════════════════════════

    public SqlConnection CreateTenantConnection(long orgId, long fyId)
    {
        var dbName = BuildTenantDbName(orgId, fyId);
        var connStr = BuildConnectionString(dbName);
        return new SqlConnection(connStr);
    }

    // ═══════════════════════════════════════════════════
    //  ساخت نام دیتابیس
    // ═══════════════════════════════════════════════════

    public string BuildTenantDbName(long orgId, long fyId)
    {
        return $"{_settings.Database.Prefix}{orgId}_{fyId}";
    }

    // ═══════════════════════════════════════════════════
    //  ساخت Connection String
    // ═══════════════════════════════════════════════════

    private string BuildConnectionString(string database)
    {
        var db = _settings.Database;

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = db.Server,
            InitialCatalog = database,
            ConnectTimeout = db.ConnectionTimeoutSeconds,
            TrustServerCertificate = db.TrustServerCertificate,
            MultipleActiveResultSets = true
        };

        if (db.IntegratedSecurity)
        {
            builder.IntegratedSecurity = true;
        }
        else
        {
            builder.UserID = db.UserId;
            builder.Password = db.Password;
        }

        return builder.ConnectionString;
    }

    // ═══════════════════════════════════════════════════
    //  اعتبارسنجی Org + FY
    // ═══════════════════════════════════════════════════

    public async Task<bool> IsOrgFyValidAsync(long orgId, long fyId)
    {
        try
        {
            await using var conn = CreatePermanentConnection();
            await conn.OpenAsync();

            var count = await conn.ExecuteScalarAsync<int>(
                @"SELECT COUNT(*) 
                  FROM DorehMali 
                  WHERE DorehMaliID = @fyId AND SazmanCode = @orgId",
                new { fyId, orgId });

            return count > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "خطا در اعتبارسنجی Org={OrgId}, FY={FyId}", orgId, fyId);
            return false;
        }
    }

    // ═══════════════════════════════════════════════════
    //  چک وجود دیتابیس Tenant
    // ═══════════════════════════════════════════════════

    public async Task<bool> TenantDatabaseExistsAsync(long orgId, long fyId)
    {
        var dbName = BuildTenantDbName(orgId, fyId);

        try
        {
            await using var conn = CreatePermanentConnection();
            await conn.OpenAsync();

            var count = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM sys.databases WHERE name = @dbName",
                new { dbName });

            return count > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "خطا در بررسی وجود دیتابیس {DbName}", dbName);
            return false;
        }
    }
}