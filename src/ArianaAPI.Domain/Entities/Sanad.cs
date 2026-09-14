namespace ArianaAPI.Domain.Entities;

/// <summary>
/// ردیف‌های سند حسابداری (آیتم‌های سند)
/// جدول: Acounting_X_Y.dbo.Sanad
/// </summary>
public class Sanad
{
    public long SanadID { get; set; }
    public long NO_Sanad { get; set; }
    public long? RowNum { get; set; }               // شماره ردیف در سند
    public int Code_Col { get; set; }               // کد کل
    public int Code_Moein { get; set; }             // کد معین
    public int Code_Tafzil { get; set; }            // کد تفصیل
    public int Code_Tafzili2 { get; set; }          // کد تفصیل 2
    public decimal Mab_Bed { get; set; }            // مبلغ بدهکار
    public decimal Mab_Bes { get; set; }            // مبلغ بستانکار
    public decimal? Meghdar { get; set; }           // مقدار
    public string? OtherSharh { get; set; }         // شرح ردیف
    public long? TikRow { get; set; }
    public long? Code_Sharh { get; set; }
    public string? DoDate { get; set; }
    public bool? DoOK { get; set; }
    public long ParentSanadCode { get; set; }       // FK به ParentSanad
}