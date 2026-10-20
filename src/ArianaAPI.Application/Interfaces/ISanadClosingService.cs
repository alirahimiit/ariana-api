using ArianaAPI.Application.DTOs.Sanad;

namespace ArianaAPI.Application.Interfaces;

public interface ISanadClosingService
{
    Task<SanadClosingValidateDto> ValidateAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<SanadClosingResultDto> CreateClosingSanadAsync(
        SanadClosingRequestDto request, CancellationToken ct = default);
}