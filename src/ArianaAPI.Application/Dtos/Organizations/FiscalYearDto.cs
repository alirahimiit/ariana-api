namespace ArianaAPI.Application.DTOs.Organizations;

/// <summary>
/// اطلاعات دوره مالی برای ارسال به کلاینت
/// </summary>
public class FiscalYearDto
{
    public long DorehMaliID { get; set; }
    public string? Name { get; set; }              // مثلا "1404"
    public string? BeginDate { get; set; }         // "1404/01/01"
    public string? EndDate { get; set; }           // "1404/12/29"
    public long? SazmanCode { get; set; }

    /// <summary>نام دیتابیس ساخته شده برای این دوره (مثلا Acounting_1_5)</summary>
    public string? DatabaseName { get; set; }
}