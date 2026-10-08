using System;

namespace ArianaAPI.Application.Dtos.Messaging
{
    // آیتم لیست چت‌ها (برای ستون کناری پنل)
    public class ChatListItemDto
    {
        public int Id { get; set; }
        public long ChatId { get; set; }
        public string ChatType { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public DateTime? LastMessageAt { get; set; }
        public int UnreadCount { get; set; }
        public string LastMessagePreview { get; set; } = string.Empty;
    }

    // یک پیام
    public class MessageDto
    {
        public int Id { get; set; }
        public int ChatId { get; set; }
        public long? PlatformMessageId { get; set; }
        public int Direction { get; set; }   // 1=دریافتی، 2=ارسالی
        public string MessageText { get; set; } = string.Empty;
        public string MessageType { get; set; } = string.Empty;
        public string SenderName { get; set; } = string.Empty;
        public DateTime? MessageDate { get; set; }
        public bool IsRead { get; set; }
    }

    // درخواست ارسال پیام از پنل
    public class PanelSendRequestDto
    {
        public int ChatId { get; set; }   // id داخلی جدول messaging_chat
        public string Text { get; set; } = string.Empty;
    }
}