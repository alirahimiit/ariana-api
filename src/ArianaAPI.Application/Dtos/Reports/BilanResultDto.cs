namespace ArianaAPI.Application.Dtos.Reports;

public class BilanResultDto
{
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }

    public List<BilanGroupDto> Assets { get; set; } = new();
    public List<BilanGroupDto> Liabilities { get; set; } = new();

    public decimal TotalAssets { get; set; }
    public decimal TotalLiabilities { get; set; }
    public decimal Difference { get; set; }       // تفاوت (باید صفر باشه)
    public bool IsBalanced { get; set; }          // آیا تراز است
    public string ResultText { get; set; } = "";  // "تراز است" | "تراز نیست"
}