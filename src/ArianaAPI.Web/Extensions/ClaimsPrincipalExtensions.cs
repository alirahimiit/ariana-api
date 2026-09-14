using System.Security.Claims;

namespace ArianaAPI.Web.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static long GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirst("userId")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;

        return long.TryParse(value, out var id)
            ? id
            : throw new UnauthorizedAccessException("userId در توکن یافت نشد");
    }

    public static long GetOrgId(this ClaimsPrincipal user)
    {
        var value = user.FindFirst("orgId")?.Value;
        return long.TryParse(value, out var id)
            ? id
            : throw new UnauthorizedAccessException("orgId در توکن یافت نشد");
    }

    public static long GetFyId(this ClaimsPrincipal user)
    {
        var value = user.FindFirst("fyId")?.Value;
        return long.TryParse(value, out var id)
            ? id
            : throw new UnauthorizedAccessException("fyId در توکن یافت نشد");
    }

    public static string GetUsername(this ClaimsPrincipal user)
        => user.Identity?.Name ?? string.Empty;
}