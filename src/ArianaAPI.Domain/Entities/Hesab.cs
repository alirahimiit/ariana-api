namespace ArianaAPI.Domain.Entities;

/// <summary>
/// حساب‌های حسابداری (کدینگ)
/// جدول: Acounting_X_Y.dbo.Hesab
/// </summary>
public class Hesab
{
    public long HesabID { get; set; }
    public short? Code_Group { get; set; }
    public short? Code_Col { get; set; }           // کل
    public short? Code_Moein { get; set; }         // معین
    public short? Code_Tafzil { get; set; }        // تفصیل 1
    public string? Name { get; set; }
    public string? Discript { get; set; }
    public decimal? Sum_Bed { get; set; }
    public decimal? Sum_Bes { get; set; }
    public decimal? Mab_Mandeh { get; set; }
    public int? Mahiat { get; set; }               // ماهیت (بدهکار/بستانکار)
    public int? Vaziat { get; set; }               // وضعیت
    public string? Kind { get; set; }
    public int? Code_Op { get; set; }
    public string? Date_Op { get; set; }
    public string? Time_Op { get; set; }
    public int? HasTafzili { get; set; }
    public decimal? HasTafzili2 { get; set; }
    public int? GroupTypeCode { get; set; }
}