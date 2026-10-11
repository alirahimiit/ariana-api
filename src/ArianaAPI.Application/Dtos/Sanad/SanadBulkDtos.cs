namespace ArianaAPI.Application.DTOs.Sanad;

public class BulkChangeVazeitRequest
{
    public List<long> SanadIds { get; set; } = new();
    public int TargetVazeit { get; set; }   // 0 = پیش‌نویس، 1 = رسیدگی، 2 = قطعی
}

public class BulkChangeVazeitResult
{
    public int UpdatedCount { get; set; }
    public int SkippedCount { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<long> UpdatedIds { get; set; } = new();
}