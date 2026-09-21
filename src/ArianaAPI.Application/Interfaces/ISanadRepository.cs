using ArianaAPI.Application.DTOs.Sanad;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository اسناد حسابداری (در دیتابیس Tenant)
/// </summary>
public interface ISanadRepository
{
    // ═══════════════════════════════════════════
    //  READ (قبلاً بود)
    // ═══════════════════════════════════════════

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
        string? sortBy = null,
        string? sortDir = null,
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

    // ═══════════════════════════════════════════
    //  WRITE (جدید - فاز ۱۱)
    // ═══════════════════════════════════════════

    /// <summary>
    /// ایجاد سند جدید (سرسند + ردیف‌ها) — داخل یک transaction
    /// </summary>
    /// <returns>شناسه‌ی سند جدید + شماره‌ی سند</returns>
    Task<SanadCreateResultDto> CreateAsync(
        long orgId,
        long fyId,
        SanadCreateDto dto,
        long userCode,
        CancellationToken ct = default);

    /// <summary>
    /// ویرایش سند (حذف همه‌ی ردیف‌های قبلی + درج ردیف‌های جدید + آپدیت سرسند)
    /// </summary>
    Task UpdateAsync(
        long orgId,
        long fyId,
        SanadUpdateDto dto,
        long userCode,
        CancellationToken ct = default);

    /// <summary>
    /// حذف سند (کپی ردیف‌ها در RecycleSanad + حذف سرسند و ردیف‌ها)
    /// </summary>
    Task DeleteAsync(
        long orgId,
        long fyId,
        long parentSanadId,
        long userCode,
        CancellationToken ct = default);

    /// <summary>
    /// دریافت وضعیت سند (برای بررسی قابل‌ویرایش بودن)
    /// </summary>
    Task<int> GetVazeitAsync(
        long orgId,
        long fyId,
        long parentSanadId,
        CancellationToken ct = default);
}