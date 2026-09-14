using ArianaAPI.Application.DTOs.Ledger;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LedgerController : ControllerBase
{
    private readonly ILedgerRepository _repo;

    public LedgerController(ILedgerRepository repo)
    {
        _repo = repo;
    }

    /// <summary>دفتر حساب (کل / معین / تفضیلی 1 / تفضیلی 2)</summary>
    [HttpPost]
    public async Task<ActionResult<LedgerResultDto>> GetLedger(
        [FromBody] LedgerRequestDto request,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetLedgerAsync(orgId, fyId, request, ct);
        return Ok(result);
    }
}