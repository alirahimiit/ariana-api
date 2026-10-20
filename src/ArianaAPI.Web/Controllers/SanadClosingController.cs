using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/sanad/closing")]
[Authorize]
public class SanadClosingController : ControllerBase
{
    private readonly ISanadClosingService _service;

    public SanadClosingController(ISanadClosingService service)
    {
        _service = service;
    }

    [HttpPost("validate")]
    public async Task<IActionResult> Validate(
        [FromBody] ClosingRequest body, CancellationToken ct)
    {
        var result = await _service.ValidateAsync(body.OrgId, body.FyId, ct);
        return Ok(result);
    }

    [HttpPost("create")]
    public async Task<IActionResult> Create(
        [FromBody] SanadClosingRequestDto body, CancellationToken ct)
    {
        // ⭐ حالا ورودی شامل کدینگ حساب اختتامیه هم هست
        var result = await _service.CreateClosingSanadAsync(body, ct);
        return Ok(result);
    }

    public class ClosingRequest
    {
        public long OrgId { get; set; }
        public long FyId { get; set; }
    }
}