using ArianaAPI.Application.Dtos.Reports.PartyFactor;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/reports/party-factor")]
[Authorize]
public class PartyFactorController : ControllerBase
{
    private readonly IPartyFactorRepository _repo;
    private readonly ILogger<PartyFactorController> _logger;

    public PartyFactorController(
        IPartyFactorRepository repo,
        ILogger<PartyFactorController> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    private long GetOrgId() => long.Parse(User.FindFirst("orgId")?.Value ?? "0");
    private long GetFyId() => long.Parse(User.FindFirst("fyId")?.Value ?? "0");

    [HttpPost]
    public async Task<IActionResult> Get(
        [FromBody] PartyFactorRequestDto req,
        CancellationToken ct)
    {
        try
        {
            var result = await _repo.GetAsync(GetOrgId(), GetFyId(), req, ct);
            if (result is null)
                return NotFound(new { error = "طرف حساب یافت نشد" });
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در گزارش فاکتورهای طرف حساب");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}