using Microsoft.Data.SqlClient;

namespace ArianaAPI.Infrastructure.Data;

/// <summary>
/// ⭐ اینترفیس Factory برای ساخت Connection به دیتابیس‌ها
/// Permanent = دیتابیس اصلی (Sazman + DorehMali)
/// Tenant = دیتابیس سازمان (Acounting_{orgId}_{fyId})
/// </summary>
public interface ITenantConnectionFactory
{
    /// <summary>Connection به دیتابیس Permanent</summary>
    SqlConnection CreatePermanentConnection();

    /// <summary>Connection به دیتابیس سازمان + دوره مالی</summary>
    SqlConnection CreateTenantConnection(long orgId, long fyId);

    /// <summary>ساخت نام دیتابیس Tenant (مثلا Acounting_1_5)</summary>
    string BuildTenantDbName(long orgId, long fyId);

    /// <summary>چک می‌کنه آیا این Org و FY معتبر هستن (از Permanent)</summary>
    Task<bool> IsOrgFyValidAsync(long orgId, long fyId);

    /// <summary>چک می‌کنه آیا دیتابیس Tenant وجود داره</summary>
    Task<bool> TenantDatabaseExistsAsync(long orgId, long fyId);
}