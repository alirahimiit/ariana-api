using ArianaAPI.Application.DTOs.Auth;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Domain.Entities;
using ArianaAPI.Application.DTOs.Permissions;

namespace ArianaAPI.Application.Services;

/// <summary>
/// سرویس احراز هویت
/// ⚠️ فرض: IUserRepository متد GetByUsernameAsync داره که UserDto با فیلدهای
///    UserId, Username, FullName, PasswordHash برمی‌گردونه.
///    اگه ساختار UserDto متفاوته، این فایل رو تنظیم کن.
/// </summary>
public class AuthService : IAuthService
{
    private readonly IUserRepository _users;
    private readonly ITokenService _tokens;
    private readonly IRefreshTokenStore _refreshStore;
    private readonly ILookupRepository _lookup;
    private readonly ITenantDbNameProvider _dbName;
    private readonly IPermissionRepository _permissions;

    public AuthService(
        IUserRepository users,
        ITokenService tokens,
        IRefreshTokenStore refreshStore,
        ILookupRepository lookup,
        ITenantDbNameProvider dbName,
        IPermissionRepository permissions)
    {
        _users = users;
        _tokens = tokens;
        _refreshStore = refreshStore;
        _lookup = lookup;
        _dbName = dbName;
        _permissions = permissions;
    }

    public async Task<LoginResponseDto> LoginAsync(LoginRequestDto request, CancellationToken ct = default)
    {
        var user = await _users.AuthenticateAsync(
            request.OrgId, request.FyId, request.Username, request.Password, ct)
            ?? throw new UnauthorizedAccessException("نام کاربری یا رمز عبور اشتباه است");

        return await BuildResponseAsync(user, request.OrgId, request.FyId, ct);
    }

    public async Task<LoginResponseDto> RefreshAsync(
        RefreshTokenRequestDto request, CancellationToken ct = default)
    {
        var info = await _refreshStore.ValidateAsync(request.RefreshToken, ct)
            ?? throw new UnauthorizedAccessException("Refresh Token نامعتبر یا منقضی شده");

        await _refreshStore.RevokeAsync(request.RefreshToken, ct);

        var user = await _users.GetByIdAsync(info.OrgId, info.FyId, info.UserId, ct)
            ?? throw new UnauthorizedAccessException("کاربر یافت نشد");

        return await BuildResponseAsync(user, info.OrgId, info.FyId, ct);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        await _refreshStore.RevokeAsync(refreshToken, ct);
    }

    private async Task<LoginResponseDto> BuildResponseAsync(
    User user, long orgId, long fyId, CancellationToken ct)
    {
        var username = user.UserCode ?? user.Name ?? string.Empty;
        var fullName = user.Name ?? user.UserCode ?? string.Empty;

        var orgName = await _lookup.GetOrganizationNameAsync(orgId, ct) ?? $"سازمان {orgId}";
        var fyName = await _lookup.GetFiscalYearNameAsync(orgId, fyId, ct) ?? $"دوره {fyId}";
        var dbName = _dbName.Build(orgId, fyId);

        // ⭐ ۱. اول permissions رو لود کن
        UserPermissionsDto? permissions = null;
        if (user.UserGroupCode.HasValue && user.UserGroupCode.Value > 0)
        {
            permissions = await _permissions.GetByUserGroupAsync(
                orgId, fyId, user.UserGroupCode.Value, ct);
        }

        // ⭐ ۲. توکن رو با permissions بساز
        var accessToken = _tokens.GenerateAccessToken(
            user.UsersID,
            username,
            orgId,
            fyId,
            user.UserGroupCode ?? 0,
            permissions?.Operations);

        var refreshToken = _tokens.GenerateRefreshToken();
        var accessExpiry = _tokens.GetAccessTokenExpiry();
        var refreshExpiry = DateTime.UtcNow.AddDays(7);

        await _refreshStore.StoreAsync(user.UsersID, orgId, fyId, refreshToken, refreshExpiry, ct);

        return new LoginResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = accessExpiry,
            User = new UserInfoDto
            {
                UserId = user.UsersID,
                Username = username,
                FullName = fullName,
                OrgId = orgId,
                OrgName = orgName,
                FyId = fyId,
                FyName = fyName,
                DbName = dbName
            },
            Permissions = permissions
        };
    }
}