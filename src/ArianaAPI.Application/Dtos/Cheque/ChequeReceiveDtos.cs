using System.Collections.Generic;

namespace ArianaAPI.Application.DTOs.Cheque;

// ═══════════════════════════════════════════════════════
//  چک دریافتی — DTOها
//  معادل دلفی: TChequeReceiveRec + TChequeReceiveListForm
// ═══════════════════════════════════════════════════════

public class ChequeReceiveListDto
{
    public long Id { get; set; }

    // ─── بانک (فقط BankID + متن آزاد) ───
    public long BankId { get; set; }
    public string BankName { get; set; } = "";
    public string BankBrunch { get; set; } = "";
    public string NoHesabCheck { get; set; } = "";

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
    public int ChequeOK { get; set; }        // 0=در جریان، 1=OK، 2=برگشتی
    public int CheckState { get; set; }
    public string OkDate { get; set; } = "";
    public int WasExpended { get; set; }     // 0=خرج نشده، 1=خرج شده، 2=در جریان

    // ─── طرف حساب (پرداخت‌کننده) ───
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string ColName { get; set; } = "";
    public string MoeinName { get; set; } = "";
    public string TafzilName { get; set; } = "";

    // ─── سند ───
    public long ParentSanadId { get; set; }
    public int NoSanad { get; set; }
    public int SanadVazeit { get; set; }
}

public class ChequeReceiveListResultDto
{
    public List<ChequeReceiveListDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class ChequeReceiveFilterDto
{
    public int? FromNumber { get; set; }
    public int? ToNumber { get; set; }
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
    public string? CheckFromDate { get; set; }
    public string? CheckToDate { get; set; }
    public string? CheckFromSerial { get; set; }
    public string? CheckToSerial { get; set; }
    public string? Descript { get; set; }
    public long? BankId { get; set; }
    public string? BankBrunch { get; set; }
    public string? NoHesabCheck { get; set; }
    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
}

public class ChequeReceiveDetailDto : ChequeReceiveListDto
{
    // ─── کدینگ بانک (حساب دریافت) ───
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

    public int IsNaghd { get; set; }
}

public class ChequeReceiveCreateDto
{
    // بانک
    public long BankId { get; set; }
    public string BankBrunch { get; set; } = "";
    public string NoHesabCheck { get; set; } = "";

    // چک
    public string CheckSeries { get; set; } = "";
    public decimal CheckMab { get; set; }
    public string CheckDate { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    // رسید
    public int? ResidNumber { get; set; }
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    // طرف حساب (پرداخت‌کننده)
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }

    // سند
    public bool SaveWithSanad { get; set; } = true;
    public long? ParentSanadId { get; set; }
    public int? NoSanad { get; set; }
}

public class ChequeReceiveUpdateDto : ChequeReceiveCreateDto
{
    public long Id { get; set; }
}

public class ChequeReceiveCreateResultDto
{
    public long Id { get; set; }
    public int ResidNumber { get; set; }
    public long ParentSanadId { get; set; }
    public int? NoSanad { get; set; }
}

public class ChequeReceiveOkRequestDto
{
    public long Id { get; set; }
    public string OkDate { get; set; } = "";

    // Code_Col_OK = حساب بانکی (بدهکار)
    public int CodeColOk { get; set; }
    public int CodeMoeinOk { get; set; }
    public int CodeTafzilOk { get; set; }

    // Code_Col_Pay_OK = حساب اسناد دریافتنی (بستانکار)
    public int CodeColPayOk { get; set; }
    public int CodeMoeinPayOk { get; set; }
    public int CodeTafzilPayOk { get; set; }

    public bool SaveWithSanad { get; set; } = true;
    public long? ParentSanadOkId { get; set; }
    public int? NoSanad { get; set; }
}