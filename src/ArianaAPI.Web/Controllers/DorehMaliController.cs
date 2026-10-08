using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;   // ⭐ برای ILicenseService
using ArianaAPI.Web.Extensions;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/doreh-mali")]
[Authorize]
public class DorehMaliController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<DorehMaliController> _logger;
    private readonly ILicenseService _license;   // ⭐ جدید

    public DorehMaliController(
        IConfiguration config,
        ILogger<DorehMaliController> logger,
        ILicenseService license)
    {
        _config = config;
        _logger = logger;
        _license = license;
    }

    /// <summary>
    /// لیست دوره‌های مالی سازمان‌های مجاز (بر اساس لایسنس)
    /// </summary>
    [HttpGet("list")]
    public async Task<IActionResult> List(
        [FromQuery] long? orgId,
        CancellationToken ct)
    {
        // ─── ۱. چک لایسنس ───
        var status = _license.GetStatus();
        if (!status.IsValid)
        {
            return StatusCode(403, new
            {
                error = status.ErrorMessage ?? "لایسنس معتبر نیست"
            });
        }

        var authorizedOrgs = _license.GetAuthorizedOrgs();

        if (authorizedOrgs.Length == 0)
        {
            _logger.LogWarning("⚠️ هیچ سازمان مجازی در لایسنس تعریف نشده");
            return StatusCode(403, new
            {
                error = "هیچ سازمانی در لایسنس شما تعریف نشده است"
            });
        }

        // ─── ۲. اگه orgId مشخص شده، فقط همون رو برگردون ───
        long[] targetOrgs;
        if (orgId.HasValue)
        {
            if (!authorizedOrgs.Contains(orgId.Value))
            {
                _logger.LogWarning(
                    "❌ تلاش برای دسترسی به سازمان غیرمجاز: {OrgId}", orgId.Value);
                return StatusCode(403, new
                {
                    error = "این سازمان در لایسنس شما وجود ندارد"
                });
            }
            targetOrgs = new[] { orgId.Value };
        }
        else
        {
            // همه سازمان‌های مجاز
            targetOrgs = authorizedOrgs;
        }

        // ─── ۳. کوئری ───
        try
        {
            var connStr = BuildPermanentConnectionString();
            await using var conn = new SqlConnection(connStr);
            await conn.OpenAsync(ct);

            const string sql = @"
                SELECT 
                    DorehMaliID,
                    ISNULL(SazmanCode, 0) AS OrgID,
                    Name,
                    BeginDate,
                    EndDate,
                    CAST(1 AS BIT) AS IsActive
                FROM DorehMali
                WHERE ISNULL(SazmanCode, 0) IN @orgs
                ORDER BY SazmanCode, DorehMaliID DESC";

            var list = (await conn.QueryAsync<DorehMaliListDto>(
                new CommandDefinition(sql,
                    new { orgs = targetOrgs },
                    cancellationToken: ct))).ToList();

            _logger.LogInformation(
                "✅ DorehMali: {Count} دوره برای سازمان‌های [{Orgs}] برگردانده شد",
                list.Count, string.Join(",", targetOrgs));

            return Ok(list);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در بارگذاری لیست دوره‌های مالی");
            return StatusCode(500, new
            {
                error = "خطا در بارگذاری دوره‌های مالی: " + ex.Message
            });
        }
    }

    /// <summary>ساخت connection string از بخش Database در appsettings</summary>
    private string BuildPermanentConnectionString()
    {
        var db = _config.GetSection("Database");

        var server = db["Server"] ?? "localhost";
        var database = db["DatabaseName"] ?? "Permanent";
        var integratedSecurity = bool.TryParse(db["IntegratedSecurity"], out var isInt) && isInt;
        var userId = db["UserId"] ?? "";
        var password = db["Password"] ?? "";
        var trustCert = bool.TryParse(db["TrustServerCertificate"], out var tc) && tc;
        var timeout = int.TryParse(db["ConnectionTimeoutSeconds"], out var t) ? t : 15;

        var builder = new SqlConnectionStringBuilder
        {
            DataSource = server,
            InitialCatalog = database,
            ConnectTimeout = timeout,
            TrustServerCertificate = trustCert
        };

        if (integratedSecurity)
        {
            builder.IntegratedSecurity = true;
        }
        else
        {
            builder.UserID = userId;
            builder.Password = password;
        }

        return builder.ConnectionString;
    }
}