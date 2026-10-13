using ArianaAPI.Application.DTOs.Stock;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/stock-type")]
[Authorize]
public class StockTypeController : ControllerBase
{
    private readonly IStockTypeRepository _repo;

    public StockTypeController(IStockTypeRepository repo)
    {
        _repo = repo;
    }

    [HttpPost("list")]
    public async Task<ActionResult<StockTypeListResultDto>> GetList(
        [FromBody] StockTypeRequestDto request, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetListAsync(orgId, fyId, request, ct));
    }

    [HttpGet("lookup")]
    public async Task<ActionResult<IEnumerable<StockTypeListDto>>> GetLookup(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetLookupAsync(orgId, fyId, ct));
    }

    [HttpGet("next-code")]
    public async Task<ActionResult<object>> GetNextCode(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var next = await _repo.GetNextCodeAsync(orgId, fyId, ct);
        return Ok(new { nextCode = next });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<StockTypeDetailDto>> GetDetail(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("{id:long}/usage")]
    public async Task<ActionResult<StockTypeUsageDto>> GetUsage(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetUsageAsync(orgId, fyId, id, ct));
    }

    [HttpPost]
    [RequirePermission(220)]
    public async Task<ActionResult<StockTypeCreateResultDto>> Create(
        [FromBody] StockTypeCreateDto dto, CancellationToken ct)
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

    [HttpPut("{id:long}")]
    [RequirePermission(221)]
    public async Task<IActionResult> Update(
        long id, [FromBody] StockTypeUpdateDto dto, CancellationToken ct)
    {
        if (id != dto.Id)
            return BadRequest(new { error = "شناسه یکسان نیست" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try
        {
            await _repo.UpdateAsync(orgId, fyId, dto, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    [RequirePermission(222)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try
        {
            await _repo.DeleteAsync(orgId, fyId, id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}