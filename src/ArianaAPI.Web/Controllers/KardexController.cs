using System.Security.Claims;
using ArianaAPI.Application.Dtos.Reports.Kardex;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/reports/kardex")]
[Authorize]
public class KardexController : ControllerBase
{
    private readonly IKardexRepository _repo;
    private readonly ILogger<KardexController> _logger;

    public KardexController(
        IKardexRepository repo,
        ILogger<KardexController> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    private long GetOrgId() => long.Parse(User.FindFirst("orgId")?.Value ?? "0");
    private long GetFyId() => long.Parse(User.FindFirst("fyId")?.Value ?? "0");

    // ═══════════════════════════════════════════════════
    //  POST /api/reports/kardex
    // ═══════════════════════════════════════════════════
    [HttpPost]
    public async Task<IActionResult> Get(
        [FromBody] KardexRequestDto req,
        CancellationToken ct)
    {
        //if (req.ArticleId <= 0)
        //    return BadRequest(new { error = "شناسه کالا الزامی است" });

        try
        {
            var result = await _repo.GetAsync(GetOrgId(), GetFyId(), req, ct);
            if (result is null)
                return NotFound(new { error = "کالا یافت نشد" });
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در گزارش کاردکس کالا {ArticleId}", req.ArticleId);
            return StatusCode(500, new { error = ex.Message });
        }
    }
}