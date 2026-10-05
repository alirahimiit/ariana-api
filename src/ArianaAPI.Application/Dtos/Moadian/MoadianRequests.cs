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
// ═══════════════════════════════════════════════════════════
//  اصلاح/ابطال/برگشت
// ═══════════════════════════════════════════════════════════
public class CorrectHeaderRequest
{
    /// <summary>cancel | return | amend</summary>
    public string Mode { get; set; } = "cancel";
}

// ═══════════════════════════════════════════════════════════
//  برگشت / اصلاحی با اقلام
// ═══════════════════════════════════════════════════════════
public class CorrectItemsRequest
{
    /// <summary>return | amend</summary>
    public string Mode { get; set; } = "return";

    /// <summary>تاریخ جدید (شمسی) — پیش‌فرض امروز</summary>
    public string? IndatimPersian { get; set; }

    /// <summary>روش تسویه (1=نقدی، 2=نسیه، 3=هردو)</summary>
    public int? Setm { get; set; }

    /// <summary>اقلام باقی‌مونده/اصلاح‌شده</summary>
    public List<CorrectItemInput> Items { get; set; } = new();
}

public class CorrectItemInput
{
    public long StuffId { get; set; }
    public long UnitId { get; set; }
    public double Am { get; set; }
    public long Fee { get; set; }
    public long Dis { get; set; }
    public long Vra { get; set; }
}

// ═══════════════════════════════════════════════════════════
//  جستجوی کالا (برای Picker)
// ═══════════════════════════════════════════════════════════
public class ArticleSearchItem
{
    public long Id { get; set; }
    public string? Name { get; set; }
    public string? TaxId { get; set; }
    public long? UnitId { get; set; }
    public string? UnitTaxId { get; set; }
    public string? UnitName { get; set; }
    public long Fee { get; set; }
    public long Vra { get; set; }
}