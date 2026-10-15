using System.Collections.Generic;

namespace ArianaAPI.Application.DTOs.Resid;

// ═══════════════════════════════════════════════════════════
//  لیست
// ═══════════════════════════════════════════════════════════

/// <summary>
/// آیتم لیست رسیدهای نقدی (پرداخت یا دریافت)
/// </summary>
public class ResidListDto
{
    public long ID { get; set; }
    public int ResidNumber { get; set; }
    public string DateIn { get; set; } = "";
    public int CheckKind { get; set; }              // 1=پرداخت، 2=دریافت
    public decimal CashCost { get; set; }
    public string Descript { get; set; } = "";
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzili { get; set; }
    public long ParentSanadID { get; set; }
    public long SanadCashID { get; set; }
    public long SanadPersonID { get; set; }

    // ── از JOIN ──
    public string ColName { get; set; } = "";
    public string MoeinName { get; set; } = "";
    public string TafziliName { get; set; } = "";
    public int? NoSanad { get; set; }
    public int SanadVazeit { get; set; }

    // ── Computed (در C# ساخته می‌شود) ──
    public string HesabNameCalc
    {
        get
        {
            var parts = new List<string>();
            if (!string.IsNullOrEmpty(ColName)) parts.Add(ColName);
            if (!string.IsNullOrEmpty(MoeinName)) parts.Add(MoeinName);
            if (!string.IsNullOrEmpty(TafziliName)) parts.Add(TafziliName);
            return string.Join(" - ", parts);
        }
    }
}

/// <summary>جزئیات یک رسید (فعلاً همان ListDto)</summary>
public class ResidDetailDto : ResidListDto
{
}

/// <summary>نتیجه لیست با شماره صفحه</summary>
public class ResidListResultDto
{
    public List<ResidListDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

// ═══════════════════════════════════════════════════════════
//  Create / Update
// ═══════════════════════════════════════════════════════════

public class ResidCreateDto
{
    /// <summary>1=پرداخت نقدی، 2=دریافت نقدی</summary>
    public int CheckKind { get; set; }

    /// <summary>اگر null باشد → خودکار محاسبه می‌شود</summary>
    public int? ResidNumber { get; set; }

    public string DateIn { get; set; } = "";
    public decimal CashCost { get; set; }
    public string Descript { get; set; } = "";

    // حساب طرف (پرداخت‌شده به / دریافت‌شده از)
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzili { get; set; }

    // ── صدور سند ──
    public bool SaveWithSanad { get; set; } = false;
    public int? NoSanad { get; set; }
    public long? ParentSanadID { get; set; }
}

public class ResidUpdateDto : ResidCreateDto
{
    public long ID { get; set; }
}

public class ResidCreateResultDto
{
    public long ID { get; set; }
    public int ResidNumber { get; set; }
    public long ParentSanadID { get; set; }
    public int? NoSanad { get; set; }
}

// ═══════════════════════════════════════════════════════════
//  فیلتر
// ═══════════════════════════════════════════════════════════

public class ResidFilterDto
{
    public int CheckKind { get; set; }
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
    public int? FromNumber { get; set; }
    public int? ToNumber { get; set; }
    public string? Descript { get; set; }
    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzili { get; set; }
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
}

// ═══════════════════════════════════════════════════════════
//  Combo سند
// ═══════════════════════════════════════════════════════════

public class ResidSanadComboDto
{
    public long ParentSanadID { get; set; }
    public int NoSanad { get; set; }
    public string? DateIn { get; set; }
    public string? Sharh { get; set; }
    public int Vazeit { get; set; }
}