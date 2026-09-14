using ArianaAPI.Application.DTOs.Lookup;

namespace ArianaAPI.Application.Interfaces;

public interface ILookupRepository
{
    Task<IEnumerable<OrganizationLookupDto>> GetOrganizationsAsync(CancellationToken ct = default);

    Task<IEnumerable<FiscalYearLookupDto>> GetFiscalYearsAsync(
        long orgId, CancellationToken ct = default);

    Task<string?> GetOrganizationNameAsync(long orgId, CancellationToken ct = default);

    Task<string?> GetFiscalYearNameAsync(long orgId, long fyId, CancellationToken ct = default);
}