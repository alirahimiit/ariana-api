using ArianaAPI.Application.DTOs.Backup;

namespace ArianaAPI.Application.Interfaces;

public interface IBackupService
{
    /// <summary>نام دیتابیس جاری (Acounting_{orgId}_{fyId})</summary>
    string GetCurrentTenantDatabaseName();

    /// <summary>نام دیتابیس اصلی (Permanent)</summary>
    string GetPermanentDatabaseName();

    /// <summary>بک‌آپ دیتابیس جاری → مسیر فایل موقت روی سرور</summary>
    Task<string> BackupTenantToTempFileAsync(CancellationToken ct = default);

    /// <summary>بک‌آپ دیتابیس Permanent → مسیر فایل موقت روی سرور</summary>
    Task<string> BackupPermanentToTempFileAsync(CancellationToken ct = default);

    /// <summary>بررسی فایل .bak (HEADERONLY + FILELISTONLY) بدون بازیابی</summary>
    Task<BackupVerifyResultDto> VerifyAsync(string bakFilePath, CancellationToken ct = default);

    /// <summary>بازیابی کامل فایل .bak روی دیتابیس جاری (سه تلاش پله‌ای مثل دلفی)</summary>
    Task<RestoreResultDto> RestoreTenantAsync(string bakFilePath, CancellationToken ct = default);

    /// <summary>نام نمایشی فایل بک‌آپ برای دانلود</summary>
    string BuildBackupDisplayName(string databaseName);
}