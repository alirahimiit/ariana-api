using ArianaAPI.Application.DTOs.Auth;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IUserRepository _users;
    private readonly IConfiguration _config; // ⭐ برای خواندن تنظیمات دیتابیس

    public AuthController(IAuthService authService, IUserRepository users, IConfiguration config)
    {
        _authService = authService;
        _users = users;
        _config = config;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponseDto>> Login(
        [FromBody] LoginRequestDto request,
        CancellationToken ct)
    {
        // ۱. احراز هویت (لاگین)
        var result = await _authService.LoginAsync(request, ct);

        // ⭐ ۲. آپدیت خودکار دیتابیس پس از لاگین موفق
        try
        {
            var server = _config["Database:Server"] ?? "localhost";
            var user = _config["Database:UserId"] ?? "sa";
            var pass = _config["Database:Password"] ?? "";
            var permanentDb = _config["Database:DatabaseName"] ?? "Permanent";
            var prefix = _config["Database:Prefix"] ?? "Acounting_";

            // ساخت رشته اتصال برای دیتابیس اصلی (Permanent)
            var permConnStr = new SqlConnectionStringBuilder
            {
                DataSource = server,
                UserID = user,
                Password = pass,
                InitialCatalog = permanentDb,
                TrustServerCertificate = true,
                ConnectTimeout = 60
            }.ConnectionString;

            // ساخت رشته اتصال برای دیتابیس همین دوره مالی (Tenant)
            var tenantDbName = $"{prefix}{request.OrgId}_{request.FyId}";
            var tenantConnStr = new SqlConnectionStringBuilder
            {
                DataSource = server,
                UserID = user,
                Password = pass,
                InitialCatalog = tenantDbName,
                TrustServerCertificate = true,
                ConnectTimeout = 60
            }.ConnectionString;

            // اجرای آپدیتر
            await DatabaseUpdater.RunUpdaterAsync(permConnStr, isPermanent: true, ct);
            await DatabaseUpdater.RunUpdaterAsync(tenantConnStr, isPermanent: false, ct);
        }
        catch (Exception ex)
        {
            // اگر آپدیت خطا داد، لاگ می‌کنیم ولی ورود کاربر را متوقف نمی‌کنیم
            Console.WriteLine($"[Auto Update Error] {ex.Message}");
        }

        // ۳. برگرداندن توکن
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
    /// <summary>تغییر رمز کاربر جاری</summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequestDto dto,
        CancellationToken ct)
    {
        // اعتبارسنجی
        if (string.IsNullOrWhiteSpace(dto.CurrentPassword))
            return BadRequest(new { error = "رمز فعلی را وارد کنید" });

        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            return BadRequest(new { error = "رمز جدید را وارد کنید" });

        if (dto.NewPassword.Length < 4)
            return BadRequest(new { error = "رمز جدید باید حداقل ۴ کاراکتر باشد" });

        if (dto.CurrentPassword == dto.NewPassword)
            return BadRequest(new { error = "رمز جدید با رمز فعلی یکسان است" });

        var orgId = long.Parse(User.FindFirst("orgId")?.Value ?? "0");
        var fyId = long.Parse(User.FindFirst("fyId")?.Value ?? "0");
        var userId = long.Parse(User.FindFirst("userId")?.Value ?? "0");

        if (userId == 0)
            return Unauthorized(new { error = "کاربر نامعتبر" });

        var ok = await _users.ChangePasswordAsync(
            orgId, fyId, userId,
            dto.CurrentPassword, dto.NewPassword, ct);

        if (!ok)
            return BadRequest(new { error = "رمز فعلی اشتباه است" });

        return Ok(new { message = "رمز با موفقیت تغییر کرد" });
    }
}