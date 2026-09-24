using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;

/// <summary>ورودی ذخیره‌ی دسترسی‌های یک گروه (از UI)</summary>
public class SavePermissionsDto
{
    [JsonPropertyName("menus")]
    public List<string> Menus { get; set; } = new();

    [JsonPropertyName("operations")]
    public List<long> Operations { get; set; } = new();

    [JsonPropertyName("sharhs")]
    public List<long> Sharhs { get; set; } = new();

    [JsonPropertyName("sarfasls")]
    public List<long> Sarfasls { get; set; } = new();
}
