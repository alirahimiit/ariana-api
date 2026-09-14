using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Config;
using Microsoft.Extensions.Options;

namespace ArianaAPI.Infrastructure.Services;

public class TenantDbNameProvider : ITenantDbNameProvider
{
    private readonly AppSettings _settings;

    public TenantDbNameProvider(IOptions<AppSettings> settings)
    {
        _settings = settings.Value;
    }

    public string Build(long orgId, long fyId)
        => $"{_settings.Database.Prefix}{orgId}_{fyId}";
}