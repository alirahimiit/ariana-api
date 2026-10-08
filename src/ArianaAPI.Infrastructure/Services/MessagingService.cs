using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ArianaAPI.Application.Dtos.Messaging;
using ArianaAPI.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services
{
    public class MessagingService : IMessagingService
    {
        private const byte PLATFORM_BALE = 1;
        private const int DIRECTION_INCOMING = 1;
        private const int DIRECTION_OUTGOING = 2;

        private readonly IBaleService _baleService;
        private readonly IMessagingRepository _repo;
        private readonly IBotConfigRepository _configRepo;
        private readonly ILogger<MessagingService> _logger;

        public MessagingService(
            IBaleService baleService,
            IMessagingRepository repo,
            IBotConfigRepository configRepo,
            ILogger<MessagingService> logger)
        {
            _baleService = baleService;
            _repo = repo;
            _configRepo = configRepo;
            _logger = logger;
        }

        // ═══════════════════════════════════════════════════════
        //  PROCESS UPDATES
        // ═══════════════════════════════════════════════════════
        public async Task ProcessUpdatesAsync(string botToken, long orgId, long fyId, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(botToken))
            {
                _logger.LogWarning("توکن ربات خالی است — Tenant {OrgId}/{FyId} رد شد", orgId, fyId);
                return;
            }

            var lastUpdateId = await _repo.GetLastUpdateIdAsync(orgId, fyId, PLATFORM_BALE, ct);
            var offset = lastUpdateId + 1;

            var result = await _baleService.GetUpdatesAsync(botToken, offset);
            if (!result.Success)
            {
                _logger.LogWarning("Bale getUpdates خطا داد: {Msg}", result.Message);
                return;
            }

            JsonDocument doc;
            try { doc = JsonDocument.Parse(result.Message); }
            catch (Exception ex) { _logger.LogError(ex, "خطا در parse پاسخ بله"); return; }

            using (doc)
            {
                if (!doc.RootElement.TryGetProperty("ok", out var okEl) || !okEl.GetBoolean())
                    return;

                if (!doc.RootElement.TryGetProperty("result", out var arr) ||
                    arr.ValueKind != JsonValueKind.Array)
                    return;

                long maxUpdateId = lastUpdateId;

                foreach (var update in arr.EnumerateArray())
                {
                    if (ct.IsCancellationRequested) break;
                    try
                    {
                        var currentUpdateId = update.TryGetProperty("update_id", out var uidEl)
                            ? uidEl.GetInt64() : 0;

                        if (currentUpdateId > maxUpdateId) maxUpdateId = currentUpdateId;

                        if (update.TryGetProperty("message", out var msg))
                            await ProcessSingleMessageAsync(botToken, orgId, fyId, msg, ct);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "خطا در پردازش update");
                    }
                }

                if (maxUpdateId > lastUpdateId)
                    await _repo.SetLastUpdateIdAsync(orgId, fyId, PLATFORM_BALE, maxUpdateId, ct);
            }
        }

        private async Task ProcessSingleMessageAsync(
            string botToken, long orgId, long fyId, JsonElement msg, CancellationToken ct)
        {
            if (!msg.TryGetProperty("chat", out var chatEl)) return;
            if (!chatEl.TryGetProperty("id", out var chatIdEl)) return;

            var platformChatId = chatIdEl.GetInt64();
            var chatType = chatEl.TryGetProperty("type", out var typeEl) ? typeEl.GetString() ?? "private" : "private";
            var title = GetChatTitle(chatEl, msg);
            var username = chatEl.TryGetProperty("username", out var uEl) ? uEl.GetString() ?? "" : "";

            var senderName = "";
            long senderUserId = 0;
            if (msg.TryGetProperty("from", out var fromEl))
            {
                if (fromEl.TryGetProperty("id", out var fromIdEl)) senderUserId = fromIdEl.GetInt64();
                var fn = fromEl.TryGetProperty("first_name", out var fnEl) ? fnEl.GetString() ?? "" : "";
                var ln = fromEl.TryGetProperty("last_name", out var lnEl) ? lnEl.GetString() ?? "" : "";
                senderName = $"{fn} {ln}".Trim();
            }

            if (senderUserId == 0 || IsFromBot(msg)) return;

            if (!msg.TryGetProperty("text", out var textEl) &&
                !msg.TryGetProperty("caption", out textEl))
            {
                if (!(msg.TryGetProperty("photo", out _) ||
                      msg.TryGetProperty("video", out _) ||
                      msg.TryGetProperty("voice", out _) ||
                      msg.TryGetProperty("audio", out _) ||
                      msg.TryGetProperty("document", out _)))
                    return;
            }

            var messageText = textEl.ValueKind == JsonValueKind.String ? textEl.GetString() ?? "" : "";

            var messageType = "text";
            string fileId = "";
            if (msg.TryGetProperty("photo", out var photoEl) && photoEl.ValueKind == JsonValueKind.Array)
            {
                messageType = "photo";
                var first = photoEl.EnumerateArray().FirstOrDefault();
                if (first.ValueKind == JsonValueKind.Object && first.TryGetProperty("file_id", out var fEl))
                    fileId = fEl.GetString() ?? "";
            }
            else if (msg.TryGetProperty("video", out var videoEl))
            {
                messageType = "video";
                if (videoEl.TryGetProperty("file_id", out var fEl)) fileId = fEl.GetString() ?? "";
            }
            else if (msg.TryGetProperty("voice", out var voiceEl))
            {
                messageType = "voice";
                if (voiceEl.TryGetProperty("file_id", out var fEl)) fileId = fEl.GetString() ?? "";
            }
            else if (msg.TryGetProperty("audio", out var audioEl))
            {
                messageType = "audio";
                if (audioEl.TryGetProperty("file_id", out var fEl)) fileId = fEl.GetString() ?? "";
            }
            else if (msg.TryGetProperty("document", out var docEl))
            {
                messageType = "document";
                if (docEl.TryGetProperty("file_id", out var fEl)) fileId = fEl.GetString() ?? "";
            }

            long platformMessageId = msg.TryGetProperty("message_id", out var midEl) ? midEl.GetInt64() : 0;

            DateTime messageDate = DateTime.Now;
            if (msg.TryGetProperty("date", out var dateEl))
                messageDate = DateTimeOffset.FromUnixTimeSeconds(dateEl.GetInt64()).LocalDateTime;

            if (platformMessageId > 0)
            {
                var chatExistingId = await _repo.GetOrCreateChatAsync(
                    orgId, fyId, platformChatId, chatType, title, username, ct);

                var exists = await _repo.MessageExistsAsync(
                    orgId, fyId, chatExistingId, platformMessageId, ct);

                if (exists) return;

                await _repo.SaveMessageAsync(
                    orgId, fyId, chatExistingId, platformMessageId,
                    DIRECTION_INCOMING, messageText, messageType, fileId,
                    senderName, messageDate, ct);

                await _repo.IncrementUnreadAsync(orgId, fyId, chatExistingId, ct);
                await _repo.UpdateChatLastMessageAsync(
                    orgId, fyId, chatExistingId, messageDate, messageText, ct);

                _logger.LogInformation(
                    "پیام دریافتی: ChatId={ChatId}, From={From}, Text={Text}",
                    platformChatId, senderName, messageText);

                if (messageText.Trim().Equals("/start", StringComparison.OrdinalIgnoreCase))
                    await SendWelcomeMessageAsync(botToken, orgId, fyId, platformChatId, chatExistingId, ct);
            }
        }

        private async Task SendWelcomeMessageAsync(
            string botToken, long orgId, long fyId, long platformChatId, int chatExistingId, CancellationToken ct)
        {
            var welcomeText =
                "👋 سلام و خوش آمدید!\n\n" +
                "به پشتیبانی نرم‌افزار حسابداری آریانا خوش آمدید.\n\n" +
                "لطفاً سوال یا درخواست خود را مطرح کنید و منتظر پاسخ همکاران ما باشید.";

            var sendResult = await _baleService.SendMessageAsync(botToken, platformChatId, welcomeText);

            if (sendResult.Success)
            {
                await _repo.SaveMessageAsync(
                    orgId, fyId, chatExistingId, null, DIRECTION_OUTGOING,
                    welcomeText, "text", "", "ربات", DateTime.Now, ct);

                _logger.LogInformation("پیام خوش‌آمد برای ChatId={ChatId} ارسال شد", platformChatId);
            }
            else
            {
                _logger.LogWarning("ارسال پیام خوش‌آمد ناموفق: {Msg}", sendResult.Message);
            }
        }

        public async Task<List<ChatListItemDto>> GetChatsAsync(long orgId, long fyId, CancellationToken ct = default)
            => await _repo.GetChatsAsync(orgId, fyId, ct);

        public async Task<List<MessageDto>> GetMessagesAsync(long orgId, long fyId, int chatId, CancellationToken ct = default)
            => await _repo.GetMessagesAsync(orgId, fyId, chatId, 200, ct);

        public async Task<(bool Success, string Message)> SendFromPanelAsync(
            long orgId, long fyId, int chatId, string text, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(text))
                return (false, "متن پیام نمی‌تواند خالی باشد.");

            // ⭐ پیدا کردن توکن ربات مربوط به این Tenant
            var cfg = await _configRepo.GetByTenantAsync(PLATFORM_BALE, orgId, fyId, ct);
            if (cfg == null || string.IsNullOrWhiteSpace(cfg.BotToken))
                return (false, "ربات پیام‌رسان برای این سازمان تنظیم نشده است.");

            var platformChatId = await _repo.GetPlatformChatIdAsync(orgId, fyId, chatId, ct);
            if (platformChatId == 0)
                return (false, "چت مورد نظر پیدا نشد.");

            var sendResult = await _baleService.SendMessageAsync(cfg.BotToken, platformChatId, text);
            if (!sendResult.Success)
                return (false, sendResult.Message);

            await _repo.SaveMessageAsync(
                orgId, fyId, chatId, null, DIRECTION_OUTGOING,
                text, "text", "", "پنل مدیریت", DateTime.Now, ct);

            await _repo.UpdateChatLastMessageAsync(orgId, fyId, chatId, DateTime.Now, text, ct);

            return (true, "پیام ارسال شد.");
        }

        public async Task MarkAsReadAsync(long orgId, long fyId, int chatId, CancellationToken ct = default)
            => await _repo.MarkChatAsReadAsync(orgId, fyId, chatId, ct);

        public async Task<int> GetTotalUnreadAsync(long orgId, long fyId, CancellationToken ct = default)
            => await _repo.GetTotalUnreadAsync(orgId, fyId, ct);

        // ⭐ تست اتصال همه ربات‌های فعال
        public async Task<(bool Success, string Message)> TestActiveBotsAsync(CancellationToken ct = default)
        {
            var configs = await _configRepo.GetActiveConfigsAsync(ct);
            if (configs.Count == 0)
                return (false, "هیچ ربات فعالی تنظیم نشده است.");

            var results = new List<string>();
            foreach (var cfg in configs)
            {
                var r = await _baleService.TestConnectionAsync(cfg.BotToken);
                results.Add($"{(r.Success ? "✅" : "❌")} {cfg.BotName ?? "بدون نام"}: {(r.Success ? "OK" : r.Message)}");
            }
            return (true, string.Join("\n", results));
        }

        // ═══════════════════════════════════════════════════════
        //  HELPERS
        // ═══════════════════════════════════════════════════════
        private static string GetChatTitle(JsonElement chatEl, JsonElement msgEl)
        {
            if (chatEl.TryGetProperty("title", out var titleEl) && titleEl.ValueKind == JsonValueKind.String)
            {
                var t = titleEl.GetString();
                if (!string.IsNullOrWhiteSpace(t)) return t!;
            }

            var fn = chatEl.TryGetProperty("first_name", out var fnEl) ? fnEl.GetString() ?? "" : "";
            var ln = chatEl.TryGetProperty("last_name", out var lnEl) ? lnEl.GetString() ?? "" : "";
            var fullName = $"{fn} {ln}".Trim();
            if (!string.IsNullOrWhiteSpace(fullName)) return fullName;

            if (chatEl.TryGetProperty("username", out var uEl))
            {
                var u = uEl.GetString();
                if (!string.IsNullOrWhiteSpace(u)) return "@" + u;
            }

            return "ناشناس";
        }

        private static bool IsFromBot(JsonElement msgEl)
        {
            if (!msgEl.TryGetProperty("from", out var fromEl)) return true;
            return fromEl.TryGetProperty("is_bot", out var isBotEl) && isBotEl.GetBoolean();
        }

        // ⭐ آیا برای این Tenant ربات فعال تنظیم شده؟
        public async Task<bool> HasActiveBotAsync(long orgId, long fyId, CancellationToken ct = default)
        {
            var cfg = await _configRepo.GetByTenantAsync(PLATFORM_BALE, orgId, fyId, ct);
            return cfg != null && !string.IsNullOrWhiteSpace(cfg.BotToken);
        }
    }
}