using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class KindSanadController : ControllerBase
{
    private readonly IKindSanadRepository _repo;

    public KindSanadController(IKindSanadRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<KindSanadDto>>> GetAll(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetAllAsync(orgId, fyId, ct));
    }
}