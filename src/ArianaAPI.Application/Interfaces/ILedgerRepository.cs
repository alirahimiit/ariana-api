using ArianaAPI.Application.DTOs.Ledger;

namespace ArianaAPI.Application.Interfaces;

public interface ILedgerRepository
{
    Task<LedgerResultDto> GetLedgerAsync(
        long orgId,
        long fyId,
        LedgerRequestDto request,
        CancellationToken ct = default);
}