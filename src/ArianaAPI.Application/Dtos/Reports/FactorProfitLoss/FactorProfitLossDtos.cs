namespace ArianaAPI.Application.Dtos.Reports.FactorProfitLoss;

// ═══════════════════════════════════════════════════
//  درخواست
// ═══════════════════════════════════════════════════
public class FactorProfitLossRequestDto
{
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public long? ArticleId { get; set; }
    public long? NoFrom { get; set; }
    public long? NoTo { get; set; }

    /// <summary>date | profit | profitPct | amount</summary>
    public string OrderBy { get; set; } = "date";

    /// <summary>0=همه | 1=فقط سود | 2=فقط زیان</summary>
    public int ProfitFilter { get; set; } = 0;

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

// ═══════════════════════════════════════════════════
//  یک ردیف
// ═══════════════════════════════════════════════════
public class FactorProfitLossItemDto
{
    public long FactorId { get; set; }
    public long? NoFactor { get; set; }
    public string? DateIn { get; set; }
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public int ItemCount { get; set; }

    // ─── فروش ───
    public decimal SaleAmount { get; set; }      // بعد از تخفیف، بدون مالیات
    public decimal SaleDiscount { get; set; }
    public decimal SaleTax { get; set; }         // مالیات و عوارض
    public decimal SaleWithTax { get; set; }     // مبلغ نهایی

    // ─── بهای تمام‌شده ───
    public decimal CostAmount { get; set; }

    // ─── سود ───
    public decimal Profit { get; set; }
    public decimal ProfitPct { get; set; }

    // ─── سند ───
    public long? NoSanad { get; set; }
}

// ═══════════════════════════════════════════════════
//  نتیجه کامل
// ═══════════════════════════════════════════════════
public class FactorProfitLossResultDto
{
    public List<FactorProfitLossItemDto> Items { get; set; } = new();

    // ─── صفحه‌بندی ───
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }

    // ─── جمع‌های کلی (از ALL) ───
    public decimal TotalSaleAmount { get; set; }
    public decimal TotalSaleDiscount { get; set; }
    public decimal TotalSaleTax { get; set; }
    public decimal TotalSaleWithTax { get; set; }
    public decimal TotalCostAmount { get; set; }
    public decimal TotalProfit { get; set; }
    public decimal TotalProfitPct { get; set; }

    public int ProfitCount { get; set; }
    public int LossCount { get; set; }
}