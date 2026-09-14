namespace ArianaAPI.Infrastructure.Config;

/// <summary>
/// تنظیمات اصلی برنامه (از appsettings.json خونده می‌شه)
/// </summary>
public class AppSettings
{
    public DatabaseSettings Database { get; set; } = new();
    public ServerSettings Server { get; set; } = new();
    public JwtSettings Jwt { get; set; } = new();
}