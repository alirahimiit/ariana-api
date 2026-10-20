namespace ArianaAPI.Application.DTOs.Sanad;

public class SanadClosingRequestDto
{
    public long OrgId { get; set; }
    public long FyId { get; set; }

    // ⭐ کدینگ حساب اختتامیه (مثلاً سود و زیان انباشته)
    public long ClosingCodeCol { get; set; }
    public long ClosingCodeMoein { get; set; }
    public long ClosingCodeTafzil { get; set; }
}