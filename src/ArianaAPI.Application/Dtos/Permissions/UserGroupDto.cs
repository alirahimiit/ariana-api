using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;

public class UserGroupDto
{
    [JsonPropertyName("userGroupId")]
    public long UserGroupId { get; set; }

    [JsonPropertyName("userGroupCode")]
    public long UserGroupCode { get; set; }

    [JsonPropertyName("groupName")]
    public string? GroupName { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("enVi")]
    public bool EnVi { get; set; }
}
