namespace ArianaAPI.Application.DTOs.Factor;

// ═══════════════════════════════════════════
//  Input DTOs — برای Create/Update
// ═══════════════════════════════════════════

/// <summary>
/// ورودی برای ایجاد/ویرایش هدر فاکتور
/// </summary>
public class FactorWriteDto
{
    // ─── هدر ───
    public long? NoFactor { get; set; }              // اگه null → سرور MAX+1
    public string? DateIn { get; set; }              // 1404/09/26
    public string? Descript { get; set; }
    public int FactorKind { get; set; }              // 0..9

    public int? IsCash { get; set; }                 // 1=نقدی، 2=غیرنقدی
    public long? CodeTafzil { get; set; }            // طرف حساب (تفضیلی سطح ۱)
    public long? CodeTafMarketer { get; set; }       // بازاریاب (اختیاری)

    public long? StockId { get; set; }               // انبار پیش‌فرض
    public decimal TransCost { get; set; }           // جمع هزینه حمل
    public string? CarInfo { get; set; }             // شماره ماشین

    // ─── پیش‌فاکتور ───
    public int? PerOk { get; set; }                  // تأیید پیش‌فاکتور (0/1)
    public long? NoFactorPer { get; set; }           // شماره پیش‌فاکتور مرجع

    // ─── جمع (سرور خودش هم می‌تونه محاسبه کنه) ───
    public decimal Cost { get; set; }                // جمع FinallCost همه ردیف‌ها

    // ─── ردیف‌ها ───
    public List<FactorItemWriteDto> Items { get; set; } = new();
}

/// <summary>
/// ورودی برای هر ردیف کالا
/// </summary>
public class FactorItemWriteDto
{
    public long ArticleId { get; set; }

    // ─── مقدار ───
    public decimal ArticleCount { get; set; }        // مقدار اصلی (ثبت می‌شه)
    public decimal ArticleCount2 { get; set; }       // مقدار واحد ۲ (نمایشی)
    public decimal ArticleCount3 { get; set; }       // مقدار واحد ۳ (نمایشی)

    // ─── قیمت ───
    public decimal Cost { get; set; }                // قیمت واحد جاری (پس از تسهیم حمل)
    public decimal IncCost { get; set; }             // افزایش ناشی از تسهیم حمل

    // ─── تخفیف ───
    public decimal Discount { get; set; }            // مبلغ تخفیف (ریال)
    public decimal PerDiscount { get; set; }         // درصد تخفیف (0-100)

    // ─── مالیات ───
    public decimal TaxFi { get; set; }               // نرخ (مثلاً 9)
    public decimal Tax { get; set; }                 // مبلغ مالیات

    // ─── حمل (تسهیم‌شده برای این ردیف) ───
    public decimal TransCost { get; set; }

    // ─── جمع‌ها ───
    public decimal CostItem { get; set; }            // Cost × ArticleCount
    public decimal CostTax { get; set; }             // CostItem - Discount
    public decimal FinallCost { get; set; }          // CostTax + Tax

    // ─── بازاریاب (فقط placeholder) ───
    public decimal MarketerPercent { get; set; }
    public decimal MarketerCosts { get; set; }

    // ─── انبار و مشخصات ───
    public long? StockId { get; set; }
    public decimal DegreeKala { get; set; }          // درجه کالا
    public decimal DropKala { get; set; }            // افت کالا
}

// ═══════════════════════════════════════════
//  Result DTOs
// ═══════════════════════════════════════════

public class FactorWriteResultDto
{
    public long Id { get; set; }
    public long NoFactor { get; set; }
}

public class FactorNextNoDto
{
    public long NoFactor { get; set; }
}

// ═══════════════════════════════════════════
//  Lookups
// ═══════════════════════════════════════════

public class FactorLookupsDto
{
    /// <summary>نرخ مالیات و عوارض از DorehMali (جمع)</summary>
    public decimal TaxFi { get; set; }

    /// <summary>نرخ مالیات خالص</summary>
    public decimal TaxPer { get; set; }

    /// <summary>نرخ عوارض خالص</summary>
    public decimal AvarezPer { get; set; }

    public string TodayDate { get; set; } = "";
    public int FiscalYear { get; set; }

    /// <summary>آیا محاسبه‌ی مانده‌حساب فعاله؟ (تنظیمات سراسری)</summary>
    public bool CalcMandehHesab { get; set; }

    /// <summary>آیا محاسبه‌ی درصد بازاریاب فعاله؟</summary>
    public bool CalcMarketerPercent { get; set; }

    /// <summary>آیا نمایش درجه/افت کالا فعاله؟</summary>
    public bool ShowInfoForosh { get; set; }

    /// <summary>آیا اجازه‌ی ثبت مقدار بیش از سفارش هست؟</summary>
    public bool NotControlVal { get; set; }
}

/// <summary>اطلاعات محاسباتی یک کالا برای ردیف فاکتور</summary>
public class FactorArticleCalcDto
{
    public long ArticleId { get; set; }

    // ─── واحدها ───
    public string? UnitName { get; set; }
    public string? UnitName2 { get; set; }
    public string? UnitName3 { get; set; }
    public decimal Tabdil2 { get; set; }
    public decimal Tabdil3 { get; set; }

    // ─── قیمت‌های پیشنهادی ───
    public decimal? AmountSale { get; set; }         // قیمت فروش پیش‌فرض
    public decimal? AmountFirst { get; set; }        // بهای اولیه
    public decimal? LastBuyCost { get; set; }        // آخرین قیمت خرید (میانگین)
    public decimal? LastSaleCost { get; set; }       // آخرین قیمت فروش (میانگین)

    // ─── انبار ───
    public long? StockTypeId { get; set; }
    public string? StockTypeName { get; set; }
    public decimal? FinallExistence { get; set; }    // موجودی فعلی

    // ─── تنظیمات کالا ───
    public decimal MarketerPercent { get; set; }
    public bool XIsRegNegativKala { get; set; }      // کنترل موجودی منفی
    public bool XIsRegMinOrderToIn { get; set; }     // کنترل حد سفارش ورود
    public bool XIsRegMaxOrderToOut { get; set; }    // کنترل حد سفارش خروج
    public decimal? MaxCostOrderBy { get; set; }
    public decimal? MinCostOrderBy { get; set; }

    // ─── وضعیت ───
    public bool CalcPerDiscount { get; set; }        // آیا درصد تخفیف محاسبه بشه؟
}