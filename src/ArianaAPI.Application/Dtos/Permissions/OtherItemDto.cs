using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Permissions;

/// <summary>هر آیتم از جدول Other — برای UI گروه‌های کاربری</summary>
public class OtherItemDto
{
    [JsonPropertyName("code")]
    public long Code { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}
