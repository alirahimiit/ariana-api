using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Data.Common;

namespace ArianaAPI.Infrastructure.Services;

public class SanadOpeningService : ISanadOpeningService
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<SanadOpeningService> _logger;

    private const string SHARH_EFTETAHIEH = "نقل از تراز افتتاحيه";

    public SanadOpeningService(
        ITenantConnectionFactory factory,
        IConfiguration config,
        ILogger<SanadOpeningService> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<SanadOpeningResultDto> CreateOpeningSanadAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        try
        {
            using var permConn = _factory.CreatePermanentConnection();
            await permConn.OpenAsync(ct);
            var permDb = permConn.Database;

            using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.OpenAsync(ct);

            var currentFy = await permConn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT DorehMaliID, BeginDate, EndDate, PriorDorehMaliCode, BeginSanadNum " +
                "FROM DorehMali WHERE DorehMaliID = @fyId",
                new { fyId });

            if (currentFy == null)
                return Fail("دوره مالی جاری یافت نشد");

            decimal? beginSanadDec = currentFy?.BeginSanadNum as decimal?;
            long? beginSanadNum = beginSanadDec.HasValue ? Convert.ToInt64(beginSanadDec.Value) : (long?)null;

            if (beginSanadNum.HasValue && beginSanadNum.Value > 0)
                return Fail($"قبلاً سند افتتاحیه صادر شده (BeginSanadNum={beginSanadNum})");

            var no1Exists = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM ParentSanad WHERE NO_Sanad = 1");
            if (no1Exists > 0)
                return Fail("سند شماره ۱ قبلاً در ParentSanad موجود است — ابتدا آن را حذف کنید");

            decimal? priorCodeDec = currentFy?.PriorDorehMaliCode as decimal?;
            long? prevFyId = priorCodeDec.HasValue ? Convert.ToInt64(priorCodeDec.Value) : (long?)null;

            if (!prevFyId.HasValue || prevFyId.Value <= 0)
                return Fail("دوره‌ی قبلی تعریف نشده (PriorDorehMaliCode=0)");

            var prevFy = await permConn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT EndSanadNum FROM DorehMali WHERE DorehMaliID = @prevFyId",
                new { prevFyId = prevFyId.Value });

            if (prevFy == null)
                return Fail("دوره‌ی قبلی در جدول یافت نشد");

            decimal? endSanadDec = prevFy?.EndSanadNum as decimal?;
            long prevEndSanadNum = endSanadDec.HasValue ? Convert.ToInt64(endSanadDec.Value) : 0;

            if (prevEndSanadNum <= 0)
                return Fail("اختتامیه سال قبل صادر نشده (EndSanadNum=0) — ابتدا سند اختتامیه دوره قبل را بسازید");

            var prevDbName = _factory.BuildTenantDbName(orgId, prevFyId.Value);

            var dateIn = Convert.ToString(currentFy?.BeginDate) ?? "";
            if (string.IsNullOrWhiteSpace(dateIn))
                dateIn = PersianDateHelper.Today().Substring(0, 4) + "/01/01";

            var today = PersianDateHelper.Today();
            var now = DateTime.Now.ToString("HH:mm:ss");

            using var tx = await conn.BeginTransactionAsync(ct);
            try
            {
                var newParentSanadIdDec = await conn.ExecuteScalarAsync<decimal>(@"
                    INSERT INTO ParentSanad
                        (NO_Sanad, Date_IN, Vazeit, OtherParentSharh, KindSanad,
                         Code_Op, Date_Op, Time_Op, Creator, Updater)
                    OUTPUT INSERTED.ParentSanadID
                    VALUES
                        (1, @dateIn, 0, @sharh, 1, -1, @today, @now, -1, -1);",
                    new { dateIn, sharh = SHARH_EFTETAHIEH, today, now },
                    transaction: tx);
                long newParentSanadId = Convert.ToInt64(newParentSanadIdDec);

                var sqlCopy = $@"
                    INSERT INTO Sanad
                        (NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                         Code_Tafzili2, CodeVahed, CodeMarkazH, CodeProject,
                         OtherSharh, Mab_Bed, Mab_Bes,
                         Code_Op, Date_Op, Time_Op, RowNum, FactorID)
                    SELECT
                        1, @newParentSanadId,
                        Code_Col, Code_Moein, Code_Tafzil,
                        ISNULL(Code_Tafzili2, 0), ISNULL(CodeVahed, 0),
                        ISNULL(CodeMarkazH, 0), ISNULL(CodeProject, 0),
                        @sharh,
                        ISNULL(Mab_Bes, 0),     -- ⭐ SWAP
                        ISNULL(Mab_Bed, 0),     -- ⭐ SWAP
                        -1, @today, @now, ISNULL(RowNum, 0), 0
                    FROM [{prevDbName}].dbo.Sanad
                    WHERE ParentSanadCode = @prevEndSanadNum";

                var rowsCopied = await conn.ExecuteAsync(sqlCopy,
                    new { newParentSanadId, sharh = SHARH_EFTETAHIEH, today, now, prevEndSanadNum = prevEndSanadNum },
                    transaction: tx);

                await conn.ExecuteAsync(
                    $"UPDATE [{permDb}].dbo.DorehMali SET BeginSanadNum = @newParentSanadId WHERE DorehMaliID = @fyId",
                    new { newParentSanadId, fyId }, transaction: tx);

                await tx.CommitAsync(ct);

                _logger.LogInformation("✅ سند افتتاحیه FY={FyId}: ParentSanadID={ParentId}, Rows={Rows}", fyId, newParentSanadId, rowsCopied);

                return new SanadOpeningResultDto
                {
                    Success = true,
                    ParentSanadId = newParentSanadId,
                    NoSanad = 1,
                    RowsCopied = rowsCopied,
                    PreviousFyId = prevFyId.Value,
                    PreviousEndSanadNum = prevEndSanadNum,
                    Message = $"سند افتتاحیه با {rowsCopied} ردیف ثبت شد"
                };
            }
            catch (Exception exTx)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(exTx, "SanadOpening transaction failed");
                return Fail("خطا در ثبت: " + exTx.Message);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SanadOpening failed");
            return Fail(ex.Message);
        }
    }

    private static SanadOpeningResultDto Fail(string msg) => new() { Success = false, Message = msg };
}

internal static class PersianDateHelper
{
    public static string Today()
    {
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }
}