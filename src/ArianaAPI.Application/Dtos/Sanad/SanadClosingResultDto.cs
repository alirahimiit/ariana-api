namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// نتیجه‌ی ساخت سند اختتامیه
/// </summary>
public class SanadClosingResultDto
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public long ParentSanadId { get; set; }
    public long NoSanad { get; set; }
    public int RowsCreated { get; set; }
    public decimal TotalBed { get; set; }
    public decimal TotalBes { get; set; }
}