using System.Data;
using System.Globalization;
using System.Text;
using ArianaAPI.Application.DTOs.Cheque;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// Repository چک‌های پرداختی (CheckPay)
/// معادل دلفی: TChequePay + TChequePayListForm
/// 
/// چرخه‌ی حیات:
///   Create → ChequeOK=0 (در جریان، سند Create)
///   OK     → ChequeOK=1 (وصول‌شده، سند OK)
///   UnOK   → ChequeOK=0 (لغو اعلام)
///   Return → ChequeOK=2 (برگشتی، سند Return)
/// </summary>
public class ChequePayRepository : IChequePayRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly IChequeSanadService _sanadService;

    public ChequePayRepository(
        ITenantConnectionFactory factory,
        IChequeSanadService sanadService)
    {
        _factory = factory;
        _sanadService = sanadService;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Helpers تاریخ/زمان
    // ═══════════════════════════════════════════════════════════════
    private static string GetTodayPersian()
    {
        var pc = new PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }

    private static string GetCurrentTime() => DateTime.Now.ToString("HH:mm:ss");

    // ═══════════════════════════════════════════════════════════════
    //  READ — لیست
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequePayListResultDto> GetListAsync(
        long orgId, long fyId,
        ChequePayFilterDto filter,
        CancellationToken ct = default)
    {
        var where = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        // ─── شماره رسید ───
        if (filter.FromNumber.HasValue)
        {
            where.Append(" AND CP.ResidNumber >= @fromNumber ");
            p.Add("fromNumber", filter.FromNumber.Value);
        }
        if (filter.ToNumber.HasValue)
        {
            where.Append(" AND CP.ResidNumber <= @toNumber ");
            p.Add("toNumber", filter.ToNumber.Value);
        }

        // ─── تاریخ رسید ───
        if (!string.IsNullOrWhiteSpace(filter.FromDate))
        {
            where.Append(" AND CP.ResidDate >= @fromDate ");
            p.Add("fromDate", filter.FromDate.Trim());
        }
        if (!string.IsNullOrWhiteSpace(filter.ToDate))
        {
            where.Append(" AND CP.ResidDate <= @toDate ");
            p.Add("toDate", filter.ToDate.Trim());
        }

        // ─── تاریخ چک ───
        if (!string.IsNullOrWhiteSpace(filter.CheckFromDate))
        {
            where.Append(" AND CP.CheckDate >= @checkFromDate ");
            p.Add("checkFromDate", filter.CheckFromDate.Trim());
        }
        if (!string.IsNullOrWhiteSpace(filter.CheckToDate))
        {
            where.Append(" AND CP.CheckDate <= @checkToDate ");
            p.Add("checkToDate", filter.CheckToDate.Trim());
        }

        // ─── شماره چک ───
        if (!string.IsNullOrWhiteSpace(filter.CheckFromSerial))
        {
            where.Append(" AND CP.CheckSeries >= @checkFromSerial ");
            p.Add("checkFromSerial", filter.CheckFromSerial.Trim());
        }
        if (!string.IsNullOrWhiteSpace(filter.CheckToSerial))
        {
            where.Append(" AND CP.CheckSeries <= @checkToSerial ");
            p.Add("checkToSerial", filter.CheckToSerial.Trim());
        }

        // ─── شرح ───
        if (!string.IsNullOrWhiteSpace(filter.Descript))
        {
            where.Append(" AND CP.ResidDes LIKE @descript ");
            p.Add("descript", "%" + filter.Descript.Trim() + "%");
        }

        // ─── بانک ───
        if (filter.BankAccId is > 0)
        {
            where.Append(" AND CP.BankAccID = @bankAccId ");
            p.Add("bankAccId", filter.BankAccId.Value);
        }

        // ─── طرف حساب ───
        if (filter.CodeCol is > 0)
        {
            where.Append(" AND CP.Code_Col = @codeCol ");
            p.Add("codeCol", filter.CodeCol.Value);
        }
        if (filter.CodeMoein is > 0)
        {
            where.Append(" AND CP.Code_Moein = @codeMoein ");
            p.Add("codeMoein", filter.CodeMoein.Value);
        }
        if (filter.CodeTafzil is > 0)
        {
            where.Append(" AND CP.Code_Tafzil = @codeTafzil ");
            p.Add("codeTafzil", filter.CodeTafzil.Value);
        }

        // ─── Sort ───
        var orderBy = "CP.ResidNumber DESC, CP.ID DESC";
        if (!string.IsNullOrWhiteSpace(filter.SortBy))
        {
            var dir = string.Equals(filter.SortDir, "asc", StringComparison.OrdinalIgnoreCase)
                ? "ASC" : "DESC";
            var allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["residNumber"] = "CP.ResidNumber",
                ["residDate"] = "CP.ResidDate",
                ["checkDate"] = "CP.CheckDate",
                ["checkSeries"] = "CP.CheckSeries",
                ["checkMab"] = "CP.CheckMab",
                ["checkPerson"] = "CP.CheckPerson",
                ["bankName"] = "B.Name",
                ["bankShobe"] = "A.Shobe",
                ["bankNoHesab"] = "A.NoHesab"
            };
            if (allowed.TryGetValue(filter.SortBy, out var col))
                orderBy = $"{col} {dir}";
        }

        if (filter.Page < 1) filter.Page = 1;
        if (filter.PageSize < 1 || filter.PageSize > 1000) filter.PageSize = 100;
        var offset = (filter.Page - 1) * filter.PageSize;

        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + filter.PageSize);

        // ─── COUNT ───
        var countSql = $"SELECT COUNT(*) FROM CheckPay CP {where}";

        // ─── DATA ───
        var dataSql = $@"
            SELECT * FROM (
                SELECT
                    CP.ID               AS Id,
                    ISNULL(CP.BankAccID, 0) AS BankAccId,
                    ISNULL(B.Name, '')  AS BankName,
                    ISNULL(A.Shobe, '') AS BankShobe,
                    ISNULL(A.NoHesab, '') AS BankNoHesab,

                    ISNULL(CP.CheckSeries, '') AS CheckSeries,
                    ISNULL(CP.CheckMab, 0)     AS CheckMab,
                    ISNULL(CP.CheckDate, '')   AS CheckDate,
                    ISNULL(CP.CheckPerson, '') AS CheckPerson,

                    ISNULL(CP.ResidNumber, 0)  AS ResidNumber,
                    ISNULL(CP.ResidDate, '')   AS ResidDate,
                    ISNULL(CP.ResidDes, '')    AS ResidDes,

                    ISNULL(CP.ChequeOK, 0)  AS ChequeOK,
                    ISNULL(CP.CheckState, 0) AS CheckState,
                    ISNULL(CP.OkDate, '')    AS OkDate,

                    ISNULL(CP.Code_Col, 0)     AS CodeCol,
                    ISNULL(CP.Code_Moein, 0)   AS CodeMoein,
                    ISNULL(CP.Code_Tafzil, 0)  AS CodeTafzil,
                    ISNULL(H1.Name, '') AS ColName,
                    ISNULL(H2.Name, '') AS MoeinName,
                    ISNULL(H3.Name, '') AS TafzilName,

                    ISNULL(CP.ParentSanadID, 0) AS ParentSanadId,
                    ISNULL(PS.NO_Sanad, 0)      AS NoSanad,
                    ISNULL(PS.Vazeit, -1)       AS SanadVazeit,

                    ROW_NUMBER() OVER (ORDER BY {orderBy}) AS RowNum
                FROM CheckPay CP
                LEFT JOIN BankAcc A   ON A.ID = CP.BankAccID
                LEFT JOIN Bank B      ON B.ID = A.BankID
                LEFT JOIN ParentSanad PS ON PS.ParentSanadID = CP.ParentSanadID

                LEFT JOIN Hesab H1
                       ON CP.Code_Col > 0
                      AND H1.Code_Col = CP.Code_Col
                      AND ISNULL(H1.Code_Moein, 0) = 0
                      AND ISNULL(H1.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H2
                       ON CP.Code_Col > 0
                      AND CP.Code_Moein > 0
                      AND H2.Code_Col = CP.Code_Col
                      AND H2.Code_Moein = CP.Code_Moein
                      AND ISNULL(H2.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H3
                       ON CP.Code_Tafzil > 0
                      AND H3.Code_Col = -1
                      AND ISNULL(H3.Code_Moein, 0) = 0
                      AND H3.Code_Tafzil = CP.Code_Tafzil

                {where}
            ) T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        var items = (await conn.QueryAsync<ChequePayListDto>(
            new CommandDefinition(dataSql, p, cancellationToken: ct))).ToList();

        return new ChequePayListResultDto
        {
            Items = items,
            TotalCount = total,
            Page = filter.Page,
            PageSize = filter.PageSize
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  READ — جزئیات
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequePayDetailDto?> GetByIdAsync(
        long orgId, long fyId, long id,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT
                CP.ID AS Id,
                ISNULL(CP.BankAccID, 0) AS BankAccId,
                ISNULL(B.Name, '')  AS BankName,
                ISNULL(A.Shobe, '') AS BankShobe,
                ISNULL(A.NoHesab, '') AS BankNoHesab,

                ISNULL(CP.CheckSeries, '') AS CheckSeries,
                ISNULL(CP.CheckMab, 0)     AS CheckMab,
                ISNULL(CP.CheckDate, '')   AS CheckDate,
                ISNULL(CP.CheckPerson, '') AS CheckPerson,

                ISNULL(CP.ResidNumber, 0)  AS ResidNumber,
                ISNULL(CP.ResidDate, '')   AS ResidDate,
                ISNULL(CP.ResidDes, '')    AS ResidDes,

                ISNULL(CP.ChequeOK, 0)  AS ChequeOK,
                ISNULL(CP.CheckState, 0) AS CheckState,
                ISNULL(CP.OkDate, '')   AS OkDate,
                ISNULL(CP.IsNaghd, 0)   AS IsNaghd,

                -- طرف حساب
                ISNULL(CP.Code_Col, 0)    AS CodeCol,
                ISNULL(CP.Code_Moein, 0)  AS CodeMoein,
                ISNULL(CP.Code_Tafzil, 0) AS CodeTafzil,
                ISNULL(H1.Name, '') AS ColName,
                ISNULL(H2.Name, '') AS MoeinName,
                ISNULL(H3.Name, '') AS TafzilName,

                -- بانک (پرداخت)
                ISNULL(CP.Code_Col_Pay, 0)    AS CodeColPay,
                ISNULL(CP.Code_Moein_Pay, 0)  AS CodeMoeinPay,
                ISNULL(CP.Code_Tafzil_Pay, 0) AS CodeTafzilPay,
                ISNULL(H4.Name, '') AS ColPayName,
                ISNULL(H5.Name, '') AS MoeinPayName,
                ISNULL(H6.Name, '') AS TafzilPayName,

                -- OK
                ISNULL(CP.Code_Col_OK, 0)    AS CodeColOk,
                ISNULL(CP.Code_Moein_OK, 0)  AS CodeMoeinOk,
                ISNULL(CP.Code_Tafzil_OK, 0) AS CodeTafzilOk,
                ISNULL(CP.Code_Col_Pay_OK, 0)    AS CodeColPayOk,
                ISNULL(CP.Code_Moein_Pay_OK, 0)  AS CodeMoeinPayOk,
                ISNULL(CP.Code_Tafzil_Pay_OK, 0) AS CodeTafzilPayOk,
                ISNULL(CP.ParentSanadOKID, 0) AS ParentSanadOkId,
                ISNULL(CP.SanadIDBed, 0) AS SanadIdBed,
                ISNULL(CP.SanadIDBes, 0) AS SanadIdBes,
                ISNULL(CP.SanadPersonID, 0) AS SanadPersonId,
                ISNULL(CP.SanadID, 0) AS SanadId,

                -- Return
                ISNULL(CP.UnOkDate, '') AS UnOkDate,
                ISNULL(CP.UnOkParentSanadID, 0) AS UnOkParentSanadId,
                ISNULL(CP.UnOkSanadIDBed, 0) AS UnOkSanadIdBed,
                ISNULL(CP.UnOkSanadIDBes, 0) AS UnOkSanadIdBes,

                -- سند اصلی
                ISNULL(CP.ParentSanadID, 0) AS ParentSanadId,
                ISNULL(PS.NO_Sanad, 0)      AS NoSanad,
                ISNULL(PS.Vazeit, -1)       AS SanadVazeit

            FROM CheckPay CP
            LEFT JOIN BankAcc A   ON A.ID = CP.BankAccID
            LEFT JOIN Bank B      ON B.ID = A.BankID
            LEFT JOIN ParentSanad PS ON PS.ParentSanadID = CP.ParentSanadID

            LEFT JOIN Hesab H1
                   ON CP.Code_Col > 0
                  AND H1.Code_Col = CP.Code_Col
                  AND ISNULL(H1.Code_Moein, 0) = 0
                  AND ISNULL(H1.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H2
                   ON CP.Code_Col > 0 AND CP.Code_Moein > 0
                  AND H2.Code_Col = CP.Code_Col
                  AND H2.Code_Moein = CP.Code_Moein
                  AND ISNULL(H2.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H3
                   ON CP.Code_Tafzil > 0
                  AND H3.Code_Col = -1
                  AND ISNULL(H3.Code_Moein, 0) = 0
                  AND H3.Code_Tafzil = CP.Code_Tafzil

            LEFT JOIN Hesab H4
                   ON CP.Code_Col_Pay > 0
                  AND H4.Code_Col = CP.Code_Col_Pay
                  AND ISNULL(H4.Code_Moein, 0) = 0
                  AND ISNULL(H4.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H5
                   ON CP.Code_Col_Pay > 0 AND CP.Code_Moein_Pay > 0
                  AND H5.Code_Col = CP.Code_Col_Pay
                  AND H5.Code_Moein = CP.Code_Moein_Pay
                  AND ISNULL(H5.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H6
                   ON CP.Code_Tafzil_Pay > 0
                  AND H6.Code_Col = -1
                  AND ISNULL(H6.Code_Moein, 0) = 0
                  AND H6.Code_Tafzil = CP.Code_Tafzil_Pay

            WHERE CP.ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<ChequePayDetailDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  READ — شماره رسید بعدی
    // ═══════════════════════════════════════════════════════════════
    public async Task<int> GetNextNumberAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = "SELECT ISNULL(MAX(ResidNumber), 0) + 1 FROM CheckPay";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  READ — لیست ParentSanad برای Combo
    // ═══════════════════════════════════════════════════════════════
    public async Task<IEnumerable<ChequeSanadComboDto>> GetParentSanadListAsync(
        long orgId, long fyId, CancellationToken ct = default)
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
        return await conn.QueryAsync<ChequeSanadComboDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  READ — وضعیت سند
    // ═══════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════
    //  CREATE — اول چک، بعد سند
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequePayCreateResultDto> CreateAsync(
        long orgId, long fyId,
        ChequePayCreateDto dto, long userCode,
        CancellationToken ct = default)
    {
        // ─── اعتبارسنجی ───
        if (dto.BankAccId <= 0)
            throw new InvalidOperationException("حساب بانکی الزامی است");
        if (dto.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");
        if (string.IsNullOrWhiteSpace(dto.CheckDate))
            throw new InvalidOperationException("تاریخ چک الزامی است");
        if (dto.CodeCol <= 0)
            throw new InvalidOperationException("کد کل طرف حساب الزامی است");
        if (string.IsNullOrWhiteSpace(dto.ResidDate))
            throw new InvalidOperationException("تاریخ رسید الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        // ─── شماره رسید ───
        var residNumber = dto.ResidNumber ?? 0;
        if (residNumber <= 0)
            residNumber = await GetNextNumberAsync(orgId, fyId, ct);

        var dup = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM CheckPay WHERE ResidNumber = @n",
                new { n = residNumber }, cancellationToken: ct));
        if (dup > 0)
            throw new InvalidOperationException($"شماره رسید {residNumber} تکراری است");

        // ─── BankAcc وجود دارد؟ ───
        var bankAccExists = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM BankAcc WHERE ID = @id",
                new { id = dto.BankAccId }, cancellationToken: ct));
        if (bankAccExists == 0)
            throw new InvalidOperationException("حساب بانکی انتخاب‌شده یافت نشد");

        // ─── ParentSanad (اگر داده شده) ───
        if (dto.ParentSanadId is > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, dto.ParentSanadId.Value, ct);
            if (v == -1) throw new InvalidOperationException("سند انتخاب‌شده یافت نشد");
            if (v == 2) throw new InvalidOperationException("سند انتخاب‌شده قطعی است");
        }

        var today = GetTodayPersian();
        var now = GetCurrentTime();

        using var tx = conn.BeginTransaction();
        try
        {
            // ═══ ۱. درج اولیه چک (بدون سند) ═══
            const string insertSql = @"
                INSERT INTO CheckPay
                    (BankAccID, CheckSeries, CheckMab, CheckDate, CheckPerson,
                     ResidNumber, SanadID, CheckState, IsNaghd,
                     Code_Col, Code_Moein, Code_Tafzil,
                     ChequeOK, OkDate, SanadIDBed, SanadIDBes,
                     ParentSanadOKID, ParentSanadID,
                     UnOkDate, UnOkSanadIDBed, UnOkSanadIDBes, UnOkParentSanadID,
                     ResidDes,
                     Code_Col_Pay, Code_Moein_Pay, Code_Tafzil_Pay,
                     ResidDate, SanadPersonID,
                     Code_Col_Pay_OK, Code_Moein_Pay_OK, Code_Tafzil_Pay_OK,
                     Code_Col_OK, Code_Moein_OK, Code_Tafzil_OK,
                     Code_OP, Date_OP, Time_Op)
                OUTPUT INSERTED.ID
                VALUES
                    (@bankAccId, @checkSeries, @checkMab, @checkDate, @checkPerson,
                     @residNumber, 0, 0, 0,
                     @codeCol, @codeMoein, @codeTafzil,
                     0, NULL, 0, 0,
                     0, 0,
                     NULL, 0, 0, 0,
                     @residDes,
                     0, 0, 0,
                     @residDate, 0,
                     0, 0, 0,
                     0, 0, 0,
                     @userCode, @today, @now)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertSql, new
                {
                    bankAccId = dto.BankAccId,
                    checkSeries = dto.CheckSeries ?? "",
                    checkMab = dto.CheckMab,
                    checkDate = dto.CheckDate ?? "",
                    checkPerson = dto.CheckPerson ?? "",
                    residNumber,
                    codeCol = dto.CodeCol,
                    codeMoein = dto.CodeMoein,
                    codeTafzil = dto.CodeTafzil,
                    residDes = dto.ResidDes ?? "",
                    residDate = dto.ResidDate ?? "",
                    userCode,
                    today,
                    now
                }, transaction: tx, cancellationToken: ct));

            // ═══ ۲. سند خودکار ═══
            long parentSanadId = 0;
            int? noSanad = null;
            long sanadPersonId = 0;
            long sanadBankId = 0;

            if (dto.SaveWithSanad)
            {
                // خواندن کدینگ بانک از BankAcc
                var (bankCol, bankMoein, bankTafzil, bankShobe, bankNoHesab) =
                    await _sanadService.GetBankAccHesabAsync(conn, tx, dto.BankAccId, ct);

                // نام بانک (برای شرح)
                var bankName = await conn.ExecuteScalarAsync<string?>(
                    new CommandDefinition(@"
                        SELECT TOP 1 ISNULL(B.Name, '')
                        FROM BankAcc A
                        LEFT JOIN Bank B ON B.ID = A.BankID
                        WHERE A.ID = @id",
                        new { id = dto.BankAccId },
                        transaction: tx, cancellationToken: ct)) ?? "";

                // نام طرف
                var personName = await _sanadService.GetHesabNameAsync(
                    conn, tx, dto.CodeCol, dto.CodeMoein, dto.CodeTafzil, ct);

                var ctx = new ChequePaySanadContext
                {
                    ChequeId = newId,
                    ResidNumber = residNumber,
                    ResidDate = dto.ResidDate ?? "",
                    ResidDes = dto.ResidDes ?? "",
                    CheckMab = dto.CheckMab,
                    CheckSeries = dto.CheckSeries ?? "",
                    CheckDate = dto.CheckDate ?? "",
                    CheckPerson = dto.CheckPerson ?? "",
                    PersonCodeCol = dto.CodeCol,
                    PersonCodeMoein = dto.CodeMoein,
                    PersonCodeTafzil = dto.CodeTafzil,
                    PersonName = personName,
                    BankCodeCol = bankCol,
                    BankCodeMoein = bankMoein,
                    BankCodeTafzil = bankTafzil,
                    BankName = bankName,
                    BankNoHesab = bankNoHesab,
                    ExistingParentSanadID = dto.ParentSanadId,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0)
                        ? dto.NoSanad.Value : (int?)null,
                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var sanadRes = await _sanadService.CreateChequePaySanadAsync(conn, tx, ctx, ct);
                parentSanadId = sanadRes.ParentSanadID;
                noSanad = sanadRes.NoSanad;
                sanadPersonId = sanadRes.SanadIdPerson;
                sanadBankId = sanadRes.SanadIdBank;

                // ═══ ۳. آپدیت چک با شناسه‌های سند ═══
                await conn.ExecuteAsync(new CommandDefinition(@"
                    UPDATE CheckPay
                    SET ParentSanadID = @pid,
                        SanadPersonID = @personId,
                        SanadID       = @bankId
                    WHERE ID = @id",
                    new
                    {
                        id = newId,
                        pid = parentSanadId,
                        personId = sanadPersonId,
                        bankId = sanadBankId
                    }, transaction: tx, cancellationToken: ct));
            }

            tx.Commit();

            return new ChequePayCreateResultDto
            {
                Id = newId,
                ResidNumber = residNumber,
                ParentSanadId = parentSanadId,
                NoSanad = noSanad
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  UPDATE
    // ═══════════════════════════════════════════════════════════════
    public async Task UpdateAsync(
        long orgId, long fyId,
        ChequePayUpdateDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.Id <= 0)
            throw new InvalidOperationException("شناسه چک نامعتبر است");
        if (dto.BankAccId <= 0)
            throw new InvalidOperationException("حساب بانکی الزامی است");
        if (dto.CheckMab <= 0)
            throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");
        if (dto.CodeCol <= 0)
            throw new InvalidOperationException("کد کل طرف حساب الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        // ─── بارگذاری رکورد فعلی ───
        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ResidNumber, ParentSanadID, SanadPersonID, SanadID, ChequeOK
                FROM CheckPay WHERE ID = @id",
                new { id = dto.Id }, cancellationToken: ct));

        if (current == null)
            throw new InvalidOperationException("چک یافت نشد");

        long oldParentSanadID = (long)(decimal)(current.ParentSanadID ?? 0);
        long oldSanadPersonID = (long)(decimal)(current.SanadPersonID ?? 0);
        long oldSanadBankID = (long)(decimal)(current.SanadID ?? 0);
        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);

        if (chequeOk == 1)
            throw new InvalidOperationException(
                "به دليل اعلام وصول شدن اين چک شما قادر به ويرايش آن نيستيد");

        if (oldParentSanadID > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, oldParentSanadID, ct);
            if (v == 2)
                throw new InvalidOperationException(
                    "به دليل قطعي بودن سند مربوطه شما قادر به ويرايش اين چک نيستيد");
        }

        // ─── شماره رسید ───
        var newResidNumber = dto.ResidNumber ?? 0;
        if (newResidNumber > 0)
        {
            var dup = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM CheckPay WHERE ResidNumber = @n AND ID <> @id",
                    new { n = newResidNumber, id = dto.Id }, cancellationToken: ct));
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
            // ═══ ۱. حذف ردیف‌های Sanad قبلی (فقط خاص خود چک) ═══
            if (oldSanadPersonID > 0 || oldSanadBankID > 0)
            {
                var ids = new[] { oldSanadPersonID, oldSanadBankID }
                    .Where(x => x > 0).ToArray();
                await _sanadService.DeleteSanadRowsAsync(conn, tx, ids, ct);
            }

            // ═══ ۲. آپدیت چک (reset parent و sanad ids) ═══
            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckPay
                SET BankAccID = @bankAccId,
                    CheckSeries = @checkSeries,
                    CheckMab = @checkMab,
                    CheckDate = @checkDate,
                    CheckPerson = @checkPerson,
                    ResidNumber = @residNumber,
                    ResidDate = @residDate,
                    ResidDes = @residDes,
                    Code_Col = @codeCol,
                    Code_Moein = @codeMoein,
                    Code_Tafzil = @codeTafzil,
                    ParentSanadID = 0,
                    SanadPersonID = 0,
                    SanadID = 0,
                    Code_OP = @userCode,
                    Date_OP = @today,
                    Time_Op = @now
                WHERE ID = @id",
                new
                {
                    id = dto.Id,
                    bankAccId = dto.BankAccId,
                    checkSeries = dto.CheckSeries ?? "",
                    checkMab = dto.CheckMab,
                    checkDate = dto.CheckDate ?? "",
                    checkPerson = dto.CheckPerson ?? "",
                    residNumber = newResidNumber,
                    residDate = dto.ResidDate ?? "",
                    residDes = dto.ResidDes ?? "",
                    codeCol = dto.CodeCol,
                    codeMoein = dto.CodeMoein,
                    codeTafzil = dto.CodeTafzil,
                    userCode,
                    today,
                    now
                }, transaction: tx, cancellationToken: ct));

            // ═══ ۳. اگر SaveWithSanad روشن است → سند جدید ═══
            if (dto.SaveWithSanad)
            {
                var (bankCol, bankMoein, bankTafzil, _, bankNoHesab) =
                    await _sanadService.GetBankAccHesabAsync(conn, tx, dto.BankAccId, ct);

                var bankName = await conn.ExecuteScalarAsync<string?>(
                    new CommandDefinition(@"
                        SELECT TOP 1 ISNULL(B.Name, '')
                        FROM BankAcc A
                        LEFT JOIN Bank B ON B.ID = A.BankID
                        WHERE A.ID = @id",
                        new { id = dto.BankAccId },
                        transaction: tx, cancellationToken: ct)) ?? "";

                var personName = await _sanadService.GetHesabNameAsync(
                    conn, tx, dto.CodeCol, dto.CodeMoein, dto.CodeTafzil, ct);

                var ctx = new ChequePaySanadContext
                {
                    ChequeId = dto.Id,
                    ResidNumber = newResidNumber,
                    ResidDate = dto.ResidDate ?? "",
                    ResidDes = dto.ResidDes ?? "",
                    CheckMab = dto.CheckMab,
                    CheckSeries = dto.CheckSeries ?? "",
                    CheckDate = dto.CheckDate ?? "",
                    CheckPerson = dto.CheckPerson ?? "",
                    PersonCodeCol = dto.CodeCol,
                    PersonCodeMoein = dto.CodeMoein,
                    PersonCodeTafzil = dto.CodeTafzil,
                    PersonName = personName,
                    BankCodeCol = bankCol,
                    BankCodeMoein = bankMoein,
                    BankCodeTafzil = bankTafzil,
                    BankName = bankName,
                    BankNoHesab = bankNoHesab,
                    ExistingParentSanadID = dto.ParentSanadId,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0)
                        ? dto.NoSanad.Value : (int?)null,
                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var sanadRes = await _sanadService.CreateChequePaySanadAsync(conn, tx, ctx, ct);

                await conn.ExecuteAsync(new CommandDefinition(@"
                    UPDATE CheckPay
                    SET ParentSanadID = @pid,
                        SanadPersonID = @personId,
                        SanadID       = @bankId
                    WHERE ID = @id",
                    new
                    {
                        id = dto.Id,
                        pid = sanadRes.ParentSanadID,
                        personId = sanadRes.SanadIdPerson,
                        bankId = sanadRes.SanadIdBank
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

    // ═══════════════════════════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════════════════════════
    public async Task DeleteAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ParentSanadID, SanadPersonID, SanadID, ChequeOK
                FROM CheckPay WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (current == null)
            throw new InvalidOperationException("چک یافت نشد");

        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        if (chequeOk == 1)
            throw new InvalidOperationException(
                "به دليل اعلام وصول شدن اين چک شما قادر به حذف آن نيستيد");

        long parentSanadID = (long)(decimal)(current.ParentSanadID ?? 0);
        long sanadPersonID = (long)(decimal)(current.SanadPersonID ?? 0);
        long sanadBankID = (long)(decimal)(current.SanadID ?? 0);

        if (parentSanadID > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, parentSanadID, ct);
            if (v == 2)
                throw new InvalidOperationException(
                    "به دليل قطعي بودن سند مربوطه شما قادر به حذف اين چک نيستيد");
        }

        using var tx = conn.BeginTransaction();
        try
        {
            // حذف ۲ ردیف سند
            if (sanadPersonID > 0 || sanadBankID > 0)
            {
                var ids = new[] { sanadPersonID, sanadBankID }
                    .Where(x => x > 0).ToArray();
                await _sanadService.DeleteSanadRowsAsync(conn, tx, ids, ct);
            }

            // حذف چک
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM CheckPay WHERE ID = @id",
                new { id }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  WORKFLOW — OK (اعلام وصول)
    // ═══════════════════════════════════════════════════════════════
    public async Task OkAsync(
        long orgId, long fyId,
        ChequePayOkRequestDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.Id <= 0)
            throw new InvalidOperationException("شناسه چک نامعتبر است");
        if (string.IsNullOrWhiteSpace(dto.OkDate))
            throw new InvalidOperationException("تاریخ وصول الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        // ─── بارگذاری چک ───
        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ResidNumber, CheckMab, CheckSeries, CheckDate, CheckPerson,
                       ParentSanadID, ParentSanadOKID,
                       SanadIDBed, SanadIDBes, SanadPersonID, SanadID,
                       UnOkSanadIDBed, UnOkSanadIDBes,
                       ChequeOK
                FROM CheckPay WHERE ID = @id",
                new { id = dto.Id }, cancellationToken: ct));

        if (current == null)
            throw new InvalidOperationException("چک یافت نشد");

        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        if (chequeOk == 1)
            throw new InvalidOperationException("این چک قبلاً اعلام وصول شده است");

        var residNumber = (int)(decimal)(current.ResidNumber ?? 0);
        var checkMab = (decimal)(current.CheckMab ?? 0m);
        var checkSeries = (string)(current.CheckSeries ?? "");
        var checkDate = (string)(current.CheckDate ?? "");
        var checkPerson = (string)(current.CheckPerson ?? "");

        var sanadIdsToDelete = new[]
        {
            (long)(decimal)(current.SanadIDBed ?? 0),
            (long)(decimal)(current.SanadIDBes ?? 0),
            (long)(decimal)(current.UnOkSanadIDBed ?? 0),
            (long)(decimal)(current.UnOkSanadIDBes ?? 0)
        }.Where(x => x > 0).ToArray();

        var today = GetTodayPersian();
        var now = GetCurrentTime();

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── ۱. حذف ردیف‌های سند OK/Return قبلی (احتمالاً خالی) ───
            if (sanadIdsToDelete.Length > 0)
                await _sanadService.DeleteSanadRowsAsync(conn, tx, sanadIdsToDelete, ct);

            // ─── ۲. سند OK جدید ───
            long parentSanadOkId = 0;
            long sanadIdBed = 0;
            long sanadIdBes = 0;

            if (dto.SaveWithSanad)
            {
                // اگه ParentSanadOKID از قبل هست، استفاده کن
                long? existingParent = dto.ParentSanadOkId;
                if (existingParent is > 0)
                {
                    var v = await GetSanadVazeitAsync(orgId, fyId, existingParent.Value, ct);
                    if (v == -1) existingParent = null; // وجود نداره → جدید بساز
                    if (v == 2) throw new InvalidOperationException("سند OK انتخاب‌شده قطعی است");
                }

                var ctx = new ChequeOkContext
                {
                    ChequeId = dto.Id,
                    ResidNumber = residNumber,
                    CheckMab = checkMab,
                    CheckSeries = checkSeries,
                    CheckDate = checkDate,
                    CheckPerson = checkPerson,
                    OkCodeCol = dto.CodeColOk,
                    OkCodeMoein = dto.CodeMoeinOk,
                    OkCodeTafzil = dto.CodeTafzilOk,
                    OkBankCodeCol = dto.CodeColPayOk,
                    OkBankCodeMoein = dto.CodeMoeinPayOk,
                    OkBankCodeTafzil = dto.CodeTafzilPayOk,
                    ExistingParentSanadID = existingParent,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0)
                        ? dto.NoSanad.Value : (int?)null,
                    OkDate = dto.OkDate,
                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var res = await _sanadService.CreateChequePayOkSanadAsync(conn, tx, ctx, ct);
                parentSanadOkId = res.ParentSanadID;
                sanadIdBed = res.SanadIdBed;
                sanadIdBes = res.SanadIdBes;
            }

            // ─── ۳. آپدیت چک ───
            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckPay
                SET ChequeOK = 1,
                    OkDate = @okDate,
                    SanadIDBed = @bed,
                    SanadIDBes = @bes,
                    ParentSanadOKID = @pOk,
                    UnOkSanadIDBed = 0,
                    UnOkSanadIDBes = 0,
                    UnOkParentSanadID = 0,
                    UnOkDate = NULL,
                    Code_Col_OK = @cOk,
                    Code_Moein_OK = @mOk,
                    Code_Tafzil_OK = @tOk,
                    Code_Col_Pay_OK = @cPayOk,
                    Code_Moein_Pay_OK = @mPayOk,
                    Code_Tafzil_Pay_OK = @tPayOk,
                    Code_OP = @userCode,
                    Date_OP = @today,
                    Time_Op = @now
                WHERE ID = @id",
                new
                {
                    id = dto.Id,
                    okDate = dto.OkDate,
                    bed = sanadIdBed,
                    bes = sanadIdBes,
                    pOk = parentSanadOkId,
                    cOk = dto.SaveWithSanad ? dto.CodeColOk : 0,
                    mOk = dto.SaveWithSanad ? dto.CodeMoeinOk : 0,
                    tOk = dto.SaveWithSanad ? dto.CodeTafzilOk : 0,
                    cPayOk = dto.SaveWithSanad ? dto.CodeColPayOk : 0,
                    mPayOk = dto.SaveWithSanad ? dto.CodeMoeinPayOk : 0,
                    tPayOk = dto.SaveWithSanad ? dto.CodeTafzilPayOk : 0,
                    userCode,
                    today,
                    now
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  WORKFLOW — UnOK (لغو اعلام)
    // ═══════════════════════════════════════════════════════════════
    public async Task UnOkAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ChequeOK, SanadIDBed, SanadIDBes,
                       UnOkSanadIDBed, UnOkSanadIDBes
                FROM CheckPay WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (current == null)
            throw new InvalidOperationException("چک یافت نشد");

        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        if (chequeOk != 1 && chequeOk != 2)
            throw new InvalidOperationException("این چک اعلام نشده است");

        var sanadIds = new[]
        {
            (long)(decimal)(current.SanadIDBed ?? 0),
            (long)(decimal)(current.SanadIDBes ?? 0),
            (long)(decimal)(current.UnOkSanadIDBed ?? 0),
            (long)(decimal)(current.UnOkSanadIDBes ?? 0)
        }.Where(x => x > 0).ToArray();

        var today = GetTodayPersian();
        var now = GetCurrentTime();

        using var tx = conn.BeginTransaction();
        try
        {
            if (sanadIds.Length > 0)
                await _sanadService.DeleteSanadRowsAsync(conn, tx, sanadIds, ct);

            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckPay
                SET ChequeOK = 0,
                    OkDate = NULL,
                    SanadIDBed = 0,
                    SanadIDBes = 0,
                    ParentSanadOKID = 0,
                    UnOkSanadIDBed = 0,
                    UnOkSanadIDBes = 0,
                    UnOkParentSanadID = 0,
                    UnOkDate = NULL,
                    Code_Col_OK = 0,
                    Code_Moein_OK = 0,
                    Code_Tafzil_OK = 0,
                    Code_Col_Pay_OK = 0,
                    Code_Moein_Pay_OK = 0,
                    Code_Tafzil_Pay_OK = 0,
                    Code_OP = @userCode,
                    Date_OP = @today,
                    Time_Op = @now
                WHERE ID = @id",
                new { id, userCode, today, now },
                transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  WORKFLOW — Return (برگشت چک)
    // ═══════════════════════════════════════════════════════════════
    public async Task ReturnAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ResidNumber, CheckMab, CheckSeries, CheckDate, CheckPerson,
                       ParentSanadID, ParentSanadOKID,
                       Code_Col, Code_Moein, Code_Tafzil,
                       Code_Col_Pay, Code_Moein_Pay, Code_Tafzil_Pay,
                       SanadIDBed, SanadIDBes,
                       UnOkSanadIDBed, UnOkSanadIDBes, UnOkParentSanadID,
                       ChequeOK
                FROM CheckPay WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (current == null)
            throw new InvalidOperationException("چک یافت نشد");

        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        if (chequeOk == 2)
            throw new InvalidOperationException("این چک قبلاً به عنوان برگشتی علامت‌گذاری شده است");

        long parentSanadId = (long)(decimal)(current.ParentSanadID ?? 0);
        if (parentSanadId <= 0)
            throw new InvalidOperationException("چک بدون سند اولیه قابل برگشت نیست");

        var residNumber = (int)(decimal)(current.ResidNumber ?? 0);
        var checkMab = (decimal)(current.CheckMab ?? 0m);
        var checkSeries = (string)(current.CheckSeries ?? "");
        var checkDate = (string)(current.CheckDate ?? "");
        var checkPerson = (string)(current.CheckPerson ?? "");

        // طبق Delphi: Return از کدینگ اصلی چک استفاده می‌کند
        var codeCol = (int)(decimal)(current.Code_Col ?? 0);
        var codeMoein = (int)(decimal)(current.Code_Moein ?? 0);
        var codeTafzil = (int)(decimal)(current.Code_Tafzil ?? 0);
        var codeColPay = (int)(decimal)(current.Code_Col_Pay ?? 0);
        var codeMoeinPay = (int)(decimal)(current.Code_Moein_Pay ?? 0);
        var codeTafzilPay = (int)(decimal)(current.Code_Tafzil_Pay ?? 0);

        var sanadIdsToDelete = new[]
        {
            (long)(decimal)(current.SanadIDBed ?? 0),
            (long)(decimal)(current.SanadIDBes ?? 0),
            (long)(decimal)(current.UnOkSanadIDBed ?? 0),
            (long)(decimal)(current.UnOkSanadIDBes ?? 0)
        }.Where(x => x > 0).ToArray();

        var today = GetTodayPersian();
        var now = GetCurrentTime();
        // طبق Delphi: UnOkParentSanadID = ParentSanadID اصلی چک
        long unOkParentSanadId = (long)(decimal)(current.UnOkParentSanadID ?? 0);
        if (unOkParentSanadId <= 0)
            unOkParentSanadId = parentSanadId;

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── ۱. حذف سندهای قبلی ───
            if (sanadIdsToDelete.Length > 0)
                await _sanadService.DeleteSanadRowsAsync(conn, tx, sanadIdsToDelete, ct);

            // ─── ۲. سند برگشت جدید ───
            long unOkSanadIdBed = 0;
            long unOkSanadIdBes = 0;

            // اگه ParentSanad وجود دارد از همان استفاده کن
            var v = await GetSanadVazeitAsync(orgId, fyId, unOkParentSanadId, ct);
            long? existingParentForReturn = v == -1 ? (long?)null : unOkParentSanadId;

            var ctx = new ChequeOkContext
            {
                ChequeId = id,
                ResidNumber = residNumber,
                CheckMab = checkMab,
                CheckSeries = checkSeries,
                CheckDate = checkDate,
                CheckPerson = checkPerson,
                OkCodeCol = codeCol,
                OkCodeMoein = codeMoein,
                OkCodeTafzil = codeTafzil,
                OkBankCodeCol = codeColPay,
                OkBankCodeMoein = codeMoeinPay,
                OkBankCodeTafzil = codeTafzilPay,
                ExistingParentSanadID = existingParentForReturn,
                ExistingNoSanad = null,
                UnOkDate = today,
                TimeOp = now,
                TodayPersian = today,
                UserCode = userCode
            };

            var res = await _sanadService.CreateChequePayReturnSanadAsync(conn, tx, ctx, ct);
            unOkParentSanadId = res.ParentSanadID;
            unOkSanadIdBed = res.SanadIdBed;
            unOkSanadIdBes = res.SanadIdBes;

            // ─── ۳. آپدیت چک ───
            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckPay
                SET ChequeOK = 2,
                    OkDate = NULL,
                    SanadIDBed = 0,
                    SanadIDBes = 0,
                    ParentSanadOKID = 0,
                    UnOkDate = @unOkDate,
                    UnOkSanadIDBed = @unOkBed,
                    UnOkSanadIDBes = @unOkBes,
                    UnOkParentSanadID = @unOkParent,
                    Code_Col_OK = @c,
                    Code_Moein_OK = @m,
                    Code_Tafzil_OK = @t,
                    Code_Col_Pay_OK = @cPay,
                    Code_Moein_Pay_OK = @mPay,
                    Code_Tafzil_Pay_OK = @tPay,
                    Code_OP = @userCode,
                    Date_OP = @today,
                    Time_Op = @now
                WHERE ID = @id",
                new
                {
                    id,
                    unOkDate = today,
                    unOkBed = unOkSanadIdBed,
                    unOkBes = unOkSanadIdBes,
                    unOkParent = unOkParentSanadId,
                    c = codeCol,
                    m = codeMoein,
                    t = codeTafzil,
                    cPay = codeColPay,
                    mPay = codeMoeinPay,
                    tPay = codeTafzilPay,
                    userCode,
                    today,
                    now
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
}