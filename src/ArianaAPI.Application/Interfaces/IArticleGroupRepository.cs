using ArianaAPI.Application.DTOs.Stock;

namespace ArianaAPI.Application.Interfaces;

public interface IArticleGroupRepository
{
    Task<ArticleGroupListResultDto> GetListAsync(
        long orgId, long fyId, ArticleGroupRequestDto req, CancellationToken ct = default);

    Task<ArticleGroupDetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<ArticleGroupCreateResultDto> CreateAsync(
        long orgId, long fyId, ArticleGroupCreateDto dto, CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId, ArticleGroupUpdateDto dto, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<long> GetNextCodeAsync(
        long orgId, long fyId, long stockTypeId, CancellationToken ct = default);

    Task<ArticleGroupUsageDto> GetUsageAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<IEnumerable<ArticleGroupListDto>> GetLookupAsync(
        long orgId, long fyId, long? stockTypeId, CancellationToken ct = default);
}