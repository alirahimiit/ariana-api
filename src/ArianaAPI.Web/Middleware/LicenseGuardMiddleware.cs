using ArianaAPI.Application.Interfaces;
using Microsoft.AspNetCore.Http;



namespace ArianaAPI.Web.Middleware;

public class LicenseGuardMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<LicenseGuardMiddleware> _logger;

    // مسیرهایی که همیشه آزادن (حتی با لایسنس invalid)
    private static readonly string[] _exemptPrefixes =
    {
        "/api/license",     // status + activate
        "/api/auth/login",  // ← اگه بلاک شه، کاربر پیام نمی‌بینه
        "/api/lookup",      // برای dropdown سازمان/دوره در لاگین
        "/css", "/js", "/assets", "/fonts", "/lib",
        "/swagger", "/favicon"
    };

    private static readonly string[] _staticExtensions =
    {
        ".html", ".ico", ".svg", ".css", ".js", ".woff", ".woff2", ".png", ".jpg"
    };

    public LicenseGuardMiddleware(RequestDelegate next, ILogger<LicenseGuardMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ILicenseService license)
    {
        var path = context.Request.Path.Value ?? "/";

        if (IsExempt(path))
        {
            await _next(context);
            return;
        }

        var status = license.GetStatus();
        if (!status.IsValid)
        {
            _logger.LogWarning(
                "🚫 Blocked {Method} {Path} — License invalid: {Reason}",
                context.Request.Method, path, status.ErrorMessage);

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "لایسنس نامعتبر است",
                reason = status.ErrorMessage,
                code = "LICENSE_INVALID"
            });
            return;
        }

        await _next(context);
    }

    private static bool IsExempt(string path)
    {
        if (string.IsNullOrEmpty(path)) return true;

        foreach (var prefix in _exemptPrefixes)
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;

        var ext = Path.GetExtension(path);
        if (!string.IsNullOrEmpty(ext) &&
            _staticExtensions.Contains(ext, StringComparer.OrdinalIgnoreCase))
            return true;

        return false;
    }
}