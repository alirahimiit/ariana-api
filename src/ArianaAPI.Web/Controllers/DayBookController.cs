using ArianaAPI.Application.Dtos.Reports;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/orgs/{orgId:long}/fy/{fyId:long}/reports")]
[Authorize]
public class DayBookController : ControllerBase
{
    private readonly IDayBookRepository _repo;

    public DayBookController(IDayBookRepository repo)
    {
        _repo = repo;
    }

    /// <summary>
    /// دفتر روزنامه — با 4 حالت:
    ///   level=col + mode=aggregated  → سطح کل (تجمیعی)
    ///   level=col + mode=perSanad    → سطح کل (بصورت سند)
    ///   level=tafzil + mode=aggregated → معین/تفضیل (تجمیعی)
    ///   level=tafzil2 + mode=aggregated → تفضیلی 2 (تجمیعی)
    /// </summary>
    [HttpPost("daybook")]
    public async Task<IActionResult> GetDayBook(
        long orgId,
        long fyId,
        [FromBody] DayBookRequestDto request,
        CancellationToken ct = default)
    {
        request ??= new DayBookRequestDto();
        var result = await _repo.GetReportAsync(orgId, fyId, request, ct);
        return Ok(result);
    }
}