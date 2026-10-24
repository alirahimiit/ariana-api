using ArianaAPI.Application.DTOs.License;

namespace ArianaAPI.Application.Interfaces;

public interface ILicenseService
{
    /// <summary>وضعیت فعلی لایسنس (کش شده)</summary>
    LicenseStatus GetStatus();

    /// <summary>
    /// در مدل جدید: اگه لایسنس معتبر و maxOrgs > 0 باشه ← هر سازمانی مجازه
    /// (چک وجود orgId در DB وظیفه‌ی caller هست)
    /// </summary>
    bool IsOrgAuthorized(long orgId);

    /// <summary>حداکثر تعداد سازمان مجاز — صفر یعنی لایسنس بی‌اثر</summary>
    int MaxOrgs { get; }
}