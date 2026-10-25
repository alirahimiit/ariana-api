using ArianaAPI.Application.DTOs.Inventory;

namespace ArianaAPI.Application.Interfaces;

public interface IInventorySanadService
{
    Task<InventorySanadResultDto> CreateSanadAsync(long orgId, long fyId, long tagId, long userId, CancellationToken ct = default);
    Task<InventorySanadResultDto> RecreateSanadAsync(long orgId, long fyId, long tagId, long userId, CancellationToken ct = default);
}