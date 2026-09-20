using ArianaAPI.Application.Dtos.Reports;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/orgs/{orgId:long}/fy/{fyId:long}/reports")]
[Authorize]
public class BilanController : ControllerBase
{
    private readonly IBilanRepository _repo;

    public BilanController(IBilanRepository repo)
    {
        _repo = repo;
    }

    [HttpGet("bilan")]
    public async Task<IActionResult> GetBilan(
        long orgId,
        long fyId,
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] bool includeZeroBalance = false,
        CancellationToken ct = default)
    {
        var req = new BilanRequestDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            IncludeZeroBalance = includeZeroBalance
        };

        var result = await _repo.GetReportAsync(orgId, fyId, req, ct);
        return Ok(result);
    }
}