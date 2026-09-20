namespace ArianaAPI.Application.Dtos.Reports;

public class BilanGroupDto
{
    public int GroupTypeCode { get; set; }
    public string GroupTypeName { get; set; } = "";
    public string Nature { get; set; } = "";   // "asset" | "liability"
    public List<BilanItemDto> Items { get; set; } = new();
    public decimal TotalMabBed { get; set; }
    public decimal TotalMabBes { get; set; }
    public decimal Total { get; set; }
}