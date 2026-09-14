using ArianaAPI.Application.DTOs.Organizations;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository برای جدول Sazman (سازمان‌ها) در Permanent
/// </summary>
public interface IOrganizationRepository
{
    Task<IEnumerable<OrganizationDto>> GetAllAsync(CancellationToken ct = default);
    Task<OrganizationDto?> GetByIdAsync(long orgId, CancellationToken ct = default);
    Task<bool> ExistsAsync(long orgId, CancellationToken ct = default);
}