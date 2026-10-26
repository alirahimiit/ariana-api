namespace ArianaAPI.Application.DTOs.Backup;

public class RestoreResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool ForceLogout { get; set; }
    public string TargetDatabase { get; set; } = string.Empty;
}