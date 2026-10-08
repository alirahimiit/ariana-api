using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ArianaAPI.Application.Dtos.Messaging;

namespace ArianaAPI.Application.Interfaces
{
    public interface IMessagingService
    {
        // ⭐ جدید — با token
        Task ProcessUpdatesAsync(string botToken, long orgId, long fyId, CancellationToken ct = default);

        Task<List<ChatListItemDto>> GetChatsAsync(long orgId, long fyId, CancellationToken ct = default);
        Task<List<MessageDto>> GetMessagesAsync(long orgId, long fyId, int chatId, CancellationToken ct = default);
        Task<(bool Success, string Message)> SendFromPanelAsync(long orgId, long fyId, int chatId, string text, CancellationToken ct = default);
        Task MarkAsReadAsync(long orgId, long fyId, int chatId, CancellationToken ct = default);
        Task<int> GetTotalUnreadAsync(long orgId, long fyId, CancellationToken ct = default);

        // ⭐ جدید — تست اتصال ربات‌های فعال
        Task<(bool Success, string Message)> TestActiveBotsAsync(CancellationToken ct = default);

        // ⭐ آیا این Tenant پنل پشتیبان دارد؟
        Task<bool> HasActiveBotAsync(long orgId, long fyId, CancellationToken ct = default);
    }
}