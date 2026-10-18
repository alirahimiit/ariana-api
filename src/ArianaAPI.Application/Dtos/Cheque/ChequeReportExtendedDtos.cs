using System.Collections.Generic;

namespace ArianaAPI.Application.DTOs.Cheque;

// ═══════════════════════════════════════════════════════
//  گزارش‌های تفصیلی چک — جلسه ۵۰
//    • گزارش چک‌های برگشتی (Pay + Receive با ChequeOK=2)
//    • کاردکس چک (تاریخچه کامل یک چک)
// ═══════════════════════════════════════════════════════

// ─── فیلتر مشترک ───
public class ReturnedChequeFilterDto
{
    /// <summary>نوع چک — null=همه، 0=پرداختی، 1=دریافتی</summary>
    public int? ChequeType { get; set; }

    // تاریخ رسید
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }

    // تاریخ چک
    public string? CheckFromDate { get; set; }
    public string? CheckToDate { get; set; }

    // تاریخ برگشت
    public string? ReturnFromDate { get; set; }
    public string? ReturnToDate { get; set; }

    // شماره سریال چک
    public string? CheckFromSerial { get; set; }
    public string? CheckToSerial { get; set; }

    // شماره رسید
    public int? FromNumber { get; set; }
    public int? ToNumber { get; set; }

    // شرح
    public string? Descript { get; set; }

    // بانک — برای Pay از BankAccId، برای Receive از BankId (پارامتر جدا)
    public long? BankAccId { get; set; }   // فقط Pay
    public long? BankId { get; set; }      // فقط Receive

    // طرف حساب
    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }

    // Sort + Paging
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
}

// ─── ردیف گزارش برگشتی ───
public class ReturnedChequeListDto
{
    public long Id { get; set; }
    /// <summary>0=پرداختی، 1=دریافتی</summary>
    public int ChequeType { get; set; }
    public string ChequeTypeLabel { get; set; } = "";   // «پرداختی» / «دریافتی»

    // بانک
    public string BankName { get; set; } = "";
    public string BankShobe { get; set; } = "";
    public string BankNoHesab { get; set; } = "";

    // چک
    public string CheckSeries { get; set; } = "";
    public decimal CheckMab { get; set; }
    public string CheckDate { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    // رسید
    public int ResidNumber { get; set; }
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    // وضعیت
    public string OkDate { get; set; } = "";
    public string ReturnDate { get; set; } = "";        // UnOkDate

    // طرف حساب
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string ColName { get; set; } = "";
    public string MoeinName { get; set; } = "";
    public string TafzilName { get; set; } = "";
    public string HesabName { get; set; } = "";         // محاسبه‌شده

    // سند ایجاد
    public long ParentSanadId { get; set; }
    public int NoSanad { get; set; }
    public int SanadVazeit { get; set; }

    // سند برگشت
    public long ReturnParentSanadId { get; set; }
    public int ReturnNoSanad { get; set; }
}

public class ReturnedChequeListResultDto
{
    public List<ReturnedChequeListDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

// ─── خلاصه گزارش برگشتی ───
public class ReturnedChequeSummaryDto
{
    public int TotalCount { get; set; }
    public decimal TotalAmount { get; set; }

    public int PayCount { get; set; }
    public decimal PayAmount { get; set; }

    public int ReceiveCount { get; set; }
    public decimal ReceiveAmount { get; set; }

    /// <summary>گروه‌بندی بر اساس بانک</summary>
    public List<ReturnedChequeBankGroupDto> ByBank { get; set; } = new();
}

public class ReturnedChequeBankGroupDto
{
    public string BankName { get; set; } = "";
    public int Count { get; set; }
    public decimal Amount { get; set; }
}

// ═══════════════════════════════════════════════════════
//  کاردکس چک
// ═══════════════════════════════════════════════════════

public class ChequeKardexRequestDto
{
    /// <summary>0=پرداختی (CheckPay)، 1=دریافتی (CheckRecive)</summary>
    public int ChequeType { get; set; }
    public long ChequeId { get; set; }
}

public class ChequeKardexDto
{
    // Header
    public int ChequeType { get; set; }
    public long ChequeId { get; set; }
    public string CheckSeries { get; set; } = "";
    public decimal CheckMab { get; set; }
    public string CheckDate { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    public string BankName { get; set; } = "";
    public string BankShobe { get; set; } = "";
    public string BankNoHesab { get; set; } = "";

    /// <summary>0=در جریان، 1=وصول‌شده، 2=برگشتی</summary>
    public int CurrentStatus { get; set; }
    public string CurrentStatusLabel { get; set; } = "";

    /// <summary>فقط برای Receive: 0=آزاد، 1=خرج‌شده، 2=در جریان خرج</summary>
    public int WasExpended { get; set; }

    public int ResidNumber { get; set; }
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    // طرف حساب
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string ColName { get; set; } = "";
    public string MoeinName { get; set; } = "";
    public string TafzilName { get; set; } = "";
    public string HesabName { get; set; } = "";

    // Timeline
    public List<KardexEventDto> Events { get; set; } = new();
}

public class KardexEventDto
{
    /// <summary>create | ok | unok | return | expend</summary>
    public string EventType { get; set; } = "";
    public string EventLabel { get; set; } = "";   // «صدور» / «وصول» / «برگشت» / «خرج چک»
    public string EventIcon { get; set; } = "";    // emoji

    public string EventDate { get; set; } = "";    // از ParentSanad.Date_IN
    public string EventSharh { get; set; } = "";   // OtherParentSharh

    public long ParentSanadId { get; set; }
    public int NoSanad { get; set; }
    public int SanadVazeit { get; set; }

    public decimal TotalBed { get; set; }
    public decimal TotalBes { get; set; }

    public List<KardexRowDto> Rows { get; set; } = new();
}

public class KardexRowDto
{
    public int RowNum { get; set; }
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string ColName { get; set; } = "";
    public string MoeinName { get; set; } = "";
    public string TafzilName { get; set; } = "";
    public string HesabName { get; set; } = "";
    public string Sharh { get; set; } = "";
    public decimal MabBed { get; set; }
    public decimal MabBes { get; set; }
}