using ArianaAPI.Application.DTOs.Permissions;

namespace ArianaAPI.Application.Interfaces;

/// <summary>Repository رجیستری منوها — Permanent DB</summary>
public interface IMenuRegistryRepository
{
    /// <summary>همه‌ی منوهای فعال</summary>
    Task<List<MenuRegistryItemDto>> GetActiveMenusAsync(
        CancellationToken ct = default);
}