using System.Security.Cryptography;
using System.Globalization;
using System.Text;
using System.Text.Json;
using ArianaAPI.Application.DTOs.License;
using ArianaAPI.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services;

public class LicenseService : ILicenseService
{
    // ⚠️ این کلید رو از فایل public.key کپی کن (متن XML)
    private const string PUBLIC_KEY_XML = @"<RSAKeyValue><Modulus>pxQVrGKMBvPiKZebpKm1hHwCKR8FM21gfbZmPQPXJE/VpfXYRrZTXLl7SPrUWBAZSqwKZbGlx2ONYbJLP9WCEk0pJdjkWc+DiGjBEsEY2Xnr/qzK1yHFBLu6W/elDJY8J23I1o/2lKJsdwNG+VV1WC0tgKJ2z2Tw1c2ucHt64g7qtMeSKe1nf95NNYPn2jHk/gNccHbqItkAIzwgsL1eWLaFbJERIDHzotOHzBGJfHegb6+jFPtD3wQIFInWjZ5t/QsuxDMYdt8kzUieI4tcR+jtbaKkRpGmfV69Tl1xBSryZGpcT5rj7s3ZeDTrgzcwNLjp4nV5+vVh0qORYOkdQQ==</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>";
    private readonly ILogger<LicenseService> _logger;
    private readonly IConfiguration _config;
    private LicenseStatus _status;
    private DateTime _lastWriteTimeUtc;
    private readonly object _lock = new();

    public LicenseService(ILogger<LicenseService> logger, IConfiguration config)
    {
        _logger = logger;
        _config = config;
        _status = LoadLicense();
        _lastWriteTimeUtc = GetLicenseFileWriteTimeUtc();
    }

    public LicenseStatus GetStatus()
    {
        var path = GetLicensePath();
        var fileExists = File.Exists(path);
        var currentWriteTime = fileExists
            ? File.GetLastWriteTimeUtc(path)
            : DateTime.MinValue;

        lock (_lock)
        {
            if (!fileExists && _lastWriteTimeUtc != DateTime.MinValue)
            {
                _logger.LogWarning("⚠️ فایل لایسنس حذف/rename شد — invalidate");
                _status = LicenseStatus.Invalid(
                    $"فایل لایسنس پیدا نشد. باید 'ariana.lic' کنار برنامه باشه.");
                _lastWriteTimeUtc = DateTime.MinValue;
                return _status;
            }

            if (currentWriteTime != DateTime.MinValue
                && currentWriteTime > _lastWriteTimeUtc)
            {
                _logger.LogInformation(
                    "🔄 فایل لایسنس تغییر کرد — دوباره خوانده می‌شه. mtime={Time}",
                    currentWriteTime);

                _status = LoadLicense();
                _lastWriteTimeUtc = currentWriteTime;
            }
        }

        return _status;
    }

    private static DateTime GetLicenseFileWriteTimeUtc()
    {
        try
        {
            var path = GetLicensePath();
            return File.Exists(path)
                ? File.GetLastWriteTimeUtc(path)
                : DateTime.MinValue;
        }
        catch
        {
            return DateTime.MinValue;
        }
    }

    // ═══════════════════════════════════════════
    //  ⭐ جدید: منطق بر اساس تعداد
    // ═══════════════════════════════════════════

    public bool IsOrgAuthorized(long orgId)
    {
        // اگه لایسنس معتبر و maxOrgs > 0 باشه، هر سازمانی مجازه
        if (!_status.IsValid || _status.Payload is null) return false;
        return _status.Payload.MaxOrgs > 0;
    }

    public int MaxOrgs => _status.Payload?.MaxOrgs ?? 0;

    // ═══════════════════════════════════════════
    //  بارگذاری و اعتبارسنجی
    // ═══════════════════════════════════════════
    private LicenseStatus LoadLicense()
    {
        try
        {
            var licensePath = GetLicensePath();

            _logger.LogInformation("در حال خواندن لایسنس از: {Path}", licensePath);

            if (!File.Exists(licensePath))
            {
                _logger.LogWarning("⚠️ فایل لایسنس پیدا نشد: {Path}", licensePath);
                return LicenseStatus.Invalid(
                    $"فایل لایسنس پیدا نشد. باید فایل 'ariana.lic' رو کنار برنامه بذاری. مسیر جستجو: {licensePath}");
            }

            var json = File.ReadAllText(licensePath, Encoding.UTF8);
            var file = JsonSerializer.Deserialize<LicenseFile>(json);

            if (file is null || file.Payload is null || string.IsNullOrEmpty(file.Signature))
            {
                return LicenseStatus.Invalid("ساختار فایل لایسنس نامعتبر است");
            }

            // ─── تأیید امضا ───
            if (!VerifySignature(file))
            {
                _logger.LogError("❌ امضای لایسنس نامعتبر است");
                return LicenseStatus.Invalid("امضای لایسنس نامعتبر است (فایل دست‌کاری شده)");
            }

            // ─── چک SystemId Hash ───
            if (!VerifySystemIdHash(file.Payload.SystemId))
            {
                _logger.LogError("❌ SystemId تطابق ندارد");
                return LicenseStatus.Invalid("این لایسنس برای این سرور صادر نشده است");
            }

            // ─── چک انقضا ───
            _logger.LogInformation("🔍 بررسی انقضا: expiresAt={Exp}, isNotExpired={Ok}",
                file.Payload.ExpiresAt,
                IsNotExpired(file.Payload.ExpiresAt));

            if (!IsNotExpired(file.Payload.ExpiresAt))
            {
                _logger.LogWarning("⚠️ لایسنس منقضی شده است. انقضا: {Exp}", file.Payload.ExpiresAt);
                return LicenseStatus.Invalid($"لایسنس منقضی شده است (تاریخ انقضا: {file.Payload.ExpiresAt})");
            }

            // ─── ⭐ چک تعداد سازمان ───
            if (file.Payload.MaxOrgs <= 0)
            {
                _logger.LogError("❌ maxOrgs معتبر نیست: {N}", file.Payload.MaxOrgs);
                return LicenseStatus.Invalid("لایسنس باید حداقل ۱ سازمان مجاز داشته باشد");
            }

            _logger.LogInformation(
                "✅ لایسنس معتبر: {Customer} | حداکثر سازمان‌ها: {Max}",
                file.Payload.CustomerName,
                file.Payload.MaxOrgs);

            return LicenseStatus.Valid(file.Payload);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در بارگذاری لایسنس");
            return LicenseStatus.Invalid($"خطا در خواندن لایسنس: {ex.Message}");
        }
    }

    private bool VerifySignature(LicenseFile file)
    {
        try
        {
            var canonicalJson = BuildCanonicalJson(file.Payload);

            var dataBytes = Encoding.UTF8.GetBytes(canonicalJson);
            var sigBytes = Convert.FromBase64String(file.Signature);

            using var rsa = RSA.Create();
            rsa.FromXmlString(PUBLIC_KEY_XML);

            return rsa.VerifyData(
                dataBytes,
                sigBytes,
                HashAlgorithmName.SHA256,
                RSASignaturePadding.Pkcs1);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در تأیید امضا");
            return false;
        }
    }

    /// <summary>
    /// ساخت JSON فشرده و یکسان — ترتیب دقیقاً باید با Keygen یکی باشه
    /// </summary>
    private static string BuildCanonicalJson(LicensePayload p)
    {
        var featuresJson = "[" + string.Join(",", p.Features.Select(f => $"\"{f}\"")) + "]";
        var notesJson = p.Notes is null ? "null" : $"\"{p.Notes.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"";

        var baseJson = $"{{\"version\":{p.Version}," +
                       $"\"licenseId\":\"{p.LicenseId}\"," +
                       $"\"customerName\":\"{p.CustomerName}\"," +
                       $"\"customerId\":\"{p.CustomerId}\"," +
                       $"\"issuedAt\":\"{p.IssuedAt}\"," +
                       $"\"expiresAt\":\"{p.ExpiresAt}\"," +
                       $"\"maxOrgs\":{p.MaxOrgs}," +
                       $"\"features\":{featuresJson}," +
                       $"\"notes\":{notesJson}";

        if (!string.IsNullOrEmpty(p.SystemId))
            return baseJson + $",\"systemId\":\"{p.SystemId}\"}}";

        return baseJson + "}";
    }

    private static bool IsNotExpired(string? expiresAt)
    {
        if (string.IsNullOrWhiteSpace(expiresAt))
            return false;

        try
        {
            var parts = expiresAt.Trim().Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 3)
                return false;

            if (!int.TryParse(parts[0], out var year)) return false;
            if (!int.TryParse(parts[1], out var month)) return false;
            if (!int.TryParse(parts[2], out var day)) return false;

            if (year < 1300 || year > 1500) return false;
            if (month < 1 || month > 12) return false;
            if (day < 1 || day > 31) return false;

            var pc = new PersianCalendar();
            var now = DateTime.Now;
            var todayYear = pc.GetYear(now);
            var todayMonth = pc.GetMonth(now);
            var todayDay = pc.GetDayOfMonth(now);

            if (todayYear > year) return false;
            if (todayYear < year) return true;
            if (todayMonth > month) return false;
            if (todayMonth < month) return true;
            return todayDay <= day;
        }
        catch
        {
            return false;
        }
    }

    private static string GetLicensePath()
    {
        var baseDir = AppContext.BaseDirectory;
        return Path.Combine(baseDir, "ariana.lic");
    }

    private bool VerifySystemIdHash(string licenseSystemId)
    {
        var expected = _config["License:SystemIdHash"];

        if (string.IsNullOrWhiteSpace(expected))
        {
            _logger.LogWarning("⚠️ License:SystemIdHash تنظیم نشده — از چک SystemId صرف‌نظر شد");
            return true;
        }

        if (string.IsNullOrWhiteSpace(licenseSystemId))
        {
            _logger.LogError("❌ systemId در لایسنس خالیه ولی hash تنظیم شده");
            return false;
        }

        var actual = ComputeSystemIdHash(licenseSystemId);
        if (!string.Equals(expected.Trim(), actual, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogError("❌ hash mismatch. Expected={Exp}, Actual={Act}", expected, actual);
            return false;
        }

        return true;
    }

    public static string ComputeSystemIdHash(string systemId)
    {
        var normalized = new string(systemId.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        var bytes = Encoding.UTF8.GetBytes(normalized);
        var hash = SHA256.HashData(bytes);
        return "sha256:" + Convert.ToHexString(hash).ToLowerInvariant();
    }
}