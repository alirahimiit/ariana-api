using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;

public class CreateUserDto
{
    [JsonPropertyName("userCode")]
    public string UserCode { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("password")]
    public string Password { get; set; } = "";

    [JsonPropertyName("userGroupCode")]
    public long UserGroupCode { get; set; }
}