using ArianaAPI.Application.DTOs.SpecialHesab;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/special-hesab")]
[Authorize]
public class SpecialHesabController : ControllerBase
{
    private readonly ISpecialHesabRepository _repo;

    public SpecialHesabController(ISpecialHesabRepository repo)
    {
        _repo = repo;
    }

    /// <summary>
    /// ⭐ لیست حساب ویژه بر اساس نوع
    /// kind: 0=کد واحد، 1=مرکز هزینه، 2=کد پروژه
    /// </summary>
    [HttpGet("list/{kind:int}")]
    public async Task<ActionResult<List<SpecialHesabItemDto>>> GetList(
        int kind, CancellationToken ct)
    {
        if (kind < 0 || kind > 2)
            return BadRequest(new { error = "نوع نامعتبر" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var list = await _repo.GetListAsync(orgId, fyId, (SpecialHesabKind)kind, ct);
        return Ok(list);
    }
}