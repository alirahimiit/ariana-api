using ArianaAPI.Application.Dtos.Reports.ArticleStock;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/reports/article-stock")]
[Authorize]
public class ArticleStockController : ControllerBase
{
    private readonly IArticleStockRepository _repo;
    private readonly ILogger<ArticleStockController> _logger;

    public ArticleStockController(
        IArticleStockRepository repo,
        ILogger<ArticleStockController> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    private long GetOrgId() => long.Parse(User.FindFirst("orgId")?.Value ?? "0");
    private long GetFyId() => long.Parse(User.FindFirst("fyId")?.Value ?? "0");

    [HttpPost]
    public async Task<IActionResult> Get(
        [FromBody] ArticleStockRequestDto req,
        CancellationToken ct)
    {
        try
        {
            var result = await _repo.GetAsync(GetOrgId(), GetFyId(), req, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در گزارش موجودی کالا");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}