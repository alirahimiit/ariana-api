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

    [HttpPost("list")]
    public async Task<ActionResult<ArticleListResultDto>> GetList(
        [FromBody] ArticleRequestDto request, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetListAsync(orgId, fyId, request, ct);
        return Ok(result);
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ArticleDetailDto>> GetDetail(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(
        long id, [FromBody] ArticleUpdateDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        try
        {
            await _repo.UpdateAsync(orgId, fyId, id, dto, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Lookup ها (گروه کالا، واحد، انبار)</summary>
    [HttpGet("lookups")]
    public async Task<ActionResult<ArticleLookupsDto>> GetLookups(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetLookupsAsync(orgId, fyId, ct);
        return Ok(result);
    }
    /// <summary>پیش‌بینی کد کالای جدید</summary>
    [HttpGet("next-code")]
    public async Task<ActionResult<ArticleNextCodeDto>> GetNextCode(
        [FromQuery] long stockTypeId,
        [FromQuery] long groupId,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try
        {
            var result = await _repo.GetNextCodeAsync(orgId, fyId, stockTypeId, groupId, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>درج کالای جدید</summary>
    [HttpPost]
    public async Task<ActionResult<ArticleCreateResultDto>> Create(
        [FromBody] ArticleCreateDto dto,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try
        {
            var result = await _repo.CreateAsync(orgId, fyId, dto, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
    /// <summary>اصلاح کدینگ‌های خراب کالاها (SP)</summary>
    [HttpPost("fix-coding")]
    public async Task<IActionResult> FixCoding(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try
        {
            await _repo.FixCodingAsync(orgId, fyId, ct);
            return Ok(new { message = "کدینگ‌ها اصلاح شدند" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}