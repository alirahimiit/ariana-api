namespace ArianaAPI.Domain.Entities.Moadian;

/// <summary>
/// جدول tax_header — سر فاکتور مالیاتی
/// </summary>
public class TaxHeader
{
    public long Id { get; set; }

    /// <summary>وضعیت: 0=ارسال نشده، 1=ارسال شده، 2=خطا، 3=موفق</summary>
    public int Status { get; set; }

    public string? TaxId { get; set; }
    public long CustomerCode { get; set; }
    public long? FactorId { get; set; }

    // ─── تاریخ‌ها ───
    public long? Indatim { get; set; }
    public DateTime? IndatimDatetime { get; set; }
    public string? IndatimPersian { get; set; }

    public long? Indati2m { get; set; }
    public DateTime? Indati2mDatetime { get; set; }
    public string? Indati2mPersian { get; set; }

    // ─── انواع ───
    public int? Inty { get; set; }          // نوع صورتحساب (1-3)
    public string? Inno { get; set; }        // شماره سریال داخلی
    public string? IrTaxId { get; set; }
    public int? Inp { get; set; }           // الگو
    public int? Ins { get; set; }           // 1=اصلی، 2=اصلاحی، 3=ابطالی، 4=برگشت

    // ─── اطلاعات تکمیلی ───
    public int? Ft { get; set; }
    public string? Scln { get; set; }
    public string? Scc { get; set; }
    public string? Cdcn { get; set; }
    public long? Cdcd { get; set; }
    public string? Crn { get; set; }
    public string? BillId { get; set; }
    public string? Bbc { get; set; }
    public string? Bpc { get; set; }
    public string? Sbc { get; set; }
    public string? Bpn { get; set; }

    // ─── جمع‌ها ───
    public decimal? Tprdis { get; set; }
    public long? Tdis { get; set; }
    public long? Tadis { get; set; }
    public long? Tvam { get; set; }
    public long? Todam { get; set; }
    public decimal? Tbill { get; set; }
    public double? Tonw { get; set; }
    public long? Torv { get; set; }
    public long? Tocv { get; set; }

    // ─── پرداخت ───
    public int Setm { get; set; }           // 1=نقد، 2=نسیه، 3=هردو
    public long? Cap { get; set; }
    public long? Insp { get; set; }
    public long? Tvop { get; set; }
    public long? Tax17 { get; set; }

    // ─── ارسال ───
    public string? Uid { get; set; }
    public string? RefNumber { get; set; }
    public string? AcceptRefNumber { get; set; }
    public string? TaxStatus { get; set; }
}