using ArianaAPI.Application.DTOs.License;

namespace ArianaAPI.Application.Interfaces;

public interface ILicenseService
{
    /// <summary>وضعیت فعلی لایسنس (کش شده)</summary>
    LicenseStatus GetStatus();

    /// <summary>بررسی می‌کنه آیا این سازمان مجازه</summary>
    bool IsOrgAuthorized(long orgId);

    /// <summary>لیست سازمان‌های مجاز</summary>
    long[] GetAuthorizedOrgs();
}