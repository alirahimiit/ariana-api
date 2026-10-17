using ArianaAPI.Application.DTOs.Cheque;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository چک‌های پرداختی (CheckPay)
/// معادل دلفی: TChequePay + TChequePayListForm
/// </summary>
public interface IChequePayRepository
{
    // ─── READ ───
    Task<ChequePayListResultDto> GetListAsync(
        long orgId, long fyId,
        ChequePayFilterDto filter,
        CancellationToken ct = default);

    Task<ChequeReportSummaryDto> GetReportSummaryAsync(
    long orgId, long fyId,
    ChequePayFilterDto filter,
    CancellationToken ct = default);

    Task<ChequePayDetailDto?> GetByIdAsync(
        long orgId, long fyId, long id,
        CancellationToken ct = default);

    Task<int> GetNextNumberAsync(
        long orgId, long fyId,
        CancellationToken ct = default);

    Task<IEnumerable<ChequeSanadComboDto>> GetParentSanadListAsync(
        long orgId, long fyId,
        CancellationToken ct = default);

    Task<IEnumerable<string>> GetDistinctPersonListAsync(
    long orgId, long fyId, CancellationToken ct = default);

    // ─── WRITE ───
    Task<ChequePayCreateResultDto> CreateAsync(
        long orgId, long fyId,
        ChequePayCreateDto dto, long userCode,
        CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId,
        ChequePayUpdateDto dto, long userCode,
        CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default);

    // ─── WORKFLOW ───
    Task OkAsync(
        long orgId, long fyId,
        ChequePayOkRequestDto dto, long userCode,
        CancellationToken ct = default);

    Task UnOkAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default);

    Task ReturnAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default);

    // ─── HELPERS ───
    /// <summary>وضعیت سند — برای قفل ویرایش/حذف</summary>
    Task<int> GetSanadVazeitAsync(
        long orgId, long fyId, long parentSanadId,
        CancellationToken ct = default);
}

/// <summary>DTO مشترک برای Combo سند</summary>
public class ChequeSanadComboDto
{
    public long ParentSanadID { get; set; }
    public int NoSanad { get; set; }
    public string DateIn { get; set; } = "";
    public string Sharh { get; set; } = "";
    public int Vazeit { get; set; }
}