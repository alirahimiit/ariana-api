namespace ArianaAPI.Application.Dtos.Reports.Kardex;

// ═══════════════════════════════════════════════════
//  درخواست کاردکس
// ═══════════════════════════════════════════════════
public class KardexRequestDto
{
    /// <summary>شناسه کالا (اجباری)</summary>
    public long? ArticleId { get; set; }

    /// <summary>تاریخ شروع (شمسی) - اختیاری</summary>
    public string? DateFrom { get; set; }

    /// <summary>تاریخ پایان (شمسی) - اختیاری</summary>
    public string? DateTo { get; set; }

    /// <summary>فیلتر انبار - اختیاری</summary>
    public long? StockId { get; set; }

    /// <summary>شامل پیش‌فاکتورها</summary>
    public bool IncludePreFactor { get; set; } = false;

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;

}

// ═══════════════════════════════════════════════════
//  یک ردیف کاردکس
// ═══════════════════════════════════════════════════
public class KardexItemDto
{
    public int RowNum { get; set; }
    public string? Date { get; set; }
    public string? Time { get; set; }

    /// <summary>نوع سند: فاکتور خرید / فروش / رسید / حواله / موجودی اولیه</summary>
    public string? DocType { get; set; }
    public long? DocNo { get; set; }

    /// <summary>شماره سند حسابداری</summary>
    public long? SanadNo { get; set; }

    /// <summary>شرح</summary>
    public string? Descript { get; set; }

    /// <summary>طرف حساب / انبار</summary>
    public string? HesabName { get; set; }

    // ─── مقدار ───
    public decimal InQty { get; set; }
    public decimal OutQty { get; set; }
    public decimal Balance { get; set; }

    // ─── ارزش ───
    public decimal UnitCost { get; set; }
    public decimal InValue { get; set; }
    public decimal OutValue { get; set; }
    public decimal BalanceValue { get; set; }

    // ═══ کمکی ═══
    public int SortKind { get; set; }    // 1=موجودی اولیه، 2=فاکتور، 3=رسید/حواله
    public long SortId { get; set; }
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }
}

// ═══════════════════════════════════════════════════
//  نتیجه کامل
// ═══════════════════════════════════════════════════
public class KardexResultDto
{
    // ─── اطلاعات کالا ───
    public long ArticleId { get; set; }
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }
    public string? ArticleUnitName { get; set; }
    public string? ArticleGroupName { get; set; }
    public string? StockTypeName { get; set; }

    // ─── خلاصه ───
    public decimal AmountFirst { get; set; }
    public decimal CostFirst { get; set; }
    public decimal TotalInQty { get; set; }
    public decimal TotalOutQty { get; set; }
    public decimal FinalQty { get; set; }
    public decimal FinalValue { get; set; }
    public decimal AvgUnitCost { get; set; }

    // ─── ردیف‌ها ───
    public List<KardexItemDto> Items { get; set; } = new();

    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}