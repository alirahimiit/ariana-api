using ArianaAPI.Application.DTOs.Cheque;

namespace ArianaAPI.Application.Interfaces;

public interface IChequeReportExtendedRepository
{
    Task<ReturnedChequeListResultDto> GetReturnedListAsync(
        long orgId, long fyId,
        ReturnedChequeFilterDto filter,
        CancellationToken ct = default);

    Task<ReturnedChequeSummaryDto> GetReturnedSummaryAsync(
        long orgId, long fyId,
        ReturnedChequeFilterDto filter,
        CancellationToken ct = default);

    Task<ChequeKardexDto?> GetKardexAsync(
        long orgId, long fyId,
        ChequeKardexRequestDto dto,
        CancellationToken ct = default);
}