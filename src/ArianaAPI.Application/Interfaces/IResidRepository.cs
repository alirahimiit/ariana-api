using ArianaAPI.Application.DTOs.Resid;

namespace ArianaAPI.Application.Interfaces;

public interface IResidRepository
{
    // ── READ ──
    Task<ResidListResultDto> GetListAsync(
        long orgId, long fyId,
        ResidFilterDto filter,
        CancellationToken ct = default);

    Task<ResidDetailDto?> GetByIdAsync(
        long orgId, long fyId, long id,
        CancellationToken ct = default);

    Task<int> GetNextNumberAsync(
        long orgId, long fyId, int checkKind,
        CancellationToken ct = default);

    Task<int> GetSanadVazeitAsync(
        long orgId, long fyId, long parentSanadId,
        CancellationToken ct = default);

    Task<IEnumerable<ResidSanadComboDto>> GetParentSanadListAsync(
        long orgId, long fyId,
        CancellationToken ct = default);

    // ── WRITE ──
    Task<ResidCreateResultDto> CreateAsync(
        long orgId, long fyId,
        ResidCreateDto dto, long userCode,
        CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId,
        ResidUpdateDto dto, long userCode,
        CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default);
}