using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using System.Data;
using System.Globalization;

namespace ArianaAPI.Infrastructure.Repositories;

public class SanadRenumberRepository : ISanadRenumberRepository
{
    private readonly ITenantConnectionFactory _factory;

    public SanadRenumberRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    private static string GetTodayPersian()
    {
        var pc = new PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }

    private static string GetCurrentTime() => DateTime.Now.ToString("HH:mm:ss");

    // ═══════════════════════════════════════════════════════════
    //  PREVIEW — اسناد
    // ═══════════════════════════════════════════════════════════
    public async Task<RenumberPreviewResult> PreviewSanadAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        // ─── چک ایمنی ───
        var blockedCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM ParentSanad WHERE ISNULL(Vazeit, 0) <> 0",
                cancellationToken: ct));

        var result = new RenumberPreviewResult();

        if (blockedCount > 0)
        {
            result.IsAllowed = false;
            result.BlockReason =
                $"{blockedCount} سند در وضعیت رسیدگی یا قطعی هستند. ابتدا همه را به پیش‌نویس تغییر دهید.";

            var blockItems = await conn.QueryAsync<RenumberBlockItem>(
                new CommandDefinition(@"
                    SELECT TOP 10
                        ParentSanadID AS Id,
                        CAST(NO_Sanad AS int) AS No,
                        CAST(Vazeit AS int) AS Vazeit,
                        Date_IN AS Date,
                        OtherParentSharh AS Sharh
                    FROM ParentSanad
                    WHERE ISNULL(Vazeit, 0) <> 0
                    ORDER BY Date_IN, ParentSanadID",
                    cancellationToken: ct));
            result.BlockItems = blockItems.ToList();
            return result;
        }

        // ─── Preview ───
        var rows = await conn.QueryAsync<RenumberRow>(
            new CommandDefinition(@"
                SELECT
                    P.ParentSanadID AS Id,
                    CAST(P.NO_Sanad AS int) AS OldNo,
                    CAST(ROW_NUMBER() OVER (ORDER BY P.Date_IN, P.ParentSanadID) AS int) AS NewNo,
                    P.Date_IN AS Date,
                    P.OtherParentSharh AS Sharh,
                    ISNULL(S.ItemCount, 0) AS ItemCount,
                    CAST(P.Vazeit AS int) AS Vazeit
                FROM ParentSanad P
                LEFT JOIN (
                    SELECT ParentSanadCode, COUNT(*) AS ItemCount
                    FROM Sanad
                    GROUP BY ParentSanadCode
                ) S ON S.ParentSanadCode = P.ParentSanadID
                ORDER BY P.Date_IN, P.ParentSanadID",
                cancellationToken: ct));

        var list = rows.ToList();
        result.Rows = list;
        result.TotalCount = list.Count;
        result.ChangedCount = list.Count(r => r.OldNo != r.NewNo);

        var oldNos = list.Where(r => r.OldNo.HasValue).Select(r => r.OldNo!.Value).ToList();
        if (oldNos.Count > 0) { result.OldMinNo = oldNos.Min(); result.OldMaxNo = oldNos.Max(); }
        var newNos = list.Where(r => r.NewNo.HasValue).Select(r => r.NewNo!.Value).ToList();
        if (newNos.Count > 0) { result.NewMinNo = newNos.Min(); result.NewMaxNo = newNos.Max(); }

        result.IsAllowed = true;
        return result;
    }

    // ═══════════════════════════════════════════════════════════
    //  COMMIT — اسناد
    // ═══════════════════════════════════════════════════════════
    public async Task<RenumberCommitResult> CommitSanadAsync(
        long orgId, long fyId, long userCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── ۱. قفل + چک ایمنی ───
            var blockedCount = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM ParentSanad WITH (TABLOCKX) WHERE ISNULL(Vazeit, 0) <> 0",
                    transaction: tx, cancellationToken: ct));

            if (blockedCount > 0)
            {
                tx.Rollback();
                throw new InvalidOperationException(
                    $"{blockedCount} سند در وضعیت رسیدگی یا قطعی هستند. ابتدا همه را به پیش‌نویس تغییر دهید.");
            }

            // ─── ۲. Audit قبل ───
            await conn.ExecuteAsync(
                new CommandDefinition(@"
                    IF OBJECT_ID('tempdb..#RenumberAudit') IS NOT NULL DROP TABLE #RenumberAudit;
                    CREATE TABLE #RenumberAudit (Id bigint PRIMARY KEY, OldNo int NULL, NewNo int NULL);
                    INSERT INTO #RenumberAudit (Id, OldNo)
                    SELECT ParentSanadID, CAST(NO_Sanad AS int) FROM ParentSanad;",
                    transaction: tx, cancellationToken: ct));

            // ─── ۳. فاز ۱: پارک (توسط ID منفی — همیشه یکتا) ───
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "UPDATE ParentSanad SET NO_Sanad = -ParentSanadID",
                    transaction: tx, cancellationToken: ct));

            // ─── ۴. فاز ۲: رِنِمبر بر اساس Date_IN, ParentSanadID ───
            await conn.ExecuteAsync(
                new CommandDefinition(@"
                    UPDATE P
                    SET NO_Sanad = N.NewNo
                    FROM ParentSanad P
                    INNER JOIN (
                        SELECT ParentSanadID,
                               ROW_NUMBER() OVER (ORDER BY Date_IN, ParentSanadID) AS NewNo
                        FROM ParentSanad
                    ) N ON P.ParentSanadID = N.ParentSanadID;",
                    transaction: tx, cancellationToken: ct));

            // ─── ۵. sync جدول فرزند ───
            var itemsAffected = await conn.ExecuteAsync(
                new CommandDefinition(@"
                    UPDATE S
                    SET NO_Sanad = P.NO_Sanad
                    FROM Sanad S
                    INNER JOIN ParentSanad P ON S.ParentSanadCode = P.ParentSanadID;",
                    transaction: tx, cancellationToken: ct));

            // ─── ۶. Audit بعد ───
            await conn.ExecuteAsync(
                new CommandDefinition(@"
                    UPDATE A
                    SET NewNo = CAST(P.NO_Sanad AS int)
                    FROM #RenumberAudit A
                    INNER JOIN ParentSanad P ON A.Id = P.ParentSanadID;",
                    transaction: tx, cancellationToken: ct));

            // ─── ۷. خواندن Audit برای پاسخ ───
            var rows = await conn.QueryAsync<RenumberRow>(
                new CommandDefinition(@"
                    SELECT
                        A.Id,
                        A.OldNo,
                        A.NewNo,
                        P.Date_IN AS Date,
                        P.OtherParentSharh AS Sharh,
                        ISNULL(S.ItemCount, 0) AS ItemCount,
                        CAST(P.Vazeit AS int) AS Vazeit
                    FROM #RenumberAudit A
                    INNER JOIN ParentSanad P ON P.ParentSanadID = A.Id
                    LEFT JOIN (
                        SELECT ParentSanadCode, COUNT(*) AS ItemCount
                        FROM Sanad
                        GROUP BY ParentSanadCode
                    ) S ON S.ParentSanadCode = A.Id
                    ORDER BY A.NewNo;",
                    transaction: tx, cancellationToken: ct));

            tx.Commit();

            return new RenumberCommitResult
            {
                ProcessedCount = rows.Count(),
                AffectedItemsCount = itemsAffected,
                Rows = rows.ToList()
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  PREVIEW — فاکتور (per FactorKind: 0,1,2,3)
    // ═══════════════════════════════════════════════════════════
    public async Task<RenumberPreviewResult> PreviewFactorAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var rows = await conn.QueryAsync<RenumberRow>(
            new CommandDefinition(@"
                SELECT
                    F.ID AS Id,
                    CAST(F.FactorKind AS int) AS Kind,
                    CAST(F.NoFactor AS int) AS OldNo,
                    CAST(ROW_NUMBER() OVER (PARTITION BY F.FactorKind ORDER BY F.Date_In, F.ID) AS int) AS NewNo,
                    F.Date_In AS Date,
                    F.Descript AS Sharh,
                    ISNULL(D.ItemCount, 0) AS ItemCount
                FROM FactorParent F
                LEFT JOIN (
                    SELECT FactorID, COUNT(*) AS ItemCount
                    FROM FactorDetail
                    GROUP BY FactorID
                ) D ON D.FactorID = F.ID
                WHERE F.FactorKind IN (0, 1, 2, 3)
                ORDER BY F.FactorKind, F.Date_In, F.ID",
                cancellationToken: ct));

        var list = rows.ToList();
        var result = new RenumberPreviewResult
        {
            IsAllowed = true,
            Rows = list,
            TotalCount = list.Count,
            ChangedCount = list.Count(r => r.OldNo != r.NewNo)
        };

        var oldNos = list.Where(r => r.OldNo.HasValue).Select(r => r.OldNo!.Value).ToList();
        if (oldNos.Count > 0) { result.OldMinNo = oldNos.Min(); result.OldMaxNo = oldNos.Max(); }
        var newNos = list.Where(r => r.NewNo.HasValue).Select(r => r.NewNo!.Value).ToList();
        if (newNos.Count > 0) { result.NewMinNo = newNos.Min(); result.NewMaxNo = newNos.Max(); }

        return result;
    }

    // ═══════════════════════════════════════════════════════════
    //  COMMIT — فاکتور (per FactorKind: 0,1,2,3)
    // ═══════════════════════════════════════════════════════════
    public async Task<RenumberCommitResult> CommitFactorAsync(
        long orgId, long fyId, long userCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── ۱. قفل + Audit قبل ───
            await conn.ExecuteAsync(
                new CommandDefinition(@"
                    IF OBJECT_ID('tempdb..#RenumberAuditF') IS NOT NULL DROP TABLE #RenumberAuditF;
                    CREATE TABLE #RenumberAuditF (
                        Id bigint PRIMARY KEY,
                        Kind int NULL,
                        OldNo int NULL,
                        NewNo int NULL
                    );
                    INSERT INTO #RenumberAuditF (Id, Kind, OldNo)
                    SELECT ID, CAST(FactorKind AS int), CAST(NoFactor AS int)
                    FROM FactorParent WITH (TABLOCKX)
                    WHERE FactorKind IN (0, 1, 2, 3);",
                    transaction: tx, cancellationToken: ct));

            // ─── ۲. فاز ۱: پارک ───
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "UPDATE FactorParent SET NoFactor = -ID WHERE FactorKind IN (0, 1, 2, 3)",
                    transaction: tx, cancellationToken: ct));

            // ─── ۳. فاز ۲: رِنِمبر per Kind ───
            await conn.ExecuteAsync(
                new CommandDefinition(@"
                    UPDATE F
                    SET NoFactor = N.NewNo
                    FROM FactorParent F
                    INNER JOIN (
                        SELECT ID,
                               ROW_NUMBER() OVER (PARTITION BY FactorKind ORDER BY Date_In, ID) AS NewNo
                        FROM FactorParent
                        WHERE FactorKind IN (0, 1, 2, 3)
                    ) N ON F.ID = N.ID;",
                    transaction: tx, cancellationToken: ct));

            // ─── ۴. Audit بعد ───
            await conn.ExecuteAsync(
                new CommandDefinition(@"
                    UPDATE A
                    SET NewNo = CAST(F.NoFactor AS int)
                    FROM #RenumberAuditF A
                    INNER JOIN FactorParent F ON A.Id = F.ID;",
                    transaction: tx, cancellationToken: ct));

            // ─── ۵. خواندن Audit ───
            var rows = await conn.QueryAsync<RenumberRow>(
                new CommandDefinition(@"
                    SELECT
                        A.Id, A.Kind, A.OldNo, A.NewNo,
                        F.Date_In AS Date,
                        F.Descript AS Sharh,
                        ISNULL(D.ItemCount, 0) AS ItemCount
                    FROM #RenumberAuditF A
                    INNER JOIN FactorParent F ON F.ID = A.Id
                    LEFT JOIN (
                        SELECT FactorID, COUNT(*) AS ItemCount
                        FROM FactorDetail
                        GROUP BY FactorID
                    ) D ON D.FactorID = A.Id
                    ORDER BY A.Kind, A.NewNo;",
                    transaction: tx, cancellationToken: ct));

            tx.Commit();

            return new RenumberCommitResult
            {
                ProcessedCount = rows.Count(),
                AffectedItemsCount = 0,   // FactorDetail دست نمی‌خوره
                Rows = rows.ToList()
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
}