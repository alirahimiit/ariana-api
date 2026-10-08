using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services
{
    public class SupportRelayClient
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _config;
        private readonly ILogger<SupportRelayClient> _logger;

        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public SupportRelayClient(
            HttpClient http,
            IConfiguration config,
            ILogger<SupportRelayClient> logger)
        {
            _http = http;
            _config = config;
            _logger = logger;
        }

        private string GetRelayUrl() => _config["Support:RelayUrl"] ?? "";

        private object? LoadLicense()
        {
            try
            {
                var path = Path.Combine(AppContext.BaseDirectory, "ariana.lic");
                if (!File.Exists(path))
                {
                    _logger.LogWarning("ariana.lic پیدا نشد: {Path}", path);
                    return null;
                }
                var json = File.ReadAllText(path, Encoding.UTF8);
                return JsonSerializer.Deserialize<object>(json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "خطا در خواندن لایسنس");
                return null;
            }
        }

        private object? LoadLicensePayload()
        {
            try
            {
                var path = Path.Combine(AppContext.BaseDirectory, "ariana.lic");
                if (!File.Exists(path)) return null;
                var json = File.ReadAllText(path, Encoding.UTF8);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("payload", out var payload))
                {
                    return JsonSerializer.Deserialize<object>(payload.GetRawText());
                }
                return null;
            }
            catch { return null; }
        }

        public async Task<(bool Success, string Message)> SendAsync(
            string sessionId,
            long? userId, string? userName,
            long orgId, long fyId, string? orgName, string? fyName,
            string message,
            CancellationToken ct = default)
        {
            try
            {
                var relayUrl = GetRelayUrl();
                if (string.IsNullOrWhiteSpace(relayUrl))
                    return (false, "آدرس Relay تنظیم نشده است");

                var license = LoadLicense();
                if (license == null)
                    return (false, "فایل لایسنس پیدا نشد");

                var body = new
                {
                    license,
                    sessionId,
                    userId,
                    userName,
                    orgId,
                    fyId,
                    orgName,
                    fyName,
                    message
                };

                var json = JsonSerializer.Serialize(body, _jsonOptions);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = relayUrl.TrimEnd('/') + "/api/support/send";
                var resp = await _http.PostAsync(url, content, ct);
                var respBody = await resp.Content.ReadAsStringAsync(ct);

                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Relay send error: {Status} - {Body}", resp.StatusCode, respBody);
                    return (false, "خطا در ارسال به پشتیبانی");
                }

                return (true, "پیام شما ارسال شد");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "خطا در SendAsync");
                return (false, $"خطای ارتباط: {ex.Message}");
            }
        }

        public async Task<string> PollAsync(string sessionId, int sinceId, CancellationToken ct = default)
        {
            try
            {
                var relayUrl = GetRelayUrl();
                if (string.IsNullOrWhiteSpace(relayUrl)) return "{\"items\":[]}";

                var license = LoadLicense();
                if (license == null) return "{\"items\":[]}";

                var body = new { license, sessionId, sinceId };
                var json = JsonSerializer.Serialize(body, _jsonOptions);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = relayUrl.TrimEnd('/') + "/api/support/poll";
                var resp = await _http.PostAsync(url, content, ct);

                if (!resp.IsSuccessStatusCode) return "{\"items\":[]}";

                return await resp.Content.ReadAsStringAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "خطا در PollAsync");
                return "{\"items\":[]}";
            }
        }
    }
}