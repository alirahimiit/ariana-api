using ArianaAPI.Application.DTOs.Bank;

namespace ArianaAPI.Application.Interfaces;

public interface IBankRepository
{
    // ─── Bank ───
    Task<List<BankListDto>> GetBanksAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<BankWriteResultDto> CreateBankAsync(
        long orgId, long fyId, BankWriteDto dto, long userCode, CancellationToken ct = default);

    Task UpdateBankAsync(
        long orgId, long fyId, long id, BankWriteDto dto, long userCode, CancellationToken ct = default);

    Task DeleteBankAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    // ─── BankAcc ───
    Task<BankAccListResultDto> GetBankAccsAsync(
        long orgId, long fyId, BankAccRequestDto req, CancellationToken ct = default);

    Task<BankAccListDto?> GetBankAccAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<BankAccWriteResultDto> CreateBankAccAsync(
        long orgId, long fyId, BankAccWriteDto dto, long userCode, CancellationToken ct = default);

    Task UpdateBankAccAsync(
        long orgId, long fyId, long id, BankAccWriteDto dto, long userCode, CancellationToken ct = default);

    Task DeleteBankAccAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<bool> BankAccHasChildrenAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);
}