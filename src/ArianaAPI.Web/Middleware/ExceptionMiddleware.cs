namespace ArianaAPI.Web.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Path}", context.Request.Path);
            await HandleAsync(context, ex);
        }
    }

    private static async Task HandleAsync(HttpContext context, Exception ex)
    {
        var (statusCode, message) = ex switch
        {
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, ex.Message),
            KeyNotFoundException => (StatusCodes.Status404NotFound, ex.Message),
            ArgumentException => (StatusCodes.Status400BadRequest, ex.Message),
            InvalidOperationException => (StatusCodes.Status400BadRequest, ex.Message),
            NotImplementedException => (StatusCodes.Status501NotImplemented, ex.Message),
            _ => (StatusCodes.Status500InternalServerError, "خطای داخلی سرور")
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsJsonAsync(new
        {
            error = message,
            statusCode,
            timestamp = DateTime.UtcNow
        });
    }
}