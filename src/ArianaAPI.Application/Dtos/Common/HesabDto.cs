namespace ArianaAPI.Application.DTOs.Common;

/// <summary>
/// اطلاعات حساب (کل / معین / تفصیل)
/// </summary>
public class HesabDto
{
    public long HesabID { get; set; }
    public int? Code_Col { get; set; }
    public int? Code_Moein { get; set; }
    public int? Code_Tafzil { get; set; }
    public string? Name { get; set; }
    public string? Discript { get; set; }
    public int? Mahiat { get; set; }               // 0=بدهکار، 1=بستانکار
    public string? Mahiat_Str { get; set; }        // "بدهکار" / "بستانکار"
    public int? Vaziat { get; set; }               // 0=فعال، 1=غیرفعال
    public string? Kind { get; set; }
    public decimal? Sum_Bed { get; set; }
    public decimal? Sum_Bes { get; set; }
    public decimal? Mab_Mandeh { get; set; }       // مانده
    public int? HasTafzili { get; set; }
    public decimal? HasTafzili2 { get; set; }
}