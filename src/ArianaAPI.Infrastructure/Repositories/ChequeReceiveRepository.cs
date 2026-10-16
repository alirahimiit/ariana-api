using System.Data;
using System.Globalization;
using System.Text;
using ArianaAPI.Application.DTOs.Cheque;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// Repository چک‌های دریافتی (CheckRecive)
/// معادل دلفی: TChequeReceive + TChequeReceiveListForm
/// 
/// تفاوت‌ها با ChequePay:
///   • BankID (نه BankAccID) + BankBrunch/NoHesabCheck متن آزاد
///   • Create: بانک Bed (max+1) — طرف Bes (max+2)  ← معکوس Pay
///   • WasExpended برای ChequeExpend
/// </summary>
public class ChequeReceiveRepository : IChequeReceiveRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly IChequeSanadService _sanadService;

    public ChequeReceiveRepository(
        ITenantConnectionFactory factory,
        IChequeSanadService sanadService)
    {
        _factory = factory;
        _sanadService = sanadService;
    }

    private static string GetTodayPersian()
    {
        var pc = new PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }

    private static string GetCurrentTime() => DateTime.Now.ToString("HH:mm:ss");

    // ═══════════════════════════════════════════════════════════════
    //  LIST
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeReceiveListResultDto> GetListAsync(
        long orgId, long fyId,
        ChequeReceiveFilterDto filter,
        CancellationToken ct = default)
    {
        var where = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (filter.FromNumber.HasValue) { where.Append(" AND CR.ResidNumber >= @fromNumber "); p.Add("fromNumber", filter.FromNumber.Value); }
        if (filter.ToNumber.HasValue) { where.Append(" AND CR.ResidNumber <= @toNumber "); p.Add("toNumber", filter.ToNumber.Value); }

        if (!string.IsNullOrWhiteSpace(filter.FromDate)) { where.Append(" AND CR.ResidDate >= @fromDate "); p.Add("fromDate", filter.FromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(filter.ToDate)) { where.Append(" AND CR.ResidDate <= @toDate "); p.Add("toDate", filter.ToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(filter.CheckFromDate)) { where.Append(" AND CR.CheckDate >= @checkFromDate "); p.Add("checkFromDate", filter.CheckFromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(filter.CheckToDate)) { where.Append(" AND CR.CheckDate <= @checkToDate "); p.Add("checkToDate", filter.CheckToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(filter.CheckFromSerial)) { where.Append(" AND CR.CheckSeries >= @checkFromSerial "); p.Add("checkFromSerial", filter.CheckFromSerial.Trim()); }
        if (!string.IsNullOrWhiteSpace(filter.CheckToSerial)) { where.Append(" AND CR.CheckSeries <= @checkToSerial "); p.Add("checkToSerial", filter.CheckToSerial.Trim()); }

        if (!string.IsNullOrWhiteSpace(filter.Descript)) { where.Append(" AND CR.ResidDes LIKE @descript "); p.Add("descript", "%" + filter.Descript.Trim() + "%"); }

        if (filter.BankId is > 0) { where.Append(" AND CR.BankID = @bankId "); p.Add("bankId", filter.BankId.Value); }
        if (!string.IsNullOrWhiteSpace(filter.BankBrunch)) { where.Append(" AND CR.BankBrunch LIKE @bankBrunch "); p.Add("bankBrunch", "%" + filter.BankBrunch.Trim() + "%"); }
        if (!string.IsNullOrWhiteSpace(filter.NoHesabCheck)) { where.Append(" AND CR.NoHesabCheck LIKE @noHesab "); p.Add("noHesab", "%" + filter.NoHesabCheck.Trim() + "%"); }

        if (filter.CodeCol is > 0) { where.Append(" AND CR.Code_Col = @codeCol "); p.Add("codeCol", filter.CodeCol.Value); }
        if (filter.CodeMoein is > 0) { where.Append(" AND CR.Code_Moein = @codeMoein "); p.Add("codeMoein", filter.CodeMoein.Value); }
        if (filter.CodeTafzil is > 0) { where.Append(" AND CR.Code_Tafzil = @codeTafzil "); p.Add("codeTafzil", filter.CodeTafzil.Value); }

        // Sort
        var orderBy = "CR.ResidNumber DESC, CR.ID DESC";
        if (!string.IsNullOrWhiteSpace(filter.SortBy))
        {
            var dir = string.Equals(filter.SortDir, "asc", StringComparison.OrdinalIgnoreCase) ? "ASC" : "DESC";
            var allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["residNumber"] = "CR.ResidNumber",
                ["residDate"] = "CR.ResidDate",
                ["checkDate"] = "CR.CheckDate",
                ["checkSeries"] = "CR.CheckSeries",
                ["checkMab"] = "CR.CheckMab",
                ["checkPerson"] = "CR.CheckPerson",
                ["bankName"] = "B.Name",
                ["bankBrunch"] = "CR.BankBrunch",
                ["noHesabCheck"] = "CR.NoHesabCheck"
            };
            if (allowed.TryGetValue(filter.SortBy, out var col))
                orderBy = $"{col} {dir}";
        }

        if (filter.Page < 1) filter.Page = 1;
        if (filter.PageSize < 1 || filter.PageSize > 1000) filter.PageSize = 100;
        var offset = (filter.Page - 1) * filter.PageSize;
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + filter.PageSize);

        var countSql = $"SELECT COUNT(*) FROM CheckRecive CR {where}";

        var dataSql = $@"
            SELECT * FROM (
                SELECT
                    CR.ID AS Id,
                    ISNULL(CR.BankID, 0) AS BankId,
                    ISNULL(B.Name, '') AS BankName,
                    ISNULL(CR.BankBrunch, '') AS BankBrunch,
                    ISNULL(CR.NoHesabCheck, '') AS NoHesabCheck,

                    ISNULL(CR.CheckSeries, '') AS CheckSeries,
                    ISNULL(CR.CheckMab, 0)     AS CheckMab,
                    ISNULL(CR.CheckDate, '')   AS CheckDate,
                    ISNULL(CR.CheckPerson, '') AS CheckPerson,

                    ISNULL(CR.ResidNumber, 0) AS ResidNumber,
                    ISNULL(CR.ResidDate, '')  AS ResidDate,
                    ISNULL(CR.ResidDes, '')   AS ResidDes,

                    ISNULL(CR.ChequeOK, 0)   AS ChequeOK,
                    ISNULL(CR.CheckState, 0) AS CheckState,
                    ISNULL(CR.OkDate, '')    AS OkDate,
                    ISNULL(CR.WasExpended, 0) AS WasExpended,

                    ISNULL(CR.Code_Col, 0)    AS CodeCol,
                    ISNULL(CR.Code_Moein, 0)  AS CodeMoein,
                    ISNULL(CR.Code_Tafzil, 0) AS CodeTafzil,
                    ISNULL(H1.Name, '') AS ColName,
                    ISNULL(H2.Name, '') AS MoeinName,
                    ISNULL(H3.Name, '') AS TafzilName,

                    ISNULL(CR.ParentSanadID, 0) AS ParentSanadId,
                    ISNULL(PS.NO_Sanad, 0)      AS NoSanad,
                    ISNULL(PS.Vazeit, -1)       AS SanadVazeit,

                    ROW_NUMBER() OVER (ORDER BY {orderBy}) AS RowNum
                FROM CheckRecive CR
                LEFT JOIN Bank B         ON B.ID = CR.BankID
                LEFT JOIN ParentSanad PS ON PS.ParentSanadID = CR.ParentSanadID
                LEFT JOIN Hesab H1 ON CR.Code_Col > 0
                    AND H1.Code_Col = CR.Code_Col
                    AND ISNULL(H1.Code_Moein, 0) = 0
                    AND ISNULL(H1.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H2 ON CR.Code_Col > 0 AND CR.Code_Moein > 0
                    AND H2.Code_Col = CR.Code_Col
                    AND H2.Code_Moein = CR.Code_Moein
                    AND ISNULL(H2.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H3 ON CR.Code_Tafzil > 0
                    AND H3.Code_Col = -1
                    AND ISNULL(H3.Code_Moein, 0) = 0
                    AND H3.Code_Tafzil = CR.Code_Tafzil
                {where}
            ) T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        var items = (await conn.QueryAsync<ChequeReceiveListDto>(
            new CommandDefinition(dataSql, p, cancellationToken: ct))).ToList();

        return new ChequeReceiveListResultDto
        {
            Items = items,
            TotalCount = total,
            Page = filter.Page,
            PageSize = filter.PageSize
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  DETAIL
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeReceiveDetailDto?> GetByIdAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT
                CR.ID AS Id,
                ISNULL(CR.BankID, 0) AS BankId,
                ISNULL(B.Name, '') AS BankName,
                ISNULL(CR.BankBrunch, '') AS BankBrunch,
                ISNULL(CR.NoHesabCheck, '') AS NoHesabCheck,

                ISNULL(CR.CheckSeries, '') AS CheckSeries,
                ISNULL(CR.CheckMab, 0)     AS CheckMab,
                ISNULL(CR.CheckDate, '')   AS CheckDate,
                ISNULL(CR.CheckPerson, '') AS CheckPerson,

                ISNULL(CR.ResidNumber, 0) AS ResidNumber,
                ISNULL(CR.ResidDate, '')  AS ResidDate,
                ISNULL(CR.ResidDes, '')   AS ResidDes,

                ISNULL(CR.ChequeOK, 0)   AS ChequeOK,
                ISNULL(CR.CheckState, 0) AS CheckState,
                ISNULL(CR.OkDate, '')    AS OkDate,
                ISNULL(CR.IsNaghd, 0)    AS IsNaghd,
                ISNULL(CR.WasExpended, 0) AS WasExpended,

                ISNULL(CR.Code_Col, 0)    AS CodeCol,
                ISNULL(CR.Code_Moein, 0)  AS CodeMoein,
                ISNULL(CR.Code_Tafzil, 0) AS CodeTafzil,
                ISNULL(H1.Name, '') AS ColName,
                ISNULL(H2.Name, '') AS MoeinName,
                ISNULL(H3.Name, '') AS TafzilName,

                ISNULL(CR.Code_Col_Pay, 0)    AS CodeColPay,
                ISNULL(CR.Code_Moein_Pay, 0)  AS CodeMoeinPay,
                ISNULL(CR.Code_Tafzil_Pay, 0) AS CodeTafzilPay,
                ISNULL(H4.Name, '') AS ColPayName,
                ISNULL(H5.Name, '') AS MoeinPayName,
                ISNULL(H6.Name, '') AS TafzilPayName,

                ISNULL(CR.Code_Col_OK, 0)    AS CodeColOk,
                ISNULL(CR.Code_Moein_OK, 0)  AS CodeMoeinOk,
                ISNULL(CR.Code_Tafzil_OK, 0) AS CodeTafzilOk,
                ISNULL(CR.Code_Col_Pay_OK, 0)    AS CodeColPayOk,
                ISNULL(CR.Code_Moein_Pay_OK, 0)  AS CodeMoeinPayOk,
                ISNULL(CR.Code_Tafzil_Pay_OK, 0) AS CodeTafzilPayOk,
                ISNULL(CR.ParentSanadOKID, 0) AS ParentSanadOkId,
                ISNULL(CR.SanadIDBed, 0) AS SanadIdBed,
                ISNULL(CR.SanadIDBes, 0) AS SanadIdBes,
                ISNULL(CR.SanadPersonID, 0) AS SanadPersonId,
                ISNULL(CR.SanadID, 0) AS SanadId,

                ISNULL(CR.UnOkDate, '') AS UnOkDate,
                ISNULL(CR.UnOkParentSanadID, 0) AS UnOkParentSanadId,
                ISNULL(CR.UnOkSanadIDBed, 0) AS UnOkSanadIdBed,
                ISNULL(CR.UnOkSanadIDBes, 0) AS UnOkSanadIdBes,

                ISNULL(CR.ParentSanadID, 0) AS ParentSanadId,
                ISNULL(PS.NO_Sanad, 0)      AS NoSanad,
                ISNULL(PS.Vazeit, -1)       AS SanadVazeit

            FROM CheckRecive CR
            LEFT JOIN Bank B         ON B.ID = CR.BankID
            LEFT JOIN ParentSanad PS ON PS.ParentSanadID = CR.ParentSanadID

            LEFT JOIN Hesab H1 ON CR.Code_Col > 0
                AND H1.Code_Col = CR.Code_Col
                AND ISNULL(H1.Code_Moein, 0) = 0
                AND ISNULL(H1.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H2 ON CR.Code_Col > 0 AND CR.Code_Moein > 0
                AND H2.Code_Col = CR.Code_Col
                AND H2.Code_Moein = CR.Code_Moein
                AND ISNULL(H2.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H3 ON CR.Code_Tafzil > 0
                AND H3.Code_Col = -1
                AND ISNULL(H3.Code_Moein, 0) = 0
                AND H3.Code_Tafzil = CR.Code_Tafzil

            LEFT JOIN Hesab H4 ON CR.Code_Col_Pay > 0
                AND H4.Code_Col = CR.Code_Col_Pay
                AND ISNULL(H4.Code_Moein, 0) = 0
                AND ISNULL(H4.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H5 ON CR.Code_Col_Pay > 0 AND CR.Code_Moein_Pay > 0
                AND H5.Code_Col = CR.Code_Col_Pay
                AND H5.Code_Moein = CR.Code_Moein_Pay
                AND ISNULL(H5.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H6 ON CR.Code_Tafzil_Pay > 0
                AND H6.Code_Col = -1
                AND ISNULL(H6.Code_Moein, 0) = 0
                AND H6.Code_Tafzil = CR.Code_Tafzil_Pay

            WHERE CR.ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<ChequeReceiveDetailDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  NEXT NUMBER
    // ═══════════════════════════════════════════════════════════════
    public async Task<int> GetNextNumberAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = "SELECT ISNULL(MAX(ResidNumber), 0) + 1 FROM CheckRecive";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  PARENT SANAD COMBO
    // ═══════════════════════════════════════════════════════════════
    public async Task<IEnumerable<ChequeSanadComboDto>> GetParentSanadListAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT ParentSanadID, NO_Sanad AS NoSanad, Date_IN AS DateIn,
                   OtherParentSharh AS Sharh, Vazeit
            FROM ParentSanad WHERE Vazeit <> 2 ORDER BY NO_Sanad";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<ChequeSanadComboDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  DATALIST — شعبه / شماره‌حساب / در وجه
    // ═══════════════════════════════════════════════════════════════
    public async Task<IEnumerable<string>> GetDistinctBrunchListAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT DISTINCT BankBrunch FROM CheckRecive
            WHERE BankBrunch IS NOT NULL AND LTRIM(RTRIM(BankBrunch)) <> ''
            ORDER BY BankBrunch";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<string>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<string>> GetDistinctNoHesabListAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT DISTINCT NoHesabCheck FROM CheckRecive
            WHERE NoHesabCheck IS NOT NULL AND LTRIM(RTRIM(NoHesabCheck)) <> ''
            ORDER BY NoHesabCheck";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<string>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<string>> GetDistinctPersonListAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT DISTINCT CheckPerson FROM CheckRecive
            WHERE CheckPerson IS NOT NULL AND LTRIM(RTRIM(CheckPerson)) <> ''
            ORDER BY CheckPerson";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<string>(new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════════
    //  SANAD VAZEIT
    // ═══════════════════════════════════════════════════════════════
    public async Task<int> GetSanadVazeitAsync(
        long orgId, long fyId, long parentSanadId, CancellationToken ct = default)
    {
        if (parentSanadId <= 0) return -1;
        const string sql = "SELECT Vazeit FROM ParentSanad WHERE ParentSanadID = @id";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var v = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition(sql, new { id = parentSanadId }, cancellationToken: ct));
        return v ?? -1;
    }

    // ═══════════════════════════════════════════════════════════════
    //  CREATE
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeReceiveCreateResultDto> CreateAsync(
        long orgId, long fyId,
        ChequeReceiveCreateDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.BankId <= 0) throw new InvalidOperationException("بانک الزامی است");
        if (dto.CheckMab <= 0) throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");
        if (string.IsNullOrWhiteSpace(dto.CheckDate)) throw new InvalidOperationException("تاریخ چک الزامی است");
        if (dto.CodeCol <= 0) throw new InvalidOperationException("کد کل طرف حساب الزامی است");
        if (string.IsNullOrWhiteSpace(dto.ResidDate)) throw new InvalidOperationException("تاریخ رسید الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var residNumber = dto.ResidNumber ?? 0;
        if (residNumber <= 0)
            residNumber = await GetNextNumberAsync(orgId, fyId, ct);

        var dup = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM CheckRecive WHERE ResidNumber = @n",
                new { n = residNumber }, cancellationToken: ct));
        if (dup > 0) throw new InvalidOperationException($"شماره رسید {residNumber} تکراری است");

        var bankExists = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM Bank WHERE ID = @id",
                new { id = dto.BankId }, cancellationToken: ct));
        if (bankExists == 0) throw new InvalidOperationException("بانک انتخاب‌شده یافت نشد");

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
            // ═══ ۱. درج اولیه چک ═══
            const string insertSql = @"
                INSERT INTO CheckRecive
                    (BankID, CheckDate, CheckSeries, BankBrunch, CheckMab, NoHesabCheck, CheckPerson,
                     ResidNumber, SanadID, CheckState, IsNaghd,
                     Code_Col, Code_Moein, Code_Tafzil,
                     ChequeOK, OkDate, SanadIDBed, SanadIDBes, ParentSanadID,
                     ResidDes,
                     Code_Col_Pay, Code_Moein_Pay, Code_Tafzil_Pay,
                     ResidDate, SanadPersonID, WasExpended,
                     Code_Col_Pay_OK, Code_Moein_Pay_OK, Code_Tafzil_Pay_OK,
                     Code_Col_OK, Code_Moein_OK, Code_Tafzil_OK,
                     ParentSanadOKID, UnOkDate, UnOkSanadIDBed, UnOkSanadIDBes, UnOkParentSanadID,
                     Code_Op, Date_Op, Time_Op)
                OUTPUT INSERTED.ID
                VALUES
                    (@bankId, @checkDate, @checkSeries, @bankBrunch, @checkMab, @noHesab, @checkPerson,
                     @residNumber, 0, 0, 0,
                     @codeCol, @codeMoein, @codeTafzil,
                     0, NULL, 0, 0, 0,
                     @residDes,
                     0, 0, 0,
                     @residDate, 0, 0,
                     0, 0, 0,
                     0, 0, 0,
                     0, NULL, 0, 0, 0,
                     @userCode, @today, @now)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertSql, new
                {
                    bankId = dto.BankId,
                    checkDate = dto.CheckDate ?? "",
                    checkSeries = dto.CheckSeries ?? "",
                    bankBrunch = dto.BankBrunch ?? "",
                    checkMab = dto.CheckMab,
                    noHesab = dto.NoHesabCheck ?? "",
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
                // حساب اسناد دریافتنی (Type = 13 = chtReceivableDocument)
                var (bankCol, bankMoein) = await _sanadService.GetConstHesabAsync(
                    conn, tx, 13, ct);

                var bankName = await conn.ExecuteScalarAsync<string?>(
                    new CommandDefinition("SELECT TOP 1 Name FROM Bank WHERE ID = @id",
                        new { id = dto.BankId }, transaction: tx, cancellationToken: ct)) ?? "";

                var personName = await _sanadService.GetHesabNameAsync(
                    conn, tx, dto.CodeCol, dto.CodeMoein, dto.CodeTafzil, ct);

                var ctx = new ChequeReceiveSanadContext
                {
                    ChequeId = newId,
                    ResidNumber = residNumber,
                    ResidDate = dto.ResidDate ?? "",
                    ResidDes = dto.ResidDes ?? "",
                    CheckMab = dto.CheckMab,
                    CheckSeries = dto.CheckSeries ?? "",
                    CheckDate = dto.CheckDate ?? "",
                    CheckPerson = dto.CheckPerson ?? "",
                    BankCodeCol = bankCol,
                    BankCodeMoein = bankMoein,
                    BankCodeTafzil = 0,
                    BankName = bankName,
                    BankBrunch = dto.BankBrunch ?? "",
                    BankNoHesab = dto.NoHesabCheck ?? "",
                    PersonCodeCol = dto.CodeCol,
                    PersonCodeMoein = dto.CodeMoein,
                    PersonCodeTafzil = dto.CodeTafzil,
                    PersonName = personName,
                    ExistingParentSanadID = dto.ParentSanadId,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0) ? dto.NoSanad.Value : (int?)null,
                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var sanadRes = await _sanadService.CreateChequeReceiveSanadAsync(conn, tx, ctx, ct);
                parentSanadId = sanadRes.ParentSanadID;
                noSanad = sanadRes.NoSanad;
                sanadPersonId = sanadRes.SanadIdPerson;
                sanadBankId = sanadRes.SanadIdBank;

                // ═══ ۳. آپدیت چک ═══
                await conn.ExecuteAsync(new CommandDefinition(@"
                    UPDATE CheckRecive
                    SET ParentSanadID = @pid,
                        SanadPersonID = @personId,
                        SanadID       = @bankId,
                        Code_Col_Pay  = @bankCol,
                        Code_Moein_Pay = @bankMoein
                    WHERE ID = @id",
                    new
                    {
                        id = newId,
                        pid = parentSanadId,
                        personId = sanadPersonId,
                        bankId = sanadBankId,
                        bankCol = bankCol,
                        bankMoein = bankMoein
                    }, transaction: tx, cancellationToken: ct));
            }

            tx.Commit();

            return new ChequeReceiveCreateResultDto
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
        ChequeReceiveUpdateDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.Id <= 0) throw new InvalidOperationException("شناسه چک نامعتبر است");
        if (dto.BankId <= 0) throw new InvalidOperationException("بانک الزامی است");
        if (dto.CheckMab <= 0) throw new InvalidOperationException("مبلغ چک باید بزرگ‌تر از صفر باشد");
        if (dto.CodeCol <= 0) throw new InvalidOperationException("کد کل طرف حساب الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ResidNumber, ParentSanadID, SanadPersonID, SanadID, ChequeOK, WasExpended
                FROM CheckRecive WHERE ID = @id",
                new { id = dto.Id }, cancellationToken: ct));

        if (current == null) throw new InvalidOperationException("چک یافت نشد");

        long oldParentSanadID = (long)(decimal)(current.ParentSanadID ?? 0);
        long oldSanadPersonID = (long)(decimal)(current.SanadPersonID ?? 0);
        long oldSanadBankID = (long)(decimal)(current.SanadID ?? 0);
        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        int wasExpended = (int)(decimal)(current.WasExpended ?? 0);

        if (chequeOk == 1) throw new InvalidOperationException("به دليل اعلام وصول شدن اين چک شما قادر به ويرايش آن نيستيد");
        if (wasExpended > 0) throw new InvalidOperationException("اين چک خرج شده و قابل ويرايش نيست");

        if (oldParentSanadID > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, oldParentSanadID, ct);
            if (v == 2) throw new InvalidOperationException("سند قطعی است");
        }

        var newResidNumber = dto.ResidNumber ?? 0;
        if (newResidNumber > 0)
        {
            var dup = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition("SELECT COUNT(*) FROM CheckRecive WHERE ResidNumber = @n AND ID <> @id",
                    new { n = newResidNumber, id = dto.Id }, cancellationToken: ct));
            if (dup > 0) throw new InvalidOperationException($"شماره رسید {newResidNumber} تکراری است");
        }
        else newResidNumber = (int)(decimal)current.ResidNumber;

        var today = GetTodayPersian();
        var now = GetCurrentTime();

        using var tx = conn.BeginTransaction();
        try
        {
            if (oldSanadPersonID > 0 || oldSanadBankID > 0)
            {
                var ids = new[] { oldSanadPersonID, oldSanadBankID }.Where(x => x > 0).ToArray();
                await _sanadService.DeleteSanadRowsAsync(conn, tx, ids, ct);
            }

            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckRecive
                SET BankID = @bankId,
                    CheckSeries = @checkSeries,
                    CheckMab = @checkMab,
                    CheckDate = @checkDate,
                    CheckPerson = @checkPerson,
                    BankBrunch = @bankBrunch,
                    NoHesabCheck = @noHesab,
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
                    Time_OP = @now
                WHERE ID = @id",
                new
                {
                    id = dto.Id,
                    bankId = dto.BankId,
                    checkSeries = dto.CheckSeries ?? "",
                    checkMab = dto.CheckMab,
                    checkDate = dto.CheckDate ?? "",
                    checkPerson = dto.CheckPerson ?? "",
                    bankBrunch = dto.BankBrunch ?? "",
                    noHesab = dto.NoHesabCheck ?? "",
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

            if (dto.SaveWithSanad)
            {
                var (bankCol, bankMoein) = await _sanadService.GetConstHesabAsync(conn, tx, 13, ct);

                var bankName = await conn.ExecuteScalarAsync<string?>(
                    new CommandDefinition("SELECT TOP 1 Name FROM Bank WHERE ID = @id",
                        new { id = dto.BankId }, transaction: tx, cancellationToken: ct)) ?? "";

                var personName = await _sanadService.GetHesabNameAsync(
                    conn, tx, dto.CodeCol, dto.CodeMoein, dto.CodeTafzil, ct);

                var ctx = new ChequeReceiveSanadContext
                {
                    ChequeId = dto.Id,
                    ResidNumber = newResidNumber,
                    ResidDate = dto.ResidDate ?? "",
                    ResidDes = dto.ResidDes ?? "",
                    CheckMab = dto.CheckMab,
                    CheckSeries = dto.CheckSeries ?? "",
                    CheckDate = dto.CheckDate ?? "",
                    CheckPerson = dto.CheckPerson ?? "",
                    BankCodeCol = bankCol,
                    BankCodeMoein = bankMoein,
                    BankCodeTafzil = 0,
                    BankName = bankName,
                    BankBrunch = dto.BankBrunch ?? "",
                    BankNoHesab = dto.NoHesabCheck ?? "",
                    PersonCodeCol = dto.CodeCol,
                    PersonCodeMoein = dto.CodeMoein,
                    PersonCodeTafzil = dto.CodeTafzil,
                    PersonName = personName,
                    ExistingParentSanadID = dto.ParentSanadId,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0) ? dto.NoSanad.Value : (int?)null,
                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var sanadRes = await _sanadService.CreateChequeReceiveSanadAsync(conn, tx, ctx, ct);

                await conn.ExecuteAsync(new CommandDefinition(@"
                    UPDATE CheckRecive
                    SET ParentSanadID = @pid,
                        SanadPersonID = @personId,
                        SanadID       = @bankId,
                        Code_Col_Pay  = @bankCol,
                        Code_Moein_Pay = @bankMoein
                    WHERE ID = @id",
                    new
                    {
                        id = dto.Id,
                        pid = sanadRes.ParentSanadID,
                        personId = sanadRes.SanadIdPerson,
                        bankId = sanadRes.SanadIdBank,
                        bankCol = bankCol,
                        bankMoein = bankMoein
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
                SELECT ID, ParentSanadID, SanadPersonID, SanadID, ChequeOK, WasExpended
                FROM CheckRecive WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (current == null) throw new InvalidOperationException("چک یافت نشد");

        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        int wasExpended = (int)(decimal)(current.WasExpended ?? 0);

        if (chequeOk == 1) throw new InvalidOperationException("به دليل اعلام وصول شدن اين چک شما قادر به حذف آن نيستيد");
        if (wasExpended > 0) throw new InvalidOperationException("اين چک خرج شده و قابل حذف نيست");

        long parentSanadID = (long)(decimal)(current.ParentSanadID ?? 0);
        long sanadPersonID = (long)(decimal)(current.SanadPersonID ?? 0);
        long sanadBankID = (long)(decimal)(current.SanadID ?? 0);

        if (parentSanadID > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, parentSanadID, ct);
            if (v == 2) throw new InvalidOperationException("سند قطعی است");
        }

        using var tx = conn.BeginTransaction();
        try
        {
            if (sanadPersonID > 0 || sanadBankID > 0)
            {
                var ids = new[] { sanadPersonID, sanadBankID }.Where(x => x > 0).ToArray();
                await _sanadService.DeleteSanadRowsAsync(conn, tx, ids, ct);
            }

            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM CheckRecive WHERE ID = @id",
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
    //  WORKFLOW — OK
    // ═══════════════════════════════════════════════════════════════
    public async Task OkAsync(
        long orgId, long fyId,
        ChequeReceiveOkRequestDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.Id <= 0) throw new InvalidOperationException("شناسه چک نامعتبر است");
        if (string.IsNullOrWhiteSpace(dto.OkDate)) throw new InvalidOperationException("تاریخ وصول الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ResidNumber, CheckMab, CheckSeries, CheckDate, CheckPerson,
                       ParentSanadID, ParentSanadOKID,
                       SanadIDBed, SanadIDBes, SanadPersonID, SanadID,
                       UnOkSanadIDBed, UnOkSanadIDBes, ChequeOK
                FROM CheckRecive WHERE ID = @id",
                new { id = dto.Id }, cancellationToken: ct));

        if (current == null) throw new InvalidOperationException("چک یافت نشد");

        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        if (chequeOk == 1) throw new InvalidOperationException("این چک قبلاً اعلام وصول شده است");

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
            if (sanadIdsToDelete.Length > 0)
                await _sanadService.DeleteSanadRowsAsync(conn, tx, sanadIdsToDelete, ct);

            long parentSanadOkId = 0;
            long sanadIdBed = 0;
            long sanadIdBes = 0;

            if (dto.SaveWithSanad)
            {
                long? existingParent = dto.ParentSanadOkId;
                if (existingParent is > 0)
                {
                    var v = await GetSanadVazeitAsync(orgId, fyId, existingParent.Value, ct);
                    if (v == -1) existingParent = null;
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
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0) ? dto.NoSanad.Value : (int?)null,
                    OkDate = dto.OkDate,
                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var res = await _sanadService.CreateChequeReceiveOkSanadAsync(conn, tx, ctx, ct);
                parentSanadOkId = res.ParentSanadID;
                sanadIdBed = res.SanadIdBed;
                sanadIdBes = res.SanadIdBes;
            }

            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckRecive
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
                    Code_Op = @userCode,
                    Date_Op = @today,
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
    //  WORKFLOW — UnOK
    // ═══════════════════════════════════════════════════════════════
    public async Task UnOkAsync(
        long orgId, long fyId, long id, long userCode,
        CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ChequeOK, SanadIDBed, SanadIDBes, UnOkSanadIDBed, UnOkSanadIDBes
                FROM CheckRecive WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (current == null) throw new InvalidOperationException("چک یافت نشد");

        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        if (chequeOk != 1 && chequeOk != 2) throw new InvalidOperationException("این چک اعلام نشده است");

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
                UPDATE CheckRecive
                SET ChequeOK = 0, OkDate = NULL,
                    SanadIDBed = 0, SanadIDBes = 0, ParentSanadOKID = 0,
                    UnOkSanadIDBed = 0, UnOkSanadIDBes = 0, UnOkParentSanadID = 0, UnOkDate = NULL,
                    Code_Col_OK = 0, Code_Moein_OK = 0, Code_Tafzil_OK = 0,
                    Code_Col_Pay_OK = 0, Code_Moein_Pay_OK = 0, Code_Tafzil_Pay_OK = 0,
                    Code_Op = @userCode, Date_Op = @today, Time_Op = @now
                WHERE ID = @id",
                new { id, userCode, today, now }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  WORKFLOW — Return
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
                       ParentSanadID,
                       Code_Col, Code_Moein, Code_Tafzil,
                       Code_Col_Pay, Code_Moein_Pay, Code_Tafzil_Pay,
                       SanadIDBed, SanadIDBes, UnOkSanadIDBed, UnOkSanadIDBes,
                       UnOkParentSanadID, ChequeOK
                FROM CheckRecive WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (current == null) throw new InvalidOperationException("چک یافت نشد");

        int chequeOk = (int)(decimal)(current.ChequeOK ?? 0);
        if (chequeOk == 2) throw new InvalidOperationException("این چک قبلاً برگشتی شده است");

        long parentSanadId = (long)(decimal)(current.ParentSanadID ?? 0);
        if (parentSanadId <= 0) throw new InvalidOperationException("چک بدون سند اولیه قابل برگشت نیست");

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
        long unOkParentSanadId = (long)(decimal)(current.UnOkParentSanadID ?? 0);
        if (unOkParentSanadId <= 0) unOkParentSanadId = parentSanadId;

        using var tx = conn.BeginTransaction();
        try
        {
            if (sanadIdsToDelete.Length > 0)
                await _sanadService.DeleteSanadRowsAsync(conn, tx, sanadIdsToDelete, ct);

            long unOkSanadIdBed = 0;
            long unOkSanadIdBes = 0;

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

            var res = await _sanadService.CreateChequeReceiveReturnSanadAsync(conn, tx, ctx, ct);
            unOkParentSanadId = res.ParentSanadID;
            unOkSanadIdBed = res.SanadIdBed;
            unOkSanadIdBes = res.SanadIdBes;

            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckRecive
                SET ChequeOK = 2, OkDate = NULL,
                    SanadIDBed = 0, SanadIDBes = 0, ParentSanadOKID = 0,
                    UnOkDate = @unOkDate,
                    UnOkSanadIDBed = @unOkBed,
                    UnOkSanadIDBes = @unOkBes,
                    UnOkParentSanadID = @unOkParent,
                    Code_Col_OK = @c, Code_Moein_OK = @m, Code_Tafzil_OK = @t,
                    Code_Col_Pay_OK = @cPay, Code_Moein_Pay_OK = @mPay, Code_Tafzil_Pay_OK = @tPay,
                    Code_Op = @userCode, Date_Op = @today, Time_Op = @now
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