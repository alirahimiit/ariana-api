namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// فیلتر انتخاب حساب برای پیش‌نمایش سند موقت
/// </summary>
public class SanadMovaghatPreviewRequestDto
{
    public long CodeCol { get; set; }
    public long? CodeMoein { get; set; }
    public long? CodeTafzil { get; set; }
    public long? CodeTafzili2 { get; set; }
    public long? CodeVahed { get; set; }
    public long? CodeMarkazH { get; set; }
    public long? CodeProject { get; set; }
}