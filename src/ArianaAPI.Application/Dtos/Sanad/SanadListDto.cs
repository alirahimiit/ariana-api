using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Sanad;

public class SanadListDto
{
    public long ParentSanadID { get; set; }

    [JsonPropertyName("noSanad")]
    public int? NO_Sanad { get; set; }

    [JsonPropertyName("dateIn")]
    public string? Date_IN { get; set; }

    [JsonPropertyName("otherParentSharh")]
    public string? OtherParentSharh { get; set; }

    [JsonPropertyName("vazeit")]
    public int? Vazeit { get; set; }

    [JsonPropertyName("kindSanad")]
    public int? KindSanad { get; set; }

    [JsonPropertyName("mabBed")]
    public decimal Mab_Bed { get; set; }

    [JsonPropertyName("mabBes")]
    public decimal Mab_Bes { get; set; }
}