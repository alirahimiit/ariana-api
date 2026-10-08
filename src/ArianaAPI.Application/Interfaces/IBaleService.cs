using System.Collections.Generic;
using System.Threading.Tasks;

namespace ArianaAPI.Application.Interfaces
{
    public class BaleInlineButton
    {
        public string Text { get; set; } = "";
        public string CallbackData { get; set; } = "";
    }

    public interface IBaleService
    {
        Task<(bool Success, string Message)> TestConnectionAsync(string token);
        Task<(bool Success, string Message)> GetUpdatesAsync(string token, long? offset = null);
        Task<(bool Success, string Message)> SendMessageAsync(
            string token,
            long chatId,
            string text,
            List<List<BaleInlineButton>>? buttons = null);
    }
}