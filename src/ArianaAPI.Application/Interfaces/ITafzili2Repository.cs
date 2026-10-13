using ArianaAPI.Application.DTOs.Tafzili2;

namespace ArianaAPI.Application.Interfaces;

public interface ITafzili2Repository
{
    Task<Tafzili2ListResultDto> GetListAsync(
        long orgId, long fyId, Tafzili2RequestDto req, CancellationToken ct = default);

    Task<Tafzili2DetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<Tafzili2CreateResultDto> CreateAsync(
        long orgId, long fyId, Tafzili2CreateDto dto, long userCode, CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId, Tafzili2UpdateDto dto, long userCode, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<long> GetNextCodeAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<bool> IsCodeExistsAsync(
        long orgId, long fyId, long code, long? excludeId = null, CancellationToken ct = default);

    Task<Tafzili2UsageDto> GetUsageAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);
}