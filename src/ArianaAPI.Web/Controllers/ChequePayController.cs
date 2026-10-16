using ArianaAPI.Application.DTOs.Cheque;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

/// <summary>
/// API چک‌های پرداختی (CheckPay)
/// معادل دلفی: TChequePayListForm
/// 
/// Permission codes:
///   Create  → 137
///   Edit    → 138
///   Delete  → 139
///   OK      → 127
///   UnOK    → 128
///   Return  → 133
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChequePayController : ControllerBase
{
    private readonly IChequePayRepository _repo;

    public ChequePayController(IChequePayRepository repo)
    {
        _repo = repo;
    }

    // ═══════════════════════════════════════════════════════════════
    //  READ
    // ═══════════════════════════════════════════════════════════════

    /// <summary>لیست چک‌های پرداختی با فیلتر و صفحه‌بندی</summary>
    [HttpPost("list")]
    public async Task<ActionResult<ChequePayListResultDto>> GetList(
        [FromBody] ChequePayFilterDto filter,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(orgId, fyId, filter, ct);
        return Ok(result);
    }

    /// <summary>جزئیات یک چک پرداختی</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ChequePayDetailDto>> GetById(
        long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetByIdAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>شماره رسید بعدی (برای فرم جدید)</summary>
    [HttpGet("next-number")]
    public async Task<ActionResult<object>> GetNextNumber(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var n = await _repo.GetNextNumberAsync(orgId, fyId, ct);
        return Ok(new { residNumber = n });
    }

    /// <summary>لیست اسناد ParentSanad (Vazeit ≠ 2) برای ComboBox</summary>
    [HttpGet("sanad-list")]
    public async Task<ActionResult<IEnumerable<ChequeSanadComboDto>>> GetSanadList(
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var list = await _repo.GetParentSanadListAsync(orgId, fyId, ct);
        return Ok(list);
    }

    // ═══════════════════════════════════════════════════════════════
    //  WRITE — CRUD
    // ═══════════════════════════════════════════════════════════════

    /// <summary>ایجاد چک پرداختی جدید + سند خودکار (پیش‌نویس)</summary>
    [HttpPost]
    [RequirePermission(137)]
    public async Task<ActionResult<ChequePayCreateResultDto>> Create(
        [FromBody] ChequePayCreateDto dto,
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

    /// <summary>ویرایش چک پرداختی</summary>
    [HttpPut("{id:long}")]
    [RequirePermission(138)]
    public async Task<IActionResult> Update(
        long id,
        [FromBody] ChequePayUpdateDto dto,
        CancellationToken ct)
    {
        if (id != dto.Id)
            return BadRequest(new { error = "شناسه چک در URL و بدنه یکسان نیست" });

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

    /// <summary>حذف چک پرداختی (سند مربوطه هم حذف می‌شود)</summary>
    [HttpDelete("{id:long}")]
    [RequirePermission(139)]
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

    // ═══════════════════════════════════════════════════════════════
    //  WORKFLOW — OK / UnOK / Return
    // ═══════════════════════════════════════════════════════════════

    /// <summary>اعلام پرداخت چک پرداختی — ChequeOK=1</summary>
    [HttpPost("{id:long}/ok")]
    [RequirePermission(127)]
    public async Task<IActionResult> Ok(
        long id,
        [FromBody] ChequePayOkRequestDto dto,
        CancellationToken ct)
    {
        if (id != dto.Id)
            return BadRequest(new { error = "شناسه چک در URL و بدنه یکسان نیست" });

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

    /// <summary>لغو اعلام پرداخت چک پرداختی — ChequeOK=0</summary>
    [HttpPost("{id:long}/unok")]
    [RequirePermission(128)]
    public async Task<IActionResult> UnOk(
        long id,
        CancellationToken ct)
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

    /// <summary>اعلام برگشت چک پرداختی — ChequeOK=2</summary>
    [HttpPost("{id:long}/return")]
    [RequirePermission(133)]
    public async Task<IActionResult> Return(
        long id,
        CancellationToken ct)
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