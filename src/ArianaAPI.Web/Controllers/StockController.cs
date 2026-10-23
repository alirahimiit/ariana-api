using ArianaAPI.Application.DTOs.Stock;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StockController : ControllerBase
{
    private readonly IStockRepository _repo;
    private readonly IPermissionRepository _perms;

    public StockController(IStockRepository repo, IPermissionRepository perms)
    {
        _repo = repo;
        _perms = perms;
    }

    [HttpPost("list")]
    public async Task<ActionResult<StockListResultDto>> GetList(
        [FromBody] StockRequestDto request, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try
        {
            return Ok(await _repo.GetListAsync(orgId, fyId, request, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<StockDetailDto>> GetDetail(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("lookups")]
    public async Task<ActionResult<StockLookupsDto>> GetLookups(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetLookupsAsync(orgId, fyId, ct));
    }

    [HttpGet("next-number")]
    public async Task<ActionResult<StockNextNumberDto>> GetNextNumber(
        [FromQuery] int kind, [FromQuery] long? stockTypeId, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetNextNumberAsync(orgId, fyId, kind, stockTypeId, ct));
    }

    [HttpGet("article-calc/{articleId:long}")]
    public async Task<ActionResult<StockArticleCalcDto>> GetArticleCalc(
        long articleId, [FromQuery] int kind, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetArticleCalcAsync(orgId, fyId, articleId, kind, ct);
        return result is null ? NotFound() : Ok(result);
    }

    // ⭐ این متد برای لیست فاکتورها اضافه شد
    [HttpGet("factor-list")]
    public async Task<ActionResult<List<FactorListItemDto>>> GetFactorList(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var list = await _repo.GetFactorListAsync(orgId, fyId, ct);
        return Ok(list);
    }

    [HttpPost]
    public async Task<ActionResult<StockWriteResultDto>> Create(
        [FromBody] StockWriteDto dto, CancellationToken ct)
    {
        if (!await HasPermissionAsync(dto.Kind, "insert", ct)) return Forbid();
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();
        try { return Ok(await _repo.CreateAsync(orgId, fyId, dto, userCode, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<StockWriteResultDto>> Update(
        long id, [FromBody] StockWriteDto dto, CancellationToken ct)
    {
        if (!await HasPermissionAsync(dto.Kind, "edit", ct)) return Forbid();
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();
        try { return Ok(await _repo.UpdateAsync(orgId, fyId, id, dto, userCode, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id, [FromQuery] int kind, CancellationToken ct)
    {
        if (!await HasPermissionAsync(kind, "delete", ct)) return Forbid();
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();
        try
        {
            await _repo.DeleteAsync(orgId, fyId, id, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("{id:long}/sanad")]
    public async Task<ActionResult<StockSanadResultDto>> CreateSanad(
        long id, [FromBody] StockSanadRequestDto request, [FromQuery] int kind, CancellationToken ct)
    {
        if (!await HasPermissionAsync(kind, "edit", ct)) return Forbid();
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.CreateSanadAsync(orgId, fyId, id, request, ct);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    private async Task<bool> HasPermissionAsync(int kind, string action, CancellationToken ct)
    {
        long permCode = action.ToLower() switch
        {
            "insert" => kind switch { 0 => 156L, 1 => 159L, 2 => 162L, _ => 999L },
            "edit" => kind switch { 0 => 157L, 1 => 160L, 2 => 163L, _ => 999L },
            "delete" => kind switch { 0 => 158L, 1 => 161L, 2 => 164L, _ => 999L },
            _ => 999L
        };

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var groupCode = long.Parse(User.FindFirst("userGroupCode")?.Value ?? "0");
        if (groupCode == 0) return false;

        var perms = await _perms.GetByUserGroupAsync(orgId, fyId, groupCode, ct);
        if (perms == null || perms.Operations == null) return false;
        return perms.Operations.Contains(permCode);
    }
}