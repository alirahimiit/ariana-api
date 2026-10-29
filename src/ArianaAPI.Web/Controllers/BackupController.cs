using ArianaAPI.Application.DTOs.Backup;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/backup")]
[Authorize]
public class BackupController : ControllerBase
{
    private readonly IBackupService _service;
    private readonly IConfiguration _config;
    private readonly ILogger<BackupController> _logger;

    public BackupController(IBackupService service, IConfiguration config, ILogger<BackupController> logger)
    {
        _service = service;
        _config = config;
        _logger = logger;
    }

    private long MaxBytes => (_config.GetValue<long?>("Backup:MaxSizeMb") ?? 500) * 1024L * 1024L;

    // ═══════════════════════════════════════════════════════════════
    //  GET /api/backup/tenant — بک‌آپ دیتابیس جاری
    // ═══════════════════════════════════════════════════════════════
    // [RequirePermission(200)]  ← ⚠️ اگر چنین attribute داری فعال کن
    [HttpGet("tenant")]
    public async Task<IActionResult> BackupTenant(CancellationToken ct)
    {
        string path;
        try
        {
            path = await _service.BackupTenantToTempFileAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در بک‌آپ");
            return StatusCode(500, new { success = false, message = "خطا در بک‌آپ: " + ex.Message });
        }

        return StreamAndDelete(path, _service.GetCurrentTenantDatabaseName());
    }

    // ═══════════════════════════════════════════════════════════════
    //  GET /api/backup/permanent — بک‌آپ دیتابیس Permanent
    // ═══════════════════════════════════════════════════════════════
    [HttpGet("permanent")]
    public async Task<IActionResult> BackupPermanent(CancellationToken ct)
    {
        string path;
        try
        {
            path = await _service.BackupPermanentToTempFileAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در بک‌آپ Permanent");
            return StatusCode(500, new { success = false, message = "خطا در بک‌آپ: " + ex.Message });
        }

        return StreamAndDelete(path, _service.GetPermanentDatabaseName());
    }

    private IActionResult StreamAndDelete(string filePath, string dbName)
    {
        var displayName = _service.BuildBackupDisplayName(dbName);

        // FileOptions.DeleteOnClose → فایل بعد از پایان stream خودکار حذف می‌شود
        var fs = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 64 * 1024,
            FileOptions.Asynchronous | FileOptions.DeleteOnClose);

        return File(fs, "application/octet-stream", displayName);
    }

    // ═══════════════════════════════════════════════════════════════
    //  POST /api/backup/verify — بررسی فایل .bak (بدون Restore)
    // ═══════════════════════════════════════════════════════════════
    [HttpPost("verify")]
    [RequestSizeLimit(524_288_000)]          // 500 MB
    [RequestFormLimits(MultipartBodyLengthLimit = 524_288_000)]
    public async Task<IActionResult> Verify(IFormFile? file, CancellationToken ct)
    {
        var (savedPath, validationError) = await SaveUploadedFileAsync(file, ct);
        if (savedPath == null)
            return Ok(new BackupVerifyResultDto { Success = false, Message = validationError! });

        try
        {
            var result = await _service.VerifyAsync(savedPath, ct);
            return Ok(result);
        }
        finally
        {
            try { System.IO.File.Delete(savedPath); } catch { }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  POST /api/backup/restore — بازیابی
    // ═══════════════════════════════════════════════════════════════
    // [RequirePermission(201)]  ← ⚠️ اگر چنین attribute داری فعال کن
    [HttpPost("restore")]
    [RequestSizeLimit(524_288_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 524_288_000)]
    public async Task<IActionResult> Restore(IFormFile? file, CancellationToken ct)
    {
        var (savedPath, validationError) = await SaveUploadedFileAsync(file, ct);
        if (savedPath == null)
            return Ok(new RestoreResultDto { Success = false, Message = validationError! });

        try
        {
            var result = await _service.RestoreTenantAsync(savedPath, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در بازیابی");
            return Ok(new RestoreResultDto { Success = false, Message = "خطا در بازیابی: " + ex.Message });
        }
        finally
        {
            try { System.IO.File.Delete(savedPath); } catch { }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  GET /api/backup/status — نمایش نام دیتابیس‌ها در صفحه
    // ═══════════════════════════════════════════════════════════════
    [HttpGet("status")]
    public IActionResult Status()
    {
        return Ok(new
        {
            tenantDatabase = _service.GetCurrentTenantDatabaseName(),
            permanentDatabase = _service.GetPermanentDatabaseName()
        });
    }

    private async Task<(string? path, string? error)> SaveUploadedFileAsync(IFormFile? file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return (null, "فایلی انتخاب نشده است");

        if (file.Length > MaxBytes)
            return (null, $"حجم فایل بیشتر از {MaxBytes / (1024 * 1024)} مگابایت است");

        if (!file.FileName.EndsWith(".bak", StringComparison.OrdinalIgnoreCase))
            return (null, "فقط فایل با پسوند .bak پذیرفته می‌شود");

        var tempDir = _config["Backup:TempRestorePath"] ?? @"C:\ArianaAPI\Temp\Restore";
        Directory.CreateDirectory(tempDir);
        var path = Path.Combine(tempDir, $"{Guid.NewGuid():N}.bak");

        try
        {
            await using var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None,
                bufferSize: 64 * 1024, FileOptions.Asynchronous);
            await file.CopyToAsync(fs, ct);
            return (path, null);
        }
        catch (Exception ex)
        {
            try { System.IO.File.Delete(path); } catch { }
            return (null, "خطا در ذخیره فایل: " + ex.Message);
        }
    }
}