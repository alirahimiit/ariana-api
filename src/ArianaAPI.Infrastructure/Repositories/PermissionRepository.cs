using ArianaAPI.Application.DTOs.Permissions;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;
using System.Data;

namespace ArianaAPI.Infrastructure.Repositories;

public class PermissionRepository : IPermissionRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<PermissionRepository> _logger;

    public PermissionRepository(
        ITenantConnectionFactory factory,
        ILogger<PermissionRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════
    //  خواندن دسترسی‌های یک گروه
    // ═══════════════════════════════════════════════
    public async Task<UserPermissionsDto?> GetByUserGroupAsync(
        long orgId, long fyId, long userGroupCode, CancellationToken ct = default)
    {
        const string groupSql = @"
            SELECT TOP 1 UserGroupID, UserGroupCode, GroupName, Description, En_Vi
            FROM UserGroup
            WHERE UserGroupCode = @userGroupCode";

        const string permSql = @"
            SELECT PType, MenuName, PCode
            FROM Permision
            WHERE UserGroupCode = @userGroupCode";

        try
        {
            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.OpenAsync(ct);

            var grp = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(groupSql, new { userGroupCode }, cancellationToken: ct));

            if (grp is null) return null;

            var perms = (await conn.QueryAsync<dynamic>(
                new CommandDefinition(permSql, new { userGroupCode }, cancellationToken: ct)))
                .ToList();

            var dto = new UserPermissionsDto
            {
                UserGroupCode = (long)(grp.UserGroupCode ?? 0),
                GroupName = (string?)grp.GroupName,
                EnVi = (bool)(grp.En_Vi ?? false)
            };

            foreach (var p in perms)
            {
                int ptype = (int)(p.PType ?? 0);
                switch (ptype)
                {
                    case 0: // Menu
                        if (p.MenuName != null)
                            dto.Menus.Add((string)p.MenuName);
                        break;
                    case 1: // Sarfasl
                        if (p.PCode != null)
                            dto.Sarfasls.Add((long)p.PCode);
                        break;
                    case 2: // Sharh
                        if (p.PCode != null)
                            dto.Sharhs.Add((long)p.PCode);
                        break;
                    case 3: // Other
                        if (p.PCode != null)
                            dto.Operations.Add((long)p.PCode);
                        break;
                }
            }

            return dto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در خواندن دسترسی‌های گروه {Code}", userGroupCode);
            throw;
        }
    }

    // ═══════════════════════════════════════════════
    //  لیست گروه‌های کاربری
    // ═══════════════════════════════════════════════
    public async Task<List<UserGroupDto>> GetAllUserGroupsAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT UserGroupID, UserGroupCode, GroupName, Description, En_Vi
            FROM UserGroup
            ORDER BY UserGroupCode";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var rows = await conn.QueryAsync<UserGroupDto>(
            new CommandDefinition(sql, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<UserGroupDto?> GetUserGroupAsync(
        long orgId, long fyId, long userGroupCode, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1 UserGroupID, UserGroupCode, GroupName, Description, En_Vi
            FROM UserGroup
            WHERE UserGroupCode = @userGroupCode";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        return await conn.QueryFirstOrDefaultAsync<UserGroupDto>(
            new CommandDefinition(sql, new { userGroupCode }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════
    //  لیست عملیات‌ها (از جدول Other)
    // ═══════════════════════════════════════════════
    public async Task<List<OtherItemDto>> GetAllOperationsAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT Code, Description
            FROM Other
            WHERE Code IS NOT NULL
            ORDER BY Code";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var rows = await conn.QueryAsync<OtherItemDto>(
            new CommandDefinition(sql, cancellationToken: ct));
        return rows.ToList();
    }

    // ═══════════════════════════════════════════════
    //  ذخیره‌ی دسترسی‌های یک گروه (Delete + Insert)
    // ═══════════════════════════════════════════════
    public async Task SaveAsync(
        long orgId, long fyId, long userGroupCode,
        SavePermissionsDto dto, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ۱. حذف همه‌ی دسترسی‌های قبلی این گروه
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Permision WHERE UserGroupCode = @userGroupCode",
                new { userGroupCode }, transaction: tx, cancellationToken: ct));

            // ۲. درج منوها (PType=0)
            foreach (var menu in dto.Menus.Where(m => !string.IsNullOrWhiteSpace(m)))
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    @"INSERT INTO Permision (UserGroupCode, MenuName, PType, PCode)
                      VALUES (@userGroupCode, @menu, 0, NULL)",
                    new { userGroupCode, menu }, transaction: tx, cancellationToken: ct));
            }

            // ۳. درج سرفصل‌ها (PType=1)
            foreach (var code in dto.Sarfasls)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    @"INSERT INTO Permision (UserGroupCode, MenuName, PType, PCode)
                      VALUES (@userGroupCode, NULL, 1, @code)",
                    new { userGroupCode, code }, transaction: tx, cancellationToken: ct));
            }

            // ۴. درج شرح‌ها (PType=2)
            foreach (var code in dto.Sharhs)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    @"INSERT INTO Permision (UserGroupCode, MenuName, PType, PCode)
                      VALUES (@userGroupCode, NULL, 2, @code)",
                    new { userGroupCode, code }, transaction: tx, cancellationToken: ct));
            }

            // ۵. درج عملیات‌ها (PType=3)
            foreach (var code in dto.Operations)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    @"INSERT INTO Permision (UserGroupCode, MenuName, PType, PCode)
                      VALUES (@userGroupCode, NULL, 3, @code)",
                    new { userGroupCode, code }, transaction: tx, cancellationToken: ct));
            }

            tx.Commit();
            _logger.LogInformation(
                "دسترسی‌های گروه {Code} ذخیره شد (منو: {M}, عملیات: {O})",
                userGroupCode, dto.Menus.Count, dto.Operations.Count);
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════
    //  ذخیره گروه کاربری (Create / Update)
    // ═══════════════════════════════════════════════
    public async Task<long> SaveUserGroupAsync(
        long orgId, long fyId, UserGroupDto dto, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        if (dto.UserGroupCode == 0)
        {
            // ⭐ محاسبه‌ی کد جدید
            var nextCode = await conn.ExecuteScalarAsync<long?>(new CommandDefinition(
                "SELECT ISNULL(MAX(UserGroupCode), 0) + 1 FROM UserGroup",
                cancellationToken: ct)) ?? 1;

            const string insertSql = @"
                INSERT INTO UserGroup (UserGroupCode, GroupName, Description, En_Vi)
                VALUES (@nextCode, @groupName, @description, @enVi)";

            await conn.ExecuteAsync(new CommandDefinition(insertSql,
                new { nextCode, groupName = dto.GroupName, description = dto.Description, enVi = dto.EnVi },
                cancellationToken: ct));

            return nextCode;
        }
        else
        {
            const string updateSql = @"
                UPDATE UserGroup
                SET GroupName = @groupName,
                    Description = @description,
                    En_Vi = @enVi
                WHERE UserGroupCode = @userGroupCode";

            await conn.ExecuteAsync(new CommandDefinition(updateSql,
                new { dto.UserGroupCode, groupName = dto.GroupName, description = dto.Description, enVi = dto.EnVi },
                cancellationToken: ct));

            return dto.UserGroupCode;
        }
    }
}