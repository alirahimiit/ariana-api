using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Cheque;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// Repository گزارش‌های تفصیلی چک (جلسه ۵۰)
///   • گزارش چک‌های برگشتی (ChequeOK=2)
///   • کاردکس چک (تاریخچه کامل)
/// </summary>
public class ChequeReportExtendedRepository : IChequeReportExtendedRepository
{
    private readonly ITenantConnectionFactory _factory;

    public ChequeReportExtendedRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    // ═══════════════════════════════════════════════════════════════
    //  گزارش چک‌های برگشتی — لیست
    // ═══════════════════════════════════════════════════════════════
    public async Task<ReturnedChequeListResultDto> GetReturnedListAsync(
        long orgId, long fyId,
        ReturnedChequeFilterDto filter,
        CancellationToken ct = default)
    {
        // ─── تعیین اینکه کدام نوع‌ها در UNION شرکت کنند ───
        var includePay = !filter.ChequeType.HasValue || filter.ChequeType.Value == 0;
        var includeReceive = !filter.ChequeType.HasValue || filter.ChequeType.Value == 1;

        var parts = new List<string>();
        var p = new DynamicParameters();

        // ─── Pay ───
        if (includePay)
        {
            var wherePay = BuildPayWhere(filter, p, "_p");
            parts.Add($@"
                SELECT
                    0 AS ChequeType,
                    CP.ID AS Id,
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
                    ISNULL(CP.OkDate, '')      AS OkDate,
                    ISNULL(CP.UnOkDate, '')    AS ReturnDate,
                    ISNULL(CP.Code_Col, 0)     AS CodeCol,
                    ISNULL(CP.Code_Moein, 0)   AS CodeMoein,
                    ISNULL(CP.Code_Tafzil, 0)  AS CodeTafzil,
                    ISNULL(H1.Name, '') AS ColName,
                    ISNULL(H2.Name, '') AS MoeinName,
                    ISNULL(H3.Name, '') AS TafzilName,
                    ISNULL(CP.ParentSanadID, 0)      AS ParentSanadId,
                    ISNULL(PS.NO_Sanad, 0)           AS NoSanad,
                    ISNULL(PS.Vazeit, -1)            AS SanadVazeit,
                    ISNULL(CP.UnOkParentSanadID, 0)  AS ReturnParentSanadId,
                    ISNULL(PRS.NO_Sanad, 0)          AS ReturnNoSanad
                FROM CheckPay CP
                LEFT JOIN BankAcc A   ON A.ID = CP.BankAccID
                LEFT JOIN Bank B      ON B.ID = A.BankID
                LEFT JOIN ParentSanad PS  ON PS.ParentSanadID  = CP.ParentSanadID
                LEFT JOIN ParentSanad PRS ON PRS.ParentSanadID = CP.UnOkParentSanadID
                LEFT JOIN Hesab H1 ON CP.Code_Col > 0
                    AND H1.Code_Col = CP.Code_Col
                    AND ISNULL(H1.Code_Moein, 0) = 0
                    AND ISNULL(H1.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H2 ON CP.Code_Col > 0 AND CP.Code_Moein > 0
                    AND H2.Code_Col = CP.Code_Col
                    AND H2.Code_Moein = CP.Code_Moein
                    AND ISNULL(H2.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H3 ON CP.Code_Tafzil > 0
                    AND H3.Code_Col = -1
                    AND ISNULL(H3.Code_Moein, 0) = 0
                    AND H3.Code_Tafzil = CP.Code_Tafzil
                {wherePay}");
        }

        // ─── Receive ───
        if (includeReceive)
        {
            var whereRecv = BuildReceiveWhere(filter, p, "_r");
            parts.Add($@"
                SELECT
                    1 AS ChequeType,
                    CR.ID AS Id,
                    ISNULL(B.Name, '') AS BankName,
                    ISNULL(CR.BankBrunch, '') AS BankShobe,
                    ISNULL(CR.NoHesabCheck, '') AS BankNoHesab,
                    ISNULL(CR.CheckSeries, '') AS CheckSeries,
                    ISNULL(CR.CheckMab, 0)     AS CheckMab,
                    ISNULL(CR.CheckDate, '')   AS CheckDate,
                    ISNULL(CR.CheckPerson, '') AS CheckPerson,
                    ISNULL(CR.ResidNumber, 0)  AS ResidNumber,
                    ISNULL(CR.ResidDate, '')   AS ResidDate,
                    ISNULL(CR.ResidDes, '')    AS ResidDes,
                    ISNULL(CR.OkDate, '')      AS OkDate,
                    ISNULL(CR.UnOkDate, '')    AS ReturnDate,
                    ISNULL(CR.Code_Col, 0)     AS CodeCol,
                    ISNULL(CR.Code_Moein, 0)   AS CodeMoein,
                    ISNULL(CR.Code_Tafzil, 0)  AS CodeTafzil,
                    ISNULL(H1.Name, '') AS ColName,
                    ISNULL(H2.Name, '') AS MoeinName,
                    ISNULL(H3.Name, '') AS TafzilName,
                    ISNULL(CR.ParentSanadID, 0)      AS ParentSanadId,
                    ISNULL(PS.NO_Sanad, 0)           AS NoSanad,
                    ISNULL(PS.Vazeit, -1)            AS SanadVazeit,
                    ISNULL(CR.UnOkParentSanadID, 0)  AS ReturnParentSanadId,
                    ISNULL(PRS.NO_Sanad, 0)          AS ReturnNoSanad
                FROM CheckRecive CR
                LEFT JOIN Bank B ON B.ID = CR.BankID
                LEFT JOIN ParentSanad PS  ON PS.ParentSanadID  = CR.ParentSanadID
                LEFT JOIN ParentSanad PRS ON PRS.ParentSanadID = CR.UnOkParentSanadID
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
                {whereRecv}");
        }

        if (parts.Count == 0)
        {
            return new ReturnedChequeListResultDto
            {
                Items = new(),
                TotalCount = 0,
                Page = filter.Page,
                PageSize = filter.PageSize
            };
        }

        var unionSql = string.Join(" UNION ALL ", parts);

        // ─── Sort ───
        var orderBy = "ReturnDate DESC, ResidNumber DESC, Id DESC";
        if (!string.IsNullOrWhiteSpace(filter.SortBy))
        {
            var dir = string.Equals(filter.SortDir, "asc", StringComparison.OrdinalIgnoreCase)
                ? "ASC" : "DESC";
            var allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["residNumber"] = "ResidNumber",
                ["residDate"] = "ResidDate",
                ["checkDate"] = "CheckDate",
                ["checkSeries"] = "CheckSeries",
                ["checkMab"] = "CheckMab",
                ["checkPerson"] = "CheckPerson",
                ["bankName"] = "BankName",
                ["okDate"] = "OkDate",
                ["returnDate"] = "ReturnDate"
            };
            if (allowed.TryGetValue(filter.SortBy, out var col))
                orderBy = $"{col} {dir}";
        }

        if (filter.Page < 1) filter.Page = 1;
        if (filter.PageSize < 1 || filter.PageSize > 1000) filter.PageSize = 100;
        var offset = (filter.Page - 1) * filter.PageSize;
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + filter.PageSize);

        var countSql = $@"SELECT COUNT(*) FROM ({unionSql}) AS U";

        var dataSql = $@"
            SELECT * FROM (
                SELECT U.*,
                       ROW_NUMBER() OVER (ORDER BY {orderBy}) AS RowNum
                FROM ({unionSql}) AS U
            ) T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        var rawItems = (await conn.QueryAsync<dynamic>(
            new CommandDefinition(dataSql, p, cancellationToken: ct))).ToList();

        var items = new List<ReturnedChequeListDto>(rawItems.Count);
        foreach (var r in rawItems)
        {
            var it = new ReturnedChequeListDto
            {
                ChequeType = (int)(decimal)r.ChequeType,
                Id = (long)(decimal)r.Id,
                BankName = (string?)r.BankName ?? "",
                BankShobe = (string?)r.BankShobe ?? "",
                BankNoHesab = (string?)r.BankNoHesab ?? "",
                CheckSeries = (string?)r.CheckSeries ?? "",
                CheckMab = (decimal?)r.CheckMab ?? 0m,
                CheckDate = (string?)r.CheckDate ?? "",
                CheckPerson = (string?)r.CheckPerson ?? "",
                ResidNumber = (int)(decimal)r.ResidNumber,
                ResidDate = (string?)r.ResidDate ?? "",
                ResidDes = (string?)r.ResidDes ?? "",
                OkDate = (string?)r.OkDate ?? "",
                ReturnDate = (string?)r.ReturnDate ?? "",
                CodeCol = (int)(decimal)r.CodeCol,
                CodeMoein = (int)(decimal)r.CodeMoein,
                CodeTafzil = (int)(decimal)r.CodeTafzil,
                ColName = (string?)r.ColName ?? "",
                MoeinName = (string?)r.MoeinName ?? "",
                TafzilName = (string?)r.TafzilName ?? "",
                ParentSanadId = (long)(decimal)r.ParentSanadId,
                NoSanad = (int)(decimal)r.NoSanad,
                SanadVazeit = (int)(decimal)r.SanadVazeit,
                ReturnParentSanadId = (long)(decimal)r.ReturnParentSanadId,
                ReturnNoSanad = (int)(decimal)r.ReturnNoSanad
            };
            it.ChequeTypeLabel = it.ChequeType == 0 ? "پرداختی" : "دریافتی";

            var parts2 = new List<string>();
            if (!string.IsNullOrEmpty(it.TafzilName)) parts2.Add(it.TafzilName);
            if (!string.IsNullOrEmpty(it.MoeinName)) parts2.Add(it.MoeinName);
            if (!string.IsNullOrEmpty(it.ColName)) parts2.Add(it.ColName);
            it.HesabName = parts2.Count > 0 ? string.Join(" - ", parts2) : "";

            items.Add(it);
        }

        return new ReturnedChequeListResultDto
        {
            Items = items,
            TotalCount = total,
            Page = filter.Page,
            PageSize = filter.PageSize
        };
    }

    // ═══════════════════════════════════════════════════════════════
    //  WHERE سازنده‌ها برای هر نوع
    // ═══════════════════════════════════════════════════════════════
    private static string BuildPayWhere(ReturnedChequeFilterDto f, DynamicParameters p, string sfx)
    {
        var w = new StringBuilder(" WHERE ISNULL(CP.ChequeOK, 0) = 2 ");

        if (!string.IsNullOrWhiteSpace(f.FromDate))
        { w.Append(" AND CP.ResidDate >= @fromDate "); p.Add("fromDate" + sfx, f.FromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(f.ToDate))
        { w.Append(" AND CP.ResidDate <= @toDate "); p.Add("toDate" + sfx, f.ToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(f.CheckFromDate))
        { w.Append(" AND CP.CheckDate >= @checkFromDate "); p.Add("checkFromDate" + sfx, f.CheckFromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(f.CheckToDate))
        { w.Append(" AND CP.CheckDate <= @checkToDate "); p.Add("checkToDate" + sfx, f.CheckToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(f.ReturnFromDate))
        { w.Append(" AND CP.UnOkDate >= @returnFromDate "); p.Add("returnFromDate" + sfx, f.ReturnFromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(f.ReturnToDate))
        { w.Append(" AND CP.UnOkDate <= @returnToDate "); p.Add("returnToDate" + sfx, f.ReturnToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(f.CheckFromSerial))
        { w.Append(" AND CP.CheckSeries >= @checkFromSerial "); p.Add("checkFromSerial" + sfx, f.CheckFromSerial.Trim()); }
        if (!string.IsNullOrWhiteSpace(f.CheckToSerial))
        { w.Append(" AND CP.CheckSeries <= @checkToSerial "); p.Add("checkToSerial" + sfx, f.CheckToSerial.Trim()); }

        if (f.FromNumber.HasValue)
        { w.Append(" AND CP.ResidNumber >= @fromNumber "); p.Add("fromNumber" + sfx, f.FromNumber.Value); }
        if (f.ToNumber.HasValue)
        { w.Append(" AND CP.ResidNumber <= @toNumber "); p.Add("toNumber" + sfx, f.ToNumber.Value); }

        if (!string.IsNullOrWhiteSpace(f.Descript))
        { w.Append(" AND CP.ResidDes LIKE @descript "); p.Add("descript" + sfx, "%" + f.Descript.Trim() + "%"); }

        if (f.BankAccId is > 0)
        { w.Append(" AND CP.BankAccID = @bankAccId "); p.Add("bankAccId" + sfx, f.BankAccId.Value); }

        if (f.CodeCol is > 0)
        { w.Append(" AND CP.Code_Col = @codeCol "); p.Add("codeCol" + sfx, f.CodeCol.Value); }
        if (f.CodeMoein is > 0)
        { w.Append(" AND CP.Code_Moein = @codeMoein "); p.Add("codeMoein" + sfx, f.CodeMoein.Value); }
        if (f.CodeTafzil is > 0)
        { w.Append(" AND CP.Code_Tafzil = @codeTafzil "); p.Add("codeTafzil" + sfx, f.CodeTafzil.Value); }

        return w.ToString();
    }

    private static string BuildReceiveWhere(ReturnedChequeFilterDto f, DynamicParameters p, string sfx)
    {
        var w = new StringBuilder(" WHERE ISNULL(CR.ChequeOK, 0) = 2 ");

        if (!string.IsNullOrWhiteSpace(f.FromDate))
        { w.Append(" AND CR.ResidDate >= @fromDate "); p.Add("fromDate" + sfx, f.FromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(f.ToDate))
        { w.Append(" AND CR.ResidDate <= @toDate "); p.Add("toDate" + sfx, f.ToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(f.CheckFromDate))
        { w.Append(" AND CR.CheckDate >= @checkFromDate "); p.Add("checkFromDate" + sfx, f.CheckFromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(f.CheckToDate))
        { w.Append(" AND CR.CheckDate <= @checkToDate "); p.Add("checkToDate" + sfx, f.CheckToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(f.ReturnFromDate))
        { w.Append(" AND CR.UnOkDate >= @returnFromDate "); p.Add("returnFromDate" + sfx, f.ReturnFromDate.Trim()); }
        if (!string.IsNullOrWhiteSpace(f.ReturnToDate))
        { w.Append(" AND CR.UnOkDate <= @returnToDate "); p.Add("returnToDate" + sfx, f.ReturnToDate.Trim()); }

        if (!string.IsNullOrWhiteSpace(f.CheckFromSerial))
        { w.Append(" AND CR.CheckSeries >= @checkFromSerial "); p.Add("checkFromSerial" + sfx, f.CheckFromSerial.Trim()); }
        if (!string.IsNullOrWhiteSpace(f.CheckToSerial))
        { w.Append(" AND CR.CheckSeries <= @checkToSerial "); p.Add("checkToSerial" + sfx, f.CheckToSerial.Trim()); }

        if (f.FromNumber.HasValue)
        { w.Append(" AND CR.ResidNumber >= @fromNumber "); p.Add("fromNumber" + sfx, f.FromNumber.Value); }
        if (f.ToNumber.HasValue)
        { w.Append(" AND CR.ResidNumber <= @toNumber "); p.Add("toNumber" + sfx, f.ToNumber.Value); }

        if (!string.IsNullOrWhiteSpace(f.Descript))
        { w.Append(" AND CR.ResidDes LIKE @descript "); p.Add("descript" + sfx, "%" + f.Descript.Trim() + "%"); }

        if (f.BankId is > 0)
        { w.Append(" AND CR.BankID = @bankId "); p.Add("bankId" + sfx, f.BankId.Value); }

        if (f.CodeCol is > 0)
        { w.Append(" AND CR.Code_Col = @codeCol "); p.Add("codeCol" + sfx, f.CodeCol.Value); }
        if (f.CodeMoein is > 0)
        { w.Append(" AND CR.Code_Moein = @codeMoein "); p.Add("codeMoein" + sfx, f.CodeMoein.Value); }
        if (f.CodeTafzil is > 0)
        { w.Append(" AND CR.Code_Tafzil = @codeTafzil "); p.Add("codeTafzil" + sfx, f.CodeTafzil.Value); }

        return w.ToString();
    }

    // ═══════════════════════════════════════════════════════════════
    //  گزارش چک‌های برگشتی — خلاصه
    // ═══════════════════════════════════════════════════════════════
    public async Task<ReturnedChequeSummaryDto> GetReturnedSummaryAsync(
        long orgId, long fyId,
        ReturnedChequeFilterDto filter,
        CancellationToken ct = default)
    {
        var includePay = !filter.ChequeType.HasValue || filter.ChequeType.Value == 0;
        var includeReceive = !filter.ChequeType.HasValue || filter.ChequeType.Value == 1;

        var parts = new List<string>();
        var p = new DynamicParameters();

        if (includePay)
        {
            var wherePay = BuildPayWhere(filter, p, "_p");
            parts.Add($@"
                SELECT
                    0 AS ChequeType,
                    ISNULL(B.Name, '') AS BankName,
                    ISNULL(CP.CheckMab, 0) AS Amount
                FROM CheckPay CP
                LEFT JOIN BankAcc A ON A.ID = CP.BankAccID
                LEFT JOIN Bank B ON B.ID = A.BankID
                {wherePay}");
        }

        if (includeReceive)
        {
            var whereRecv = BuildReceiveWhere(filter, p, "_r");
            parts.Add($@"
                SELECT
                    1 AS ChequeType,
                    ISNULL(B.Name, '') AS BankName,
                    ISNULL(CR.CheckMab, 0) AS Amount
                FROM CheckRecive CR
                LEFT JOIN Bank B ON B.ID = CR.BankID
                {whereRecv}");
        }

        var result = new ReturnedChequeSummaryDto();

        if (parts.Count == 0) return result;

        var unionSql = string.Join(" UNION ALL ", parts);

        var sql = $@"
            SELECT
                ChequeType,
                ISNULL(BankName, '') AS BankName,
                COUNT(*) AS [Count],
                ISNULL(SUM(Amount), 0) AS Amount
            FROM ({unionSql}) AS U
            GROUP BY ChequeType, BankName
            ORDER BY ChequeType, Amount DESC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var rows = (await conn.QueryAsync<dynamic>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        // ─── گروه‌بندی بانک (Pay+Receive ادغام) ───
        var bankAgg = new Dictionary<string, ReturnedChequeBankGroupDto>(StringComparer.OrdinalIgnoreCase);

        foreach (var r in rows)
        {
            var type = (int)(decimal)r.ChequeType;
            var cnt = (int)(decimal)r.Count;
            var amt = (decimal)r.Amount;
            var bank = (string?)r.BankName ?? "";

            if (type == 0) { result.PayCount += cnt; result.PayAmount += amt; }
            else { result.ReceiveCount += cnt; result.ReceiveAmount += amt; }

            result.TotalCount += cnt;
            result.TotalAmount += amt;

            var key = string.IsNullOrEmpty(bank) ? "(بدون بانک)" : bank;
            if (!bankAgg.TryGetValue(key, out var g))
            {
                g = new ReturnedChequeBankGroupDto { BankName = key };
                bankAgg[key] = g;
            }
            g.Count += cnt;
            g.Amount += amt;
        }

        result.ByBank = bankAgg.Values
            .OrderByDescending(x => x.Amount)
            .ToList();

        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  کاردکس چک
    // ═══════════════════════════════════════════════════════════════
    public async Task<ChequeKardexDto?> GetKardexAsync(
        long orgId, long fyId,
        ChequeKardexRequestDto dto,
        CancellationToken ct = default)
    {
        if (dto.ChequeId <= 0) return null;
        if (dto.ChequeType != 0 && dto.ChequeType != 1) return null;

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        ChequeKardexDto? result = null;
        long createSanadId = 0, okSanadId = 0, returnSanadId = 0, expendSanadId = 0;

        if (dto.ChequeType == 0)  // Pay
        {
            const string sql = @"
                SELECT
                    CP.ID AS Id,
                    ISNULL(CP.CheckSeries, '') AS CheckSeries,
                    ISNULL(CP.CheckMab, 0)     AS CheckMab,
                    ISNULL(CP.CheckDate, '')   AS CheckDate,
                    ISNULL(CP.CheckPerson, '') AS CheckPerson,
                    ISNULL(B.Name, '')  AS BankName,
                    ISNULL(A.Shobe, '') AS BankShobe,
                    ISNULL(A.NoHesab, '') AS BankNoHesab,
                    ISNULL(CP.ChequeOK, 0) AS ChequeOK,
                    ISNULL(CP.ResidNumber, 0) AS ResidNumber,
                    ISNULL(CP.ResidDate, '')  AS ResidDate,
                    ISNULL(CP.ResidDes, '')   AS ResidDes,
                    ISNULL(CP.Code_Col, 0)    AS CodeCol,
                    ISNULL(CP.Code_Moein, 0)  AS CodeMoein,
                    ISNULL(CP.Code_Tafzil, 0) AS CodeTafzil,
                    ISNULL(H1.Name, '') AS ColName,
                    ISNULL(H2.Name, '') AS MoeinName,
                    ISNULL(H3.Name, '') AS TafzilName,
                    ISNULL(CP.ParentSanadID, 0)      AS CreateSanadId,
                    ISNULL(CP.ParentSanadOKID, 0)    AS OkSanadId,
                    ISNULL(CP.UnOkParentSanadID, 0)  AS ReturnSanadId
                FROM CheckPay CP
                LEFT JOIN BankAcc A ON A.ID = CP.BankAccID
                LEFT JOIN Bank B ON B.ID = A.BankID
                LEFT JOIN Hesab H1 ON CP.Code_Col > 0
                    AND H1.Code_Col = CP.Code_Col
                    AND ISNULL(H1.Code_Moein, 0) = 0
                    AND ISNULL(H1.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H2 ON CP.Code_Col > 0 AND CP.Code_Moein > 0
                    AND H2.Code_Col = CP.Code_Col
                    AND H2.Code_Moein = CP.Code_Moein
                    AND ISNULL(H2.Code_Tafzil, 0) = 0
                LEFT JOIN Hesab H3 ON CP.Code_Tafzil > 0
                    AND H3.Code_Col = -1
                    AND ISNULL(H3.Code_Moein, 0) = 0
                    AND H3.Code_Tafzil = CP.Code_Tafzil
                WHERE CP.ID = @id";

            var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(sql, new { id = dto.ChequeId }, cancellationToken: ct));
            if (row == null) return null;

            result = MapHeader(row, dto.ChequeType);
            createSanadId = (long)(decimal)(row.CreateSanadId ?? 0);
            okSanadId = (long)(decimal)(row.OkSanadId ?? 0);
            returnSanadId = (long)(decimal)(row.ReturnSanadId ?? 0);
        }
        else  // Receive
        {
            const string sql = @"
                SELECT
                    CR.ID AS Id,
                    ISNULL(CR.CheckSeries, '') AS CheckSeries,
                    ISNULL(CR.CheckMab, 0)     AS CheckMab,
                    ISNULL(CR.CheckDate, '')   AS CheckDate,
                    ISNULL(CR.CheckPerson, '') AS CheckPerson,
                    ISNULL(B.Name, '')  AS BankName,
                    ISNULL(CR.BankBrunch, '')  AS BankShobe,
                    ISNULL(CR.NoHesabCheck, '') AS BankNoHesab,
                    ISNULL(CR.ChequeOK, 0) AS ChequeOK,
                    ISNULL(CR.WasExpended, 0) AS WasExpended,
                    ISNULL(CR.ResidNumber, 0) AS ResidNumber,
                    ISNULL(CR.ResidDate, '')  AS ResidDate,
                    ISNULL(CR.ResidDes, '')   AS ResidDes,
                    ISNULL(CR.Code_Col, 0)    AS CodeCol,
                    ISNULL(CR.Code_Moein, 0)  AS CodeMoein,
                    ISNULL(CR.Code_Tafzil, 0) AS CodeTafzil,
                    ISNULL(H1.Name, '') AS ColName,
                    ISNULL(H2.Name, '') AS MoeinName,
                    ISNULL(H3.Name, '') AS TafzilName,
                    ISNULL(CR.ParentSanadID, 0)      AS CreateSanadId,
                    ISNULL(CR.ParentSanadOKID, 0)    AS OkSanadId,
                    ISNULL(CR.UnOkParentSanadID, 0)  AS ReturnSanadId
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
                WHERE CR.ID = @id";

            var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(sql, new { id = dto.ChequeId }, cancellationToken: ct));
            if (row == null) return null;

            result = MapHeader(row, dto.ChequeType);
            createSanadId = (long)(decimal)(row.CreateSanadId ?? 0);
            okSanadId = (long)(decimal)(row.OkSanadId ?? 0);
            returnSanadId = (long)(decimal)(row.ReturnSanadId ?? 0);

            // ─── خرج چک (اگر وجود دارد) ───
            var expendRow = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(
                    "SELECT TOP 1 ISNULL(ParentSanadID, 0) AS Pid FROM CheckExpend WHERE CheuqeReceiveID = @cid ORDER BY ID DESC",
                    new { cid = dto.ChequeId }, cancellationToken: ct));
            if (expendRow != null)
                expendSanadId = (long)(decimal)(expendRow.Pid ?? 0);
        }

        // ─── جمع‌آوری parentSanadIds مرتبط ───
        var eventMap = new Dictionary<long, (string type, string label, string icon)>();
        if (createSanadId > 0) eventMap[createSanadId] = ("create", "صدور", "📝");
        if (okSanadId > 0 && !eventMap.ContainsKey(okSanadId)) eventMap[okSanadId] = ("ok", "وصول", "✅");
        if (returnSanadId > 0 && !eventMap.ContainsKey(returnSanadId)) eventMap[returnSanadId] = ("return", "برگشت", "↩️");
        if (expendSanadId > 0 && !eventMap.ContainsKey(expendSanadId)) eventMap[expendSanadId] = ("expend", "خرج چک", "💸");

        if (eventMap.Count == 0)
        {
            result.Events = new List<KardexEventDto>();
            return result;
        }

        var sanadIds = eventMap.Keys.ToArray();

        // ─── ParentSanad info ───
        const string parentSql = @"
            SELECT ParentSanadID, NO_Sanad, Date_IN, OtherParentSharh, Vazeit
            FROM ParentSanad
            WHERE ParentSanadID IN @ids";

        var parentRows = (await conn.QueryAsync<dynamic>(
            new CommandDefinition(parentSql, new { ids = sanadIds }, cancellationToken: ct))).ToList();

        var parentDict = parentRows.ToDictionary(
            r => (long)(decimal)r.ParentSanadID,
            r => r);

        // ─── ردیف‌های Sanad ───
        const string rowsSql = @"
            SELECT
                S.SanadID,
                S.ParentSanadCode,
                S.RowNum,
                S.Code_Col,
                S.Code_Moein,
                S.Code_Tafzil,
                S.OtherSharh,
                ISNULL(S.Mab_Bed, 0) AS MabBed,
                ISNULL(S.Mab_Bes, 0) AS MabBes,
                ISNULL(H1.Name, '') AS ColName,
                ISNULL(H2.Name, '') AS MoeinName,
                ISNULL(H3.Name, '') AS TafzilName
            FROM Sanad S
            LEFT JOIN Hesab H1 ON S.Code_Col > 0
                AND H1.Code_Col = S.Code_Col
                AND ISNULL(H1.Code_Moein, 0) = 0
                AND ISNULL(H1.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H2 ON S.Code_Col > 0 AND S.Code_Moein > 0
                AND H2.Code_Col = S.Code_Col
                AND H2.Code_Moein = S.Code_Moein
                AND ISNULL(H2.Code_Tafzil, 0) = 0
            LEFT JOIN Hesab H3 ON S.Code_Tafzil > 0
                AND H3.Code_Col = -1
                AND ISNULL(H3.Code_Moein, 0) = 0
                AND H3.Code_Tafzil = S.Code_Tafzil
            WHERE S.ParentSanadCode IN @ids
            ORDER BY S.ParentSanadCode, S.RowNum";

        var rowRows = (await conn.QueryAsync<dynamic>(
            new CommandDefinition(rowsSql, new { ids = sanadIds }, cancellationToken: ct))).ToList();

        // ─── گروه‌بندی بر اساس ParentSanadCode ───
        var groupedRows = rowRows
            .GroupBy(r => (long)(decimal)r.ParentSanadCode)
            .ToDictionary(g => g.Key, g => g.ToList());

        // ─── ساخت Events به ترتیب ایجاد (Order by ParentSanadID) ───
        var events = new List<KardexEventDto>();
        foreach (var pid in sanadIds.OrderBy(x => x))
        {
            if (!eventMap.TryGetValue(pid, out var meta)) continue;

            var pInfo = parentDict.TryGetValue(pid, out var pr) ? pr : null;
            var ev = new KardexEventDto
            {
                EventType = meta.type,
                EventLabel = meta.label,
                EventIcon = meta.icon,
                ParentSanadId = pid,
                NoSanad = pInfo != null ? (int)(decimal)pInfo.NO_Sanad : 0,
                EventDate = pInfo != null ? (string?)pInfo.Date_IN ?? "" : "",
                EventSharh = pInfo != null ? (string?)pInfo.OtherParentSharh ?? "" : "",
                SanadVazeit = pInfo != null ? (int)(decimal)pInfo.Vazeit : -1,
                Rows = new List<KardexRowDto>()
            };

            if (groupedRows.TryGetValue(pid, out var rowsForPid))
            {
                foreach (var r in rowsForPid)
                {
                    var kr = new KardexRowDto
                    {
                        RowNum = (int)(decimal)r.RowNum,
                        CodeCol = (int)(decimal)r.Code_Col,
                        CodeMoein = (int)(decimal)r.Code_Moein,
                        CodeTafzil = (int)(decimal)r.Code_Tafzil,
                        ColName = (string?)r.ColName ?? "",
                        MoeinName = (string?)r.MoeinName ?? "",
                        TafzilName = (string?)r.TafzilName ?? "",
                        Sharh = (string?)r.OtherSharh ?? "",
                        MabBed = (decimal?)r.MabBed ?? 0m,
                        MabBes = (decimal?)r.MabBes ?? 0m
                    };
                    var parts = new List<string>();
                    if (!string.IsNullOrEmpty(kr.TafzilName)) parts.Add(kr.TafzilName);
                    if (!string.IsNullOrEmpty(kr.MoeinName)) parts.Add(kr.MoeinName);
                    if (!string.IsNullOrEmpty(kr.ColName)) parts.Add(kr.ColName);
                    kr.HesabName = parts.Count > 0 ? string.Join(" - ", parts) : "";

                    ev.TotalBed += kr.MabBed;
                    ev.TotalBes += kr.MabBes;
                    ev.Rows.Add(kr);
                }
            }

            events.Add(ev);
        }

        result.Events = events;
        return result;
    }

    private static ChequeKardexDto MapHeader(dynamic row, int chequeType)
    {
        var dto = new ChequeKardexDto
        {
            ChequeType = chequeType,
            ChequeId = (long)(decimal)row.Id,
            CheckSeries = (string?)row.CheckSeries ?? "",
            CheckMab = (decimal?)row.CheckMab ?? 0m,
            CheckDate = (string?)row.CheckDate ?? "",
            CheckPerson = (string?)row.CheckPerson ?? "",
            BankName = (string?)row.BankName ?? "",
            BankShobe = (string?)row.BankShobe ?? "",
            BankNoHesab = (string?)row.BankNoHesab ?? "",
            CurrentStatus = (int)(decimal)row.ChequeOK,
            ResidNumber = (int)(decimal)row.ResidNumber,
            ResidDate = (string?)row.ResidDate ?? "",
            ResidDes = (string?)row.ResidDes ?? "",
            CodeCol = (int)(decimal)row.CodeCol,
            CodeMoein = (int)(decimal)row.CodeMoein,
            CodeTafzil = (int)(decimal)row.CodeTafzil,
            ColName = (string?)row.ColName ?? "",
            MoeinName = (string?)row.MoeinName ?? "",
            TafzilName = (string?)row.TafzilName ?? ""
        };

        dto.CurrentStatusLabel = dto.CurrentStatus switch
        {
            0 => "در جریان",
            1 => "وصول‌شده",
            2 => "برگشتی",
            _ => "نامعلوم"
        };

        // WasExpended فقط برای Receive وجود دارد
        if (chequeType == 1 && ((IDictionary<string, object>)row).ContainsKey("WasExpended"))
            dto.WasExpended = (int)(decimal)(row.WasExpended ?? 0);

        var parts = new List<string>();
        if (!string.IsNullOrEmpty(dto.TafzilName)) parts.Add(dto.TafzilName);
        if (!string.IsNullOrEmpty(dto.MoeinName)) parts.Add(dto.MoeinName);
        if (!string.IsNullOrEmpty(dto.ColName)) parts.Add(dto.ColName);
        dto.HesabName = parts.Count > 0 ? string.Join(" - ", parts) : "";

        return dto;
    }
}