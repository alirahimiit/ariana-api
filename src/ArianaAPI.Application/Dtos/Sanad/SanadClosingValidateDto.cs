namespace ArianaAPI.Application.DTOs.Sanad;

/// <summary>
/// خروجی اعتبارسنجی پیش‌نیازهای سند اختتامیه
/// </summary>
public class SanadClosingValidateDto
{
    public bool Ok { get; set; }
    public List<string> Issues { get; set; } = new();
    public int TotalSanads { get; set; }
    public int ConfirmedSanads { get; set; }
    public int PendingSanads { get; set; }
    public List<UnconfirmedSanadDto> UnconfirmedList { get; set; } = new();
    public bool AlreadyClosed { get; set; }
    public long? EndSanadNum { get; set; }
}

public class UnconfirmedSanadDto
{
    public long ParentSanadId { get; set; }
    public long NoSanad { get; set; }
    public long Vazeit { get; set; }
    public string? DateIn { get; set; }
    public string? OtherParentSharh { get; set; }
}