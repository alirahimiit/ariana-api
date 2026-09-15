using ArianaAPI.Application.DTOs.Taraz;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TarazController : ControllerBase
{
    private readonly ITarazRepository _repo;

    public TarazController(ITarazRepository repo)
    {
        _repo = repo;
    }

    /// <summary>تراز حساب‌ها</summary>
    [HttpPost]
    public async Task<ActionResult<TarazResultDto>> GetTaraz(
        [FromBody] TarazRequestDto request,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetTarazAsync(orgId, fyId, request, ct);
        return Ok(result);
    }
}