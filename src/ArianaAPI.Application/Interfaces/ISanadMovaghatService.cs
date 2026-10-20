using ArianaAPI.Application.DTOs.Sanad;

namespace ArianaAPI.Application.Interfaces;

public interface ISanadMovaghatService
{
    Task AddRowAsync(long orgId, long fyId, SanadMovaghatPreviewRequestDto filter, string cu, CancellationToken ct = default);
    Task<List<SanadMovaghatStagingRowDto>> GetStagingRowsAsync(long orgId, long fyId, string cu, CancellationToken ct = default);
    Task DeleteRowAsync(long orgId, long fyId, long id, CancellationToken ct = default);
    Task ClearStagingAsync(long orgId, long fyId, string cu, CancellationToken ct = default);
    Task<SanadClosingResultDto> SaveAsync(long orgId, long fyId, string cu, string dateIn, CancellationToken ct = default);
}