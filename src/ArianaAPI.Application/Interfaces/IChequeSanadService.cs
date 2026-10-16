using System.Data;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// سرویس سند خودکار چک‌ها — پرداختی و دریافتی
/// مشابه TreasurySanadService ولی برای چرخه‌ی چهارمرحله‌ای:
///   Create → OK / UnOK / Return
/// 
/// قاعده: این سرویس روی Transaction موجود کار می‌کند.
/// قاعده: اول Cheque درج می‌شود (ID معلوم شود)، بعد سند.
/// </summary>
public interface IChequeSanadService
{
    // ═══════════════════════════════════════════
    //  CREATE (صدور سند اصلی چک)
    // ═══════════════════════════════════════════

    /// <summary>سند چک پرداختی — معادل CreateDetailSanadChequePay</summary>
    Task<ChequeCreateSanadResult> CreateChequePaySanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequePaySanadContext ctx, CancellationToken ct = default);

    /// <summary>سند چک دریافتی — معادل CreateDetailSanadChequeReceive</summary>
    Task<ChequeCreateSanadResult> CreateChequeReceiveSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeReceiveSanadContext ctx, CancellationToken ct = default);

    // ═══════════════════════════════════════════
    //  OK (اعلام وصول / پرداخت)
    // ═══════════════════════════════════════════

    /// <summary>سند اعلام پرداخت چک پرداختی — معادل CreateDetailSanadChequeOKPay</summary>
    Task<ChequeOkSanadResult> CreateChequePayOkSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeOkContext ctx, CancellationToken ct = default);

    /// <summary>سند اعلام وصول چک دریافتی — معادل CreateDetailSanadChequeOKReceive</summary>
    Task<ChequeOkSanadResult> CreateChequeReceiveOkSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeOkContext ctx, CancellationToken ct = default);

    // ═══════════════════════════════════════════
    //  RETURN (برگشت چک)
    // ═══════════════════════════════════════════

    /// <summary>سند برگشت چک پرداختی — معادل CreateDetailSanadChequePayReturn</summary>
    Task<ChequeOkSanadResult> CreateChequePayReturnSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeOkContext ctx, CancellationToken ct = default);

    /// <summary>سند برگشت چک دریافتی — معادل CreateDetailSanadChequeReceiveReturn</summary>
    Task<ChequeOkSanadResult> CreateChequeReceiveReturnSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        ChequeOkContext ctx, CancellationToken ct = default);

    // ═══════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════

    /// <summary>حذف ParentSanad + همه Sanadهای فرزند + آرشیو در RecycleSanad</summary>
    Task DeleteParentSanadAsync(
        IDbConnection conn, IDbTransaction tx,
        long parentSanadId, CancellationToken ct = default);

    /// <summary>حذف ردیف‌های Sanad بر اساس SanadID (برای OK/UnOK/Return)</summary>
    Task DeleteSanadRowsAsync(
        IDbConnection conn, IDbTransaction tx,
        long[] sanadIds, CancellationToken ct = default);

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    /// <summary>حساب صندوق از ConstHesabs (Type=0)</summary>
    Task<(int CodeCol, int CodeMoein)> GetCashHesabAsync(
        IDbConnection conn, IDbTransaction? tx, CancellationToken ct = default);

    /// <summary>حساب بانکی از BankAcc (Code_Col/Moein/Tafzil)</summary>
    Task<(int CodeCol, int CodeMoein, int CodeTafzil, string Shobe, string NoHesab)>
        GetBankAccHesabAsync(
            IDbConnection conn, IDbTransaction? tx,
            long bankAccId, CancellationToken ct = default);

    /// <summary>حساب پیش‌فرض از ConstHesabs با Type دلخواه</summary>
    Task<(int CodeCol, int CodeMoein)> GetConstHesabAsync(
        IDbConnection conn, IDbTransaction? tx,
        int type, CancellationToken ct = default);

    /// <summary>نام حساب (کل/معین/تفصیلی) — ترکیب با " - "</summary>
    Task<string> GetHesabNameAsync(
        IDbConnection conn, IDbTransaction? tx,
        int codeCol, int codeMoein, int codeTafzil,
        CancellationToken ct = default);
}

// ═══════════════════════════════════════════════════════
//  Context — Create چک پرداختی
// ═══════════════════════════════════════════════════════
public class ChequePaySanadContext
{
    public long ChequeId { get; set; }
    public int ResidNumber { get; set; }
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    public decimal CheckMab { get; set; }
    public string CheckSeries { get; set; } = "";
    public string CheckDate { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    // طرف (دریافت‌کننده)
    public int PersonCodeCol { get; set; }
    public int PersonCodeMoein { get; set; }
    public int PersonCodeTafzil { get; set; }
    public string PersonName { get; set; } = "";

    // بانک (حساب پرداخت)
    public int BankCodeCol { get; set; }
    public int BankCodeMoein { get; set; }
    public int BankCodeTafzil { get; set; }
    public string BankName { get; set; } = "";
    public string BankNoHesab { get; set; } = "";

    // ParentSanad
    public long? ExistingParentSanadID { get; set; }
    public int? ExistingNoSanad { get; set; }

    // Context
    public string TimeOp { get; set; } = "";
    public string TodayPersian { get; set; } = "";
    public long UserCode { get; set; }
}

// ═══════════════════════════════════════════════════════
//  Context — Create چک دریافتی
// ═══════════════════════════════════════════════════════
public class ChequeReceiveSanadContext
{
    public long ChequeId { get; set; }
    public int ResidNumber { get; set; }
    public string ResidDate { get; set; } = "";
    public string ResidDes { get; set; } = "";

    public decimal CheckMab { get; set; }
    public string CheckSeries { get; set; } = "";
    public string CheckDate { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    // بانک (مقصد — حساب بانکی خودمان)
    public int BankCodeCol { get; set; }
    public int BankCodeMoein { get; set; }
    public int BankCodeTafzil { get; set; }
    public string BankName { get; set; } = "";
    public string BankBrunch { get; set; } = "";
    public string BankNoHesab { get; set; } = "";

    // طرف (پرداخت‌کننده)
    public int PersonCodeCol { get; set; }
    public int PersonCodeMoein { get; set; }
    public int PersonCodeTafzil { get; set; }
    public string PersonName { get; set; } = "";

    // ParentSanad
    public long? ExistingParentSanadID { get; set; }
    public int? ExistingNoSanad { get; set; }

    public string TimeOp { get; set; } = "";
    public string TodayPersian { get; set; } = "";
    public long UserCode { get; set; }
}
// ═══════════════════════════════════════════════════════
//  Context — OK / UnOK / Return
// ═══════════════════════════════════════════════════════
public class ChequeOkContext
{
    public long ChequeId { get; set; }
    public int ResidNumber { get; set; }
    public decimal CheckMab { get; set; }
    public string CheckSeries { get; set; } = "";
    public string CheckDate { get; set; } = "";
    public string CheckPerson { get; set; } = "";

    // حساب مقصد OK (Code_Col_OK)
    public int OkCodeCol { get; set; }
    public int OkCodeMoein { get; set; }
    public int OkCodeTafzil { get; set; }

    // حساب بانک OK (Code_Col_Pay_OK)
    public int OkBankCodeCol { get; set; }
    public int OkBankCodeMoein { get; set; }
    public int OkBankCodeTafzil { get; set; }

    // ParentSanad OK
    public long? ExistingParentSanadID { get; set; }
    public int? ExistingNoSanad { get; set; }

    // تاریخ
    public string OkDate { get; set; } = "";
    public string UnOkDate { get; set; } = "";

    // ردیف‌های سند قدیمی که باید حذف شوند (SanadIDBed/Bes/UnOk*)
    public long[] SanadIdsToDelete { get; set; } = Array.Empty<long>();

    public string TimeOp { get; set; } = "";
    public string TodayPersian { get; set; } = "";
    public long UserCode { get; set; }
}

// ═══════════════════════════════════════════════════════
//  Result
// ═══════════════════════════════════════════════════════
public class ChequeCreateSanadResult
{
    public long ParentSanadID { get; set; }
    public int NoSanad { get; set; }
    public long SanadIdPerson { get; set; }
    public long SanadIdBank { get; set; }
}

public class ChequeOkSanadResult
{
    public long ParentSanadID { get; set; }
    public int NoSanad { get; set; }
    public long SanadIdBed { get; set; }
    public long SanadIdBes { get; set; }
}