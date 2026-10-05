using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace ArianaAPI.Infrastructure.Services.Moadian;

/// <summary>
/// سرویس اتصال به سامانه مودیان
/// پورت شده از TaxCollector.cs (WinForms .NET 4.6.2)
/// </summary>
public class MoadianService : IMoadianService
{
    private readonly HttpClient _http;
    private readonly ILogger<MoadianService> _logger;

    public MoadianOptions Options { get; }

    public MoadianService(HttpClient http, MoadianOptions options, ILogger<MoadianService> logger)
    {
        _http = http;
        _logger = logger;
        Options = options;
        if (_http.Timeout == TimeSpan.FromSeconds(100))
            _http.Timeout = TimeSpan.FromSeconds(30);
    }

    // ═══════════════════════════════════════════════════════════
    //  ۱. GET_SERVER_INFORMATION (بدون امضا)
    // ═══════════════════════════════════════════════════════════
    public async Task<MoadianServerInfoResponse> GetServerInformationAsync(CancellationToken ct = default)
    {
        try
        {
            var packet = new JObject
            {
                ["uid"] = null,
                ["packetType"] = "GET_SERVER_INFORMATION",
                ["retry"] = false,
                ["data"] = null,
                ["encryptionKeyId"] = null,
                ["symmetricKey"] = "",
                ["iv"] = "",
                ["fiscalId"] = "",
                ["dataSignature"] = ""
            };

            var body = new JObject
            {
                ["packet"] = packet,
                ["time"] = 1
            };

            var traceId = Guid.NewGuid().ToString();
            var timestamp = DateTime.Now.ToFileTime().ToString();

            var response = await SendRequestAsync("sync/GET_SERVER_INFORMATION", body, null, traceId, timestamp, ct);

            if (!response.Ok)
                return new MoadianServerInfoResponse { Success = false, Error = response.Error };

            var json = response.Json!;
            if (json["result"] is null)
                return new MoadianServerInfoResponse { Success = false, Error = ParseErrors(json) };

            var data = json["result"]!["data"]!;
            var publicKey = data["publicKeys"]![0]!;

            return new MoadianServerInfoResponse
            {
                Success = true,
                ServerTime = data["serverTime"]?.Value<string>(),
                PublicKey = publicKey["key"]?.Value<string>(),
                PublicKeyId = publicKey["id"]?.Value<string>(),
                PublicKeyAlgorithm = publicKey["algorithm"]?.Value<string>(),
                PublicKeyPurpose = publicKey["purpose"]?.Value<string>()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در GET_SERVER_INFORMATION");
            return new MoadianServerInfoResponse { Success = false, Error = ex.Message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ۲. GET_TOKEN
    // ═══════════════════════════════════════════════════════════
    public async Task<MoadianTokenResponse> GetTokenAsync(CancellationToken ct = default)
    {
        try
        {
            var packet = new JObject
            {
                ["uid"] = null,
                ["packetType"] = "GET_TOKEN",
                ["retry"] = false,
                ["data"] = new JObject { ["username"] = Options.TaxUserName },
                ["encryptionKeyId"] = null,
                ["symmetricKey"] = "",
                ["iv"] = "",
                ["fiscalId"] = "",
                ["dataSignature"] = ""
            };

            var traceId = Guid.NewGuid().ToString();
            var timestamp = DateTime.Now.ToFileTime().ToString();

            var body = BuildSignedBody(packet, traceId, timestamp);
            var response = await SendRequestAsync("sync/GET_TOKEN", body, null, traceId, timestamp, ct);

            if (!response.Ok)
                return new MoadianTokenResponse { Success = false, Error = response.Error };

            var json = response.Json!;
            if (json["result"] is null)
                return new MoadianTokenResponse { Success = false, Error = ParseErrors(json) };

            var data = json["result"]!["data"]!;
            return new MoadianTokenResponse
            {
                Success = true,
                Token = data["token"]?.Value<string>(),
                ExpiresIn = data["expiresIn"]?.Value<long>() ?? 0
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در GET_TOKEN");
            return new MoadianTokenResponse { Success = false, Error = ex.Message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ۳. GET_FISCAL_INFORMATION
    // ═══════════════════════════════════════════════════════════
    public async Task<MoadianFiscalInfoResponse> GetFiscalInformationAsync(string token, CancellationToken ct = default)
    {
        try
        {
            var packet = new JObject
            {
                ["uid"] = null,
                ["packetType"] = "GET_FISCAL_INFORMATION",
                ["retry"] = false,
                ["data"] = null,
                ["encryptionKeyId"] = null,
                ["symmetricKey"] = "",
                ["iv"] = "",
                ["fiscalId"] = Options.TaxUserName,
                ["dataSignature"] = ""
            };

            var timeSpan = DateTime.Now.ToFileTime().ToString();
            var traceId = timeSpan;
            var timestamp = timeSpan;

            var body = BuildSignedBody(packet, traceId, timestamp, token);   // ← token اضافه شد
            var response = await SendRequestAsync("sync/GET_FISCAL_INFORMATION", body, token, traceId, timestamp, ct);

            if (!response.Ok)
                return new MoadianFiscalInfoResponse { Success = false, Error = response.Error };

            var json = response.Json!;
            if (json["result"] is null)
                return new MoadianFiscalInfoResponse { Success = false, Error = ParseErrors(json) };

            var data = json["result"]!["data"]!;
            return new MoadianFiscalInfoResponse
            {
                Success = true,
                NameTrade = data["nameTrade"]?.Value<string>(),
                FiscalStatus = data["fiscalStatus"]?.Value<string>(),
                SaleThreshold = data["saleThreshold"]?.Value<double?>(),
                EconomicCode = data["economicCode"]?.Value<string>()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در GET_FISCAL_INFORMATION");
            return new MoadianFiscalInfoResponse { Success = false, Error = ex.Message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ۴. GET_SERVICE_STUFF_LIST
    // ═══════════════════════════════════════════════════════════
    public async Task<MoadianServiceStuffListResponse> GetServiceStuffListAsync(int page = 1, int size = 10, CancellationToken ct = default)
    {
        try
        {
            var packet = new JObject
            {
                ["uid"] = null,
                ["packetType"] = "GET_SERVICE_STUFF_LIST",
                ["retry"] = false,
                ["data"] = new JObject { ["page"] = page, ["size"] = size },
                ["encryptionKeyId"] = null,
                ["symmetricKey"] = "",
                ["iv"] = "",
                ["fiscalId"] = "",
                ["dataSignature"] = ""
            };

            var timeSpan = DateTime.Now.ToFileTime().ToString();
            var traceId = timeSpan;
            var timestamp = timeSpan;

            var body = BuildSignedBody(packet, traceId, timestamp);
            var response = await SendRequestAsync("sync/GET_SERVICE_STUFF_LIST", body, null, traceId, timestamp, ct);

            if (!response.Ok)
                return new MoadianServiceStuffListResponse { Success = false, Error = response.Error };

            var json = response.Json!;
            if (json["result"] is null)
                return new MoadianServiceStuffListResponse { Success = false, Error = ParseErrors(json) };

            var list = new List<MoadianServiceStuffModel>();
            foreach (var item in json["result"]!["data"]!["result"]!)
            {
                list.Add(new MoadianServiceStuffModel
                {
                    ItemId = item["itemId"]?.Value<long>() ?? 0,
                    Tax = item["tax"]?.Value<double>() ?? 0
                });
            }

            return new MoadianServiceStuffListResponse { Success = true, Result = list };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در GET_SERVICE_STUFF_LIST");
            return new MoadianServiceStuffListResponse { Success = false, Error = ex.Message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ۵. GET_ECONOMIC_CODE_INFORMATION
    // ═══════════════════════════════════════════════════════════
    public async Task<MoadianEconomicCodeInfoResponse> GetEconomicCodeInfoAsync(string economicCode, CancellationToken ct = default)
    {
        try
        {
            var packet = new JObject
            {
                ["uid"] = null,
                ["packetType"] = "GET_ECONOMIC_CODE_INFORMATION",
                ["retry"] = false,
                ["data"] = new JObject { ["economicCode"] = economicCode },
                ["encryptionKeyId"] = null,
                ["symmetricKey"] = "",
                ["iv"] = "",
                ["fiscalId"] = Options.TaxUserName,
                ["dataSignature"] = ""
            };

            var timeSpan = DateTime.Now.ToFileTime().ToString();
            var traceId = timeSpan;
            var timestamp = timeSpan;

            var body = BuildSignedBody(packet, traceId, timestamp);
            var response = await SendRequestAsync("sync/GET_ECONOMIC_CODE_INFORMATION", body, null, traceId, timestamp, ct);

            if (!response.Ok)
                return new MoadianEconomicCodeInfoResponse { Success = false, Error = response.Error };

            var json = response.Json!;
            if (json["result"] is null)
                return new MoadianEconomicCodeInfoResponse { Success = false, Error = ParseErrors(json) };

            if (json["result"]!["packetType"]?.Value<string>()?.ToLower() == "error")
                return new MoadianEconomicCodeInfoResponse { Success = false, Error = "کد اقتصادی یافت نشد" };

            var data = json["result"]!["data"]!;
            return new MoadianEconomicCodeInfoResponse
            {
                Success = true,
                NameTrade = data["nameTrade"]?.Value<string>(),
                TaxpayerStatus = data["taxpayerStatus"]?.Value<string>(),
                TaxpayerType = data["taxpayerType"]?.Value<string>(),
                PostalCodeTaxpayer = data["postalcodeTaxpayer"]?.Value<string>(),
                AddressTaxpayer = data["addressTaxpayer"]?.Value<string>()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در GET_ECONOMIC_CODE_INFORMATION");
            return new MoadianEconomicCodeInfoResponse { Success = false, Error = ex.Message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ۶-۹. INQUIRY
    // ═══════════════════════════════════════════════════════════
    public async Task<MoadianInquiryResponse> InquiryByUidAsync(string token, List<MoadianUidModel> uids, CancellationToken ct = default)
    {
        var uidArray = uids.Select(u => new JObject
        {
            ["fiscalId"] = u.FiscalId,
            ["uid"] = u.Uid
        }).ToList();

        return await InquiryBase("INQUIRY_BY_UID", token, JToken.FromObject(uidArray), ct);
    }

    public async Task<MoadianInquiryResponse> InquiryByReferenceNumberAsync(string token, string[] refNumbers, CancellationToken ct = default)
    {
        var data = new JObject { ["referenceNumber"] = JToken.FromObject(refNumbers) };
        return await InquiryBase("INQUIRY_BY_REFERENCE_NUMBER", token, data, ct);
    }

    public async Task<MoadianInquiryResponse> InquiryByTimeAsync(string token, string time, CancellationToken ct = default)
    {
        var data = new JObject { ["time"] = time };
        return await InquiryBase("INQUIRY_BY_TIME", token, data, ct);
    }

    public async Task<MoadianInquiryResponse> InquiryByTimeRangeAsync(string token, string startDate, string endDate, CancellationToken ct = default)
    {
        var data = new JObject { ["startDate"] = startDate, ["endDate"] = endDate };
        return await InquiryBase("INQUIRY_BY_TIME_RANGE", token, data, ct);
    }

    private async Task<MoadianInquiryResponse> InquiryBase(string packetType, string token, JToken data, CancellationToken ct)
    {
        try
        {
            var packet = new JObject
            {
                ["uid"] = null,
                ["packetType"] = packetType,
                ["retry"] = false,
                ["data"] = data,
                ["encryptionKeyId"] = null,
                ["symmetricKey"] = "",
                ["iv"] = "",
                ["fiscalId"] = "",
                ["dataSignature"] = ""
            };

            var timeSpan = DateTime.Now.ToFileTime().ToString();
            var traceId = timeSpan;
            var timestamp = timeSpan;

            var body = BuildSignedBody(packet, traceId, timestamp, token);   // ← token پاس داده شد
            var response = await SendRequestAsync($"sync/{packetType}", body, token, traceId, timestamp, ct);

            if (!response.Ok)
                return new MoadianInquiryResponse { Success = false, Error = response.Error };

            var json = response.Json!;
            if (json["result"] is null)
                return new MoadianInquiryResponse { Success = false, Error = ParseErrors(json) };

            return new MoadianInquiryResponse { Success = true, Result = ParseInquiry(json) };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در {PacketType}", packetType);
            return new MoadianInquiryResponse { Success = false, Error = ex.Message };
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ۱۰. ENQUEUE
    // ═══════════════════════════════════════════════════════════
    public async Task<MoadianEnqueueResponse> EnqueueAsync(
        string token, string serverPublicKey, string encryptionKeyId,
        string packetType, string uid, MoadianInvoice invoice, CancellationToken ct = default)
    {
        try
        {
            // ⭐ ۱. تبدیل فاکتور به JSON
            var invoiceJson = JsonConvert.SerializeObject(invoice).Replace(".0,\"", ",\"");
            var invoiceBytes = Encoding.UTF8.GetBytes(invoiceJson);

            // ⭐ ۲. امضای فاکتور (بدون trace headers)
            var dataSignature = MoadianCryptoHelper.SignData(
                MoadianCryptoHelper.NormalizeJson(invoice),
                Options.PrivateKey);

            // ⭐ ۳. تولید کلید AES + IV
            var symmetricKey = MoadianCryptoHelper.GenerateAesSecretKey();
            var iv = MoadianCryptoHelper.GenerateIv();

            // ⭐ ۴. رمزنگاری کلید AES با کلید عمومی سرور
            var symKeyHex = BitConverter.ToString(symmetricKey).Replace("-", "");
            var encryptedSymKey = MoadianCryptoHelper.EncryptWithServerPublicKey(symKeyHex, serverPublicKey);

            // ⭐ ۵. XOR + AES-GCM روی payload
            var xored = MoadianCryptoHelper.Xor(invoiceBytes, symmetricKey);
            var encryptedData = MoadianCryptoHelper.AesEncrypt(xored, symmetricKey, iv);

            // ⭐ ۶. ساخت packet داخلی
            var packet = new JObject
            {
                ["uid"] = uid,
                ["packetType"] = packetType,
                ["retry"] = false,
                ["data"] = encryptedData,
                ["encryptionKeyId"] = encryptionKeyId,
                ["symmetricKey"] = encryptedSymKey,
                ["iv"] = BitConverter.ToString(iv).Replace("-", ""),
                ["fiscalId"] = Options.TaxUserName,
                ["dataSignature"] = dataSignature
            };

            // ⭐ ۷. traceId و timestamp یکسان (طبق WinForms ENQUEUE)
            var timeSpan = DateTime.Now.ToFileTime().ToString();
            var traceId = timeSpan;
            var timestamp = timeSpan;

            // ⭐ ۸. headers — دقیقاً مثل WinForms (شامل Authorization با توکن خام)
            var traceHeaders = new Dictionary<string, string>
            {
                ["requestTraceId"] = traceId,
                ["timestamp"] = timestamp,
                ["Authorization"] = token ?? ""   // ← ⭐ توکن خام، بدون "Bearer "
            };

            // ⭐ ۹. برای امضا: {packet: obj} — ⭐⭐ مفرد! (نه {packets: [...]})
            var outerPacket = new JObject
            {
                ["packet"] = packet               // ← ⭐ این خط جادوئیه
            };

            // ⭐ ۱۰. Log برای دیباگ
            Console.WriteLine("═══ ENQUEUE OUTER NORMALIZED ═══");
            var outerNormalized = MoadianCryptoHelper.NormalizeJson(outerPacket, traceHeaders);
            Console.WriteLine(outerNormalized);
            Console.WriteLine("═══ END ═══");

            // ⭐ ۱۱. امضا
            var outerSignature = MoadianCryptoHelper.SignData(outerNormalized, Options.PrivateKey);

            // ⭐ ۱۲. body نهایی — اینجا جمع میشه
            var body = new JObject
            {
                ["packets"] = new JArray(packet),   // ← ⭐ جمع + آرایه
                ["signatureKeyId"] = null,
                ["signature"] = outerSignature,
                ["time"] = 1
            };

            // ⭐ ۱۱. ارسال
            var response = await SendRequestAsync("async/normal-enqueue", body, token, traceId, timestamp, ct);

            if (!response.Ok)
                return new MoadianEnqueueResponse { Success = false, Error = response.Error, Uid = uid };

            var json = response.Json!;
            if (json["result"] is null)
                return new MoadianEnqueueResponse { Success = false, Error = ParseErrors(json), Uid = uid };

            var first = json["result"]![0]!;
            var errorCode = first["errorCode"]?.Value<int?>();

            if (errorCode is null)
            {
                return new MoadianEnqueueResponse
                {
                    Success = true,
                    ReferenceNumber = first["referenceNumber"]?.Value<string>(),
                    Uid = uid
                };
            }

            return new MoadianEnqueueResponse
            {
                Success = false,
                Error = first["errorDetail"]?.Value<string>() ?? "خطای ناشناخته",
                Uid = uid
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در ENQUEUE");
            return new MoadianEnqueueResponse { Success = false, Error = ex.Message, Uid = uid };
        }
    }
    // ═══════════════════════════════════════════════════════════
    //  ۱۱. ENQUEUE_Multiple
    // ═══════════════════════════════════════════════════════════
    public async Task<List<MoadianEnqueueResponse>> EnqueueMultipleAsync(
        string token, string serverPublicKey, string encryptionKeyId,
        string packetType, List<MoadianComplexInvoice> invoices, CancellationToken ct = default)
    {
        var results = new List<MoadianEnqueueResponse>();
        try
        {
            var packets = new JArray();

            foreach (var item in invoices)
            {
                var invoiceJson = JsonConvert.SerializeObject(item.Invoice).Replace(".0,\"", ",\"");
                var invoiceBytes = Encoding.UTF8.GetBytes(invoiceJson);

                var dataSignature = MoadianCryptoHelper.SignData(
                    MoadianCryptoHelper.NormalizeJson(item.Invoice),
                    Options.PrivateKey);

                var symmetricKey = MoadianCryptoHelper.GenerateAesSecretKey();
                var iv = MoadianCryptoHelper.GenerateIv();

                var symKeyHex = BitConverter.ToString(symmetricKey).Replace("-", "");
                var encryptedSymKey = MoadianCryptoHelper.EncryptWithServerPublicKey(symKeyHex, serverPublicKey);

                var xored = MoadianCryptoHelper.Xor(invoiceBytes, symmetricKey);
                var encryptedData = MoadianCryptoHelper.AesEncrypt(xored, symmetricKey, iv);

                packets.Add(new JObject
                {
                    ["uid"] = item.Uid,
                    ["packetType"] = packetType,
                    ["retry"] = false,
                    ["data"] = encryptedData,
                    ["encryptionKeyId"] = encryptionKeyId,
                    ["symmetricKey"] = encryptedSymKey,
                    ["iv"] = BitConverter.ToString(iv).Replace("-", ""),
                    ["fiscalId"] = Options.TaxUserName,
                    ["dataSignature"] = dataSignature
                });
            }

            // ⭐ توی ENQUEUE، هر دو باید یکسان باشن (طبق WinForms)
            var timeSpan = DateTime.Now.ToFileTime().ToString();
            var traceId = timeSpan;
            var timestamp = timeSpan;

            var traceHeaders = new Dictionary<string, string>
            {
                ["requestTraceId"] = traceId,
                ["timestamp"] = timestamp
            };

            // ⭐ امضای بیرونی روی همه‌ی packets با trace headers
            // ⭐ امضای بیرونی روی { packets: [...] } — بدون wrap اضافی
            var outerBody = new JObject
            {
                ["packets"] = packets,
                ["signatureKeyId"] = null,
                ["time"] = 1
            };

            var outerSignature = MoadianCryptoHelper.SignData(
                MoadianCryptoHelper.NormalizeJson(outerBody, traceHeaders),
                Options.PrivateKey);

            var body = new JObject
            {
                ["packets"] = packets,
                ["signatureKeyId"] = null,
                ["signature"] = outerSignature,
                ["time"] = 1
            };

            var response = await SendRequestAsync("async/normal-enqueue", body, token, traceId, timestamp, ct);

            if (!response.Ok)
            {
                results.Add(new MoadianEnqueueResponse { Success = false, Error = response.Error });
                return results;
            }

            var json = response.Json!;
            if (json["result"] is null)
            {
                results.Add(new MoadianEnqueueResponse { Success = false, Error = ParseErrors(json) });
                return results;
            }

            foreach (var item in json["result"]!)
            {
                var uid = item["uid"]?.Value<string>() ?? "";
                var errorCode = item["errorCode"]?.Value<int?>();

                if (errorCode is null)
                {
                    results.Add(new MoadianEnqueueResponse
                    {
                        Success = true,
                        ReferenceNumber = item["referenceNumber"]?.Value<string>(),
                        Uid = uid
                    });
                }
                else
                {
                    results.Add(new MoadianEnqueueResponse
                    {
                        Success = false,
                        Error = item["errorDetail"]?.Value<string>() ?? "خطای ناشناخته",
                        Uid = uid
                    });
                }
            }

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در ENQUEUE_Multiple");
            results.Add(new MoadianEnqueueResponse { Success = false, Error = ex.Message });
            return results;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════

    /// <summary>ساخت body امضاشده (packet + time + signature) با traceId/timestamp یکسان</summary>
    private JObject BuildSignedBody(JObject packet, string traceId, string timestamp, string? authorization = null)
    {
        var traceHeaders = new Dictionary<string, string>
        {
            ["requestTraceId"] = traceId,
            ["timestamp"] = timestamp
        };

        // ⭐ Authorization باید توی امضا باشه (طبق WinForms) — توکن خام، بدون "Bearer "
        if (!string.IsNullOrEmpty(authorization))
            traceHeaders["Authorization"] = authorization;

        var normalizeJson = MoadianCryptoHelper.NormalizeJson(packet, traceHeaders);

        Console.WriteLine("═══════════════════════════════════");
        Console.WriteLine("📝 Normalized String:");
        Console.WriteLine(normalizeJson);
        Console.WriteLine("═══════════════════════════════════");

        // ⭐ Log ۲: امضا
        var signature = MoadianCryptoHelper.SignData(normalizeJson, Options.PrivateKey);
        Console.WriteLine("🔐 Signature (Base64):");
        Console.WriteLine(signature);
        Console.WriteLine("═══════════════════════════════════");

        return new JObject
        {
            ["packet"] = packet,
            ["time"] = 1,
            ["signature"] = signature
        };
    }

    /// <summary>ارسال HTTP POST با همون traceId/timestamp که امضا شده</summary>
    /// <summary>ارسال HTTP POST با همون traceId/timestamp که امضا شده</summary>
    private async Task<(bool Ok, JObject? Json, string? Error)> SendRequestAsync(
        string endpoint, JObject body, string? token,
        string traceId, string timestamp, CancellationToken ct)
    {
        try
        {
            var url = Options.BaseUrl + endpoint;

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.TryAddWithoutValidation("requestTraceId", traceId);
            request.Headers.TryAddWithoutValidation("timestamp", timestamp);

            if (!string.IsNullOrEmpty(token))
                request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {token}");

            // ⭐ اینجا body رو یه بار به رشته تبدیل کن
            var bodyJson = body.ToString(Formatting.None);

            // ⭐ Log (اختیاری — اگه نمی‌خوای، کامنت کن)
            Console.WriteLine("═══════════════════════════════════");
            Console.WriteLine("📤 Request Body:");
            Console.WriteLine(bodyJson);
            Console.WriteLine($"🔑 requestTraceId: {traceId}");
            Console.WriteLine($"🔑 timestamp: {timestamp}");
            Console.WriteLine($"🔗 URL: {url}");
            Console.WriteLine("═══════════════════════════════════");

            var content = new StringContent(bodyJson, Encoding.UTF8);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            request.Content = content;

            var response = await _http.SendAsync(request, ct);

            // ⭐ این خط مهمه — responseBody رو اینجا تعریف کن
            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("مودیان خطا داد: {StatusCode} — {Body}",
                    response.StatusCode, responseBody);

                return (false, null,
                    $"ارتباط با سرور مودیان برقرار نشد. کد {(int)response.StatusCode} {response.StatusCode}\n{responseBody}");
            }

            var json = JObject.Parse(responseBody);
            return (true, json, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در ارتباط با {Endpoint}", endpoint);
            return (false, null, ex.Message);
        }
    }

    private static string ParseErrors(JObject json)
    {
        try
        {
            if (json["error"] != null)
                return json["error"]!["code"]?.Value<string>() ?? "خطای نامشخص";

            if (json["errors"] != null && json["errors"]!.Any())
                return json["errors"]![0]!["detail"]?.Value<string>() ?? "خطای نامشخص";
        }
        catch { }
        return "خطای نامشخص";
    }

    private static List<MoadianInquiryModel> ParseInquiry(JObject json)
    {
        var list = new List<MoadianInquiryModel>();

        // ⭐⭐ لاگ پاسخ خام سرور — برای دیباگ
        Console.WriteLine("═══════════════════════════════════");
        Console.WriteLine("🔍 MOADIAN RAW INQUIRY RESPONSE:");
        Console.WriteLine(json.ToString(Newtonsoft.Json.Formatting.Indented));
        Console.WriteLine("═══════════════════════════════════");

        foreach (var item in json["result"]!["data"]!)
        {
            var model = new MoadianInquiryModel
            {
                Uid = item["uid"]?.Value<string>(),
                ReferenceNumber = item["referenceNumber"]?.Value<string>(),
                Status = item["status"]?.Value<string>(),
                PacketType = item["packetType"]?.Value<string>(),
                FiscalId = item["fiscalId"]?.Value<string>()
            };

            var data = item["data"];
            if (data is JArray dataArr && dataArr.Count > 0)
            {
                var first = dataArr[0];
                var msg = first["msg"]?.Value<string>() ?? first["message"]?.Value<string>();
                if (!string.IsNullOrEmpty(msg))
                {
                    model.Errors.Add(new MoadianInquiryDataModel
                    {
                        Msg = msg,
                        Code = first["code"]?.Value<string>()
                    });
                }
            }
            else if (data is JObject dataObj)
            {
                model.ConfirmationReferenceId = dataObj["confirmationReferenceId"]?.Value<string>();
                model.TaxResult = dataObj["taxResult"]?.Value<string>();

                if (dataObj["error"] is JArray errors)
                {
                    foreach (var e in errors)
                    {
                        model.Errors.Add(new MoadianInquiryDataModel
                        {
                            Msg = e["msg"]?.Value<string>() ?? e["message"]?.Value<string>(),
                            Code = e["code"]?.Value<string>()
                        });
                    }
                }

                if (dataObj["warning"] is JArray warnings)
                {
                    foreach (var w in warnings)
                    {
                        model.Warnings.Add(new MoadianInquiryDataModel
                        {
                            Msg = w["msg"]?.Value<string>() ?? w["message"]?.Value<string>(),
                            Code = w["code"]?.Value<string>()
                        });
                    }
                }
            }

            list.Add(model);
        }

        return list;
    }
}