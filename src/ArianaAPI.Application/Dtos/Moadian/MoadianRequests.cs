namespace ArianaAPI.Application.Dtos.Moadian;

// ═══════════════════════════════════════════════════════════
//  Settings
// ═══════════════════════════════════════════════════════════
public class MoadianSettingsDto
{
    public string? TaxUserName { get; set; }
    public string? PrivateKey { get; set; }
    public string? CodeEgtesadi { get; set; }
    public bool IsSandbox { get; set; } = true;
    public bool Invoice { get; set; } = true;
    public bool Customer { get; set; } = true;
    public bool Stuff { get; set; } = true;
}

// ═══════════════════════════════════════════════════════════
//  ساخت فاکتور مالیاتی از فاکتور
// ═══════════════════════════════════════════════════════════
public class CreateFromFactorRequest
{
    /// <summary>ID فاکتور در FactorParent</summary>
    public long FactorId { get; set; }
    public int Inty { get; set; } = 1;
}

// ═══════════════════════════════════════════════════════════
//  ارسال تک
// ═══════════════════════════════════════════════════════════
public class SendInvoiceRequest
{
    /// <summary>ID در tax_header</summary>
    public long HeaderId { get; set; }

    /// <summary>اختیاری: شماره سند پیش‌فرض (0 = خودکار)</summary>
    public long? Inno { get; set; }
}

// ═══════════════════════════════════════════════════════════
//  ارسال گروهی
// ═══════════════════════════════════════════════════════════
public class SendBulkRequest
{
    /// <summary>لیست HeaderId ها</summary>
    public List<long> HeaderIds { get; set; } = new();
}

// ═══════════════════════════════════════════════════════════
//  استعلام
// ═══════════════════════════════════════════════════════════
public class InquiryRequest
{
    public long HeaderId { get; set; }
}