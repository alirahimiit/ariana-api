using System.Collections.Concurrent;
using ArianaAPI.Application.Interfaces;

namespace ArianaAPI.Infrastructure.Services;

public class InMemoryRefreshTokenStore : IRefreshTokenStore
{
    private readonly ConcurrentDictionary<string, RefreshTokenInfo> _tokens = new();

    public Task StoreAsync(
        long userId, long orgId, long fyId,
        string refreshToken, DateTime expiresAt, CancellationToken ct = default)
    {
        _tokens[refreshToken] = new RefreshTokenInfo(userId, orgId, fyId, expiresAt);
        CleanupExpired();
        return Task.CompletedTask;
    }

    public Task<RefreshTokenInfo?> ValidateAsync(string refreshToken, CancellationToken ct = default)
    {
        if (!_tokens.TryGetValue(refreshToken, out var info))
            return Task.FromResult<RefreshTokenInfo?>(null);

        if (info.ExpiresAt <= DateTime.UtcNow)
        {
            _tokens.TryRemove(refreshToken, out _);
            return Task.FromResult<RefreshTokenInfo?>(null);
        }

        return Task.FromResult<RefreshTokenInfo?>(info);
    }

    public Task RevokeAsync(string refreshToken, CancellationToken ct = default)
    {
        _tokens.TryRemove(refreshToken, out _);
        return Task.CompletedTask;
    }

    public Task RevokeAllForUserAsync(long userId, CancellationToken ct = default)
    {
        var toRemove = _tokens.Where(kv => kv.Value.UserId == userId)
                              .Select(kv => kv.Key)
                              .ToList();
        foreach (var key in toRemove)
            _tokens.TryRemove(key, out _);

        return Task.CompletedTask;
    }

    private void CleanupExpired()
    {
        var now = DateTime.UtcNow;
        var expired = _tokens.Where(kv => kv.Value.ExpiresAt <= now)
                             .Select(kv => kv.Key)
                             .ToList();
        foreach (var key in expired)
            _tokens.TryRemove(key, out _);
    }
}