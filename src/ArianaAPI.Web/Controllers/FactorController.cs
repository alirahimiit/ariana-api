using ArianaAPI.Application.DTOs.Factor;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FactorController : ControllerBase
{
    private readonly IFactorRepository _repo;

    public FactorController(IFactorRepository repo)
    {
        _repo = repo;
    }

    /// <summary>لیست فاکتورها</summary>
    [HttpPost("list")]
    public async Task<ActionResult<FactorListResultDto>> GetList(
        [FromBody] FactorRequestDto request,
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetListAsync(orgId, fyId, request, ct);
        return Ok(result);
    }

    /// <summary>جزئیات فاکتور</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<FactorResultDto>> GetDetail(
        long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetDetailAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }
}