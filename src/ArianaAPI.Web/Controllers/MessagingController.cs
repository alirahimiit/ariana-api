using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ArianaAPI.Application.Dtos.Messaging;
using ArianaAPI.Application.Interfaces;

namespace ArianaAPI.Web.Controllers
{
    [ApiController]
    [Route("api/messaging")]
    [AllowAnonymous]
    public class MessagingController : ControllerBase
    {
        private readonly IMessagingService _messagingService;

        public MessagingController(IMessagingService messagingService)
        {
            _messagingService = messagingService;
        }

        [HttpGet("bale/test")]
        public async Task<IActionResult> TestBaleConnection()
        {
            var result = await _messagingService.TestActiveBotsAsync();
            if (result.Success)
                return Ok(new { message = result.Message });
            return BadRequest(new { message = result.Message });
        }

        // ⭐ اصلاح: async برداشته شد چون await ندارد
        [HttpPost("poll")]
        public IActionResult PollNow()
        {
            return Ok(new { message = "Polling خودکار فعال است. منتظر بمانید." });
        }

        [HttpGet("chats")]
        public async Task<IActionResult> GetChats([FromQuery] long orgId, [FromQuery] long fyId)
        {
            var chats = await _messagingService.GetChatsAsync(orgId, fyId);
            return Ok(new { items = chats });
        }

        [HttpGet("chats/{chatId}/messages")]
        public async Task<IActionResult> GetMessages(
            [FromQuery] long orgId, [FromQuery] long fyId, int chatId)
        {
            var messages = await _messagingService.GetMessagesAsync(orgId, fyId, chatId);
            return Ok(new { items = messages });
        }

        [HttpPost("chats/{chatId}/send")]
        public async Task<IActionResult> SendMessage(
            [FromQuery] long orgId, [FromQuery] long fyId, int chatId,
            [FromBody] PanelSendRequestDto req)
        {
            if (string.IsNullOrWhiteSpace(req.Text))
                return BadRequest(new { message = "متن پیام نمی‌تواند خالی باشد." });

            var result = await _messagingService.SendFromPanelAsync(orgId, fyId, chatId, req.Text);
            if (result.Success)
                return Ok(new { message = result.Message });

            return BadRequest(new { message = result.Message });
        }

        [HttpPost("chats/{chatId}/read")]
        public async Task<IActionResult> MarkRead(
            [FromQuery] long orgId, [FromQuery] long fyId, int chatId)
        {
            await _messagingService.MarkAsReadAsync(orgId, fyId, chatId);
            return Ok(new { message = "علامت‌گذاری شد." });
        }

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount(
            [FromQuery] long orgId, [FromQuery] long fyId)
        {
            var count = await _messagingService.GetTotalUnreadAsync(orgId, fyId);
            return Ok(new { count });
        }
        // ⭐ چک — آیا این Tenant پنل پشتیبان دارد؟
        [HttpGet("is-support-panel")]
        public async Task<IActionResult> IsSupportPanel(
            [FromQuery] long orgId, [FromQuery] long fyId)
        {
            var hasBot = await _messagingService.HasActiveBotAsync(orgId, fyId);
            return Ok(new { isSupport = hasBot });
        }
    }
}