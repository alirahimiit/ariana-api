using ArianaAPI.Application.Dtos.Reports;

namespace ArianaAPI.Application.Interfaces;

public interface IProfitLossRepository
{
    Task<ProfitLossResultDto> GetReportAsync(
        long orgId, long fyId, ProfitLossRequestDto request, CancellationToken ct = default);
}