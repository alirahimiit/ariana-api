using ArianaAPI.Application.Common;
using ArianaAPI.Application.Dtos.Reports;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/orgs/{orgId:long}/fy/{fyId:long}/reports")]
[Authorize]
public class ProfitLossController : ControllerBase
{
    private readonly IProfitLossRepository _repo;

    public ProfitLossController(IProfitLossRepository repo)
    {
        _repo = repo;
    }

    [HttpGet("profit-loss")]
    public async Task<IActionResult> GetProfitLoss(
        long orgId,
        long fyId,
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] bool includeZeroBalance = false,
        CancellationToken ct = default)
    {
        var req = new ProfitLossRequestDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            IncludeZeroBalance = includeZeroBalance
        };

        var result = await _repo.GetReportAsync(orgId, fyId, req, ct);
        return Ok(result);
    }
}