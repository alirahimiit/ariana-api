using ArianaAPI.Application.Dtos.Reports.ArticleStock;

namespace ArianaAPI.Application.Interfaces;

public interface IArticleStockRepository
{
    Task<ArticleStockResultDto> GetAsync(
        long orgId, long fyId, ArticleStockRequestDto request,
        CancellationToken ct = default);
}