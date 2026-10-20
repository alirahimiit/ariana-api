using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/sanad-movaghat")]
[Authorize]
public class SanadMovaghatController : ControllerBase
{
    private readonly ISanadMovaghatService _service;
    public SanadMovaghatController(ISanadMovaghatService service) => _service = service;

    [HttpPost("add")]
    public async Task<IActionResult> Add([FromBody] AddReq body, CancellationToken ct)
    {
        try
        {
            await _service.AddRowAsync(body.OrgId, body.FyId, body.Filter, body.Cu, ct);
            return Ok(new { success = true });
        }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("list")]
    public async Task<IActionResult> List([FromBody] BaseReq body, CancellationToken ct)
    {
        var rows = await _service.GetStagingRowsAsync(body.OrgId, body.FyId, body.Cu, ct);
        return Ok(rows);
    }

    [HttpPost("delete")]
    public async Task<IActionResult> Delete([FromBody] DelReq body, CancellationToken ct)
    {
        await _service.DeleteRowAsync(body.OrgId, body.FyId, body.Id, ct);
        return Ok(new { success = true });
    }

    [HttpPost("clear")]
    public async Task<IActionResult> Clear([FromBody] BaseReq body, CancellationToken ct)
    {
        await _service.ClearStagingAsync(body.OrgId, body.FyId, body.Cu, ct);
        return Ok(new { success = true });
    }

    [HttpPost("save")]
    public async Task<IActionResult> Save([FromBody] SaveReq body, CancellationToken ct)
    {
        var res = await _service.SaveAsync(body.OrgId, body.FyId, body.Cu, body.DateIn, ct);
        return Ok(res);
    }

    public class BaseReq { public long OrgId { get; set; } public long FyId { get; set; } public string Cu { get; set; } = "web_user"; }
    public class AddReq : BaseReq { public SanadMovaghatPreviewRequestDto Filter { get; set; } = new(); }
    public class DelReq : BaseReq { public long Id { get; set; } }
    public class SaveReq : BaseReq { public string DateIn { get; set; } = ""; }
}