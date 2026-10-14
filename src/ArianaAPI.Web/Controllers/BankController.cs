using ArianaAPI.Application.DTOs.Bank;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/bank")]
[Authorize]
public class BankController : ControllerBase
{
    private readonly IBankRepository _repo;

    public BankController(IBankRepository repo)
    {
        _repo = repo;
    }

    // ═══════════════════════════════════════════════════════
    //  Bank
    // ═══════════════════════════════════════════════════════

    [HttpGet("list")]
    public async Task<ActionResult<List<BankListDto>>> GetBanks(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetBanksAsync(orgId, fyId, ct);
        return Ok(result);
    }

    [HttpPost]
    [RequirePermission(232)]
    public async Task<ActionResult<BankWriteResultDto>> Create(
        [FromBody] BankWriteDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            var result = await _repo.CreateBankAsync(orgId, fyId, dto, userCode, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    [RequirePermission(233)]
    public async Task<IActionResult> Update(
        long id, [FromBody] BankWriteDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.UpdateBankAsync(orgId, fyId, id, dto, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    [RequirePermission(234)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        try
        {
            await _repo.DeleteBankAsync(orgId, fyId, id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ═══════════════════════════════════════════════════════
    //  BankAcc
    // ═══════════════════════════════════════════════════════

    [HttpPost("acc/list")]
    public async Task<ActionResult<BankAccListResultDto>> GetAccs(
        [FromBody] BankAccRequestDto req, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetBankAccsAsync(orgId, fyId, req, ct);
        return Ok(result);
    }

    [HttpGet("acc/{id:long}")]
    public async Task<ActionResult<BankAccListDto>> GetAcc(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetBankAccAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("acc")]
    [RequirePermission(235)]
    public async Task<ActionResult<BankAccWriteResultDto>> CreateAcc(
        [FromBody] BankAccWriteDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            var result = await _repo.CreateBankAccAsync(orgId, fyId, dto, userCode, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("acc/{id:long}")]
    [RequirePermission(236)]
    public async Task<IActionResult> UpdateAcc(
        long id, [FromBody] BankAccWriteDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.UpdateBankAccAsync(orgId, fyId, id, dto, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("acc/{id:long}")]
    [RequirePermission(237)]
    public async Task<IActionResult> DeleteAcc(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        try
        {
            await _repo.DeleteBankAccAsync(orgId, fyId, id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("acc/{id:long}/has-children")]
    public async Task<ActionResult<object>> HasChildren(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var hasChildren = await _repo.BankAccHasChildrenAsync(orgId, fyId, id, ct);
        return Ok(new { hasChildren });
    }
}