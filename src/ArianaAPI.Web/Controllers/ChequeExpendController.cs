using ArianaAPI.Application.DTOs.Cheque;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

/// <summary>
/// API خرج چک‌های دریافتی (CheckExpend)
/// Permission: Create=149, Edit=150, Delete=151
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChequeExpendController : ControllerBase
{
    private readonly IChequeExpendRepository _repo;

    public ChequeExpendController(IChequeExpendRepository repo)
    {
        _repo = repo;
    }

    // ═══════════════════════════════════════════════════════════════
    //  READ
    // ═══════════════════════════════════════════════════════════════

    [HttpPost("list")]
    public async Task<ActionResult<ChequeExpendListResultDto>> GetList(
        [FromBody] ChequeExpendFilterDto filter, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetListAsync(orgId, fyId, filter, ct));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ChequeExpendDetailDto>> GetById(long id, CancellationToken ct)
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

    /// <summary>چک‌های قابل انتخاب برای خرج</summary>
    [HttpGet("available-cheques")]
    public async Task<ActionResult<IEnumerable<ChequeExpendAvailableChequeDto>>> GetAvailableCheques(
        [FromQuery] long? includeChequeReceiveId, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetAvailableChequesAsync(orgId, fyId, includeChequeReceiveId, ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  WRITE
    // ═══════════════════════════════════════════════════════════════

    [HttpPost]
    [RequirePermission(149)]
    public async Task<ActionResult<ChequeExpendCreateResultDto>> Create(
        [FromBody] ChequeExpendCreateDto dto, CancellationToken ct)
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
    [RequirePermission(150)]
    public async Task<IActionResult> Update(long id, [FromBody] ChequeExpendUpdateDto dto, CancellationToken ct)
    {
        if (id != dto.Id) return BadRequest(new { error = "شناسه در URL و بدنه یکسان نیست" });

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
    [RequirePermission(151)]
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
}