using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ArianaAPI.Web.Filters;

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

    // ═══════════════════════════════════════════
    //  READ
    // ═══════════════════════════════════════════

    /// <summary>لیست اسناد با فیلتر</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SanadListDto>>> GetList(
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null,
        [FromQuery] int? noFrom = null,
        [FromQuery] int? noTo = null,
        [FromQuery] int? vazeit = null,
        [FromQuery] int? kindSanad = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(
              orgId, fyId, fromDate, toDate, noFrom, noTo, vazeit, kindSanad,
            sortBy, sortDir,
            page, pageSize, ct);

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

    // ═══════════════════════════════════════════
    //  WRITE (جدید - فاز ۱۱)
    // ═══════════════════════════════════════════

    /// <summary>ایجاد سند جدید</summary>
    [HttpPost]
    [RequirePermission(101)]
    public async Task<ActionResult<SanadCreateResultDto>> Create(
        [FromBody] SanadCreateDto dto, CancellationToken ct)
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

    /// <summary>ویرایش سند</summary>
    [HttpPut("{id:long}")]
    [RequirePermission(102)]
    public async Task<IActionResult> Update(
        long id,
        [FromBody] SanadUpdateDto dto,
        CancellationToken ct)
    {
        if (id != dto.ParentSanadId)
            return BadRequest(new { error = "شناسه سند در URL و بدنه یکسان نیست" });

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

    /// <summary>حذف سند</summary>
    [HttpDelete("{id:long}")]
    [RequirePermission(108)]
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

    /// <summary>وضعیت سند (برای چک قابل‌ویرایش بودن)</summary>
    [HttpGet("{id:long}/vazeit")]
    public async Task<ActionResult<int>> GetVazeit(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var vazeit = await _repo.GetVazeitAsync(orgId, fyId, id, ct);
        if (vazeit < 0) return NotFound();
        return Ok(new { vazeit });
    }
}