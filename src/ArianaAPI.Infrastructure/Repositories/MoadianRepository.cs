using ArianaAPI.Application.Dtos.Moadian;
using System.Text;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Domain.Entities.Moadian;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// Repository مودیان — پورت از *Bl.cs
/// همه‌ی جداول با پیشوند tax_*
/// </summary>
public class MoadianRepository : IMoadianRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<MoadianRepository> _logger;

    public MoadianRepository(ITenantConnectionFactory factory, ILogger<MoadianRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════════════
    //  SETTING
    // ═══════════════════════════════════════════════════════════
    public async Task<TaxSetting?> GetSettingAsync(long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1
                tax_user_name  AS TaxUserName,
                private_key    AS PrivateKey,
                code_egtesadi  AS CodeEgtesadi,
                ISNULL(is_sandbox, 1) AS IsSandbox,
                ISNULL(invoice, 1)    AS Invoice,
                ISNULL(customer, 1)   AS Customer,
                ISNULL(stuff, 1)      AS Stuff
            FROM tax_setting";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<TaxSetting>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task UpdateSettingAsync(long orgId, long fyId, TaxSetting s, CancellationToken ct = default)
    {
        const string sql = @"
            UPDATE tax_setting SET
                tax_user_name = @TaxUserName,
                private_key   = @PrivateKey,
                code_egtesadi = @CodeEgtesadi,
                is_sandbox    = @IsSandbox";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(sql, s, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════
    //  HEADER
    // ═══════════════════════════════════════════════════════════
    public async Task<TaxHeader?> GetHeaderByIdAsync(long orgId, long fyId, long id, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                th.*,
                th.inty     AS Inty,
                th.ins      AS Ins,
                th.irtaxid  AS IrTaxId,
                fp.NoFactor AS FldFacNo
            FROM tax_header th
            LEFT JOIN FactorParent fp ON fp.ID = th.factor_id
            WHERE th.id = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<TaxHeader>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    public async Task<TaxHeader?> GetHeaderByTaxIdAsync(long orgId, long fyId, string taxid, CancellationToken ct = default)
    {
        const string sql = "SELECT TOP 1 * FROM tax_header WHERE taxid = @taxid";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<TaxHeader>(
            new CommandDefinition(sql, new { taxid }, cancellationToken: ct));
    }
    // ⭐ پیدا کردن سند اصلاحی/ابطالی/برگشتی بر اساس irtaxid
    public async Task<TaxHeader?> GetCorrectionByRefTaxIdAsync(long orgId, long fyId, string refTaxId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1 *
            FROM tax_header
            WHERE irtaxid = @refTaxId
              AND ins IN (2, 3, 4)
            ORDER BY id DESC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<TaxHeader>(
            new CommandDefinition(sql, new { refTaxId }, cancellationToken: ct));
    }
    public async Task<List<TaxHeader>> GetAllHeadersAsync(long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                th.*,
                fp.NoFactor AS FldFacNo,
                h.Name AS customer_name
            FROM tax_header th
            LEFT JOIN FactorParent fp ON fp.ID = th.factor_id
            LEFT JOIN Hesab h ON CAST(h.Code_Tafzil AS BIGINT) = th.CustomerCode
            ORDER BY fp.NoFactor DESC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var list = await conn.QueryAsync<TaxHeader>(
            new CommandDefinition(sql, cancellationToken: ct));
        return list.ToList();
    }

    public async Task<MoadianHeaderListResultDto> GetHeadersPagedAsync(
    long orgId, long fyId, MoadianHeaderListRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ═══════════════════════════════════════════════════
        //  WHERE
        // ═══════════════════════════════════════════════════
        var where = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            where.Append(@" AND (
            th.inno LIKE @search OR
            fp.NoFactor LIKE @search OR
            h.Name LIKE @search OR
            th.ref_number LIKE @search OR
            th.taxid LIKE @search OR
            th.uid LIKE @search
        ) ");
            p.Add("search", "%" + req.Search.Trim() + "%");
        }

        if (req.Status.HasValue)
        {
            where.Append(" AND th.status = @status ");
            p.Add("status", req.Status.Value);
        }

        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            where.Append(" AND th.indatim_persian >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            where.Append(" AND th.indatim_persian <= @dateTo ");
            p.Add("dateTo", req.DateTo.Trim());
        }

        // ═══════════════════════════════════════════════════
        //  ORDER BY — whitelisted (جلوگیری از SQL Injection)
        // ═══════════════════════════════════════════════════
        var sortDir = (req.SortDir ?? "desc").ToLowerInvariant() == "asc" ? "ASC" : "DESC";
        var sortCol = (req.SortBy ?? "date").ToLowerInvariant() switch
        {
            "serial" => $"CAST(ISNULL(th.inno, '0') AS BIGINT) {sortDir}",
            "amount" => $"th.tbill {sortDir}",
            "customer" => $"h.Name {sortDir}",
            "customercode" => $"th.CustomerCode {sortDir}",
            "factor" => $"CAST(ISNULL(fp.NoFactor, 0) AS BIGINT) {sortDir}",
            "status" => $"th.status {sortDir}",
            _ => $"th.indatim_persian {sortDir}, th.id {sortDir}"  // date
        };

        // ═══════════════════════════════════════════════════
        //  صفحه‌بندی
        // ═══════════════════════════════════════════════════
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize < 1 ? 50 : (req.PageSize > 10000 ? 10000 : req.PageSize);

        p.Add("startRow", (page - 1) * pageSize + 1);
        p.Add("endRow", page * pageSize);

        // ═══════════════════════════════════════════════════
        //  شمارش کل (برای صفحه‌بندی)
        // ═══════════════════════════════════════════════════
        var countSql = $@"
        SELECT COUNT(*)
        FROM tax_header th
        LEFT JOIN FactorParent fp ON fp.ID = th.factor_id
        LEFT JOIN Hesab h ON CAST(h.Code_Tafzil AS BIGINT) = th.CustomerCode
        {where}";

        var totalCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, commandTimeout: 120, cancellationToken: ct));

        // ═══════════════════════════════════════════════════
        //  آمار کلی (مستقل از فیلتر)
        // ═══════════════════════════════════════════════════
        const string statsSql = @"
        SELECT 
            COUNT(*) AS Total,
            SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS Pending,
            SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS Sent,
            SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS Error,
            SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS Success
        FROM tax_header";

        var stats = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(statsSql, commandTimeout: 120, cancellationToken: ct));

        // ═══════════════════════════════════════════════════
        //  کوئری اصلی با ROW_NUMBER (SQL Server 2008 R2)
        // ═══════════════════════════════════════════════════
        var sql = $@"
        SELECT * FROM (
            SELECT 
                th.id            AS Id,
                th.status        AS Status,
                th.inno          AS Inno,
                th.indatim_persian AS IndatimPersian,
                th.factor_id     AS FactorId,
                CAST(fp.NoFactor AS NVARCHAR(50)) AS FactorNo,
                th.CustomerCode  AS CustomerCode,
                h.Name           AS CustomerName,
                th.tbill         AS Tbill,
                th.ref_number    AS RefNumber,
                th.taxid         AS TaxId,
                th.uid           AS Uid,
                th.inty          AS Inty,
                th.ins           AS Ins,
                th.irtaxid       AS IrTaxId,
                ROW_NUMBER() OVER (ORDER BY {sortCol}) AS RowNum
            FROM tax_header th
            LEFT JOIN FactorParent fp ON fp.ID = th.factor_id
            LEFT JOIN Hesab h ON CAST(h.Code_Tafzil AS BIGINT) = th.CustomerCode
            {where}
        ) AS T
        WHERE T.RowNum BETWEEN @startRow AND @endRow
        ORDER BY T.RowNum";

        var items = (await conn.QueryAsync<MoadianHeaderListItemDto>(
            new CommandDefinition(sql, p, commandTimeout: 120, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new MoadianHeaderListResultDto
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            CountAll = stats != null ? (int)(stats.Total ?? 0) : 0,
            CountPending = stats != null ? (int)(stats.Pending ?? 0) : 0,
            CountSent = stats != null ? (int)(stats.Sent ?? 0) : 0,
            CountError = stats != null ? (int)(stats.Error ?? 0) : 0,
            CountSuccess = stats != null ? (int)(stats.Success ?? 0) : 0   // ⭐
        };
    }
    public async Task<long> AddHeaderAsync(long orgId, long fyId, TaxHeader h, CancellationToken ct = default)
    {
        const string sql = @"
                 INSERT INTO tax_header (
                    bbc, cdcd, cdcn, scc, crn, factor_id,
                    tvop, cap, insp, inno, CustomerCode,
                    inty, inp, ins, setm, status,
                    tonw, tprdis, tdis, tadis, tvam, todam, tbill,
                    indatim_datetime, Indati2m_datetime, indatim, Indati2m,
                    indatim_persian, Indati2m_persian, irtaxid,
                    taxid                             
                ) VALUES (
                    @Bbc, @Cdcd, @Cdcn, @Scc, @Crn, @FactorId,
                    @Tvop, @Cap, @Insp, @Inno, @CustomerCode,
                    @Inty, @Inp, @Ins, @Setm, @Status,
                    @Tonw, @Tprdis, @Tdis, @Tadis, @Tvam, @Todam, @Tbill,
                    @IndatimDatetime, @Indati2mDatetime, @Indatim, @Indati2m,
                    @IndatimPersian, @Indati2mPersian, @IrTaxId,
                    @TaxId                             
                );
                SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

        var p = new
        {
            h.Bbc,
            h.Cdcd,
            h.Cdcn,
            h.Scc,
            h.Crn,
            h.FactorId,
            h.Tvop,
            h.Cap,
            h.Insp,
            Inno = h.Inno ?? "",
            h.CustomerCode,
            h.Inty,
            h.Inp,
            h.Ins,
            h.Setm,
            h.Status,
            h.Tonw,
            h.Tprdis,
            h.Tdis,
            h.Tadis,
            h.Tvam,
            h.Todam,
            h.Tbill,
            h.IndatimDatetime,
            h.Indati2mDatetime,
            h.Indatim,
            h.Indati2m,
            h.IndatimPersian,
            h.Indati2mPersian,
            IrTaxId = h.IrTaxId ?? "",
            TaxId = h.TaxId ?? ""
        };

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var newId = await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, p, cancellationToken: ct));

        _logger.LogInformation("tax_header جدید ثبت شد: Id={Id}, inno={Inno}", newId, h.Inno);
        return newId;
    }

    public async Task UpdateHeaderAsync(long orgId, long fyId, TaxHeader h, CancellationToken ct = default)
    {
        const string sql = @"
            UPDATE tax_header SET
                bbc = @Bbc, cdcd = @Cdcd, cdcn = @Cdcn, scc = @Scc, crn = @Crn,
                irtaxid = @IrTaxId, tax_status = @TaxStatus,
                accept_ref_number = @AcceptRefNumber,
                tvop = @Tvop, cap = @Cap, insp = @Insp, inno = @Inno,
                CustomerCode = @CustomerCode, inty = @Inty, inp = @Inp, ins = @Ins,
                setm = @Setm, status = @Status,
                tonw = @Tonw, tprdis = @Tprdis, tdis = @Tdis, tadis = @Tadis,
                tvam = @Tvam, todam = @Todam, tbill = @Tbill,
                indatim_datetime = CASE 
                    WHEN @IndatimDatetime IS NULL THEN indatim_datetime 
                    ELSE @IndatimDatetime 
                END,
                Indati2m_datetime = CASE 
                    WHEN @Indati2mDatetime IS NULL THEN Indati2m_datetime 
                    ELSE @Indati2mDatetime 
                END,
                indatim = @Indatim, Indati2m = @Indati2m,
                indatim_persian = CASE 
                    WHEN @IndatimPersian IS NULL OR @IndatimPersian = '' THEN indatim_persian 
                    ELSE @IndatimPersian 
                END,
                Indati2m_persian = CASE 
                    WHEN @Indati2mPersian IS NULL OR @Indati2mPersian = '' THEN Indati2m_persian 
                    ELSE @Indati2mPersian 
                END,
                ref_number = CASE 
                   WHEN @RefNumber IS NULL OR @RefNumber = '' THEN ref_number 
                ELSE @RefNumber 
                END,
                uid = CASE 
                    WHEN @Uid IS NULL OR @Uid = '' THEN uid 
                    ELSE @Uid 
                END,
                taxid = CASE 
                    WHEN @TaxId IS NULL OR @TaxId = '' THEN taxid 
                    ELSE @TaxId 
                END
            WHERE id = @Id";

        var p = new
        {
            h.Id,
            h.Bbc,
            h.Cdcd,
            h.Cdcn,
            h.Scc,
            h.Crn,
            h.IrTaxId,
            h.TaxStatus,
            h.AcceptRefNumber,
            h.Tvop,
            h.Cap,
            h.Insp,
            Inno = h.Inno ?? "",
            h.CustomerCode,
            h.Inty,
            h.Inp,
            h.Ins,
            h.Setm,
            h.Status,
            h.Tonw,
            h.Tprdis,
            h.Tdis,
            h.Tadis,
            h.Tvam,
            h.Todam,
            h.Tbill,
            h.IndatimDatetime,
            h.Indati2mDatetime,
            h.Indatim,
            h.Indati2m,
            h.IndatimPersian,
            h.Indati2mPersian,
            RefNumber = h.RefNumber ?? "",
            Uid = h.Uid ?? "",
            TaxId = h.TaxId ?? ""
        };

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(sql, p, cancellationToken: ct));
    }

    public async Task DeleteHeaderAsync(long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM tax_body WHERE header_id = @id", new { id }, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM tax_header WHERE id = @id", new { id }, cancellationToken: ct));

        _logger.LogInformation("tax_header حذف شد: Id={Id}", id);
    }

    public async Task ChangeStatusAsync(long orgId, long fyId, long id, int status, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE tax_header SET status = @status WHERE id = @id",
            new { id, status }, cancellationToken: ct));
    }

    public async Task<long> GetLastInnoAsync(long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var last = await conn.ExecuteScalarAsync<long?>(
            new CommandDefinition(
                "SELECT MAX(CAST(inno AS BIGINT)) FROM tax_header WHERE inno IS NOT NULL AND inno <> ''",
                cancellationToken: ct));
        return last ?? 0;
    }

    // ═══════════════════════════════════════════════════════════
    //  BODY
    // ═══════════════════════════════════════════════════════════
    public async Task<List<TaxBody>> GetBodyByHeaderIdAsync(long orgId, long fyId, long headerId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                tb.id, tb.header_id AS HeaderId, tb.stuff_id AS StuffId, tb.unit_id AS UnitId,
                an.Name AS Sstt,
                CAST(an.tax_id AS NVARCHAR(50)) AS Sstid,
                CAST(au.tax_id AS NVARCHAR(50)) AS Mu,
                tb.am AS Am, tb.fee AS Fee, tb.prdis AS Prdis, tb.dis AS Dis,
                tb.adis AS Adis, tb.vra AS Vra, tb.vam AS Vam, tb.odr AS Odr,
                tb.odam AS Odam, tb.tsstam AS Tsstam, tb.nw AS Nw,
                tb.cfee AS Cfee, tb.cut AS Cut, tb.exr AS Exr, tb.ssrv AS Ssrv, tb.sscv AS Sscv,
                tb.odt AS Odt, tb.olt AS Olt, tb.olr AS Olr, tb.olam AS Olam,
                tb.consfee AS Consfee, tb.spro AS Spro, tb.bros AS Bros, tb.tcpbs AS Tcpbs,
                tb.cop AS Cop, tb.vop AS Vop, tb.bsrn AS Bsrn
            FROM tax_body tb
            LEFT JOIN ArticleNew an ON an.ID = tb.stuff_id
            LEFT JOIN ArticleUnit au ON au.ID = tb.unit_id
            WHERE tb.header_id = @headerId
            ORDER BY tb.id ASC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var list = await conn.QueryAsync<TaxBody>(
            new CommandDefinition(sql, new { headerId }, cancellationToken: ct));
        return list.ToList();
    }

    public async Task AddBodyAsync(long orgId, long fyId, TaxBody b, CancellationToken ct = default)
    {
        const string sql = @"
            INSERT INTO tax_body (
                cut, exr, ssrv, sscv, header_id, stuff_id, unit_id,
                am, fee, dis, vam, vra, prdis, adis, odam, tsstam,
                nw, odr, vop, cop, bsrn
            ) VALUES (
                @Cut, @Exr, @Ssrv, @Sscv, @HeaderId, @StuffId, @UnitId,
                @Am, @Fee, @Dis, @Vam, @Vra, @Prdis, @Adis, @Odam, @Tsstam,
                @Nw, @Odr, @Vop, @Cop, @Bsrn
            )";

        var p = new
        {
            Cut = string.IsNullOrEmpty(b.Cut) ? "IRR" : b.Cut,
            b.Exr,
            b.Ssrv,
            b.Sscv,
            b.HeaderId,
            b.StuffId,
            b.UnitId,
            b.Am,
            b.Fee,
            b.Dis,
            b.Vam,
            b.Vra,
            b.Prdis,
            b.Adis,
            b.Odam,
            b.Tsstam,
            b.Nw,
            b.Odr,
            b.Vop,
            b.Cop,
            Bsrn = b.Bsrn ?? ""
        };

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(sql, p, cancellationToken: ct));
    }

    public async Task DeleteBodyByHeaderIdAsync(long orgId, long fyId, long headerId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM tax_body WHERE header_id = @headerId",
            new { headerId }, cancellationToken: ct));
    }

    public async Task ClearBodyBsrnAsync(long orgId, long fyId, long headerId, CancellationToken ct = default)
    {
        const string sql = @"
            UPDATE tax_body 
            SET bsrn = NULL 
            WHERE (bsrn IS NULL OR bsrn = '') AND header_id = @headerId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(sql, new { headerId }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════
    //  HISTORY
    // ═══════════════════════════════════════════════════════════
    public async Task AddHistoryAsync(long orgId, long fyId, TaxHistory h, CancellationToken ct = default)
    {
        const string sql = @"
            INSERT INTO tax_history (uid, header_id, ref_number, tax_id, create_date)
            VALUES (@Uid, @HeaderId, @RefNumber, @TaxId, GETDATE())";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(sql, h, cancellationToken: ct));
    }


    // ═══════════════════════════════════════════════════════════
    //  ERROR (ذخیره‌ی خطا/هشدار مودیان)
    // ═══════════════════════════════════════════════════════════
    public async Task AddErrorAsync(long orgId, long fyId, long headerId, string msg, CancellationToken ct = default)
    {
        const string sql = @"
            INSERT INTO tax_erorr (header_id, msg)
            VALUES (@headerId, @msg)";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(sql,
            new { headerId, msg }, cancellationToken: ct));
    }

    public async Task ClearErrorsAsync(long orgId, long fyId, long headerId, CancellationToken ct = default)
    {
        const string sql = "DELETE FROM tax_erorr WHERE header_id = @headerId";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(sql, new { headerId }, cancellationToken: ct));
    }

    public async Task<List<string>> GetErrorsAsync(long orgId, long fyId, long headerId, CancellationToken ct = default)
    {
        const string sql = @"SELECT msg FROM tax_erorr WHERE header_id = @headerId ORDER BY id";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var rows = await conn.QueryAsync<string>(new CommandDefinition(sql, new { headerId }, cancellationToken: ct));
        return rows.ToList();
    }
    // ═══════════════════════════════════════════════════════════
    //  SOURCE (Factor — برای انتخاب و ارسال)
    // ═══════════════════════════════════════════════════════════
    public async Task<List<TaxFactorSource>> GetPendingFactorsAsync(long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                fp.ID AS Id,
                CAST(fp.NoFactor AS NVARCHAR(50)) AS FldFacNo,
                fp.Date_In AS FldFacDate,
                CAST(fp.Cost AS NVARCHAR(50)) AS FldSumKol,
                fp.CodeTafzil AS CustomerCode,
                h.Name AS FldCustName,
                CAST(ISNULL(fp.IsCaSh, 1) AS INT) AS IsCash
            FROM FactorParent fp
            LEFT JOIN Hesab h ON CAST(h.Code_Tafzil AS DECIMAL(18,0)) = CAST(fp.CodeTafzil AS DECIMAL(18,0))
            WHERE fp.FactorKind = 1
              AND fp.ID NOT IN (SELECT factor_id FROM tax_header WHERE factor_id IS NOT NULL)
            ORDER BY fp.NoFactor DESC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var list = await conn.QueryAsync<TaxFactorSource>(
            new CommandDefinition(sql, cancellationToken: ct));
        return list.ToList();
    }
    public async Task<MoadianPendingListResultDto> GetPendingFactorsPagedAsync(
    long orgId, long fyId, MoadianPendingListRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ═══════════════════════════════════════════════════
        //  WHERE
        // ═══════════════════════════════════════════════════
        var where = new StringBuilder(@"
        WHERE fp.FactorKind = 1
          AND fp.ID NOT IN (SELECT factor_id FROM tax_header WHERE factor_id IS NOT NULL) ");

        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            where.Append(@" AND (
            CAST(fp.NoFactor AS NVARCHAR(50)) LIKE @search OR
            h.Name LIKE @search OR
            CAST(fp.CodeTafzil AS NVARCHAR(50)) LIKE @search
        ) ");
            p.Add("search", "%" + req.Search.Trim() + "%");
        }

        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            where.Append(" AND fp.Date_In >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            where.Append(" AND fp.Date_In <= @dateTo ");
            p.Add("dateTo", req.DateTo.Trim());
        }

        // ═══════════════════════════════════════════════════
        //  ORDER BY — whitelisted
        // ═══════════════════════════════════════════════════
        var sortDir = (req.SortDir ?? "desc").ToLowerInvariant() == "asc" ? "ASC" : "DESC";
        var sortCol = (req.SortBy ?? "date").ToLowerInvariant() switch
        {
            "no" => $"CAST(fp.NoFactor AS BIGINT) {sortDir}",
            "amount" => $"fp.Cost {sortDir}",
            "customer" => $"h.Name {sortDir}",
            "customercode" => $"th.CustomerCode {sortDir}",
            _ => $"fp.Date_In {sortDir}, fp.NoFactor {sortDir}"  // date
        };

        // ═══════════════════════════════════════════════════
        //  صفحه‌بندی
        // ═══════════════════════════════════════════════════
        var page = req.Page < 1 ? 1 : req.Page;
        var pageSize = req.PageSize < 1 ? 50 : (req.PageSize > 10000 ? 10000 : req.PageSize);

        p.Add("startRow", (page - 1) * pageSize + 1);
        p.Add("endRow", page * pageSize);

        // ═══════════════════════════════════════════════════
        //  شمارش کل
        // ═══════════════════════════════════════════════════
        var countSql = $@"
        SELECT COUNT(*)
        FROM FactorParent fp
        LEFT JOIN Hesab h ON CAST(h.Code_Tafzil AS DECIMAL(18,0)) = CAST(fp.CodeTafzil AS DECIMAL(18,0))
        {where}";

        var totalCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, commandTimeout: 120, cancellationToken: ct));

        // ═══════════════════════════════════════════════════
        //  کوئری اصلی
        // ═══════════════════════════════════════════════════
        var sql = $@"
        SELECT * FROM (
            SELECT 
                fp.ID AS Id,
                CAST(fp.NoFactor AS NVARCHAR(50)) AS FldFacNo,
                fp.Date_In AS FldFacDate,
                CAST(fp.Cost AS NVARCHAR(50)) AS FldSumKol,
                fp.CodeTafzil AS CustomerCode,
                h.Name AS FldCustName,
                CAST(ISNULL(fp.IsCaSh, 1) AS INT) AS IsCash,
                ROW_NUMBER() OVER (ORDER BY {sortCol}) AS RowNum
            FROM FactorParent fp
            LEFT JOIN Hesab h ON CAST(h.Code_Tafzil AS DECIMAL(18,0)) = CAST(fp.CodeTafzil AS DECIMAL(18,0))
            {where}
        ) AS T
        WHERE T.RowNum BETWEEN @startRow AND @endRow
        ORDER BY T.RowNum";

        var items = (await conn.QueryAsync<MoadianPendingListItemDto>(
            new CommandDefinition(sql, p, commandTimeout: 120, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new MoadianPendingListResultDto
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages
        };
    }

    public async Task<TaxFactorSource?> GetFactorSourceByIdAsync(long orgId, long fyId, long factorId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 1
                fp.ID AS Id,
                CAST(fp.NoFactor AS NVARCHAR(50)) AS FldFacNo,
                fp.Date_In AS FldFacDate,
                CAST(fp.Cost AS NVARCHAR(50)) AS FldSumKol,
                fp.CodeTafzil AS CustomerCode,
                h.Name AS FldCustName,
                CAST(ISNULL(fp.IsCaSh, 1) AS INT) AS IsCash
            FROM FactorParent fp
            LEFT JOIN Hesab h ON CAST(h.Code_Tafzil AS DECIMAL(18,0)) = CAST(fp.CodeTafzil AS DECIMAL(18,0))
            WHERE fp.ID = @factorId
              AND fp.ID NOT IN (SELECT factor_id FROM tax_header WHERE factor_id IS NOT NULL)";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<TaxFactorSource>(
            new CommandDefinition(sql, new { factorId }, cancellationToken: ct));
    }

    public async Task<List<TaxFactorRowSource>> GetFactorRowsAsync(long orgId, long fyId, long factorId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                fd.ArticleID AS StuffId,
                an.ArticleUnitID AS UnitId,
                fd.ArticleCount AS FldQty,
                CAST(fd.Cost AS BIGINT) AS FldPrice,
                CAST(fd.Discount AS BIGINT) AS Discount,
                CAST(fd.TaxFi AS BIGINT) AS FldVra,
                CAST(fd.Tax AS BIGINT) AS FldTaxAmount
            FROM FactorDetail fd
            LEFT JOIN ArticleNew an ON an.ID = fd.ArticleID
            WHERE fd.FactorID = @factorId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var list = await conn.QueryAsync<TaxFactorRowSource>(
            new CommandDefinition(sql, new { factorId }, cancellationToken: ct));
        return list.ToList();
    }

    public async Task<CustomerTaxInfo?> GetCustomerTaxInfoAsync(
    long orgId, long fyId, long customerCode, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT TOP 1
            CAST(h.Code_Tafzil AS BIGINT) AS CodeTafzil,
            h.Name                         AS Name,
            ISNULL(h.Kind, 1)              AS Kind,
            h.EconomicCode                 AS EconomicCode,
            h.MelliCode                    AS MelliCode,
            h.NationalCode                 AS NationalCode
        FROM Hesab h
        WHERE CAST(h.Code_Tafzil AS BIGINT) = @customerCode";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<CustomerTaxInfo>(
            new CommandDefinition(sql, new { customerCode }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════════
    //  جستجوی کالا (برای Picker)
    // ═══════════════════════════════════════════════════════════
    public async Task<List<ArticleSearchItem>> SearchArticlesAsync(long orgId, long fyId, string q, CancellationToken ct = default)
    {
        var where = string.IsNullOrWhiteSpace(q)
            ? "WHERE an.Status = 1"
            : @"WHERE an.Status = 1 AND (
                    an.Name LIKE @q 
                 OR CAST(an.tax_id AS NVARCHAR(50)) LIKE @q 
                 OR CAST(an.Code AS NVARCHAR(50)) LIKE @q
              )";

        var sql = $@"
            SELECT TOP 50
                an.ID                              AS Id,
                an.Name                            AS Name,
                CAST(an.tax_id AS NVARCHAR(50))    AS TaxId,
                an.ArticleUnitID                   AS UnitId,
                CAST(au.tax_id AS NVARCHAR(50))    AS UnitTaxId,
                au.Name                            AS UnitName,
                ISNULL(an.AmountSale, 0)           AS Fee,
                0                                  AS Vra
            FROM ArticleNew an
            LEFT JOIN ArticleUnit au ON au.ID = an.ArticleUnitID
            {where}
            ORDER BY an.ID DESC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var list = await conn.QueryAsync<ArticleSearchItem>(
            new CommandDefinition(sql, new { q = "%" + q + "%" }, cancellationToken: ct));
        return list.ToList();
    }
    // ═══════════════════════════════════════════════════════════
    //  ویرایش کامل هدر (پیش‌ارسال)
    // ═══════════════════════════════════════════════════════════
    public async Task UpdateFullAsync(long orgId, long fyId, long id, UpdateHeaderFullRequest req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();

        try
        {
            // ═══ تاریخ میلادی ═══
            var persianDate = string.IsNullOrWhiteSpace(req.IndatimPersian)
                ? DateTime.Now.ToString("yyyy/MM/dd")
                : req.IndatimPersian.Trim();
            var gregorianDate = PersianToGregorianStatic(persianDate);
            var unixMillis = new DateTimeOffset(gregorianDate).ToUnixTimeMilliseconds();

            // ═══ جمع‌ها ═══
            long tprdis = 0, tdis = 0, tadis = 0, tvam = 0, todam = 0;
            var bodyRows = new List<(long StuffId, long UnitId, double Am, long Fee, long Cfee, string Cut,
                long Exr, long Ssrv, long Sscv, long Prdis, long Dis, long Adis, long Vra, long Vam,
                long Bros, long Consfee, long Spro, long Tcpbs, long Cop, long Vop, string? Bsrn, long Tsstam)>();

            foreach (var it in req.Items)
            {
                if (it.Am <= 0) continue;
                var fee = it.Fee ?? 0;
                var linePrdis = (long)Math.Round(fee * (decimal)it.Am);
                var lineDis = it.Dis ?? 0;
                var lineAdis = linePrdis - lineDis;
                var lineVra = it.Vra ?? 0;

                // ⭐ اگه کاربر vam رو داده، از اون استفاده کن. وگرنه از vra محاسبه کن
                var lineVam = it.Vam.HasValue && it.Vam.Value > 0
                    ? it.Vam.Value
                    : (long)Math.Truncate((decimal)lineAdis * lineVra / 100m);

                var lineTsstam = lineAdis + lineVam;

                tprdis += linePrdis;
                tdis += lineDis;
                tadis += lineAdis;
                tvam += lineVam;

                bodyRows.Add((
                    it.StuffId, it.UnitId, it.Am, fee, it.Cfee ?? 0, it.Cut ?? "IRR",
                    it.Exr ?? 0, it.Ssrv ?? 0, it.Sscv ?? 0, linePrdis, lineDis, lineAdis,
                    lineVra, lineVam, it.Bros ?? 0, it.Consfee ?? 0, it.Spro ?? 0,
                    it.Tcpbs ?? 0, it.Cop ?? 0, it.Vop ?? 0, it.Bsrn, lineTsstam
                ));
            }

            var tbill = tadis + tvam;

            // ═══ UPDATE هدر ═══
            const string updateHeaderSql = @"
                UPDATE tax_header SET
                    inno = @Inno,
                    inty = @Inty,
                    inp = @Inp,
                    setm = @Setm,
                    indatim = @Indatim,
                    indatim_datetime = @IndatimDatetime,
                    indatim_persian = @IndatimPersian,
                    Indati2m_datetime = @Indati2mDatetime,
                    Indati2m_persian = @Indati2mPersian,
                    cdcn = @Cdcn,
                    cdcd = @Cdcd,
                    scc = @Scc,
                    scln = @Scln,
                    crn = @Crn,
                    bbc = @Bbc,
                    billid = @BillId,
                    sbc = @Sbc,
                    ft = @Ft,
                    tprdis = @Tprdis,
                    tdis = @Tdis,
                    tadis = @Tadis,
                    tvam = @Tvam,
                    todam = @Todam,
                    tbill = @Tbill,
                    tonw = @Tonw,
                    torv = @Torv,
                    tocv = @Tocv,
                    cap = @Cap,
                    insp = @Insp,
                    tvop = @Tvop
                WHERE id = @Id";

            await conn.ExecuteAsync(new CommandDefinition(updateHeaderSql, new
            {
                Id = id,
                Inno = req.Inno ?? "",
                req.Inty,
                req.Inp,
                req.Setm,
                Indatim = unixMillis,
                IndatimDatetime = gregorianDate,
                IndatimPersian = persianDate,
                Indati2mDatetime = gregorianDate,
                Indati2mPersian = req.Indati2mPersian ?? persianDate,
                req.Cdcn,
                req.Cdcd,
                req.Scc,
                req.Scln,
                req.Crn,
                req.Bbc,
                req.BillId,
                req.Sbc,
                req.Ft,
                Tprdis = tprdis,
                Tdis = tdis,
                Tadis = tadis,
                Tvam = tvam,
                Todam = todam,
                Tbill = tbill,
                Tonw = req.Tonw,
                Torv = req.Torv,
                Tocv = req.Tocv,
                req.Cap,
                req.Insp,
                req.Tvop
            }, transaction: tx, cancellationToken: ct));

            // ═══ DELETE ردیف‌های قبلی ═══
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM tax_body WHERE header_id = @id",
                new { id }, transaction: tx, cancellationToken: ct));

            // ═══ INSERT ردیف‌های جدید ═══
            const string insertBodySql = @"
                INSERT INTO tax_body (
                    cut, exr, ssrv, sscv, header_id, stuff_id, unit_id,
                    am, fee, cfee, dis, vam, vra, prdis, adis, odam, tsstam,
                    nw, odr, vop, cop, bsrn, spro, consfee, bros, tcpbs
                ) VALUES (
                    @Cut, @Exr, @Ssrv, @Sscv, @HeaderId, @StuffId, @UnitId,
                    @Am, @Fee, @Cfee, @Dis, @Vam, @Vra, @Prdis, @Adis, 0, @Tsstam,
                    NULL, 0, @Vop, @Cop, @Bsrn, @Spro, @Consfee, @Bros, @Tcpbs
                )";

            foreach (var b in bodyRows)
            {
                await conn.ExecuteAsync(new CommandDefinition(insertBodySql, new
                {
                    b.Cut,
                    b.Exr,
                    b.Ssrv,
                    b.Sscv,
                    HeaderId = id,
                    b.StuffId,
                    b.UnitId,
                    b.Am,
                    b.Fee,
                    b.Cfee,
                    b.Dis,
                    b.Vam,
                    b.Vra,
                    b.Prdis,
                    b.Adis,
                    b.Tsstam,
                    b.Vop,
                    b.Cop,
                    b.Bsrn,
                    b.Spro,
                    b.Consfee,
                    b.Bros,
                    b.Tcpbs
                }, transaction: tx, cancellationToken: ct));
            }

            tx.Commit();

            _logger.LogInformation("tax_header ویرایش شد: Id={Id}, tbill={Tbill}", id, tbill);
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // ═══ Persian → Gregorian (static helper) ═══
    private static DateTime PersianToGregorianStatic(string persianDate)
    {
        try
        {
            var parts = persianDate.Split('/');
            if (parts.Length != 3) return DateTime.Now;
            var y = int.Parse(parts[0]);
            var m = int.Parse(parts[1]);
            var d = int.Parse(parts[2]);
            var pc = new System.Globalization.PersianCalendar();
            return pc.ToDateTime(y, m, d, 0, 0, 0, 0);
        }
        catch
        {
            return DateTime.Now;
        }
    }
}