using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LicenseController : ControllerBase
{
    private readonly ILicenseService _license;

    public LicenseController(ILicenseService license)
    {
        _license = license;
    }

    /// <summary>وضعیت لایسنس (بدون نیاز به Login — برای نمایش توی صفحه‌ی Login)</summary>
    [HttpGet("status")]
    [AllowAnonymous]
    public IActionResult Status()
    {
        var status = _license.GetStatus();

        if (!status.IsValid)
        {
            return Ok(new
            {
                isValid = false,
                errorMessage = status.ErrorMessage
            });
        }

        return Ok(new
        {
            isValid = true,
            customerName = status.Payload!.CustomerName,
            customerId = status.Payload.CustomerId,
            licenseId = status.Payload.LicenseId,
            expiresAt = status.Payload.ExpiresAt,
            authorizedOrgs = status.Payload.AuthorizedOrgs
        });
    }
}