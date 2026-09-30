using ArianaAPI.Application.Dtos.Reports.Kardex;

namespace ArianaAPI.Application.Interfaces;

public interface IKardexRepository
{
    Task<KardexResultDto?> GetAsync(
        long orgId, long fyId, KardexRequestDto request,
        CancellationToken ct = default);
}