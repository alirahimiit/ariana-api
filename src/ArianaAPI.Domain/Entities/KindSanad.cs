namespace ArianaAPI.Domain.Entities;

/// <summary>
/// نوع سند
/// (اگر جدول جداگانه نداشته باشی، این Enum استفاده می‌شه)
/// </summary>
public class KindSanad
{
    public int Code { get; set; }
    public string Name { get; set; } = string.Empty;
}