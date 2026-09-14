namespace ArianaAPI.Application.DTOs.Organizations;

/// <summary>
/// اطلاعات سازمان برای ارسال به کلاینت
/// </summary>
public class OrganizationDto
{
    public long SazmanID { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Arm { get; set; }
    public string? NationalCode { get; set; }
    public string? RegNo { get; set; }
    public string? PhoneNo { get; set; }
    public string? Address { get; set; }
    public string? EcoNo { get; set; }
    public string? PostalCode { get; set; }
    public string? CityName1 { get; set; }
    public string? Ostan { get; set; }
}