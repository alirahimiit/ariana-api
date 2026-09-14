using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SharhController : ControllerBase
{
    private readonly ISharhRepository _repo;

    public SharhController(ISharhRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SharhDto>>> GetAll(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetAllAsync(orgId, fyId, ct));
    }
}