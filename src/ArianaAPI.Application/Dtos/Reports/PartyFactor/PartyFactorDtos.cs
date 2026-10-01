namespace ArianaAPI.Application.Dtos.Reports.PartyFactor;

// ═══════════════════════════════════════════════════
//  درخواست
// ═══════════════════════════════════════════════════
public class PartyFactorRequestDto
{
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public int? FactorKind { get; set; }
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public long? NoFrom { get; set; }
    public long? NoTo { get; set; }
    public string? Descript { get; set; }
    public bool? OnlyWithoutSanad { get; set; }
    public string OrderBy { get; set; } = "date";

    // ⭐ حالت نمایش
    /// <summary>flat | grouped</summary>
    public string ViewMode { get; set; } = "flat";

    /// <summary>article | party (فقط در حالت grouped)</summary>
    public string GroupBy { get; set; } = "article";

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

// ═══════════════════════════════════════════════════
//  ردیف فاکتور (حالت flat)
// ═══════════════════════════════════════════════════
public class PartyFactorItemDto
{
    public long FactorId { get; set; }
    public long? NoFactor { get; set; }
    public string? DateIn { get; set; }
    public int FactorKind { get; set; }
    public string? FactorKindTitle { get; set; }
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public string? Descript { get; set; }
    public decimal TotalCostItem { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalTax { get; set; }
    public decimal TotalTransCost { get; set; }
    public decimal FinalAmount { get; set; }
    public int ItemCount { get; set; }
    public long? NoSanad { get; set; }
    public string? DateSanad { get; set; }
    public int? IsCash { get; set; }
    public string? IsCashName { get; set; }
    public string? MarkerName { get; set; }
}

// ═══════════════════════════════════════════════════
//  ردیف گروه‌بندی‌شده (طرف × کالا)
// ═══════════════════════════════════════════════════
public class PartyArticleItemDto
{
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public long ArticleId { get; set; }
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }
    public string? ArticleUnitName { get; set; }

    public decimal BuyQty { get; set; }
    public decimal BuyAmount { get; set; }

    public decimal SellQty { get; set; }
    public decimal SellAmount { get; set; }

    public decimal BackBuyQty { get; set; }
    public decimal BackBuyAmount { get; set; }

    public decimal BackSellQty { get; set; }
    public decimal BackSellAmount { get; set; }

    public decimal NetQty { get; set; }
    public decimal NetAmount { get; set; }
}

// ═══════════════════════════════════════════════════
//  نتیجه
// ═══════════════════════════════════════════════════
public class PartyFactorResultDto
{
    // ─── اطلاعات طرف حساب ───
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? NationalCode { get; set; }
    public string? EconomicCode { get; set; }
    public string? Address { get; set; }

    // ─── حالت Flat ───
    public List<PartyFactorItemDto> Items { get; set; } = new();

    // ─── حالت Grouped ───
    public List<PartyArticleItemDto> ArticleItems { get; set; } = new();

    // ─── صفحه‌بندی ───
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }

    // ─── جمع‌ها ───
    public int BuyCount { get; set; }
    public int SellCount { get; set; }
    public int BackBuyCount { get; set; }
    public int BackSellCount { get; set; }
    public decimal TotalBuyAmount { get; set; }
    public decimal TotalSellAmount { get; set; }
    public decimal TotalBackBuyAmount { get; set; }
    public decimal TotalBackSellAmount { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalTax { get; set; }
    public decimal TotalFinalAmount { get; set; }
}