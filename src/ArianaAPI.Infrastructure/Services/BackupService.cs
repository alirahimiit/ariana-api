using System.Data;
using System.Data.SqlClient;
using ArianaAPI.Application.DTOs.Backup;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services;

public class BackupService : IBackupService
{
    // ⚠️ قفل سراسری: فقط یک Restore همزمان در کل برنامه
    private static readonly SemaphoreSlim _restoreLock = new(1, 1);

    private readonly IConfiguration _config;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<BackupService> _logger;

    private readonly string _masterConnStr;
    private readonly string _permanentDbName;
    private readonly string _backupDir;
    private readonly string _restoreDir;
    private readonly string _dbPrefix;

    public BackupService(IConfiguration config, IHttpContextAccessor http, ILogger<BackupService> logger)
    {
        _config = config;
        _http = http;
        _logger = logger;

        // ─── ساخت ConnectionString به master از بخش Database ───
        var server = config["Database:Server"] ?? "localhost";
        var dbName = config["Database:DatabaseName"] ?? "Permanent";
        var userId = config["Database:UserId"];
        var password = config["Database:Password"];
        var integratedSecurity = config.GetValue<bool?>("Database:IntegratedSecurity") ?? false;
        var timeout = config.GetValue<int?>("Database:ConnectionTimeoutSeconds") ?? 15;
        var trustCert = config.GetValue<bool?>("Database:TrustServerCertificate") ?? true;

        _permanentDbName = dbName;

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = server,
            InitialCatalog = "master",
            ConnectTimeout = timeout,
            TrustServerCertificate = trustCert
        };

        if (integratedSecurity)
        {
            builder.IntegratedSecurity = true;
        }
        else
        {
            builder.UserID = userId ?? "";
            builder.Password = password ?? "";
        }

        _masterConnStr = builder.ConnectionString;

        _backupDir = config["Backup:TempBackupPath"] ?? @"C:\ArianaAPI\Temp\Backups";
        _restoreDir = config["Backup:TempRestorePath"] ?? @"C:\ArianaAPI\Temp\Restore";
        _dbPrefix = config["Database:Prefix"] ?? "Acounting_";

        Directory.CreateDirectory(_backupDir);
        Directory.CreateDirectory(_restoreDir);

        _logger.LogInformation(
            "BackupService راه‌اندازی شد — master DB: {Server}, Permanent: {Perm}, Backup dir: {Dir}",
            server, _permanentDbName, _backupDir);
    }
    // ═══════════════════════════════════════════════════════════════
    //  شناسایی نام دیتابیس‌ها
    // ═══════════════════════════════════════════════════════════════

    public string GetCurrentTenantDatabaseName()
    {
        var user = _http.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
            throw new UnauthorizedAccessException("برای این عملیات باید وارد سیستم شوید");

        // ⚠️ اگر نام claimها در پروژه‌ات متفاوت است، این‌جا تنظیم کن
        var orgStr = user.FindFirst("SazmanID")?.Value
                  ?? user.FindFirst("OrganizationId")?.Value
                  ?? user.FindFirst("orgId")?.Value;
        var fyStr = user.FindFirst("DorehMaliID")?.Value
                 ?? user.FindFirst("FiscalYearId")?.Value
                 ?? user.FindFirst("fyId")?.Value;

        if (!int.TryParse(orgStr, out var org) || !int.TryParse(fyStr, out var fy))
            throw new InvalidOperationException("امکان تشخیص سازمان یا دوره مالی از توکن وجود ندارد");

        return $"{_dbPrefix}{org}_{fy}";
    }

    public string GetPermanentDatabaseName() => _permanentDbName;

    public string BuildBackupDisplayName(string databaseName)
        => $"{databaseName}_{DateTime.Now:yyyy-MM-dd}_{DateTime.Now:HH-mm-ss}.bak";

    // ═══════════════════════════════════════════════════════════════
    //  BACKUP
    // ═══════════════════════════════════════════════════════════════

    public Task<string> BackupTenantToTempFileAsync(CancellationToken ct = default)
        => BackupDatabaseAsync(GetCurrentTenantDatabaseName(), ct);

    public Task<string> BackupPermanentToTempFileAsync(CancellationToken ct = default)
        => BackupDatabaseAsync(_permanentDbName, ct);

    private async Task<string> BackupDatabaseAsync(string dbName, CancellationToken ct)
    {
        // پاک‌سازی فایل‌های قدیمی (پیش از شروع)
        CleanupOldTempFiles();

        var diskPath = Path.Combine(_backupDir, $"{Guid.NewGuid():N}.bak");

        _logger.LogInformation("شروع بک‌آپ دیتابیس {Db} → {Path}", dbName, diskPath);

        try
        {
            await using var conn = new SqlConnection(_masterConnStr);
            await conn.OpenAsync(ct);

            // همان دستور دلفی: FORMAT, INIT, SKIP, STATS=10
            var sql = $@"BACKUP DATABASE [{dbName}] 
                         TO DISK = @path 
                         WITH FORMAT, INIT, SKIP, STATS = 10";

            await using var cmd = new SqlCommand(sql, conn) { CommandTimeout = 600 };
            cmd.Parameters.AddWithValue("@path", diskPath);
            await cmd.ExecuteNonQueryAsync(ct);

            if (!File.Exists(diskPath))
                throw new InvalidOperationException("فایل بک‌آپ پس از اجرای دستور ایجاد نشد");

            _logger.LogInformation("بک‌آپ {Db} موفق: {Size} بایت", dbName, new FileInfo(diskPath).Length);
            return diskPath;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در بک‌آپ {Db}", dbName);
            TryDelete(diskPath);
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  VERIFY (HEADERONLY + FILELISTONLY)
    // ═══════════════════════════════════════════════════════════════

    public async Task<BackupVerifyResultDto> VerifyAsync(string bakFilePath, CancellationToken ct = default)
    {
        var result = new BackupVerifyResultDto
        {
            TargetDatabase = GetCurrentTenantDatabaseName(),
        };

        try
        {
            if (!File.Exists(bakFilePath))
                return Fail(result, "فایل یافت نشد");

            result.FileSizeBytes = new FileInfo(bakFilePath).Length;

            await using var conn = new SqlConnection(_masterConnStr);
            await conn.OpenAsync(ct);

            // --- HEADERONLY: اطلاعات کلی بک‌آپ
            await using (var cmd = new SqlCommand("RESTORE HEADERONLY FROM DISK = @p", conn) { CommandTimeout = 120 })
            {
                cmd.Parameters.AddWithValue("@p", bakFilePath);
                await using var r = await cmd.ExecuteReaderAsync(ct);
                if (!await r.ReadAsync(ct))
                    return Fail(result, "فایل بک‌آپ معتبر نیست");

                result.DatabaseNameInBackup = SafeGet(r, "DatabaseName");
                result.ServerName = SafeGet(r, "ServerName");
                var bfd = SafeGet(r, "BackupFinishDate");
                if (DateTime.TryParse(bfd, out var dt))
                    result.BackupDate = dt.ToString("yyyy-MM-dd HH:mm:ss");
            }

            // --- FILELISTONLY: LogicalName فایل‌های داده و لاگ
            await using (var cmd = new SqlCommand("RESTORE FILELISTONLY FROM DISK = @p", conn) { CommandTimeout = 120 })
            {
                cmd.Parameters.AddWithValue("@p", bakFilePath);
                await using var r = await cmd.ExecuteReaderAsync(ct);
                while (await r.ReadAsync(ct))
                {
                    var type = SafeGet(r, "Type");
                    var logical = SafeGet(r, "LogicalName");
                    if (type == "D" && string.IsNullOrEmpty(result.DataLogicalName)) result.DataLogicalName = logical;
                    if (type == "L" && string.IsNullOrEmpty(result.LogLogicalName)) result.LogLogicalName = logical;
                }
            }

            if (string.IsNullOrEmpty(result.DataLogicalName) || string.IsNullOrEmpty(result.LogLogicalName))
                return Fail(result, "فایل معتبر است اما فایل داده یا لاگ درون آن یافت نشد");

            result.Success = true;
            result.Message = "فایل معتبر است و آماده بازیابی";
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در بررسی فایل بک‌آپ");
            return Fail(result, $"خطا در بررسی فایل: {ex.Message}");
        }
    }

    private static BackupVerifyResultDto Fail(BackupVerifyResultDto r, string msg)
    {
        r.Success = false;
        r.Message = msg;
        return r;
    }

    private static string SafeGet(SqlDataReader r, string col)
    {
        try
        {
            var i = r.GetOrdinal(col);
            return r.IsDBNull(i) ? string.Empty : (r.GetValue(i)?.ToString() ?? string.Empty);
        }
        catch { return string.Empty; }
    }

    // ═══════════════════════════════════════════════════════════════
    //  RESTORE — همان منطق دلفی با سه تلاش پله‌ای
    // ═══════════════════════════════════════════════════════════════

    public async Task<RestoreResultDto> RestoreTenantAsync(string bakFilePath, CancellationToken ct = default)
    {
        await _restoreLock.WaitAsync(ct);
        try
        {
            var target = GetCurrentTenantDatabaseName();
            _logger.LogWarning("شروع Restore دیتابیس {Target} از فایل {Path}", target, bakFilePath);

            // پیش‌بررسی: فایل معتبر؟
            var verify = await VerifyAsync(bakFilePath, ct);
            if (!verify.Success)
                return new RestoreResultDto { Success = false, Message = verify.Message, TargetDatabase = target };

            // مسیر فیزیکی فعلی دیتابیس (تا MOVE به همان‌جا)
            var (dataPath, logPath) = await GetCurrentPhysicalPathsAsync(target, ct);
            if (string.IsNullOrEmpty(dataPath) || string.IsNullOrEmpty(logPath))
            {
                (dataPath, logPath) = await GetDefaultPhysicalPathsAsync(target, ct);
                if (string.IsNullOrEmpty(dataPath) || string.IsNullOrEmpty(logPath))
                    return new RestoreResultDto { Success = false, Message = "امکان تشخیص مسیر فیزیکی دیتابیس وجود ندارد", TargetDatabase = target };
            }

            _logger.LogInformation("مسیر بازیابی: data={D} | log={L}", dataPath, logPath);

            // ─── تلاش ۱: MOVE + REPLACE + RECOVERY
            var (ok, err) = await TryRestoreAsync(target, bakFilePath,
                verify.DataLogicalName, verify.LogLogicalName,
                dataPath, logPath, withReplace: true, ct);
            if (ok) return FinishRestoreAsync(target); // ← اینجا await حذف شد

            _logger.LogWarning("تلاش ۱ شکست خورد: {Err}", err);

            // ─── تلاش ۲: MOVE بدون REPLACE
            (ok, err) = await TryRestoreAsync(target, bakFilePath,
                verify.DataLogicalName, verify.LogLogicalName,
                dataPath, logPath, withReplace: false, ct);
            if (ok) return FinishRestoreAsync(target); // ← اینجا await حذف شد

            _logger.LogWarning("تلاش ۲ شکست خورد: {Err}", err);

            // ─── تلاش ۳: RESTORE ساده (بدون MOVE)
            (ok, err) = await TryRestoreSimpleAsync(target, bakFilePath, ct);
            if (ok) return FinishRestoreAsync(target); // ← اینجا await حذف شد

            _logger.LogError("هر سه تلاش بازیابی شکست خورد. آخرین خطا: {Err}", err);
            return new RestoreResultDto
            {
                Success = false,
                Message = $"بازیابی با شکست مواجه شد: {err}",
                TargetDatabase = target
            };
        }
        finally
        {
            _restoreLock.Release();
        }
    }
    private RestoreResultDto FinishRestoreAsync(string target)
    {
        // پاک‌سازی Pool تا کانکشن‌های قدیمی به schema قدیم بسته شوند
        SqlConnection.ClearAllPools();

        _logger.LogInformation("✅ بازیابی {Target} با موفقیت انجام شد", target);

        return new RestoreResultDto
        {
            Success = true,
            ForceLogout = true,
            TargetDatabase = target,
            Message = "بازیابی با موفقیت انجام شد. لطفاً مجدداً وارد شوید."
        };
    }

    private async Task<(bool ok, string err)> TryRestoreAsync(
        string target, string bakPath,
        string dataLogical, string logLogical,
        string dataPath, string logPath, bool withReplace, CancellationToken ct)
    {
        try
        {
            await using var conn = new SqlConnection(_masterConnStr);
            await conn.OpenAsync(ct);

            await SetSingleUserAsync(conn, target, ct);
            try
            {
                var replaceClause = withReplace ? "REPLACE," : "";
                var sql = $@"RESTORE DATABASE [{target}] FROM DISK = @p
                             WITH FILE = 1,
                                  MOVE N'{EscapeSql(dataLogical)}' TO N'{EscapeSql(dataPath)}',
                                  MOVE N'{EscapeSql(logLogical)}'  TO N'{EscapeSql(logPath)}',
                                  NOUNLOAD,
                                  {replaceClause}
                                  RECOVERY,
                                  STATS = 5";

                await using var cmd = new SqlCommand(sql, conn) { CommandTimeout = 1800 };
                cmd.Parameters.AddWithValue("@p", bakPath);
                await cmd.ExecuteNonQueryAsync(ct);
                return (true, "");
            }
            finally
            {
                await SetMultiUserAsync(conn, target, ct);
            }
        }
        catch (Exception ex)
        {
            // در صورت خطا، سعی کن دیتابیس را از حالت SINGLE_USER خارج کنی
            await TrySetMultiUserAsync(target);
            return (false, ex.Message);
        }
    }

    private async Task<(bool ok, string err)> TryRestoreSimpleAsync(string target, string bakPath, CancellationToken ct)
    {
        try
        {
            await using var conn = new SqlConnection(_masterConnStr);
            await conn.OpenAsync(ct);

            await SetSingleUserAsync(conn, target, ct);
            try
            {
                var sql = $"RESTORE DATABASE [{target}] FROM DISK = @p";
                await using var cmd = new SqlCommand(sql, conn) { CommandTimeout = 1800 };
                cmd.Parameters.AddWithValue("@p", bakPath);
                await cmd.ExecuteNonQueryAsync(ct);
                return (true, "");
            }
            finally
            {
                await SetMultiUserAsync(conn, target, ct);
            }
        }
        catch (Exception ex)
        {
            await TrySetMultiUserAsync(target);
            return (false, ex.Message);
        }
    }

    private static async Task SetSingleUserAsync(SqlConnection conn, string db, CancellationToken ct)
    {
        await using var cmd = new SqlCommand($"ALTER DATABASE [{db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE", conn);
        cmd.CommandTimeout = 120;
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task SetMultiUserAsync(SqlConnection conn, string db, CancellationToken ct)
    {
        try
        {
            await using var cmd = new SqlCommand($"ALTER DATABASE [{db}] SET MULTI_USER", conn);
            cmd.CommandTimeout = 60;
            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch { /* نادیده بگیر — دیتابیس ممکن است در حال restore باشد */ }
    }

    private async Task TrySetMultiUserAsync(string db)
    {
        try
        {
            await using var conn = new SqlConnection(_masterConnStr);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand($"ALTER DATABASE [{db}] SET MULTI_USER", conn);
            await cmd.ExecuteNonQueryAsync();
        }
        catch { }
    }

    private static string EscapeSql(string s) => s.Replace("'", "''");

    // ═══════════════════════════════════════════════════════════════
    //  مسیر فیزیکی دیتابیس (تا MOVE به همان‌جا)
    // ═══════════════════════════════════════════════════════════════

    private async Task<(string data, string log)> GetCurrentPhysicalPathsAsync(string db, CancellationToken ct)
    {
        await using var conn = new SqlConnection(_masterConnStr);
        await conn.OpenAsync(ct);

        var sql = @"SELECT 
                        MAX(CASE WHEN type = 0 THEN physical_name END) AS DataPath,
                        MAX(CASE WHEN type = 1 THEN physical_name END) AS LogPath
                    FROM sys.master_files 
                    WHERE database_id = DB_ID(@db)";

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@db", db);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return (null!, null!);

        var data = r["DataPath"] as string;
        var log = r["LogPath"] as string;
        return (data!, log!);
    }

    private async Task<(string data, string log)> GetDefaultPhysicalPathsAsync(string db, CancellationToken ct)
    {
        await using var conn = new SqlConnection(_masterConnStr);
        await conn.OpenAsync(ct);

        var sql = @"SELECT 
                        CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000)) AS DataDir,
                        CAST(SERVERPROPERTY('InstanceDefaultLogPath')  AS nvarchar(4000)) AS LogDir";

        await using var cmd = new SqlCommand(sql, conn);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return (null!, null!);

        var dataDir = r["DataDir"] as string;
        var logDir = r["LogDir"] as string;

        if (string.IsNullOrEmpty(dataDir) || string.IsNullOrEmpty(logDir))
            return (null!, null!);

        return (Path.Combine(dataDir, $"{db}.mdf"),
                Path.Combine(logDir, $"{db}_log.ldf"));
    }

    // ═══════════════════════════════════════════════════════════════
    //  پاک‌سازی فایل‌های قدیمی Temp
    // ═══════════════════════════════════════════════════════════════

    public void CleanupOldTempFiles()
    {
        try
        {
            var threshold = DateTime.UtcNow.AddMinutes(-30);

            foreach (var dir in new[] { _backupDir, _restoreDir })
            {
                if (!Directory.Exists(dir)) continue;

                foreach (var f in Directory.GetFiles(dir, "*.bak"))
                {
                    try
                    {
                        var fi = new FileInfo(f);
                        if (fi.LastAccessTimeUtc < threshold) fi.Delete();
                    }
                    catch { }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "خطا در پاک‌سازی فایل‌های Temp");
        }
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }
}