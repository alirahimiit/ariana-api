using ArianaAPI.Application.Dtos.Reports.FactorProfitLoss;

namespace ArianaAPI.Application.Interfaces;

public interface IFactorProfitLossRepository
{
    Task<FactorProfitLossResultDto> GetAsync(
        long orgId, long fyId, FactorProfitLossRequestDto request,
        CancellationToken ct = default);
}