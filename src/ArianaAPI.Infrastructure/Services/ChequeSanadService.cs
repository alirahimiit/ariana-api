using System.Data;
using ArianaAPI.Application.Interfaces;
using Dapper;

namespace ArianaAPI.Infrastructure.Services;

/// <summary>
/// سند خودکار چک‌ها (پرداختی + دریافتی) — معادل:
///   • TChequePay.CreateParentSanadChequePay + CreateDetailSanadChequePay
///   • TChequePay.CreateParentSanadChequeOKPay + CreateDetailSanadChequeOKPay
///   • TChequePay.CreateParentSanadChequePayReturn + CreateDetailSanadChequePayReturn
///   • TChequeReceive.* (مشابه)
/// 
/// قاعده:
///   1. سند همیشه Vazeit = 0 (پیش‌نویس)
///   2. سند فقط روی یک Transaction موجود ساخته می‌شود
///   3. اول Cheque درج می‌شود (ID معلوم)، بعد سند
/// </summary>
public class ChequeSanadService : IChequeSanadService
{
    // ═══════════════════════════════════════════════════════════════
    //  ۱. CREATE — چک پرداختی
    //     Row 1 (max+1): طرف (دریافت‌کننده) — Bed
    //     Row 2 (max+2): بانک (حساب پرداخت) — Bes
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeCreateSanadResult> CreateChequePaySanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequePaySanadContext ctx, CancellationToken ct = default)
    {
        if (ctx.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");
        if (ctx.ChequeId <= 0)
            throw new InvalidOperationException("شناسه چک نامعتبر است (باید اول چک درج شود)");

        var (parentSanadId, noSanad) = await EnsureParentSanadAsync(
            conn, tx,
            ctx.ExistingParentSanadID, ctx.ExistingNoSanad,
            ctx.ResidDate,
            "پرداخت چک از",
            ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var maxRowNum = await GetMaxRowNumAsync(conn, tx, parentSanadId, ct);

        // ─── ردیف طرف (بدهکار) ───
        var personSharh = $"پرداخت چک به {ctx.CheckPerson} " +
                          $"سریال {ctx.CheckSeries} تاریخ {ctx.CheckDate} " +
                          $"بانک {ctx.BankName} {ctx.BankNoHesab}";
        if (!string.IsNullOrWhiteSpace(ctx.ResidDes))
            personSharh += $" شرح {ctx.ResidDes}";

        var sanadIdPerson = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 1,
            ctx.PersonCodeCol, ctx.PersonCodeMoein, ctx.PersonCodeTafzil,
            personSharh, ctx.CheckMab, 0m,
            chequePayId: ctx.ChequeId,
            chequePayNo: ctx.CheckSeries,
            chequeRecId: 0, chequeRecNo: "",
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        // ─── ردیف بانک (بستانکار) ───
        var bankSanadId = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 2,
            ctx.BankCodeCol, ctx.BankCodeMoein, ctx.BankCodeTafzil,
            "", 0m, ctx.CheckMab,
            chequePayId: ctx.ChequeId,
            chequePayNo: ctx.CheckSeries,
            chequeRecId: 0, chequeRecNo: "",
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        return new ChequeCreateSanadResult
        {
            ParentSanadID = parentSanadId,
            NoSanad = noSanad,
            SanadIdPerson = sanadIdPerson,
            SanadIdBank = bankSanadId
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  ۲. CREATE — چک دریافتی
    //     Row 1 (max+1): بانک (حساب دریافت) — Bed   ← معکوس
    //     Row 2 (max+2): طرف (پرداخت‌کننده) — Bes   ← معکوس
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeCreateSanadResult> CreateChequeReceiveSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeReceiveSanadContext ctx, CancellationToken ct = default)
    {
        if (ctx.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");
        if (ctx.ChequeId <= 0)
            throw new InvalidOperationException("شناسه چک نامعتبر است (باید اول چک درج شود)");

        var (parentSanadId, noSanad) = await EnsureParentSanadAsync(
            conn, tx,
            ctx.ExistingParentSanadID, ctx.ExistingNoSanad,
            ctx.ResidDate,
            "دریافت چک از",
            ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var maxRowNum = await GetMaxRowNumAsync(conn, tx, parentSanadId, ct);

        // ─── ردیف بانک (بدهکار) ───
        var bankSharh = $"دریافت چک سریال {ctx.CheckSeries} " +
                        $"تاریخ {ctx.CheckDate} بانک {ctx.BankName} " +
                        $"شعبه {ctx.BankBrunch}";

        var sanadIdBank = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 1,
            ctx.BankCodeCol, ctx.BankCodeMoein, ctx.BankCodeTafzil,
            bankSharh, ctx.CheckMab, 0m,
            chequePayId: 0, chequePayNo: "",
            chequeRecId: ctx.ChequeId,
            chequeRecNo: ctx.CheckSeries,
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        // ─── ردیف طرف (بستانکار) ───
        var personSharh = $"دریافت چک از {ctx.PersonName}";
        if (!string.IsNullOrWhiteSpace(ctx.ResidDes))
            personSharh += $" شرح {ctx.ResidDes}";

        var sanadIdPerson = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 2,
            ctx.PersonCodeCol, ctx.PersonCodeMoein, ctx.PersonCodeTafzil,
            personSharh, 0m, ctx.CheckMab,
            chequePayId: 0, chequePayNo: "",
            chequeRecId: ctx.ChequeId,
            chequeRecNo: ctx.CheckSeries,
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        return new ChequeCreateSanadResult
        {
            ParentSanadID = parentSanadId,
            NoSanad = noSanad,
            SanadIdPerson = sanadIdPerson,
            SanadIdBank = sanadIdBank
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  ۳. OK — چک پرداختی
    //     Row 1 (max+1): Code_Col_OK — Bed
    //     Row 2 (max+2): Code_Col_Pay_OK — Bes
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeOkSanadResult> CreateChequePayOkSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeOkContext ctx, CancellationToken ct = default)
    {
        if (ctx.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");

        var (parentSanadId, noSanad) = await EnsureParentSanadAsync(
            conn, tx,
            ctx.ExistingParentSanadID, ctx.ExistingNoSanad,
            ctx.OkDate,
            "اعلام چک های پرداختی",
            ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var maxRowNum = await GetMaxRowNumAsync(conn, tx, parentSanadId, ct);

        var sharhOk = $"وصول چک به سریال {ctx.CheckSeries} " +
                      $"تاریخ {ctx.CheckDate} در وجه {ctx.CheckPerson}";

        // ─── ردیف Code_Col_OK (بدهکار) ───
        var sanadIdBed = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 1,
            ctx.OkCodeCol, ctx.OkCodeMoein, ctx.OkCodeTafzil,
            sharhOk, ctx.CheckMab, 0m,
            chequePayId: ctx.ChequeId, chequePayNo: ctx.CheckSeries,
            chequeRecId: 0, chequeRecNo: "",
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        // ─── ردیف Code_Col_Pay_OK (بستانکار) ───
        var sanadIdBes = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 2,
            ctx.OkBankCodeCol, ctx.OkBankCodeMoein, ctx.OkBankCodeTafzil,
            "", 0m, ctx.CheckMab,
            chequePayId: ctx.ChequeId, chequePayNo: ctx.CheckSeries,
            chequeRecId: 0, chequeRecNo: "",
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        return new ChequeOkSanadResult
        {
            ParentSanadID = parentSanadId,
            NoSanad = noSanad,
            SanadIdBed = sanadIdBed,
            SanadIdBes = sanadIdBes
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  ۴. OK — چک دریافتی
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeOkSanadResult> CreateChequeReceiveOkSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeOkContext ctx, CancellationToken ct = default)
    {
        if (ctx.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");

        var (parentSanadId, noSanad) = await EnsureParentSanadAsync(
            conn, tx,
            ctx.ExistingParentSanadID, ctx.ExistingNoSanad,
            ctx.OkDate,
            "اعلام چک های دریافتی",
            ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var maxRowNum = await GetMaxRowNumAsync(conn, tx, parentSanadId, ct);

        var sharhOk = $"وصول چک از سریال {ctx.CheckSeries} " +
                      $"تاریخ {ctx.CheckDate} در وجه {ctx.CheckPerson}";

        var sanadIdBed = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 1,
            ctx.OkCodeCol, ctx.OkCodeMoein, ctx.OkCodeTafzil,
            sharhOk, ctx.CheckMab, 0m,
            chequePayId: 0, chequePayNo: "",
            chequeRecId: ctx.ChequeId, chequeRecNo: ctx.CheckSeries,
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var sanadIdBes = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 2,
            ctx.OkBankCodeCol, ctx.OkBankCodeMoein, ctx.OkBankCodeTafzil,
            "", 0m, ctx.CheckMab,
            chequePayId: 0, chequePayNo: "",
            chequeRecId: ctx.ChequeId, chequeRecNo: ctx.CheckSeries,
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        return new ChequeOkSanadResult
        {
            ParentSanadID = parentSanadId,
            NoSanad = noSanad,
            SanadIdBed = sanadIdBed,
            SanadIdBes = sanadIdBes
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  ۵. RETURN — چک پرداختی
    //     Row 1 (max+1): Code_Col_OK — Bed
    //     Row 2 (max+2): Code_Col_Pay_OK — Bes
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeOkSanadResult> CreateChequePayReturnSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeOkContext ctx, CancellationToken ct = default)
    {
        if (ctx.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");

        var (parentSanadId, noSanad) = await EnsureParentSanadAsync(
            conn, tx,
            ctx.ExistingParentSanadID, ctx.ExistingNoSanad,
            ctx.UnOkDate,
            "اعلام برگشت چک های پرداختی",
            ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var maxRowNum = await GetMaxRowNumAsync(conn, tx, parentSanadId, ct);

        var sharhReturn = $"اعلام برگشت چک به سریال {ctx.CheckSeries} " +
                          $"تاریخ برگشت {ctx.UnOkDate} در وجه {ctx.CheckPerson}";

        var sanadIdBed = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 1,
            ctx.OkCodeCol, ctx.OkCodeMoein, ctx.OkCodeTafzil,
            sharhReturn, ctx.CheckMab, 0m,
            chequePayId: ctx.ChequeId, chequePayNo: ctx.CheckSeries,
            chequeRecId: 0, chequeRecNo: "",
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var sanadIdBes = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 2,
            ctx.OkBankCodeCol, ctx.OkBankCodeMoein, ctx.OkBankCodeTafzil,
            "", 0m, ctx.CheckMab,
            chequePayId: ctx.ChequeId, chequePayNo: ctx.CheckSeries,
            chequeRecId: 0, chequeRecNo: "",
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        return new ChequeOkSanadResult
        {
            ParentSanadID = parentSanadId,
            NoSanad = noSanad,
            SanadIdBed = sanadIdBed,
            SanadIdBes = sanadIdBes
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  ۶. RETURN — چک دریافتی
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeOkSanadResult> CreateChequeReceiveReturnSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeOkContext ctx, CancellationToken ct = default)
    {
        if (ctx.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");

        var (parentSanadId, noSanad) = await EnsureParentSanadAsync(
            conn, tx,
            ctx.ExistingParentSanadID, ctx.ExistingNoSanad,
            ctx.UnOkDate,
            "اعلام برگشت چک های دریافتی",
            ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var maxRowNum = await GetMaxRowNumAsync(conn, tx, parentSanadId, ct);

        var sharhReturn = $"اعلام برگشت چک از سریال {ctx.CheckSeries} " +
                          $"تاریخ برگشت {ctx.UnOkDate} در وجه {ctx.CheckPerson}";

        var sanadIdBed = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 1,
            ctx.OkCodeCol, ctx.OkCodeMoein, ctx.OkCodeTafzil,
            sharhReturn, ctx.CheckMab, 0m,
            chequePayId: 0, chequePayNo: "",
            chequeRecId: ctx.ChequeId, chequeRecNo: ctx.CheckSeries,
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var sanadIdBes = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 2,
            ctx.OkBankCodeCol, ctx.OkBankCodeMoein, ctx.OkBankCodeTafzil,
            "", 0m, ctx.CheckMab,
            chequePayId: 0, chequePayNo: "",
            chequeRecId: ctx.ChequeId, chequeRecNo: ctx.CheckSeries,
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        return new ChequeOkSanadResult
        {
            ParentSanadID = parentSanadId,
            NoSanad = noSanad,
            SanadIdBed = sanadIdBed,
            SanadIdBes = sanadIdBes
        };
    }


    // ═══════════════════════════════════════════════════════════════
    //  ۷. CREATE — خرج چک دریافتی
    //     Row 1 (max+1): شخص — Bed
    //     Row 2 (max+2): اسناد دریافتنی — Bes
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeOkSanadResult> CreateChequeExpendSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeExpendSanadContext ctx, CancellationToken ct = default)
    {
        if (ctx.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");
        if (ctx.ChequeExpendId <= 0)
            throw new InvalidOperationException("شناسه خرج چک نامعتبر است (باید اول چک درج شود)");

        // ─── انتخاب شرح ParentSanad ───
        var parentSharh = ctx.WasDuring == 1
            ? "چک در جریان وصول"
            : "خرج چک";

        var (parentSanadId, noSanad) = await EnsureParentSanadAsync(
            conn, tx,
            ctx.ExistingParentSanadID, ctx.ExistingNoSanad,
            ctx.ResidDate,
            parentSharh,
            ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        var maxRowNum = await GetMaxRowNumAsync(conn, tx, parentSanadId, ct);

        // ─── ردیف شخص (بدهکار) ───
        var personSharh = $"خرج چک به {ctx.PersonName} " +
                          $"به شماره سریال {ctx.CheckSeries} " +
                          $"به تاریخ {ctx.CheckDate}";
        if (!string.IsNullOrWhiteSpace(ctx.ResidDes))
            personSharh += $" شرح {ctx.ResidDes}";

        var sanadIdBed = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 1,
            ctx.PersonCodeCol, ctx.PersonCodeMoein, ctx.PersonCodeTafzil,
            personSharh, ctx.CheckMab, 0m,
            chequePayId: 0, chequePayNo: "",
            chequeRecId: 0, chequeRecNo: "",
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        // ─── ردیف اسناد دریافتنی (بستانکار) ───
        var sanadIdBes = await InsertChequeRowAsync(
            conn, tx, parentSanadId, noSanad, maxRowNum + 2,
            ctx.ReceivableCodeCol, ctx.ReceivableCodeMoein, ctx.ReceivableCodeTafzil,
            "", 0m, ctx.CheckMab,
            chequePayId: 0, chequePayNo: "",
            chequeRecId: 0, chequeRecNo: "",
            residNumber: ctx.ResidNumber,
            ctx: ctx.TimeOp, ctx.TodayPersian, ctx.UserCode, ct);

        return new ChequeOkSanadResult
        {
            ParentSanadID = parentSanadId,
            NoSanad = noSanad,
            SanadIdBed = sanadIdBed,
            SanadIdBes = sanadIdBes
        };
    }
    // ═══════════════════════════════════════════════════════════════
    //  DELETE — حذف کامل ParentSanad + فرزندان
    // ═══════════════════════════════════════════════════════════════
    public async Task DeleteParentSanadAsync(
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

    // ═══════════════════════════════════════════════════════════════
    //  DELETE — حذف ردیف‌های خاص Sanad (برای OK/UnOK/Return)
    // ═══════════════════════════════════════════════════════════════
    public async Task DeleteSanadRowsAsync(
        IDbConnection conn, IDbTransaction tx,
        long[] sanadIds, CancellationToken ct = default)
    {
        if (sanadIds == null || sanadIds.Length == 0) return;

        var ids = sanadIds.Where(x => x > 0).Distinct().ToArray();
        if (ids.Length == 0) return;

        const string sql = "DELETE FROM Sanad WHERE SanadID IN @ids";
        await conn.ExecuteAsync(new CommandDefinition(
            sql, new { ids }, transaction: tx, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPERS — حساب‌ها
    // ═══════════════════════════════════════════════════════════════
    public async Task<(int CodeCol, int CodeMoein)> GetCashHesabAsync(
        IDbConnection conn, IDbTransaction? tx, CancellationToken ct = default)
    {
        // ConstHesabTypes.Cash = 0
        const string sql = @"
            SELECT TOP 1 H.Code_Col, H.Code_Moein
            FROM ConstHesabs CH
            INNER JOIN Hesab H ON H.HesabID = CH.HesabID
            WHERE CH.Type = @type";

        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(sql, new { type = 0 },
                transaction: tx, cancellationToken: ct));

        if (row == null)
            throw new InvalidOperationException(
                "برای صدور سند باید ابتدا حساب «صندوق» را در «حساب‌های پیش‌فرض» معرفی کنید");

        return ((int)(decimal)row.Code_Col, (int)(decimal)row.Code_Moein);
    }

    public async Task<(int CodeCol, int CodeMoein, int CodeTafzil, string Shobe, string NoHesab)>
        GetBankAccHesabAsync(
            IDbConnection conn, IDbTransaction? tx,
            long bankAccId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1 
                ISNULL(Code_Col, 0)    AS CodeCol,
                ISNULL(Code_Moein, 0)  AS CodeMoein,
                ISNULL(Code_Tafzil, 0) AS CodeTafzil,
                ISNULL(Shobe, '')      AS Shobe,
                ISNULL(NoHesab, '')    AS NoHesab
            FROM BankAcc
            WHERE ID = @id";

        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(sql, new { id = bankAccId },
                transaction: tx, cancellationToken: ct));

        if (row == null)
            throw new InvalidOperationException("حساب بانکی یافت نشد");

        return (
            (int)(decimal)row.CodeCol,
            (int)(decimal)row.CodeMoein,
            (int)(decimal)row.CodeTafzil,
            (string)(row.Shobe ?? ""),
            (string)(row.NoHesab ?? "")
        );
    }

    public async Task<(int CodeCol, int CodeMoein)> GetConstHesabAsync(
        IDbConnection conn, IDbTransaction? tx,
        int type, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1 H.Code_Col, H.Code_Moein
            FROM ConstHesabs CH
            INNER JOIN Hesab H ON H.HesabID = CH.HesabID
            WHERE CH.Type = @type";

        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(sql, new { type },
                transaction: tx, cancellationToken: ct));

        if (row == null)
            throw new InvalidOperationException(
                $"حساب پیش‌فرض با Type={type} تعریف نشده است");

        return ((int)(decimal)row.Code_Col, (int)(decimal)row.Code_Moein);
    }

    public async Task<string> GetHesabNameAsync(
        IDbConnection conn, IDbTransaction? tx,
        int codeCol, int codeMoein, int codeTafzil,
        CancellationToken ct = default)
    {
        var parts = new List<string>();

        // کل
        if (codeCol > 0)
        {
            var colName = await conn.ExecuteScalarAsync<string?>(
                new CommandDefinition(
                    "SELECT TOP 1 Name FROM Hesab WHERE Code_Col = @c AND ISNULL(Code_Moein,0) = 0 AND ISNULL(Code_Tafzil,0) = 0",
                    new { c = codeCol }, transaction: tx, cancellationToken: ct));
            if (!string.IsNullOrEmpty(colName)) parts.Add(colName!);
        }

        // معین
        if (codeCol > 0 && codeMoein > 0)
        {
            var moeinName = await conn.ExecuteScalarAsync<string?>(
                new CommandDefinition(
                    "SELECT TOP 1 Name FROM Hesab WHERE Code_Col = @c AND Code_Moein = @m AND ISNULL(Code_Tafzil,0) = 0",
                    new { c = codeCol, m = codeMoein }, transaction: tx, cancellationToken: ct));
            if (!string.IsNullOrEmpty(moeinName)) parts.Add(moeinName!);
        }

        // تفضیلی (مستقل)
        if (codeTafzil > 0)
        {
            var tafzilName = await conn.ExecuteScalarAsync<string?>(
                new CommandDefinition(
                    "SELECT TOP 1 Name FROM Hesab WHERE Code_Col = -1 AND ISNULL(Code_Moein,0) = 0 AND Code_Tafzil = @t",
                    new { t = codeTafzil }, transaction: tx, cancellationToken: ct));
            if (!string.IsNullOrEmpty(tafzilName)) parts.Add(tafzilName!);
        }

        return parts.Count > 0 ? string.Join(" - ", parts) : "";
    }

    // ═══════════════════════════════════════════════════════════════
    //  PRIVATE — ParentSanad
    // ═══════════════════════════════════════════════════════════════
    private static async Task<(long ParentSanadID, int NoSanad)> EnsureParentSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        long? existingParentSanadId,
        int? existingNoSanad,
        string dateIn,
        string sharh,
        string timeOp, string today, long userCode,
        CancellationToken ct)
    {
        // ─── استفاده از ParentSanad موجود ───
        if (existingParentSanadId is > 0)
        {
            var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(
                    "SELECT ParentSanadID, NO_Sanad, Vazeit FROM ParentSanad WHERE ParentSanadID = @id",
                    new { id = existingParentSanadId.Value },
                    transaction: tx, cancellationToken: ct));

            if (existing == null)
                throw new InvalidOperationException("سند انتخاب‌شده یافت نشد");
            if ((int)(decimal)existing.Vazeit == 2)
                throw new InvalidOperationException("سند انتخاب‌شده قطعی است و قابل استفاده نیست");

            return (
                existingParentSanadId.Value,
                (int)(decimal)existing.NO_Sanad
            );
        }

        // ─── شماره سند ───
        int noSanad;
        if (existingNoSanad.HasValue && existingNoSanad.Value > 0)
            noSanad = existingNoSanad.Value;
        else
            noSanad = await GetNextParentSanadNoAsync(conn, tx, ct);

        // ─── درج ParentSanad جدید (Vazeit = 0 پیش‌نویس) ───
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
                 0, 0,
                 0, 0, 0, 0,
                 @userCode, 0, 0, 0, 0,
                 @userCode, @today, @time)";

        var newId = await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(insertParent, new
            {
                noSanad,
                dateIn = dateIn ?? "",
                sharh,
                userCode,
                today,
                time = timeOp
            }, transaction: tx, cancellationToken: ct));

        return (newId, noSanad);
    }

    private static async Task<int> GetNextParentSanadNoAsync(
        IDbConnection conn, IDbTransaction tx, CancellationToken ct)
    {
        var max = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition("SELECT MAX(NO_Sanad) FROM ParentSanad",
                transaction: tx, cancellationToken: ct));
        return (max ?? 0) + 1;
    }

    private static async Task<int> GetMaxRowNumAsync(
        IDbConnection conn, IDbTransaction tx,
        long parentSanadId, CancellationToken ct)
    {
        var max = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition(
                "SELECT MAX(RowNum) FROM Sanad WHERE ParentSanadCode = @id",
                new { id = parentSanadId },
                transaction: tx, cancellationToken: ct));
        return max ?? 0;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PRIVATE — Insert Sanad Row
    // ═══════════════════════════════════════════════════════════════
    private static async Task<long> InsertChequeRowAsync(
        IDbConnection conn, IDbTransaction tx,
        long parentSanadId, int noSanad, int rowNum,
        int codeCol, int codeMoein, int codeTafzil,
        string otherSharh,
        decimal mabBed, decimal mabBes,
        long chequePayId, string chequePayNo,
        long chequeRecId, string chequeRecNo,
        int residNumber,
        string ctx, string today, long userCode,
        CancellationToken ct)
    {
        const string sql = @"
            INSERT INTO Sanad
                (NO_Sanad, ParentSanadCode, RowNum,
                 Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Tafzili2ID,
                 Code_Sharh, OtherSharh,
                 Mab_Bed, Mab_Bes, Meghdar,
                 TikRow,
                 ResidNum, CheckType,
                 ChequePayID, ChequePayNo, ChequeRecID, ChequeRecNo,
                 DoDate, DoOK,
                 Code_Op, Date_Op, Time_Op)
            OUTPUT INSERTED.SanadID
            VALUES
                (@noSanad, @parentSanadId, @rowNum,
                 @codeCol, @codeMoein, @codeTafzil, 0, 0,
                 0, @otherSharh,
                 @mabBed, @mabBes, 0,
                 0,
                 @residNum, 0,
                 @chequePayId, @chequePayNo, @chequeRecId, @chequeRecNo,
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
                otherSharh = otherSharh ?? "",
                mabBed,
                mabBes,
                residNum = residNumber,
                chequePayId,
                chequePayNo = chequePayNo ?? "",
                chequeRecId,
                chequeRecNo = chequeRecNo ?? "",
                userCode,
                today,
                time = ctx
            }, transaction: tx, cancellationToken: ct));
    }
}