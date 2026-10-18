using ArianaAPI.Application.DTOs.Setup;

namespace ArianaAPI.Application.Interfaces;

public interface ISetupRepository
{
    Task<bool> AuthenticateAsync(string username, string password, CancellationToken ct = default);
    Task<SetupResultDto> CreateDorehMaliAsync(SetupRequestDto request, CancellationToken ct = default);
    Task<SetupSazmanListResultDto> GetSazmansAsync(CancellationToken ct = default);
    Task<List<DorehMaliItemDto>> GetDorehMalisAsync(long sazmanId, CancellationToken ct = default);
}