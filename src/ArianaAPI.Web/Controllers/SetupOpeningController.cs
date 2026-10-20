using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/setup/opening-sanad")]
[AllowAnonymous]
public class SetupOpeningController : ControllerBase
{
    private readonly ISanadOpeningService _service;

    public SetupOpeningController(ISanadOpeningService service)
    {
        _service = service;
    }

    /// <summary>
    /// ساخت سند افتتاحیه پس از ایجاد دوره مالی — تراکنش مستقل
    /// شکست این endpoint نباید دوره مالی را rollback کند.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] OpeningRequest body, CancellationToken ct)
    {
        try
        {
            var result = await _service.CreateOpeningSanadAsync(
                body.OrgId, body.FyId, ct);

            return Ok(result);
        }
        catch (Exception ex)
        {
            // حتی در خطای غیرمنتظره، HTTP 200 با success=false
            // تا فرانت‌اند فقط هشدار نشان دهد — دوره مالی از بین نرود
            return Ok(new
            {
                success = false,
                message = "خطای غیرمنتظره: " + ex.Message
            });
        }
    }

    public class OpeningRequest
    {
        public long OrgId { get; set; }
        public long FyId { get; set; }
    }
}