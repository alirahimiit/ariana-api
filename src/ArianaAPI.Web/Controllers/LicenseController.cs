using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

public class ActivateRequest
{
    public string Serial { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class LicenseController : ControllerBase
{
    private readonly ILicenseService _license;
    private readonly ILicenseRegistryService _registry;
    private readonly IConfiguration _config;

    public LicenseController(
        ILicenseService license,
        ILicenseRegistryService registry,
        IConfiguration config)
    {
        _license = license;
        _registry = registry;
        _config = config;
    }

    /// <summary>وضعیت لایسنس (بدون نیاز به Login)</summary>
    /// <summary>وضعیت لایسنس</summary>
    [HttpGet("status")]
    [AllowAnonymous]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var status = _license.GetStatus();
        if (!status.IsValid)
        {
            return Ok(new
            {
                valid = false,
                error = status.ErrorMessage,
                authorizedOrgs = Array.Empty<long>()
            });
        }

        var isActivated = await _registry.IsRegisteredAsync(
            LicenseProductCodes.ArianaAPI_Web, ct);

        // ⭐ SystemId = myStrtoSerial(HDDSerial + SyntacticCode)
        // تو لایسنس، فیلد SystemId در واقع SyntacticCode هست
        var syntacticCode = status.Payload!.SystemId;
        var computedSystemId = SerialGenerator.ComputeSystemId(syntacticCode);

        return Ok(new
        {
            valid = true,
            customerName = status.Payload.CustomerName,
            customerId = status.Payload.CustomerId,
            licenseId = status.Payload.LicenseId,
            expiresAt = status.Payload.ExpiresAt,
            authorizedOrgs = status.Payload.AuthorizedOrgs,
            requiresActivation = !isActivated,
            systemId = !isActivated ? computedSystemId : null   // ⭐ محاسبه‌شده
        });
    }


    /// <summary>فعال‌سازی با سریال</summary>
    /// <summary>فعال‌سازی</summary>
    [HttpPost("activate")]
    [AllowAnonymous]
    public async Task<IActionResult> Activate(
       [FromBody] ActivateRequest request,
       CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Serial))
            return BadRequest(new { error = "سریال را وارد کنید" });

        var status = _license.GetStatus();
        if (!status.IsValid || status.Payload is null)
            return BadRequest(new { error = "لایسنس معتبر نیست" });

        // ⭐ محاسبه SystemId
        var syntacticCode = status.Payload.SystemId;
        var computedSystemId = SerialGenerator.ComputeSystemId(syntacticCode);

        // ⭐ محاسبه سریال مورد انتظار
        var expected = SerialGenerator.ComputeWebSerial(computedSystemId, "1");

        if (!string.Equals(expected.Trim(), request.Serial.Trim(),
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "سریال نامعتبر است" });
        }

        await _registry.RegisterAsync(
            LicenseProductCodes.ArianaAPI_Web,
            computedSystemId,           // ⭐ SystemId محاسبه‌شده
            request.Serial.Trim(),
            ct);

        return Ok(new
        {
            success = true,
            message = "برنامه با موفقیت ثبت شد"
        });
    }
}