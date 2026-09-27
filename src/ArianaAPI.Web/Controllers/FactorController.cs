using ArianaAPI.Application.DTOs.Factor;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FactorController : ControllerBase
{
    private readonly IFactorRepository _repo;

    public FactorController(IFactorRepository repo)
    {
        _repo = repo;
    }

    // ═══════════════════════════════════════════════════
    //  READ (موجود)
    // ═══════════════════════════════════════════════════

    /// <summary>لیست فاکتورها</summary>
    [HttpPost("list")]
    public async Task<ActionResult<FactorListResultDto>> GetList(
        [FromBody] FactorRequestDto request,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(orgId, fyId, request, ct);
        return Ok(result);
    }

    /// <summary>جزئیات فاکتور</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<FactorResultDto>> GetDetail(
        long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    // ═══════════════════════════════════════════════════
    //  LOOKUPS & NEXT-NO
    // ═══════════════════════════════════════════════════

    /// <summary>تنظیمات و نرخ‌های سراسری فاکتور</summary>
    [HttpGet("lookups")]
    public async Task<ActionResult<FactorLookupsDto>> GetLookups(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetLookupsAsync(orgId, fyId, ct);
        return Ok(result);
    }

    /// <summary>شماره بعدی فاکتور بر اساس نوع</summary>
    [HttpGet("next-no")]
    public async Task<ActionResult<FactorNextNoDto>> GetNextNo(
        [FromQuery] int factorKind, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetNextNoAsync(orgId, fyId, factorKind, ct);
        return Ok(result);
    }

    /// <summary>اطلاعات محاسباتی یک کالا برای ردیف فاکتور</summary>
    [HttpGet("article/{articleId:long}/calc")]
    public async Task<ActionResult<FactorArticleCalcDto>> GetArticleCalc(
        long articleId,
        [FromQuery] int factorKind,
        [FromQuery] long? codeTafzil,
        [FromQuery] string? factorDate,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetArticleCalcAsync(
            orgId, fyId, articleId, factorKind, codeTafzil, factorDate, ct);

        return result is null ? NotFound() : Ok(result);
    }

    // ═══════════════════════════════════════════════════
    //  WRITE
    //  ⚠️ کدهای Permission پیشنهادی:
    //      200 = درج فاکتور
    //      201 = ویرایش فاکتور
    //      202 = حذف فاکتور
    //     (بعداً در MenuRegistry ثبتش کن)
    // ═══════════════════════════════════════════════════

    /// <summary>ایجاد فاکتور جدید</summary>
    [HttpPost]
    [RequirePermission(200)]
    public async Task<ActionResult<FactorWriteResultDto>> Create(
        [FromBody] FactorWriteDto dto,
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

    /// <summary>ویرایش فاکتور</summary>
    [HttpPut("{id:long}")]
    [RequirePermission(201)]
    public async Task<IActionResult> Update(
        long id,
        [FromBody] FactorWriteDto dto,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.UpdateAsync(orgId, fyId, id, dto, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>حذف فاکتور</summary>
    [HttpDelete("{id:long}")]
    [RequirePermission(202)]
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
    // ═══════════════════════════════════════════════════
    //  سند خودکار
    // ═══════════════════════════════════════════════════

    /// <summary>ثبت سند برای یک فاکتور</summary>
    [HttpPost("{id:long}/create-sanad")]
    [RequirePermission(200)]
    public async Task<ActionResult<SanadCreateResultDto>> CreateSanad(
        long id,
        [FromBody] SanadCreateRequestDto request,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.CreateSanadAsync(orgId, fyId, id, request, ct);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>ثبت سند گروهی</summary>
    [HttpPost("bulk-sanad")]
    [RequirePermission(200)]
    public async Task<ActionResult<SanadBulkResultDto>> BulkCreateSanad(
        [FromBody] SanadBulkRequestDto request,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.BulkCreateSanadAsync(orgId, fyId, request, ct);
        return Ok(result);
    }

    /// <summary>حذف سند مرتبط با فاکتور</summary>
    [HttpDelete("{id:long}/sanad")]
    [RequirePermission(201)]
    public async Task<IActionResult> DeleteSanad(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        try
        {
            await _repo.DeleteSanadAsync(orgId, fyId, id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}