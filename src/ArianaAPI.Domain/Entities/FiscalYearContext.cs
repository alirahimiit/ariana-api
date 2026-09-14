namespace ArianaAPI.Domain.Entities;

/// <summary>
/// ⭐ Context کاربر لاگین شده (از JWT استخراج می‌شه)
/// این کلاس توی هر درخواست استفاده می‌شه تا بدونیم کاربر کدوم سازمان و دوره رو می‌خواد
/// </summary>
public class FiscalYearContext
{
    public long OrgId { get; set; }
    public string OrgName { get; set; } = string.Empty;
    public long FYId { get; set; }
    public string FYName { get; set; } = string.Empty;
    public long UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DatabaseName { get; set; } = string.Empty;  // مثلا Acounting_1_5
}