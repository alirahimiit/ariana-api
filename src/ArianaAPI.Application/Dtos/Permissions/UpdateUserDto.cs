using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;

/// <summary>ویرایش کاربر — رمز عبور در این DTO نیست (از reset-password استفاده شود)</summary>
public class UpdateUserDto
{
    [JsonPropertyName("userCode")]
    public string UserCode { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("userGroupCode")]
    public long UserGroupCode { get; set; }
}