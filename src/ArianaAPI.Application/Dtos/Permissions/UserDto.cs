using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;

/// <summary>
/// DTO خروجی کاربر برای صفحه مدیریت — جلسه ۶۱
/// Password و PasswordHash برگردانده نمی‌شوند.
/// </summary>
public class UserDto
{
    [JsonPropertyName("usersId")]
    public long UsersId { get; set; }

    [JsonPropertyName("userGroupCode")]
    public long? UserGroupCode { get; set; }

    [JsonPropertyName("userCode")]
    public string? UserCode { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("groupName")]
    public string? GroupName { get; set; }

    /// <summary>آیا رمز با BCrypt هش شده؟ (برای نمایش نشان امنیتی)</summary>
    [JsonPropertyName("hasPasswordHash")]
    public bool HasPasswordHash { get; set; }

    [JsonPropertyName("dateOp")]
    public string? DateOp { get; set; }

    [JsonPropertyName("timeOp")]
    public string? TimeOp { get; set; }
}