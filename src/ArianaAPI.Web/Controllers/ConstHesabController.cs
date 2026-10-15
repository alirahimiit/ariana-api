using ArianaAPI.Application.Dtos.ConstHesab;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/const-hesab")]
[Authorize]
public class ConstHesabController : ControllerBase
{
    private readonly IConstHesabRepository _repo;

    public ConstHesabController(IConstHesabRepository repo)
    {
        _repo = repo;
    }

    // ─── لیست ───
    [HttpGet("list")]
    public async Task<ActionResult<List<ConstHesabItemDto>>> GetList(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var list = await _repo.GetListAsync(orgId, fyId, ct);
        return Ok(list);
    }

    // ─── Set (INSERT یا UPDATE) — بدون RequirePermission ───
    [HttpPost("set")]
    public async Task<ActionResult> Set(
        [FromBody] ConstHesabSetDto dto, CancellationToken ct)
    {
        try
        {
            var orgId = User.GetOrgId();
            var fyId = User.GetFyId();
            var userCode = User.GetUserId();

            var ok = await _repo.SetAsync(orgId, fyId, dto, userCode, ct);
            if (!ok) return BadRequest(new { error = "ذخیره نشد" });

            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ─── Clear — بدون RequirePermission ───
    [HttpDelete("{type:int}")]
    public async Task<ActionResult> Clear(int type, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var ok = await _repo.ClearAsync(orgId, fyId, type, ct);
        return Ok(new { success = ok });
    }
}