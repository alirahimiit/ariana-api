using ArianaAPI.Domain.Entities.Moadian;

namespace ArianaAPI.Application.Interfaces;

public interface IMoadianRepository
{
    // ═══ SETTING ═══
    Task<TaxSetting?> GetSettingAsync(long orgId, long fyId, CancellationToken ct = default);
    Task UpdateSettingAsync(long orgId, long fyId, TaxSetting setting, CancellationToken ct = default);

    // ═══ HEADER ═══
    Task<TaxHeader?> GetHeaderByIdAsync(long orgId, long fyId, long id, CancellationToken ct = default);
    Task<TaxHeader?> GetHeaderByTaxIdAsync(long orgId, long fyId, string taxid, CancellationToken ct = default);
    Task<List<TaxHeader>> GetAllHeadersAsync(long orgId, long fyId, CancellationToken ct = default);
    Task<long> AddHeaderAsync(long orgId, long fyId, TaxHeader header, CancellationToken ct = default);
    Task UpdateHeaderAsync(long orgId, long fyId, TaxHeader header, CancellationToken ct = default);
    Task DeleteHeaderAsync(long orgId, long fyId, long id, CancellationToken ct = default);
    Task ChangeStatusAsync(long orgId, long fyId, long id, int status, CancellationToken ct = default);
    Task<long> GetLastInnoAsync(long orgId, long fyId, CancellationToken ct = default);

    // ═══ BODY ═══
    Task<List<TaxBody>> GetBodyByHeaderIdAsync(long orgId, long fyId, long headerId, CancellationToken ct = default);
    Task AddBodyAsync(long orgId, long fyId, TaxBody body, CancellationToken ct = default);
    Task DeleteBodyByHeaderIdAsync(long orgId, long fyId, long headerId, CancellationToken ct = default);
    Task ClearBodyBsrnAsync(long orgId, long fyId, long headerId, CancellationToken ct = default);

    // ═══ HISTORY ═══
    Task AddHistoryAsync(long orgId, long fyId, TaxHistory history, CancellationToken ct = default);

    // ═══ SOURCE (Factor) ═══
    Task<List<TaxFactorSource>> GetPendingFactorsAsync(long orgId, long fyId, CancellationToken ct = default);
    Task<TaxFactorSource?> GetFactorSourceByIdAsync(long orgId, long fyId, long factorId, CancellationToken ct = default);
    Task<List<TaxFactorRowSource>> GetFactorRowsAsync(long orgId, long fyId, long factorId, CancellationToken ct = default);
}