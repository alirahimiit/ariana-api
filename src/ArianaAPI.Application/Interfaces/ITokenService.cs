using System.Security.Claims;

namespace ArianaAPI.Application.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(
        long userId,
        string username,
        long orgId,
        long fyId,
        IEnumerable<string>? roles = null);

    string GenerateRefreshToken();

    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);

    DateTime GetAccessTokenExpiry();
}