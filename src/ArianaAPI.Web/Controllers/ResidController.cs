using ArianaAPI.Application.DTOs.Resid;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

/// <summary>
/// API رسیدهای نقدی (پرداخت + دریافت)
/// — هر دو از یک Controller استفاده می‌کنند و با CheckKind تفکیک می‌شوند
///   CheckKind = 1 → پرداخت نقدی (PayCash)
///   CheckKind = 2 → دریافت نقدی (ReceiveCash)
/// 
/// معادل دلفی: TResid + TResidListForm
/// Permission codes: 146 (درج), 147 (ویرایش), 148 (حذف)
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ResidController : ControllerBase
{
    private readonly IResidRepository _repo;

    public ResidController(IResidRepository repo)
    {
        _repo = repo;
    }

    // ═══════════════════════════════════════════
    //  READ
    // ═══════════════════════════════════════════

    /// <summary>
    /// لیست رسیدها با فیلتر و صفحه‌بندی.
    /// CheckKind در Body فرستاده می‌شود (1=پرداخت، 2=دریافت).
    /// </summary>
    [HttpPost("list")]
    public async Task<ActionResult<ResidListResultDto>> GetList(
        [FromBody] ResidFilterDto filter,
        CancellationToken ct)
    {
        if (filter.CheckKind != 0 && filter.CheckKind != 1)
            return BadRequest(new { error = "نوع رسید (CheckKind) باید 0 یا 1 باشد" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(orgId, fyId, filter, ct);
        return Ok(result);
    }

    /// <summary>جزئیات یک رسید</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ResidDetailDto>> GetById(
        long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetByIdAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>شماره رسید بعدی (برای نمایش در فرم جدید)</summary>
    [HttpGet("next-number")]
    public async Task<ActionResult<object>> GetNextNumber(
        [FromQuery] int checkKind,
        CancellationToken ct)
    {
        if (checkKind != 0 && checkKind != 1)
            return BadRequest(new { error = "نوع رسید باید 0 یا 1 باشد" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var n = await _repo.GetNextNumberAsync(orgId, fyId, checkKind, ct);
        return Ok(new { residNumber = n });
    }

    /// <summary>لیست اسناد ParentSanad برای ComboBox</summary>
    [HttpGet("sanad-list")]
    public async Task<ActionResult<IEnumerable<ResidSanadComboDto>>> GetSanadList(
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var list = await _repo.GetParentSanadListAsync(orgId, fyId, ct);
        return Ok(list);
    }

    // ═══════════════════════════════════════════
    //  WRITE
    // ═══════════════════════════════════════════

    /// <summary>ایجاد رسید جدید</summary>
    [HttpPost]
    [RequirePermission(146)]
    public async Task<ActionResult<ResidCreateResultDto>> Create(
        [FromBody] ResidCreateDto dto,
        CancellationToken ct)
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

    /// <summary>ویرایش رسید</summary>
    [HttpPut("{id:long}")]
    [RequirePermission(147)]
    public async Task<IActionResult> Update(
        long id,
        [FromBody] ResidUpdateDto dto,
        CancellationToken ct)
    {
        if (id != dto.ID)
            return BadRequest(new { error = "شناسه رسید در URL و بدنه یکسان نیست" });

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

    /// <summary>حذف رسید (سند مربوطه هم حذف می‌شود)</summary>
    [HttpDelete("{id:long}")]
    [RequirePermission(148)]
    public async Task<IActionResult> Delete(
        long id,
        CancellationToken ct)
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