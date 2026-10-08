using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.Data.Sqlite;
using MailKit.Net.Smtp;
using MimeKit;

var builder = WebApplication.CreateBuilder(args);

var dbPath = builder.Configuration["Relay:DatabasePath"] ?? "relay.db";
var adminPassword = builder.Configuration["Relay:AdminPassword"] ?? "";
const string cookieName = "ariana_admin";

// ═══ Email ═══
var emailEnabled = builder.Configuration.GetValue<bool?>("Email:Enabled") ?? false;
var smtpHost = builder.Configuration["Email:SmtpHost"] ?? "";
var smtpPort = builder.Configuration.GetValue<int?>("Email:SmtpPort") ?? 587;
var smtpUseSsl = builder.Configuration.GetValue<bool?>("Email:UseSsl") ?? true;
var smtpUser = builder.Configuration["Email:SmtpUser"] ?? "";
var smtpPass = builder.Configuration["Email:SmtpPass"] ?? "";
var emailFrom = builder.Configuration["Email:From"] ?? "";
var emailTo = builder.Configuration["Email:To"] ?? "";

var dbDir = Path.GetDirectoryName(dbPath);
if (!string.IsNullOrEmpty(dbDir) && !Directory.Exists(dbDir))
    Directory.CreateDirectory(dbDir);

// ═══ ساخت جداول ═══
await using (var conn = new SqliteConnection($"Data Source={dbPath}"))
{
    await conn.OpenAsync();
    var cmd = conn.CreateCommand();
    cmd.CommandText = @"
        CREATE TABLE IF NOT EXISTS support_install (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_id TEXT NOT NULL UNIQUE,
            customer_id TEXT,
            customer_name TEXT,
            system_id TEXT,
            last_seen TEXT
        );

        CREATE TABLE IF NOT EXISTS support_message (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            install_id INTEGER NOT NULL,
            session_id TEXT,
            user_id INTEGER,
            user_name TEXT,
            direction INTEGER NOT NULL,
            message_text TEXT,
            created_at TEXT NOT NULL,
            admin_read INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS ix_msg_install ON support_message (install_id, session_id, id);
        CREATE INDEX IF NOT EXISTS ix_msg_admin_read ON support_message (admin_read);
    ";
    await cmd.ExecuteNonQueryAsync();
}

var db = new RelayDb(dbPath);
var email = new EmailSender(emailEnabled, smtpHost, smtpPort, smtpUseSsl,
    smtpUser, smtpPass, emailFrom, emailTo);

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/", () => Results.Redirect("/support/login.html"));
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

// ═══ Middleware ═══
app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path.Value ?? "";

    var isAdminHtml = path.StartsWith("/support/") &&
                      !path.EndsWith("login.html") &&
                      !path.EndsWith("style.css") &&
                      !path.EndsWith("app.js");
    var isAdminApi = path.StartsWith("/api/admin/") && path != "/api/admin/login";

    if (isAdminHtml || isAdminApi)
    {
        var expectedHash = HashHelper.ComputeHash(adminPassword);
        if (!ctx.Request.Cookies.TryGetValue(cookieName, out var val) || val != expectedHash)
        {
            if (isAdminApi)
            {
                ctx.Response.StatusCode = 401;
                await ctx.Response.WriteAsJsonAsync(new { message = "وارد نشده‌اید" });
                return;
            }
            ctx.Response.Redirect("/support/login.html");
            return;
        }
    }
    await next();
});

// ═══════════════════════════════════════════════════════════
//  ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════

app.MapPost("/api/admin/login", (LoginRequest req, HttpContext ctx) =>
{
    if (req.Password != adminPassword)
        return Results.BadRequest(new { message = "رمز اشتباه است" });

    ctx.Response.Cookies.Append(cookieName, HashHelper.ComputeHash(adminPassword), new CookieOptions
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Lax,
        Expires = DateTimeOffset.UtcNow.AddDays(30)
    });
    return Results.Ok(new { message = "ورود موفق" });
});

app.MapPost("/api/admin/logout", (HttpContext ctx) =>
{
    ctx.Response.Cookies.Delete(cookieName);
    return Results.Ok();
});

app.MapGet("/api/admin/tickets", async () =>
    Results.Ok(new { items = await db.GetTicketsAsync() }));

app.MapGet("/api/admin/tickets/{installId}/{sessionId}/messages", async (
    int installId, string sessionId) =>
{
    var items = await db.GetMessagesAsync(installId, sessionId, 0);
    return Results.Ok(new { items });
});

app.MapPost("/api/admin/tickets/{installId}/{sessionId}/reply", async (
    int installId, string sessionId, ReplyRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.Message))
        return Results.BadRequest(new { message = "متن پیام خالی است" });

    await db.SaveMessageAsync(installId, sessionId, null, "پشتیبان",
        direction: 2, req.Message, adminRead: 1);
    await db.MarkTicketReadAsync(installId, sessionId);
    return Results.Ok(new { message = "پاسخ ارسال شد" });
});

app.MapPost("/api/admin/tickets/{installId}/{sessionId}/read", async (
    int installId, string sessionId) =>
{
    await db.MarkTicketReadAsync(installId, sessionId);
    return Results.Ok();
});

app.MapGet("/api/admin/unread-count", async () =>
    Results.Ok(new { count = await db.GetAdminUnreadCountAsync() }));

// ═══════════════════════════════════════════════════════════
//  CUSTOMER ENDPOINTS (با لایسنس)
// ═══════════════════════════════════════════════════════════

app.MapPost("/api/support/send", async (SupportSendRequest req) =>
{
    var devMode = builder.Configuration.GetValue<bool?>("Relay:DevMode") ?? false;
    LicensePayload? payload = null;

    if (devMode)
    {
        payload = new LicensePayload
        {
            Version = 1,
            LicenseId = "LIC-DEV-TEST",
            CustomerId = "CUST-DEV",
            CustomerName = "مشتری تست (DEV)",
            IssuedAt = "1404/01/01",
            ExpiresAt = "1405/12/29",
            SystemId = "DEV-0000-0000",
            AuthorizedOrgs = new long[] { 1 },
            Features = new[] { "web", "api" }
        };
    }
    else
    {
        if (req.License == null || req.License.Payload == null)
            return Results.Json(new { message = "لایسنس ارسال نشده" }, statusCode: 401);

        var verifyResult = LicenseVerifier.Verify(req.License);
        if (!verifyResult.IsValid)
            return Results.Json(new { message = verifyResult.Error }, statusCode: 401);

        payload = verifyResult.Payload!;
    }

    if (string.IsNullOrWhiteSpace(req.Message))
        return Results.BadRequest(new { message = "متن پیام خالی است" });
    if (string.IsNullOrWhiteSpace(req.SessionId))
        return Results.BadRequest(new { message = "شناسه نشست نامعتبر" });

    var installId = await db.GetOrCreateInstallAsync(
        payload.LicenseId, payload.CustomerId, payload.CustomerName, payload.SystemId ?? "");

    var msgId = await db.SaveMessageAsync(
        installId, req.SessionId, req.UserId, req.UserName,
        direction: 1, req.Message, adminRead: 0);

    if (emailEnabled)
    {
        _ = Task.Run(async () => { try { await email.SendNewTicketAsync(req, payload, installId); } catch { } });
    }

    return Results.Ok(new { message = "پیام شما ارسال شد", msgId });
});

app.MapPost("/api/support/poll", async (SupportPollRequest req) =>
{
    var devMode = builder.Configuration.GetValue<bool?>("Relay:DevMode") ?? false;
    LicensePayload? payload = null;

    if (devMode)
    {
        payload = new LicensePayload
        {
            Version = 1,
            LicenseId = "LIC-DEV-TEST",
            CustomerId = "CUST-DEV",
            CustomerName = "مشتری تست (DEV)",
            IssuedAt = "1404/01/01",
            ExpiresAt = "1405/12/29",
            SystemId = "DEV-0000-0000",
            AuthorizedOrgs = new long[] { 1 },
            Features = new[] { "web", "api" }
        };
    }
    else
    {
        if (req.License == null || req.License.Payload == null)
            return Results.Json(new { message = "لایسنس ارسال نشده" }, statusCode: 401);

        var verifyResult = LicenseVerifier.Verify(req.License);
        if (!verifyResult.IsValid)
            return Results.Json(new { message = verifyResult.Error }, statusCode: 401);

        payload = verifyResult.Payload!;
    }

    var installId = await db.GetOrCreateInstallAsync(
        payload.LicenseId, payload.CustomerId, payload.CustomerName, payload.SystemId ?? "");

    var items = await db.GetMessagesAsync(installId, req.SessionId ?? "", req.SinceId);
    return Results.Ok(new { items });
});
app.Run();

// ═══════════════════════════════════════════════════════════
//  Helpers & Classes
// ═══════════════════════════════════════════════════════════

public static class HashHelper
{
    public static string ComputeHash(string input)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input + "::ariana-salt-2026::"));
        return Convert.ToBase64String(bytes);
    }
}

// ═══════════════════════════════════════════════════════════
//  License Verifier
// ═══════════════════════════════════════════════════════════
public static class LicenseVerifier
{
    private const string PUBLIC_KEY_XML = @"<RSAKeyValue><Modulus>pxQVrGKMBvPiKZebpKm1hHwCKR8FM21gfbZmPQPXJE/VpfXYRrZTXLl7SPrUWBAZSqwKZbGlx2ONYbJLP9WCEk0pJdjkWc+DiGjBEsEY2Xnr/qzK1yHFBLu6W/elDJY8J23I1o/2lKJsdwNG+VV1WC0tgKJ2z2Tw1c2ucHt64g7qtMeSKe1nf95NNYPn2jHk/gNccHbqItkAIzwgsL1eWLaFbJERIDHzotOHzBGJfHegb6+jFPtD3wQIFInWjZ5t/QsuxDMYdt8kzUieI4tcR+jtbaKkRpGmfV69Tl1xBSryZGpcT5rj7s3ZeDTrgzcwNLjp4nV5+vVh0qORYOkdQQ==</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>";

    public static (bool IsValid, string Error, LicensePayload? Payload) Verify(LicenseFile file)
    {
        try
        {
            if (file.Payload == null || string.IsNullOrWhiteSpace(file.Signature))
                return (false, "ساختار لایسنس نامعتبر", null);

            var canonicalJson = BuildCanonicalJson(file.Payload);
            var dataBytes = Encoding.UTF8.GetBytes(canonicalJson);
            var sigBytes = Convert.FromBase64String(file.Signature);

            using var rsa = RSA.Create();
            rsa.FromXmlString(PUBLIC_KEY_XML);

            var ok = rsa.VerifyData(dataBytes, sigBytes,
                HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

            if (!ok) return (false, "امضای لایسنس نامعتبر", null);

            if (!IsNotExpired(file.Payload.ExpiresAt))
                return (false, "لایسنس منقضی شده", null);

            return (true, "", file.Payload);
        }
        catch (Exception ex)
        {
            return (false, $"خطا در تأیید لایسنس: {ex.Message}", null);
        }
    }

    private static string BuildCanonicalJson(LicensePayload p)
    {
        var featuresJson = "[" + string.Join(",", p.Features.Select(f => $"\"{f}\"")) + "]";
        var orgsJson = "[" + string.Join(",", p.AuthorizedOrgs) + "]";
        var notesJson = p.Notes is null ? "null" : $"\"{p.Notes.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"";

        var baseJson = $"{{\"version\":{p.Version}," +
                       $"\"licenseId\":\"{p.LicenseId}\"," +
                       $"\"customerName\":\"{p.CustomerName}\"," +
                       $"\"customerId\":\"{p.CustomerId}\"," +
                       $"\"issuedAt\":\"{p.IssuedAt}\"," +
                       $"\"expiresAt\":\"{p.ExpiresAt}\"," +
                       $"\"authorizedOrgs\":{orgsJson}," +
                       $"\"features\":{featuresJson}," +
                       $"\"notes\":{notesJson}";

        if (!string.IsNullOrEmpty(p.SystemId))
            return baseJson + $",\"systemId\":\"{p.SystemId}\"}}";
        return baseJson + "}";
    }

    private static bool IsNotExpired(string? expiresAt)
    {
        if (string.IsNullOrWhiteSpace(expiresAt)) return false;
        try
        {
            var parts = expiresAt.Trim().Split('/');
            if (parts.Length != 3) return false;
            var year = int.Parse(parts[0]);
            var month = int.Parse(parts[1]);
            var day = int.Parse(parts[2]);
            if (year < 1300 || year > 1500) return false;
            if (month < 1 || month > 12) return false;
            if (day < 1 || day > 31) return false;

            var pc = new System.Globalization.PersianCalendar();
            var now = DateTime.Now;
            var ty = pc.GetYear(now);
            var tm = pc.GetMonth(now);
            var td = pc.GetDayOfMonth(now);

            if (ty > year) return false;
            if (ty < year) return true;
            if (tm > month) return false;
            if (tm < month) return true;
            return td <= day;
        }
        catch { return false; }
    }
}

// ═══════════════════════════════════════════════════════════
//  DTOs
// ═══════════════════════════════════════════════════════════
public record LoginRequest(string Password);
public record ReplyRequest(string Message);

public class LicensePayload
{
    public int Version { get; set; }
    public string LicenseId { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string CustomerId { get; set; } = "";
    public string IssuedAt { get; set; } = "";
    public string ExpiresAt { get; set; } = "";
    public long[] AuthorizedOrgs { get; set; } = Array.Empty<long>();
    public string[] Features { get; set; } = Array.Empty<string>();
    public string? Notes { get; set; }
    public string SystemId { get; set; } = "";
}

public class LicenseFile
{
    public LicensePayload Payload { get; set; } = new();
    public string Signature { get; set; } = "";
}

public class SupportSendRequest
{
    public LicenseFile? License { get; set; }
    public string SessionId { get; set; } = "";
    public long? UserId { get; set; }
    public string? UserName { get; set; }
    public string Message { get; set; } = "";
}

public class SupportPollRequest
{
    public LicenseFile? License { get; set; }
    public string? SessionId { get; set; }
    public int SinceId { get; set; } = 0;
}

public record TicketItem(
    int InstallId,
    string InstallName,
    string SessionId,
    string? LastMessage,
    string LastAt,
    int UnreadCount);

public record MessageItem(
    long Id,
    int Direction,
    string Message,
    string CreatedAt,
    string? UserName);

// ═══════════════════════════════════════════════════════════
//  RelayDb
// ═══════════════════════════════════════════════════════════
public class RelayDb
{
    private readonly string _path;
    public RelayDb(string path) { _path = path; }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection($"Data Source={_path}");
        c.Open();
        return c;
    }

    public async Task<int> GetOrCreateInstallAsync(string licenseId, string customerId, string customerName, string systemId)
    {
        await using var conn = Open();

        var find = conn.CreateCommand();
        find.CommandText = "SELECT id FROM support_install WHERE license_id = @l";
        find.Parameters.AddWithValue("@l", licenseId);
        var existing = await find.ExecuteScalarAsync();
        if (existing != null)
        {
            var upd = conn.CreateCommand();
            upd.CommandText = @"UPDATE support_install 
                                SET customer_name = @cn, customer_id = @ci, system_id = @si, last_seen = @now 
                                WHERE id = @id";
            upd.Parameters.AddWithValue("@cn", customerName ?? "");
            upd.Parameters.AddWithValue("@ci", customerId ?? "");
            upd.Parameters.AddWithValue("@si", systemId ?? "");
            upd.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
            upd.Parameters.AddWithValue("@id", Convert.ToInt32(existing));
            await upd.ExecuteNonQueryAsync();
            return Convert.ToInt32(existing);
        }

        var ins = conn.CreateCommand();
        ins.CommandText = @"INSERT INTO support_install (license_id, customer_id, customer_name, system_id, last_seen)
                            VALUES (@l, @ci, @cn, @si, @now);
                            SELECT last_insert_rowid();";
        ins.Parameters.AddWithValue("@l", licenseId);
        ins.Parameters.AddWithValue("@ci", customerId ?? "");
        ins.Parameters.AddWithValue("@cn", customerName ?? "");
        ins.Parameters.AddWithValue("@si", systemId ?? "");
        ins.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
        return Convert.ToInt32(await ins.ExecuteScalarAsync());
    }

    public async Task<long> SaveMessageAsync(int installId, string? sessionId, long? userId, string? userName,
        int direction, string message, int adminRead)
    {
        await using var conn = Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"INSERT INTO support_message
            (install_id, session_id, user_id, user_name, direction, message_text, created_at, admin_read)
            VALUES (@i, @s, @u, @un, @d, @m, @now, @ar);
            SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@i", installId);
        cmd.Parameters.AddWithValue("@s", (object?)sessionId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@u", (object?)userId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@un", (object?)userName ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@d", direction);
        cmd.Parameters.AddWithValue("@m", message);
        cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
        cmd.Parameters.AddWithValue("@ar", adminRead);
        return Convert.ToInt64(await cmd.ExecuteScalarAsync());
    }

    public async Task<List<TicketItem>> GetTicketsAsync()
    {
        await using var conn = Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT 
                i.id,
                IFNULL(i.customer_name, 'نامشخص'),
                IFNULL(m.session_id, ''),
                (SELECT message_text FROM support_message 
                 WHERE install_id = i.id AND IFNULL(session_id,'') = IFNULL(m.session_id,'')
                 ORDER BY id DESC LIMIT 1),
                (SELECT created_at FROM support_message 
                 WHERE install_id = i.id AND IFNULL(session_id,'') = IFNULL(m.session_id,'')
                 ORDER BY id DESC LIMIT 1),
                (SELECT COUNT(*) FROM support_message 
                 WHERE install_id = i.id AND IFNULL(session_id,'') = IFNULL(m.session_id,'')
                   AND direction = 1 AND admin_read = 0)
            FROM support_install i
            INNER JOIN (SELECT DISTINCT install_id, session_id FROM support_message) m 
                ON m.install_id = i.id
            WHERE IFNULL(m.session_id,'') <> ''
            ORDER BY 5 DESC";

        var list = new List<TicketItem>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            list.Add(new TicketItem(
                r.GetInt32(0),
                r.IsDBNull(1) ? "نامشخص" : r.GetString(1),
                r.IsDBNull(2) ? "" : r.GetString(2),
                r.IsDBNull(3) ? null : r.GetString(3),
                r.IsDBNull(4) ? "" : r.GetString(4),
                r.IsDBNull(5) ? 0 : r.GetInt32(5)));
        }
        return list;
    }

    public async Task<List<MessageItem>> GetMessagesAsync(int installId, string sessionId, int sinceId)
    {
        await using var conn = Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT id, direction, message_text, created_at, user_name
                            FROM support_message
                            WHERE install_id = @i AND IFNULL(session_id,'') = @s AND id > @since
                            ORDER BY id ASC";
        cmd.Parameters.AddWithValue("@i", installId);
        cmd.Parameters.AddWithValue("@s", sessionId ?? "");
        cmd.Parameters.AddWithValue("@since", sinceId);

        var list = new List<MessageItem>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync())
        {
            list.Add(new MessageItem(
                r.GetInt64(0),
                r.GetInt32(1),
                r.IsDBNull(2) ? "" : r.GetString(2),
                r.IsDBNull(3) ? "" : r.GetString(3),
                r.IsDBNull(4) ? null : r.GetString(4)));
        }
        return list;
    }

    public async Task MarkTicketReadAsync(int installId, string sessionId)
    {
        await using var conn = Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = @"UPDATE support_message SET admin_read = 1
                            WHERE install_id = @i AND IFNULL(session_id,'') = @s AND direction = 1";
        cmd.Parameters.AddWithValue("@i", installId);
        cmd.Parameters.AddWithValue("@s", sessionId ?? "");
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<int> GetAdminUnreadCountAsync()
    {
        await using var conn = Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM support_message WHERE direction = 1 AND admin_read = 0";
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }
}

// ═══════════════════════════════════════════════════════════
//  EmailSender
// ═══════════════════════════════════════════════════════════
public class EmailSender
{
    private readonly bool _enabled;
    private readonly string _host;
    private readonly int _port;
    private readonly bool _ssl;
    private readonly string _user;
    private readonly string _pass;
    private readonly string _from;
    private readonly string _to;

    public EmailSender(bool enabled, string host, int port, bool ssl,
        string user, string pass, string from, string to)
    {
        _enabled = enabled; _host = host; _port = port; _ssl = ssl;
        _user = user; _pass = pass; _from = from; _to = to;
    }

    public async Task SendNewTicketAsync(SupportSendRequest req, LicensePayload license, int installId)
    {
        if (!_enabled || string.IsNullOrWhiteSpace(_host)) return;

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(_from));
        message.To.Add(MailboxAddress.Parse(_to));
        message.Subject = $"📩 پیام جدید از {license.CustomerName}";

        var safeMsg = System.Net.WebUtility.HtmlEncode(req.Message).Replace("\n", "<br>");
        var body = $@"
<div style='font-family:Tahoma,sans-serif;direction:rtl;padding:20px;background:#f5f5f5;'>
  <div style='max-width:600px;margin:0 auto;background:white;border-radius:12px;padding:24px;'>
    <h2 style='color:#4F46E5;'>📩 پیام جدید پشتیبانی</h2>
    <p><b>مشتری:</b> {license.CustomerName}</p>
    <p><b>کد مشتری:</b> {license.CustomerId}</p>
    <p><b>شناسه لایسنس:</b> {license.LicenseId}</p>
    <p><b>کاربر:</b> {req.UserName ?? "مهمان"}</p>
    <div style='background:#f9fafb;border-right:4px solid #4F46E5;padding:14px;margin-top:16px;'>
      {safeMsg}
    </div>
    <a href='https://ariana.iewco.ir/support/index.html' style='display:inline-block;margin-top:20px;background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;'>مشاهده در پنل</a>
  </div>
</div>";

        message.Body = new TextPart("html") { Text = body };

        using var client = new SmtpClient();
        await client.ConnectAsync(_host, _port, _ssl);
        if (!string.IsNullOrWhiteSpace(_user))
            await client.AuthenticateAsync(_user, _pass);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}