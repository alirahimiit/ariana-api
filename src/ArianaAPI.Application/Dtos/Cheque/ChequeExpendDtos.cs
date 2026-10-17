using System.Collections.Generic;

namespace ArianaAPI.Application.DTOs.Cheque;

// ═══════════════════════════════════════════════════════
//  خرج چک دریافتی — DTOها
//  معادل دلفی: TChequeExpendRec + TChequeExpendListForm
//  جدول: CheckExpend (توجه: بدون e دوم — تایپو در DB)
// ═══════════════════════════════════════════════════════

public class ChequeExpendListDto
{
    public long Id { get; set; }

    // ─── چک مبدأ (FK) ───
    public long ChequeReceiveId { get; set; }

    // ─── اطلاعات چک (lookup از CheckRecive) ───
    public string CheckSeries { get; set; } = "";
    public decimal CheckMab { get; set; }
    public string CheckDate { get; set; } = "";
    public string ReceiveFrom { get; set; } = "";   // شخص از چک

    // ─── شخص (کسی که چک بهش داده شده) ───
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string ColName { get; set; } = "";
    public string MoeinName { get; set; } = "";
    public string TafzilName { get; set; } = "";
    public string HesabName { get; set; } = "";      // محاسبه‌شده (tafzil - moein - col)

    // ─── رسید ───
    public int ResidNumber { get; set; }
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    // ─── سند ───
    public long ParentSanadId { get; set; }
    public int NoSanad { get; set; }
    public int SanadVazeit { get; set; }   // -1=ندارد، 0=پیش‌نویس

    // ─── وضعیت ───
    public int WasDuring { get; set; }     // 0=خرج قطعی، 1=در جریان وصول
}

public class ChequeExpendListResultDto
{
    public List<ChequeExpendListDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class ChequeExpendFilterDto
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
    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public int? WasDuring { get; set; }   // فیلتر وضعیت خرج
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
}

public class ChequeExpendDetailDto : ChequeExpendListDto
{
    // ─── اسناد دریافتنی ───
    public int CodeColPay { get; set; }
    public int CodeMoeinPay { get; set; }
    public int CodeTafzilPay { get; set; }
    public string ColPayName { get; set; } = "";
    public string MoeinPayName { get; set; } = "";
    public string TafzilPayName { get; set; } = "";

    // ─── Sanad ───
    public long SanadPersonId { get; set; }
    public long SanadId { get; set; }
}

public class ChequeExpendCreateDto
{
    // ─── چک انتخابی ───
    public long ChequeReceiveId { get; set; }

    // ─── رسید ───
    public int? ResidNumber { get; set; }
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    // ─── شخص (کسی که چک بهش داده شده) ───
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }

    // ─── اسناد دریافتنی ───
    public int CodeColPay { get; set; }
    public int CodeMoeinPay { get; set; }
    public int CodeTafzilPay { get; set; }

    // ─── وضعیت ───
    public bool WasDuring { get; set; }   // false=خرج قطعی، true=در جریان

    // ─── سند ───
    public bool SaveWithSanad { get; set; } = true;
    public long? ParentSanadId { get; set; }
    public int? NoSanad { get; set; }
}

public class ChequeExpendUpdateDto : ChequeExpendCreateDto
{
    public long Id { get; set; }
}

public class ChequeExpendCreateResultDto
{
    public long Id { get; set; }
    public int ResidNumber { get; set; }
    public long ParentSanadId { get; set; }
    public int? NoSanad { get; set; }
}

/// <summary>چک‌های قابل انتخاب برای خرج — برای combo/lookup</summary>
public class ChequeExpendAvailableChequeDto
{
    public long Id { get; set; }                     // CheckRecive.ID
    public string CheckSeries { get; set; } = "";
    public decimal CheckMab { get; set; }
    public string CheckDate { get; set; } = "";
    public string BankName { get; set; } = "";
    public string BankBrunch { get; set; } = "";
    public string NoHesabCheck { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    // شخص از چک (Code_Col/Moein/Tafzil)
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string HesabName { get; set; } = "";

    // اسناد دریافتنی از چک (Code_Col_Pay/Moein_Pay/Tafzil_Pay)
    public int CodeColPay { get; set; }
    public int CodeMoeinPay { get; set; }
    public int CodeTafzilPay { get; set; }

    public int WasExpended { get; set; }             // 0/1/2
}