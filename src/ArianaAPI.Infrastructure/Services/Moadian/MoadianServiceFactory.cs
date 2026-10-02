using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services.Moadian;

/// <summary>
/// Factory برای ساخت MoadianService با Options مشخص
/// (چون Options از DB لود می‌شه، نه از DI)
/// </summary>
public class MoadianServiceFactory
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILoggerFactory _loggerFactory;

    public MoadianServiceFactory(IHttpClientFactory httpFactory, ILoggerFactory loggerFactory)
    {
        _httpFactory = httpFactory;
        _loggerFactory = loggerFactory;
    }

    public IMoadianService Create(MoadianOptions options)
    {
        var http = _httpFactory.CreateClient("Moadian");
        var logger = _loggerFactory.CreateLogger<MoadianService>();
        return new MoadianService(http, options, logger);
    }
}