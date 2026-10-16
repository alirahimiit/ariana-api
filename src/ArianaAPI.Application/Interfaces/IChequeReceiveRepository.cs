using ArianaAPI.Application.DTOs.Cheque;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository چک‌های دریافتی (CheckRecive)
/// معادل دلفی: TChequeReceive + TChequeReceiveListForm
/// </summary>
public interface IChequeReceiveRepository
{
    // ─── READ ───
    Task<ChequeReceiveListResultDto> GetListAsync(
        long orgId, long fyId,
        ChequeReceiveFilterDto filter,
        CancellationToken ct = default);

    Task<ChequeReceiveDetailDto?> GetByIdAsync(
        long orgId, long fyId, long id,
        CancellationToken ct = default);

    Task<int> GetNextNumberAsync(
        long orgId, long fyId,
        CancellationToken ct = default);

    Task<IEnumerable<ChequeSanadComboDto>> GetParentSanadListAsync(
        long orgId, long fyId,
        CancellationToken ct = default);

    /// <summary>شعبه‌های متمایز از CheckRecive (datalist)</summary>
    Task<IEnumerable<string>> GetDistinctBrunchListAsync(
        long orgId, long fyId, CancellationToken ct = default);

    /// <summary>شماره‌حساب‌های متمایز از CheckRecive (datalist)</summary>
    Task<IEnumerable<string>> GetDistinctNoHesabListAsync(
        long orgId, long fyId, CancellationToken ct = default);

    /// <summary>در وجه‌های متمایز از CheckRecive (datalist)</summary>
    Task<IEnumerable<string>> GetDistinctPersonListAsync(
        long orgId, long fyId, CancellationToken ct = default);

    // ─── WRITE ───
    Task<ChequeReceiveCreateResultDto> CreateAsync(
        long orgId, long fyId,
        ChequeReceiveCreateDto dto, long userCode,
        CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId,
        ChequeReceiveUpdateDto dto, long userCode,
        CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default);

    // ─── WORKFLOW ───
    Task OkAsync(
        long orgId, long fyId,
        ChequeReceiveOkRequestDto dto, long userCode,
        CancellationToken ct = default);

    Task UnOkAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default);

    Task ReturnAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default);

    // ─── HELPERS ───
    Task<int> GetSanadVazeitAsync(
        long orgId, long fyId, long parentSanadId,
        CancellationToken ct = default);
}