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

    public async Task<long> AddHeaderAsync(long orgId, long fyId, TaxHeader h, CancellationToken ct = default)
    {
        const string sql = @"
            INSERT INTO tax_header (
                bbc, cdcd, cdcn, scc, crn, factor_id,
                tvop, cap, insp, inno, CustomerCode,
                inty, inp, ins, setm, status,
                tonw, tprdis, tdis, tadis, tvam, todam, tbill,
                indatim_datetime, Indati2m_datetime, indatim, Indati2m,
                indatim_persian, Indati2m_persian, irtaxid
            ) VALUES (
                @Bbc, @Cdcd, @Cdcn, @Scc, @Crn, @FactorId,
                @Tvop, @Cap, @Insp, @Inno, @CustomerCode,
                @Inty, @Inp, @Ins, @Setm, @Status,
                @Tonw, @Tprdis, @Tdis, @Tadis, @Tvam, @Todam, @Tbill,
                @IndatimDatetime, @Indati2mDatetime, @Indatim, @Indati2m,
                @IndatimPersian, @Indati2mPersian, @IrTaxId
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
            IrTaxId = h.IrTaxId ?? ""
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
                indatim_datetime = @IndatimDatetime,
                Indati2m_datetime = @Indati2mDatetime,
                indatim = @Indatim, Indati2m = @Indati2m,
                indatim_persian = @IndatimPersian,
                Indati2m_persian = @Indati2mPersian,
                ref_number = @RefNumber, uid = @Uid, taxid = @TaxId
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
}