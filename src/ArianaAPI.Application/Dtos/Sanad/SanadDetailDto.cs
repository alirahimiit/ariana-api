using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Sanad;

public class SanadDetailDto
{
    public long ParentSanadID { get; set; }

    [JsonPropertyName("noSanad")]
    public int? NO_Sanad { get; set; }

    [JsonPropertyName("dateIn")]
    public string? Date_IN { get; set; }

    [JsonPropertyName("otherParentSharh")]
    public string? OtherParentSharh { get; set; }

    public int? ParentSharh_Code { get; set; }

    [JsonPropertyName("vazeit")]
    public int? Vazeit { get; set; }

    [JsonPropertyName("kindSanad")]
    public int? KindSanad { get; set; }

    public long? Creator { get; set; }
    public long? Confirmer { get; set; }
    public string? Date_Op { get; set; }
    public string? Time_Op { get; set; }
}