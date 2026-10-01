using ArianaAPI.Application.Interfaces;
using ArianaAPI.Domain.Entities;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository کاربران
/// 
/// ⭐ حالت Dual-Mode:
///   - Password (plaintext) → برای Delphi دست‌نخورده
///   - PasswordHash (BCrypt) → برای وب امن
///   - اگه hash نبود، از plaintext چک می‌کنه و hash می‌سازه (خودکار)
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

    // ═══════════════════════════════════════════════════
    //  احراز هویت — Dual Mode
    // ═══════════════════════════════════════════════════
    public async Task<User?> AuthenticateAsync(
        long orgId,
        long fyId,
        string username,
        string password,
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

            // ═══════════════════════════════════════════════
            //  ۱. اگه hash داره → اول BCrypt چک کن
            // ═══════════════════════════════════════════════
            if (!string.IsNullOrEmpty(user.PasswordHash))
            {
                try
                {
                    if (BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                    {
                        _logger.LogInformation(
                            "✅ ورود موفق (BCrypt) — کاربر {Username}",
                            username);
                        return user;
                    }
                    // hash داره ولی اشتباهه → ممکنه رمز در Delphi عوض شده باشه
                    // پس fallback به plaintext
                    _logger.LogDebug(
                        "BCrypt fail — fallback به plaintext برای {Username}",
                        username);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "PasswordHash فرمت اشتباه داره — fallback به plaintext");
                }
            }

            // ═══════════════════════════════════════════════
            //  ۲. Fallback: مقایسه plaintext
            // ═══════════════════════════════════════════════
            if (user.Password == password)
            {
                _logger.LogInformation(
                    "✅ ورود موفق (Plaintext) — کاربر {Username}",
                    username);

                // ⭐ اگه hash نداشت یا hash قدیمی بود → hash جدید بساز
                bool needNewHash = string.IsNullOrEmpty(user.PasswordHash);
                if (!needNewHash)
                {
                    // hash هست ولی BCrypt verify fail داد (چون رمز در Delphi عوض شده)
                    needNewHash = true;
                }

                if (needNewHash)
                {
                    // ⚠️ غیرهمزمان، خطا کاربر رو نشکنه
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await SavePasswordHashAsync(orgId, fyId, user.UsersID, password);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex,
                                "خطا در ساخت hash برای کاربر {UserId}",
                                user.UsersID);
                        }
                    }, ct);
                }

                return user;
            }

            // ═══════════════════════════════════════════════
            //  ۳. هر دو fail → خطا
            // ═══════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════
    //  ساخت/ذخیره hash (برای مهاجرت خودکار)
    // ═══════════════════════════════════════════════════
    private async Task SavePasswordHashAsync(
        long orgId, long fyId, long userId, string plainPassword)
    {
        // ⭐ BCrypt با workFactor پیش‌فرض (۱۱)
        var hash = BCrypt.Net.BCrypt.HashPassword(plainPassword);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync();

        await conn.ExecuteAsync(new CommandDefinition(@"
            UPDATE Users 
            SET PasswordHash = @hash
            WHERE UsersID = @userId",
            new { hash, userId }));

        _logger.LogInformation(
            "🔐 hash برای کاربر {UserId} ساخته و ذخیره شد",
            userId);
    }

    // ═══════════════════════════════════════════════════
    //  گرفتن کاربر با ID
    // ═══════════════════════════════════════════════════
    public async Task<User?> GetByIdAsync(
        long orgId,
        long fyId,
        long userId,
        CancellationToken ct = default)
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

    // ═══════════════════════════════════════════════════
    //  تغییر رمز — هم plaintext هم hash
    // ═══════════════════════════════════════════════════
    public async Task<bool> ChangePasswordAsync(
        long orgId, long fyId, long userId,
        string currentPassword, string newPassword,
        CancellationToken ct = default)
    {
        const string checkSql = @"
        SELECT TOP 1 Password, PasswordHash
        FROM Users 
        WHERE UsersID = @userId";

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

            // ═══ بررسی رمز فعلی ═══
            bool passwordOk = false;
            if (!string.IsNullOrEmpty(currentHash))
            {
                try
                {
                    passwordOk = BCrypt.Net.BCrypt.Verify(currentPassword, currentHash);
                }
                catch { /* invalid hash */ }
            }
            if (!passwordOk)
            {
                // fallback به plaintext
                passwordOk = currentPlain == currentPassword;
            }

            if (!passwordOk)
            {
                _logger.LogWarning(
                    "رمز فعلی اشتباه — کاربر {UserId}",
                    userId);
                return false;
            }

            // ═══ ذخیره‌ی رمز جدید (هم plaintext هم hash) ═══
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
                "🔐 رمز کاربر {UserId} تغییر کرد (plaintext + BCrypt)",
                userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "خطا در تغییر رمز کاربر {UserId}", userId);
            throw;
        }
    }
}