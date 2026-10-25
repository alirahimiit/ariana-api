using ArianaAPI.Application.DTOs.Inventory;

namespace ArianaAPI.Application.Interfaces;

public interface IInventoryRepository
{
    // Stages
    Task<List<InventoryStageDto>> GetStagesAsync(long orgId, long fyId, long? stockTypeId, CancellationToken ct = default);
    Task<long> CreateStageAsync(long orgId, long fyId, InventoryStageWriteDto dto, CancellationToken ct = default);
    Task UpdateStageAsync(long orgId, long fyId, long id, InventoryStageWriteDto dto, CancellationToken ct = default);
    Task DeleteStageAsync(long orgId, long fyId, long id, CancellationToken ct = default);

    // Tags
    Task<InventoryTagListResultDto> GetTagsAsync(long orgId, long fyId, InventoryTagRequestDto req, CancellationToken ct = default);
    Task<InventoryTagDetailDto?> GetTagDetailAsync(long orgId, long fyId, long tagId, CancellationToken ct = default);
    Task<long> CreateTagAsync(long orgId, long fyId, InventoryCreateTagDto dto, long userId, CancellationToken ct = default);
    Task SaveCountAsync(long orgId, long fyId, long tagId, InventoryCountRequestDto dto, long userId, CancellationToken ct = default);
    Task ConfirmTagAsync(long orgId, long fyId, long tagId, long userId, CancellationToken ct = default);
    Task DeleteTagAsync(long orgId, long fyId, long tagId, CancellationToken ct = default);

    // Lookups
    Task<InventoryLookupsDto> GetLookupsAsync(long orgId, long fyId, CancellationToken ct = default);
    Task<double> GetArticleStockAsync(long orgId, long fyId, long articleId, long stockTypeId, CancellationToken ct = default);

    // Tag Number
    Task<string> GetNextTagNoAsync(long orgId, long fyId, long stockTypeId, int stageNo, CancellationToken ct = default);

    // Reports
    Task<List<InventoryDiffReportDto>> GetDiffReportAsync(long orgId, long fyId, long? stockTypeId, CancellationToken ct = default);
    Task<List<InventoryHistoryDto>> GetHistoryReportAsync(long orgId, long fyId, long? stockTypeId, CancellationToken ct = default);
}