namespace ArianaAPI.Application.DTOs.Lookup;

public class OrganizationLookupDto
{
    public int Code { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class FiscalYearLookupDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? BeginDate { get; set; }
    public string? EndDate { get; set; }
    public bool IsActive { get; set; }
}