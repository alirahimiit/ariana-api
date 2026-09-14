using ArianaAPI.Application.Interfaces;
using ArianaAPI.Application.Services;
using ArianaAPI.Infrastructure.Config;
using ArianaAPI.Infrastructure.Data;
using ArianaAPI.Infrastructure.Repositories;
using ArianaAPI.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArianaAPI.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ═══ تنظیمات ═══
        services.Configure<AppSettings>(configuration);
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.Configure<ApiKeySettings>(configuration.GetSection(ApiKeySettings.SectionName));

        // ═══ Data Layer ═══
        services.AddSingleton<ITenantConnectionFactory, TenantConnectionFactory>();

        // ═══ Services ═══
        services.AddSingleton<ITokenService, TokenService>();
        services.AddSingleton<IRefreshTokenStore, InMemoryRefreshTokenStore>();
        services.AddScoped<IAuthService, AuthService>();

        // ═══ Repositories ═══
        services.AddScoped<IOrganizationRepository, SazmanRepository>();
        services.AddScoped<IFiscalYearRepository, DorehMaliRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ISanadRepository, SanadRepository>();
        services.AddScoped<IHesabRepository, HesabRepository>();
        services.AddScoped<ISharhRepository, SharhRepository>();
        services.AddScoped<IKindSanadRepository, KindSanadRepository>();

        services.AddScoped<ILookupRepository, LookupRepository>();
        services.AddSingleton<ITenantDbNameProvider, TenantDbNameProvider>();
        return services;
    }
}