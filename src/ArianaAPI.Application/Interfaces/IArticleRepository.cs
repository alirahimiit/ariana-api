using ArianaAPI.Application.DTOs.Article;

namespace ArianaAPI.Application.Interfaces;

public interface IArticleRepository
{
    Task<ArticleListResultDto> GetListAsync(
        long orgId, long fyId, ArticleRequestDto request, CancellationToken ct = default);

    Task<ArticleDetailDto?> GetDetailAsync(
        long orgId, long fyId, long articleId, CancellationToken ct = default);
}