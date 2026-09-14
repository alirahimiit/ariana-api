namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// ذخیره‌سازی Refresh Token (فعلاً in-memory؛ در Production → Redis یا DB)
/// </summary>
public interface IRefreshTokenStore
{
    Task StoreAsync(
        long userId, long orgId, long fyId,
        string refreshToken, DateTime expiresAt, CancellationToken ct = default);

    Task<RefreshTokenInfo?> ValidateAsync(string refreshToken, CancellationToken ct = default);

    Task RevokeAsync(string refreshToken, CancellationToken ct = default);

    Task RevokeAllForUserAsync(long userId, CancellationToken ct = default);
}

public record RefreshTokenInfo(long UserId, long OrgId, long FyId, DateTime ExpiresAt);