namespace ArianaAPI.Application.DTOs.Backup;

public class BackupVerifyResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;

    // اطلاعات از RESTORE HEADERONLY
    public string DatabaseNameInBackup { get; set; } = string.Empty;
    public string ServerName { get; set; } = string.Empty;
    public string BackupDate { get; set; } = string.Empty;

    // اطلاعات از RESTORE FILELISTONLY
    public string DataLogicalName { get; set; } = string.Empty;
    public string LogLogicalName { get; set; } = string.Empty;

    // مقصد بازیابی (دیتابیس جاری)
    public string TargetDatabase { get; set; } = string.Empty;

    public long FileSizeBytes { get; set; }
}