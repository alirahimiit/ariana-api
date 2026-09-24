namespace ArianaAPI.Domain.Entities;

/// <summary>
/// دسترسی‌های هر گروه کاربری
/// جدول: Acounting_X_Y.dbo.Permision
///
/// PType:
///   0 = Menu      (MenuName پر می‌شود)
///   1 = Sarfasl   (PCode = HesabID)
///   2 = Sharh     (PCode = SharhID)
///   3 = Other     (PCode = Other.Code ، مثل 101، 143، ...)
/// </summary>
public class Permision
{
    public long PermisionID { get; set; }
    public long? UserGroupCode { get; set; }
    public string? MenuName { get; set; }
    public int? PType { get; set; }
    public long? PCode { get; set; }
    public string? Name_Op { get; set; }
    public string? Time_OP { get; set; }
    public string? Date_Op { get; set; }
}