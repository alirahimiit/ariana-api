using ArianaAPI.Application.DTOs.Permissions;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PermissionController : ControllerBase
{
    private readonly IMenuRegistryRepository _menus;
    private readonly IPermissionRepository _perms;

    public PermissionController(
        IMenuRegistryRepository menus,
        IPermissionRepository perms)
    {
        _menus = menus;
        _perms = perms;
    }

    private (long orgId, long fyId) GetOrgFy()
    {
        var orgId = long.Parse(User.FindFirst("orgId")?.Value ?? "0");
        var fyId = long.Parse(User.FindFirst("fyId")?.Value ?? "0");
        return (orgId, fyId);
    }

    // ═══ منوهای رجیستری (برای همه) ═══
    [HttpGet("menus")]
    [AllowAnonymous] // منوها حساس نیستن
    public async Task<ActionResult<List<MenuRegistryItemDto>>> GetMenus(CancellationToken ct)
        => Ok(await _menus.GetActiveMenusAsync(ct));

    // ═══ دسترسی‌های کاربر جاری ═══
    [HttpGet("my")]
    public async Task<ActionResult<UserPermissionsDto>> GetMyPermissions(CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();
        var groupCode = long.Parse(User.FindFirst("userGroupCode")?.Value ?? "0");
        if (groupCode == 0) return Ok(new UserPermissionsDto());

        var perms = await _perms.GetByUserGroupAsync(orgId, fyId, groupCode, ct);
        return Ok(perms ?? new UserPermissionsDto());
    }

    // ═══ لیست گروه‌ها (برای UI مدیریت) ═══
    [HttpGet("groups")]
    public async Task<ActionResult<List<UserGroupDto>>> GetGroups(CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();
        return Ok(await _perms.GetAllUserGroupsAsync(orgId, fyId, ct));
    }

    // ═══ دسترسی‌های یک گروه (برای UI مدیریت) ═══
    [HttpGet("groups/{code:long}")]
    public async Task<ActionResult<UserPermissionsDto>> GetGroupPermissions(
        long code, CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();
        var perms = await _perms.GetByUserGroupAsync(orgId, fyId, code, ct);
        return perms is null ? NotFound() : Ok(perms);
    }

    // ═══ ذخیره‌ی دسترسی‌های یک گروه ═══
    [HttpPut("groups/{code:long}")]
    public async Task<IActionResult> SaveGroupPermissions(
        long code, [FromBody] SavePermissionsDto dto, CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();
        await _perms.SaveAsync(orgId, fyId, code, dto, ct);
        return NoContent();
    }

    // ═══ ذخیره گروه (Create/Update) ═══
    [HttpPost("groups")]
    public async Task<ActionResult<long>> SaveGroup(
        [FromBody] UserGroupDto dto, CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();
        var code = await _perms.SaveUserGroupAsync(orgId, fyId, dto, ct);
        return Ok(new { userGroupCode = code });
    }

    // ═══ لیست عملیات‌ها ═══
    [HttpGet("operations")]
    public async Task<ActionResult<List<OtherItemDto>>> GetOperations(CancellationToken ct)
    {
        var (orgId, fyId) = GetOrgFy();
        return Ok(await _perms.GetAllOperationsAsync(orgId, fyId, ct));
    }
}