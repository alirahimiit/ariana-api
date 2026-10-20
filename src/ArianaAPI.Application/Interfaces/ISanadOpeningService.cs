using ArianaAPI.Application.DTOs.Sanad;

namespace ArianaAPI.Application.Interfaces;

public interface ISanadOpeningService
{
    Task<SanadOpeningResultDto> CreateOpeningSanadAsync(
        long orgId, long fyId, CancellationToken ct = default);
}