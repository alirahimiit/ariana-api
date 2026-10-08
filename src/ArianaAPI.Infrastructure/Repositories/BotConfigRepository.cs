using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Domain.Entities.Messaging;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories
{
    public class BotConfigRepository : IBotConfigRepository
    {
        private readonly ITenantConnectionFactory _factory;

        public BotConfigRepository(ITenantConnectionFactory factory)
        {
            _factory = factory;
        }

        public async Task<List<BotConfig>> GetActiveConfigsAsync(CancellationToken ct = default)
        {
            const string sql = @"
                SELECT 
                    id              AS Id,
                    platform_type   AS PlatformType,
                    bot_token       AS BotToken,
                    bot_name        AS BotName,
                    target_org_id   AS TargetOrgId,
                    target_fy_id    AS TargetFyId,
                    is_active       AS IsActive,
                    created_at      AS CreatedAt,
                    updated_at      AS UpdatedAt
                FROM messaging_bot_config
                WHERE is_active = 1";

            await using var conn = _factory.CreatePermanentConnection();
            var list = await conn.QueryAsync<BotConfig>(
                new CommandDefinition(sql, cancellationToken: ct));
            return list.ToList();
        }

        public async Task<BotConfig?> GetByTenantAsync(
            byte platformType, long orgId, long fyId, CancellationToken ct = default)
        {
            const string sql = @"
                SELECT TOP 1
                    id              AS Id,
                    platform_type   AS PlatformType,
                    bot_token       AS BotToken,
                    bot_name        AS BotName,
                    target_org_id   AS TargetOrgId,
                    target_fy_id    AS TargetFyId,
                    is_active       AS IsActive,
                    created_at      AS CreatedAt,
                    updated_at      AS UpdatedAt
                FROM messaging_bot_config
                WHERE platform_type = @platformType
                  AND target_org_id = @orgId
                  AND target_fy_id = @fyId
                  AND is_active = 1";

            await using var conn = _factory.CreatePermanentConnection();
            return await conn.QueryFirstOrDefaultAsync<BotConfig>(
                new CommandDefinition(sql, new { platformType, orgId, fyId }, cancellationToken: ct));
        }

        public async Task<List<BotConfig>> GetAllConfigsAsync(CancellationToken ct = default)
        {
            const string sql = @"
                SELECT 
                    id              AS Id,
                    platform_type   AS PlatformType,
                    bot_token       AS BotToken,
                    bot_name        AS BotName,
                    target_org_id   AS TargetOrgId,
                    target_fy_id    AS TargetFyId,
                    is_active       AS IsActive,
                    created_at      AS CreatedAt,
                    updated_at      AS UpdatedAt
                FROM messaging_bot_config
                ORDER BY id DESC";

            await using var conn = _factory.CreatePermanentConnection();
            var list = await conn.QueryAsync<BotConfig>(
                new CommandDefinition(sql, cancellationToken: ct));
            return list.ToList();
        }

        public async Task<int> UpsertAsync(BotConfig config, CancellationToken ct = default)
        {
            const string sql = @"
                IF @Id > 0 AND EXISTS (SELECT 1 FROM messaging_bot_config WHERE id = @Id)
                BEGIN
                    UPDATE messaging_bot_config SET
                        platform_type = @PlatformType,
                        bot_token     = @BotToken,
                        bot_name      = @BotName,
                        target_org_id = @TargetOrgId,
                        target_fy_id  = @TargetFyId,
                        is_active     = @IsActive,
                        updated_at    = GETDATE()
                    WHERE id = @Id;
                    SELECT @Id;
                END
                ELSE
                BEGIN
                    INSERT INTO messaging_bot_config
                        (platform_type, bot_token, bot_name, target_org_id, target_fy_id, is_active)
                    VALUES
                        (@PlatformType, @BotToken, @BotName, @TargetOrgId, @TargetFyId, @IsActive);
                    SELECT CAST(SCOPE_IDENTITY() AS INT);
                END";

            await using var conn = _factory.CreatePermanentConnection();
            return await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(sql, config, cancellationToken: ct));
        }

        public async Task SetActiveAsync(int id, bool isActive, CancellationToken ct = default)
        {
            const string sql = @"
                UPDATE messaging_bot_config 
                SET is_active = @isActive, updated_at = GETDATE()
                WHERE id = @id";

            await using var conn = _factory.CreatePermanentConnection();
            await conn.ExecuteAsync(new CommandDefinition(sql,
                new { id, isActive }, cancellationToken: ct));
        }

        public async Task DeleteAsync(int id, CancellationToken ct = default)
        {
            const string sql = "DELETE FROM messaging_bot_config WHERE id = @id";
            await using var conn = _factory.CreatePermanentConnection();
            await conn.ExecuteAsync(new CommandDefinition(sql, new { id }, cancellationToken: ct));
        }
    }
}