namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// یک ردیف تجمیع‌شده برای سند موقت
/// </summary>
public class SanadMovaghatPreviewRowDto
{
    public long CodeCol { get; set; }
    public long CodeMoein { get; set; }
    public long CodeTafzil { get; set; }
    public long CodeTafzili2 { get; set; }
    public long CodeVahed { get; set; }
    public long CodeMarkazH { get; set; }
    public long CodeProject { get; set; }
    public decimal MabBed { get; set; }
    public decimal MabBes { get; set; }
    public decimal Meghdar { get; set; }
    public string? HesabName { get; set; }
}