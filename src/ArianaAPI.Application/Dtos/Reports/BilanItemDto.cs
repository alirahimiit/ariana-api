namespace ArianaAPI.Application.Dtos.Reports;

public class BilanItemDto
{
    public int CodeCol { get; set; }
    public string HesabName { get; set; } = "";
    public decimal MabBed { get; set; }
    public decimal MabBes { get; set; }
    public decimal MabMan { get; set; }
}