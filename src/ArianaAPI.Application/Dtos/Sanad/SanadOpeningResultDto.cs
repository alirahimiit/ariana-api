namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// نتیجه‌ی ساخت سند افتتاحیه
/// </summary>
public class SanadOpeningResultDto
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public long ParentSanadId { get; set; }
    public long NoSanad { get; set; }
    public int RowsCopied { get; set; }
    public long PreviousFyId { get; set; }
    public long PreviousEndSanadNum { get; set; }
}