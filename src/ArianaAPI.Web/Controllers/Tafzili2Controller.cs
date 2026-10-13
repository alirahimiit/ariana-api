using ArianaAPI.Application.DTOs.Tafzili2;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using ArianaAPI.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/tafzili2")]
[Authorize]
public class Tafzili2Controller : ControllerBase
{
    private readonly ITafzili2Repository _repo;

    public Tafzili2Controller(ITafzili2Repository repo)
    {
        _repo = repo;
    }

    /// <summary>لیست تفضیلی‌های ۲</summary>
    [HttpPost("list")]
    public async Task<ActionResult<Tafzili2ListResultDto>> GetList(
        [FromBody] Tafzili2RequestDto request, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(orgId, fyId, request, ct);
        return Ok(result);
    }

    /// <summary>جزئیات تفضیلی ۲</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<Tafzili2DetailDto>> GetDetail(
        long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>کد پیشنهادی بعدی</summary>
    [HttpGet("next-code")]
    public async Task<ActionResult<object>> GetNextCode(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var next = await _repo.GetNextCodeAsync(orgId, fyId, ct);
        return Ok(new { nextCode = next });
    }

    /// <summary>چک استفاده قبل از حذف</summary>
    [HttpGet("{id:long}/usage")]
    public async Task<ActionResult<Tafzili2UsageDto>> GetUsage(
        long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetUsageAsync(orgId, fyId, id, ct);
        return Ok(result);
    }

    /// <summary>درج تفضیلی ۲ جدید</summary>
    [HttpPost]
    [RequirePermission(196)]
    public async Task<ActionResult<Tafzili2CreateResultDto>> Create(
        [FromBody] Tafzili2CreateDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            var result = await _repo.CreateAsync(orgId, fyId, dto, userCode, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>ویرایش تفضیلی ۲</summary>
    [HttpPut("{id:long}")]
    [RequirePermission(197)]
    public async Task<IActionResult> Update(
        long id, [FromBody] Tafzili2UpdateDto dto, CancellationToken ct)
    {
        if (id != dto.Id)
            return BadRequest(new { error = "شناسه در URL و بدنه یکسان نیست" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.UpdateAsync(orgId, fyId, dto, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>حذف تفضیلی ۲</summary>
    [HttpDelete("{id:long}")]
    [RequirePermission(198)]
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