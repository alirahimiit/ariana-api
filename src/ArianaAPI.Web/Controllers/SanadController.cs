using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SanadController : ControllerBase
{
    private readonly ISanadRepository _repo;

    public SanadController(ISanadRepository repo)
    {
        _repo = repo;
    }

    /// <summary>لیست اسناد با فیلتر</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SanadListDto>>> GetList(
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null,
        [FromQuery] int? noFrom = null,
        [FromQuery] int? noTo = null,
        [FromQuery] int? vazeit = null,
        [FromQuery] int? kindSanad = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(
            orgId, fyId, fromDate, toDate, noFrom, noTo, vazeit, kindSanad, page, pageSize, ct);

        return Ok(result);
    }

    /// <summary>جزئیات یک سند</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<SanadDetailDto>> GetById(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetByIdAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>آیتم‌های یک سند</summary>
    [HttpGet("{id:long}/items")]
    public async Task<ActionResult<IEnumerable<SanadItemDto>>> GetItems(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetItemsAsync(orgId, fyId, id, ct);
        return Ok(result);
    }

    /// <summary>تعداد کل اسناد</summary>
    [HttpGet("count")]
    public async Task<ActionResult<int>> GetCount(
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null,
        [FromQuery] int? vazeit = null,
        CancellationToken ct = default)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var count = await _repo.GetCountAsync(orgId, fyId, fromDate, toDate, vazeit, ct);
        return Ok(new { count });
    }
}