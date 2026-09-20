using ArianaAPI.Application.DTOs.Common;

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
}