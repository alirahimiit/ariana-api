using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;

public class ResetPasswordDto
{
    [JsonPropertyName("newPassword")]
    public string NewPassword { get; set; } = "";
}