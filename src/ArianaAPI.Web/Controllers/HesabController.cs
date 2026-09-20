using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HesabController : ControllerBase
{
    private readonly IHesabRepository _repo;

    public HesabController(IHesabRepository repo)
    {
        _repo = repo;
    }

    /// <summary>همه حساب‌های کل</summary>
    [HttpGet("cols")]
    public async Task<ActionResult<IEnumerable<HesabDto>>> GetCols(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetAllColsAsync(orgId, fyId, ct));
    }

    /// <summary>معین‌های یک کل خاص</summary>
    [HttpGet("cols/{codeCol:int}/moeins")]
    public async Task<ActionResult<IEnumerable<HesabDto>>> GetMoeins(int codeCol, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetMoeinsAsync(orgId, fyId, codeCol, ct));
    }

    /// <summary>تفصیل‌ها (اختیاری فیلتر بر اساس codeCol)</summary>
    [HttpGet("tafzils")]
    public async Task<ActionResult<IEnumerable<HesabDto>>> GetTafzils(
        [FromQuery] int? codeCol, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetTafzilsAsync(orgId, fyId, codeCol, ct));
    }

    /// <summary>همه حساب‌ها (برای tree کامل)</summary>
    [HttpGet("all")]
    public async Task<ActionResult<IEnumerable<HesabDto>>> GetAll(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetAllAsync(orgId, fyId, ct));
    }
    /// <summary>درخت کامل حساب‌ها</summary>
    [HttpGet("tree")]
    public async Task<ActionResult<IEnumerable<HesabTreeDto>>> GetTree(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetTreeAsync(orgId, fyId, ct));
    }
}