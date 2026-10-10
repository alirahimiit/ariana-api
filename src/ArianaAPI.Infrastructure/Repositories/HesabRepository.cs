using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.DTOs.Hesab;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository حساب‌ها با Dapper
/// </summary>
public class HesabRepository : IHesabRepository
{
    private readonly ITenantConnectionFactory _factory;

    public HesabRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IEnumerable<HesabDto>> GetAllColsAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                HesabID, Code_Col, Code_Moein, Code_Tafzil,
                Name, Discript, Mahiat, Vaziat,
                Sum_Bed, Sum_Bes, Mab_Mandeh,
                HasTafzili, HasTafzili2
            FROM Hesab
            WHERE Code_Col > 0 
              AND Code_Moein = 0 
              AND Code_Tafzil = 0
            ORDER BY Code_Col";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<HesabDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IEnumerable<HesabDto>> GetMoeinsAsync(
        long orgId, long fyId, int codeCol, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                HesabID, Code_Col, Code_Moein, Code_Tafzil,
                Name, Discript, Mahiat, Vaziat,
                Sum_Bed, Sum_Bes, Mab_Mandeh,
                HasTafzili, HasTafzili2
            FROM Hesab
            WHERE Code_Col = @codeCol 
              AND Code_Moein > 0 
              AND Code_Tafzil = 0
            ORDER BY Code_Moein";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<HesabDto>(
            new CommandDefinition(sql, new { codeCol }, cancellationToken: ct));
    }

    public async Task<IEnumerable<HesabDto>> GetTafzilsAsync(
        long orgId, long fyId, int? codeCol = null, CancellationToken ct = default)
    {
        var sql = @"
            SELECT 
                HesabID, Code_Col, Code_Moein, Code_Tafzil,
                Name, Discript, Mahiat, Vaziat,
                Sum_Bed, Sum_Bes, Mab_Mandeh,
                HasTafzili, HasTafzili2
            FROM Hesab
            WHERE Code_Tafzil > 0";

        if (codeCol.HasValue && codeCol.Value > 0)
        {
            sql += " AND Code_Col = @codeCol";
        }

        sql += " ORDER BY Code_Col, Code_Moein, Code_Tafzil";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<HesabDto>(
            new CommandDefinition(sql, new { codeCol }, cancellationToken: ct));
    }

    public async Task<IEnumerable<HesabDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                HesabID, Code_Col, Code_Moein, Code_Tafzil,
                Name, Discript, Mahiat, Vaziat,
                Sum_Bed, Sum_Bes, Mab_Mandeh,
                HasTafzili, HasTafzili2
            FROM Hesab
            WHERE Code_Col > 0
            ORDER BY Code_Col, Code_Moein, Code_Tafzil";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<HesabDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }
    // ═══════════════════════════════════════════
    //  درخت کامل حساب‌ها
    // ═══════════════════════════════════════════
    public async Task<IEnumerable<HesabTreeDto>> GetTreeAsync(
     long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                H.HesabID     AS HesabId,
                H.Code_Col    AS CodeCol,
                H.Code_Moein  AS CodeMoein,
                H.Code_Tafzil AS CodeTafzil,
                H.Name        AS Name,
                H.Mahiat      AS Mahiat,
                H.Vaziat      AS Vaziat,
                ISNULL(H.HasTafzili, 0)  AS HasTafzili,
                ISNULL(H.HasTafzili2, 0) AS HasTafzili2,
                ISNULL(IsStock, 0) AS IsStock,

                -- ⭐ محاسبه‌ی پویا از Sanad
                CASE 
                    -- تفضیلی: جمع روی Code_Tafzil
                    WHEN H.Code_Col = -1 AND H.Code_Tafzil > 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) FROM Sanad S 
                                WHERE S.Code_Tafzil = H.Code_Tafzil), 0)
                    -- معین: جمع روی Code_Col + Code_Moein
                    WHEN H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col 
                                  AND S.Code_Moein = H.Code_Moein), 0)
                    -- کل: جمع روی Code_Col
                    WHEN H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col), 0)
                    ELSE 0
                END AS SumBed,

                CASE 
                    WHEN H.Code_Col = -1 AND H.Code_Tafzil > 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Tafzil = H.Code_Tafzil), 0)
                    WHEN H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col 
                                  AND S.Code_Moein = H.Code_Moein), 0)
                    WHEN H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col), 0)
                    ELSE 0
                END AS SumBes,

                 CASE 
                    WHEN H.Code_Col = -1 AND H.Code_Tafzil > 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) - SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Tafzil = H.Code_Tafzil), 0)
                    WHEN H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) - SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col 
                                  AND S.Code_Moein = H.Code_Moein), 0)
                    WHEN H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0 THEN
                        ISNULL((SELECT SUM(S.Mab_Bed) - SUM(S.Mab_Bes) FROM Sanad S 
                                WHERE S.Code_Col = H.Code_Col), 0)
                    ELSE 0
                END AS MabMandeh,

                CASE 
                    WHEN H.Code_Col = -1 AND H.Code_Tafzil > 0 THEN 'tafzil'
                    WHEN H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0 THEN 'moein'
                    WHEN H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0 THEN 'col'
                    ELSE NULL
                END AS Level
            FROM Hesab H
            WHERE (H.Code_Col > 0 AND H.Code_Moein = 0 AND H.Code_Tafzil = 0)
               OR (H.Code_Col > 0 AND H.Code_Moein > 0 AND H.Code_Tafzil = 0)
               OR (H.Code_Col = -1 AND H.Code_Tafzil > 0)
            ORDER BY 
                CASE WHEN H.Code_Col = -1 THEN 9999 ELSE H.Code_Col END,
                H.Code_Moein,
                H.Code_Tafzil";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var result = await conn.QueryAsync<HesabTreeDto>(
            new CommandDefinition(sql, cancellationToken: ct));

        return result.Where(x => x.Level != null);
    }

    // ═══════════════════════════════════════════════════════
    //  ⭐ مدیریت حساب‌ها — CRUD
    // ═══════════════════════════════════════════════════════

    public async Task<List<HesabListItemDto>> GetListAsync(
        long orgId, long fyId, string level, string? search, CancellationToken ct = default)
    {
        var where = WhereOfLevel(level);
        if (where == null) return new List<HesabListItemDto>();

        var hasSearch = !string.IsNullOrWhiteSpace(search);

        var sql = $@"
        SELECT 
            CONVERT(BIGINT, HesabID)                  AS HesabID,
            CONVERT(INT, ISNULL(Code_Group, 0))       AS CodeGroup,
            CONVERT(INT, ISNULL(Code_Col, 0))         AS CodeCol,
            CONVERT(INT, ISNULL(Code_Moein, 0))       AS CodeMoein,
            CONVERT(INT, ISNULL(Code_Tafzil, 0))      AS CodeTafzil,
            ISNULL(Name, '')                          AS Name,
            Discript,
            CONVERT(INT, ISNULL(Mahiat, 1))           AS Mahiat,
            CONVERT(INT, ISNULL(Vaziat, 1))           AS Vaziat,
            CONVERT(INT, ISNULL(HasTafzili, 0))       AS HasTafzili,
            CONVERT(INT, ISNULL(HasTafzili2, 0))      AS HasTafzili2,
            CONVERT(INT, ISNULL(IsStock, 0))          AS IsStock,
            CONVERT(INT, ISNULL(IsCodeVahed, 0))      AS IsCodeVahed,
            CONVERT(INT, ISNULL(IsCodeMarkaz, 0))     AS IsCodeMarkaz,
            CONVERT(INT, ISNULL(IsCodeProjeh, 0))     AS IsCodeProjeh,
            CASE 
                WHEN CONVERT(INT, ISNULL(Code_Col, 0)) = -1 THEN 'tafzil'
                WHEN CONVERT(INT, ISNULL(Code_Moein, 0)) > 0 THEN 'moein'
                ELSE 'col'
            END AS Level,
            Kind
        FROM Hesab
        WHERE {where}";

        if (hasSearch)
        {
            sql += @" AND (
            Name LIKE @search
            OR CAST(Code_Col AS NVARCHAR(20)) LIKE @search
            OR CAST(Code_Moein AS NVARCHAR(20)) LIKE @search
            OR CAST(Code_Tafzil AS NVARCHAR(20)) LIKE @search
        )";
        }

        sql += @" ORDER BY 
        CASE WHEN CONVERT(INT, ISNULL(Code_Col, 0)) = -1 THEN 9999 ELSE CONVERT(INT, Code_Col) END,
        CONVERT(INT, ISNULL(Code_Moein, 0)),
        CONVERT(INT, ISNULL(Code_Tafzil, 0))";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        // ⭐ اینجا مشکل بود — search رو فقط وقتی بفرست که واقعاً مقدار داشته باشه
        var parameters = hasSearch
            ? new { search = "%" + search!.Trim() + "%" }
            : null;

        var rows = await conn.QueryAsync<HesabListItemDto>(
            new CommandDefinition(sql, parameters, cancellationToken: ct));

        var list = rows.ToList();
        foreach (var r in list) Decorate(r);
        return list;
    }
    public async Task<HesabListItemDto?> GetByIdAsync(
        long orgId, long fyId, long hesabId, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT 
            CONVERT(BIGINT, HesabID)                  AS HesabID,
            CONVERT(INT, ISNULL(Code_Group, 0))       AS CodeGroup,
            CONVERT(INT, ISNULL(Code_Col, 0))         AS CodeCol,
            CONVERT(INT, ISNULL(Code_Moein, 0))       AS CodeMoein,
            CONVERT(INT, ISNULL(Code_Tafzil, 0))      AS CodeTafzil,
            ISNULL(Name, '')                          AS Name,
            Discript,
            CONVERT(INT, ISNULL(Mahiat, 1))           AS Mahiat,
            CONVERT(INT, ISNULL(Vaziat, 1))           AS Vaziat,
            CONVERT(INT, ISNULL(HasTafzili, 0))       AS HasTafzili,
            CONVERT(INT, ISNULL(HasTafzili2, 0))      AS HasTafzili2,
            CONVERT(INT, ISNULL(IsStock, 0))          AS IsStock,
            CONVERT(INT, ISNULL(IsCodeVahed, 0))      AS IsCodeVahed,
            CONVERT(INT, ISNULL(IsCodeMarkaz, 0))     AS IsCodeMarkaz,
            CONVERT(INT, ISNULL(IsCodeProjeh, 0))     AS IsCodeProjeh,
            CASE 
                WHEN CONVERT(INT, ISNULL(Code_Col, 0)) = -1 THEN 'tafzil'
                WHEN CONVERT(INT, ISNULL(Code_Moein, 0)) > 0 THEN 'moein'
                ELSE 'col'
            END AS Level,
            Kind
        FROM Hesab
        WHERE HesabID = @hesabId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var row = await conn.QueryFirstOrDefaultAsync<HesabListItemDto>(
            new CommandDefinition(sql, new { hesabId }, cancellationToken: ct));

        if (row == null) return null;
        Decorate(row);
        return row;
    }
    public async Task<HesabUsageDto> GetUsageAsync(
        long orgId, long fyId, long hesabId, CancellationToken ct = default)
    {
        const string sqlGet = @"
            SELECT 
                ISNULL(Code_Col, 0)     AS CodeCol,
                ISNULL(Code_Moein, 0)   AS CodeMoein,
                ISNULL(Code_Tafzil, 0)  AS CodeTafzil
            FROM Hesab WHERE HesabID = @hesabId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var h = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(sqlGet, new { hesabId }, cancellationToken: ct));

        if (h == null)
            return new HesabUsageDto { Message = "حساب یافت نشد" };

        int codeCol = (int)(h.CodeCol ?? 0);
        int codeMoein = (int)(h.CodeMoein ?? 0);
        int codeTafzil = (int)(h.CodeTafzil ?? 0);

        int sanadCount = 0;
        bool hasChildren = false;

        // ─── شمارش استفاده در اسناد ───
        if (codeCol == -1 && codeTafzil > 0)
        {
            // تفصیلی
            sanadCount = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Sanad WHERE Code_Tafzil = @codeTafzil",
                    new { codeTafzil }, cancellationToken: ct));
        }
        else if (codeMoein > 0)
        {
            // معین
            sanadCount = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Sanad WHERE Code_Col = @codeCol AND Code_Moein = @codeMoein",
                    new { codeCol, codeMoein }, cancellationToken: ct));

            // معین → تفصیلی دارد؟ (در Hesab کد تفصیلی مستقل است، پس فرزند ندارد)
            hasChildren = false;
        }
        else if (codeCol > 0)
        {
            // کل
            sanadCount = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Sanad WHERE Code_Col = @codeCol",
                    new { codeCol }, cancellationToken: ct));

            // کل → معین دارد؟
            var moeinCount = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Hesab WHERE Code_Col = @codeCol AND Code_Moein > 0 AND Code_Tafzil = 0",
                    new { codeCol }, cancellationToken: ct));
            hasChildren = moeinCount > 0;
        }

        var msg = sanadCount > 0
            ? "این حساب در اسناد استفاده شده است"
            : hasChildren ? "این حساب دارای زیرمجموعه است" : null;

        return new HesabUsageDto
        {
            UsedInSanad = sanadCount > 0,
            SanadCount = sanadCount,
            HasChildren = hasChildren,
            Message = msg
        };
    }

    public async Task<int> GetNextCodeAsync(
        long orgId, long fyId, string level, int? codeCol, CancellationToken ct = default)
    {
        string sql = level switch
        {
            "col" => "SELECT ISNULL(MAX(Code_Col), 0) + 1 FROM Hesab WHERE Code_Col > 0 AND Code_Moein = 0 AND Code_Tafzil = 0",
            "moein" => "SELECT ISNULL(MAX(Code_Moein), 0) + 1 FROM Hesab WHERE Code_Col = @codeCol AND Code_Moein > 0 AND Code_Tafzil = 0",
            "tafzil" => "SELECT ISNULL(MAX(Code_Tafzil), 0) + 1 FROM Hesab WHERE Code_Col = -1 AND Code_Tafzil > 0",
            _ => "SELECT 1"
        };

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, new { codeCol = codeCol ?? 0 }, cancellationToken: ct));
    }

    public async Task<long> CreateAsync(
        long orgId, long fyId, HesabCreateDto dto, CancellationToken ct = default)
    {
        // ─── کد اتوماتیک اگر نفرستاده ───
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        int codeCol = dto.CodeCol ?? 0;
        int codeMoein = dto.CodeMoein ?? 0;
        int codeTafzil = dto.CodeTafzil ?? 0;
        int codeGroup = dto.CodeGroup ?? 0;

        if (dto.Level == HesabLevel.Col && codeCol <= 0)
            codeCol = await GetNextCodeAsync(orgId, fyId, "col", null, ct);
        else if (dto.Level == HesabLevel.Moein && codeMoein <= 0)
            codeMoein = await GetNextCodeAsync(orgId, fyId, "moein", codeCol, ct);
        else if (dto.Level == HesabLevel.Tafzil && codeTafzil <= 0)
            codeTafzil = await GetNextCodeAsync(orgId, fyId, "tafzil", null, ct);

        // ─── برای تفصیلی: Code_Col = -1 ───
        if (dto.Level == HesabLevel.Tafzil)
        {
            codeCol = -1;
            codeMoein = 0;
        }

        const string sql = @"
            INSERT INTO Hesab 
                (Code_Group, Code_Col, Code_Moein, Code_Tafzil, Name, Discript,
                 Mahiat, Vaziat, HasTafzili, HasTafzili2, IsStock,
                 IsCodeVahed, IsCodeMarkaz, IsCodeProjeh, Kind, Code_Op, Date_Op, Time_Op)
            VALUES 
                (@codeGroup, @codeCol, @codeMoein, @codeTafzil, @name, @discript,
                 @mahiat, @vaziat, @hasTafzili, @hasTafzili2, @isStock,
                 @isCodeVahed, @isCodeMarkaz, @isCodeProjeh, @kind, 0, @dateOp, @timeOp);
            SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

        var id = await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, new
            {
                codeGroup,
                codeCol,
                codeMoein,
                codeTafzil,
                name = dto.Name.Trim(),
                discript = dto.Discript,
                mahiat = dto.Mahiat,
                vaziat = dto.Vaziat,
                hasTafzili = dto.HasTafzili,
                hasTafzili2 = dto.HasTafzili2,
                isStock = dto.IsStock,
                isCodeVahed = dto.IsCodeVahed,
                isCodeMarkaz = dto.IsCodeMarkaz,
                isCodeProjeh = dto.IsCodeProjeh,
                kind = dto.Kind ?? 0,
                dateOp = PersianToday(),
                timeOp = DateTime.Now.ToString("HH:mm:ss")
            }, cancellationToken: ct));

        return id;
    }

    public async Task<bool> UpdateAsync(
        long orgId, long fyId, long hesabId, HesabUpdateDto dto, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        // ─── بررسی: اگر می‌خواد ماهیت تغییر بده، باید سند نداشته باشه ───
        if (dto.Mahiat.HasValue)
        {
            var usage = await GetUsageAsync(orgId, fyId, hesabId, ct);
            if (usage.UsedInSanad)
            {
                // چک کن واقعاً داره ماهیت رو تغییر می‌ده یا نه
                var current = await conn.QueryFirstOrDefaultAsync<int?>(
                    new CommandDefinition(
                        "SELECT Mahiat FROM Hesab WHERE HesabID = @hesabId",
                        new { hesabId }, cancellationToken: ct));

                if (current != dto.Mahiat.Value)
                    throw new InvalidOperationException(
                        "این حساب در اسناد استفاده شده — تغییر ماهیت مجاز نیست");
            }
        }

        const string sql = @"
            UPDATE Hesab SET
                Name        = ISNULL(@name, Name),
                Discript    = @discript,
                Mahiat      = ISNULL(@mahiat, Mahiat),
                Vaziat      = ISNULL(@vaziat, Vaziat),
                HasTafzili  = ISNULL(@hasTafzili, HasTafzili),
                HasTafzili2 = ISNULL(@hasTafzili2, HasTafzili2),
                IsStock     = ISNULL(@isStock, IsStock),
                IsCodeVahed = ISNULL(@isCodeVahed, IsCodeVahed),
                IsCodeMarkaz= ISNULL(@isCodeMarkaz, IsCodeMarkaz),
                IsCodeProjeh= ISNULL(@isCodeProjeh, IsCodeProjeh),
                Kind        = ISNULL(@kind, Kind),
                Date_Op     = @dateOp,
                Time_Op     = @timeOp
            WHERE HesabID = @hesabId";

        var n = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                hesabId,
                name = dto.Name?.Trim(),
                discript = dto.Discript,
                mahiat = dto.Mahiat,
                vaziat = dto.Vaziat,
                hasTafzili = dto.HasTafzili,
                hasTafzili2 = dto.HasTafzili2,
                isStock = dto.IsStock,
                isCodeVahed = dto.IsCodeVahed,
                isCodeMarkaz = dto.IsCodeMarkaz,
                isCodeProjeh = dto.IsCodeProjeh,
                kind = dto.Kind,
                dateOp = PersianToday(),
                timeOp = DateTime.Now.ToString("HH:mm:ss")
            }, cancellationToken: ct));

        return n > 0;
    }

    public async Task DeleteAsync(
        long orgId, long fyId, long hesabId, CancellationToken ct = default)
    {
        var usage = await GetUsageAsync(orgId, fyId, hesabId, ct);
        if (usage.UsedInSanad)
            throw new InvalidOperationException("این حساب در اسناد استفاده شده و قابل حذف نیست");
        if (usage.HasChildren)
            throw new InvalidOperationException("این حساب دارای زیرمجموعه است و قابل حذف نیست");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM Hesab WHERE HesabID = @hesabId",
                new { hesabId }, cancellationToken: ct));
    }

    public async Task<List<HesabListItemDto>> SearchAsync(
        long orgId, long fyId, string level, string? search, int? codeCol,
        bool onlyWithTafzili, CancellationToken ct = default)
    {
        var where = WhereOfLevel(level);
        if (where == null) return new List<HesabListItemDto>();

        var hasSearch = !string.IsNullOrWhiteSpace(search);

        var sql = $@"
        SELECT 
            CONVERT(BIGINT, HesabID)                  AS HesabID,
            CONVERT(INT, ISNULL(Code_Group, 0))       AS CodeGroup,
            CONVERT(INT, ISNULL(Code_Col, 0))         AS CodeCol,
            CONVERT(INT, ISNULL(Code_Moein, 0))       AS CodeMoein,
            CONVERT(INT, ISNULL(Code_Tafzil, 0))      AS CodeTafzil,
            ISNULL(Name, '')                          AS Name,
            Discript,
            CONVERT(INT, ISNULL(Mahiat, 1))           AS Mahiat,
            CONVERT(INT, ISNULL(Vaziat, 1))           AS Vaziat,
            CONVERT(INT, ISNULL(HasTafzili, 0))       AS HasTafzili,
            CONVERT(INT, ISNULL(HasTafzili2, 0))      AS HasTafzili2,
            CONVERT(INT, ISNULL(IsStock, 0))          AS IsStock,
            CONVERT(INT, ISNULL(IsCodeVahed, 0))      AS IsCodeVahed,
            CONVERT(INT, ISNULL(IsCodeMarkaz, 0))     AS IsCodeMarkaz,
            CONVERT(INT, ISNULL(IsCodeProjeh, 0))     AS IsCodeProjeh,
            CASE 
                WHEN CONVERT(INT, ISNULL(Code_Col, 0)) = -1 THEN 'tafzil'
                WHEN CONVERT(INT, ISNULL(Code_Moein, 0)) > 0 THEN 'moein'
                ELSE 'col'
            END AS Level,
            Kind
        FROM Hesab
        WHERE {where}";

        if (codeCol.HasValue && codeCol.Value > 0 && level == HesabLevel.Moein)
            sql += " AND CONVERT(INT, Code_Col) = @codeCol";

        if (onlyWithTafzili)
            sql += " AND CONVERT(INT, ISNULL(HasTafzili, 0)) = 1";

        if (hasSearch)
        {
            sql += @" AND (
            Name LIKE @search
            OR CAST(Code_Col AS NVARCHAR(20)) LIKE @search
            OR CAST(Code_Moein AS NVARCHAR(20)) LIKE @search
            OR CAST(Code_Tafzil AS NVARCHAR(20)) LIKE @search
        )";
        }

        sql += @" ORDER BY 
        CASE WHEN CONVERT(INT, ISNULL(Code_Col, 0)) = -1 THEN 9999 ELSE CONVERT(INT, Code_Col) END,
        CONVERT(INT, ISNULL(Code_Moein, 0)),
        CONVERT(INT, ISNULL(Code_Tafzil, 0))";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        object parameters = hasSearch
            ? new { codeCol = codeCol ?? 0, search = "%" + search!.Trim() + "%" }
            : new { codeCol = codeCol ?? 0 };

        var rows = await conn.QueryAsync<HesabListItemDto>(
            new CommandDefinition(sql, parameters, cancellationToken: ct));

        var list = rows.ToList();
        foreach (var r in list) Decorate(r);
        return list;
    }
    // ═══════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════

    private static string? WhereOfLevel(string level) => level switch
    {
        "col" => "Code_Col > 0 AND Code_Moein = 0 AND Code_Tafzil = 0",
        "moein" => "Code_Col > 0 AND Code_Moein > 0 AND Code_Tafzil = 0",
        "tafzil" => "Code_Col = -1 AND Code_Tafzil > 0",
        _ => null
    };

    private static void Decorate(HesabListItemDto r)
    {
        r.MahiatStr = r.Mahiat switch
        {
            1 => "بدهکار",
            2 => "بستانکار",
            3 => "عادی",
            _ => "-"
        };
        r.VaziatStr = r.Vaziat == 1 ? "فعال" : "غیرفعال";
    }

    private static string PersianToday()
    {
        try
        {
            var pc = new System.Globalization.PersianCalendar();
            var now = DateTime.Now;
            return $"{pc.GetYear(now):0000}/{pc.GetMonth(now):00}/{pc.GetDayOfMonth(now):00}";
        }
        catch { return DateTime.Now.ToString("yyyy/MM/dd"); }
    }
}