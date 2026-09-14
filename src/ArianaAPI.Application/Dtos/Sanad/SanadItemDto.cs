using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Sanad;

public class SanadItemDto
{
    public long SanadID { get; set; }

    [JsonPropertyName("noSanad")]
    public int? NO_Sanad { get; set; }

    [JsonPropertyName("rowNum")]
    public int? RowNum { get; set; }

    public int? Code_Col { get; set; }
    public int? Code_Moein { get; set; }
    public int? Code_Tafzil { get; set; }
    public int? Code_Tafzili2 { get; set; }

    [JsonPropertyName("mabBed")]
    public decimal Mab_Bed { get; set; }

    [JsonPropertyName("mabBes")]
    public decimal Mab_Bes { get; set; }

    public decimal? Meghdar { get; set; }

    [JsonPropertyName("otherSharh")]
    public string? OtherSharh { get; set; }

    public int? TikRow { get; set; }
    public int? Code_Sharh { get; set; }
    public string? DoDate { get; set; }
    public bool? DoOK { get; set; }

    // نام‌ها از JOIN
    public string? ColName { get; set; }
    public string? MoeinName { get; set; }
    public string? TafzilName { get; set; }
    public string? Tafzili2Name { get; set; }
}