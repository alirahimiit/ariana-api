using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.DTOs.Hesab;


namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository حساب‌های حسابداری
/// </summary>
public interface IHesabRepository
{
    /// <summary>درخت کل حساب‌ها (سطح کل)</summary>
    Task<IEnumerable<HesabDto>> GetAllColsAsync(
        long orgId, long fyId, CancellationToken ct = default);

    /// <summary>حساب‌های معین یک کل خاص</summary>
    Task<IEnumerable<HesabDto>> GetMoeinsAsync(
        long orgId, long fyId, int codeCol, CancellationToken ct = default);

    /// <summary>حساب‌های تفصیل</summary>
    Task<IEnumerable<HesabDto>> GetTafzilsAsync(
        long orgId, long fyId, int? codeCol = null, CancellationToken ct = default);

    /// <summary>همه حساب‌ها (برای tree کامل)</summary>
    Task<IEnumerable<HesabDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default);
    /// <summary>درخت کامل: کل → معین → تفصیلی</summary>
    Task<IEnumerable<HesabTreeDto>> GetTreeAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<List<HesabListItemDto>> GetListAsync(
     long orgId, long fyId, string level, string? search, CancellationToken ct = default);

    Task<HesabListItemDto?> GetByIdAsync(
        long orgId, long fyId, long hesabId, CancellationToken ct = default);

    Task<HesabUsageDto> GetUsageAsync(
        long orgId, long fyId, long hesabId, CancellationToken ct = default);

    Task<int> GetNextCodeAsync(
        long orgId, long fyId, string level, int? codeCol, CancellationToken ct = default);

    Task<long> CreateAsync(
        long orgId, long fyId, HesabCreateDto dto, CancellationToken ct = default);

    Task<bool> UpdateAsync(
        long orgId, long fyId, long hesabId, HesabUpdateDto dto, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long hesabId, CancellationToken ct = default);

    // ─── ⭐ جدید — جستجوی سریع برای Picker ───
    Task<List<HesabListItemDto>> SearchAsync(
        long orgId, long fyId, string level, string? search, int? codeCol,
        bool onlyWithTafzili, CancellationToken ct = default);
}