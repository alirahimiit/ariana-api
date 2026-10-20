using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services;

public class SanadClosingService : ISanadClosingService
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<SanadClosingService> _logger;

    private const string SHARH_EKHTETAMIEH = "بابت بستن حسابهاي دائمي به تراز اختتاميه";
    private const string SHARH_CLOSING_ROW = "بابت بستن حسابها";

    public SanadClosingService(
        ITenantConnectionFactory factory,
        IConfiguration config,
        ILogger<SanadClosingService> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<SanadClosingValidateDto> ValidateAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        var result = new SanadClosingValidateDto();

        try
        {
            using var permConn = _factory.CreatePermanentConnection();
            await permConn.OpenAsync(ct);

            using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.OpenAsync(ct);

            var endSanadNumDec = await permConn.ExecuteScalarAsync<decimal?>(
                "SELECT EndSanadNum FROM DorehMali WHERE DorehMaliID = @fyId",
                new { fyId });

            long? endSanadNum = endSanadNumDec.HasValue ? Convert.ToInt64(endSanadNumDec.Value) : (long?)null;

            if (endSanadNum.HasValue && endSanadNum.Value > 0)
            {
                var sanadExists = await conn.ExecuteScalarAsync<int>(
                    "SELECT COUNT(*) FROM ParentSanad WHERE ParentSanadID = @id",
                    new { id = endSanadNum.Value });

                if (sanadExists > 0)
                {
                    result.AlreadyClosed = true;
                    result.EndSanadNum = endSanadNum;
                    result.Issues.Add($"اختتامیه قبلاً صادر شده (شماره سند: {endSanadNum})");
                    return result;
                }
            }

            var stat = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT
                    COUNT(*) AS Total,
                    SUM(CASE WHEN Vazeit = 2 THEN 1 ELSE 0 END) AS Confirmed,
                    SUM(CASE WHEN Vazeit <> 2 THEN 1 ELSE 0 END) AS Pending
                FROM ParentSanad");

            result.TotalSanads = (int)(stat?.Total ?? 0);
            result.ConfirmedSanads = (int)(stat?.Confirmed ?? 0);
            result.PendingSanads = (int)(stat?.Pending ?? 0);

            if (result.TotalSanads == 0)
            {
                result.Issues.Add("هیچ سندی در سال جاری وجود ندارد");
                return result;
            }

            if (result.PendingSanads > 0)
            {
                var pending = await conn.QueryAsync<UnconfirmedSanadDto>(@"
                    SELECT ParentSanadID AS ParentSanadId, NO_Sanad AS NoSanad,
                           Vazeit, Date_IN AS DateIn, OtherParentSharh
                    FROM ParentSanad
                    WHERE Vazeit <> 2
                    ORDER BY NO_Sanad");

                result.UnconfirmedList = pending.ToList();
                result.Issues.Add($"{result.PendingSanads} سند قطعی نشده — ابتدا همه را قطعی کنید");
                return result;
            }

            result.Ok = true;
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SanadClosing validate failed");
            result.Issues.Add("خطا در اعتبارسنجی: " + ex.Message);
            return result;
        }
    }

    public async Task<SanadClosingResultDto> CreateClosingSanadAsync(
        SanadClosingRequestDto request, CancellationToken ct = default)
    {
        long orgId = request.OrgId;
        long fyId = request.FyId;

        try
        {
            var val = await ValidateAsync(orgId, fyId, ct);
            if (!val.Ok)
                return new SanadClosingResultDto { Success = false, Message = string.Join(" | ", val.Issues) };

            using var permConn = _factory.CreatePermanentConnection();
            await permConn.OpenAsync(ct);
            var permDb = permConn.Database;

            using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.OpenAsync(ct);

            var endDate = await permConn.ExecuteScalarAsync<string>(
                "SELECT EndDate FROM DorehMali WHERE DorehMaliID = @fyId",
                new { fyId });

            var dateIn = string.IsNullOrWhiteSpace(endDate) ? PersianDateHelper.Today() : endDate;
            var today = PersianDateHelper.Today();
            var now = DateTime.Now.ToString("HH:mm:ss");

            using var tx = await conn.BeginTransactionAsync(ct);
            try
            {
                var nextNoDec = await conn.ExecuteScalarAsync<decimal>(
                    "SELECT ISNULL(MAX(NO_Sanad), 0) + 1 FROM ParentSanad", transaction: tx);
                long nextNo = Convert.ToInt64(nextNoDec);

                var newParentSanadIdDec = await conn.ExecuteScalarAsync<decimal>(@"
                    INSERT INTO ParentSanad
                        (NO_Sanad, Date_IN, Vazeit, OtherParentSharh, KindSanad,
                         Code_Op, Date_Op, Time_Op, Creator, Updater)
                    OUTPUT INSERTED.ParentSanadID
                    VALUES
                        (@nextNo, @dateIn, 0, @sharh, 2, -1, @today, @now, -1, -1);",
                    new { nextNo, dateIn, sharh = SHARH_EKHTETAMIEH, today, now },
                    transaction: tx);
                long newParentSanadId = Convert.ToInt64(newParentSanadIdDec);

                // ═══ ۱. صفر کردن مانده تمام حساب‌ها ═══
                var sqlAgg = @"
                    INSERT INTO Sanad
                        (NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                         Code_Tafzili2, CodeVahed, CodeMarkazH, CodeProject,
                         OtherSharh, Mab_Bed, Mab_Bes,
                         Code_Op, Date_Op, Time_Op, RowNum, FactorID)
                    SELECT
                        @nextNo, @newParentSanadId,
                        Code_Col, Code_Moein, Code_Tafzil,
                        0, 0, 0, 0,
                        @sharh,
                        CASE WHEN (SUM(Mab_Bed) - SUM(Mab_Bes)) > 0 THEN (SUM(Mab_Bed) - SUM(Mab_Bes)) ELSE 0 END,
                        CASE WHEN (SUM(Mab_Bed) - SUM(Mab_Bes)) < 0 THEN ABS(SUM(Mab_Bed) - SUM(Mab_Bes)) ELSE 0 END,
                        -1, @today, @now,
                        ROW_NUMBER() OVER (ORDER BY Code_Col, Code_Moein, Code_Tafzil),
                        0
                    FROM Sanad
                    GROUP BY Code_Col, Code_Moein, Code_Tafzil
                    HAVING SUM(Mab_Bed) <> SUM(Mab_Bes)";

                var rowsCreated = await conn.ExecuteAsync(sqlAgg,
                    new { nextNo, newParentSanadId, sharh = SHARH_EKHTETAMIEH, today, now },
                    transaction: tx);

                // ═══ ۲. محاسبه جمع بدهکار و بستانکار کل سند ═══
                var totals = await conn.QueryFirstAsync<dynamic>(@"
                    SELECT ISNULL(SUM(Mab_Bed),0) AS TB, ISNULL(SUM(Mab_Bes),0) AS TS
                    FROM Sanad WHERE ParentSanadCode = @newParentSanadId",
                    new { newParentSanadId }, transaction: tx);

                decimal totalBed = (decimal)(totals?.TB ?? 0m);
                decimal totalBes = (decimal)(totals?.TS ?? 0m);

                var maxRowNum = await conn.ExecuteScalarAsync<int>(
                    "SELECT ISNULL(MAX(RowNum), 0) FROM Sanad WHERE ParentSanadCode = @newParentSanadId",
                    new { newParentSanadId }, transaction: tx);

                // ═══ ۳. ردیف بدهکار اختتامیه (به اندازه جمع بستانکارها) ═══
                if (totalBes > 0)
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO Sanad
                            (NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                             Code_Tafzili2, CodeVahed, CodeMarkazH, CodeProject,
                             OtherSharh, Mab_Bed, Mab_Bes,
                             Code_Op, Date_Op, Time_Op, RowNum, FactorID)
                        VALUES
                            (@nextNo, @newParentSanadId, @cCol, @cMoein, @cTafzil,
                             0, 0, 0, 0,
                             @sharhRow,
                             @totalBes,
                             0,
                             -1, @today, @now, @rowNum1, 0)",
                        new
                        {
                            nextNo,
                            newParentSanadId,
                            cCol = request.ClosingCodeCol,
                            cMoein = request.ClosingCodeMoein,
                            cTafzil = request.ClosingCodeTafzil,
                            sharhRow = SHARH_CLOSING_ROW,
                            totalBes = totalBes,
                            today,
                            now,
                            rowNum1 = maxRowNum + 1
                        }, transaction: tx);
                    rowsCreated++;
                }

                // ═══ ۴. ردیف بستانکار اختتامیه (به اندازه جمع بدهکارها) ═══
                if (totalBed > 0)
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO Sanad
                            (NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                             Code_Tafzili2, CodeVahed, CodeMarkazH, CodeProject,
                             OtherSharh, Mab_Bed, Mab_Bes,
                             Code_Op, Date_Op, Time_Op, RowNum, FactorID)
                        VALUES
                            (@nextNo, @newParentSanadId, @cCol, @cMoein, @cTafzil,
                             0, 0, 0, 0,
                             @sharhRow,
                             0,
                             @totalBed,
                             -1, @today, @now, @rowNum2, 0)",
                        new
                        {
                            nextNo,
                            newParentSanadId,
                            cCol = request.ClosingCodeCol,
                            cMoein = request.ClosingCodeMoein,
                            cTafzil = request.ClosingCodeTafzil,
                            sharhRow = SHARH_CLOSING_ROW,
                            totalBed = totalBed,
                            today,
                            now,
                            rowNum2 = maxRowNum + 2
                        }, transaction: tx);
                    rowsCreated++;
                }

                // ═══ ۵. آپدیت DorehMali ═══
                await conn.ExecuteAsync(
                    $"UPDATE [{permDb}].dbo.DorehMali SET EndSanadNum = @newParentSanadId WHERE DorehMaliID = @fyId",
                    new { newParentSanadId, fyId }, transaction: tx);

                await tx.CommitAsync(ct);

                return new SanadClosingResultDto
                {
                    Success = true,
                    ParentSanadId = newParentSanadId,
                    NoSanad = nextNo,
                    RowsCreated = rowsCreated,
                    TotalBed = totalBed + totalBes,
                    TotalBes = totalBed + totalBes,
                    Message = $"سند اختتامیه شماره {nextNo} با {rowsCreated} ردیف ثبت شد"
                };
            }
            catch (Exception exTx)
            {
                await tx.RollbackAsync(ct);
                return new SanadClosingResultDto { Success = false, Message = "خطا در ثبت: " + exTx.Message };
            }
        }
        catch (Exception ex)
        {
            return new SanadClosingResultDto { Success = false, Message = ex.Message };
        }
    }
}