using ArianaAPI.Application.DTOs.Common;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository شرح‌ها
/// </summary>
public interface ISharhRepository
{
    Task<IEnumerable<SharhDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default);
}