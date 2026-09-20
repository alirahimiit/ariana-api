using ArianaAPI.Application.DTOs.Tafzili;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TafziliController : ControllerBase
{
    private readonly ITafziliRepository _repo;

    public TafziliController(ITafziliRepository repo)
    {
        _repo = repo;
    }

    /// <summary>لیست تفضیلی‌ها</summary>
    [HttpPost("list")]
    public async Task<ActionResult<TafziliListResultDto>> GetList(
        [FromBody] TafziliRequestDto request,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(orgId, fyId, request, ct);
        return Ok(result);
    }

    /// <summary>جزئیات تفضیلی</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<TafziliDetailDto>> GetDetail(
        long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>لیست گروه‌های تفضیلی (برای dropdown فیلتر)</summary>
    [HttpGet("groups")]
    public async Task<ActionResult<IEnumerable<TafziliGroupDto>>> GetGroups(
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetGroupsAsync(orgId, fyId, ct);
        return Ok(result);
    }

    /// <summary>ذخیره گروه تفضیلی (جدید یا ویرایش)</summary>
    [HttpPost("groups/save")]
    public async Task<ActionResult<long>> SaveGroup(
        [FromBody] TafziliGroupSaveDto dto,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { error = "نام گروه الزامی است" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var id = await _repo.SaveGroupAsync(orgId, fyId, dto, ct);
        return Ok(new { id });
    }

    /// <summary>حذف گروه تفضیلی</summary>
    [HttpDelete("groups/{id:long}")]
    public async Task<IActionResult> DeleteGroup(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var ok = await _repo.DeleteGroupAsync(orgId, fyId, id, ct);
        return ok ? NoContent() : NotFound();
    }

}