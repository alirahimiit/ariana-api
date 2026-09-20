namespace ArianaAPI.Application.DTOs.Dashboard;

public class DashboardStatsDto
{
    public int TotalSanads { get; set; }
    public int TotalFactors { get; set; }
    public int TotalHesabs { get; set; }
    public int TotalTafzilis { get; set; }
    public int TotalArticles { get; set; }

    public List<ChartItemDto> FactorsByKind { get; set; } = new();
    public List<ChartItemDto> SanadsByVazeit { get; set; } = new();
    public List<ChartItemDto> AccountsByGroupType { get; set; } = new();
}

public class ChartItemDto
{
    public string Label { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public int? Code { get; set; }
    public bool IsMoney { get; set; } = false;
}