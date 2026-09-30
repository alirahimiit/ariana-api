using ArianaAPI.Application.Dtos.Reports.ArticleRotate;

namespace ArianaAPI.Application.Interfaces;

public interface IArticleRotateRepository
{
    Task<ArticleRotateResultDto> GetAsync(
        long orgId, long fyId, ArticleRotateRequestDto request,
        CancellationToken ct = default);
}