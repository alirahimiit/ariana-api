using ArianaAPI.Application.DTOs.Permissions;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Domain.Entities;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository کاربران
///
/// ⭐ حالت Dual-Mode:
///   - Password (plaintext) → برای Delphi دست‌نخورده
///   - PasswordHash (BCrypt) → برای وب امن
/// </summary>
public class UserRepository : IUserRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<UserRepository> _logger;

    public UserRepository(
        ITenantConnectionFactory factory,
        ILogger<UserRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════════════
    //  احراز هویت — Dual Mode (دست نمی‌زنیم — جلسات قبلی)
    // ═══════════════════════════════════════════════════════════
    public async Task<User?> AuthenticateAsync(
        long orgId, long fyId, string username, string password,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1
                UsersID, UserGroupCode, UserCode, Name, Password, PasswordHash,
                Code_Op, Time_OP, Date_Op
            FROM Users
            WHERE UserCode = @username";

        try
        {
            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.OpenAsync(ct);

            var user = await conn.QueryFirstOrDefaultAsync<User>(
                new CommandDefinition(sql, new { username }, cancellationToken: ct));

            if (user is null)
            {
                _logger.LogWarning(
                    "کاربر {Username} پیدا نشد — Org={OrgId}/FY={FyId}",
                    username, orgId, fyId);
                return null;
            }

            if (!string.IsNullOrEmpty(user.PasswordHash))
            {
                try
                {
                    if (BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                    {
                        _logger.LogInformation(
                            "✅ ورود موفق (BCrypt) — کاربر {Username}", username);
                        return user;
                    }
                    _logger.LogDebug(
                        "BCrypt fail — fallback به plaintext برای {Username}", username);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "PasswordHash فرمت اشتباه دارد — fallback به plaintext");
                }
            }

            if (user.Password == password)
            {
                _logger.LogInformation(
                    "✅ ورود موفق (Plaintext) — کاربر {Username}", username);

                bool needNewHash = string.IsNullOrEmpty(user.PasswordHash)
                                   || !string.IsNullOrEmpty(user.PasswordHash);
                if (needNewHash)
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await SavePasswordHashAsync(orgId, fyId, user.UsersID, password);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex,
                                "خطا در ساخت hash برای کاربر {UserId}", user.UsersID);
                        }
                    }, ct);
                }
                return user;
            }

            _logger.LogWarning(
                "❌ پسورد نامعتبر برای {Username} — Org={OrgId}/FY={FyId}",
                username, orgId, fyId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "خطا در احراز هویت {Username} — Org={OrgId}/FY={FyId}",
                username, orgId, fyId);
            throw;
        }
    }

    private async Task SavePasswordHashAsync(
        long orgId, long fyId, long userId, string plainPassword)
    {
        var hash = BCrypt.Net.BCrypt.HashPassword(plainPassword);
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync();
        await conn.ExecuteAsync(new CommandDefinition(@"
            UPDATE Users SET PasswordHash = @hash WHERE UsersID = @userId",
            new { hash, userId }));
        _logger.LogInformation("🔐 hash برای کاربر {UserId} ذخیره شد", userId);
    }

    // ═══════════════════════════════════════════════════════════
    //  GetById (دست نمی‌زنیم — جلسات قبلی)
    // ═══════════════════════════════════════════════════════════
    public async Task<User?> GetByIdAsync(
        long orgId, long fyId, long userId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1
                UsersID, UserGroupCode, UserCode, Name, Password, PasswordHash,
                Code_Op, Time_OP, Date_Op
            FROM Users
            WHERE UsersID = @userId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<User>(
            new CommandDefinition(sql, new { userId }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════
    //  ChangePassword (دست نمی‌زنیم — جلسات قبلی)
    // ═══════════════════════════════════════════════════════════
    public async Task<bool> ChangePasswordAsync(
        long orgId, long fyId, long userId,
        string currentPassword, string newPassword,
        CancellationToken ct = default)
    {
        const string checkSql = @"
            SELECT TOP 1 Password, PasswordHash
            FROM Users WHERE UsersID = @userId";

        const string updateSql = @"
            UPDATE Users
            SET Password = @newPassword,
                PasswordHash = @newHash,
                Date_Op = @dateOp,
                Time_OP = @timeOp
            WHERE UsersID = @userId";

        try
        {
            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.OpenAsync(ct);

            var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(checkSql, new { userId }, cancellationToken: ct));

            if (current is null)
            {
                _logger.LogWarning("کاربر {UserId} پیدا نشد", userId);
                return false;
            }

            var cd = (IDictionary<string, object>)current;
            var currentPlain = cd["Password"]?.ToString() ?? "";
            var currentHash = cd["PasswordHash"]?.ToString();

            bool passwordOk = false;
            if (!string.IsNullOrEmpty(currentHash))
            {
                try { passwordOk = BCrypt.Net.BCrypt.Verify(currentPassword, currentHash); }
                catch { }
            }
            if (!passwordOk)
                passwordOk = currentPlain == currentPassword;

            if (!passwordOk)
            {
                _logger.LogWarning("رمز فعلی اشتباه — کاربر {UserId}", userId);
                return false;
            }

            var newHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
            await conn.ExecuteAsync(new CommandDefinition(updateSql, new
            {
                userId,
                newPassword,
                newHash,
                dateOp = DateTime.Now.ToString("yyyy/MM/dd"),
                timeOp = DateTime.Now.ToString("HH:mm:ss")
            }, cancellationToken: ct));

            _logger.LogInformation(
                "🔐 رمز کاربر {UserId} تغییر کرد (plaintext + BCrypt)", userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در تغییر رمز کاربر {UserId}", userId);
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  GetAllAsync — لیست کاربران با نام گروه
    // ═══════════════════════════════════════════════════════════
    public async Task<List<UserDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT
                u.UsersID              AS UsersId,
                u.UserGroupCode        AS UserGroupCode,
                u.UserCode             AS UserCode,
                u.Name                 AS Name,
                ug.GroupName           AS GroupName,
                CASE WHEN u.PasswordHash IS NOT NULL AND LEN(u.PasswordHash) > 0
                     THEN 1 ELSE 0 END AS HasPasswordHash,
                u.Date_Op              AS DateOp,
                u.Time_OP              AS TimeOp
            FROM Users u
            LEFT JOIN UserGroup ug ON ug.UserGroupCode = u.UserGroupCode
            ORDER BY u.UserCode";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var rows = await conn.QueryAsync<UserDto>(
            new CommandDefinition(sql, cancellationToken: ct));

        return rows.ToList();
    }

    // ═══════════════════════════════════════════════════════════
    //  GetByIdExtendedAsync
    // ═══════════════════════════════════════════════════════════
    public async Task<UserDto?> GetByIdExtendedAsync(
        long orgId, long fyId, long userId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT
                u.UsersID              AS UsersId,
                u.UserGroupCode        AS UserGroupCode,
                u.UserCode             AS UserCode,
                u.Name                 AS Name,
                ug.GroupName           AS GroupName,
                CASE WHEN u.PasswordHash IS NOT NULL AND LEN(u.PasswordHash) > 0
                     THEN 1 ELSE 0 END AS HasPasswordHash,
                u.Date_Op              AS DateOp,
                u.Time_OP              AS TimeOp
            FROM Users u
            LEFT JOIN UserGroup ug ON ug.UserGroupCode = u.UserGroupCode
            WHERE u.UsersID = @userId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        return await conn.QueryFirstOrDefaultAsync<UserDto>(
            new CommandDefinition(sql, new { userId }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════
    //  CreateAsync
    // ═══════════════════════════════════════════════════════════
    public async Task<long> CreateAsync(
        long orgId, long fyId, CreateUserDto dto, CancellationToken ct = default)
    {
        const string sql = @"
            INSERT INTO Users
                (UserCode, Name, Password, PasswordHash, UserGroupCode, Date_Op, Time_OP)
            OUTPUT INSERTED.UsersID
            VALUES
                (@userCode, @name, @password, @passwordHash, @groupCode, @dateOp, @timeOp)";

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        var dateOp = DateTime.Now.ToString("yyyy/MM/dd");
        var timeOp = DateTime.Now.ToString("HH:mm:ss");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var newId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(sql, new
        {
            userCode = dto.UserCode.Trim(),
            name = dto.Name.Trim(),
            password = dto.Password,
            passwordHash,
            groupCode = dto.UserGroupCode,
            dateOp,
            timeOp
        }, cancellationToken: ct));

        _logger.LogInformation(
            "✅ کاربر جدید ایجاد شد — ID={Id}, Code={Code}, Group={Group}",
            newId, dto.UserCode, dto.UserGroupCode);

        return newId;
    }

    // ═══════════════════════════════════════════════════════════
    //  UpdateAsync
    // ═══════════════════════════════════════════════════════════
    public async Task<bool> UpdateAsync(
        long orgId, long fyId, long userId,
        UpdateUserDto dto, CancellationToken ct = default)
    {
        const string sql = @"
            UPDATE Users
            SET UserCode = @userCode,
                Name = @name,
                UserGroupCode = @groupCode,
                Date_Op = @dateOp,
                Time_OP = @timeOp
            WHERE UsersID = @userId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var affected = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            userId,
            userCode = dto.UserCode.Trim(),
            name = dto.Name.Trim(),
            groupCode = dto.UserGroupCode,
            dateOp = DateTime.Now.ToString("yyyy/MM/dd"),
            timeOp = DateTime.Now.ToString("HH:mm:ss")
        }, cancellationToken: ct));

        if (affected == 0)
        {
            _logger.LogWarning("کاربر {UserId} برای ویرایش یافت نشد", userId);
            return false;
        }

        _logger.LogInformation("✅ کاربر {UserId} ویرایش شد", userId);
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    //  DeleteAsync
    // ═══════════════════════════════════════════════════════════
    public async Task<bool> DeleteAsync(
        long orgId, long fyId, long userId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Users WHERE UsersID = @userId",
            new { userId }, cancellationToken: ct));

        if (affected == 0)
        {
            _logger.LogWarning("کاربر {UserId} برای حذف یافت نشد", userId);
            return false;
        }

        _logger.LogInformation("🗑️ کاربر {UserId} حذف شد", userId);
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    //  ResetPasswordAsync — ادمین رمز را عوض می‌کند
    // ═══════════════════════════════════════════════════════════
    public async Task<bool> ResetPasswordAsync(
        long orgId, long fyId, long userId,
        string newPassword, CancellationToken ct = default)
    {
        const string sql = @"
            UPDATE Users
            SET Password = @newPassword,
                PasswordHash = @newHash,
                Date_Op = @dateOp,
                Time_OP = @timeOp
            WHERE UsersID = @userId";

        var newHash = BCrypt.Net.BCrypt.HashPassword(newPassword);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var affected = await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            userId,
            newPassword,
            newHash,
            dateOp = DateTime.Now.ToString("yyyy/MM/dd"),
            timeOp = DateTime.Now.ToString("HH:mm:ss")
        }, cancellationToken: ct));

        if (affected == 0)
        {
            _logger.LogWarning("کاربر {UserId} برای بازنشانی رمز یافت نشد", userId);
            return false;
        }

        _logger.LogInformation("🔐 رمز کاربر {UserId} توسط ادمین بازنشانی شد", userId);
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    //  ExistsUserCodeAsync
    // ═══════════════════════════════════════════════════════════
    public async Task<bool> ExistsUserCodeAsync(
        long orgId, long fyId, string userCode,
        long? excludeUserId, CancellationToken ct = default)
    {
        const string sqlWithExclude = @"
            SELECT TOP 1 1 FROM Users 
            WHERE UserCode = @userCode AND UsersID <> @excludeUserId";

        const string sqlNoExclude = @"
            SELECT TOP 1 1 FROM Users 
            WHERE UserCode = @userCode";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var sql = excludeUserId.HasValue ? sqlWithExclude : sqlNoExclude;

        var result = await conn.QueryFirstOrDefaultAsync<int?>(new CommandDefinition(
            sql,
            new { userCode = userCode.Trim(), excludeUserId = excludeUserId ?? 0 },
            cancellationToken: ct));

        return result.HasValue;
    }
}