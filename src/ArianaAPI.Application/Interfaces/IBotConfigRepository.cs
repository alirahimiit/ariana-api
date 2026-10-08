using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ArianaAPI.Domain.Entities.Messaging;

namespace ArianaAPI.Application.Interfaces
{
    public interface IBotConfigRepository
    {
        // ═══ همه ربات‌های فعال (برای Worker) ═══
        Task<List<BotConfig>> GetActiveConfigsAsync(CancellationToken ct = default);

        // ═══ ربات مربوط به یک Tenant خاص (برای ارسال از پنل) ═══
        Task<BotConfig?> GetByTenantAsync(byte platformType, long orgId, long fyId, CancellationToken ct = default);

        // ═══ برای پنل تنظیمات — لیست همه ═══
        Task<List<BotConfig>> GetAllConfigsAsync(CancellationToken ct = default);

        // ═══ ذخیره یا به‌روزرسانی ═══
        Task<int> UpsertAsync(BotConfig config, CancellationToken ct = default);

        // ═══ فعال/غیرفعال ═══
        Task SetActiveAsync(int id, bool isActive, CancellationToken ct = default);

        // ═══ حذف ═══
        Task DeleteAsync(int id, CancellationToken ct = default);
    }
}