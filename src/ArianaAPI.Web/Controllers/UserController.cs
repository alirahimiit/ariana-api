using ArianaAPI.Application.DTOs.Permissions;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserRepository _users;

    public UserController(IUserRepository users)
    {
        _users = users;
    }

    private (long orgId, long fyId) GetOrgFy()
    {
        var orgId = long.Parse(User.FindFirst("orgId")?.Value ?? "0");
        var fyId = long.Parse(User.FindFirst("fyId")?.Value ?? "0");
        return (orgId, fyId);
    }

    // ═══ لیست کاربران ═══
    [HttpGet("list")]
    public async Task<ActionResult<List<UserDto>>> GetAll(CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();
        var result = await _users.GetAllAsync(orgId, fyId, ct);
        return Ok(result);
    }

    // ═══ دریافت کاربر با ID ═══
    [HttpGet("{id:long}")]
    public async Task<ActionResult<UserDto>> GetById(long id, CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();
        var user = await _users.GetByIdExtendedAsync(orgId, fyId, id, ct);

        if (user == null)
            return NotFound(new { error = "کاربر یافت نشد" });

        return Ok(user);
    }

    // ═══ چک تکراری بودن کد کاربری ═══
    [HttpGet("check-code")]
    public async Task<IActionResult> CheckCode([FromQuery] string code, [FromQuery] long? excludeId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { error = "کد کاربری وارد نشده است" });

        var (orgId, fyId) = GetOrgFy();
        var exists = await _users.ExistsUserCodeAsync(orgId, fyId, code, excludeId, ct);

        return Ok(new { exists });
    }

    // ═══ ایجاد کاربر جدید ═══
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.UserCode) || string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { error = "کد کاربری، نام و رمز عبور الزامی هستند" });

        var (orgId, fyId) = GetOrgFy();

        // چک تکراری نبودن
        var exists = await _users.ExistsUserCodeAsync(orgId, fyId, dto.UserCode, null, ct);
        if (exists)
            return BadRequest(new { error = "این کد کاربری قبلاً استفاده شده است" });

        var newId = await _users.CreateAsync(orgId, fyId, dto, ct);
        return Ok(new { usersId = newId, message = "کاربر با موفقیت ایجاد شد" });
    }

    // ═══ ویرایش کاربر ═══
    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateUserDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.UserCode) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { error = "کد کاربری و نام الزامی هستند" });

        var (orgId, fyId) = GetOrgFy();

        // چک تکراری نبودن (با استثنای خود این کاربر)
        var exists = await _users.ExistsUserCodeAsync(orgId, fyId, dto.UserCode, id, ct);
        if (exists)
            return BadRequest(new { error = "این کد کاربری قبلاً برای کاربر دیگری ثبت شده است" });

        var ok = await _users.UpdateAsync(orgId, fyId, id, dto, ct);

        if (!ok)
            return NotFound(new { error = "کاربر یافت نشد" });

        return Ok(new { message = "کاربر با موفقیت ویرایش شد" });
    }

    // ═══ حذف کاربر ═══
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();

        // ⭐ جلوگیری از حذف خود
        var currentUserId = long.Parse(User.FindFirst("userId")?.Value ?? "0");
        if (currentUserId == id)
            return BadRequest(new { error = "شما نمی‌توانید حساب کاربری خودتان را حذف کنید" });

        var ok = await _users.DeleteAsync(orgId, fyId, id, ct);

        if (!ok)
            return NotFound(new { error = "کاربر یافت نشد" });

        return NoContent();
    }

    // ═══ بازنشانی رمز توسط ادمین ═══
    [HttpPost("{id:long}/reset-password")]
    public async Task<IActionResult> ResetPassword(long id, [FromBody] ResetPasswordDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.NewPassword))
            return BadRequest(new { error = "رمز عبور جدید الزامی است" });

        var (orgId, fyId) = GetOrgFy();
        var ok = await _users.ResetPasswordAsync(orgId, fyId, id, dto.NewPassword, ct);

        if (!ok)
            return NotFound(new { error = "کاربر یافت نشد" });

        return Ok(new { message = "رمز عبور با موفقیت تغییر کرد" });
    }
}