using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// ورودی یک ردیف سند
/// </summary>
public class SanadItemInputDto
{
    [JsonPropertyName("rowNum")]
    public int RowNum { get; set; }                    // ترتیب

    [JsonPropertyName("codeCol")]
    public int CodeCol { get; set; }

    [JsonPropertyName("codeMoein")]
    public int CodeMoein { get; set; }

    [JsonPropertyName("codeTafzil")]
    public int CodeTafzil { get; set; }

    [JsonPropertyName("codeTafzili2")]
    public int? CodeTafzili2 { get; set; }

    [JsonPropertyName("tafzili2Id")]
    public int? Tafzili2Id { get; set; }

    [JsonPropertyName("codeSharh")]
    public int? CodeSharh { get; set; }

    [JsonPropertyName("otherSharh")]
    public string? OtherSharh { get; set; }

    [JsonPropertyName("mabBed")]
    public decimal MabBed { get; set; }

    [JsonPropertyName("mabBes")]
    public decimal MabBes { get; set; }

    [JsonPropertyName("meghdar")]
    public decimal? Meghdar { get; set; }
}