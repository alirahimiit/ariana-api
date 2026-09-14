using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Config;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ArianaAPI.Infrastructure.Services;

public class TokenService : ITokenService
{
    private readonly JwtSettings _settings;

    public TokenService(IOptions<JwtSettings> options)
    {
        _settings = options.Value;

        if (string.IsNullOrWhiteSpace(_settings.Key) || _settings.Key.Length < 32)
            throw new InvalidOperationException(
                "Jwt:Key باید حداقل ۳۲ کاراکتر باشه (256-bit برای HS256)");
    }

    public string GenerateAccessToken(
        long userId,
        string username,
        long orgId,
        long fyId,
        IEnumerable<string>? roles = null)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("userId", userId.ToString()),
            new("orgId", orgId.ToString()),
            new("fyId", fyId.ToString())
        };

        if (roles != null)
        {
            foreach (var role in roles)
                claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: GetAccessTokenExpiry(),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    public ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var validationParams = new TokenValidationParameters
        {
            ValidateAudience = true,
            ValidAudience = _settings.Audience,
            ValidateIssuer = true,
            ValidIssuer = _settings.Issuer,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key)),
            ValidateLifetime = false // ← مهم: برای توکن منقضی
        };

        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(token, validationParams, out var securityToken);

            if (securityToken is not JwtSecurityToken jwt ||
                !jwt.Header.Alg.Equals(SecurityAlgorithms.HmacSha256,
                    StringComparison.InvariantCultureIgnoreCase))
                return null;

            return principal;
        }
        catch
        {
            return null;
        }
    }

    public DateTime GetAccessTokenExpiry()
        => DateTime.UtcNow.AddMinutes(_settings.AccessTokenExpiryMinutes);
}