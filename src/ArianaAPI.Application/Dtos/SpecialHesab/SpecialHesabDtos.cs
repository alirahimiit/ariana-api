namespace ArianaAPI.Application.DTOs.SpecialHesab;

/// <summary>
/// ⭐ نوع حساب ویژه — طبق Delphi TSpecialHesabKind
/// </summary>
public enum SpecialHesabKind
{
    CodeVahed = 0,        // کد واحد
    MarkazHazine = 1,     // مرکز هزینه
    CodeProject = 2       // کد پروژه
}

/// <summary>
/// DTO مشترک — برای استفاده در گزارش‌های مختلف
/// </summary>
public class SpecialHesabItemDto
{
    public long Id { get; set; }
    public string? Name { get; set; }
    public int SubGroupCode { get; set; }
    public int GroupCode { get; set; }
    public int DetailCode { get; set; }
    public string? HCode { get; set; }
    public int IsChild { get; set; }
    public int Kind { get; set; }
}