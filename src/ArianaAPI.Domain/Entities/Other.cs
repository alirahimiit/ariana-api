namespace ArianaAPI.Domain.Entities;

/// <summary>
/// تعریف عملیات‌های سیستمی (مثل «درج سند»، «حذف فاکتور»، ...)
/// جدول: Acounting_X_Y.dbo.Other
/// کدها دقیقاً مطابق Const_impl.pas (100..188)
/// </summary>
public class Other
{
    public long OtherID { get; set; }
    public long? Code { get; set; }
    public string? Description { get; set; }
}