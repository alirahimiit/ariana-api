using ArianaAPI.Application.DTOs.Lookup;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LocationController : ControllerBase
{
    private readonly ILocationRepository _repo;

    public LocationController(ILocationRepository repo)
    {
        _repo = repo;
    }

    /// <summary>لیست استان‌ها</summary>
    [HttpGet("states")]
    public async Task<ActionResult<IEnumerable<StateDto>>> GetStates(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetStatesAsync(orgId, fyId, ct);
        return Ok(result);
    }

    /// <summary>لیست شهرها — اگه stateId بدی، فیلتر می‌شه</summary>
    [HttpGet("cities")]
    public async Task<ActionResult<IEnumerable<CityDto>>> GetCities(
        [FromQuery] long? stateId, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetCitiesAsync(orgId, fyId, stateId, ct);
        return Ok(result);
    }
}