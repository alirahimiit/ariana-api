using ArianaAPI.Application.DTOs.Taraz;

namespace ArianaAPI.Application.Interfaces;

public interface ITarazRepository
{
    Task<TarazResultDto> GetTarazAsync(
        long orgId,
        long fyId,
        TarazRequestDto request,
        CancellationToken ct = default);
}