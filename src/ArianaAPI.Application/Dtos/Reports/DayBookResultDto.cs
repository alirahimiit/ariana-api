using System.Text.Json.Serialization;

namespace ArianaAPI.Application.Dtos.Reports;

public class DayBookResultDto
{
    [JsonPropertyName("level")]
    public string Level { get; set; } = "col";

    [JsonPropertyName("mode")]
    public string Mode { get; set; } = "aggregated";

    [JsonPropertyName("fromDate")]
    public string? FromDate { get; set; }

    [JsonPropertyName("toDate")]
    public string? ToDate { get; set; }

    [JsonPropertyName("items")]
    public List<DayBookItemDto> Items { get; set; } = new();

    [JsonPropertyName("totalBed")]
    public decimal TotalBed { get; set; }

    [JsonPropertyName("totalBes")]
    public decimal TotalBes { get; set; }

    [JsonPropertyName("page")]
    public int Page { get; set; } = 1;

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; } = 1;

    [JsonPropertyName("totalCount")]
    public int TotalCount { get; set; }
}