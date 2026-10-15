using ArianaAPI.Application.Dtos.ConstHesab;

namespace ArianaAPI.Application.Interfaces;

public interface IConstHesabRepository
{
    Task<List<ConstHesabItemDto>> GetListAsync(long orgId, long fyId, CancellationToken ct = default);

    Task<bool> SetAsync(long orgId, long fyId, ConstHesabSetDto dto,
                        long userCode, CancellationToken ct = default);

    Task<bool> ClearAsync(long orgId, long fyId, int type, CancellationToken ct = default);
}