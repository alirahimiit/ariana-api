using ArianaAPI.Application.DTOs.Auth;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Login(
        [FromBody] LoginRequestDto request,
        CancellationToken ct)
    {
        var result = await _authService.LoginAsync(request, ct);
        return Ok(result);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponseDto>> Refresh(
        [FromBody] RefreshTokenRequestDto request,
        CancellationToken ct)
    {
        var result = await _authService.RefreshAsync(request, ct);
        return Ok(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(
        [FromBody] RefreshTokenRequestDto request,
        CancellationToken ct)
    {
        await _authService.LogoutAsync(request.RefreshToken, ct);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        return Ok(new
        {
            UserId = User.FindFirst("userId")?.Value,
            Username = User.Identity?.Name,
            OrgId = User.FindFirst("orgId")?.Value,
            FyId = User.FindFirst("fyId")?.Value
        });
    }
}