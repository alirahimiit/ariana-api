using ArianaAPI.Application.DTOs.Sanad;

namespace ArianaAPI.Application.Interfaces;

public interface ISanadRenumberRepository
{
    Task<RenumberPreviewResult> PreviewSanadAsync(long orgId, long fyId, CancellationToken ct = default);
    Task<RenumberCommitResult> CommitSanadAsync(long orgId, long fyId, long userCode, CancellationToken ct = default);
    Task<RenumberPreviewResult> PreviewFactorAsync(long orgId, long fyId, CancellationToken ct = default);
    Task<RenumberCommitResult> CommitFactorAsync(long orgId, long fyId, long userCode, CancellationToken ct = default);
}