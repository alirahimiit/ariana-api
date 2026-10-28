using ArianaAPI.Application.DTOs.Permissions;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

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
                    case 0:
                        if (p.MenuName != null) dto.Menus.Add((string)p.MenuName);
                        break;
                    case 1:
                        if (p.PCode != null) dto.Sarfasls.Add((long)p.PCode);
                        break;
                    case 2:
                        if (p.PCode != null) dto.Sharhs.Add((long)p.PCode);
                        break;
                    case 3:
                        if (p.PCode != null) dto.Operations.Add((long)p.PCode);
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
    //  لیست گروه‌های کاربری — با UserCount (جلسه ۶۱)
    // ═══════════════════════════════════════════════
    public async Task<List<UserGroupDto>> GetAllUserGroupsAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT
                ug.UserGroupID,
                ug.UserGroupCode,
                ug.GroupName,
                ug.Description,
                ug.En_Vi,
                ISNULL(c.Cnt, 0) AS UserCount
            FROM UserGroup ug
            LEFT JOIN (
                SELECT UserGroupCode, COUNT(*) AS Cnt
                FROM Users
                GROUP BY UserGroupCode
            ) c ON c.UserGroupCode = ug.UserGroupCode
            ORDER BY ug.UserGroupCode";

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
    //  ذخیره‌ی دسترسی‌های یک گروه (Delete + Insert — تراکنشی)
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
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Permision WHERE UserGroupCode = @userGroupCode",
                new { userGroupCode }, transaction: tx, cancellationToken: ct));

            foreach (var menu in dto.Menus.Where(m => !string.IsNullOrWhiteSpace(m)))
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    @"INSERT INTO Permision (UserGroupCode, MenuName, PType, PCode)
                      VALUES (@userGroupCode, @menu, 0, NULL)",
                    new { userGroupCode, menu }, transaction: tx, cancellationToken: ct));
            }

            foreach (var code in dto.Sarfasls)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    @"INSERT INTO Permision (UserGroupCode, MenuName, PType, PCode)
                      VALUES (@userGroupCode, NULL, 1, @code)",
                    new { userGroupCode, code }, transaction: tx, cancellationToken: ct));
            }

            foreach (var code in dto.Sharhs)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    @"INSERT INTO Permision (UserGroupCode, MenuName, PType, PCode)
                      VALUES (@userGroupCode, NULL, 2, @code)",
                    new { userGroupCode, code }, transaction: tx, cancellationToken: ct));
            }

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
    //  ذخیره گروه کاربری (Create / Update) + همگام‌سازی (جلسه ۶۱)
    // ═══════════════════════════════════════════════
    public async Task<long> SaveUserGroupAsync(
        long orgId, long fyId, UserGroupDto dto, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        if (dto.UserGroupCode == 0)
        {
            // ─── INSERT + sync UserGroupCode = UserGroupID ───
            var nextCode = await conn.ExecuteScalarAsync<long?>(new CommandDefinition(
                "SELECT ISNULL(MAX(UserGroupCode), 0) + 1 FROM UserGroup",
                cancellationToken: ct)) ?? 1;

            const string insertSql = @"
                INSERT INTO UserGroup (UserGroupCode, GroupName, Description, En_Vi)
                OUTPUT INSERTED.UserGroupID
                VALUES (@nextCode, @groupName, @description, @enVi)";

            var newId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
                insertSql,
                new
                {
                    nextCode,
                    groupName = dto.GroupName,
                    description = dto.Description,
                    enVi = dto.EnVi
                },
                cancellationToken: ct));

            // ⭐ همگام‌سازی مثل MangeUserCode دلفی
            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE UserGroup SET UserGroupCode = UserGroupID WHERE UserGroupID = @newId",
                new { newId }, cancellationToken: ct));

            _logger.LogInformation(
                "گروه جدید ایجاد شد — ID={Id}, Code={Code}, Name={Name}",
                newId, newId, dto.GroupName);

            // بعد از sync، UserGroupCode برابر با newId است
            return newId;
        }
        else
        {
            // ─── UPDATE ───
            const string updateSql = @"
                UPDATE UserGroup
                SET GroupName = @groupName,
                    Description = @description,
                    En_Vi = @enVi
                WHERE UserGroupCode = @userGroupCode";

            await conn.ExecuteAsync(new CommandDefinition(updateSql, new
            {
                dto.UserGroupCode,
                groupName = dto.GroupName,
                description = dto.Description,
                enVi = dto.EnVi
            }, cancellationToken: ct));

            return dto.UserGroupCode;
        }
    }

    // ═══════════════════════════════════════════════
    //  حذف گروه با cascade (جلسه ۶۱ — مطابق دلفی)
    // ═══════════════════════════════════════════════
    public async Task<bool> DeleteUserGroupAsync(
        long orgId, long fyId, long userGroupCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        using var tx = conn.BeginTransaction();

        try
        {
            // ۱) چک وجود گروه
            var exists = await conn.ExecuteScalarAsync<long?>(new CommandDefinition(
                "SELECT TOP 1 UserGroupID FROM UserGroup WHERE UserGroupCode = @userGroupCode",
                new { userGroupCode }, transaction: tx, cancellationToken: ct));

            if (!exists.HasValue)
            {
                tx.Rollback();
                return false;
            }

            // ۲) حذف همه کاربران گروه
            var deletedUsers = await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Users WHERE UserGroupCode = @userGroupCode",
                new { userGroupCode }, transaction: tx, cancellationToken: ct));

            // ۳) حذف همه Permisionهای گروه
            var deletedPerms = await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Permision WHERE UserGroupCode = @userGroupCode",
                new { userGroupCode }, transaction: tx, cancellationToken: ct));

            // ۴) حذف خود گروه
            var deletedGroup = await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM UserGroup WHERE UserGroupCode = @userGroupCode",
                new { userGroupCode }, transaction: tx, cancellationToken: ct));

            tx.Commit();

            _logger.LogInformation(
                "🗑️ گروه {Code} حذف شد — کاربران: {U}, پرمیشن‌ها: {P}",
                userGroupCode, deletedUsers, deletedPerms);

            return deletedGroup > 0;
        }
        catch (Exception ex)
        {
            try { tx.Rollback(); } catch { }
            _logger.LogError(ex, "خطا در حذف گروه {Code}", userGroupCode);
            throw;
        }
    }
}