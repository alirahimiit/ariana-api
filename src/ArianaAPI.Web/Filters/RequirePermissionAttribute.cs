using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ArianaAPI.Web.Filters;

/// <summary>
/// ⭐ گارد دسترسی — چک می‌کنه کاربر کدهای عملیاتی موردنیاز رو داره
/// کدها از جدول Other هستن (100..188)
/// 
/// استفاده:
///     [RequirePermission(101)]                    // فقط 101
///     [RequirePermission(101, 102)]               // 101 یا 102
///     [RequirePermission(101, 102, Mode = "all")] // 101 و 102
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class RequirePermissionAttribute : Attribute, IAsyncAuthorizationFilter
{
    public long[] Codes { get; }
    public string Mode { get; set; } = "any";

    public RequirePermissionAttribute(params long[] codes)
    {
        Codes = codes ?? Array.Empty<long>();
    }

    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // اگه کاربر لاگین نکرده → 401
        if (context.HttpContext.User?.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return Task.CompletedTask;
        }

        // اگه کدی نداریم → allow
        if (Codes.Length == 0)
            return Task.CompletedTask;

        // خوندن perm claims از JWT
        var perms = context.HttpContext.User
            .FindAll("perm")
            .Select(c => long.TryParse(c.Value, out var v) ? v : -1)
            .Where(v => v > 0)
            .ToHashSet();

        bool allowed = Mode.Equals("all", StringComparison.OrdinalIgnoreCase)
            ? Codes.All(c => perms.Contains(c))
            : Codes.Any(c => perms.Contains(c));

        if (!allowed)
        {
            context.Result = new ObjectResult(new
            {
                error = "شما برای این عمل سطح دسترسی لازم را ندارید",
                code = "PERMISSION_DENIED"
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }

        return Task.CompletedTask;
    }
}