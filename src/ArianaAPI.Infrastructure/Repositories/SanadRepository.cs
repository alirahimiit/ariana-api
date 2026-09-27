using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using System.Text;
using System.Data;
using System.Globalization;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository اسناد با Dapper
/// </summary>
public class SanadRepository : ISanadRepository
{
    private readonly ITenantConnectionFactory _factory;

    public SanadRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    // ═══════════════════════════════════════════════════
    //  لیست اسناد + شمارش خطاها
    // ═══════════════════════════════════════════════════
    public async Task<IEnumerable<SanadListDto>> GetListAsync(
        long orgId,
        long fyId,
        string? fromDate = null,
        string? toDate = null,
        int? noFrom = null,
        int? noTo = null,
        int? vazeit = null,
        int? kindSanad = null,
        string? sortBy = null,
        string? sortDir = null,
        int page = 1,
        int pageSize = 100,
        bool? onlyWithErrors = null,
        CancellationToken ct = default)
    {
        var where = new StringBuilder(" WHERE 1=1 ");
        var parameters = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(fromDate))
        {
            where.Append(" AND P.Date_IN >= @fromDate ");
            parameters.Add("fromDate", fromDate);
        }
        if (!string.IsNullOrWhiteSpace(toDate))
        {
            where.Append(" AND P.Date_IN <= @toDate ");
            parameters.Add("toDate", toDate);
        }
        if (noFrom.HasValue)
        {
            where.Append(" AND P.NO_Sanad >= @noFrom ");
            parameters.Add("noFrom", noFrom.Value);
        }
        if (noTo.HasValue)
        {
            where.Append(" AND P.NO_Sanad <= @noTo ");
            parameters.Add("noTo", noTo.Value);
        }
        if (vazeit.HasValue)
        {
            where.Append(" AND P.Vazeit = @vazeit ");
            parameters.Add("vazeit", vazeit.Value);
        }
        if (kindSanad.HasValue)
        {
            where.Append(" AND P.KindSanad = @kindSanad ");
            parameters.Add("kindSanad", kindSanad.Value);
        }

        // ⭐ فیلتر فقط اسناد دارای خطا
        if (onlyWithErrors == true)
        {
            where.Append(" AND (ISNULL(E.CodingErrors, 0) + ISNULL(E.MoeinErrors, 0)) > 0 ");
        }

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100000) pageSize = 100;
        var offset = (page - 1) * pageSize;

        parameters.Add("startRow", offset + 1);
        parameters.Add("endRow", offset + pageSize);

        // سورت داینامیک
        var orderBy = "P.NO_Sanad DESC";
        if (!string.IsNullOrWhiteSpace(sortBy))
        {
            var dir = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase)
                ? "ASC" : "DESC";
            var allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["noSanad"] = "P.NO_Sanad",
                ["dateIn"] = "P.DATE_IN",
                ["sharh"] = "P.OtherParentSharh",
                ["vazeit"] = "P.Vazeit",
                ["kindSanad"] = "P.KindSanad",
                ["mabBed"] = "ISNULL(S.SumBed, 0)",
                ["mabBes"] = "ISNULL(S.SumBes, 0)"
            };
            if (allowed.TryGetValue(sortBy, out var col))
                orderBy = $"{col} {dir}";
        }

        var sql = $@"
            SELECT * FROM (
                SELECT 
                    P.ParentSanadID,
                    P.NO_Sanad,
                    P.Date_IN,
                    P.OtherParentSharh,
                    P.Vazeit,
                    P.KindSanad,
                    ISNULL(S.SumBed, 0) AS Mab_Bed,
                    ISNULL(S.SumBes, 0) AS Mab_Bes,
                    ISNULL(E.CodingErrors, 0)  AS CodingErrorCount,
                    ISNULL(E.MoeinErrors, 0)   AS MoeinErrorCount,
                    (ISNULL(E.CodingErrors, 0) + ISNULL(E.MoeinErrors, 0)) AS TotalErrorCount,
                    ROW_NUMBER() OVER (ORDER BY {orderBy}) AS RowNum
                FROM ParentSanad P
                LEFT JOIN (
                    SELECT ParentSanadCode,
                           SUM(Mab_Bed) AS SumBed,
                           SUM(Mab_Bes) AS SumBes
                    FROM Sanad
                    GROUP BY ParentSanadCode
                ) S ON S.ParentSanadCode = P.ParentSanadID
                LEFT JOIN (
                    SELECT ParentSanadCode,
                        SUM(CASE 
                            WHEN (Code_Col IS NULL OR Code_Col = 0) 
                                 AND (ISNULL(Mab_Bed,0) <> 0 OR ISNULL(Mab_Bes,0) <> 0)
                            THEN 1 ELSE 0 
                        END) AS CodingErrors,
                        SUM(CASE 
                            WHEN Code_Col > 0 
                                 AND (Code_Moein IS NULL OR Code_Moein = 0)
                                 AND (ISNULL(Mab_Bed,0) <> 0 OR ISNULL(Mab_Bes,0) <> 0)
                            THEN 1 ELSE 0 
                        END) AS MoeinErrors
                    FROM Sanad
                    GROUP BY ParentSanadCode
                ) E ON E.ParentSanadCode = P.ParentSanadID
                {where}
            ) AS T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<SanadListDto>(
            new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════
    //  جزئیات سند — با ISNULL KindSanad
    // ═══════════════════════════════════════════════════
    public async Task<SanadDetailDto?> GetByIdAsync(
        long orgId,
        long fyId,
        long sanadId,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                ParentSanadID, NO_Sanad, Date_IN, OtherParentSharh,
                ParentSharh_Code, Vazeit,
                ISNULL(KindSanad, 0) AS KindSanad,
                Creator, Confirmer,
                Date_Op, Time_Op
            FROM ParentSanad
            WHERE ParentSanadID = @sanadId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<SanadDetailDto>(
            new CommandDefinition(sql, new { sanadId }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════
    //  آیتم‌های سند — با IsStock + HasTafzili + شرط‌های JOIN
    // ═══════════════════════════════════════════════════
    public async Task<IEnumerable<SanadItemDto>> GetItemsAsync(
        long orgId,
        long fyId,
        long parentSanadId,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                S.SanadID,
                S.NO_Sanad,
                S.RowNum,
                S.Code_Col,
                S.Code_Moein,
                S.Code_Tafzil,
                S.Code_Tafzili2,
                S.Mab_Bed,
                S.Mab_Bes,
                CASE 
                    WHEN S.Mab_Bed > 0 THEN ISNULL(S.Meghdar, 0)
                    WHEN S.Mab_Bes > 0 THEN -1 * ISNULL(S.Meghdar, 0)
                    ELSE 0
                END AS Meghdar,
                S.OtherSharh,
                S.TikRow,
                S.Code_Sharh,
                S.DoDate,
                S.DoOK,
                ISNULL(H1.Name, '') AS ColName,
                ISNULL(H2.Name, '') AS MoeinName,
                ISNULL(H3.Name, '') AS TafzilName,
                ISNULL(T2.Name, '') AS Tafzili2Name,
                ISNULL(H2.IsStock, 0)     AS IsStock,
                ISNULL(H2.HasTafzili, 0)  AS HasTafzili
            FROM Sanad S
            LEFT JOIN Hesab H1 
                ON S.Code_Col > 0
               AND H1.Code_Col  = S.Code_Col 
               AND H1.Code_Moein  = 0 
               AND H1.Code_Tafzil = 0
            LEFT JOIN Hesab H2 
                ON S.Code_Col > 0
               AND S.Code_Moein > 0
               AND H2.Code_Col   = S.Code_Col 
               AND H2.Code_Moein = S.Code_Moein 
               AND H2.Code_Tafzil = 0
            LEFT JOIN Hesab H3 
                ON S.Code_Tafzil > 0
               AND H3.Code_Col   = -1 
               AND H3.Code_Tafzil = S.Code_Tafzil
            LEFT JOIN Tafzili2 T2 
                ON S.Code_Tafzili2 > 0
               AND T2.Code = S.Code_Tafzili2
            WHERE S.ParentSanadCode = @parentSanadId
            ORDER BY S.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<SanadItemDto>(
            new CommandDefinition(sql, new { parentSanadId }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════
    //  تعداد کل
    // ═══════════════════════════════════════════════════
    public async Task<int> GetCountAsync(
        long orgId,
        long fyId,
        string? fromDate = null,
        string? toDate = null,
        int? vazeit = null,
        CancellationToken ct = default)
    {
        var where = new StringBuilder(" WHERE 1=1 ");
        var parameters = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(fromDate))
        {
            where.Append(" AND Date_IN >= @fromDate ");
            parameters.Add("fromDate", fromDate);
        }
        if (!string.IsNullOrWhiteSpace(toDate))
        {
            where.Append(" AND Date_IN <= @toDate ");
            parameters.Add("toDate", toDate);
        }
        if (vazeit.HasValue)
        {
            where.Append(" AND Vazeit = @vazeit ");
            parameters.Add("vazeit", vazeit.Value);
        }

        var sql = $"SELECT COUNT(*) FROM ParentSanad {where}";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════
    //  WRITE (بدون تغییر)
    // ═══════════════════════════════════════════════════
    private static string GetTodayPersian()
    {
        var pc = new PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }

    private static string GetCurrentTime()
    {
        return DateTime.Now.ToString("HH:mm:ss");
    }

    public async Task<SanadCreateResultDto> CreateAsync(
        long orgId, long fyId, SanadCreateDto dto, long userCode, CancellationToken ct = default)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new InvalidOperationException("سند باید حداقل یک ردیف داشته باشد");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var noSanad = dto.NoSanad;
            if (noSanad == null || noSanad <= 0)
            {
                noSanad = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        "SELECT ISNULL(MAX(NO_Sanad), 0) + 1 FROM ParentSanad",
                        transaction: tx, cancellationToken: ct));
            }

            const string insertParentSql = @"
                INSERT INTO ParentSanad 
                    (NO_Sanad, Date_IN, OtherParentSharh, ParentSharh_Code, Vazeit, KindSanad,
                     Creator, Updater, Deleter, Tempconfirmer, Confirmer,
                     Code_Op, Date_Op, Time_Op)
                OUTPUT INSERTED.ParentSanadID
                VALUES 
                    (@noSanad, @dateIn, @sharh, @sharhCode, @vazeit, @kindSanad,
                     @userCode, 0, 0, 0, 0,
                     @userCode, @dateOp, @timeOp)";

            var parentId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertParentSql, new
                {
                    noSanad = noSanad.Value,
                    dateIn = dto.DateIn ?? "",
                    sharh = dto.OtherParentSharh ?? "",
                    sharhCode = dto.ParentSharhCode ?? 0,
                    vazeit = dto.Vazeit,
                    kindSanad = dto.KindSanad,
                    userCode = userCode,
                    dateOp = GetTodayPersian(),
                    timeOp = GetCurrentTime()
                }, transaction: tx, cancellationToken: ct));

            const string insertItemSql = @"
                INSERT INTO Sanad 
                    (NO_Sanad, ParentSanadCode, RowNum,
                     Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Tafzili2ID,
                     Code_Sharh, OtherSharh,
                     Mab_Bed, Mab_Bes, Meghdar,
                     TikRow, ResidNum, CheckType,
                     Code_Op, Date_Op, Time_Op)
                VALUES 
                    (@noSanad, @parentId, @rowNum,
                     @codeCol, @codeMoein, @codeTafzil, @codeTafzili2, @tafzili2Id,
                     @codeSharh, @otherSharh,
                     @mabBed, @mabBes, @meghdar,
                     0, 0, -1,
                     @userCode, @dateOp, @timeOp)";

            var rowNum = 1;
            foreach (var item in dto.Items)
            {
                await conn.ExecuteAsync(
                    new CommandDefinition(insertItemSql, new
                    {
                        noSanad = noSanad.Value,
                        parentId = parentId,
                        rowNum = item.RowNum > 0 ? item.RowNum : rowNum,
                        codeCol = item.CodeCol,
                        codeMoein = item.CodeMoein,
                        codeTafzil = item.CodeTafzil,
                        codeTafzili2 = item.CodeTafzili2 ?? 0,
                        tafzili2Id = item.Tafzili2Id ?? 0,
                        codeSharh = item.CodeSharh ?? 0,
                        otherSharh = item.OtherSharh ?? "",
                        mabBed = item.MabBed,
                        mabBes = item.MabBes,
                        meghdar = item.Meghdar ?? 0m,
                        userCode = userCode,
                        dateOp = GetTodayPersian(),
                        timeOp = GetCurrentTime()
                    }, transaction: tx, cancellationToken: ct));
                rowNum++;
            }

            tx.Commit();

            return new SanadCreateResultDto
            {
                ParentSanadId = parentId,
                NoSanad = noSanad.Value
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    public async Task UpdateAsync(
        long orgId, long fyId, SanadUpdateDto dto, long userCode, CancellationToken ct = default)
    {
        if (dto.ParentSanadId <= 0)
            throw new InvalidOperationException("شناسه سند نامعتبر است");
        if (dto.Items == null || dto.Items.Count == 0)
            throw new InvalidOperationException("سند باید حداقل یک ردیف داشته باشد");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var vazeit = await conn.ExecuteScalarAsync<int?>(
                new CommandDefinition(
                    "SELECT Vazeit FROM ParentSanad WHERE ParentSanadID = @id",
                    new { id = dto.ParentSanadId },
                    transaction: tx, cancellationToken: ct));

            if (vazeit == null)
                throw new InvalidOperationException("سند یافت نشد");
            if (vazeit.Value == 2)
                throw new InvalidOperationException("سند قطعی قابل ویرایش نیست");

            const string updateParentSql = @"
                UPDATE ParentSanad 
                SET Date_IN = @dateIn,
                    OtherParentSharh = @sharh,
                    ParentSharh_Code = @sharhCode,
                    Vazeit = @vazeit,
                    KindSanad = @kindSanad,
                    Updater = @userCode,
                    Code_Op = @userCode,
                    Date_Op = @dateOp,
                    Time_Op = @timeOp
                WHERE ParentSanadID = @id";

            await conn.ExecuteAsync(
                new CommandDefinition(updateParentSql, new
                {
                    id = dto.ParentSanadId,
                    dateIn = dto.DateIn ?? "",
                    sharh = dto.OtherParentSharh ?? "",
                    sharhCode = dto.ParentSharhCode ?? 0,
                    vazeit = dto.Vazeit,
                    kindSanad = dto.KindSanad,
                    userCode = userCode,
                    dateOp = GetTodayPersian(),
                    timeOp = GetCurrentTime()
                }, transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM Sanad WHERE ParentSanadCode = @id",
                    new { id = dto.ParentSanadId },
                    transaction: tx, cancellationToken: ct));

            var noSanadRow = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT NO_Sanad FROM ParentSanad WHERE ParentSanadID = @id",
                    new { id = dto.ParentSanadId },
                    transaction: tx, cancellationToken: ct));

            const string insertItemSql = @"
                INSERT INTO Sanad 
                    (NO_Sanad, ParentSanadCode, RowNum,
                     Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Tafzili2ID,
                     Code_Sharh, OtherSharh,
                     Mab_Bed, Mab_Bes, Meghdar,
                     TikRow, ResidNum, CheckType,
                     Code_Op, Date_Op, Time_Op)
                VALUES 
                    (@noSanad, @parentId, @rowNum,
                     @codeCol, @codeMoein, @codeTafzil, @codeTafzili2, @tafzili2Id,
                     @codeSharh, @otherSharh,
                     @mabBed, @mabBes, @meghdar,
                     0, 0, -1,
                     @userCode, @dateOp, @timeOp)";

            var rowNum = 1;
            foreach (var item in dto.Items)
            {
                await conn.ExecuteAsync(
                    new CommandDefinition(insertItemSql, new
                    {
                        noSanad = noSanadRow,
                        parentId = dto.ParentSanadId,
                        rowNum = item.RowNum > 0 ? item.RowNum : rowNum,
                        codeCol = item.CodeCol,
                        codeMoein = item.CodeMoein,
                        codeTafzil = item.CodeTafzil,
                        codeTafzili2 = item.CodeTafzili2 ?? 0,
                        tafzili2Id = item.Tafzili2Id ?? 0,
                        codeSharh = item.CodeSharh ?? 0,
                        otherSharh = item.OtherSharh ?? "",
                        mabBed = item.MabBed,
                        mabBes = item.MabBes,
                        meghdar = item.Meghdar ?? 0m,
                        userCode = userCode,
                        dateOp = GetTodayPersian(),
                        timeOp = GetCurrentTime()
                    }, transaction: tx, cancellationToken: ct));
                rowNum++;
            }

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    public async Task DeleteAsync(
        long orgId, long fyId, long parentSanadId, long userCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var vazeit = await conn.ExecuteScalarAsync<int?>(
                new CommandDefinition(
                    "SELECT Vazeit FROM ParentSanad WHERE ParentSanadID = @id",
                    new { id = parentSanadId },
                    transaction: tx, cancellationToken: ct));

            if (vazeit == null)
                throw new InvalidOperationException("سند یافت نشد");
            if (vazeit.Value == 2)
                throw new InvalidOperationException("سند قطعی قابل حذف نیست");

            const string archiveSql = @"
                INSERT INTO RecycleSanad 
                    (NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                     Code_Sharh, OtherSharh, Mab_Bed, Mab_Bes,
                     Code_Op, Date_Op, Time_Op, ResidNum, CheckType)
                SELECT 
                    NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                    Code_Sharh, OtherSharh, Mab_Bed, Mab_Bes,
                    Code_Op, Date_Op, Time_Op, ResidNum, CheckType
                FROM Sanad 
                WHERE ParentSanadCode = @id";

            await conn.ExecuteAsync(
                new CommandDefinition(archiveSql,
                    new { id = parentSanadId },
                    transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM Sanad WHERE ParentSanadCode = @id",
                    new { id = parentSanadId },
                    transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM ParentSanad WHERE ParentSanadID = @id",
                    new { id = parentSanadId },
                    transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    public async Task<int> GetVazeitAsync(
        long orgId, long fyId, long parentSanadId, CancellationToken ct = default)
    {
        const string sql = "SELECT Vazeit FROM ParentSanad WHERE ParentSanadID = @id";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var result = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition(sql, new { id = parentSanadId }, cancellationToken: ct));
        return result ?? -1;
    }
}