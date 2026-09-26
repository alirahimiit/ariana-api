using ArianaAPI.Application.DTOs.Tafzili;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ArianaAPI.Web.Filters;

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

    /// <summary>درج تفضیلی جدید</summary>
    [HttpPost]
    [RequirePermission(193)]
    public async Task<ActionResult<TafziliCreateResultDto>> Create(
        [FromBody] TafziliCreateDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        try
        {
            var result = await _repo.CreateAsync(orgId, fyId, dto, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>ویرایش تفضیلی</summary>
    [HttpPut("{id:long}")]
    [RequirePermission(194)]
    public async Task<IActionResult> Update(
        long id, [FromBody] TafziliUpdateDto dto, CancellationToken ct)
    {
        if (id != dto.Id)
            return BadRequest(new { error = "شناسه در URL و بدنه یکسان نیست" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        try
        {
            await _repo.UpdateAsync(orgId, fyId, dto, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>حذف تفضیلی</summary>
    [HttpDelete("{id:long}")]
    [RequirePermission(195)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        try
        {
            await _repo.DeleteAsync(orgId, fyId, id, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

}