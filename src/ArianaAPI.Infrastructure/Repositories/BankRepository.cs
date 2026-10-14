using ArianaAPI.Application.DTOs.Bank;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using System.Data;
using System.Globalization;

namespace ArianaAPI.Infrastructure.Repositories;

public class BankRepository : IBankRepository
{
    private readonly ITenantConnectionFactory _factory;

    public BankRepository(ITenantConnectionFactory factory)
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

    // ═══════════════════════════════════════════════════════
    //  Bank — لیست
    // ═══════════════════════════════════════════════════════
    public async Task<List<BankListDto>> GetBanksAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                ID   AS Id,
                Name AS Name,
                Code AS Code
            FROM Bank
            ORDER BY Name";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var items = await conn.QueryAsync<BankListDto>(
            new CommandDefinition(sql, cancellationToken: ct));
        return items.ToList();
    }

    // ═══════════════════════════════════════════════════════
    //  Bank — درج
    // ═══════════════════════════════════════════════════════
    public async Task<BankWriteResultDto> CreateBankAsync(
        long orgId, long fyId, BankWriteDto dto, long userCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام بانک الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // چک تکراری
            var dup = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Bank WHERE Name = @name",
                    new { name = dto.Name.Trim() },
                    transaction: tx, cancellationToken: ct));

            if (dup > 0)
                throw new InvalidOperationException($"بانک «{dto.Name}» قبلاً ثبت شده است");

            const string sql = @"
                INSERT INTO Bank (Name, Code, Code_OP, Date_OP, Time_OP)
                OUTPUT INSERTED.ID
                VALUES (@name, @code, @userCode, @dateOp, @timeOp)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(sql, new
                {
                    name = dto.Name.Trim(),
                    code = (object?)dto.Code?.Trim() ?? "",
                    userCode = userCode.ToString(),
                    dateOp = GetTodayPersian(),
                    timeOp = GetCurrentTime()
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();

            return new BankWriteResultDto
            {
                Id = newId,
                Name = dto.Name.Trim()
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  Bank — ویرایش
    // ═══════════════════════════════════════════════════════
    public async Task UpdateBankAsync(
        long orgId, long fyId, long id, BankWriteDto dto, long userCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام بانک الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var exists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Bank WHERE ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (exists == 0)
                throw new InvalidOperationException("بانک یافت نشد");

            var dup = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Bank WHERE Name = @name AND ID <> @id",
                    new { name = dto.Name.Trim(), id },
                    transaction: tx, cancellationToken: ct));

            if (dup > 0)
                throw new InvalidOperationException($"بانک دیگری با نام «{dto.Name}» وجود دارد");

            const string sql = @"
                UPDATE Bank SET
                    Name    = @name,
                    Code    = @code,
                    Code_OP = @userCode,
                    Date_OP = @dateOp,
                    Time_OP = @timeOp
                WHERE ID = @id";

            await conn.ExecuteAsync(
                new CommandDefinition(sql, new
                {
                    id,
                    name = dto.Name.Trim(),
                    code = (object?)dto.Code?.Trim() ?? "",
                    userCode = userCode.ToString(),
                    dateOp = GetTodayPersian(),
                    timeOp = GetCurrentTime()
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  Bank — حذف
    // ═══════════════════════════════════════════════════════
    public async Task DeleteBankAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var exists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Bank WHERE ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (exists == 0)
                throw new InvalidOperationException("بانک یافت نشد");

            // چک فرزند (BankAcc)
            var childCount = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM BankAcc WHERE BankID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (childCount > 0)
                throw new InvalidOperationException(
                    $"این بانک {childCount} حساب بانکی دارد — ابتدا آن‌ها را حذف کنید");

            // چک استفاده در چک‌ها
            var usedInCheque = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    @"SELECT 
                        (SELECT COUNT(*) FROM CheckPay WHERE BankAccID IN 
                            (SELECT ID FROM BankAcc WHERE BankID = @id))
                        + (SELECT COUNT(*) FROM CheckRecive WHERE BankID = @id)",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (usedInCheque > 0)
                throw new InvalidOperationException(
                    "این بانک در چک‌ها استفاده شده است و قابل حذف نیست");

            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM Bank WHERE ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  BankAcc — لیست
    // ═══════════════════════════════════════════════════════
    public async Task<BankAccListResultDto> GetBankAccsAsync(
        long orgId, long fyId, BankAccRequestDto req, CancellationToken ct = default)
    {
        var where = new System.Text.StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (req.BankId is > 0)
        {
            where.Append(" AND A.BankID = @bankId ");
            p.Add("bankId", req.BankId.Value);
        }

        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            where.Append(@" AND (
                A.Shobe LIKE @search OR
                A.NoHesab LIKE @search OR
                A.Descript LIKE @search OR
                A.Address LIKE @search OR
                B.Name LIKE @search) ");
            p.Add("search", "%" + req.Search.Trim() + "%");
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 1000) req.PageSize = 1000;
        var offset = (req.Page - 1) * req.PageSize;

        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        // شمارش
        var countSql = $@"
            SELECT COUNT(*) 
            FROM BankAcc A
            LEFT JOIN Bank B ON B.ID = A.BankID
            {where}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        // لیست
        var sql = $@"
            SELECT * FROM (
                SELECT 
                    A.ID           AS Id,
                    A.BankID       AS BankId,
                    B.Name         AS BankName,
                    A.Shobe        AS Shobe,
                    A.NoHesab      AS NoHesab,
                    A.Descript     AS Descript,
                    A.Address      AS Address,
                    A.Phone        AS Phone,
                    A.Code_Col     AS CodeCol,
                    A.Code_Moein   AS CodeMoein,
                    A.Code_Tafzil  AS CodeTafzil,
                    H1.Name        AS CodeColName,
                    H2.Name        AS CodeMoeinName,
                    H3.Name        AS CodeTafzilName,
                    ROW_NUMBER() OVER (ORDER BY B.Name, A.NoHesab) AS RowNum
                FROM BankAcc A
                LEFT JOIN Bank B  ON B.ID  = A.BankID
                LEFT JOIN Hesab H1 ON H1.Code_Col = A.Code_Col 
                    AND H1.Code_Moein = 0 AND H1.Code_Tafzil = 0
                LEFT JOIN Hesab H2 ON H2.Code_Col = A.Code_Col 
                    AND H2.Code_Moein = A.Code_Moein AND H2.Code_Tafzil = 0
                LEFT JOIN Hesab H3 ON H3.Code_Col = -1 
                    AND H3.Code_Moein = 0 AND H3.Code_Tafzil = A.Code_Tafzil
                {where}
            ) AS T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        var items = (await conn.QueryAsync<BankAccListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        return new BankAccListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = (int)Math.Ceiling(total / (double)req.PageSize)
        };
    }

    // ═══════════════════════════════════════════════════════
    //  BankAcc — جزئیات
    // ═══════════════════════════════════════════════════════
    public async Task<BankAccListDto?> GetBankAccAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                A.ID           AS Id,
                A.BankID       AS BankId,
                B.Name         AS BankName,
                A.Shobe        AS Shobe,
                A.NoHesab      AS NoHesab,
                A.Descript     AS Descript,
                A.Address      AS Address,
                A.Phone        AS Phone,
                A.Code_Col     AS CodeCol,
                A.Code_Moein   AS CodeMoein,
                A.Code_Tafzil  AS CodeTafzil,
                H1.Name        AS CodeColName,
                H2.Name        AS CodeMoeinName,
                H3.Name        AS CodeTafzilName
            FROM BankAcc A
            LEFT JOIN Bank B  ON B.ID = A.BankID
            LEFT JOIN Hesab H1 ON H1.Code_Col = A.Code_Col 
                AND H1.Code_Moein = 0 AND H1.Code_Tafzil = 0
            LEFT JOIN Hesab H2 ON H2.Code_Col = A.Code_Col 
                AND H2.Code_Moein = A.Code_Moein AND H2.Code_Tafzil = 0
            LEFT JOIN Hesab H3 ON H3.Code_Col = -1 
                AND H3.Code_Moein = 0 AND H3.Code_Tafzil = A.Code_Tafzil
            WHERE A.ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<BankAccListDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════════
    //  BankAcc — درج
    // ═══════════════════════════════════════════════════════
    public async Task<BankAccWriteResultDto> CreateBankAccAsync(
        long orgId, long fyId, BankAccWriteDto dto, long userCode, CancellationToken ct = default)
    {
        if (dto.BankId is null or 0)
            throw new InvalidOperationException("انتخاب بانک الزامی است");
        if (string.IsNullOrWhiteSpace(dto.NoHesab))
            throw new InvalidOperationException("شماره حساب الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // چک تکراری (شماره حساب در همون بانک)
            var dup = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM BankAcc WHERE BankID = @bankId AND NoHesab = @noHesab",
                    new { bankId = dto.BankId.Value, noHesab = dto.NoHesab.Trim() },
                    transaction: tx, cancellationToken: ct));

            if (dup > 0)
                throw new InvalidOperationException(
                    $"شماره حساب «{dto.NoHesab}» قبلاً در این بانک ثبت شده است");

            const string sql = @"
                INSERT INTO BankAcc 
                    (BankID, Shobe, NoHesab, Descript, Address, Phone,
                     Code_Col, Code_Moein, Code_Tafzil,
                     Code_OP, Date_OP, Time_OP)
                OUTPUT INSERTED.ID
                VALUES 
                    (@bankId, @shobe, @noHesab, @descript, @address, @phone,
                     @codeCol, @codeMoein, @codeTafzil,
                     @userCode, @dateOp, @timeOp)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(sql, new
                {
                    bankId = dto.BankId.Value,
                    shobe = (object?)dto.Shobe?.Trim() ?? "",
                    noHesab = dto.NoHesab.Trim(),
                    descript = (object?)dto.Descript?.Trim() ?? "",
                    address = (object?)dto.Address?.Trim() ?? "",
                    phone = (object?)dto.Phone?.Trim() ?? "",
                    codeCol = dto.CodeCol ?? 0,
                    codeMoein = dto.CodeMoein ?? 0,
                    codeTafzil = dto.CodeTafzil ?? 0,
                    userCode = userCode.ToString(),
                    dateOp = GetTodayPersian(),
                    timeOp = GetCurrentTime()
                }, transaction: tx, cancellationToken: ct));

            // نام بانک
            var bankName = await conn.ExecuteScalarAsync<string?>(
                new CommandDefinition(
                    "SELECT Name FROM Bank WHERE ID = @bankId",
                    new { bankId = dto.BankId.Value },
                    transaction: tx, cancellationToken: ct));

            tx.Commit();

            return new BankAccWriteResultDto
            {
                Id = newId,
                BankName = bankName,
                NoHesab = dto.NoHesab.Trim()
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  BankAcc — ویرایش
    // ═══════════════════════════════════════════════════════
    public async Task UpdateBankAccAsync(
        long orgId, long fyId, long id, BankAccWriteDto dto, long userCode, CancellationToken ct = default)
    {
        if (dto.BankId is null or 0)
            throw new InvalidOperationException("انتخاب بانک الزامی است");
        if (string.IsNullOrWhiteSpace(dto.NoHesab))
            throw new InvalidOperationException("شماره حساب الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var exists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM BankAcc WHERE ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (exists == 0)
                throw new InvalidOperationException("حساب بانکی یافت نشد");

            var dup = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    @"SELECT COUNT(*) FROM BankAcc 
                      WHERE BankID = @bankId AND NoHesab = @noHesab AND ID <> @id",
                    new { bankId = dto.BankId.Value, noHesab = dto.NoHesab.Trim(), id },
                    transaction: tx, cancellationToken: ct));

            if (dup > 0)
                throw new InvalidOperationException(
                    $"حساب دیگری با این شماره در همین بانک وجود دارد");

            const string sql = @"
                UPDATE BankAcc SET
                    BankID      = @bankId,
                    Shobe       = @shobe,
                    NoHesab     = @noHesab,
                    Descript    = @descript,
                    Address     = @address,
                    Phone       = @phone,
                    Code_Col    = @codeCol,
                    Code_Moein  = @codeMoein,
                    Code_Tafzil = @codeTafzil,
                    Code_OP     = @userCode,
                    Date_OP     = @dateOp,
                    Time_OP     = @timeOp
                WHERE ID = @id";

            await conn.ExecuteAsync(
                new CommandDefinition(sql, new
                {
                    id,
                    bankId = dto.BankId.Value,
                    shobe = (object?)dto.Shobe?.Trim() ?? "",
                    noHesab = dto.NoHesab.Trim(),
                    descript = (object?)dto.Descript?.Trim() ?? "",
                    address = (object?)dto.Address?.Trim() ?? "",
                    phone = (object?)dto.Phone?.Trim() ?? "",
                    codeCol = dto.CodeCol ?? 0,
                    codeMoein = dto.CodeMoein ?? 0,
                    codeTafzil = dto.CodeTafzil ?? 0,
                    userCode = userCode.ToString(),
                    dateOp = GetTodayPersian(),
                    timeOp = GetCurrentTime()
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  BankAcc — حذف
    // ═══════════════════════════════════════════════════════
    public async Task DeleteBankAccAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var exists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM BankAcc WHERE ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (exists == 0)
                throw new InvalidOperationException("حساب بانکی یافت نشد");

            // چک استفاده در چک پرداختی
            var usedInPay = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM CheckPay WHERE BankAccID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (usedInPay > 0)
                throw new InvalidOperationException(
                    $"این حساب در {usedInPay} چک پرداختی استفاده شده و قابل حذف نیست");

            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM BankAcc WHERE ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    public async Task<bool> BankAccHasChildrenAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM CheckPay WHERE BankAccID = @id",
                new { id }, cancellationToken: ct));
        return count > 0;
    }
}