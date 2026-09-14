namespace ArianaAPI.Domain.Entities;

/// <summary>
/// سند حسابداری (سرسند)
/// جدول: Acounting_X_Y.dbo.ParentSanad
/// </summary>
public class ParentSanad
{
    public long ParentSanadID { get; set; }
    public long NO_Sanad { get; set; }              // شماره سند
    public string? Date_IN { get; set; }            // تاریخ سند (شمسی)
    public string? OtherParentSharh { get; set; }   // شرح سند
    public int Vazeit { get; set; }                 // وضعیت (0=موقت، 1=قطعی، ...)
    public int KindSanad { get; set; }              // نوع سند
    public long? Creator { get; set; }              // ایجادکننده
    public long? Confirmer { get; set; }            // تاییدکننده
    public long? ParentSharh_Code { get; set; }     // کد شرح
    public string? Date_Op { get; set; }
    public string? Time_Op { get; set; }
}