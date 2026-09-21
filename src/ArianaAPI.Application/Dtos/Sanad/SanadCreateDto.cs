using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// ورودی ایجاد سند جدید (سرسند + ردیف‌ها)
/// </summary>
public class SanadCreateDto
{
    [JsonPropertyName("noSanad")]
    public int? NoSanad { get; set; }              // اگه خالی باشه، سرور خودش می‌سازه

    [JsonPropertyName("dateIn")]
    public string DateIn { get; set; } = "";

    [JsonPropertyName("otherParentSharh")]
    public string? OtherParentSharh { get; set; }

    [JsonPropertyName("parentSharhCode")]
    public long? ParentSharhCode { get; set; }        // اختیاری — کد شرح

    [JsonPropertyName("vazeit")]
    public int Vazeit { get; set; } = 0;              // 0=پیش‌نویس، 1=ثبت، 2=تأیید

    [JsonPropertyName("kindSanad")]
    public int KindSanad { get; set; } = 0;           // 0=عادی، 1=افتتاحیه، ...

    [JsonPropertyName("items")]
    public List<SanadItemInputDto> Items { get; set; } = new();
}