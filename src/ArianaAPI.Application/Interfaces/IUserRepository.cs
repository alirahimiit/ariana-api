using ArianaAPI.Application.DTOs.Permissions; // 👈 این خط معجزه می‌کند
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

    Task<bool> ChangePasswordAsync(
        long orgId, long fyId, long userId,
        string currentPassword, string newPassword,
        CancellationToken ct = default);


    // ══════════════════════════════════════════════════════════
    //  جدید — جلسه ۶۱ (CRUD ادمین)
    // ══════════════════════════════════════════════════════════

    /// <summary>لیست تمام کاربران با نام گروه (LEFT JOIN)</summary>
    Task<List<UserDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default);

    /// <summary>یک کاربر با نام گروه (برای ویرایش)</summary>
    Task<UserDto?> GetByIdExtendedAsync(
        long orgId, long fyId, long userId, CancellationToken ct = default);

    /// <summary>ایجاد کاربر جدید — password هم plaintext (برای دلفی) و هم BCrypt</summary>
    Task<long> CreateAsync(
        long orgId, long fyId, CreateUserDto dto, CancellationToken ct = default);

    /// <summary>ویرایش (بدون رمز)</summary>
    Task<bool> UpdateAsync(
        long orgId, long fyId, long userId,
        UpdateUserDto dto, CancellationToken ct = default);

    /// <summary>حذف کاربر</summary>
    Task<bool> DeleteAsync(
        long orgId, long fyId, long userId, CancellationToken ct = default);

    /// <summary>بازنشانی رمز توسط ادمین — بدون چک رمز فعلی</summary>
    Task<bool> ResetPasswordAsync(
        long orgId, long fyId, long userId,
        string newPassword, CancellationToken ct = default);

    /// <summary>آیا کد کاربری وجود دارد؟ (برای چک تکراری)</summary>
    Task<bool> ExistsUserCodeAsync(
        long orgId, long fyId, string userCode,
        long? excludeUserId, CancellationToken ct = default);
}