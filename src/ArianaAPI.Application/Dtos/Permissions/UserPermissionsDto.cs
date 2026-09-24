using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;


public class UserPermissionsDto
{
    [JsonPropertyName("userGroupCode")]
    public long UserGroupCode { get; set; }

    [JsonPropertyName("groupName")]
    public string? GroupName { get; set; }

    [JsonPropertyName("enVi")]
    public bool EnVi { get; set; }

    /// <summary>لیست WindowsMenuName های مجاز (PType=0)</summary>
    [JsonPropertyName("menus")]
    public List<string> Menus { get; set; } = new();

    /// <summary>کدهای Other.Code (PType=3)</summary>
    [JsonPropertyName("operations")]
    public List<long> Operations { get; set; } = new();

    /// <summary>کدهای شرح (PType=2) — فعلاً خالی</summary>
    [JsonPropertyName("sharhs")]
    public List<long> Sharhs { get; set; } = new();

    /// <summary>کدهای سرفصل (PType=1) — فعلاً خالی</summary>
    [JsonPropertyName("sarfasls")]
    public List<long> Sarfasls { get; set; } = new();
}
