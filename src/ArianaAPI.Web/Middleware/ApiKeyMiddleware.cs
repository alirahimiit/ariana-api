using ArianaAPI.Infrastructure.Config;
using Microsoft.Extensions.Options;

namespace ArianaAPI.Web.Middleware;

public class ApiKeyMiddleware
{
    private const string HeaderName = "X-Api-Key";
    private readonly RequestDelegate _next;
    private readonly ApiKeySettings _settings;
    private readonly ILogger<ApiKeyMiddleware> _logger;

    public ApiKeyMiddleware(
        RequestDelegate next,
        IOptions<ApiKeySettings> settings,
        ILogger<ApiKeyMiddleware> logger)
    {
        _next = next;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

        // مسیرهای exempt
        if (path.StartsWith("/swagger") ||
            path.StartsWith("/health") ||
            path.StartsWith("/api/auth/login") ||
            path.StartsWith("/api/auth/refresh") ||
            path.StartsWith("/api/license") ||
            path.StartsWith("/api/lookup") ||
            path.StartsWith("/css") ||
            path.StartsWith("/js") ||
            path.StartsWith("/assets") ||
            path == "/" ||
            path.EndsWith(".html") ||
            path.EndsWith(".css") ||
            path.EndsWith(".js") ||
            path.EndsWith(".ico") ||
            path.EndsWith(".png") ||
            path.EndsWith(".svg"))
        {
            await _next(context);
            return;
        }

        if (string.IsNullOrWhiteSpace(_settings.Key))
        {
            _logger.LogWarning("ApiKey تعریف نشده — middleware غیرفعال");
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue(HeaderName, out var providedKey))
        {
            await WriteUnauthorized(context, "API Key ارسال نشده");
            return;
        }

        if (!string.Equals(providedKey.ToString(), _settings.Key, StringComparison.Ordinal))
        {
            await WriteUnauthorized(context, "API Key نامعتبر");
            return;
        }

        await _next(context);
    }

    private static async Task WriteUnauthorized(HttpContext ctx, string message)
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new { error = message, statusCode = 401 });
    }
}