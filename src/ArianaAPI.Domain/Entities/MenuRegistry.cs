namespace ArianaAPI.Domain.Entities;

/// <summary>
/// رجیستری منوها — Permanent DB
/// نگاشت بین MenuKey وب و WindowsMenuName دلفی
/// </summary>
public class MenuRegistry
{
    public long MenuRegistryID { get; set; }
    public string MenuKey { get; set; } = "";
    public string SubKey { get; set; } = "";
    public string? WindowsMenuName { get; set; }
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public string? ParentMenuKey { get; set; }
    public int SortOrder { get; set; }
    public string? Icon { get; set; }
    public bool RequiresPermission { get; set; }
    public bool ShowInWindows { get; set; }
    public bool ShowInWeb { get; set; }
    public bool IsActive { get; set; }
}