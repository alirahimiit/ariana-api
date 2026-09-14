using ArianaAPI.Application.DTOs.Common;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// Repository نوع سند
/// </summary>
public interface IKindSanadRepository
{
    Task<IEnumerable<KindSanadDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default);
}