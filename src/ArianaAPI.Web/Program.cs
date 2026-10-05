using System.Text;
using System.Threading.RateLimiting;
using ArianaAPI.Infrastructure;
using ArianaAPI.Infrastructure.Config;
using ArianaAPI.Web.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Microsoft.Extensions.Hosting.WindowsServices;
using System.Globalization;




var persianCulture = new CultureInfo("fa-IR");
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;
var builder = WebApplication.CreateBuilder(args);
builder.Host.UseWindowsService();

// ═══ Infrastructure ═══
builder.Services.AddInfrastructure(builder.Configuration);

// ═══ Controllers ═══
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ═══════════════════════════════════════════════════
//  ⭐ RATE LIMITING — جلوگیری از brute-force
// ═══════════════════════════════════════════════════
builder.Services.AddRateLimiter(options =>
{
    // ═══ سیاست «login» ═══
    options.AddPolicy("login", httpContext =>
    {
        // ─── گرفتن IP کاربر ───
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        // اگه پشت Nginx هستی، X-Forwarded-For رو بخون
        if (httpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var forwarded))
        {
            var firstIp = forwarded.ToString().Split(',')[0].Trim();
            if (!string.IsNullOrEmpty(firstIp)) ip = firstIp;
        }

        // ─── خواندن تنظیمات از appsettings ───
        var cfg = httpContext.RequestServices
            .GetRequiredService<IConfiguration>()
            .GetSection("RateLimit:Login");

        var permitLimit = cfg.GetValue<int?>("PermitLimit") ?? 5;
        var windowMin = cfg.GetValue<int?>("WindowMinutes") ?? 5;
        var queueLimit = cfg.GetValue<int?>("QueueLimit") ?? 0;

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: "login:" + ip,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(windowMin),
                QueueLimit = queueLimit,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    });

    // ═══ پاسخ وقتی رد شد (429) ═══
    options.OnRejected = async (context, ct) =>
    {
        var http = context.HttpContext;
        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        http.Response.ContentType = "application/json; charset=utf-8";

        // هدر استاندارد Retry-After
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            http.Response.Headers["Retry-After"] =
                ((int)retryAfter.TotalSeconds).ToString();
        }

        await http.Response.WriteAsJsonAsync(new
        {
            error = "تعداد تلاش‌های شما بیش از حد مجاز است. لطفاً چند دقیقه بعد دوباره امتحان کنید.",
            code = "RATE_LIMITED",
            retryAfterSeconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var r)
                ? (int)r.TotalSeconds
                : 300
        }, cancellationToken: ct);
    };
});

// ═══ Swagger + JWT ═══
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "ArianaAPI", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header. فقط توکن رو بذار."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ═══ JWT Authentication ═══
var jwtSettings = builder.Configuration
    .GetSection(JwtSettings.SectionName)
    .Get<JwtSettings>()
    ?? throw new InvalidOperationException("بخش Jwt در appsettings.json پیدا نشد");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.Key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// ═══ Static Files (UI) ═══
app.UseDefaultFiles();
app.UseStaticFiles();

// ═══ Middleware Pipeline ═══
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<ApiKeyMiddleware>();
app.UseMiddleware<LicenseGuardMiddleware>();

// ⭐ Rate Limiter — بعد از LicenseGuard، قبل از Auth
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();