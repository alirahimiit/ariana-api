using ArianaAPI.Domain.Entities;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository برای جدول Users در دیتابیس Tenant (Acounting_X_Y)
/// </summary>
public interface IUserRepository
{
    /// <summary>احراز هویت کاربر در دیتابیس سازمان + دوره</summary>
    Task<User?> AuthenticateAsync(
        long orgId,
        long fyId,
        string username,
        string password,
        CancellationToken ct = default);

    /// <summary>گرفتن کاربر با ID</summary>
    Task<User?> GetByIdAsync(
        long orgId,
        long fyId,
        long userId,
        CancellationToken ct = default);
}