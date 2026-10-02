namespace ArianaAPI.Infrastructure.Services.Moadian;

/// <summary>
/// تنظیمات اتصال به سامانه مودیان
/// از tax_setting دیتابیس Tenant پر می‌شه
/// </summary>
public class MoadianOptions
{
    /// <summary>شناسه ۶ حرفی حافظه مالیاتی مودی</summary>
    public string TaxUserName { get; set; } = "";

    /// <summary>کلید خصوصی PEM (RSA Private Key)</summary>
    public string PrivateKey { get; set; } = "";

    /// <summary>کد اقتصادی مودی</summary>
    public string EconomicCode { get; set; } = "";

    /// <summary>تست یا Production</summary>
    public bool IsSandbox { get; set; } = true;

    // ═══ URL ثابت سامانه ═══
    public string BaseUrl => IsSandbox
        ? "https://sandboxrc.tax.gov.ir/req/api/self-tsp/"
        : "https://tp.tax.gov.ir/req/api/self-tsp/";
}