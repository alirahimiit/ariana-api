using ArianaAPI.Application.Dtos.Reports.FactorProfitLoss;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/reports/factor-profit-loss")]
[Authorize]
public class FactorProfitLossController : ControllerBase
{
    private readonly IFactorProfitLossRepository _repo;
    private readonly ILogger<FactorProfitLossController> _logger;

    public FactorProfitLossController(
        IFactorProfitLossRepository repo,
        ILogger<FactorProfitLossController> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    private long GetOrgId() => long.Parse(User.FindFirst("orgId")?.Value ?? "0");
    private long GetFyId() => long.Parse(User.FindFirst("fyId")?.Value ?? "0");

    [HttpPost]
    public async Task<IActionResult> Get(
        [FromBody] FactorProfitLossRequestDto req,
        CancellationToken ct)
    {
        try
        {
            var result = await _repo.GetAsync(GetOrgId(), GetFyId(), req, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در گزارش سود و زیان فاکتوری");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}