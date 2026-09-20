namespace ArianaAPI.Application.Dtos.Reports;

public class ProfitLossGroupDto
{
    public int GroupTypeCode { get; set; }
    public string GroupTypeName { get; set; } = "";
    public string Nature { get; set; } = "";   // "revenue" | "expense"
    public List<ProfitLossItemDto> Items { get; set; } = new();

    public decimal TotalMabBed { get; set; }
    public decimal TotalMabBes { get; set; }
    public decimal Total { get; set; }         // جمع مانده گروه
}