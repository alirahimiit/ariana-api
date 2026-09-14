using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class LookupController : ControllerBase
{
    private readonly ILookupRepository _lookup;

    public LookupController(ILookupRepository lookup)
    {
        _lookup = lookup;
    }

    /// <summary>لیست سازمان‌ها (از Permanent DB)</summary>
    [HttpGet("organizations")]
    public async Task<IActionResult> GetOrganizations(CancellationToken ct)
    {
        var list = await _lookup.GetOrganizationsAsync(ct);
        return Ok(list);
    }

    /// <summary>دوره‌های مالی یک سازمان</summary>
    [HttpGet("organizations/{orgId:long}/fiscal-years")]
    public async Task<IActionResult> GetFiscalYears(long orgId, CancellationToken ct)
    {
        var list = await _lookup.GetFiscalYearsAsync(orgId, ct);
        return Ok(list);
    }
}