using System;

namespace ArianaAPI.Domain.Entities.Messaging
{
    public class BotConfig
    {
        public int Id { get; set; }
        public byte PlatformType { get; set; }        // 1=بله
        public string BotToken { get; set; } = string.Empty;
        public string? BotName { get; set; }
        public long TargetOrgId { get; set; }
        public long TargetFyId { get; set; }
        public bool IsActive { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}