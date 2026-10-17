using ArianaAPI.Application.DTOs.Cheque;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

/// <summary>
/// API چک‌های دریافتی (CheckRecive)
/// Permission: Create=140, Edit=141, Delete=142, OK=129, UnOK=130, Return=132
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChequeReceiveController : ControllerBase
{
    private readonly IChequeReceiveRepository _repo;

    public ChequeReceiveController(IChequeReceiveRepository repo)
    {
        _repo = repo;
    }

    // ═══════════════════════════════════════════════════════════════
    //  READ
    // ═══════════════════════════════════════════════════════════════

    [HttpPost("list")]
    public async Task<ActionResult<ChequeReceiveListResultDto>> GetList(
        [FromBody] ChequeReceiveFilterDto filter, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetListAsync(orgId, fyId, filter, ct));
    }
    /// <summary>خلاصه‌ی گزارش چک‌های دریافتی (بدون pagination)</summary>
    [HttpPost("report-summary")]
    public async Task<ActionResult<ChequeReportSummaryDto>> GetReportSummary(
        [FromBody] ChequeReceiveFilterDto filter,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetReportSummaryAsync(orgId, fyId, filter, ct));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ChequeReceiveDetailDto>> GetById(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetByIdAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("next-number")]
    public async Task<ActionResult<object>> GetNextNumber(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var n = await _repo.GetNextNumberAsync(orgId, fyId, ct);
        return Ok(new { residNumber = n });
    }

    [HttpGet("sanad-list")]
    public async Task<ActionResult<IEnumerable<ChequeSanadComboDto>>> GetSanadList(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetParentSanadListAsync(orgId, fyId, ct));
    }

    // ⭐ Datalist endpoints
    [HttpGet("brunch-list")]
    public async Task<ActionResult<IEnumerable<string>>> GetBrunchList(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetDistinctBrunchListAsync(orgId, fyId, ct));
    }

    [HttpGet("nohesab-list")]
    public async Task<ActionResult<IEnumerable<string>>> GetNoHesabList(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetDistinctNoHesabListAsync(orgId, fyId, ct));
    }

    [HttpGet("persons")]
    public async Task<ActionResult<IEnumerable<string>>> GetPersons(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetDistinctPersonListAsync(orgId, fyId, ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  WRITE
    // ═══════════════════════════════════════════════════════════════

    [HttpPost]
    [RequirePermission(140)]
    public async Task<ActionResult<ChequeReceiveCreateResultDto>> Create(
        [FromBody] ChequeReceiveCreateDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            var result = await _repo.CreateAsync(orgId, fyId, dto, userCode, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    [RequirePermission(141)]
    public async Task<IActionResult> Update(long id, [FromBody] ChequeReceiveUpdateDto dto, CancellationToken ct)
    {
        if (id != dto.Id) return BadRequest(new { error = "شناسه چک در URL و بدنه یکسان نیست" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.UpdateAsync(orgId, fyId, dto, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    [RequirePermission(142)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.DeleteAsync(orgId, fyId, id, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  WORKFLOW
    // ═══════════════════════════════════════════════════════════════

    [HttpPost("{id:long}/ok")]
    [RequirePermission(129)]
    public async Task<IActionResult> Ok(long id, [FromBody] ChequeReceiveOkRequestDto dto, CancellationToken ct)
    {
        if (id != dto.Id) return BadRequest(new { error = "شناسه چک در URL و بدنه یکسان نیست" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.OkAsync(orgId, fyId, dto, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:long}/unok")]
    [RequirePermission(130)]
    public async Task<IActionResult> UnOk(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.UnOkAsync(orgId, fyId, id, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:long}/return")]
    [RequirePermission(132)]
    public async Task<IActionResult> Return(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.ReturnAsync(orgId, fyId, id, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}