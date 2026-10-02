namespace ArianaAPI.Domain.Entities.Moadian;

/// <summary>
/// جدول tax_setting — تنظیمات مودیان
/// </summary>
public class TaxSetting
{
    public string? TaxUserName { get; set; }
    public string? PrivateKey { get; set; }
    public string? CodeEgtesadi { get; set; }
    public bool IsSandbox { get; set; }
    public bool Invoice { get; set; }
    public bool Customer { get; set; }
    public bool Stuff { get; set; }
}