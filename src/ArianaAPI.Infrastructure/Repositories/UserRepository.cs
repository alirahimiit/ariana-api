using ArianaAPI.Application.Interfaces;
using ArianaAPI.Domain.Entities;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository کاربران
/// نکته: کاربران در هر دیتابیس Tenant جداگانه ذخیره می‌شن
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

    public async Task<User?> AuthenticateAsync(
        long orgId,
        long fyId,
        string username,
        string password,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1
                UsersID, UserGroupCode, UserCode, Name, Password,
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
                    "کاربر {Username} در دیتابیس Org={OrgId}/FY={FyId} پیدا نشد",
                    username, orgId, fyId);
                return null;
            }

            // ⚠️ توجه: پسورد فعلاً plain text ذخیره می‌شه
            // در فاز امنیتی بعدی به BCrypt مهاجرت می‌کنیم
            if (user.Password != password)
            {
                _logger.LogWarning(
                    "پسورد نامعتبر برای کاربر {Username} در Org={OrgId}/FY={FyId}",
                    username, orgId, fyId);
                return null;
            }

            _logger.LogInformation(
                "کاربر {Username} با موفقیت احراز هویت شد در Org={OrgId}/FY={FyId}",
                username, orgId, fyId);

            return user;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "خطا در احراز هویت کاربر {Username} در Org={OrgId}/FY={FyId}",
                username, orgId, fyId);
            throw;
        }
    }

    public async Task<User?> GetByIdAsync(
        long orgId,
        long fyId,
        long userId,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1
                UsersID, UserGroupCode, UserCode, Name, Password,
                Code_Op, Time_OP, Date_Op
            FROM Users
            WHERE UsersID = @userId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<User>(
            new CommandDefinition(sql, new { userId }, cancellationToken: ct));
    }

    public async Task<bool> ChangePasswordAsync(
        long orgId, long fyId, long userId,
        string currentPassword, string newPassword,
        CancellationToken ct = default)
    {
        const string checkSql = @"
        SELECT TOP 1 Password 
        FROM Users 
        WHERE UsersID = @userId";

        const string updateSql = @"
        UPDATE Users 
        SET Password = @newPassword,
            Date_Op = @dateOp,
            Time_OP = @timeOp
        WHERE UsersID = @userId";

        try
        {
            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.OpenAsync(ct);

            var current = await conn.ExecuteScalarAsync<string>(
                new CommandDefinition(checkSql, new { userId }, cancellationToken: ct));

            if (current == null) return false;              // کاربر نیست
            if (current != currentPassword) return false;   // رمز فعلی اشتباهه

            await conn.ExecuteAsync(new CommandDefinition(updateSql, new
            {
                userId,
                newPassword,
                dateOp = DateTime.Now.ToString("yyyy/MM/dd"),
                timeOp = DateTime.Now.ToString("HH:mm:ss")
            }, cancellationToken: ct));

            _logger.LogInformation("رمز کاربر {UserId} تغییر کرد", userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در تغییر رمز کاربر {UserId}", userId);
            throw;
        }
    }
}