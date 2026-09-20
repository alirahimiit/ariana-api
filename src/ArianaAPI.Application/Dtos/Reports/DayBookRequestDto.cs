namespace ArianaAPI.Application.Dtos.Reports;

public class DayBookRequestDto
{
    /// <summary>col | moein | tafzil | tafzil2</summary>
    public string Level { get; set; } = "col";

    /// <summary>aggregated | perSanad</summary>
    public string Mode { get; set; } = "aggregated";

    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
    public int? NoFrom { get; set; }
    public int? NoTo { get; set; }
    public int? Vazeit { get; set; }

    /// <summary>all | noZeroMandeh | noZeroGardesh</summary>
    public string HesabOption { get; set; } = "all";

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}