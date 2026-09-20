namespace ArianaAPI.Application.Dtos.Reports;

public class BilanRequestDto
{
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
    public bool IncludeZeroBalance { get; set; } = false;
}