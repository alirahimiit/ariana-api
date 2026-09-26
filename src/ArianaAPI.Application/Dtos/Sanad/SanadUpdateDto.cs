using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// ورودی ویرایش سند — مثل Create + ParentSanadID
/// </summary>
public class SanadUpdateDto : SanadCreateDto
{
    [JsonPropertyName("parentSanadId")]
    public long ParentSanadId { get; set; }
}