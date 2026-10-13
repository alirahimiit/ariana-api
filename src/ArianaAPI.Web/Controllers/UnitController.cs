using ArianaAPI.Application.DTOs.Stock;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/unit")]
[Authorize]
public class UnitController : ControllerBase
{
    private readonly IUnitRepository _repo;

    public UnitController(IUnitRepository repo) { _repo = repo; }

    [HttpPost("list")]
    public async Task<ActionResult<UnitListResultDto>> GetList(
        [FromBody] UnitRequestDto request, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetListAsync(orgId, fyId, request, ct));
    }

    [HttpGet("lookup")]
    public async Task<ActionResult<IEnumerable<UnitListDto>>> GetLookup(CancellationToken ct)
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
    public async Task<ActionResult<UnitDetailDto>> GetDetail(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var r = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return r is null ? NotFound() : Ok(r);
    }

    [HttpGet("{id:long}/usage")]
    public async Task<ActionResult<UnitUsageDto>> GetUsage(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetUsageAsync(orgId, fyId, id, ct));
    }

    [HttpPost]
    [RequirePermission(226)]
    public async Task<ActionResult<UnitCreateResultDto>> Create(
        [FromBody] UnitCreateDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try { return Ok(await _repo.CreateAsync(orgId, fyId, dto, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPut("{id:long}")]
    [RequirePermission(227)]
    public async Task<IActionResult> Update(
        long id, [FromBody] UnitUpdateDto dto, CancellationToken ct)
    {
        if (id != dto.Id) return BadRequest(new { error = "شناسه یکسان نیست" });
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try
        {
            await _repo.UpdateAsync(orgId, fyId, dto, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpDelete("{id:long}")]
    [RequirePermission(228)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        try
        {
            await _repo.DeleteAsync(orgId, fyId, id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }
}