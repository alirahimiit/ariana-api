using System.Data;
using System.Globalization;
using System.Text;
using ArianaAPI.Application.DTOs.Cheque;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// Repository خرج چک‌های دریافتی (CheckExpend)
/// معادل دلفی: TChequeExpend + TChequeExpendListForm
/// 
/// نکات:
///   • FK: CheuqeReceiveID (تایپو در DB) → CheckRecive.ID
///   • Sanad: Row1 شخص Bed / Row2 اسناد دریافتنی Bes
///   • WasDuring = 0 (قطع) → CheckRecive.WasExpended = 1
///   • WasDuring = 1 (در جریان) → CheckRecive.WasExpended = 2
/// </summary>
public class ChequeExpendRepository : IChequeExpendRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly IChequeSanadService _sanadService;

    public ChequeExpendRepository(
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
    public async Task<ChequeExpendListResultDto> GetListAsync(
        long orgId, long fyId,
        ChequeExpendFilterDto filter,
        CancellationToken ct = default)
    {
        var where = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (filter.FromNumber.HasValue) { where.Append(" AND CE.ResidNumber >= @fromNumber "); p.Add("fromNumber", filter.FromNumber.Value); }
        if (filter.ToNumber.HasValue) { where.Append(" AND CE.ResidNumber <= @toNumber "); p.Add("toNumber", filter.ToNumber.Value); }

        if (!string.IsNullOrWhiteSpace(filter.FromDate)) { where.Append(" AND CE.ResidDate >= @fromDate "); p.Add("fromDate", filter.FromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(filter.ToDate)) { where.Append(" AND CE.ResidDate <= @toDate "); p.Add("toDate", filter.ToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(filter.CheckFromDate)) { where.Append(" AND CR.CheckDate >= @checkFromDate "); p.Add("checkFromDate", filter.CheckFromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(filter.CheckToDate)) { where.Append(" AND CR.CheckDate <= @checkToDate "); p.Add("checkToDate", filter.CheckToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(filter.CheckFromSerial)) { where.Append(" AND CR.CheckSeries >= @checkFromSerial "); p.Add("checkFromSerial", filter.CheckFromSerial.Trim()); }
        if (!string.IsNullOrWhiteSpace(filter.CheckToSerial)) { where.Append(" AND CR.CheckSeries <= @checkToSerial "); p.Add("checkToSerial", filter.CheckToSerial.Trim()); }

        if (!string.IsNullOrWhiteSpace(filter.Descript)) { where.Append(" AND CE.ResidDes LIKE @descript "); p.Add("descript", "%" + filter.Descript.Trim() + "%"); }

        if (filter.CodeCol is > 0) { where.Append(" AND CE.Code_Col = @codeCol "); p.Add("codeCol", filter.CodeCol.Value); }
        if (filter.CodeMoein is > 0) { where.Append(" AND CE.Code_Moein = @codeMoein "); p.Add("codeMoein", filter.CodeMoein.Value); }
        if (filter.CodeTafzil is > 0) { where.Append(" AND CE.Code_Tafzil = @codeTafzil "); p.Add("codeTafzil", filter.CodeTafzil.Value); }
        if (filter.WasDuring.HasValue) { where.Append(" AND CE.WasDuring = @wasDuring "); p.Add("wasDuring", filter.WasDuring.Value); }

        // Sort
        var orderBy = "CE.ResidNumber DESC, CE.ID DESC";
        if (!string.IsNullOrWhiteSpace(filter.SortBy))
        {
            var dir = string.Equals(filter.SortDir, "asc", StringComparison.OrdinalIgnoreCase) ? "ASC" : "DESC";
            var allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["residNumber"] = "CE.ResidNumber",
                ["residDate"] = "CE.ResidDate",
                ["checkSeries"] = "CR.CheckSeries",
                ["checkDate"] = "CR.CheckDate",
                ["checkMab"] = "CR.CheckMab",
                ["receiveFrom"] = "CR.CheckPerson",
                ["codeCol"] = "CE.Code_Col",
                ["codeMoein"] = "CE.Code_Moein",
                ["codeTafzil"] = "CE.Code_Tafzil"
            };
            if (allowed.TryGetValue(filter.SortBy, out var col))
                orderBy = $"{col} {dir}";
        }

        if (filter.Page < 1) filter.Page = 1;
        if (filter.PageSize < 1 || filter.PageSize > 1000) filter.PageSize = 100;
        var offset = (filter.Page - 1) * filter.PageSize;
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + filter.PageSize);

        var countSql = $"SELECT COUNT(*) FROM CheckExpend CE LEFT JOIN CheckRecive CR ON CR.ID = CE.CheuqeReceiveID {where}";

        var dataSql = $@"
            SELECT * FROM (
                SELECT
                    CE.ID AS Id,
                    ISNULL(CE.CheuqeReceiveID, 0) AS ChequeReceiveId,

                    ISNULL(CR.CheckSeries, '') AS CheckSeries,
                    ISNULL(CR.CheckMab, 0)     AS CheckMab,
                    ISNULL(CR.CheckDate, '')   AS CheckDate,
                    ISNULL(CR.CheckPerson, '') AS ReceiveFrom,

                    ISNULL(CE.Code_Col, 0)    AS CodeCol,
                    ISNULL(CE.Code_Moein, 0)  AS CodeMoein,
                    ISNULL(CE.Code_Tafzil, 0) AS CodeTafzil,
                    ISNULL(H1.Name, '') AS ColName,
                    ISNULL(H2.Name, '') AS MoeinName,
                    ISNULL(H3.Name, '') AS TafzilName,

                    ISNULL(CE.ResidNumber, 0) AS ResidNumber,
                    ISNULL(CE.ResidDate, '')  AS ResidDate,
                    ISNULL(CE.ResidDes, '')   AS ResidDes,

                    ISNULL(CE.ParentSanadID, 0) AS ParentSanadId,
                    ISNULL(PS.NO_Sanad, 0)      AS NoSanad,
                    ISNULL(PS.Vazeit, -1)       AS SanadVazeit,

                    ISNULL(CE.WasDuring, 0) AS WasDuring,

                    ROW_NUMBER() OVER (ORDER BY {orderBy}) AS RowNum
                FROM CheckExpend CE
                LEFT JOIN CheckRecive CR ON CR.ID = CE.CheuqeReceiveID
                LEFT JOIN ParentSanad PS ON PS.ParentSanadID = CE.ParentSanadID
                LEFT JOIN Hesab H1 ON CE.Code_Col > 0
                    AND H1.Code_Col = CE.Code_Col
                    AND ISNULL(H1.Code_Moein, 0) = 0
                    AND ISNULL(H1.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H2 ON CE.Code_Col > 0 AND CE.Code_Moein > 0
                    AND H2.Code_Col = CE.Code_Col
                    AND H2.Code_Moein = CE.Code_Moein
                    AND ISNULL(H2.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H3 ON CE.Code_Tafzil > 0
                    AND H3.Code_Col = -1
                    AND ISNULL(H3.Code_Moein, 0) = 0
                    AND H3.Code_Tafzil = CE.Code_Tafzil
                {where}
            ) T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        var items = (await conn.QueryAsync<ChequeExpendListDto>(
            new CommandDefinition(dataSql, p, cancellationToken: ct))).ToList();

        // محاسبه HesabName (tafzil - moein - col — طبق Delphi CalcField)
        foreach (var it in items)
        {
            var parts = new List<string>();
            if (!string.IsNullOrEmpty(it.TafzilName)) parts.Add(it.TafzilName);
            if (!string.IsNullOrEmpty(it.MoeinName)) parts.Add(it.MoeinName);
            if (!string.IsNullOrEmpty(it.ColName)) parts.Add(it.ColName);
            it.HesabName = parts.Count > 0 ? string.Join(" - ", parts) : "";
        }

        return new ChequeExpendListResultDto
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
    public async Task<ChequeExpendDetailDto?> GetByIdAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT
                CE.ID AS Id,
                ISNULL(CE.CheuqeReceiveID, 0) AS ChequeReceiveId,

                ISNULL(CR.CheckSeries, '') AS CheckSeries,
                ISNULL(CR.CheckMab, 0)     AS CheckMab,
                ISNULL(CR.CheckDate, '')   AS CheckDate,
                ISNULL(CR.CheckPerson, '') AS ReceiveFrom,

                ISNULL(CE.Code_Col, 0)    AS CodeCol,
                ISNULL(CE.Code_Moein, 0)  AS CodeMoein,
                ISNULL(CE.Code_Tafzil, 0) AS CodeTafzil,
                ISNULL(H1.Name, '') AS ColName,
                ISNULL(H2.Name, '') AS MoeinName,
                ISNULL(H3.Name, '') AS TafzilName,

                ISNULL(CE.Code_Col_Pay, 0)    AS CodeColPay,
                ISNULL(CE.Code_Moein_Pay, 0)  AS CodeMoeinPay,
                ISNULL(CE.Code_Tafzil_Pay, 0) AS CodeTafzilPay,
                ISNULL(H4.Name, '') AS ColPayName,
                ISNULL(H5.Name, '') AS MoeinPayName,
                ISNULL(H6.Name, '') AS TafzilPayName,

                ISNULL(CE.ResidNumber, 0) AS ResidNumber,
                ISNULL(CE.ResidDate, '')  AS ResidDate,
                ISNULL(CE.ResidDes, '')   AS ResidDes,

                ISNULL(CE.SanadPersonID, 0) AS SanadPersonId,
                ISNULL(CE.SanadID, 0)       AS SanadId,
                ISNULL(CE.ParentSanadID, 0) AS ParentSanadId,
                ISNULL(PS.NO_Sanad, 0)      AS NoSanad,
                ISNULL(PS.Vazeit, -1)       AS SanadVazeit,

                ISNULL(CE.WasDuring, 0) AS WasDuring

            FROM CheckExpend CE
            LEFT JOIN CheckRecive CR ON CR.ID = CE.CheuqeReceiveID
            LEFT JOIN ParentSanad PS ON PS.ParentSanadID = CE.ParentSanadID

            LEFT JOIN Hesab H1 ON CE.Code_Col > 0
                AND H1.Code_Col = CE.Code_Col
                AND ISNULL(H1.Code_Moein, 0) = 0
                AND ISNULL(H1.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H2 ON CE.Code_Col > 0 AND CE.Code_Moein > 0
                AND H2.Code_Col = CE.Code_Col
                AND H2.Code_Moein = CE.Code_Moein
                AND ISNULL(H2.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H3 ON CE.Code_Tafzil > 0
                AND H3.Code_Col = -1
                AND ISNULL(H3.Code_Moein, 0) = 0
                AND H3.Code_Tafzil = CE.Code_Tafzil

            LEFT JOIN Hesab H4 ON CE.Code_Col_Pay > 0
                AND H4.Code_Col = CE.Code_Col_Pay
                AND ISNULL(H4.Code_Moein, 0) = 0
                AND ISNULL(H4.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H5 ON CE.Code_Col_Pay > 0 AND CE.Code_Moein_Pay > 0
                AND H5.Code_Col = CE.Code_Col_Pay
                AND H5.Code_Moein = CE.Code_Moein_Pay
                AND ISNULL(H5.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H6 ON CE.Code_Tafzil_Pay > 0
                AND H6.Code_Col = -1
                AND ISNULL(H6.Code_Moein, 0) = 0
                AND H6.Code_Tafzil = CE.Code_Tafzil_Pay

            WHERE CE.ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var detail = await conn.QueryFirstOrDefaultAsync<ChequeExpendDetailDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));

        if (detail != null)
        {
            var parts = new List<string>();
            if (!string.IsNullOrEmpty(detail.TafzilName)) parts.Add(detail.TafzilName);
            if (!string.IsNullOrEmpty(detail.MoeinName)) parts.Add(detail.MoeinName);
            if (!string.IsNullOrEmpty(detail.ColName)) parts.Add(detail.ColName);
            detail.HesabName = parts.Count > 0 ? string.Join(" - ", parts) : "";
        }

        return detail;
    }

    // ═══════════════════════════════════════════════════════════════
    //  NEXT NUMBER
    // ═══════════════════════════════════════════════════════════════
    public async Task<int> GetNextNumberAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = "SELECT ISNULL(MAX(ResidNumber), 0) + 1 FROM CheckExpend";
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
    //  AVAILABLE CHEQUES — چک‌های قابل انتخاب
    // ═══════════════════════════════════════════════════════════════
    public async Task<IEnumerable<ChequeExpendAvailableChequeDto>> GetAvailableChequesAsync(
        long orgId, long fyId,
        long? includeChequeReceiveId,
        CancellationToken ct = default)
    {
        // ⭐ طبق دلفی: ChequeOK = 0 AND WasExpended IN (0,2)
        // + اگه در ویرایش هستیم، چک فعلی هم اضافه بشه
        const string sql = @"
            SELECT
                CR.ID AS Id,
                ISNULL(CR.CheckSeries, '') AS CheckSeries,
                ISNULL(CR.CheckMab, 0)     AS CheckMab,
                ISNULL(CR.CheckDate, '')   AS CheckDate,
                ISNULL(B.Name, '')         AS BankName,
                ISNULL(CR.BankBrunch, '')  AS BankBrunch,
                ISNULL(CR.NoHesabCheck, '') AS NoHesabCheck,
                ISNULL(CR.CheckPerson, '') AS CheckPerson,

                ISNULL(CR.Code_Col, 0)    AS CodeCol,
                ISNULL(CR.Code_Moein, 0)  AS CodeMoein,
                ISNULL(CR.Code_Tafzil, 0) AS CodeTafzil,

                ISNULL(CR.Code_Col_Pay, 0)    AS CodeColPay,
                ISNULL(CR.Code_Moein_Pay, 0)  AS CodeMoeinPay,
                ISNULL(CR.Code_Tafzil_Pay, 0) AS CodeTafzilPay,

                ISNULL(CR.WasExpended, 0) AS WasExpended,

                -- HesabName: tafzil - moein - col
                LTRIM(RTRIM(
                    ISNULL(NULLIF(ISNULL(H3.Name, ''), '') + CASE WHEN H2.Name IS NOT NULL AND H2.Name <> '' THEN ' - ' ELSE '' END, '') +
                    ISNULL(NULLIF(ISNULL(H2.Name, ''), '') + CASE WHEN H1.Name IS NOT NULL AND H1.Name <> '' THEN ' - ' ELSE '' END, '') +
                    ISNULL(H1.Name, '')
                )) AS HesabName
            FROM CheckRecive CR
            LEFT JOIN Bank B ON B.ID = CR.BankID
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
            WHERE (ISNULL(CR.ChequeOK, 0) = 0 AND ISNULL(CR.WasExpended, 0) IN (0, 2))
               OR (@includeId > 0 AND CR.ID = @includeId)
            ORDER BY CR.CheckSeries";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<ChequeExpendAvailableChequeDto>(
            new CommandDefinition(sql, new { includeId = includeChequeReceiveId ?? 0 }, cancellationToken: ct));
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
    public async Task<ChequeExpendCreateResultDto> CreateAsync(
        long orgId, long fyId,
        ChequeExpendCreateDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.ChequeReceiveId <= 0) throw new InvalidOperationException("چک الزامی است");
        if (dto.CodeCol <= 0) throw new InvalidOperationException("کد کل شخص دریافت‌کننده الزامی است");
        if (string.IsNullOrWhiteSpace(dto.ResidDate)) throw new InvalidOperationException("تاریخ رسید الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        // ─── بررسی چک ───
        var cheque = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ChequeOK, WasExpended, CheckMab, CheckSeries, CheckDate, CheckPerson,
                       Code_Col, Code_Moein, Code_Tafzil,
                       Code_Col_Pay, Code_Moein_Pay, Code_Tafzil_Pay
                FROM CheckRecive WHERE ID = @id",
                new { id = dto.ChequeReceiveId }, cancellationToken: ct));

        if (cheque == null) throw new InvalidOperationException("چک انتخاب‌شده یافت نشد");

        int chequeOk = (int)(decimal)(cheque.ChequeOK ?? 0);
        int wasExpended = (int)(decimal)(cheque.WasExpended ?? 0);

        if (chequeOk != 0) throw new InvalidOperationException("فقط چک‌های در جریان وصول قابل خرج هستند");
        if (wasExpended == 1) throw new InvalidOperationException("این چک قبلاً خرج شده است");

        // ─── چک تکراری ───
        var dupCheque = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM CheckExpend WHERE CheuqeReceiveID = @cid",
                new { cid = dto.ChequeReceiveId }, cancellationToken: ct));
        if (dupCheque > 0) throw new InvalidOperationException("این چک قبلاً در سیستم خرج شده است");

        // ─── شماره رسید ───
        var residNumber = dto.ResidNumber ?? 0;
        if (residNumber <= 0)
            residNumber = await GetNextNumberAsync(orgId, fyId, ct);

        var dup = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM CheckExpend WHERE ResidNumber = @n",
                new { n = residNumber }, cancellationToken: ct));
        if (dup > 0) throw new InvalidOperationException($"شماره رسید {residNumber} تکراری است");

        // ─── بررسی سند ───
        if (dto.ParentSanadId is > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, dto.ParentSanadId.Value, ct);
            if (v == -1) throw new InvalidOperationException("سند انتخاب‌شده یافت نشد");
            if (v == 2) throw new InvalidOperationException("سند انتخاب‌شده قطعی است");
        }

        var today = GetTodayPersian();
        var now = GetCurrentTime();
        var checkMab = (decimal)(cheque.CheckMab ?? 0m);

        using var tx = conn.BeginTransaction();
        try
        {
            // ═══ ۱. درج اولیه CheckExpend ═══
            const string insertSql = @"
                INSERT INTO CheckExpend
                    (CheuqeReceiveID, ResidNumber, ResidDate, ResidDes,
                     Code_Col, Code_Moein, Code_Tafzil,
                     Code_Col_Pay, Code_Moein_Pay, Code_Tafzil_Pay,
                     ParentSanadID, SanadPersonID, SanadID, WasDuring,
                     Code_OP, Date_OP, Time_Op)
                OUTPUT INSERTED.ID
                VALUES
                    (@chequeReceiveId, @residNumber, @residDate, @residDes,
                     @codeCol, @codeMoein, @codeTafzil,
                     @codeColPay, @codeMoeinPay, @codeTafzilPay,
                     0, 0, 0, @wasDuring,
                     @userCode, @today, @now)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertSql, new
                {
                    chequeReceiveId = dto.ChequeReceiveId,
                    residNumber,
                    residDate = dto.ResidDate ?? "",
                    residDes = dto.ResidDes ?? "",
                    codeCol = dto.CodeCol,
                    codeMoein = dto.CodeMoein,
                    codeTafzil = dto.CodeTafzil,
                    codeColPay = dto.CodeColPay,
                    codeMoeinPay = dto.CodeMoeinPay,
                    codeTafzilPay = dto.CodeTafzilPay,
                    wasDuring = dto.WasDuring ? 1 : 0,
                    userCode,
                    today,
                    now
                }, transaction: tx, cancellationToken: ct));

            // ═══ ۲. سند خودکار ═══
            long parentSanadId = 0;
            int? noSanad = null;
            long sanadPersonId = 0;
            long sanadReceivableId = 0;

            if (dto.SaveWithSanad)
            {
                var personName = await _sanadService.GetHesabNameAsync(
                    conn, tx, dto.CodeCol, dto.CodeMoein, dto.CodeTafzil, ct);

                var ctx = new ChequeExpendSanadContext
                {
                    ChequeExpendId = newId,
                    ChequeReceiveId = dto.ChequeReceiveId,
                    ResidNumber = residNumber,
                    ResidDate = dto.ResidDate ?? "",
                    ResidDes = dto.ResidDes ?? "",
                    CheckMab = checkMab,
                    CheckSeries = (string)(cheque.CheckSeries ?? ""),
                    CheckDate = (string)(cheque.CheckDate ?? ""),
                    CheckPerson = (string)(cheque.CheckPerson ?? ""),

                    PersonCodeCol = dto.CodeCol,
                    PersonCodeMoein = dto.CodeMoein,
                    PersonCodeTafzil = dto.CodeTafzil,
                    PersonName = personName,

                    ReceivableCodeCol = dto.CodeColPay,
                    ReceivableCodeMoein = dto.CodeMoeinPay,
                    ReceivableCodeTafzil = dto.CodeTafzilPay,

                    WasDuring = dto.WasDuring ? 1 : 0,

                    ExistingParentSanadID = dto.ParentSanadId,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0) ? dto.NoSanad.Value : (int?)null,

                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var sanadRes = await _sanadService.CreateChequeExpendSanadAsync(conn, tx, ctx, ct);
                parentSanadId = sanadRes.ParentSanadID;
                noSanad = sanadRes.NoSanad;
                sanadPersonId = sanadRes.SanadIdBed;
                sanadReceivableId = sanadRes.SanadIdBes;

                // ═══ ۳. آپدیت CheckExpend با Sanad IDs ═══
                await conn.ExecuteAsync(new CommandDefinition(@"
                    UPDATE CheckExpend
                    SET ParentSanadID = @pid,
                        SanadPersonID = @personId,
                        SanadID       = @recvId
                    WHERE ID = @id",
                    new
                    {
                        id = newId,
                        pid = parentSanadId,
                        personId = sanadPersonId,
                        recvId = sanadReceivableId
                    }, transaction: tx, cancellationToken: ct));
            }

            // ═══ ۴. آپدیت CheckRecive.WasExpended ═══
            var newWasExpended = dto.WasDuring ? 2 : 1;
            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE CheckRecive SET WasExpended = @w WHERE ID = @cid",
                new { w = newWasExpended, cid = dto.ChequeReceiveId },
                transaction: tx, cancellationToken: ct));

            tx.Commit();

            return new ChequeExpendCreateResultDto
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
        ChequeExpendUpdateDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.Id <= 0) throw new InvalidOperationException("شناسه نامعتبر است");
        if (dto.ChequeReceiveId <= 0) throw new InvalidOperationException("چک الزامی است");
        if (dto.CodeCol <= 0) throw new InvalidOperationException("کد کل شخص الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var current = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, CheuqeReceiveID, ResidNumber, ParentSanadID, SanadPersonID, SanadID, WasDuring
                FROM CheckExpend WHERE ID = @id",
                new { id = dto.Id }, cancellationToken: ct));

        if (current == null) throw new InvalidOperationException("خرج چک یافت نشد");

        long oldChequeReceiveId = (long)(decimal)(current.CheuqeReceiveID ?? 0);
        long oldParentSanadId = (long)(decimal)(current.ParentSanadID ?? 0);
        long oldSanadPersonId = (long)(decimal)(current.SanadPersonID ?? 0);
        long oldSanadRecvId = (long)(decimal)(current.SanadID ?? 0);

        if (oldParentSanadId > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, oldParentSanadId, ct);
            if (v == 2) throw new InvalidOperationException("سند قطعی است و قابل ویرایش نیست");
        }

        // ─── بررسی چک ───
        var cheque = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT ID, ChequeOK, WasExpended, CheckMab, CheckSeries, CheckDate, CheckPerson
                FROM CheckRecive WHERE ID = @id",
                new { id = dto.ChequeReceiveId }, cancellationToken: ct));

        if (cheque == null) throw new InvalidOperationException("چک انتخاب‌شده یافت نشد");

        int chequeOk = (int)(decimal)(cheque.ChequeOK ?? 0);
        int wasExpended = (int)(decimal)(cheque.WasExpended ?? 0);

        if (chequeOk != 0) throw new InvalidOperationException("فقط چک‌های در جریان وصول قابل خرج هستند");

        // اگه چک عوض شده، نباید قبلاً خرج شده باشه
        if (dto.ChequeReceiveId != oldChequeReceiveId && wasExpended == 1)
            throw new InvalidOperationException("چک جدید قبلاً خرج شده است");

        // چک تکراری (به‌جز خودمون)
        var dupCheque = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM CheckExpend WHERE CheuqeReceiveID = @cid AND ID <> @id",
                new { cid = dto.ChequeReceiveId, id = dto.Id }, cancellationToken: ct));
        if (dupCheque > 0) throw new InvalidOperationException("این چک قبلاً در سیستم خرج شده است");

        // ─── شماره رسید ───
        var newResidNumber = dto.ResidNumber ?? 0;
        if (newResidNumber > 0)
        {
            var dup = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition("SELECT COUNT(*) FROM CheckExpend WHERE ResidNumber = @n AND ID <> @id",
                    new { n = newResidNumber, id = dto.Id }, cancellationToken: ct));
            if (dup > 0) throw new InvalidOperationException($"شماره رسید {newResidNumber} تکراری است");
        }
        else newResidNumber = (int)(decimal)current.ResidNumber;

        var today = GetTodayPersian();
        var now = GetCurrentTime();
        var checkMab = (decimal)(cheque.CheckMab ?? 0m);

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── حذف Sanad قدیمی ───
            if (oldSanadPersonId > 0 || oldSanadRecvId > 0)
            {
                var ids = new[] { oldSanadPersonId, oldSanadRecvId }.Where(x => x > 0).ToArray();
                await _sanadService.DeleteSanadRowsAsync(conn, tx, ids, ct);
            }

            // ─── آپدیت CheckExpend ───
            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckExpend
                SET CheuqeReceiveID = @chequeReceiveId,
                    ResidNumber = @residNumber,
                    ResidDate = @residDate,
                    ResidDes = @residDes,
                    Code_Col = @codeCol,
                    Code_Moein = @codeMoein,
                    Code_Tafzil = @codeTafzil,
                    Code_Col_Pay = @codeColPay,
                    Code_Moein_Pay = @codeMoeinPay,
                    Code_Tafzil_Pay = @codeTafzilPay,
                    WasDuring = @wasDuring,
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
                    chequeReceiveId = dto.ChequeReceiveId,
                    residNumber = newResidNumber,
                    residDate = dto.ResidDate ?? "",
                    residDes = dto.ResidDes ?? "",
                    codeCol = dto.CodeCol,
                    codeMoein = dto.CodeMoein,
                    codeTafzil = dto.CodeTafzil,
                    codeColPay = dto.CodeColPay,
                    codeMoeinPay = dto.CodeMoeinPay,
                    codeTafzilPay = dto.CodeTafzilPay,
                    wasDuring = dto.WasDuring ? 1 : 0,
                    userCode,
                    today,
                    now
                }, transaction: tx, cancellationToken: ct));

            // ─── Sanad جدید ───
            if (dto.SaveWithSanad)
            {
                var personName = await _sanadService.GetHesabNameAsync(
                    conn, tx, dto.CodeCol, dto.CodeMoein, dto.CodeTafzil, ct);

                var ctx = new ChequeExpendSanadContext
                {
                    ChequeExpendId = dto.Id,
                    ChequeReceiveId = dto.ChequeReceiveId,
                    ResidNumber = newResidNumber,
                    ResidDate = dto.ResidDate ?? "",
                    ResidDes = dto.ResidDes ?? "",
                    CheckMab = checkMab,
                    CheckSeries = (string)(cheque.CheckSeries ?? ""),
                    CheckDate = (string)(cheque.CheckDate ?? ""),
                    CheckPerson = (string)(cheque.CheckPerson ?? ""),

                    PersonCodeCol = dto.CodeCol,
                    PersonCodeMoein = dto.CodeMoein,
                    PersonCodeTafzil = dto.CodeTafzil,
                    PersonName = personName,

                    ReceivableCodeCol = dto.CodeColPay,
                    ReceivableCodeMoein = dto.CodeMoeinPay,
                    ReceivableCodeTafzil = dto.CodeTafzilPay,

                    WasDuring = dto.WasDuring ? 1 : 0,

                    ExistingParentSanadID = dto.ParentSanadId,
                    ExistingNoSanad = (dto.NoSanad.HasValue && dto.NoSanad.Value > 0) ? dto.NoSanad.Value : (int?)null,

                    TimeOp = now,
                    TodayPersian = today,
                    UserCode = userCode
                };

                var sanadRes = await _sanadService.CreateChequeExpendSanadAsync(conn, tx, ctx, ct);

                await conn.ExecuteAsync(new CommandDefinition(@"
                    UPDATE CheckExpend
                    SET ParentSanadID = @pid,
                        SanadPersonID = @personId,
                        SanadID       = @recvId
                    WHERE ID = @id",
                    new
                    {
                        id = dto.Id,
                        pid = sanadRes.ParentSanadID,
                        personId = sanadRes.SanadIdBed,
                        recvId = sanadRes.SanadIdBes
                    }, transaction: tx, cancellationToken: ct));
            }

            // ─── WasExpended قدیمی → 0 (اگه چک عوض شده) ───
            if (dto.ChequeReceiveId != oldChequeReceiveId)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE CheckRecive SET WasExpended = 0 WHERE ID = @cid",
                    new { cid = oldChequeReceiveId }, transaction: tx, cancellationToken: ct));
            }

            // ─── WasExpended چک جدید ───
            var newWasExpended = dto.WasDuring ? 2 : 1;
            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE CheckRecive SET WasExpended = @w WHERE ID = @cid",
                new { w = newWasExpended, cid = dto.ChequeReceiveId },
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
                SELECT ID, CheuqeReceiveID, ParentSanadID, SanadPersonID, SanadID
                FROM CheckExpend WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (current == null) throw new InvalidOperationException("خرج چک یافت نشد");

        long chequeReceiveId = (long)(decimal)(current.CheuqeReceiveID ?? 0);
        long parentSanadId = (long)(decimal)(current.ParentSanadID ?? 0);
        long sanadPersonId = (long)(decimal)(current.SanadPersonID ?? 0);
        long sanadRecvId = (long)(decimal)(current.SanadID ?? 0);

        if (parentSanadId > 0)
        {
            var v = await GetSanadVazeitAsync(orgId, fyId, parentSanadId, ct);
            if (v == 2) throw new InvalidOperationException("سند قطعی است و قابل حذف نیست");
        }

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── حذف Sanad ───
            if (sanadPersonId > 0 || sanadRecvId > 0)
            {
                var ids = new[] { sanadPersonId, sanadRecvId }.Where(x => x > 0).ToArray();
                await _sanadService.DeleteSanadRowsAsync(conn, tx, ids, ct);
            }

            // ─── حذف CheckExpend ───
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM CheckExpend WHERE ID = @id",
                new { id }, transaction: tx, cancellationToken: ct));

            // ─── ریست WasExpended چک ───
            if (chequeReceiveId > 0)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE CheckRecive SET WasExpended = 0 WHERE ID = @cid",
                    new { cid = chequeReceiveId }, transaction: tx, cancellationToken: ct));
            }

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
}