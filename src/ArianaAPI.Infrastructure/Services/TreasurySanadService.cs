using System.Data;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Application.Services;
using Dapper;

namespace ArianaAPI.Infrastructure.Services;

/// <summary>
/// سند خودکار رسیدهای نقدی — معادل TResid.CreateParentSanadResid + CreateDetailSanadResid
/// </summary>
public class TreasurySanadService : ITreasurySanadService
{
    public async Task<ResidSanadResult> CreateResidSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ResidSanadContext ctx, CancellationToken ct = default)
    {
        if (ctx.CashCost <= 0)
            throw new InvalidOperationException("مبلغ رسید باید بزرگ‌تر از صفر باشد");
        if (ctx.ResidId <= 0)
            throw new InvalidOperationException("شناسه رسید نامعتبر است (باید اول رسید درج شود)");

        var isPay = ctx.CheckKind == 0;
        var isRecv = ctx.CheckKind == 1;
        if (!isPay && !isRecv)
            throw new InvalidOperationException("نوع رسید نامعتبر است");

        // ═══ ۱. ParentSanad ═══
        long parentSanadId;
        int noSanad;

        if (ctx.ExistingParentSanadID is > 0)
        {
            var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(
                    "SELECT ParentSanadID, NO_Sanad, Vazeit FROM ParentSanad WHERE ParentSanadID = @id",
                    new { id = ctx.ExistingParentSanadID.Value },
                    transaction: tx, cancellationToken: ct));

            if (existing == null)
                throw new InvalidOperationException("سند انتخاب‌شده یافت نشد");

            if ((int)(decimal)existing.Vazeit == 2)
                throw new InvalidOperationException("سند قطعی است");

            parentSanadId = ctx.ExistingParentSanadID.Value;
            noSanad = (int)(decimal)existing.NO_Sanad;
        }
        else
        {
            // ✅ بدون int — فقط تعیین مقدار
            if (ctx.ExistingNoSanad.HasValue && ctx.ExistingNoSanad.Value > 0)
            {
                noSanad = ctx.ExistingNoSanad.Value;
            }
            else
            {
                noSanad = await GetNextParentSanadNoAsync(conn, tx, ct);
            }

            var sharh = isPay
                ? $"پرداخت وجه نقد طي رسيد شماره {ctx.ResidNumber}"
                : $"دريافت وجه نقد طي رسيد شماره {ctx.ResidNumber}";

            const string insertParent = @"
        INSERT INTO ParentSanad
            (NO_Sanad, Date_IN, OtherParentSharh, ParentSharh_Code,
             Vazeit, KindSanad,
             ResidPayID, ResidRecID, ResidPayNo, ResidRecNo,
             Creator, Updater, Deleter, confirmer, Tempconfirmer,
             Code_Op, Date_Op, Time_Op)
        OUTPUT INSERTED.ParentSanadID
        VALUES
            (@noSanad, @dateIn, @sharh, 0,
             1, 0,
             @residPayId, @residRecId, @residPayNo, @residRecNo,
             @userCode, 0, 0, 0, 0,
             @userCode, @today, @time)";

            parentSanadId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertParent, new
                {
                    noSanad,
                    dateIn = ctx.DateIn ?? "",
                    sharh,
                    residPayId = isPay ? ctx.ResidId : 0,
                    residRecId = isPay ? 0 : ctx.ResidId,
                    residPayNo = isPay ? ctx.ResidNumber : 0,
                    residRecNo = isPay ? 0 : ctx.ResidNumber,
                    userCode = ctx.UserCode,
                    today = ctx.TodayPersian,
                    time = ctx.TimeOp
                }, transaction: tx, cancellationToken: ct));
        }

        // ═══ ۲. RowNum شروع ═══
        var maxRowNum = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition(
                "SELECT MAX(RowNum) FROM Sanad WHERE ParentSanadCode = @id",
                new { id = parentSanadId },
                transaction: tx, cancellationToken: ct)) ?? 0;

        // ═══ ۳. شرح ردیف طرف ═══
        var personSharh = isPay
            ? $"پرداخت به {ctx.PersonName} طبق رسيد شماره {ctx.ResidNumber} در تاريخ {ctx.DateIn}"
            : $"دريافت از {ctx.PersonName} طبق رسيد شماره {ctx.ResidNumber} در تاريخ {ctx.DateIn}";
        if (!string.IsNullOrWhiteSpace(ctx.Descript))
            personSharh += $" و شرح {ctx.Descript}";

        // ═══ ۴. ردیف طرف حساب ═══
        // Pay: بدهکار (RowNum = max+1)
        // Recv: بستانکار (RowNum = max+2)
        var personRowNum = isPay ? maxRowNum + 1 : maxRowNum + 2;
        var personBed = isPay ? ctx.CashCost : 0m;
        var personBes = isRecv ? ctx.CashCost : 0m;

        var personSanadId = await InsertSanadRowAsync(conn, tx,
            parentSanadId, noSanad, personRowNum,
            ctx.PersonCodeCol, ctx.PersonCodeMoein, ctx.PersonCodeTafzili,
            personSharh, personBed, personBes,
            ctx, ct);

        // ═══ ۵. ردیف صندوق ═══
        // Pay: بستانکار (RowNum = max+2)
        // Recv: بدهکار (RowNum = max+1)
        var cashRowNum = isPay ? maxRowNum + 2 : maxRowNum + 1;
        var cashBed = isRecv ? ctx.CashCost : 0m;
        var cashBes = isPay ? ctx.CashCost : 0m;

        var cashSanadId = await InsertSanadRowAsync(conn, tx,
            parentSanadId, noSanad, cashRowNum,
            ctx.CashCodeCol, ctx.CashCodeMoein, 0,
            "", cashBed, cashBes,
            ctx, ct);

        return new ResidSanadResult
        {
            ParentSanadID = parentSanadId,
            NoSanad = noSanad,
            PersonSanadID = personSanadId,
            CashSanadID = cashSanadId
        };
    }

    // ═══ درج ردیف Sanad (با ResidPayID/ResidRecID/ResidNum/CheckType) ═══
    private static async Task<long> InsertSanadRowAsync(
        IDbConnection conn, IDbTransaction tx,
        long parentSanadId, int noSanad, int rowNum,
        int codeCol, int codeMoein, int codeTafzil,
        string otherSharh, decimal mabBed, decimal mabBes,
        ResidSanadContext ctx, CancellationToken ct)
    {
        var isPay = ctx.CheckKind == 0;

        const string sql = @"
            INSERT INTO Sanad
                (NO_Sanad, ParentSanadCode, RowNum,
                 Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Tafzili2ID,
                 Code_Sharh, OtherSharh,
                 Mab_Bed, Mab_Bes, Meghdar,
                 TikRow,
                 ResidNum, CheckType,
                 ResidPayID, ResidRecID, ResidPayNo, ResidRecNo,
                 DoDate, DoOK,
                 Code_Op, Date_Op, Time_Op)
            OUTPUT INSERTED.SanadID
            VALUES
                (@noSanad, @parentSanadId, @rowNum,
                 @codeCol, @codeMoein, @codeTafzil, 0, 0,
                 0, @otherSharh,
                 @mabBed, @mabBes, 0,
                 0,
                 @residNum, @checkType,
                 @residPayId, @residRecId, @residPayNo, @residRecNo,
                 NULL, 0,
                 @userCode, @today, @time)";

        return await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, new
            {
                noSanad,
                parentSanadId,
                rowNum,
                codeCol,
                codeMoein,
                codeTafzil,
                otherSharh,
                mabBed,
                mabBes,
                residNum = ctx.ResidNumber,
                checkType = ctx.CheckKind,
                residPayId = isPay ? ctx.ResidId : 0,
                residRecId = isPay ? 0 : ctx.ResidId,
                residPayNo = isPay ? ctx.ResidNumber : 0,
                residRecNo = isPay ? 0 : ctx.ResidNumber,
                userCode = ctx.UserCode,
                today = ctx.TodayPersian,
                time = ctx.TimeOp
            }, transaction: tx, cancellationToken: ct));
    }

    // ═══ حذف سند رسید ═══
    public async Task DeleteResidSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        long parentSanadId, CancellationToken ct = default)
    {
        if (parentSanadId <= 0) return;

        // آرشیو
        await conn.ExecuteAsync(new CommandDefinition(@"
            INSERT INTO RecycleSanad
                (NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                 Code_Sharh, OtherSharh, Mab_Bed, Mab_Bes,
                 Code_Op, Date_Op, Time_Op, ResidNum, CheckType)
            SELECT
                NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                Code_Sharh, OtherSharh, Mab_Bed, Mab_Bes,
                Code_Op, Date_Op, Time_Op, ResidNum, CheckType
            FROM Sanad WHERE ParentSanadCode = @id",
            new { id = parentSanadId }, transaction: tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Sanad WHERE ParentSanadCode = @id",
            new { id = parentSanadId }, transaction: tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM ParentSanad WHERE ParentSanadID = @id",
            new { id = parentSanadId }, transaction: tx, cancellationToken: ct));
    }

    // ═══ ConstHesabs.GetCashHesab ═══
    public async Task<(int CodeCol, int CodeMoein)> GetCashHesabAsync(
        IDbConnection conn, IDbTransaction? tx, CancellationToken ct = default)
    {
        // ✅ الان می‌دونم: ConstHesabTypes.Cash = 0
        const string sql = @"
        SELECT TOP 1 H.Code_Col, H.Code_Moein
        FROM ConstHesabs CH
        INNER JOIN Hesab H ON H.HesabID = CH.HesabID
        WHERE CH.Type = @type";

        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(sql, new { type = ConstHesabTypes.Cash },
                transaction: tx, cancellationToken: ct));

        if (row == null)
            throw new InvalidOperationException(
                "برای صدور سند باید ابتدا حساب «صندوق» را در «حساب‌های پیش‌فرض» معرفی کنید");

        return ((int)(decimal)row.Code_Col, (int)(decimal)row.Code_Moein);
    }

    // ═══ نام حساب ═══
    public async Task<string> GetHesabNameAsync(
        IDbConnection conn, IDbTransaction? tx,
        int codeCol, int codeMoein, int codeTafzili,
        CancellationToken ct = default)
    {
        if (codeTafzili > 0)
        {
            var name = await conn.ExecuteScalarAsync<string?>(
                new CommandDefinition(
                    "SELECT TOP 1 Name FROM Hesab WHERE Code_Col = -1 AND Code_Moein = 0 AND Code_Tafzil = @t",
                    new { t = codeTafzili }, transaction: tx, cancellationToken: ct));
            if (!string.IsNullOrEmpty(name)) return name!;
        }
        if (codeCol > 0 && codeMoein > 0)
        {
            var name = await conn.ExecuteScalarAsync<string?>(
                new CommandDefinition(
                    "SELECT TOP 1 Name FROM Hesab WHERE Code_Col = @c AND Code_Moein = @m AND Code_Tafzil = 0",
                    new { c = codeCol, m = codeMoein }, transaction: tx, cancellationToken: ct));
            if (!string.IsNullOrEmpty(name)) return name!;
        }
        return "";
    }

    private static async Task<int> GetNextParentSanadNoAsync(
        IDbConnection conn, IDbTransaction tx, CancellationToken ct)
    {
        var max = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition("SELECT MAX(NO_Sanad) FROM ParentSanad",
                transaction: tx, cancellationToken: ct));
        return (max ?? 0) + 1;
    }
}