using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/sanad-renumber")]
[Authorize]
public class SanadRenumberController : ControllerBase
{
    private readonly ISanadRenumberRepository _repo;

    public SanadRenumberController(ISanadRenumberRepository repo)
    {
        _repo = repo;
    }

    private long GetLongClaim(string name)
    {
        var v = User.FindFirstValue(name);
        return long.TryParse(v, out var r) ? r : 0;
    }

    private (long orgId, long fyId, long userCode) GetContext()
    {
        var orgId = GetLongClaim("orgId");
        var fyId = GetLongClaim("fyId");
        var userCode = GetLongClaim("userCode");
        if (userCode == 0) userCode = GetLongClaim(ClaimTypes.NameIdentifier);
        if (userCode == 0) userCode = GetLongClaim("sub");
        return (orgId, fyId, userCode);
    }

    // ═══ Preview / Commit — اسناد ═══
    [HttpPost("sanad/preview")]
    [RequirePermission(200)]
    public async Task<IActionResult> PreviewSanad(CancellationToken ct)
    {
        try
        {
            var (orgId, fyId, _) = GetContext();
            var result = await _repo.PreviewSanadAsync(orgId, fyId, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("sanad/commit")]
    [RequirePermission(200)]
    public async Task<IActionResult> CommitSanad(CancellationToken ct)
    {
        try
        {
            var (orgId, fyId, userCode) = GetContext();
            var result = await _repo.CommitSanadAsync(orgId, fyId, userCode, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ═══ Preview / Commit — فاکتورها ═══
    [HttpPost("factor/preview")]
    [RequirePermission(200)]
    public async Task<IActionResult> PreviewFactor(CancellationToken ct)
    {
        try
        {
            var (orgId, fyId, _) = GetContext();
            var result = await _repo.PreviewFactorAsync(orgId, fyId, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("factor/commit")]
    [RequirePermission(200)]
    public async Task<IActionResult> CommitFactor(CancellationToken ct)
    {
        try
        {
            var (orgId, fyId, userCode) = GetContext();
            var result = await _repo.CommitFactorAsync(orgId, fyId, userCode, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}