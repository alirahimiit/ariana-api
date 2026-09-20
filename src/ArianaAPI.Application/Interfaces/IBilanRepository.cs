using ArianaAPI.Application.Dtos.Reports;

namespace ArianaAPI.Application.Interfaces;

public interface IBilanRepository
{
    Task<BilanResultDto> GetReportAsync(
        long orgId, long fyId, BilanRequestDto request, CancellationToken ct = default);
}