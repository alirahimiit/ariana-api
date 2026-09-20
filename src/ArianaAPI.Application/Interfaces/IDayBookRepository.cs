using ArianaAPI.Application.Dtos.Reports;

namespace ArianaAPI.Application.Interfaces;

public interface IDayBookRepository
{
    Task<DayBookResultDto> GetReportAsync(
        long orgId, long fyId, DayBookRequestDto request, CancellationToken ct = default);
}