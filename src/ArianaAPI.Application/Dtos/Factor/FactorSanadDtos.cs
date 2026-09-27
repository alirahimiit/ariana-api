namespace ArianaAPI.Application.DTOs.Factor;

// ═══════════════════════════════════════════════
//  درخواست ثبت سند
// ═══════════════════════════════════════════════
public class SanadCreateRequestDto
{
    /// <summary>شماره سند (0 = خودکار)</summary>
    public long NoSanad { get; set; } = 0;

    /// <summary>ثبت سند بازاریاب هم انجام شود؟</summary>
    public bool WithMarketer { get; set; } = false;

    /// <summary>شماره سند بازاریاب (0 = خودکار)</summary>
    public long NoSanadMarketer { get; set; } = 0;
}

// ═══════════════════════════════════════════════
//  درخواست ثبت سند گروهی
// ═══════════════════════════════════════════════
public class SanadBulkRequestDto
{
    /// <summary>
    /// نوع ثبت:
    /// 0 = همه فاکتورها در یک سند
    /// 1 = برای هر فاکتور سند جداگانه
    /// </summary>
    public int Mode { get; set; } = 1;

    /// <summary>فیلتر فاکتورها (اختیاری — اگه null باشه، همه بدون سند)</summary>
    public FactorRequestDto? Filter { get; set; }
}

// ═══════════════════════════════════════════════
//  نتیجه ثبت سند
// ═══════════════════════════════════════════════
public class SanadCreateResultDto
{
    public bool Success { get; set; }
    public long FactorId { get; set; }
    public long NoFactor { get; set; }
    public long? NoSanad { get; set; }
    public long? NoSanadMarketer { get; set; }
    public string? Error { get; set; }
}

public class SanadBulkResultDto
{
    public int TotalCount { get; set; }
    public int SuccessCount { get; set; }
    public int FailCount { get; set; }
    public List<SanadCreateResultDto> Results { get; set; } = new();
}