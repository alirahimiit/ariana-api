using ArianaAPI.Application.DTOs.Organizations;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository برای جدول DorehMali (دوره‌های مالی) در Permanent
/// </summary>
public interface IFiscalYearRepository
{
    Task<IEnumerable<FiscalYearDto>> GetByOrgAsync(long orgId, CancellationToken ct = default);
    Task<FiscalYearDto?> GetByIdAsync(long orgId, long fyId, CancellationToken ct = default);
}