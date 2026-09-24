using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;

public class MenuRegistryItemDto
{
    [JsonPropertyName("menuKey")]
    public string MenuKey { get; set; } = "";

    [JsonPropertyName("subKey")]
    public string SubKey { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("category")]
    public string Category { get; set; } = "";

    [JsonPropertyName("parentMenuKey")]
    public string? ParentMenuKey { get; set; }

    [JsonPropertyName("sortOrder")]
    public int SortOrder { get; set; }

    [JsonPropertyName("icon")]
    public string? Icon { get; set; }

    [JsonPropertyName("requiresPermission")]
    public bool RequiresPermission { get; set; }

    [JsonPropertyName("windowsMenuName")]
    public string? WindowsMenuName { get; set; }

    [JsonPropertyName("showInWeb")]
    public bool ShowInWeb { get; set; }
}
