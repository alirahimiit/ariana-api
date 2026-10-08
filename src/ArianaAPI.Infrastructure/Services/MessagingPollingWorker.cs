using System;
using System.Threading;
using System.Threading.Tasks;
using ArianaAPI.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services
{
    public class MessagingPollingWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _config;
        private readonly ILogger<MessagingPollingWorker> _logger;

        public MessagingPollingWorker(
            IServiceScopeFactory scopeFactory,
            IConfiguration config,
            ILogger<MessagingPollingWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _config = config;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var intervalSec = _config.GetValue<int?>("Messaging:PollingIntervalSeconds") ?? 3;
            var interval = TimeSpan.FromSeconds(intervalSec);

            _logger.LogInformation(
                "⭐ MessagingPollingWorker شروع شد — هر {Sec} ثانیه ربات‌های فعال بررسی می‌شوند",
                intervalSec);

            try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
            catch (TaskCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PollAllActiveBotsAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ خطا در حلقه اصلی Polling");
                }

                try { await Task.Delay(interval, stoppingToken); }
                catch (TaskCanceledException) { break; }
            }

            _logger.LogInformation("MessagingPollingWorker متوقف شد");
        }

        private async Task PollAllActiveBotsAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();

            var configRepo = scope.ServiceProvider.GetRequiredService<IBotConfigRepository>();
            var messagingService = scope.ServiceProvider.GetRequiredService<IMessagingService>();
            var repo = scope.ServiceProvider.GetRequiredService<IMessagingRepository>();

            // ⭐ خواندن ربات‌های فعال از Permanent DB
            var activeBots = await configRepo.GetActiveConfigsAsync(ct);

            foreach (var bot in activeBots)
            {
                if (ct.IsCancellationRequested) break;

                try
                {
                    // چک کن Tenant جداول messaging دارد
                    var hasTables = await repo.HasMessagingTablesAsync(
                        bot.TargetOrgId, bot.TargetFyId, ct);

                    if (!hasTables)
                    {
                        _logger.LogWarning(
                            "⚠️ ربات {Name} — Tenant {OrgId}/{FyId} جدول messaging ندارد",
                            bot.BotName, bot.TargetOrgId, bot.TargetFyId);
                        continue;
                    }

                    await messagingService.ProcessUpdatesAsync(
                        bot.BotToken,
                        bot.TargetOrgId,
                        bot.TargetFyId,
                        ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "❌ خطا در Polling ربات {Name} (Tenant {OrgId}/{FyId})",
                        bot.BotName, bot.TargetOrgId, bot.TargetFyId);
                }
            }
        }
    }
}