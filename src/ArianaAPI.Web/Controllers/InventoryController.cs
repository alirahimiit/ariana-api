using ArianaAPI.Application.DTOs.Inventory;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly IInventoryRepository _repo;
    private readonly IInventorySanadService _sanadService;

    public InventoryController(IInventoryRepository repo, IInventorySanadService sanadService)
    {
        _repo = repo;
        _sanadService = sanadService;
    }

    // ═══════════════════════════════════════════════════
    //  Stages (مراحل)
    // ═══════════════════════════════════════════════════
    [HttpGet("stages")]
    public async Task<ActionResult<List<InventoryStageDto>>> GetStages([FromQuery] long? stockTypeId, CancellationToken ct)
    {
        return Ok(await _repo.GetStagesAsync(User.GetOrgId(), User.GetFyId(), stockTypeId, ct));
    }

    [HttpPost("stages")]
    public async Task<IActionResult> CreateStage([FromBody] InventoryStageWriteDto dto, CancellationToken ct)
    {
        try
        {
            var id = await _repo.CreateStageAsync(User.GetOrgId(), User.GetFyId(), dto, ct);
            return Ok(new { id });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("stages/{id:long}")]
    public async Task<IActionResult> UpdateStage(long id, [FromBody] InventoryStageWriteDto dto, CancellationToken ct)
    {
        await _repo.UpdateStageAsync(User.GetOrgId(), User.GetFyId(), id, dto, ct);
        return NoContent();
    }

    [HttpDelete("stages/{id:long}")]
    public async Task<IActionResult> DeleteStage(long id, CancellationToken ct)
    {
        try
        {
            await _repo.DeleteStageAsync(User.GetOrgId(), User.GetFyId(), id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    // ═══════════════════════════════════════════════════
    //  Tags (تگ‌ها)
    // ═══════════════════════════════════════════════════
    [HttpPost("tags/list")]
    public async Task<ActionResult<InventoryTagListResultDto>> GetTags(
        [FromBody] InventoryTagRequestDto req, CancellationToken ct)
    {
        return Ok(await _repo.GetTagsAsync(User.GetOrgId(), User.GetFyId(), req, ct));
    }

    [HttpGet("tags/{id:long}")]
    public async Task<ActionResult<InventoryTagDetailDto>> GetTagDetail(long id, CancellationToken ct)
    {
        var result = await _repo.GetTagDetailAsync(User.GetOrgId(), User.GetFyId(), id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("tags")]
    public async Task<ActionResult> CreateTag([FromBody] InventoryCreateTagDto dto, CancellationToken ct)
    {
        try
        {
            var id = await _repo.CreateTagAsync(User.GetOrgId(), User.GetFyId(), dto, User.GetUserId(), ct);
            return Ok(new { id });
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("tags/{tagId:long}/count")]
    public async Task<IActionResult> SaveCount(long tagId, [FromBody] InventoryCountRequestDto dto, CancellationToken ct)
    {
        try
        {
            await _repo.SaveCountAsync(User.GetOrgId(), User.GetFyId(), tagId, dto, User.GetUserId(), ct);
            return Ok();
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("tags/{tagId:long}/confirm")]
    public async Task<IActionResult> ConfirmTag(long tagId, CancellationToken ct)
    {
        try
        {
            await _repo.ConfirmTagAsync(User.GetOrgId(), User.GetFyId(), tagId, User.GetUserId(), ct);
            return Ok();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpDelete("tags/{tagId:long}")]
    public async Task<IActionResult> DeleteTag(long tagId, CancellationToken ct)
    {
        try
        {
            await _repo.DeleteTagAsync(User.GetOrgId(), User.GetFyId(), tagId, ct);
            return NoContent();
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    // ═══════════════════════════════════════════════════
    //  Sanad (سند)
    // ═══════════════════════════════════════════════════
    [HttpPost("tags/{tagId:long}/create-sanad")]
    public async Task<ActionResult<InventorySanadResultDto>> CreateSanad(long tagId, CancellationToken ct)
    {
        var result = await _sanadService.CreateSanadAsync(User.GetOrgId(), User.GetFyId(), tagId, User.GetUserId(), ct);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("tags/{tagId:long}/recreate-sanad")]
    public async Task<ActionResult<InventorySanadResultDto>> RecreateSanad(long tagId, CancellationToken ct)
    {
        var result = await _sanadService.RecreateSanadAsync(User.GetOrgId(), User.GetFyId(), tagId, User.GetUserId(), ct);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    // ═══════════════════════════════════════════════════
    //  Lookups & Utilities
    // ═══════════════════════════════════════════════════
    [HttpGet("lookups")]
    public async Task<ActionResult<InventoryLookupsDto>> GetLookups(CancellationToken ct)
    {
        return Ok(await _repo.GetLookupsAsync(User.GetOrgId(), User.GetFyId(), ct));
    }

    [HttpGet("next-tag-no")]
    public async Task<ActionResult> GetNextTagNo([FromQuery] long stockTypeId, [FromQuery] int stageNo, CancellationToken ct)
    {
        var tagNo = await _repo.GetNextTagNoAsync(User.GetOrgId(), User.GetFyId(), stockTypeId, stageNo, ct);
        return Ok(new { tagNo });
    }

    [HttpGet("article-stock/{articleId:long}")]
    public async Task<ActionResult> GetArticleStock(long articleId, [FromQuery] long stockTypeId, CancellationToken ct)
    {
        var qty = await _repo.GetArticleStockAsync(User.GetOrgId(), User.GetFyId(), articleId, stockTypeId, ct);
        return Ok(new { qty });
    }

    [HttpGet("reports/diff")]
    public async Task<ActionResult<List<InventoryDiffReportDto>>> GetDiffReport([FromQuery] long? stockTypeId, CancellationToken ct)
    {
        return Ok(await _repo.GetDiffReportAsync(User.GetOrgId(), User.GetFyId(), stockTypeId, ct));
    }

    [HttpGet("reports/history")]
    public async Task<ActionResult<List<InventoryHistoryDto>>> GetHistoryReport([FromQuery] long? stockTypeId, CancellationToken ct)
    {
        return Ok(await _repo.GetHistoryReportAsync(User.GetOrgId(), User.GetFyId(), stockTypeId, ct));
    }
}