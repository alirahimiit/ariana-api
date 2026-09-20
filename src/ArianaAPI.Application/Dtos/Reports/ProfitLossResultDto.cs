namespace ArianaAPI.Application.Dtos.Reports;

public class ProfitLossResultDto
{
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }

    public List<ProfitLossGroupDto> Revenues { get; set; } = new();
    public List<ProfitLossGroupDto> Expenses { get; set; } = new();

    public decimal TotalRevenue { get; set; }
    public decimal TotalExpense { get; set; }
    public decimal NetProfit { get; set; }     // سود (مثبت) یا زیان (منفی)

    public string ResultType { get; set; } = ""; // "profit" | "loss" | "zero"
    public string ResultText { get; set; } = "";
}