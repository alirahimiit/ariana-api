using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ArianaAPI.Application.DTOs.License;
using ArianaAPI.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services;

public class LicenseService : ILicenseService
{
    // ⚠️ این کلید رو از فایل public.key کپی کن (متن XML)
    private const string PUBLIC_KEY_XML = @"<RSAKeyValue><Modulus>myZ8bNhkuZ3IIhRqUG0QLEISJ231nMJ6gKRpBBqclaa88l0B7OQY4I14pbuikWIhaSGlA31v+W0pybmSagz/Z0K6NGxPhLD5dNggRxzk3cLuT8YrWtsnbmbjrAT9YVbaSlq4wEAAkoKnToU29SOQAgIlA8WMmftAQC7qVgcBAZrxkn+Z8VEahL1w2NLqbumluR3ha6ByAjkafey7JksKrvlHj+Q7nXYrtFfoY8kXf6cfnzFb2z6+mq77lJHU0U/VqeJ4fn8G/VooLAF+ACmHT7d5ri0FJLje++zXe5qxxouiDpgw/0gBTW7cY++2FC+cYAtp5aJqFLU6C3oJZTtrqQ==</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>";
    private readonly ILogger<LicenseService> _logger;
    private readonly LicenseStatus _status;
    private readonly object _lock = new();

    public LicenseService(ILogger<LicenseService> logger)
    {
        _logger = logger;
        _status = LoadLicense();
    }

    public LicenseStatus GetStatus() => _status;

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

            // ─── چک انقضا ───
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
        var notesJson = p.Notes is null ? "null" : $"\"{p.Notes.Replace("\"", "\\\"")}\"";

        return $"{{\"version\":{p.Version}," +
               $"\"licenseId\":\"{p.LicenseId}\"," +
               $"\"customerName\":\"{p.CustomerName}\"," +
               $"\"customerId\":\"{p.CustomerId}\"," +
               $"\"issuedAt\":\"{p.IssuedAt}\"," +
               $"\"expiresAt\":\"{p.ExpiresAt}\"," +
               $"\"authorizedOrgs\":{orgsJson}," +
               $"\"features\":{featuresJson}," +
               $"\"notes\":{notesJson}}}";
    }

    private static bool IsNotExpired(string? expiresAt)
    {
        if (string.IsNullOrWhiteSpace(expiresAt)) return true;

        // ⚠️ اینجا باید تاریخ شمسی رو با تاریخ امروز مقایسه کنی
        // فعلاً فقط یه placeholder ساده
        // TODO: from PersianCalendar

        return true; // موقتاً غیرفعال
    }

    private static string GetLicensePath()
    {
        // کنار exe اصلی
        var baseDir = AppContext.BaseDirectory;
        return Path.Combine(baseDir, "ariana.lic");
    }
}