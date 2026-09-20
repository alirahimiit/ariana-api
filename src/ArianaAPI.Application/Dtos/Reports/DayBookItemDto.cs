using System.Text.Json.Serialization;

namespace ArianaAPI.Application.Dtos.Reports;

public class DayBookItemDto
{
    // ─── PerSanad only ───
    [JsonPropertyName("noSanad")]
    public string? NoSanad { get; set; }

    [JsonPropertyName("dateIn")]
    public string? DateIn { get; set; }

    [JsonPropertyName("otherParentSharh")]
    public string? OtherParentSharh { get; set; }

    [JsonPropertyName("otherSharh")]
    public string? OtherSharh { get; set; }

    // ─── Common ───
    [JsonPropertyName("codeCol")]
    public int CodeCol { get; set; }

    [JsonPropertyName("codeMoein")]
    public int? CodeMoein { get; set; }

    [JsonPropertyName("codeTafzil")]
    public int? CodeTafzil { get; set; }

    [JsonPropertyName("codeTafzili2")]
    public long? CodeTafzili2 { get; set; }

    [JsonPropertyName("hesabName")]
    public string? HesabName { get; set; }

    [JsonPropertyName("mabBed")]
    public decimal MabBed { get; set; }

    [JsonPropertyName("mabBes")]
    public decimal MabBes { get; set; }

    [JsonPropertyName("vazeit")]
    public int? Vazeit { get; set; }

   
}