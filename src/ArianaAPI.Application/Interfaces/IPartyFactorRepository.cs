using ArianaAPI.Application.Dtos.Reports.PartyFactor;

namespace ArianaAPI.Application.Interfaces;

public interface IPartyFactorRepository
{
    Task<PartyFactorResultDto?> GetAsync(
        long orgId, long fyId, PartyFactorRequestDto request,
        CancellationToken ct = default);
}