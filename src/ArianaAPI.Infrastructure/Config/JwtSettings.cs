namespace ArianaAPI.Infrastructure.Config;

public class JwtSettings
{
    public const string SectionName = "Jwt";

    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = "ArianaAPI";
    public string Audience { get; set; } = "ArianaClient";
    public int AccessTokenExpiryMinutes { get; set; } = 60;
    public int RefreshTokenExpiryDays { get; set; } = 7;
}

public class ApiKeySettings
{
    public const string SectionName = "ApiKey";
    public string Key { get; set; } = string.Empty;
}