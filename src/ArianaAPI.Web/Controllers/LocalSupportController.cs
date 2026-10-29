using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ArianaAPI.Infrastructure.Services;

namespace ArianaAPI.Web.Controllers
{
    public class LocalSendRequest
    {
        public string SessionId { get; set; } = "";
        public long? UserId { get; set; }
        public string? UserName { get; set; }

        // ⭐ فیلدهای جدید برای دریافت از بدنه درخواست ⭐
        public long? OrgId { get; set; }
        public long? FyId { get; set; }
        public string? OrgName { get; set; }
        public string? FyName { get; set; }

        public string Message { get; set; } = "";
    }

    public class LocalPollRequest
    {
        public string SessionId { get; set; } = "";
        public int SinceId { get; set; } = 0;
    }

    [ApiController]
    [Route("api/local-support")]
    [AllowAnonymous]
    public class LocalSupportController : ControllerBase
    {
        private readonly SupportRelayClient _client;

        public LocalSupportController(SupportRelayClient client)
        {
            _client = client;
        }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] LocalSendRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Message))
                return BadRequest(new { message = "متن پیام خالی است" });
            if (string.IsNullOrWhiteSpace(req.SessionId))
                return BadRequest(new { message = "شناسه نشست نامعتبر" });

            // ⭐ ۱. مقادیر پیش‌فرض از بدنه درخواست (جلوگیری از Null)
            var orgId = req.OrgId ?? 0L;
            var fyId = req.FyId ?? 0L;
            var userId = req.UserId ?? 0L;

            // تبدیل Null به رشته خالی تا سمت Relay یا کلاینت کرش نکند
            var userName = req.UserName ?? "";
            var orgName = req.OrgName ?? "";
            var fyName = req.FyName ?? "";

            // ⭐ ۲. اگر JWT موجود بود، مقادیر معتبرتر JWT را جایگزین می‌کنیم
            if (User.Identity?.IsAuthenticated == true)
            {
                long.TryParse(User.FindFirst("orgId")?.Value, out var jwtOrgId);
                long.TryParse(User.FindFirst("fyId")?.Value, out var jwtFyId);
                long.TryParse(User.FindFirst("userId")?.Value, out var jwtUserId);

                if (jwtOrgId > 0) orgId = jwtOrgId;
                if (jwtFyId > 0) fyId = jwtFyId;
                if (jwtUserId > 0) userId = jwtUserId;

                var jwtUserName = User.FindFirst("unique_name")?.Value ?? User.FindFirst("userName")?.Value;
                var jwtOrgName = User.FindFirst("orgName")?.Value;
                var jwtFyName = User.FindFirst("fyName")?.Value;

                if (!string.IsNullOrEmpty(jwtUserName)) userName = jwtUserName;
                if (!string.IsNullOrEmpty(jwtOrgName)) orgName = jwtOrgName;
                if (!string.IsNullOrEmpty(jwtFyName)) fyName = jwtFyName;
            }

            var result = await _client.SendAsync(
                req.SessionId, userId, userName,
                orgId, fyId, orgName, fyName,
                req.Message);

            if (result.Success)
                return Ok(new { message = result.Message });

            return BadRequest(new { message = result.Message });
        }
        [HttpPost("poll")]
        public async Task<IActionResult> Poll([FromBody] LocalPollRequest req)
        {
            var json = await _client.PollAsync(req.SessionId, req.SinceId);
            return Content(json, "application/json");
        }
    }
}