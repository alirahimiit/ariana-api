using ArianaAPI.Application.DTOs.Sanad;

namespace ArianaAPI.Application.Interfaces;

public interface ISanadRepository
{
    Task<IEnumerable<SanadListDto>> GetListAsync(
        long orgId,
        long fyId,
        string? fromDate = null,
        string? toDate = null,
        int? noFrom = null,
        int? noTo = null,
        int? vazeit = null,
        int? kindSanad = null,
        string? sortBy = null,
        string? sortDir = null,
        int page = 1,
        int pageSize = 100,
        bool? onlyWithErrors = null,
        int? codeCol = null,        
        int? codeMoein = null,      
        int? codeTafzil = null,
        CancellationToken ct = default);

    Task<SanadDetailDto?> GetByIdAsync(
        long orgId, long fyId, long sanadId, CancellationToken ct = default);

    Task<IEnumerable<SanadItemDto>> GetItemsAsync(
        long orgId, long fyId, long parentSanadId, CancellationToken ct = default);

    Task<int> GetCountAsync(
        long orgId, long fyId,
        string? fromDate = null, string? toDate = null, int? vazeit = null,
        CancellationToken ct = default);

    Task<SanadCreateResultDto> CreateAsync(
        long orgId, long fyId, SanadCreateDto dto, long userCode, CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId, SanadUpdateDto dto, long userCode, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long parentSanadId, long userCode, CancellationToken ct = default);

    Task<int> GetVazeitAsync(
        long orgId, long fyId, long parentSanadId, CancellationToken ct = default);


    Task<int> BulkDeleteAsync(
        long orgId, long fyId,
        List<long> sanadIds,
        long userCode,
        CancellationToken ct = default);
    Task<string> ExportCsvAsync(
    long orgId, long fyId,
    List<long> sanadIds,
    CancellationToken ct = default);

    SanadImportPreviewResult ParseAndValidateCsv(
        string csvContent,
        List<int> existingNoSanads);

    Task<SanadImportResult> ImportFromCsvAsync(
        long orgId, long fyId,
        string csvContent,
        bool forceNewNumbers,
        long userCode,
        CancellationToken ct = default);

    Task<List<int>> GetAllNoSanadAsync(long orgId, long fyId, CancellationToken ct = default);
}