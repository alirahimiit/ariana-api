using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// خروجی ایجاد سند جدید
/// </summary>
public class SanadCreateResultDto
{
    [JsonPropertyName("parentSanadId")]
    public long ParentSanadId { get; set; }

    [JsonPropertyName("noSanad")]
    public int NoSanad { get; set; }
}