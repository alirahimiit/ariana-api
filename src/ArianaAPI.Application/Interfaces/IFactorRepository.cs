using ArianaAPI.Application.DTOs.Factor;

namespace ArianaAPI.Application.Interfaces;

public interface IFactorRepository
{
    Task<FactorListResultDto> GetListAsync(
        long orgId, long fyId, FactorRequestDto request, CancellationToken ct = default);

    Task<FactorResultDto?> GetDetailAsync(
        long orgId, long fyId, long factorId, CancellationToken ct = default);
}