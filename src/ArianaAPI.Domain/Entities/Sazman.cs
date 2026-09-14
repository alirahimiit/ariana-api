namespace ArianaAPI.Domain.Entities;

/// <summary>
/// سازمان (شرکت)
/// جدول: Permanent.dbo.Sazman
/// </summary>
public class Sazman
{
    public long SazmanID { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Arm { get; set; }               // اختصار
    public string? Discription { get; set; }
    public string? Address { get; set; }
    public string? PhonNumber { get; set; }
    public string? Date_Op { get; set; }
    public string? Time_Op { get; set; }
    public long? Code_Op { get; set; }
    public string? PhoneNo { get; set; }
    public string? EcoNo { get; set; }
    public string? PostalCode { get; set; }
    public string? CityName1 { get; set; }
    public string? CityName2 { get; set; }
    public string? Ostan { get; set; }
    public string? RegNo { get; set; }
    public string? CoName { get; set; }
    public string? LicenceSazman { get; set; }
    public string? SysID { get; set; }
    public string? NationalCode { get; set; }
    public bool? Tax_Software { get; set; }
    public bool? Report_App { get; set; }
}