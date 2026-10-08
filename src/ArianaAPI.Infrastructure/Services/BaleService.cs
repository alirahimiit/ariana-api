using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using ArianaAPI.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace ArianaAPI.Infrastructure.Services
{
    public class BaleService : IBaleService
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;

        public BaleService(HttpClient httpClient, IConfiguration config)
        {
            _httpClient = httpClient;
            _baseUrl = config["Bale:BaseUrl"] ?? "https://tapi.bale.ai/bot";
        }

        public async Task<(bool Success, string Message)> TestConnectionAsync(string token)
        {
            try
            {
                var url = $"{_baseUrl}{token}/getMe";
                var response = await _httpClient.GetAsync(url);
                var result = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                    return (true, result);

                return (false, $"خطا در اتصال: {result}");
            }
            catch (Exception ex)
            {
                return (false, $"خطای سیستمی: {ex.Message}");
            }
        }

        public async Task<(bool Success, string Message)> GetUpdatesAsync(string token, long? offset = null)
        {
            try
            {
                var url = $"{_baseUrl}{token}/getUpdates";
                if (offset.HasValue && offset.Value > 0)
                    url += $"?offset={offset.Value}";

                var response = await _httpClient.GetAsync(url);
                var result = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                    return (true, result);

                return (false, $"خطا در دریافت: {result}");
            }
            catch (Exception ex)
            {
                return (false, $"خطای سیستمی: {ex.Message}");
            }
        }

        public async Task<(bool Success, string Message)> SendMessageAsync(
            string token,
            long chatId,
            string text,
            List<List<BaleInlineButton>>? buttons = null)
        {
            try
            {
                var url = $"{_baseUrl}{token}/sendMessage";

                object payload;
                if (buttons != null && buttons.Count > 0)
                {
                    var keyboard = new
                    {
                        inline_keyboard = buttons.Select(row =>
                            row.Select(b => new { text = b.Text, callback_data = b.CallbackData }).ToArray()
                        ).ToArray()
                    };
                    payload = new { chat_id = chatId, text = text, reply_markup = keyboard };
                }
                else
                {
                    payload = new { chat_id = chatId, text = text };
                }

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, content);
                var result = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                    return (true, "پیام با موفقیت ارسال شد.");

                return (false, $"خطا در ارسال: {result}");
            }
            catch (Exception ex)
            {
                return (false, $"خطای سیستمی: {ex.Message}");
            }
        }
    }
}