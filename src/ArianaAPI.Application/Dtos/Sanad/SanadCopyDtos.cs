namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>درخواست کپی اسناد به دوره مالی دیگر</summary>
public class SanadCopyRequestDto
{
    public List<long> SanadIds { get; set; } = new();
    public long? TargetOrgId { get; set; }         // اگر null → همان سازمان جاری
    public long TargetFyId { get; set; }
    public bool UseSourceDate { get; set; } = true; // اگر true → تاریخ مبدأ حفظ شود
    public bool CopyVazeit { get; set; } = false;   // اگر false → Vazeit=0 (پیش‌نویس)
}

/// <summary>نتیجه کپی یک سند</summary>
public class SanadCopyItemResult
{
    public int SourceNoSanad { get; set; }
    public int NewNoSanad { get; set; }
    public long NewParentId { get; set; }
    public int ItemsCount { get; set; }
}

/// <summary>نتیجه کلی عملیات کپی</summary>
public class SanadCopyResultDto
{
    public int CopiedCount { get; set; }
    public int TotalItems { get; set; }
    public List<SanadCopyItemResult> Results { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

/// <summary>درخواست حذف گروهی</summary>
public class SanadBulkDeleteRequestDto
{
    public List<long> SanadIds { get; set; } = new();
}

/// <summary>اطلاعات دوره مالی</summary>
public class DorehMaliListDto
{
    public long DorehMaliID { get; set; }
    public long OrgID { get; set; }
    public string? Name { get; set; }
    public string? BeginDate { get; set; }
    public string? EndDate { get; set; }
    public bool IsActive { get; set; }
}