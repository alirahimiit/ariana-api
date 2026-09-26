using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Auth;

public class ChangePasswordRequestDto
{
    [JsonPropertyName("currentPassword")]
    public string CurrentPassword { get; set; } = string.Empty;

    [JsonPropertyName("newPassword")]
    public string NewPassword { get; set; } = string.Empty;
}