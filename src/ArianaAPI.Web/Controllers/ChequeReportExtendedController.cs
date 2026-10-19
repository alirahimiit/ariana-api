using ArianaAPI.Application.DTOs.Cheque;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

/// <summary>
/// گزارش‌های تفصیلی چک (جلسه ۵۰)
///   • برگشتی‌ها (ChequeOK=2)
///   • کاردکس چک
/// 
/// این کنترلر Endpointهای موجود را دست نمی‌زند — فقط اضافه می‌کند.
/// </summary>
[ApiController]
[Route("api/cheque-report")]
[Authorize]
public class ChequeReportExtendedController : ControllerBase
{
    private readonly IChequeReportExtendedRepository _repo;

    public ChequeReportExtendedController(IChequeReportExtendedRepository repo)
    {
        _repo = repo;
    }

    /// <summary>لیست چک‌های برگشتی (Pay + Receive)</summary>
    [HttpPost("returned/list")]
    public async Task<ActionResult<ReturnedChequeListResultDto>> GetReturnedList(
        [FromBody] ReturnedChequeFilterDto filter, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetReturnedListAsync(orgId, fyId, filter, ct));
    }

    /// <summary>خلاصه گزارش برگشتی‌ها (تعداد + مبلغ + گروه‌بندی بانک)</summary>
    [HttpPost("returned/summary")]
    public async Task<ActionResult<ReturnedChequeSummaryDto>> GetReturnedSummary(
        [FromBody] ReturnedChequeFilterDto filter, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        return Ok(await _repo.GetReturnedSummaryAsync(orgId, fyId, filter, ct));
    }

    /// <summary>کاردکس یک چک خاص (تاریخچه کامل)</summary>
    [HttpPost("kardex")]
    public async Task<ActionResult<ChequeKardexDto>> GetKardex(
        [FromBody] ChequeKardexRequestDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var result = await _repo.GetKardexAsync(orgId, fyId, dto, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("due-date/list")]
    public async Task<IActionResult> GetDueDateList(
        [FromBody] DueDateFilterDto filter,
        [FromServices] IChequeReportExtendedRepository repo,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await repo.GetDueDateListAsync(orgId, fyId, filter, ct);
        return Ok(result);
    }

    public class ConfirmSanadDto { public long SanadId { get; set; } }

    [HttpPost("confirm-sanad-due")]
    public async Task<IActionResult> ConfirmSanadDue([FromBody] ConfirmSanadDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var success = await _repo.ConfirmSanadDueAsync(orgId, fyId, dto.SanadId, ct);
        return success ? Ok() : BadRequest("خطا در تأیید سند");
    }
}