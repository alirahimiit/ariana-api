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
    // ⭐⭐ چک اعتبار سند برای Vazeit > 0
    private void ValidateForVazeit(SanadCreateDto dto)
    {
        if (dto.Vazeit < 1) return;

        var errors = new List<string>();
        decimal totalBed = 0, totalBes = 0;

        for (int i = 0; i < dto.Items.Count; i++)
        {
            var it = dto.Items[i];
            var row = i + 1;
            var hasBed = it.MabBed > 0;
            var hasBes = it.MabBes > 0;
            var hasAmount = hasBed || hasBes;

            totalBed += it.MabBed;
            totalBes += it.MabBes;

            // ⛔ ایراد جدی
            if (it.CodeCol == 0 && hasAmount)
                errors.Add($"ردیف {row}: کد کل ندارد");
            // ⛔ مقدار انباری (اگه CodeMoein داره و انباریه ولی مقدار نداره)
            // ⚠️ برای بررسی انباری نیاز به DB هست — این فقط توی Frontend
            //    چون Frontend از cache استفاده می‌کنه
        }

        // برای قطعی: باید تراز باشه
        if (dto.Vazeit == 2)
        {
            var diff = Math.Abs(totalBed - totalBes);
            if (diff > 0.01m)
                errors.Add($"سند تراز نیست (تفاوت: {diff:N0})");
        }

        if (errors.Count > 0)
        {
            var label = dto.Vazeit == 1 ? "رسیدگی" : "قطعی";
            throw new InvalidOperationException(
                $"امکان تغییر وضعیت به «{label}» وجود ندارد. " +
                $"ایرادها: {string.Join(" | ", errors)}");
        }
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
        int? codeCol = null, int? codeMoein = null, int? codeTafzil = null,
        string? sharh = null, string? rowSharh = null,
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
        // ⭐ فیلتر شرح سند (Header)
        if (!string.IsNullOrWhiteSpace(sharh))
        {
            where.Append(" AND P.OtherParentSharh LIKE @sharh ");
            parameters.Add("sharh", "%" + sharh.Trim() + "%");
        }

        // ⭐ فیلتر شرح ردیف (Subquery)
        if (!string.IsNullOrWhiteSpace(rowSharh))
        {
            where.Append(" AND P.ParentSanadID IN (SELECT DISTINCT ParentSanadCode FROM Sanad WHERE OtherSharh LIKE @rowSharh) ");
            parameters.Add("rowSharh", "%" + rowSharh.Trim() + "%");
        }

        // ⭐ فیلتر فقط اسناد دارای خطا
        if (onlyWithErrors == true)
        {
            where.Append(" AND (ISNULL(E.CodingErrors, 0) + ISNULL(E.MoeinErrors, 0)) > 0 ");
        }

        // ⭐ فیلتر بر اساس کدینگ حساب (کل/معین/تفصیلی)
        if (codeCol is > 0)
        {
            var accountWhere = new StringBuilder(" WHERE Code_Col = @codeCol ");
            parameters.Add("codeCol", codeCol.Value);

            if (codeMoein is > 0)
            {
                accountWhere.Append(" AND Code_Moein = @codeMoein ");
                parameters.Add("codeMoein", codeMoein.Value);
            }

            if (codeTafzil is > 0)
            {
                accountWhere.Append(" AND Code_Tafzil = @codeTafzil ");
                parameters.Add("codeTafzil", codeTafzil.Value);
            }

            where.Append($" AND P.ParentSanadID IN (SELECT DISTINCT ParentSanadCode FROM Sanad {accountWhere}) ");
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
                    ISNULL(S.ItemCount, 0) AS ItemCount,
                    ISNULL(E.CodingErrors, 0)  AS CodingErrorCount,
                    ISNULL(E.MoeinErrors, 0)   AS MoeinErrorCount,
                    (ISNULL(E.CodingErrors, 0) + ISNULL(E.MoeinErrors, 0)) AS TotalErrorCount,
                    ROW_NUMBER() OVER (ORDER BY {orderBy}) AS RowNum
                FROM ParentSanad P
                LEFT JOIN (
                    SELECT ParentSanadCode,
                           COUNT(*) AS ItemCount,
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
            new CommandDefinition(sql, parameters, commandTimeout: 120, cancellationToken: ct));
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
            new CommandDefinition(sql, parameters, commandTimeout: 120, cancellationToken: ct));
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
        ValidateForVazeit(dto);
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
                     DoDate, DoOK,
                     Code_Op, Date_Op, Time_Op)
                VALUES 
                    (@noSanad, @parentId, @rowNum,
                     @codeCol, @codeMoein, @codeTafzil, @codeTafzili2, @tafzili2Id,
                     @codeSharh, @otherSharh,
                     @mabBed, @mabBes, @meghdar,
                     @tikRow, 0, -1,
                     @doDate, @doOK,
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
                        tikRow = item.TikRow ?? 0,
                        doDate = string.IsNullOrWhiteSpace(item.DoDate)
                                    ? (object)DBNull.Value
                                    : item.DoDate,
                        doOK = item.DoOK ?? false,
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
        // ⭐ چک اعتبار Vazeit
        ValidateForVazeit(new SanadCreateDto
        {
            Vazeit = dto.Vazeit,
            Items = dto.Items
        });
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

            // ⭐ چک Vazeit حذف شد — دسترسی در Controller انجام می‌شه

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
                     DoDate, DoOK,
                     Code_Op, Date_Op, Time_Op)
                VALUES 
                    (@noSanad, @parentId, @rowNum,
                     @codeCol, @codeMoein, @codeTafzil, @codeTafzili2, @tafzili2Id,
                     @codeSharh, @otherSharh,
                     @mabBed, @mabBes, @meghdar,
                     @tikRow, 0, -1,
                     @doDate, @doOK,
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
                        tikRow = item.TikRow ?? 0,
                        doDate = string.IsNullOrWhiteSpace(item.DoDate)
                                    ? (object)DBNull.Value
                                    : item.DoDate,
                        doOK = item.DoOK ?? false,
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

            // ⭐⭐ قفل سختگیرانه — فقط پیش‌نویس قابل حذف
            if (vazeit.Value != 0)
            {
                var label = vazeit.Value == 1 ? "رسیدگی" : "قطعی";
                throw new InvalidOperationException(
                    $"سند «{label}» قابل حذف نیست. ابتدا وضعیت سند را به پیش‌نویس تغییر دهید");
            }

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
    // ═══════════════════════════════════════════════════
    //  📤 Export to CSV
    // ═══════════════════════════════════════════════════
    public async Task<string> ExportCsvAsync(
        long orgId, long fyId,
        List<long> sanadIds,
        CancellationToken ct = default)
    {
        if (sanadIds == null || sanadIds.Count == 0)
            throw new InvalidOperationException("هیچ سندی انتخاب نشده است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        const string sql = @"
            SELECT 
                P.NO_Sanad,
                P.Date_IN,
                P.OtherParentSharh,
                S.OtherSharh,
                S.Mab_Bed,
                S.Mab_Bes,
                S.RowNum,
                S.Code_Col,
                S.Code_Moein,
                S.Code_Tafzil,
                ISNULL(S.Code_Tafzili2, 0) AS Code_Tafzili2,
                ISNULL(S.Tafzili2ID, 0)    AS Tafzili2ID,
                ISNULL(S.Meghdar, 0)       AS Meghdar
            FROM ParentSanad P
            INNER JOIN Sanad S ON S.ParentSanadCode = P.ParentSanadID
            WHERE P.ParentSanadID IN @ids
            ORDER BY P.NO_Sanad, S.RowNum";

        var rows = (await conn.QueryAsync<dynamic>(
            new CommandDefinition(sql, new { ids = sanadIds }, cancellationToken: ct))).ToList();

        if (rows.Count == 0)
            throw new InvalidOperationException("سندی برای خروجی یافت نشد");

        var sb = new StringBuilder();

        // ⭐ اضافه کردن sep=; برای اینکه اکسل ستون‌ها را درست تشخیص دهد
        sb.AppendLine("sep=;");

        sb.AppendLine("شماره سند;تاريخ سند;شرح سند;شرح رديف;بدهکار;بستانکار;رديف;کد کل;کد معين;کد تفصيلي;کد تفصيلي2;شناسه تفضيلي2;مقدار");

        foreach (var r in rows)
        {
            var noSanad = (int)(decimal)r.NO_Sanad;
            var dateIn = (string?)r.Date_IN ?? "";
            var sharh = Escape((string?)r.OtherParentSharh ?? "");
            var itemSharh = Escape((string?)r.OtherSharh ?? "");

            // ⭐ استفاده از ExcelText برای جلوگیری از تبدیل شدن به فرمت علمی در اکسل
            var mabBed = ExcelText(((decimal?)r.Mab_Bed ?? 0m).ToString("0.####", CultureInfo.InvariantCulture));
            var mabBes = ExcelText(((decimal?)r.Mab_Bes ?? 0m).ToString("0.####", CultureInfo.InvariantCulture));

            var rowNum = (int)(decimal)(r.RowNum ?? 0);
            var codeCol = (int)(decimal)r.Code_Col;
            var codeMoein = (int)(decimal)r.Code_Moein;
            var codeTafzil = (int)(decimal)r.Code_Tafzil;
            var codeTafzili2 = (int)(decimal)(r.Code_Tafzili2 ?? 0);
            var tafzili2Id = (int)(decimal)(r.Tafzili2ID ?? 0);

            var meghdar = ExcelText(((decimal?)r.Meghdar ?? 0m).ToString("0.####", CultureInfo.InvariantCulture));

            sb.AppendLine($"{noSanad};{dateIn};{sharh};{itemSharh};{mabBed};{mabBes};{rowNum};{codeCol};{codeMoein};{codeTafzil};{codeTafzili2};{tafzili2Id};{meghdar}");
        }

        return sb.ToString();
    }


    private static string Escape(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        // اگه کاراکتر خاص داره، در "..." بذار
        if (s.Contains(';') || s.Contains('"') || s.Contains('\n') || s.Contains('\r'))
            return "\"" + s.Replace("\"", "\"\"") + "\"";
        return s;
    }

    // ⭐ فرمت‌دهی متن برای جلوگیری از تبدیل به فرمت علمی در اکسل
    private static string ExcelText(string val)
    {
        return "=\"" + val + "\"";
    }

    // ═══════════════════════════════════════════════════
    //  📥 Parse + Validate CSV (بدون DB)
    // ═══════════════════════════════════════════════════
    public SanadImportPreviewResult ParseAndValidateCsv(
        string csvContent,
        List<int> existingNoSanads)
    {
        var result = new SanadImportPreviewResult();
        var existing = new HashSet<int>(existingNoSanads ?? new List<int>());

        if (string.IsNullOrWhiteSpace(csvContent))
        {
            result.Errors.Add(new SanadImportError { LineNumber = 0, Message = "فایل خالی است" });
            return result;
        }

        csvContent = csvContent.TrimStart('\uFEFF');
        var lines = csvContent.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None)
                              .Where(l => !string.IsNullOrWhiteSpace(l))
                              .ToList();

        // ⭐ حذف خط sep=; اگر وجود داشت
        if (lines.Count > 0 && lines[0].StartsWith("sep=", StringComparison.OrdinalIgnoreCase))
        {
            lines.RemoveAt(0);
        }

        if (lines.Count < 2)
        {
            result.Errors.Add(new SanadImportError { LineNumber = 0, Message = "فایل باید حداقل یک خط هدر و یک خط داده داشته باشد" });
            return result;
        }

        var header = lines[0].Trim();
        var headerCols = header.Split(';').Select(x => x.Trim()).ToList();

        if (headerCols.Count < 10)
        {
            result.Errors.Add(new SanadImportError { LineNumber = 1, Message = $"هدر باید حداقل 10 ستون داشته باشد. تعداد فعلی: {headerCols.Count}" });
            return result;
        }

        var parsedRows = new List<ParsedRow>();

        for (int i = 1; i < lines.Count; i++)
        {
            var lineNumber = i + 1;
            var raw = lines[i];
            var cols = SplitCsvLine(raw);

            if (cols.Count < 10)
            {
                result.Errors.Add(new SanadImportError { LineNumber = lineNumber, Message = $"تعداد ستون‌ها کمتر از 10 است ({cols.Count} ستون)." });
                continue;
            }

            try
            {
                var row = new ParsedRow
                {
                    LineNumber = lineNumber,
                    NoSanad = ParseInt(cols[0]),
                    DateIn = (cols[1] ?? "").Trim(),
                    ParentSharh = (cols[2] ?? "").Trim(),
                    ItemSharh = (cols[3] ?? "").Trim(),
                    MabBed = ParseDecimal(cols[4]),
                    MabBes = ParseDecimal(cols[5]),
                    RowNum = ParseInt(cols[6]),
                    CodeCol = ParseInt(cols[7]),
                    CodeMoein = ParseInt(cols[8]),
                    CodeTafzil = ParseInt(cols[9]),
                    CodeTafzili2 = cols.Count > 10 ? ParseInt(cols[10]) : 0,
                    Tafzili2Id = cols.Count > 11 ? ParseInt(cols[11]) : 0,
                    Meghdar = cols.Count > 12 ? ParseDecimal(cols[12]) : 0m
                };

                // ⭐⭐ اگر ردیف کاملاً خالی بود (شماره سند، کد، و مبالغ صفر بودند)، از آن رد شو
                if (row.NoSanad == 0 && row.CodeCol == 0 && row.MabBed == 0 && row.MabBes == 0)
                {
                    continue;
                }

                var rowErrors = ValidateRow(row);
                foreach (var err in rowErrors)
                {
                    result.Errors.Add(new SanadImportError { LineNumber = lineNumber, Message = err });
                }

                parsedRows.Add(row);
                result.TotalLines++;
            }
            catch (Exception ex)
            {
                result.Errors.Add(new SanadImportError { LineNumber = lineNumber, Message = "خطا در پردازش خط: " + ex.Message });
            }
        }

        if (result.Errors.Count > 0)
        {
            result.IsValid = false;
            return result;
        }

        var groups = parsedRows.GroupBy(r => r.NoSanad).OrderBy(g => g.Key).ToList();
        var nextNo = existing.Count > 0 ? existing.Max() + 1 : 1;

        foreach (var g in groups)
        {
            var bed = g.Sum(x => x.MabBed);
            var bes = g.Sum(x => x.MabBes);
            var balanced = Math.Abs(bed - bes) < 0.01m;

            var sourceNo = g.Key;
            int newNo;

            if (existing.Contains(sourceNo))
            {
                newNo = nextNo++;
                result.Warnings.Add(new SanadImportWarning { LineNumber = g.First().LineNumber, Message = $"شماره سند {sourceNo} قبلاً وجود دارد → با شماره {newNo} ثبت می‌شود" });
            }
            else
            {
                newNo = sourceNo;
                existing.Add(newNo);
                if (newNo >= nextNo) nextNo = newNo + 1;
            }

            var firstItem = g.First();

            result.Preview.Add(new SanadImportPreviewItem
            {
                SourceNoSanad = sourceNo,
                NewNoSanad = newNo,
                DateIn = firstItem.DateIn,
                Sharh = firstItem.ParentSharh,
                ItemCount = g.Count(),
                TotalBed = bed,
                TotalBes = bes,
                IsBalanced = balanced
            });

            if (!balanced)
            {
                result.Warnings.Add(new SanadImportWarning { LineNumber = firstItem.LineNumber, Message = $"سند {sourceNo}: جمع بدهکار ({bed:N0}) با بستانکار ({bes:N0}) تراز نیست" });
            }

            result.ItemCount += g.Count();
            result.TotalBed += bed;
            result.TotalBes += bes;
        }

        result.SanadCount = groups.Count;
        result.ValidLines = parsedRows.Count;
        result.IsValid = true;
        return result;
    }

    private static List<string> SplitCsvLine(string line)
    {
        var result = new List<string>();
        var sb = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    sb.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ';' && !inQuotes)
            {
                result.Add(sb.ToString());
                sb.Clear();
            }
            else
            {
                sb.Append(c);
            }
        }
        result.Add(sb.ToString());
        return result;
    }

    private static int ParseInt(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return 0;

        s = NormalizeDigits(s).Replace(",", "").Replace(" ", "").Trim();
        s = s.Replace("٬", "").Replace("،", "");

        if (s.StartsWith("=")) s = s.Substring(1);
        if (s.StartsWith("\"") && s.EndsWith("\"") && s.Length >= 2)
            s = s.Substring(1, s.Length - 2);

        // ⭐ اگر علامت‌های بی‌معنی مثل نقطه یا خط تیره بود، صفر برگردان
        if (string.IsNullOrWhiteSpace(s) || s == "." || s == "-" || s == "_") return 0;

        if (s.Contains('E') || s.Contains('e'))
            throw new FormatException($"عدد '{s}' دارای فرمت علمی است. اکسل ارقام آن را از بین برده است. لطفاً ستون را در اکسل Text کنید.");

        return int.TryParse(s, out var v) ? v : throw new FormatException($"عدد نامعتبر: '{s}'");
    }
    private static decimal ParseDecimal(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return 0m;

        s = NormalizeDigits(s).Replace(",", "").Replace(" ", "").Trim();
        s = s.Replace("٬", "").Replace("،", "");

        if (s.StartsWith("=")) s = s.Substring(1);
        if (s.StartsWith("\"") && s.EndsWith("\"") && s.Length >= 2)
            s = s.Substring(1, s.Length - 2);

        // ⭐ اگر علامت‌های بی‌معنی مثل نقطه یا خط تیره بود، صفر برگردان
        if (string.IsNullOrWhiteSpace(s) || s == "." || s == "-" || s == "_") return 0m;

        if (s.Contains('E') || s.Contains('e'))
            throw new FormatException($"مبلغ '{s}' به صورت فرمت علمی ذخیره شده است. لطفاً در اکسل ستون مبلغ را به فرمت Text تغییر دهید.");

        return decimal.TryParse(s, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var v)
            ? v
            : throw new FormatException($"عدد اعشاری نامعتبر: '{s}'");
    }
    private static string NormalizeDigits(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        var sb = new StringBuilder(s.Length);
        foreach (var c in s)
        {
            if (c >= '۰' && c <= '۹') sb.Append((char)('0' + (c - '۰')));
            else if (c >= '٠' && c <= '٩') sb.Append((char)('0' + (c - '٠')));
            else sb.Append(c);
        }
        return sb.ToString();
    }

    private static List<string> ValidateRow(ParsedRow row)
    {
        var errs = new List<string>();

        if (row.CodeCol <= 0)
            errs.Add("کد کل الزامی و باید بزرگ‌تر از صفر باشد");

        if (row.MabBed < 0 || row.MabBes < 0)
            errs.Add("مبلغ بدهکار و بستانکار نمی‌تواند منفی باشد");

        if (row.MabBed == 0 && row.MabBes == 0)
            errs.Add("یکی از مبالغ بدهکار یا بستانکار باید بزرگ‌تر از صفر باشد");

        if (row.MabBed > 0 && row.MabBes > 0)
            errs.Add("یک ردیف نمی‌تواند هم بدهکار و هم بستانکار داشته باشد");

        if (!string.IsNullOrWhiteSpace(row.DateIn))
        {
            var parts = row.DateIn.Split('/');
            if (parts.Length != 3)
                errs.Add($"تاریخ نامعتبر: '{row.DateIn}' (فرمت صحیح: 1404/01/01)");
            else
            {
                var y = int.TryParse(parts[0], out var yy) ? yy : 0;
                var m = int.TryParse(parts[1], out var mm) ? mm : 0;
                var d = int.TryParse(parts[2], out var dd) ? dd : 0;
                if (y < 1300 || y > 1500 || m < 1 || m > 12 || d < 1 || d > 31)
                    errs.Add($"تاریخ نامعتبر: '{row.DateIn}'");
            }
        }

        return errs;
    }

    private class ParsedRow
    {
        public int LineNumber { get; set; }
        public int NoSanad { get; set; }
        public string DateIn { get; set; } = "";
        public string ParentSharh { get; set; } = "";
        public string ItemSharh { get; set; } = "";
        public decimal MabBed { get; set; }
        public decimal MabBes { get; set; }
        public int RowNum { get; set; }
        public int CodeCol { get; set; }
        public int CodeMoein { get; set; }
        public int CodeTafzil { get; set; }
        public int CodeTafzili2 { get; set; }
        public int Tafzili2Id { get; set; }
        public decimal Meghdar { get; set; }
    }

    // ═══════════════════════════════════════════════════
    //  📥 Import from CSV (با Transaction کامل)
    // ═══════════════════════════════════════════════════
    public async Task<SanadImportResult> ImportFromCsvAsync(
        long orgId, long fyId,
        string csvContent,
        bool forceNewNumbers,
        long userCode,
        CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        var existingNos = (await conn.QueryAsync<int>(
            new CommandDefinition("SELECT NO_Sanad FROM ParentSanad", cancellationToken: ct))).ToList();

        var preview = ParseAndValidateCsv(csvContent, existingNos);

        if (!preview.IsValid)
            throw new InvalidOperationException(
                "فایل معتبر نیست. " + string.Join(" | ", preview.Errors.Take(5).Select(e => $"خط {e.LineNumber}: {e.Message}")));

        if (forceNewNumbers)
        {
            var nextNo = existingNos.Count > 0 ? existingNos.Max() + 1 : 1;
            foreach (var p in preview.Preview)
            {
                p.NewNoSanad = nextNo++;
            }
        }

        using var tx = conn.BeginTransaction();
        try
        {
            var result = new SanadImportResult();
            var todayPersian = GetTodayPersian();
            var nowTime = GetCurrentTime();

            var lockedNos = (await conn.QueryAsync<int>(
                new CommandDefinition("SELECT NO_Sanad FROM ParentSanad WITH (TABLOCKX)", transaction: tx, cancellationToken: ct))).ToList();
            var lockedSet = new HashSet<int>(lockedNos);

            var parsed = ParseCsvContent(csvContent);
            var groups = parsed.GroupBy(r => r.NoSanad).OrderBy(g => g.Key).ToList();

            var nextNo = lockedNos.Count > 0 ? lockedNos.Max() + 1 : 1;

            foreach (var g in groups)
            {
                var sourceNo = g.Key;
                int newNo = preview.Preview.FirstOrDefault(p => p.SourceNoSanad == sourceNo)?.NewNoSanad ?? sourceNo;

                if (lockedSet.Contains(newNo))
                {
                    newNo = nextNo++;
                    lockedSet.Add(newNo);
                }
                else
                {
                    lockedSet.Add(newNo);
                    if (newNo >= nextNo) nextNo = newNo + 1;
                }

                var first = g.First();
                var dateIn = string.IsNullOrWhiteSpace(first.DateIn) ? todayPersian : first.DateIn;

                var parentId = await conn.ExecuteScalarAsync<long>(
                    new CommandDefinition(@"
                        INSERT INTO ParentSanad
                            (NO_Sanad, Date_IN, OtherParentSharh, ParentSharh_Code, Vazeit, KindSanad,
                             Creator, Updater, Deleter, Tempconfirmer, Confirmer,
                             Code_Op, Date_Op, Time_Op)
                        OUTPUT INSERTED.ParentSanadID
                        VALUES
                            (@noSanad, @dateIn, @sharh, 0, 0, 0,
                             @userCode, 0, 0, 0, 0,
                             @userCode, @dateOp, @timeOp)",
                        new
                        {
                            noSanad = newNo,
                            dateIn = dateIn,
                            sharh = first.ParentSharh ?? "",
                            userCode = userCode,
                            dateOp = todayPersian,
                            timeOp = nowTime
                        },
                        transaction: tx, cancellationToken: ct));

                var rowNum = 1;
                // ⭐ حذف OrderBy(x => x.RowNum) برای شماره‌گذاری خودکار به ترتیب خطوط فایل
                foreach (var item in g)
                {
                    await conn.ExecuteAsync(
                        new CommandDefinition(@"
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
                                 0, @sharh,
                                 @mabBed, @mabBes, @meghdar,
                                 0, 0, -1,
                                 @userCode, @dateOp, @timeOp)",
                            new
                            {
                                noSanad = newNo,
                                parentId = parentId,
                                rowNum = rowNum,
                                codeCol = item.CodeCol,
                                codeMoein = item.CodeMoein,
                                codeTafzil = item.CodeTafzil,
                                codeTafzili2 = item.CodeTafzili2,
                                tafzili2Id = item.Tafzili2Id,
                                sharh = item.ItemSharh ?? "",
                                mabBed = item.MabBed,
                                mabBes = item.MabBes,
                                meghdar = item.Meghdar,
                                userCode = userCode,
                                dateOp = todayPersian,
                                timeOp = nowTime
                            },
                            transaction: tx, cancellationToken: ct));

                    rowNum++;
                    result.CreatedItems++;
                }

                result.CreatedSanads++;
                result.NewNoSanads.Add(newNo);
                result.ParentSanadIds.Add(parentId);
            }

            tx.Commit();
            return result;
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }


    private static List<ParsedRow> ParseCsvContent(string csvContent)
    {
        var result = new List<ParsedRow>();
        csvContent = csvContent.TrimStart('\uFEFF');
        var lines = csvContent.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None).ToList();

        if (lines.Count > 0 && lines[0].StartsWith("sep=", StringComparison.OrdinalIgnoreCase))
        {
            lines.RemoveAt(0);
        }

        for (int i = 1; i < lines.Count; i++)
        {
            if (string.IsNullOrWhiteSpace(lines[i])) continue;
            var cols = SplitCsvLine(lines[i]);
            if (cols.Count < 10) continue;

            var row = new ParsedRow
            {
                LineNumber = i + 1,
                NoSanad = ParseInt(cols[0]),
                DateIn = (cols[1] ?? "").Trim(),
                ParentSharh = (cols[2] ?? "").Trim(),
                ItemSharh = (cols[3] ?? "").Trim(),
                MabBed = ParseDecimal(cols[4]),
                MabBes = ParseDecimal(cols[5]),
                RowNum = ParseInt(cols[6]),
                CodeCol = ParseInt(cols[7]),
                CodeMoein = ParseInt(cols[8]),
                CodeTafzil = ParseInt(cols[9]),
                CodeTafzili2 = cols.Count > 10 ? ParseInt(cols[10]) : 0,
                Tafzili2Id = cols.Count > 11 ? ParseInt(cols[11]) : 0,
                Meghdar = cols.Count > 12 ? ParseDecimal(cols[12]) : 0m
            };

            // ⭐⭐ نادیده گرفتن خطوط کاملاً خالی
            if (row.NoSanad == 0 && row.CodeCol == 0 && row.MabBed == 0 && row.MabBes == 0)
            {
                continue;
            }

            result.Add(row);
        }
        return result;
    }
    public async Task<List<int>> GetAllNoSanadAsync(
    long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var list = await conn.QueryAsync<int>(
            new CommandDefinition("SELECT NO_Sanad FROM ParentSanad",
                cancellationToken: ct));
        return list.ToList();
    }

    // ═══════════════════════════════════════════════════
    //  تغییر وضعیت گروهی اسناد
    // ═══════════════════════════════════════════════════
    public async Task<BulkChangeVazeitResult> BulkChangeVazeitAsync(
        long orgId, long fyId,
        List<long> sanadIds, int targetVazeit,
        long userCode, CancellationToken ct = default)
    {
        if (sanadIds == null || sanadIds.Count == 0)
            throw new InvalidOperationException("هیچ سندی انتخاب نشده است");

        if (targetVazeit < 0 || targetVazeit > 2)
            throw new InvalidOperationException("وضعیت مقصد نامعتبر است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── ۱. لیست اسناد و وضعیت فعلی ───
            var items = (await conn.QueryAsync<(long Id, int Vazeit)>(
                new CommandDefinition(
                    @"SELECT ParentSanadID, Vazeit
                      FROM ParentSanad
                      WHERE ParentSanadID IN @ids",
                    new { ids = sanadIds },
                    transaction: tx, cancellationToken: ct))).ToList();

            var result = new BulkChangeVazeitResult();
            var toUpdate = new List<long>();

            // ─── ۲. اعتبارسنجی هر سند ───
            foreach (var item in items)
            {
                if (item.Vazeit == targetVazeit)
                {
                    result.SkippedCount++;
                    continue;
                }

                // ⭐ برای رسیدگی/قطعی: چک ایراد
                if (targetVazeit >= 1)
                {
                    var errInfo = await GetSanadErrorInfoAsync(conn, tx, item.Id, ct);

                    if (targetVazeit == 1 && errInfo.HasCodingError)
                    {
                        result.Errors.Add($"سند {item.Id}: کدینگ ناقص دارد");
                        result.SkippedCount++;
                        continue;
                    }

                    if (targetVazeit == 2)
                    {
                        if (errInfo.HasCodingError)
                        {
                            result.Errors.Add($"سند {item.Id}: کدینگ ناقص دارد");
                            result.SkippedCount++;
                            continue;
                        }
                        if (!errInfo.IsBalanced)
                        {
                            result.Errors.Add($"سند {item.Id}: تراز نیست");
                            result.SkippedCount++;
                            continue;
                        }
                    }
                }

                toUpdate.Add(item.Id);
            }

            if (toUpdate.Count == 0)
            {
                tx.Rollback();
                return result;
            }

            // ─── ۳. آپدیت گروهی ───
            var todayPersian = GetTodayPersian();
            var nowTime = GetCurrentTime();

            await conn.ExecuteAsync(
                new CommandDefinition(
                    @"UPDATE ParentSanad
                      SET Vazeit = @targetVazeit,
                          Updater = @userCode,
                          Code_Op = @userCode,
                          Date_Op = @dateOp,
                          Time_Op = @timeOp
                      WHERE ParentSanadID IN @ids",
                    new
                    {
                        targetVazeit = targetVazeit,
                        userCode = userCode,
                        dateOp = todayPersian,
                        timeOp = nowTime,
                        ids = toUpdate
                    },
                    transaction: tx, cancellationToken: ct));

            tx.Commit();

            result.UpdatedCount = toUpdate.Count;
            result.UpdatedIds = toUpdate;
            return result;
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ⭐ Helper: چک خطا و تراز یک سند
    private async Task<(bool HasCodingError, bool IsBalanced)> GetSanadErrorInfoAsync(
        System.Data.IDbConnection conn,
        System.Data.IDbTransaction tx,
        long parentSanadId,
        CancellationToken ct)
    {
        const string sql = @"
            SELECT 
                SUM(CASE 
                    WHEN (Code_Col IS NULL OR Code_Col = 0) 
                         AND (ISNULL(Mab_Bed,0) <> 0 OR ISNULL(Mab_Bes,0) <> 0)
                    THEN 1 ELSE 0 
                END) AS CodingErrors,
                SUM(ISNULL(Mab_Bed, 0)) AS TotalBed,
                SUM(ISNULL(Mab_Bes, 0)) AS TotalBes
            FROM Sanad
            WHERE ParentSanadCode = @id";

        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(sql, new { id = parentSanadId },
                transaction: tx, cancellationToken: ct));

        if (row == null) return (false, true);

        int codingErrors = (int)(decimal)(row.CodingErrors ?? 0);
        decimal totalBed = (decimal)(row.TotalBed ?? 0);
        decimal totalBes = (decimal)(row.TotalBes ?? 0);
        bool balanced = Math.Abs(totalBed - totalBes) < 0.01m;

        return (codingErrors > 0, balanced);
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
    // ⭐⭐ چک دسترسی برای تغییر Vazeit
    private void ValidateVazeitChange(int originalVazeit, int newVazeit, IEnumerable<int> userPerms)
    {
        if (originalVazeit == newVazeit) return;

        var perms = userPerms?.ToHashSet() ?? new HashSet<int>();

        // از قطعی (2) → نیاز به 103
        if (originalVazeit == 2 && !perms.Contains(103))
        {
            throw new InvalidOperationException(
                "برای تغییر وضعیت سند قطعی به دسترسی ۱۰۳ (تغییر سندهای تأیید شده) نیاز دارید");
        }

        // از رسیدگی (1) → نیاز به 104 یا 105
        if (originalVazeit == 1 && !perms.Contains(104) && !perms.Contains(105))
        {
            throw new InvalidOperationException(
                "برای تغییر وضعیت سند رسیدگی به دسترسی ۱۰۴ نیاز دارید");
        }

        // از پیش‌نویس (0) → نیاز به 102
        if (originalVazeit == 0 && !perms.Contains(102))
        {
            throw new InvalidOperationException(
                "برای تغییر سند به دسترسی ۱۰۲ نیاز دارید");
        }
    }
    // ═══════════════════════════════════════════════════
    //  حذف گروهی اسناد
    // ═══════════════════════════════════════════════════
    public async Task<int> BulkDeleteAsync(
        long orgId, long fyId,
        List<long> sanadIds,
        long userCode,
        CancellationToken ct = default)
    {
        if (sanadIds == null || sanadIds.Count == 0)
            throw new InvalidOperationException("هیچ سندی انتخاب نشده است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ⭐⭐ بررسی: فقط اسناد پیش‌نویس قابل حذف هستن
            var nonDraftCount = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    @"SELECT COUNT(*) FROM ParentSanad
                      WHERE ParentSanadID IN @ids AND Vazeit <> 0",
                    new { ids = sanadIds },
                    transaction: tx, cancellationToken: ct));

            if (nonDraftCount > 0)
                throw new InvalidOperationException(
                    $"{nonDraftCount} سند در وضعیت «رسیدگی» یا «قطعی» قرار دارن و قابل حذف نیستن. " +
                    $"ابتدا وضعیت آن‌ها را به پیش‌نویس تغییر دهید.");

            // آرشیو به RecycleSanad
            await conn.ExecuteAsync(
                new CommandDefinition(@"
                    INSERT INTO RecycleSanad
                        (NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                         Code_Sharh, OtherSharh, Mab_Bed, Mab_Bes,
                         Code_Op, Date_Op, Time_Op, ResidNum, CheckType)
                    SELECT
                        NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil,
                        Code_Sharh, OtherSharh, Mab_Bed, Mab_Bes,
                        Code_Op, Date_Op, Time_Op, ResidNum, CheckType
                    FROM Sanad
                    WHERE ParentSanadCode IN @ids",
                    new { ids = sanadIds },
                    transaction: tx, cancellationToken: ct));

            // حذف ردیف‌ها
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM Sanad WHERE ParentSanadCode IN @ids",
                    new { ids = sanadIds },
                    transaction: tx, cancellationToken: ct));

            // حذف هدرها
            var deleted = await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM ParentSanad WHERE ParentSanadID IN @ids",
                    new { ids = sanadIds },
                    transaction: tx, cancellationToken: ct));

            tx.Commit();
            return deleted;
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════
    //  📋 Distinct Sharh lists (برای datalist)
    // ═══════════════════════════════════════════════════
    public async Task<List<string>> GetDistinctParentSharhAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 200 OtherParentSharh AS Sharh
            FROM ParentSanad
            WHERE OtherParentSharh IS NOT NULL 
              AND LTRIM(RTRIM(OtherParentSharh)) <> ''
            GROUP BY OtherParentSharh
            ORDER BY COUNT(*) DESC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var list = await conn.QueryAsync<string>(
            new CommandDefinition(sql, cancellationToken: ct));
        return list.ToList();
    }

    public async Task<List<string>> GetDistinctRowSharhAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 300 OtherSharh AS Sharh
            FROM Sanad
            WHERE OtherSharh IS NOT NULL 
              AND LTRIM(RTRIM(OtherSharh)) <> ''
            GROUP BY OtherSharh
            ORDER BY COUNT(*) DESC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var list = await conn.QueryAsync<string>(
            new CommandDefinition(sql, cancellationToken: ct));
        return list.ToList();
    }
}