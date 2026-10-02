namespace ArianaAPI.Domain.Entities.Moadian;

/// <summary>
/// جدول tax_body — ردیف‌های فاکتور مالیاتی
/// </summary>
public class TaxBody
{
    public long Id { get; set; }
    public long HeaderId { get; set; }

    /// <summary>شناسه کالا (ArticleNew.ID)</summary>
    public long StuffId { get; set; }

    /// <summary>شناسه واحد (ArticleUnit.ID)</summary>
    public long UnitId { get; set; }

    // ─── از ArticleNew/Unit (JOIN) ───
    public string? Sstt { get; set; }       // شرح کالا
    public string? Sstid { get; set; }      // شناسه یکتای کالا
    public string? Mu { get; set; }         // واحد اندازه‌گیری

    // ─── از FactorDetail ───
    public double Am { get; set; }          // تعداد
    public long? Fee { get; set; }          // مبلغ واحد
    public decimal? Prdis { get; set; }     // قبل از تخفیف
    public long? Dis { get; set; }          // تخفیف
    public long? Adis { get; set; }         // بعد از تخفیف
    public long? Vra { get; set; }          // نرخ VAT
    public long? Vam { get; set; }          // مبلغ VAT
    public long? Odr { get; set; }
    public long? Odam { get; set; }
    public decimal? Tsstam { get; set; }    // مبلغ کل کالا
    public double? Nw { get; set; }         // وزن خالص

    // ─── فیلدهای اضافی ───
    public long? Cfee { get; set; }
    public string? Cut { get; set; }
    public long? Exr { get; set; }
    public long? Ssrv { get; set; }
    public long? Sscv { get; set; }
    public string? Odt { get; set; }
    public string? Olt { get; set; }
    public long? Olr { get; set; }
    public long? Olam { get; set; }
    public long? Consfee { get; set; }
    public long? Spro { get; set; }
    public long? Bros { get; set; }
    public long? Tcpbs { get; set; }
    public long? Cop { get; set; }
    public long? Vop { get; set; }
    public string? Bsrn { get; set; }
}