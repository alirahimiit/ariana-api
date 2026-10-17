using System.Collections.Generic;

namespace ArianaAPI.Application.DTOs.Cheque;

// ═══════════════════════════════════════════════════════
//  گزارش‌های چک — DTO های خلاصه (Summary)
//  برای ۳ endpoint: chequepay/report-summary,
//  chequereceive/report-summary, chequeexpend/report-summary
// ═══════════════════════════════════════════════════════

/// <summary>خلاصه‌ی گزارش چک — مشترک بین ۳ گزارش</summary>
public class ChequeReportSummaryDto
{
    /// <summary>تعداد کل چک‌های مطابق فیلتر</summary>
    public int TotalCount { get; set; }

    /// <summary>جمع مبلغ کل</summary>
    public decimal TotalAmount { get; set; }

    /// <summary>
    /// گروه‌بندی بر اساس وضعیت:
    ///   • Pay/Receive: ChequeOK (0=در جریان، 1=وصول‌شده، 2=برگشتی)
    ///   • Expend: WasDuring (0=خرج قطعی، 1=در جریان وصول)
    /// </summary>
    public List<ChequeStatusGroupDto> ByStatus { get; set; } = new();

    /// <summary>
    /// گروه‌بندی بر اساس WasExpended — فقط برای ChequeReceive پر می‌شود
    /// 0=آزاد، 1=خرج قطعی، 2=در جریان وصول
    /// برای Pay و Expend: null/خالی
    /// </summary>
    public List<ChequeStatusGroupDto>? ByExpended { get; set; }
}

/// <summary>یک گروه در Summary — مثلاً «وصول‌شده: ۴۰ چک / ۱۵ میلیون»</summary>
public class ChequeStatusGroupDto
{
    /// <summary>کد وضعیت (0/1/2)</summary>
    public int Status { get; set; }

    /// <summary>برچسب فارسی — «وصول‌شده» و ...</summary>
    public string Label { get; set; } = "";

    public int Count { get; set; }
    public decimal Amount { get; set; }
}