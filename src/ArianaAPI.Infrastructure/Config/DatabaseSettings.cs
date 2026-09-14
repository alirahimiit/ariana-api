namespace ArianaAPI.Infrastructure.Config;

/// <summary>
/// تنظیمات اتصال به دیتابیس
/// </summary>
public class DatabaseSettings
{
    public const string SectionName = "Database";

    /// <summary>آدرس سرور (مثلا: localhost یا RAHIMI-PC)</summary>
    public string Server { get; set; } = "localhost";

    /// <summary>اسم دیتابیس اصلی (Permanent)</summary>
    public string DatabaseName { get; set; } = "Permanent";

    /// <summary>آیا از Windows Authentication استفاده کنیم؟</summary>
    public bool IntegratedSecurity { get; set; } = false;

    /// <summary>نام کاربری SQL Server</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>پسورد SQL Server</summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>پیشوند نام دیتابیس‌های Tenant (مثلا: Acounting_)</summary>
    public string Prefix { get; set; } = "Acounting_";

    /// <summary>مدت Timeout برای اتصال (به ثانیه)</summary>
    public int ConnectionTimeoutSeconds { get; set; } = 15;

    /// <summary>Trust Server Certificate (برای SSL)</summary>
    public bool TrustServerCertificate { get; set; } = true;
}