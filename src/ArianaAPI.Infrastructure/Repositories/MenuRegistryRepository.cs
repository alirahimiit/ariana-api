using ArianaAPI.Application.DTOs.Permissions;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class MenuRegistryRepository : IMenuRegistryRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<MenuRegistryRepository> _logger;

    public MenuRegistryRepository(
        ITenantConnectionFactory factory,
        ILogger<MenuRegistryRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<List<MenuRegistryItemDto>> GetActiveMenusAsync(
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                MenuKey, SubKey, Title, Category, ParentMenuKey,
                SortOrder, Icon, RequiresPermission, WindowsMenuName, ShowInWeb
            FROM MenuRegistry
            WHERE IsActive = 1
            ORDER BY SortOrder, MenuKey, SubKey";

        try
        {
            await using var conn = _factory.CreatePermanentConnection();
            await conn.OpenAsync(ct);

            var rows = await conn.QueryAsync<MenuRegistryItemDto>(
                new CommandDefinition(sql, cancellationToken: ct));

            return rows.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در خواندن MenuRegistry");
            throw;
        }
    }
}