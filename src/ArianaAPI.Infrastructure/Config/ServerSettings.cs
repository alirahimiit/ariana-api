namespace ArianaAPI.Infrastructure.Config;

/// <summary>
/// تنظیمات سرور API
/// </summary>
public class ServerSettings
{
    public const string SectionName = "Server";

    /// <summary>پورت سرور</summary>
    public int Port { get; set; } = 18080;

    /// <summary>آدرس IP برای Bind (0.0.0.0 = همه)</summary>
    public string BindIP { get; set; } = "0.0.0.0";

    /// <summary>آیا API Key فعال باشه؟</summary>
    public bool EnableAuth { get; set; } = true;

    /// <summary>مقدار API Key</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>حداکثر حجم Body درخواست (بایت) - پیش‌فرض 10MB</summary>
    public long MaxRequestBodySize { get; set; } = 10 * 1024 * 1024;
}