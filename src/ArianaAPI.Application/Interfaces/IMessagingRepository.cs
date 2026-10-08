using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ArianaAPI.Application.Dtos.Messaging;

namespace ArianaAPI.Application.Interfaces
{
    public interface IMessagingRepository
    {
        // ═══ STATE (offset) ═══
        Task<long> GetLastUpdateIdAsync(long orgId, long fyId, byte platformType, CancellationToken ct = default);
        Task SetLastUpdateIdAsync(long orgId, long fyId, byte platformType, long updateId, CancellationToken ct = default);

        // ═══ CHAT ═══
        Task<int> GetOrCreateChatAsync(long orgId, long fyId, long chatId, string chatType, string title, string username, CancellationToken ct = default);
        Task<List<ChatListItemDto>> GetChatsAsync(long orgId, long fyId, CancellationToken ct = default);
        Task<ChatListItemDto?> GetChatAsync(long orgId, long fyId, int id, CancellationToken ct = default);
        Task<long> GetPlatformChatIdAsync(long orgId, long fyId, int id, CancellationToken ct = default);

        // ═══ MESSAGE ═══
        Task<bool> MessageExistsAsync(long orgId, long fyId, int chatId, long platformMessageId, CancellationToken ct = default);
        Task<int> SaveMessageAsync(long orgId, long fyId, int chatId, long? platformMessageId, int direction, string text, string messageType, string fileId, string senderName, DateTime? messageDate, CancellationToken ct = default);
        Task<List<MessageDto>> GetMessagesAsync(long orgId, long fyId, int chatId, int limit, CancellationToken ct = default);

        // ═══ UPDATE CHAT ═══
        Task UpdateChatLastMessageAsync(long orgId, long fyId, int chatId, DateTime messageDate, string preview, CancellationToken ct = default);
        Task IncrementUnreadAsync(long orgId, long fyId, int chatId, CancellationToken ct = default);
        Task MarkChatAsReadAsync(long orgId, long fyId, int chatId, CancellationToken ct = default);

        // ═══ CHECK — آیا جداول messaging ساخته شده؟ ═══
        Task<bool> HasMessagingTablesAsync(long orgId, long fyId, CancellationToken ct = default);

        // ═══ مجموع پیام‌های نخوانده ═══
        Task<int> GetTotalUnreadAsync(long orgId, long fyId, CancellationToken ct = default);

 
    }
}