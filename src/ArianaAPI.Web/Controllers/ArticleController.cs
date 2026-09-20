using ArianaAPI.Application.DTOs.Article;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ArticleController : ControllerBase
{
    private readonly IArticleRepository _repo;

    public ArticleController(IArticleRepository repo)
    {
        _repo = repo;
    }

    /// <summary>لیست کالاها</summary>
    [HttpPost("list")]
    public async Task<ActionResult<ArticleListResultDto>> GetList(
        [FromBody] ArticleRequestDto request,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(orgId, fyId, request, ct);
        return Ok(result);
    }

    /// <summary>جزئیات کالا</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ArticleDetailDto>> GetDetail(
        long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }
}