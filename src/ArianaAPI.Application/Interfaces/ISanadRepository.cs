using ArianaAPI.Application.DTOs.Sanad;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository اسناد حسابداری (در دیتابیس Tenant)
/// </summary>
public interface ISanadRepository
{
    /// <summary>لیست اسناد با فیلترهای اختیاری</summary>
    Task<IEnumerable<SanadListDto>> GetListAsync(
        long orgId,
        long fyId,
        string? fromDate = null,
        string? toDate = null,
        int? noFrom = null,
        int? noTo = null,
        int? vazeit = null,
        int? kindSanad = null,
        int page = 1,
        int pageSize = 100,
        CancellationToken ct = default);

    /// <summary>جزئیات یک سند (سرسند)</summary>
    Task<SanadDetailDto?> GetByIdAsync(
        long orgId,
        long fyId,
        long sanadId,
        CancellationToken ct = default);

    /// <summary>آیتم‌های سند (ردیف‌ها)</summary>
    Task<IEnumerable<SanadItemDto>> GetItemsAsync(
        long orgId,
        long fyId,
        long parentSanadId,
        CancellationToken ct = default);

    /// <summary>تعداد کل اسناد با فیلتر</summary>
    Task<int> GetCountAsync(
        long orgId,
        long fyId,
        string? fromDate = null,
        string? toDate = null,
        int? vazeit = null,
        CancellationToken ct = default);
}