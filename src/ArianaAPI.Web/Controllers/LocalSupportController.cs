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

            // ⭐ استخراج اطلاعات از JWT (کاربر لاگین‌شده)
            var orgId = 0L;
            var fyId = 0L;
            string? orgName = null;
            string? fyName = null;

            if (User.Identity?.IsAuthenticated == true)
            {
                long.TryParse(User.FindFirst("orgId")?.Value, out orgId);
                long.TryParse(User.FindFirst("fyId")?.Value, out fyId);
                orgName = User.FindFirst("orgName")?.Value;
                fyName = User.FindFirst("fyName")?.Value;
            }

            var result = await _client.SendAsync(
                req.SessionId, req.UserId, req.UserName,
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