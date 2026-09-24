using ArianaAPI.Application.DTOs.Permissions;

namespace ArianaAPI.Application.DTOs.Auth;

public class LoginResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserInfoDto User { get; set; } = null!;

    public UserPermissionsDto? Permissions { get; set; }
}

public class UserInfoDto
{
    public long UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;

    public long OrgId { get; set; }
    public string OrgName { get; set; } = string.Empty;

    public long FyId { get; set; }
    public string FyName { get; set; } = string.Empty;

    public string DbName { get; set; } = string.Empty;
}