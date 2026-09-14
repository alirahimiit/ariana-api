namespace ArianaAPI.Domain.Entities;

/// <summary>
/// کاربر سیستم (در هر دیتابیس سازمان جداگانه)
/// جدول: Acounting_X_Y.dbo.Users
/// نکته: پسوردها plain text هستند (بهبود در فاز امنیتی)
/// </summary>
public class User
{
    public long UsersID { get; set; }
    public long? UserGroupCode { get; set; }
    public string? UserCode { get; set; }
    public string? Name { get; set; }
    public string? Password { get; set; }
    public string? Code_Op { get; set; }
    public string? Time_OP { get; set; }
    public string? Date_Op { get; set; }
}