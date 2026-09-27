using ArianaAPI.Application.DTOs.Factor;

namespace ArianaAPI.Application.Interfaces;

public interface IFactorRepository
{
    Task<FactorListResultDto> GetListAsync(
        long orgId, long fyId, FactorRequestDto request, CancellationToken ct = default);

    Task<FactorResultDto?> GetDetailAsync(
        long orgId, long fyId, long factorId, CancellationToken ct = default);
    Task<FactorLookupsDto> GetLookupsAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<FactorNextNoDto> GetNextNoAsync(
        long orgId, long fyId, long factorKind, CancellationToken ct = default);

    Task<FactorArticleCalcDto?> GetArticleCalcAsync(
        long orgId, long fyId, long articleId, long factorKind,
        long? codeTafzil, string? factorDate, CancellationToken ct = default);

    Task<FactorWriteResultDto> CreateAsync(
        long orgId, long fyId, FactorWriteDto dto, long userCode, CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId, long factorId, FactorWriteDto dto, long userCode, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long factorId, long userCode, CancellationToken ct = default);
    // ─── سند خودکار ───
    Task<SanadCreateResultDto> CreateSanadAsync(
        long orgId, long fyId, long factorId, SanadCreateRequestDto request,
        CancellationToken ct = default);

    Task<SanadBulkResultDto> BulkCreateSanadAsync(
        long orgId, long fyId, SanadBulkRequestDto request,
        CancellationToken ct = default);

    Task DeleteSanadAsync(
        long orgId, long fyId, long factorId,
        CancellationToken ct = default);
}