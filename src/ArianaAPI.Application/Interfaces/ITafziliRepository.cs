using ArianaAPI.Application.DTOs.Tafzili;

namespace ArianaAPI.Application.Interfaces;

public interface ITafziliRepository
{
    Task<TafziliListResultDto> GetListAsync(
        long orgId,
        long fyId,
        TafziliRequestDto request,
        CancellationToken ct = default);

    Task<TafziliDetailDto?> GetDetailAsync(
        long orgId,
        long fyId,
        long tafziliId,
        CancellationToken ct = default);

    Task<IEnumerable<TafziliGroupDto>> GetGroupsAsync(
        long orgId,
        long fyId,
        CancellationToken ct = default);

    Task<long> SaveGroupAsync(
        long orgId,
        long fyId,
        TafziliGroupSaveDto dto,
        CancellationToken ct = default);

    Task<bool> DeleteGroupAsync(
        long orgId,
        long fyId,
        long groupId,
        CancellationToken ct = default);

    Task<TafziliCreateResultDto> CreateAsync(
        long orgId, long fyId, TafziliCreateDto dto, CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId, TafziliUpdateDto dto, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long tafziliId, CancellationToken ct = default);
}