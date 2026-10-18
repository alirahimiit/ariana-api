using ArianaAPI.Application.DTOs.Setup;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly ISetupRepository _repo;

    public SetupController(ISetupRepository repo)
    {
        _repo = repo;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] SetupLoginDto dto, CancellationToken ct)
    {
        var ok = await _repo.AuthenticateAsync(dto.Username, dto.Password, ct);
        if (!ok) return Unauthorized(new { error = "نام کاربری یا رمز عبور نامعتبر است" });
        return Ok(new { success = true });
    }

    [HttpGet("sazmans")]
    public async Task<IActionResult> GetSazmans(CancellationToken ct)
    {
        var list = await _repo.GetSazmansAsync(ct);
        return Ok(list);
    }

    [HttpGet("doreh-malis")]
    public async Task<IActionResult> GetDorehMalis([FromQuery] long sazmanId, CancellationToken ct)
    {
        var list = await _repo.GetDorehMalisAsync(sazmanId, ct);
        return Ok(list);
    }

    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] SetupRequestDto req, CancellationToken ct)
    {
        try
        {
            var result = await _repo.CreateDorehMaliAsync(req, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}