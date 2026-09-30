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
        _config = config;
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
            // ⭐ حالت ۱: فایل قبلاً بود، الان نیست → invalidate
            if (!fileExists && _lastWriteTimeUtc != DateTime.MinValue)
            {
                _logger.LogWarning("⚠️ فایل لایسنس حذف/rename شد — invalidate");
                _status = LicenseStatus.Invalid(
                    $"فایل لایسنس پیدا نشد. باید 'ariana.lic' کنار برنامه باشه.");
                _lastWriteTimeUtc = DateTime.MinValue;
                return _status;
            }

            // ⭐ حالت ۲: فایل mtime جدید → reload
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
    // ⭐ جدید — گرفتن زمان آخرین تغییر فایل
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

    public bool IsOrgAuthorized(long orgId)
    {
        if (!_status.IsValid || _status.Payload is null)
            return false;

        return _status.Payload.AuthorizedOrgs.Contains(orgId);
    }

    public long[] GetAuthorizedOrgs()
        => _status.Payload?.AuthorizedOrgs ?? Array.Empty<long>();

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
            // ⭐ جدید — چک SystemId Hash
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
   

            _logger.LogInformation(
                "✅ لایسنس معتبر: {Customer} | سازمان‌های مجاز: {Orgs}",
                file.Payload.CustomerName,
                string.Join(", ", file.Payload.AuthorizedOrgs));

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
            // همون JSON فشرده که موقع امضا تولید شد
            var payloadJson = JsonSerializer.Serialize(file.Payload, new JsonSerializerOptions
            {
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            });

            // ⚠️ روش امضا در Admin Tool از ConvertTo-Json فشرده استفاده می‌کنه
            // باید مطمئن شیم JSON خروجی یکسانه. راه بهتر: از سمت Admin، JSON رو خودمون دستی بسازیم.

            // راه ساده‌تر: از یک canonical JSON استفاده کنیم
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
    /// ساخت JSON فشرده و یکسان (بدون فاصله، با ترتیب مشخص)
    /// باید عیناً معادل خروجی Admin Tool باشه
    /// </summary>
    private static string BuildCanonicalJson(LicensePayload p)
    {
        var featuresJson = "[" + string.Join(",", p.Features.Select(f => $"\"{f}\"")) + "]";
        var orgsJson = "[" + string.Join(",", p.AuthorizedOrgs) + "]";
        var notesJson = p.Notes is null ? "null" : $"\"{p.Notes.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"";

        var baseJson = $"{{\"version\":{p.Version}," +
                       $"\"licenseId\":\"{p.LicenseId}\"," +
                       $"\"customerName\":\"{p.CustomerName}\"," +
                       $"\"customerId\":\"{p.CustomerId}\"," +
                       $"\"issuedAt\":\"{p.IssuedAt}\"," +
                       $"\"expiresAt\":\"{p.ExpiresAt}\"," +
                       $"\"authorizedOrgs\":{orgsJson}," +
                       $"\"features\":{featuresJson}," +
                       $"\"notes\":{notesJson}";

        // ⭐ جدید — اگه systemId داره، سریال هم داره
        if (!string.IsNullOrEmpty(p.SystemId))
            return baseJson + $",\"systemId\":\"{p.SystemId}\"}}";

        return baseJson + "}";
    }

    private static bool IsNotExpired(string? expiresAt)
    {
        // اگه خالی → منقضی محسوب می‌شه (امن‌تر از valid)
        if (string.IsNullOrWhiteSpace(expiresAt))
            return false;

        try
        {
            // parse: "1405/12/29"
            var parts = expiresAt.Trim().Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 3)
                return false;

            if (!int.TryParse(parts[0], out var year)) return false;
            if (!int.TryParse(parts[1], out var month)) return false;
            if (!int.TryParse(parts[2], out var day)) return false;

            // اعتبارسنجی محدوده
            if (year < 1300 || year > 1500) return false;
            if (month < 1 || month > 12) return false;
            if (day < 1 || day > 31) return false;

            // تاریخ امروز به شمسی
            var pc = new PersianCalendar();
            var now = DateTime.Now;
            var todayYear = pc.GetYear(now);
            var todayMonth = pc.GetMonth(now);
            var todayDay = pc.GetDayOfMonth(now);

            // مقایسه: امروز vs تاریخ انقضا
            if (todayYear > year) return false;   // سال گذشته
            if (todayYear < year) return true;    // سال آینده
            if (todayMonth > month) return false; // ماه گذشته
            if (todayMonth < month) return true;  // ماه آینده
            return todayDay <= day;               // امروز یا قبل‌تر
        }
        catch
        {
            return false;
        }
    }


    private static string GetLicensePath()
    {
        // کنار exe اصلی
        var baseDir = AppContext.BaseDirectory;
        return Path.Combine(baseDir, "ariana.lic");
    }

    // ⭐ متدهای جدید
    private bool VerifySystemIdHash(string licenseSystemId)
    {
        var expected = _config["License:SystemIdHash"];

        // اگه تنظیم نشده → skip (چون هنوز مشتری hash نذاشته)
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