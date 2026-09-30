using ArianaAPI.Application.Dtos.Reports.ArticleRotate;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/reports/article-rotate")]
[Authorize]
public class ArticleRotateController : ControllerBase
{
    private readonly IArticleRotateRepository _repo;
    private readonly ILogger<ArticleRotateController> _logger;

    public ArticleRotateController(
        IArticleRotateRepository repo,
        ILogger<ArticleRotateController> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    private long GetOrgId() => long.Parse(User.FindFirst("orgId")?.Value ?? "0");
    private long GetFyId() => long.Parse(User.FindFirst("fyId")?.Value ?? "0");

    [HttpPost]
    public async Task<IActionResult> Get(
        [FromBody] ArticleRotateRequestDto req,
        CancellationToken ct)
    {
        try
        {
            var result = await _repo.GetAsync(GetOrgId(), GetFyId(), req, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در گزارش گردش کالا");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}