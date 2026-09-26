using System.Security.Claims;

namespace ArianaAPI.Application.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(
        long userId,
        string username,
        long orgId,
        long fyId,
        long userGroupCode = 0,
        IEnumerable<long>? permissions = null);

    string GenerateRefreshToken();
    DateTime GetAccessTokenExpiry();
}