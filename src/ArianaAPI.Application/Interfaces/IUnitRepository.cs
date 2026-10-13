using ArianaAPI.Application.DTOs.Stock;

namespace ArianaAPI.Application.Interfaces;

public interface IUnitRepository
{
    Task<UnitListResultDto> GetListAsync(
        long orgId, long fyId, UnitRequestDto req, CancellationToken ct = default);

    Task<UnitDetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<UnitCreateResultDto> CreateAsync(
        long orgId, long fyId, UnitCreateDto dto, CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId, UnitUpdateDto dto, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<long> GetNextCodeAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<UnitUsageDto> GetUsageAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<IEnumerable<UnitListDto>> GetLookupAsync(
        long orgId, long fyId, CancellationToken ct = default);
}