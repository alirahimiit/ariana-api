using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Resid;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// Repository رسیدهای نقدی (CheckResids) — پرداخت و دریافت
/// معادل دلفی: TResid + TResidListForm
/// </summary>
public class ResidRepository : IResidRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ITreasurySanadService _sanadService;

    public ResidRepository(
        ITenantConnectionFactory factory,
        ITreasurySanadService sanadService)
    {
        _factory = factory;
        _sanadService = sanadService;
    }

    // ═══════════════════════════════════════════════════════
    //  Helperهای تاریخ و زمان
    // ═══════════════════════════════════════════════════════
    private static string GetTodayPersian()
    {
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }

    private static string GetCurrentTime() => DateTime.Now.ToString("HH:mm:ss");

    // ═══════════════════════════════════════════════════════
    //  لیست رسیدها
    // ═══════════════════════════════════════════════════════
    public async Task<ResidListResultDto> GetListAsync(
        long orgId, long fyId,
        ResidFilterDto filter,
        CancellationToken ct = default)
    {
        var where = new StringBuilder(" WHERE R.CheckKind = @checkKind ");
        var p = new DynamicParameters();
        p.Add("checkKind", filter.CheckKind);

        if (!string.IsNullOrWhiteSpace(filter.FromDate))
        {
            where.Append(" AND R.Date_In >= @fromDate ");
            p.Add("fromDate", filter.FromDate);
        }
        if (!string.IsNullOrWhiteSpace(filter.ToDate))
        {
            where.Append(" AND R.Date_In <= @toDate ");
            p.Add("toDate", filter.ToDate);
        }
        if (filter.FromNumber.HasValue)
        {
            where.Append(" AND R.ResidNumber >= @fromNumber ");
            p.Add("fromNumber", filter.FromNumber.Value);
        }
        if (filter.ToNumber.HasValue)
        {
            where.Append(" AND R.ResidNumber <= @toNumber ");
            p.Add("toNumber", filter.ToNumber.Value);
        }
        if (!string.IsNullOrWhiteSpace(filter.Descript))
        {
            where.Append(" AND R.Descript LIKE @descript ");
            p.Add("descript", "%" + filter.Descript.Trim() + "%");
        }
        if (filter.CodeCol is > 0)
        {
            where.Append(" AND R.Code_Col = @codeCol ");
            p.Add("codeCol", filter.CodeCol.Value);
        }
        if (filter.CodeMoein is > 0)
        {
            where.Append(" AND R.Code_Moein = @codeMoein ");
            p.Add("codeMoein", filter.CodeMoein.Value);
        }
        if (filter.CodeTafzili is > 0)
        {
            where.Append(" AND R.Code_Tafzili = @codeTafzili ");
            p.Add("codeTafzili", filter.CodeTafzili.Value);
        }

        // Sort
        var orderBy = "R.ResidNumber DESC";
        if (!string.IsNullOrWhiteSpace(filter.SortBy))
        {
            var dir = string.Equals(filter.SortDir, "asc", StringComparison.OrdinalIgnoreCase)
                ? "ASC" : "DESC";
            var allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["residNumber"] = "R.ResidNumber",
                ["dateIn"] = "R.Date_In",
                ["cashCost"] = "R.Cash_Cost",
                ["descript"] = "R.Descript"
            };
            if (allowed.TryGetValue(filter.SortBy, out var col))
                orderBy = $"{col} {dir}";
        }

        if (filter.Page < 1) filter.Page = 1;
        if (filter.PageSize < 1 || filter.PageSize > 1000) filter.PageSize = 100;
        var offset = (filter.Page - 1) * filter.PageSize;

        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + filter.PageSize);

        // ── COUNT ──
        var countSql = $"SELECT COUNT(*) FROM CheckResids R {where}";

        // ── DATA (با JOIN برای نام‌ها) ──
        var dataSql = $@"
            SELECT * FROM (
                SELECT
                    R.ID,
                    R.ResidNumber,
                    R.Date_In           AS DateIn,
                    R.CheckKind,
                    R.Cash_Cost         AS CashCost,
                    ISNULL(R.Descript, '') AS Descript,
                    ISNULL(R.Code_Col, 0)     AS CodeCol,
                    ISNULL(R.Code_Moein, 0)   AS CodeMoein,
                    ISNULL(R.Code_Tafzili, 0) AS CodeTafzili,
                    ISNULL(R.ParentSanadID, 0)  AS ParentSanadID,
                    ISNULL(R.SanadCashID, 0)    AS SanadCashID,
                    ISNULL(R.SanadPersonID, 0)  AS SanadPersonID,
                    ISNULL(H1.Name, '')   AS ColName,
                    ISNULL(H2.Name, '')   AS MoeinName,
                    ISNULL(H3.Name, '')   AS TafziliName,
                    P.NO_Sanad  AS NoSanad,
                    ISNULL(P.Vazeit, -1) AS SanadVazeit,
                    ROW_NUMBER() OVER (ORDER BY {orderBy}) AS RowNum
                FROM CheckResids R
                LEFT JOIN ParentSanad P
                       ON P.ParentSanadID = R.ParentSanadID
                LEFT JOIN Hesab H1
                       ON R.Code_Col > 0
                      AND H1.Code_Col  = R.Code_Col
                      AND H1.Code_Moein = 0
                      AND H1.Code_Tafzil = 0
                LEFT JOIN Hesab H2
                       ON R.Code_Col > 0
                      AND R.Code_Moein > 0
                      AND H2.Code_Col   = R.Code_Col
                      AND H2.Code_Moein = R.Code_Moein
                      AND H2.Code_Tafzil = 0
                LEFT JOIN Hesab H3
                       ON R.Code_Tafzili > 0
                      AND H3.Code_Col    = -1
                      AND H3.Code_Moein  = 0
                      AND H3.Code_Tafzil = R.Code_Tafzili
                {where}
            ) T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        var items = (await conn.QueryAsync<ResidListDto>(
            new CommandDefinition(dataSql, p, cancellationToken: ct))).ToList();

        return new ResidListResultDto
        {
            Items = items,
            TotalCount = total,
            Page = filter.Page,
            PageSize = filter.PageSize
        };
    }

    // ═══════════════════════════════════════════════════════
    //  جزئیات یک رسید
    // ═══════════════════════════════════════════════════════
    public async Task<ResidDetailDto?> GetByIdAsync(
        long orgId, long fyId, long id,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT
                R.ID,
                R.ResidNumber,
                R.Date_In           AS DateIn,
                R.CheckKind,
                R.Cash_Cost         AS CashCost,
                ISNULL(R.Descript, '') AS Descript,
                ISNULL(R.Code_Col, 0)     AS CodeCol,
                ISNULL(R.Code_Moein, 0)   AS CodeMoein,
                ISNULL(R.Code_Tafzili, 0) AS CodeTafzili,
                ISNULL(R.ParentSanadID, 0)  AS ParentSanadID,
                ISNULL(R.SanadCashID, 0)    AS SanadCashID,
                ISNULL(R.SanadPersonID, 0)  AS SanadPersonID,
                ISNULL(H1.Name, '')   AS ColName,
                ISNULL(H2.Name, '')   AS MoeinName,
                ISNULL(H3.Name, '')   AS TafziliName,
                P.NO_Sanad  AS NoSanad,
                ISNULL(P.Vazeit, -1) AS SanadVazeit
            FROM CheckResids R
            LEFT JOIN ParentSanad P
                   ON P.ParentSanadID = R.ParentSanadID
            LEFT JOIN Hesab H1
                   ON R.Code_Col > 0
                  AND H1.Code_Col = R.Code_Col
                  AND H1.Code_Moein = 0
                  AND H1.Code_Tafzil = 0
            LEFT JOIN Hesab H2
                   ON R.Code_Col > 0
                  AND R.Code_Moein > 0
                  AND H2.Code_Col   = R.Code_Col
                  AND H2.Code_Moein = R.Code_Moein
                  AND H2.Code_Tafzil = 0
            LEFT JOIN Hesab H3
                   ON R.Code_Tafzili > 0
                  AND H3.Code_Col   = -1
                  AND H3.Code_Moein = 0
                  AND H3.Code_Tafzil = R.Code_Tafzili
            WHERE R.ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<ResidDetailDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════
    //  شماره رسید بعدی
    // ═══════════════════════════════════════════════════════
    public async Task<int> GetNextNumberAsync(
        long orgId, long fyId, int checkKind,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT ISNULL(MAX(ResidNumber), 0) + 1
            FROM CheckResids
            WHERE CheckKind = @checkKind";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, new { checkKind }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════
    //  وضعیت سند (برای قفل ویرایش)
    // ═══════════════════════════════════════════════════════
    public async Task<int> GetSanadVazeitAsync(
        long orgId, long fyId, long parentSanadId,
        CancellationToken ct = default)
    {
        if (parentSanadId <= 0) return -1;

        const string sql = "SELECT Vazeit FROM ParentSanad WHERE ParentSanadID = @id";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var v = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition(sql, new { id = parentSanadId }, cancellationToken: ct));
        return v ?? -1;
    }

    // ═══════════════════════════════════════════════════════
    //  لیست ParentSanad برای Combo
    // ═══════════════════════════════════════════════════════
    public async Task<IEnumerable<ResidSanadComboDto>> GetParentSanadListAsync(
        long orgId, long fyId,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                ParentSanadID,
                NO_Sanad  AS NoSanad,
                Date_IN   AS DateIn,
                OtherParentSharh AS Sharh,
                Vazeit
            FROM ParentSanad
            WHERE Vazeit <> 2
            ORDER BY NO_Sanad";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<ResidSanadComboDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════
    //  CREATE
    // ═══════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════
    //  CREATE — اصلاح‌شده: اول رسید، بعد سند
    // ═══════════════════════════════════════════════════════
    public async Task<ResidCreateResultDto> CreateAsync(
        long orgId, long fyId,
        ResidCreateDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.CashCost <= 0)
            throw new InvalidOperationException("مبلغ رسید باید بزرگ‌تر از صفر باشد");
        if (dto.CodeCol <= 0)
            throw new InvalidOperationException("کد کل طرف حساب وارد نشده است");
        if (dto.CheckKind != 0 && dto.CheckKind != 1)
            throw new InvalidOperationException("نوع رسید نامعتبر است");
        if (string.IsNullOrWhiteSpace(dto.DateIn))
            throw new InvalidOperationException("تاریخ رسید وارد نشده است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        var residNumber = dto.ResidNumber ?? 0;
        if (residNumber <= 0)
            residNumber = await GetNextNumberAsync(orgId, fyId, dto.CheckKind, ct);

        var dupCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM CheckResids WHERE ResidNumber = @n AND CheckKind = @k",
                new { n = residNumber, k = dto.CheckKind }, cancellationToken: ct));
        if (dupCount > 0)
            throw new InvalidOperationException($"شماره رسید {residNumber} تکراری است");

        if (dto.ParentSanadID is > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, dto.ParentSanadID.Value, ct);
            if (v == -1) throw new InvalidOperationException("سند انتخاب‌شده یافت نشد");
            if (v == 2) throw new InvalidOperationException("سند انتخاب‌شده قطعی است");
        }

        var today = GetTodayPersian();
        var now = GetCurrentTime();

        using var tx = conn.BeginTransaction();
        try
        {
            // ═══ ۱. درج اولیه رسید (بدون سند) ═══
            const string insertResidSql = @"
            INSERT INTO CheckResids
                (ResidNumber, Date_In, CheckKind, Cash_Cost, Descript,
                 Code_Col, Code_Moein, Code_Tafzili,
                 ParentSanadID, SanadCashID, SanadPersonID, KindSanad,
                 Code_op, Date_op, Time_Op)
            OUTPUT INSERTED.ID
            VALUES
                (@residNumber, @dateIn, @checkKind, @cashCost, @descript,
                 @codeCol, @codeMoein, @codeTafzili,
                 0, 0, 0, 0,
                 @userCode, @today, @now)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertResidSql, new
                {
                    residNumber,
                    dateIn = dto.DateIn ?? "",
                    checkKind = dto.CheckKind,
                    cashCost = dto.CashCost,
                    descript = dto.Descript ?? "",
                    codeCol = dto.CodeCol,
                    codeMoein = dto.CodeMoein,
                    codeTafzili = dto.CodeTafzili,
                    userCode,
                    today,
                    now
                }, transaction: tx, cancellationToken: ct));

            // ═══ ۲. اگر SaveWithSanad روشن است → سند بساز ═══
            ResidSanadResult? sanadResult = null;

            if (dto.SaveWithSanad)
            {
                var (cashCol, cashMoein) = await _sanadService.GetCashHesabAsync(conn, tx, ct);
                var personName = (await _sanadService.GetHesabNameAsync(
                            conn, tx, dto.CodeCol, dto.CodeMoein, dto.CodeTafzili, ct)) ?? "";

                var ctx = new ResidSanadContext
                {
                    CheckKind = dto.CheckKind,
                    ResidId = newId,
                    ResidNumber = residNumber,
                    DateIn = dto.DateIn ?? "",
                    CashCost = dto.CashCost,
                    Descript = dto.Descript ?? "",
                    PersonCodeCol = dto.CodeCol,
                    PersonCodeMoein = dto.CodeMoein,
                    PersonCodeTafzili = dto.CodeTafzili,
                    PersonName = personName ?? "",
                    CashCodeCol = cashCol,
                    CashCodeMoein = cashMoein,
                    ExistingParentSanadID = dto.ParentSanadID,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0)
                    ? dto.NoSanad.Value : null,
                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                sanadResult = await _sanadService.CreateResidSanadAsync(conn, tx, ctx, ct);

                // ═══ ۳. UPDATE رسید با شناسه‌های سند ═══
                await conn.ExecuteAsync(
                    new CommandDefinition(@"
                    UPDATE CheckResids
                    SET ParentSanadID = @pid,
                        SanadCashID   = @cashId,
                        SanadPersonID = @personId
                    WHERE ID = @id",
                        new
                        {
                            id = newId,
                            pid = sanadResult.ParentSanadID,
                            cashId = sanadResult.CashSanadID,
                            personId = sanadResult.PersonSanadID
                        }, transaction: tx, cancellationToken: ct));
            }

            tx.Commit();

            return new ResidCreateResultDto
            {
                ID = newId,
                ResidNumber = residNumber,
                ParentSanadID = sanadResult?.ParentSanadID ?? 0,
                NoSanad = sanadResult?.NoSanad
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  UPDATE — مشابه Create: اول حذف سند قبلی، بعد آپدیت، بعد سند جدید
    // ═══════════════════════════════════════════════════════
    public async Task UpdateAsync(
       long orgId, long fyId,
       ResidUpdateDto dto, long userCode,
       CancellationToken ct = default)
    {
        if (dto.ID <= 0)
            throw new InvalidOperationException("شناسه رسید نامعتبر است");
        if (dto.CashCost <= 0)
            throw new InvalidOperationException("مبلغ رسید باید بزرگ‌تر از صفر باشد");
        if (dto.CodeCol <= 0)
            throw new InvalidOperationException("کد کل طرف حساب وارد نشده است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        // ⭐ جدید: SanadCashID و SanadPersonID رو هم بگیر
        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(
                "SELECT ID, ResidNumber, CheckKind, ParentSanadID, SanadCashID, SanadPersonID FROM CheckResids WHERE ID = @id",
                new { id = dto.ID }, cancellationToken: ct));

        if (current == null)
            throw new InvalidOperationException("رسید یافت نشد");

        long oldParentSanadID = (long)(decimal)(current.ParentSanadID ?? 0);
        long oldSanadCashID = (long)(decimal)(current.SanadCashID ?? 0);
        long oldSanadPersonID = (long)(decimal)(current.SanadPersonID ?? 0);

        if (oldParentSanadID > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, oldParentSanadID, ct);
            if (v == 2)
                throw new InvalidOperationException(
                    "به دليل قطعي بودن سند مربوطه، شما قادر به ويرايش اين رسيد نيستيد");
        }

        var newResidNumber = dto.ResidNumber ?? 0;
        if (newResidNumber > 0)
        {
            var dup = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM CheckResids WHERE ResidNumber = @n AND CheckKind = @k AND ID <> @id",
                    new { n = newResidNumber, k = dto.CheckKind, id = dto.ID },
                    cancellationToken: ct));
            if (dup > 0)
                throw new InvalidOperationException($"شماره رسید {newResidNumber} تکراری است");
        }
        else
        {
            newResidNumber = (int)(decimal)current.ResidNumber;
        }

        var today = GetTodayPersian();
        var now = GetCurrentTime();

        using var tx = conn.BeginTransaction();
        try
        {
            // ═══ ۱. حذف سند قبلی (فقط ردیف‌های خود رسید) ═══
            if (oldParentSanadID > 0)
            {
                await _sanadService.DeleteResidSanadAsync(
                    conn, tx, oldParentSanadID,
                    sanadCashId: oldSanadCashID,
                    sanadPersonId: oldSanadPersonID,
                    ct: ct);
            }

            // ═══ ۲. آپدیت رسید ═══
            await conn.ExecuteAsync(
                new CommandDefinition(@"
            UPDATE CheckResids
            SET ResidNumber = @residNumber,
                Date_In     = @dateIn,
                Cash_Cost   = @cashCost,
                Descript    = @descript,
                Code_Col    = @codeCol,
                Code_Moein  = @codeMoein,
                Code_Tafzili= @codeTafzili,
                ParentSanadID = 0,
                SanadCashID   = 0,
                SanadPersonID = 0,
                Code_op     = @userCode,
                Date_op     = @today,
                Time_Op     = @now
            WHERE ID = @id",
                    new
                    {
                        id = dto.ID,
                        residNumber = newResidNumber,
                        dateIn = dto.DateIn ?? "",
                        cashCost = dto.CashCost,
                        descript = dto.Descript ?? "",
                        codeCol = dto.CodeCol,
                        codeMoein = dto.CodeMoein,
                        codeTafzili = dto.CodeTafzili,
                        userCode,
                        today,
                        now
                    }, transaction: tx, cancellationToken: ct));

            // ═══ ۳. اگر SaveWithSanad روشن است → سند جدید بساز ═══
            if (dto.SaveWithSanad)
            {
                var (cashCol, cashMoein) = await _sanadService.GetCashHesabAsync(conn, tx, ct);
                var personName = (await _sanadService.GetHesabNameAsync(
                    conn, tx, dto.CodeCol, dto.CodeMoein, dto.CodeTafzili, ct)) ?? "";

                var ctx = new ResidSanadContext
                {
                    CheckKind = dto.CheckKind,
                    ResidId = dto.ID,
                    ResidNumber = newResidNumber,
                    DateIn = dto.DateIn ?? "",
                    CashCost = dto.CashCost,
                    Descript = dto.Descript ?? "",
                    PersonCodeCol = dto.CodeCol,
                    PersonCodeMoein = dto.CodeMoein,
                    PersonCodeTafzili = dto.CodeTafzili,
                    PersonName = personName,
                    CashCodeCol = cashCol,
                    CashCodeMoein = cashMoein,
                    ExistingParentSanadID = dto.ParentSanadID,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0)
                    ? dto.NoSanad.Value : null,
                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var sanadResult = await _sanadService.CreateResidSanadAsync(conn, tx, ctx, ct);

                await conn.ExecuteAsync(
                    new CommandDefinition(@"
                UPDATE CheckResids
                SET ParentSanadID = @pid,
                    SanadCashID   = @cashId,
                    SanadPersonID = @personId
                WHERE ID = @id",
                        new
                        {
                            id = dto.ID,
                            pid = sanadResult.ParentSanadID,
                            cashId = sanadResult.CashSanadID,
                            personId = sanadResult.PersonSanadID
                        }, transaction: tx, cancellationToken: ct));
            }

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
    // ═══════════════════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════════════════
    public async Task DeleteAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        // ⭐ جدید: SanadCashID و SanadPersonID رو هم بگیر
        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(
                @"SELECT ID, ParentSanadID, SanadCashID, SanadPersonID FROM CheckResids WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (current == null)
            throw new InvalidOperationException("رسید یافت نشد");

        long parentSanadID = (long)(decimal)(current.ParentSanadID ?? 0);
        long sanadCashID = (long)(decimal)(current.SanadCashID ?? 0);
        long sanadPersonID = (long)(decimal)(current.SanadPersonID ?? 0);

        // ── چک قطعی نبودن سند ──
        if (parentSanadID > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, parentSanadID, ct);
            if (v == 2)
                throw new InvalidOperationException(
                    "به دليل قطعي بودن سند مربوطه، شما قادر به حذف اين رسيد نيستيد");
        }

        using var tx = conn.BeginTransaction();
        try
        {
            // ── حذف سند (فقط ردیف‌های خود رسید) ──
            if (parentSanadID > 0)
            {
                await _sanadService.DeleteResidSanadAsync(
                    conn, tx, parentSanadID,
                    sanadCashId: sanadCashID,
                    sanadPersonId: sanadPersonID,
                    ct: ct);
            }

            // ── حذف رسید ──
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM CheckResids WHERE ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
}