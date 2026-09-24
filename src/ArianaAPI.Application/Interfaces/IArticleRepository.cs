using ArianaAPI.Application.DTOs.Article;

namespace ArianaAPI.Application.Interfaces;

public interface IArticleRepository
{
    Task<ArticleListResultDto> GetListAsync(
        long orgId, long fyId, ArticleRequestDto request, CancellationToken ct = default);

    Task<ArticleDetailDto?> GetDetailAsync(
        long orgId, long fyId, long articleId, CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId, long articleId, ArticleUpdateDto dto, CancellationToken ct = default);

    Task<ArticleLookupsDto> GetLookupsAsync(
        long orgId, long fyId, CancellationToken ct = default);
    Task<ArticleNextCodeDto> GetNextCodeAsync(
        long orgId, long fyId, long stockTypeId, long groupId, CancellationToken ct = default);

    Task<ArticleCreateResultDto> CreateAsync(
        long orgId, long fyId, ArticleCreateDto dto, CancellationToken ct = default);
    Task FixCodingAsync(long orgId, long fyId, CancellationToken ct = default);

    Task DeleteAsync(
    long orgId, long fyId, long articleId, CancellationToken ct = default);
}