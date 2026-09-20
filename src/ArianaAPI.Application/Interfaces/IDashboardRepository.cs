using ArianaAPI.Application.DTOs.Dashboard;

namespace ArianaAPI.Application.Interfaces;

public interface IDashboardRepository
{
    Task<DashboardStatsDto> GetStatsAsync(
        long orgId, long fyId, CancellationToken ct = default);
}