using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Digests;
using Org.BouncyCastle.Crypto.Encodings;
using Org.BouncyCastle.Crypto.Engines;
using Org.BouncyCastle.Crypto.Modes;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.OpenSsl;
using Org.BouncyCastle.Security;

namespace ArianaAPI.Infrastructure.Services.Moadian;

/// <summary>
/// Helper برای رمزنگاری و امضای دیجیتال سامانه مودیان
/// 
/// پورت شده از:
///   TaxCollector.cs (برنامه‌ی WinForms .NET Framework 4.6.2)
///   → .NET 8 (cross-platform)
/// 
/// تمام الگوریتم‌ها عیناً مطابق نسخه‌ی Delphi/Windows هستن.
/// </summary>
public static class MoadianCryptoHelper
{
    // ═══════════════════════════════════════════════════════════
    //  ۱. RSA SIGNING
    //  امضای داده با کلید خصوصی (PEM)
    //  الگوریتم: SHA256 with RSA + PKCS1
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// امضای دیجیتال با کلید خصوصی مودی
    /// </summary>
    /// <param name="data">داده‌ی نرمال‌شده (خروجی NormalizeJson)</param>
    /// <param name="pemPrivateKey">کلید خصوصی به فرمت PEM (از tax_setting.private_key)</param>
    /// <returns>امضای Base64</returns>
    public static string SignData(string data, string pemPrivateKey)
    {
        if (string.IsNullOrWhiteSpace(data))
            throw new ArgumentException("داده برای امضا خالیه", nameof(data));
        if (string.IsNullOrWhiteSpace(pemPrivateKey))
            throw new ArgumentException("کلید خصوصی خالیه", nameof(pemPrivateKey));

        var privateKey = LoadPrivateKey(pemPrivateKey);

        // ⭐ BouncyCastle Signer (cross-platform، جایگزین RSACryptoServiceProvider)
        var signer = SignerUtilities.GetSigner("SHA256withRSA");
        signer.Init(forSigning: true, parameters: privateKey);

        var dataBytes = Encoding.UTF8.GetBytes(data);
        signer.BlockUpdate(dataBytes, 0, dataBytes.Length);

        var signature = signer.GenerateSignature();
        return Convert.ToBase64String(signature);
    }

    /// <summary>
    /// لود کلید خصوصی از PEM
    /// - پشتیبانی از PKCS#1 (`BEGIN RSA PRIVATE KEY`)
    /// - پشتیبانی از PKCS#8 (`BEGIN PRIVATE KEY`)
    /// </summary>
    private static AsymmetricKeyParameter LoadPrivateKey(string pem)
    {
        using var reader = new StringReader(pem);
        var pemReader = new PemReader(reader);
        var obj = pemReader.ReadObject();

        // حالت ۱: مستقیماً کلید
        if (obj is AsymmetricKeyParameter keyParam)
            return keyParam;

        // حالت ۲: KeyPair
        if (obj is AsymmetricCipherKeyPair pair)
            return pair.Private;

        // حالت ۳: PKCS#8 PrivateKeyInfo
        if (obj is Org.BouncyCastle.Asn1.Pkcs.PrivateKeyInfo pkInfo)
            return PrivateKeyFactory.CreateKey(pkInfo);

        throw new InvalidOperationException(
            $"فرمت کلید خصوصی پشتیبانی نمی‌شه: {obj?.GetType().Name ?? "null"}");
    }

    // ═══════════════════════════════════════════════════════════
    //  ۲. RSA ENCRYPT (با کلید عمومی سرور مودیان)
    //  رمزنگاری کلید متقارن AES با کلید عمومی سرور
    //  الگوریتم: RSA-OAEP with SHA256
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// رمزنگاری داده با کلید عمومی سرور مودیان
    /// (معمولاً برای رمزنگاری کلید متقارن AES استفاده می‌شه)
    /// </summary>
    /// <param name="data">رشته‌ی hex کلید AES (مثلاً: "A1B2C3...")</param>
    /// <param name="serverPublicKeyBase64">کلید عمومی سرور (از GET_SERVER_INFORMATION)</param>
    /// <returns>داده‌ی رمزشده به Base64</returns>
    public static string EncryptWithServerPublicKey(string data, string serverPublicKeyBase64)
    {
        if (string.IsNullOrWhiteSpace(data))
            throw new ArgumentException("داده خالیه", nameof(data));
        if (string.IsNullOrWhiteSpace(serverPublicKeyBase64))
            throw new ArgumentException("کلید عمومی خالیه", nameof(serverPublicKeyBase64));

        // ⭐ decode از Base64 → DER bytes
        var publicKeyBytes = Convert.FromBase64String(serverPublicKeyBase64);
        var publicKey = PublicKeyFactory.CreateKey(publicKeyBytes);

        // ⭐ RSA-OAEP با SHA256 (مطابق Delphi/Windows)
        var cipher = new OaepEncoding(new RsaEngine(), new Sha256Digest());
        cipher.Init(forEncryption: true, parameters: publicKey);

        var inputBytes = Encoding.UTF8.GetBytes(data);
        var encrypted = cipher.ProcessBlock(inputBytes, 0, inputBytes.Length);
        return Convert.ToBase64String(encrypted);
    }

    // ═══════════════════════════════════════════════════════════
    //  ۳. AES-GCM (رمزنگاری فاکتور)
    //  الگوریتم: AES-256 in GCM mode
    //  Tag length: 128 bits (16 bytes)
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// رمزنگاری payload با AES-GCM
    /// </summary>
    /// <param name="payload">داده‌ی XOR-شده (invoice JSON)</param>
    /// <param name="key">کلید AES 256-bit (32 bytes)</param>
    /// <param name="iv">Initialization Vector (16 bytes)</param>
    /// <returns>داده‌ی رمزشده به Base64</returns>
    public static string AesEncrypt(byte[] payload, byte[] key, byte[] iv)
    {
        if (payload is null || payload.Length == 0)
            throw new ArgumentException("payload خالیه", nameof(payload));
        if (key is null || key.Length != 32)
            throw new ArgumentException("کلید باید ۳۲ بایتی باشه (AES-256)", nameof(key));
        if (iv is null || iv.Length != 16)
            throw new ArgumentException("IV باید ۱۶ بایتی باشه", nameof(iv));

        var cipher = new GcmBlockCipher(new AesEngine());
        var parameters = new AeadParameters(new KeyParameter(key), 128, iv, associatedText: null);

        cipher.Init(forEncryption: true, parameters: parameters);

        var cipherBytes = new byte[cipher.GetOutputSize(payload.Length)];
        var len = cipher.ProcessBytes(payload, 0, payload.Length, cipherBytes, 0);
        cipher.DoFinal(cipherBytes, len);

        return Convert.ToBase64String(cipherBytes);
    }

    // ═══════════════════════════════════════════════════════════
    //  ۴. تولید کلید متقارن و IV
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// تولید کلید AES 256-bit تصادفی
    /// </summary>
    public static byte[] GenerateAesSecretKey()
    {
        var key = new byte[32];  // 256 bit
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(key);
        return key;
    }

    /// <summary>
    /// تولید IV (Initialization Vector) ۱۶ بایتی
    /// ⚠️ non-zero: چون Delphi از GetNonZeroBytes استفاده می‌کرد
    /// </summary>
    public static byte[] GenerateIv()
    {
        var iv = new byte[16];
        using var rng = RandomNumberGenerator.Create();

        // ⭐ معادل RNGCryptoServiceProvider.GetNonZeroBytes
        // تا زمانی که همه بایت‌ها non-zero نشن، تکرار کن
        while (ContainsZero(iv))
        {
            rng.GetBytes(iv);
        }
        return iv;
    }

    private static bool ContainsZero(byte[] arr)
    {
        foreach (var b in arr)
            if (b == 0) return true;
        return false;
    }

    // ═══════════════════════════════════════════════════════════
    //  ۵. XOR دو آرایه (پایه‌ی رمزنگاری مودیان)
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// XOR دو آرایه بایتی
    /// آرایه‌ی کوچک‌تر تکرار می‌شه تا به اندازه‌ی بزرگ‌تر برسه
    /// </summary>
    public static byte[] Xor(byte[] a, byte[] b)
    {
        if (a is null || a.Length == 0) throw new ArgumentException("آرایه اول خالیه", nameof(a));
        if (b is null || b.Length == 0) throw new ArgumentException("آرایه دوم خالیه", nameof(b));

        return a.Length < b.Length
            ? XorBlocks(a, b)   // a کوچک‌تره
            : XorBlocks(b, a);  // b کوچک‌تره
    }

    private static byte[] XorBlocks(byte[] smaller, byte[] bigger)
    {
        var buffer = new byte[bigger.Length];
        var repetitions = (int)Math.Ceiling((double)bigger.Length / smaller.Length);

        for (var rep = 0; rep < repetitions; rep++)
        {
            for (var i = 0; i < smaller.Length; i++)
            {
                var idx = rep * smaller.Length + i;
                if (idx >= bigger.Length) return buffer;
                buffer[idx] = (byte)(smaller[i] ^ bigger[idx]);
            }
        }
        return buffer;
    }

    // ═══════════════════════════════════════════════════════════
    //  ۶. NormalizeJson — قلب امضا
    //  
    //  تبدیل JSON به یه رشته‌ی خطی یکتا که برای امضا استفاده می‌شه.
    //  مراحل:
    //    1. flatten (همه‌ی nested keys با نقطه)
    //    2. مرتب‌سازی الفبایی keys
    //    3. join با # (escape # به ##)
    //    4. مقادیر null/خالی → #
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// نرمال‌سازی JSON برای امضای دیجیتال
    /// </summary>
    /// <param name="obj">JObject یا List of JObject</param>
    /// <param name="headers">هدرهای اضافی (requestTraceId, timestamp, Authorization)</param>
    public static string NormalizeJson(object obj, Dictionary<string, string>? headers = null)
    {
        if (obj is null && headers is null)
            throw new ArgumentException("هم obj و هم headers خالی هستن");

        Dictionary<string, object>? map = null;

        // ═══ تبدیل obj به Dictionary ═══
        if (obj is not null)
        {
            // حالت ۱: رشته
            if (obj is string str)
            {
                obj = str.TrimStart().StartsWith("[")
                    ? (object)JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(str)!
                    : JsonConvert.DeserializeObject<object>(str)!;
            }

            // حالت ۲: List<T>
            if (obj is System.Collections.IList)
            {
                // ⭐ wrap در {packets: [...]}
                var wrapper = new PacketsWrapper(obj);
                map = ToDictionary(wrapper);
            }
            else
            {
                map = ToDictionary(obj);
            }
        }

        // ═══ اگه فقط headers داریم ═══
        if (map is null && headers is not null)
        {
            map = new Dictionary<string, object>();
            foreach (var h in headers)
                map.Add(h.Key, h.Value);
        }

        // ═══ merge headers با map ═══
        if (map is not null && headers is not null)
        {
            foreach (var h in headers)
                map[h.Key] = h.Value;
        }

        // ═══ flatten ═══
        var json = JsonConvert.SerializeObject(map);
        var flattened = JsonFlattener.Flatten(json);

        if (flattened.Count == 0) return string.Empty;

        // ═══ مرتب‌سازی کلیدها و ساخت رشته ═══
        var sb = new StringBuilder();
        var sortedKeys = flattened.Keys.OrderBy(k => k, StringComparer.Ordinal).ToList();

        foreach (var key in sortedKeys)
        {
            var textValue = NormalizeValue(flattened[key]);
            sb.Append(textValue).Append('#');
        }

        // حذف # آخر
        return sb.Remove(sb.Length - 1, 1).ToString();
    }

    private static string NormalizeValue(object? value)
    {
        if (value is null) return "#";

        var str = value.ToString() ?? "";

        // bool → lowercase (true/false)
        if (value is bool b)
            return b ? "true" : "false";

        // رشته‌ی "True"/"False" (از JSON) → lowercase
        if (str == "True" || str == "False")
            return str.ToLowerInvariant();

        // خالی → #
        if (string.IsNullOrEmpty(str))
            return "#";

        // escape: # → ##
        return str.Replace("#", "##");
    }

    private static Dictionary<string, object> ToDictionary(object obj)
    {
        var json = JsonConvert.SerializeObject(obj);
        var dict = JsonConvert.DeserializeObject<Dictionary<string, object>>(json);
        return dict ?? new Dictionary<string, object>();
    }

    /// <summary>فقط برای NormalizeJson — wrapping لیست در {packets: [...]}</summary>
    private class PacketsWrapper
    {
        // ⚠️ نام property باید exact "packets" باشه چون Delphi همین رو انتظار داره
        public object packets { get; }

        public PacketsWrapper(object packets)
        {
            this.packets = packets;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ۷. Verhoeff — تولید رقم کنترلی برای TaxId
    //  الگوریتم چک‌سام هندي
    // ═══════════════════════════════════════════════════════════

    private static readonly int[,] VerhoeffMul =
    {
        { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 },
        { 1, 2, 3, 4, 0, 6, 7, 8, 9, 5 },
        { 2, 3, 4, 0, 1, 7, 8, 9, 5, 6 },
        { 3, 4, 0, 1, 2, 8, 9, 5, 6, 7 },
        { 4, 0, 1, 2, 3, 9, 5, 6, 7, 8 },
        { 5, 9, 8, 7, 6, 0, 4, 3, 2, 1 },
        { 6, 5, 9, 8, 7, 1, 0, 4, 3, 2 },
        { 7, 6, 5, 9, 8, 2, 1, 0, 4, 3 },
        { 8, 7, 6, 5, 9, 3, 2, 1, 0, 4 },
        { 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 }
    };

    private static readonly int[,] VerhoeffPerm =
    {
        { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 },
        { 1, 5, 7, 6, 2, 8, 3, 0, 9, 4 },
        { 5, 8, 0, 3, 7, 9, 6, 1, 4, 2 },
        { 8, 9, 1, 6, 0, 4, 3, 5, 2, 7 },
        { 9, 4, 5, 3, 1, 2, 6, 8, 7, 0 },
        { 4, 2, 8, 6, 5, 7, 3, 9, 0, 1 },
        { 2, 7, 9, 3, 8, 0, 6, 4, 1, 5 },
        { 7, 0, 4, 6, 9, 1, 3, 2, 5, 8 }
    };

    private static readonly int[] VerhoeffInv = { 0, 4, 3, 2, 1, 5, 6, 7, 8, 9 };

    /// <summary>محاسبه رقم کنترلی Verhoeff</summary>
    public static int VerhoeffCheckSum(string number)
    {
        if (string.IsNullOrEmpty(number)) return 0;

        var c = 0;
        var len = number.Length;

        for (var i = 0; i < len; i++)
        {
            var digit = number[len - i - 1] - '0';
            c = VerhoeffMul[c, VerhoeffPerm[(i + 1) % 8, digit]];
        }

        return VerhoeffInv[c];
    }

    /// <summary>اعتبارسنجی عدد Verhoeff</summary>
    public static bool VerhoeffValidate(string number)
    {
        if (string.IsNullOrEmpty(number)) return false;

        var c = 0;
        var len = number.Length;

        for (var i = 0; i < len; i++)
        {
            var digit = number[len - i - 1] - '0';
            c = VerhoeffMul[c, VerhoeffPerm[i % 8, digit]];
        }

        return c == 0;
    }

    // ═══════════════════════════════════════════════════════════
    //  ۸. تولید TaxId یکتا
    //  (شماره‌ی منحصر بفرد مالیاتی)
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// تولید TaxId یکتا برای فاکتور
    /// </summary>
    /// <param name="memoryId">شناسه ۶ حرفی حافظه مالیاتی (tax_user_name)</param>
    /// <param name="serial">شماره سریال فاکتور (inno)</param>
    /// <param name="createDate">تاریخ ایجاد فاکتور</param>
    public static string GenerateTaxId(string memoryId, long serial, DateTime createDate)
    {
        if (string.IsNullOrWhiteSpace(memoryId))
            throw new ArgumentException("شناسه حافظه خالیه", nameof(memoryId));

        // ⭐ روز از Unix epoch
        var daysSinceEpoch = (int)(new DateTimeOffset(createDate).ToUnixTimeSeconds() / 86400L);
        var hexDays = Convert.ToString(daysSinceEpoch, 16);
        var hexSerial = Convert.ToString(serial, 16);

        // ⭐ مقدار مبنای checksum
        var decimalMemoryId = ToDecimalDigits(memoryId);
        var baseValue =
            decimalMemoryId +
            daysSinceEpoch.ToString().PadLeft(6, '0') +
            serial.ToString().PadLeft(12, '0');

        var checksum = VerhoeffCheckSum(baseValue);

        return (
            memoryId +
            hexDays.PadLeft(5, '0') +
            hexSerial.PadLeft(10, '0') +
            checksum
        ).ToUpperInvariant();
    }

    /// <summary>تبدیل حروف به اعداد (a=97، b=98، ...)</summary>
    private static string ToDecimalDigits(string memoryId)
    {
        var sb = new StringBuilder();
        foreach (var ch in memoryId)
        {
            if (char.IsDigit(ch))
                sb.Append(ch);
            else
                sb.Append((int)ch);
        }
        return sb.ToString();
    }
}

// ═════════════════════════════════════════════════════════════
//  JsonFlattener — پورت JsonHelper.DeserializeAndFlatten
// ═════════════════════════════════════════════════════════════

internal static class JsonFlattener
{
    public static Dictionary<string, object?> Flatten(string json)
    {
        var dict = new Dictionary<string, object?>();
        var token = JToken.Parse(json);
        FillDict(dict, token, prefix: "");
        return dict;
    }

    private static void FillDict(Dictionary<string, object?> dict, JToken token, string prefix)
    {
        switch (token.Type)
        {
            case JTokenType.Object:
                foreach (var prop in token.Children<JProperty>())
                    FillDict(dict, prop.Value, Join(prefix, prop.Name));
                break;

            case JTokenType.Array:
                var index = 0;
                foreach (var value in token.Children())
                {
                    FillDict(dict, value, Join(prefix, index.ToString()));
                    index++;
                }
                break;

            case JTokenType.Null:
                dict[prefix] = null;
                break;

            default:
                dict[prefix] = ((JValue)token).Value;
                break;
        }
    }

    private static string Join(string prefix, string name)
        => string.IsNullOrEmpty(prefix) ? name : $"{prefix}.{name}";
}