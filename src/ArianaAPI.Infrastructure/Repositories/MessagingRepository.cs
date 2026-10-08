using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ArianaAPI.Application.Dtos.Messaging;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories
{
    public class MessagingRepository : IMessagingRepository
    {
        private readonly ITenantConnectionFactory _factory;
        private readonly ILogger<MessagingRepository> _logger;

        public MessagingRepository(
            ITenantConnectionFactory factory,
            ILogger<MessagingRepository> logger)
        {
            _factory = factory;
            _logger = logger;
        }

        // ═══════════════════════════════════════════════════════
        //  STATE — offset پیام‌ها
        // ═══════════════════════════════════════════════════════
        public async Task<long> GetLastUpdateIdAsync(long orgId, long fyId, byte platformType, CancellationToken ct = default)
        {
            const string sql = @"
                SELECT ISNULL(last_update_id, 0)
                FROM messaging_state
                WHERE platform_type = @platformType";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            return await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(sql, new { platformType }, cancellationToken: ct)) ?? 0;
        }

        public async Task SetLastUpdateIdAsync(long orgId, long fyId, byte platformType, long updateId, CancellationToken ct = default)
        {
            const string sql = @"
                IF EXISTS (SELECT 1 FROM messaging_state WHERE platform_type = @platformType)
                    UPDATE messaging_state
                    SET last_update_id = @updateId, updated_at = GETDATE()
                    WHERE platform_type = @platformType
                ELSE
                    INSERT INTO messaging_state (platform_type, last_update_id)
                    VALUES (@platformType, @updateId)";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.ExecuteAsync(new CommandDefinition(sql,
                new { platformType, updateId }, cancellationToken: ct));
        }

        // ═══════════════════════════════════════════════════════
        //  CHAT
        // ═══════════════════════════════════════════════════════
        public async Task<int> GetOrCreateChatAsync(
            long orgId, long fyId,
            long chatId, string chatType, string title, string username,
            CancellationToken ct = default)
        {
            await using var conn = _factory.CreateTenantConnection(orgId, fyId);

            const string findSql = @"
                SELECT id FROM messaging_chat
                WHERE platform_type = 1 AND chat_id = @chatId";

            var existing = await conn.ExecuteScalarAsync<int?>(
                new CommandDefinition(findSql, new { chatId }, cancellationToken: ct));

            if (existing.HasValue)
            {
                const string updateSql = @"
                    UPDATE messaging_chat
                    SET chat_type = @chatType,
                        title = @title,
                        username = @username
                    WHERE id = @id";

                await conn.ExecuteAsync(new CommandDefinition(updateSql,
                    new { id = existing.Value, chatType, title, username }, cancellationToken: ct));

                return existing.Value;
            }

            const string insertSql = @"
                INSERT INTO messaging_chat
                    (platform_type, chat_id, chat_type, title, username, last_message_at, unread_count, created_at)
                VALUES
                    (1, @chatId, @chatType, @title, @username, GETDATE(), 0, GETDATE());
                SELECT CAST(SCOPE_IDENTITY() AS INT);";

            var newId = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(insertSql,
                    new { chatId, chatType, title, username }, cancellationToken: ct));

            _logger.LogInformation("چت جدید ساخته شد: Id={Id}, ChatId={ChatId}, Title={Title}",
                newId, chatId, title);

            return newId;
        }

        public async Task<List<ChatListItemDto>> GetChatsAsync(long orgId, long fyId, CancellationToken ct = default)
        {
            const string sql = @"
                SELECT 
                    c.id              AS Id,
                    c.chat_id         AS ChatId,
                    c.chat_type       AS ChatType,
                    c.title           AS Title,
                    c.username        AS Username,
                    c.last_message_at AS LastMessageAt,
                    c.unread_count    AS UnreadCount,
                    ISNULL((
                        SELECT TOP 1 m.message_text
                        FROM messaging_message m
                        WHERE m.chat_id = c.id
                        ORDER BY m.message_date DESC, m.id DESC
                    ), '') AS LastMessagePreview
                FROM messaging_chat c
                ORDER BY 
                    CASE WHEN c.last_message_at IS NULL THEN 1 ELSE 0 END,
                    c.last_message_at DESC,
                    c.id DESC";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            var list = await conn.QueryAsync<ChatListItemDto>(
                new CommandDefinition(sql, cancellationToken: ct));

            return list.ToList();
        }

        public async Task<ChatListItemDto?> GetChatAsync(long orgId, long fyId, int id, CancellationToken ct = default)
        {
            const string sql = @"
                SELECT 
                    c.id              AS Id,
                    c.chat_id         AS ChatId,
                    c.chat_type       AS ChatType,
                    c.title           AS Title,
                    c.username        AS Username,
                    c.last_message_at AS LastMessageAt,
                    c.unread_count    AS UnreadCount,
                    ''                AS LastMessagePreview
                FROM messaging_chat c
                WHERE c.id = @id";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            return await conn.QueryFirstOrDefaultAsync<ChatListItemDto>(
                new CommandDefinition(sql, new { id }, cancellationToken: ct));
        }

        public async Task<long> GetPlatformChatIdAsync(long orgId, long fyId, int id, CancellationToken ct = default)
        {
            const string sql = "SELECT chat_id FROM messaging_chat WHERE id = @id";
            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            return await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(sql, new { id }, cancellationToken: ct)) ?? 0;
        }

        // ═══════════════════════════════════════════════════════
        //  MESSAGE
        // ═══════════════════════════════════════════════════════
        public async Task<bool> MessageExistsAsync(
            long orgId, long fyId, int chatId, long platformMessageId,
            CancellationToken ct = default)
        {
            const string sql = @"
                SELECT COUNT(1) FROM messaging_message
                WHERE chat_id = @chatId AND platform_message_id = @platformMessageId";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            var count = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(sql, new { chatId, platformMessageId }, cancellationToken: ct));

            return count > 0;
        }

        public async Task<int> SaveMessageAsync(
            long orgId, long fyId,
            int chatId, long? platformMessageId, int direction,
            string text, string messageType, string fileId,
            string senderName, DateTime? messageDate,
            CancellationToken ct = default)
        {
            const string sql = @"
                INSERT INTO messaging_message
                    (chat_id, platform_message_id, direction, message_text, message_type,
                     file_id, sender_name, message_date, is_read, created_at)
                VALUES
                    (@chatId, @platformMessageId, @direction, @text, @messageType,
                     @fileId, @senderName, @messageDate, 0, GETDATE());
                SELECT CAST(SCOPE_IDENTITY() AS INT);";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            var newId = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(sql, new
                {
                    chatId,
                    platformMessageId,
                    direction,
                    text = text ?? "",
                    messageType = messageType ?? "text",
                    fileId = fileId ?? "",
                    senderName = senderName ?? "",
                    messageDate = messageDate ?? DateTime.Now
                }, cancellationToken: ct));

            return newId;
        }

        public async Task<List<MessageDto>> GetMessagesAsync(
            long orgId, long fyId, int chatId, int limit,
            CancellationToken ct = default)
        {
            if (limit < 1) limit = 100;
            if (limit > 500) limit = 500;

            const string sql = @"
                SELECT TOP (@limit)
                    id                  AS Id,
                    chat_id             AS ChatId,
                    platform_message_id AS PlatformMessageId,
                    direction           AS Direction,
                    message_text        AS MessageText,
                    message_type        AS MessageType,
                    sender_name         AS SenderName,
                    message_date        AS MessageDate,
                    is_read             AS IsRead
                FROM messaging_message
                WHERE chat_id = @chatId
                ORDER BY message_date DESC, id DESC";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            var list = (await conn.QueryAsync<MessageDto>(
                new CommandDefinition(sql, new { chatId, limit }, cancellationToken: ct))).ToList();

            list.Reverse();
            return list;
        }

        public async Task UpdateChatLastMessageAsync(
            long orgId, long fyId, int chatId, DateTime messageDate, string preview,
            CancellationToken ct = default)
        {
            const string sql = @"
                UPDATE messaging_chat
                SET last_message_at = @messageDate
                WHERE id = @chatId";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.ExecuteAsync(new CommandDefinition(sql,
                new { chatId, messageDate }, cancellationToken: ct));
        }

        public async Task IncrementUnreadAsync(long orgId, long fyId, int chatId, CancellationToken ct = default)
        {
            const string sql = @"
                UPDATE messaging_chat
                SET unread_count = ISNULL(unread_count, 0) + 1
                WHERE id = @chatId";

            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.ExecuteAsync(new CommandDefinition(sql, new { chatId }, cancellationToken: ct));
        }

        public async Task MarkChatAsReadAsync(long orgId, long fyId, int chatId, CancellationToken ct = default)
        {
            await using var conn = _factory.CreateTenantConnection(orgId, fyId);

            const string sql1 = "UPDATE messaging_chat SET unread_count = 0 WHERE id = @chatId";
            await conn.ExecuteAsync(new CommandDefinition(sql1, new { chatId }, cancellationToken: ct));

            const string sql2 = @"
                UPDATE messaging_message
                SET is_read = 1
                WHERE chat_id = @chatId AND direction = 1 AND is_read = 0";
            await conn.ExecuteAsync(new CommandDefinition(sql2, new { chatId }, cancellationToken: ct));
        }

        // ═══════════════════════════════════════════════════════
        //  CHECK — آیا این Tenant جداول messaging را دارد؟
        //  ⭐ این متد باید داخل کلاس باشد، نه بیرون
        // ═══════════════════════════════════════════════════════
        public async Task<bool> HasMessagingTablesAsync(long orgId, long fyId, CancellationToken ct = default)
        {
            const string sql = @"
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'messaging_state'";

            try
            {
                await using var conn = _factory.CreateTenantConnection(orgId, fyId);
                var count = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(sql, cancellationToken: ct));
                return count > 0;
            }
            catch
            {
                return false;
            }
        }
        public async Task<int> GetTotalUnreadAsync(long orgId, long fyId, CancellationToken ct = default)
        {
            const string sql = "SELECT ISNULL(SUM(unread_count), 0) FROM messaging_chat";

            try
            {
                await using var conn = _factory.CreateTenantConnection(orgId, fyId);
                return await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(sql, cancellationToken: ct));
            }
            catch
            {
                return 0;
            }
        }
    }   
}       