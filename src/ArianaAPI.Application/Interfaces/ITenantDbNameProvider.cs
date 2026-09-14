namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// ساخت نام دیتابیس Tenant بدون وابستگی به Infrastructure
/// </summary>
public interface ITenantDbNameProvider
{
    string Build(long orgId, long fyId);
}