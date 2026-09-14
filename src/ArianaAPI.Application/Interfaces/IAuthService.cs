using ArianaAPI.Application.DTOs.Auth;

namespace ArianaAPI.Application.Interfaces;

public interface IAuthService
{
    Task<LoginResponseDto> LoginAsync(LoginRequestDto request, CancellationToken ct = default);
    Task<LoginResponseDto> RefreshAsync(RefreshTokenRequestDto request, CancellationToken ct = default);
    Task LogoutAsync(string refreshToken, CancellationToken ct = default);
}