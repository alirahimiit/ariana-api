using Newtonsoft.Json;

namespace ArianaAPI.Infrastructure.Services.Moadian;

// ═════════════════════════════════════════════════════════════
//  BASE
// ═════════════════════════════════════════════════════════════

public class MoadianBaseResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
}

// ═════════════════════════════════════════════════════════════
//  SERVER INFO
// ═════════════════════════════════════════════════════════════
public class MoadianServerInfoResponse : MoadianBaseResponse
{
    public string? ServerTime { get; set; }
    public string? PublicKey { get; set; }
    public string? PublicKeyId { get; set; }
    public string? PublicKeyAlgorithm { get; set; }
    public string? PublicKeyPurpose { get; set; }
}

// ═════════════════════════════════════════════════════════════
//  TOKEN
// ═════════════════════════════════════════════════════════════
public class MoadianTokenResponse : MoadianBaseResponse
{
    public string? Token { get; set; }
    public long ExpiresIn { get; set; }
}

// ═════════════════════════════════════════════════════════════
//  FISCAL INFO
// ═════════════════════════════════════════════════════════════
public class MoadianFiscalInfoResponse : MoadianBaseResponse
{
    public string? NameTrade { get; set; }
    public string? FiscalStatus { get; set; }
    public double? SaleThreshold { get; set; }
    public string? EconomicCode { get; set; }
}

// ═════════════════════════════════════════════════════════════
//  SERVICE STUFF
// ═════════════════════════════════════════════════════════════
public class MoadianServiceStuffModel
{
    public long ItemId { get; set; }
    public double Tax { get; set; }
}

public class MoadianServiceStuffListResponse : MoadianBaseResponse
{
    public List<MoadianServiceStuffModel> Result { get; set; } = new();
}

// ═════════════════════════════════════════════════════════════
//  ECONOMIC CODE INFO
// ═════════════════════════════════════════════════════════════
public class MoadianEconomicCodeInfoResponse : MoadianBaseResponse
{
    public string? NameTrade { get; set; }
    public string? TaxpayerStatus { get; set; }
    public string? TaxpayerType { get; set; }
    public string? PostalCodeTaxpayer { get; set; }
    public string? AddressTaxpayer { get; set; }
}

// ═════════════════════════════════════════════════════════════
//  INQUIRY
// ═════════════════════════════════════════════════════════════
public class MoadianInquiryDataModel
{
    public string? Msg { get; set; }
    public string? Code { get; set; }
}

public class MoadianInquiryModel
{
    public string? ConfirmationReferenceId { get; set; }
    public string? TaxResult { get; set; }
    public string? Uid { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Status { get; set; }
    public List<MoadianInquiryDataModel> Errors { get; set; } = new();
    public List<MoadianInquiryDataModel> Warnings { get; set; } = new();
    public string? PacketType { get; set; }
    public string? FiscalId { get; set; }
}

public class MoadianInquiryResponse : MoadianBaseResponse
{
    public List<MoadianInquiryModel> Result { get; set; } = new();
}

public class MoadianUidModel
{
    public string Uid { get; set; } = "";
    public string FiscalId { get; set; } = "";
}

// ═════════════════════════════════════════════════════════════
//  ENQUEUE (ارسال)
// ═════════════════════════════════════════════════════════════
public class MoadianEnqueueResponse : MoadianBaseResponse
{
    public string? ReferenceNumber { get; set; }
    public string? Uid { get; set; }
}

// ═════════════════════════════════════════════════════════════
//  فاکتور — Header / Body / Payment / Extension
// ═════════════════════════════════════════════════════════════

/// <summary>سر فاکتور — دقیقاً مطابق ساختار JSON مودیان</summary>
public class MoadianInvoiceHeader
{
    [JsonProperty("taxid")] public string? TaxId { get; set; }        // شماره منحصر بفرد مالیاتی
    [JsonProperty("indatim")] public long? Indatim { get; set; }        // تاریخ میلادی (timestamp)
    [JsonProperty("inty")] public int? Inty { get; set; }            // نوع (1=اول، 2=دوم، 3=سوم)
    [JsonProperty("inno")] public string? Inno { get; set; }         // شماره سریال داخلی
    [JsonProperty("irtaxid")] public string? IrTaxId { get; set; }      // شماره مالیاتی مرجع
    [JsonProperty("inp")] public int? Inp { get; set; }             // الگو (1=فروش، 2=فروش ارزی...)
    [JsonProperty("ins")] public int? Ins { get; set; }             // 1=اصلی، 2=اصلاحی، 3=ابطالی، 4=برگشت
    [JsonProperty("tins")] public string? Tins { get; set; }         // شماره اقتصادی فروشنده
    [JsonProperty("tob")] public int? Tob { get; set; }             // نوع خریدار
    [JsonProperty("bid")] public string? Bid { get; set; }          // شناسه ملی
    [JsonProperty("tinb")] public string? Tinb { get; set; }         // شماره اقتصادی خریدار
    [JsonProperty("sbc")] public string? Sbc { get; set; }          // کد شعبه فروشنده
    [JsonProperty("bpc")] public string? Bpc { get; set; }          // کد پستی خریدار
    [JsonProperty("bbc")] public string? Bbc { get; set; }          // کد شعبه خریدار
    [JsonProperty("ft")] public int? Ft { get; set; }              // نوع پرواز
    [JsonProperty("bpn")] public string? Bpn { get; set; }          // شماره پاسپورت
    [JsonProperty("scln")] public string? Scln { get; set; }         // پروانه گمرکی
    [JsonProperty("scc")] public string? Scc { get; set; }          // کد گمرک
    [JsonProperty("cdcn")] public string? Cdcn { get; set; }         // شماره کوتاژ
    [JsonProperty("cdcd")] public long? Cdcd { get; set; }           // تاریخ کوتاژ
    [JsonProperty("crn")] public string? Crn { get; set; }          // شناسه قرارداد
    [JsonProperty("billid")] public string? BillId { get; set; }       // شناسه قبض
    [JsonProperty("tprdis")] public long? Tprdis { get; set; }         // جمع قبل از تخفیف
    [JsonProperty("tdis")] public long? Tdis { get; set; }           // جمع تخفیف
    [JsonProperty("tadis")] public long? Tadis { get; set; }          // جمع بعد از تخفیف
    [JsonProperty("tvam")] public long? Tvam { get; set; }           // جمع مالیات
    [JsonProperty("todam")] public long? Todam { get; set; }          // جمع سایر مالیات
    [JsonProperty("tbill")] public long? Tbill { get; set; }          // مجموع صورتحساب
    [JsonProperty("tonw")] public double? Tonw { get; set; }         // وزن خالص
    [JsonProperty("torv")] public long? Torv { get; set; }           // ارزش ریالی
    [JsonProperty("tocv")] public long? Tocv { get; set; }           // ارزش ارزی
    [JsonProperty("setm")] public int? Setm { get; set; }            // روش تسویه
    [JsonProperty("cap")] public long? Cap { get; set; }            // مبلغ نقدی
    [JsonProperty("insp")] public long? Insp { get; set; }           // مبلغ نسیه
    [JsonProperty("tvop")] public long? Tvop { get; set; }           // سهم VAT
    [JsonProperty("tax17")] public long? Tax17 { get; set; }          // مالیات ماده ۱۷
}

/// <summary>ردیف فاکتور</summary>
public class MoadianInvoiceBody
{
    [JsonProperty("sstid")] public string? Sstid { get; set; }        // شناسه کالا/خدمت
    [JsonProperty("sstt")] public string? Sstt { get; set; }         // شرح کالا
    [JsonProperty("am")] public double Am { get; set; }            // تعداد
    [JsonProperty("mu")] public string? Mu { get; set; }           // واحد اندازه‌گیری
    [JsonProperty("nw")] public double? Nw { get; set; }           // وزن خالص
    [JsonProperty("fee")] public long? Fee { get; set; }            // مبلغ واحد
    [JsonProperty("cfee")] public long? Cfee { get; set; }           // مبلغ ارزی
    [JsonProperty("cut")] public string? Cut { get; set; }          // نوع ارز
    [JsonProperty("exr")] public long? Exr { get; set; }            // نرخ ارز
    [JsonProperty("ssrv")] public long? Ssrv { get; set; }           // ارزش ریالی
    [JsonProperty("sscv")] public long? Sscv { get; set; }           // ارزش ارزی
    [JsonProperty("prdis")] public long? Prdis { get; set; }          // قبل از تخفیف
    [JsonProperty("dis")] public long? Dis { get; set; }            // تخفیف
    [JsonProperty("adis")] public long? Adis { get; set; }           // بعد از تخفیف
    [JsonProperty("vra")] public long? Vra { get; set; }            // نرخ VAT
    [JsonProperty("vam")] public long? Vam { get; set; }            // مبلغ VAT
    [JsonProperty("odt")] public string? Odt { get; set; }          // موضوع سایر مالیات
    [JsonProperty("odr")] public long? Odr { get; set; }
    [JsonProperty("odam")] public long? Odam { get; set; }
    [JsonProperty("olt")] public string? Olt { get; set; }
    [JsonProperty("olr")] public long? Olr { get; set; }
    [JsonProperty("olam")] public long? Olam { get; set; }
    [JsonProperty("consfee")] public long? Consfee { get; set; }        // اجرت ساخت
    [JsonProperty("spro")] public long? Spro { get; set; }           // سود فروش
    [JsonProperty("bros")] public long? Bros { get; set; }           // حق‌العمل
    [JsonProperty("tcpbs")] public long? Tcpbs { get; set; }          // جمع کل
    [JsonProperty("cop")] public long? Cop { get; set; }            // سهم نقدی
    [JsonProperty("vop")] public long? Vop { get; set; }            // سهم VAT
    [JsonProperty("bsrn")] public string? Bsrn { get; set; }         // شناسه حق‌العمل
    [JsonProperty("tsstam")] public long? Tsstam { get; set; }         // مبلغ کل کالا
}

/// <summary>پرداخت</summary>
public class MoadianInvoicePayment
{
    [JsonProperty("iinn")] public string? Iinn { get; set; }
    [JsonProperty("acn")] public string? Acn { get; set; }
    [JsonProperty("trmn")] public string? Trmn { get; set; }
    [JsonProperty("pmt")] public long? Pmt { get; set; }
    [JsonProperty("trn")] public string? Trn { get; set; }
    [JsonProperty("pcn")] public string? Pcn { get; set; }
    [JsonProperty("pid")] public string? Pid { get; set; }
    [JsonProperty("pdt")] public long? Pdt { get; set; }
    [JsonProperty("pv")] public long? Pv { get; set; }
}

/// <summary>اطلاعات اضافی</summary>
public class MoadianInvoiceExtension
{
    [JsonProperty("key")] public string? Key { get; set; }
    [JsonProperty("value")] public string? Value { get; set; }
}

/// <summary>فاکتور کامل</summary>
public class MoadianInvoice
{
    [JsonProperty("header")] public MoadianInvoiceHeader Header { get; set; } = new();
    [JsonProperty("body")] public List<MoadianInvoiceBody> Body { get; set; } = new();
    [JsonProperty("payments")] public List<MoadianInvoicePayment> Payments { get; set; } = new();
    [JsonProperty("extension")] public List<MoadianInvoiceExtension> Extension { get; set; } = new();
}

/// <summary>فاکتور پیچیده (برای ارسال گروهی)</summary>
public class MoadianComplexInvoice
{
    public MoadianInvoice Invoice { get; set; } = new();
    public string Uid { get; set; } = "";
}