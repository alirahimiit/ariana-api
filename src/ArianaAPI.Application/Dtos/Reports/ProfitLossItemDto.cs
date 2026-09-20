namespace ArianaAPI.Application.Dtos.Reports;

public class ProfitLossItemDto
{
    public int CodeCol { get; set; }
    public string HesabName { get; set; } = "";
    public decimal MabBed { get; set; }        // مجموع بدهکار
    public decimal MabBes { get; set; }        // مجموع بستانکار
    public decimal MabMan { get; set; }        // مانده (مطابق ماهیت)
}