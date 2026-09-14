namespace ArianaAPI.Domain.Entities;

/// <summary>
/// دوره مالی
/// جدول: Permanent.dbo.DorehMali
/// نکته: تاریخ‌ها شمسی هستند و به صورت string ذخیره می‌شن
/// </summary>
public class DorehMali
{
    public long DorehMaliID { get; set; }
    public string? Name { get; set; }              // مثلا "1404"
    public string? BeginDate { get; set; }         // مثلا "1404/01/01"
    public string? EndDate { get; set; }           // مثلا "1404/12/29"
    public long? SazmanCode { get; set; }          // FK به Sazman
    public string? Discript { get; set; }
    public long? AddedHesabs { get; set; }
    public long? AddedUsers { get; set; }
    public long? AddedSetting { get; set; }
    public long? Code_Op { get; set; }
    public string? Date_Op { get; set; }
    public string? Time_Op { get; set; }
    public long? PriorDorehMaliCode { get; set; }  // دوره مالی قبلی
    public long? EndSanadNum { get; set; }
    public long? BeginSanadNum { get; set; }
    public decimal? Tax_Per { get; set; }          // درصد مالیات
    public decimal? Avarez_Per { get; set; }       // درصد عوارض
    public string? UpDate_Database { get; set; }
}