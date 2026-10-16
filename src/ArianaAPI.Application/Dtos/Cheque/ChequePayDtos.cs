using System.Collections.Generic;

namespace ArianaAPI.Application.DTOs.Cheque;

// ═══════════════════════════════════════════════════════
//  چک پرداختی — DTOها
//  معادل دلفی: TChequePayRec + TChequePayListForm
// ═══════════════════════════════════════════════════════

/// <summary>ردیف لیست چک پرداختی</summary>
public class ChequePayListDto
{
    public long Id { get; set; }

    // ─── بانک ───
    public long BankAccId { get; set; }
    public string BankName { get; set; } = "";
    public string BankShobe { get; set; } = "";
    public string BankNoHesab { get; set; } = "";

    // ─── مشخصات چک ───
    public string CheckSeries { get; set; } = "";
    public decimal CheckMab { get; set; }
    public string CheckDate { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    // ─── رسید ───
    public int ResidNumber { get; set; }
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    // ─── وضعیت ───
    /// <summary>0=درجریان، 1=OK، 2=برگشتی</summary>
    public int ChequeOK { get; set; }
    public int CheckState { get; set; }
    public string OkDate { get; set; } = "";

    // ─── حساب طرف (دریافت‌کننده) ───
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string ColName { get; set; } = "";
    public string MoeinName { get; set; } = "";
    public string TafzilName { get; set; } = "";

    // ─── سند ───
    public long ParentSanadId { get; set; }
    public int NoSanad { get; set; }
    /// <summary>-1=بدون سند، 0=پیش‌نویس، 1=...، 2=قطعی</summary>
    public int SanadVazeit { get; set; }
}

public class ChequePayListResultDto
{
    public List<ChequePayListDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

/// <summary>فیلتر لیست چک پرداختی</summary>
public class ChequePayFilterDto
{
    // شماره رسید
    public int? FromNumber { get; set; }
    public int? ToNumber { get; set; }

    // تاریخ رسید
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }

    // تاریخ چک
    public string? CheckFromDate { get; set; }
    public string? CheckToDate { get; set; }

    // شماره سریال چک
    public string? CheckFromSerial { get; set; }
    public string? CheckToSerial { get; set; }

    // شرح
    public string? Descript { get; set; }

    // بانک
    public long? BankAccId { get; set; }

    // طرف حساب
    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }

    // Sort
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }

    // Paging
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
}

/// <summary>جزئیات کامل چک پرداختی (برای فرم ویرایش)</summary>
public class ChequePayDetailDto : ChequePayListDto
{
    // ─── کدینگ بانک (حساب پرداخت) ───
    public int CodeColPay { get; set; }
    public int CodeMoeinPay { get; set; }
    public int CodeTafzilPay { get; set; }
    public string ColPayName { get; set; } = "";
    public string MoeinPayName { get; set; } = "";
    public string TafzilPayName { get; set; } = "";

    // ─── OK fields ───
    public int CodeColOk { get; set; }
    public int CodeMoeinOk { get; set; }
    public int CodeTafzilOk { get; set; }
    public int CodeColPayOk { get; set; }
    public int CodeMoeinPayOk { get; set; }
    public int CodeTafzilPayOk { get; set; }

    public long ParentSanadOkId { get; set; }
    public long SanadIdBed { get; set; }
    public long SanadIdBes { get; set; }
    public long SanadPersonId { get; set; }
    public long SanadId { get; set; }

    // ─── Return fields ───
    public string UnOkDate { get; set; } = "";
    public long UnOkParentSanadId { get; set; }
    public long UnOkSanadIdBed { get; set; }
    public long UnOkSanadIdBes { get; set; }

    // ─── متفرقه ───
    public int IsNaghd { get; set; }
}

/// <summary>درخواست ایجاد چک پرداختی</summary>
public class ChequePayCreateDto
{
    // بانک — فقط ID، کدینگ سمت سرور خوانده می‌شود
    public long BankAccId { get; set; }

    // مشخصات چک
    public string CheckSeries { get; set; } = "";
    public decimal CheckMab { get; set; }
    public string CheckDate { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    // رسید
    public int? ResidNumber { get; set; }   // null/0 = خودکار
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    // طرف حساب (دریافت‌کننده)
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }

    // سند
    public bool SaveWithSanad { get; set; } = true;
    public long? ParentSanadId { get; set; }   // اگه سند موجود انتخاب شده
    public int? NoSanad { get; set; }          // اگه شماره سند دستی
}

/// <summary>درخواست ویرایش چک پرداختی</summary>
public class ChequePayUpdateDto : ChequePayCreateDto
{
    public long Id { get; set; }
}

/// <summary>نتیجه ذخیره چک پرداختی</summary>
public class ChequePayCreateResultDto
{
    public long Id { get; set; }
    public int ResidNumber { get; set; }
    public long ParentSanadId { get; set; }
    public int? NoSanad { get; set; }
}

/// <summary>درخواست اعلام وصول چک پرداختی (OK)</summary>
public class ChequePayOkRequestDto
{
    public long Id { get; set; }
    public string OkDate { get; set; } = "";

    // حساب مقصد (Code_Col_OK / ...)
    public int CodeColOk { get; set; }
    public int CodeMoeinOk { get; set; }
    public int CodeTafzilOk { get; set; }

    // حساب بانک OK (Code_Col_Pay_OK / ...)
    public int CodeColPayOk { get; set; }
    public int CodeMoeinPayOk { get; set; }
    public int CodeTafzilPayOk { get; set; }

    // سند
    public bool SaveWithSanad { get; set; } = true;
    public long? ParentSanadOkId { get; set; }
    public int? NoSanad { get; set; }
}