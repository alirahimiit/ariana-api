namespace ArianaAPI.Domain.Entities;

/// <summary>
/// گروه کاربری — در هر دیتابیس Tenant جداگانه
/// جدول: Acounting_X_Y.dbo.UserGroup
/// </summary>
public class UserGroup
{
    public long UserGroupID { get; set; }
    public long? UserGroupCode { get; set; }
    public bool En_Vi { get; set; }
    public string? GroupName { get; set; }
    public string? Description { get; set; }
    public string? Name_Op { get; set; }
    public string? Time_OP { get; set; }
    public string? Date_Op { get; set; }
}