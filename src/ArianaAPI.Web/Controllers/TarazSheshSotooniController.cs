using ArianaAPI.Application.DTOs.Taraz;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/taraz-shesh-sotooni")]
[Authorize]
public class TarazSheshSotooniController : ControllerBase
{
    private readonly ITarazSheshSotooniRepository _repo;

    public TarazSheshSotooniController(ITarazSheshSotooniRepository repo)
    {
        _repo = repo;
    }

    [HttpPost("report")]
    public async Task<ActionResult<TarazSheshSotooniResultDto>> GetReport(
        [FromBody] TarazSheshSotooniRequestDto request,
        CancellationToken ct)
    {
        try
        {
            var orgId = User.GetOrgId();
            var fyId = User.GetFyId();

            var result = await _repo.GetTarazAsync(orgId, fyId, request, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            // ⭐ برگرداندن متن دقیق خطای SQL برای نمایش در فرانت‌اند
            return StatusCode(500, new { error = "خطای دیتابیس: " + ex.Message + (ex.InnerException != null ? " - " + ex.InnerException.Message : "") });
        }
    }
}