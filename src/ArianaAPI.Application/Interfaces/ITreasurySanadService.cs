using System.Data;

namespace ArianaAPI.Application.Interfaces;

/// <summary>
/// سرویس ساخت/حذف سند خودکار برای رسیدهای نقدی و چک‌ها.
/// این سرویس روی یک Transaction موجود کار می‌کند.
/// </summary>
public interface ITreasurySanadService
{
    Task<ResidSanadResult> CreateResidSanadAsync(
        IDbConnection conn,
        IDbTransaction tx,
        ResidSanadContext ctx,
        CancellationToken ct = default);

    /// <summary>
    /// حذف سند رسید — فقط ردیف‌های مربوط به این رسید (SanadCashID و SanadPersonID).
    /// اگه ParentSanad دیگه ردیفی نداره، خودش هم حذف می‌شه.
    /// </summary>
    Task DeleteResidSanadAsync(
        IDbConnection conn,
        IDbTransaction tx,
        long parentSanadId,
        long? sanadCashId,
        long? sanadPersonId,
        CancellationToken ct = default);

    Task<(int CodeCol, int CodeMoein)> GetCashHesabAsync(
        IDbConnection conn,
        IDbTransaction? tx,
        CancellationToken ct = default);

    Task<string> GetHesabNameAsync(
        IDbConnection conn,
        IDbTransaction? tx,
        int codeCol, int codeMoein, int codeTafzili,
        CancellationToken ct = default);
}

public class ResidSanadContext
{
    /// <summary>1=پرداخت، 2=دریافت</summary>
    public int CheckKind { get; set; }

    /// <summary>شناسه رسید (بعد از Insert)</summary>
    public long ResidId { get; set; }

    public int ResidNumber { get; set; }
    public string DateIn { get; set; } = "";
    public decimal CashCost { get; set; }
    public string Descript { get; set; } = "";

    public int PersonCodeCol { get; set; }
    public int PersonCodeMoein { get; set; }
    public int PersonCodeTafzili { get; set; }
    public string PersonName { get; set; } = "";

    public int CashCodeCol { get; set; }
    public int CashCodeMoein { get; set; }

    /// <summary>اگر null → ParentSanad جدید ساخته می‌شود</summary>
    public long? ExistingParentSanadID { get; set; }

    /// <summary>شماره سند دلخواه (0 = خودکار)</summary>
    public int? ExistingNoSanad { get; set; }

    public string TimeOp { get; set; } = "";
    public string TodayPersian { get; set; } = "";
    public long UserCode { get; set; }
}

public class ResidSanadResult
{
    public long ParentSanadID { get; set; }
    public int NoSanad { get; set; }
    public long PersonSanadID { get; set; }
    public long CashSanadID { get; set; }
}