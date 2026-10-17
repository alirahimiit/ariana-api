using ArianaAPI.Application.DTOs.Cheque;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository خرج چک‌های دریافتی (CheckExpend)
/// معادل دلفی: TChequeExpend + TChequeExpendListForm
/// </summary>
public interface IChequeExpendRepository
{
    // ─── READ ───
    Task<ChequeExpendListResultDto> GetListAsync(
        long orgId, long fyId,
        ChequeExpendFilterDto filter,
        CancellationToken ct = default);

    Task<ChequeReportSummaryDto> GetReportSummaryAsync(
    long orgId, long fyId,
    ChequeExpendFilterDto filter,
    CancellationToken ct = default);

    Task<ChequeExpendDetailDto?> GetByIdAsync(
        long orgId, long fyId, long id,
        CancellationToken ct = default);

    Task<int> GetNextNumberAsync(
        long orgId, long fyId,
        CancellationToken ct = default);

    Task<IEnumerable<ChequeSanadComboDto>> GetParentSanadListAsync(
        long orgId, long fyId,
        CancellationToken ct = default);

    /// <summary>چک‌های قابل انتخاب برای خرج</summary>
    /// <param name="includeChequeReceiveId">اگه توی ویرایش، چک فعلی هم توی لیست باشه</param>
    Task<IEnumerable<ChequeExpendAvailableChequeDto>> GetAvailableChequesAsync(
        long orgId, long fyId,
        long? includeChequeReceiveId,
        CancellationToken ct = default);

    // ─── WRITE ───
    Task<ChequeExpendCreateResultDto> CreateAsync(
        long orgId, long fyId,
        ChequeExpendCreateDto dto, long userCode,
        CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId,
        ChequeExpendUpdateDto dto, long userCode,
        CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default);

    // ─── HELPERS ───
    Task<int> GetSanadVazeitAsync(
        long orgId, long fyId, long parentSanadId,
        CancellationToken ct = default);
}