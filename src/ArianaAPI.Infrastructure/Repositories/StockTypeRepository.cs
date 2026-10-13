using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Stock;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class StockTypeRepository : IStockTypeRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<StockTypeRepository> _logger;

    public StockTypeRepository(
        ITenantConnectionFactory factory,
        ILogger<StockTypeRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══ Sort Map ═══
    private static (string inner, string outer) BuildSortMap(string? col, string? dir)
    {
        var dirSql = (dir ?? "asc").ToLower() == "desc" ? "DESC" : "ASC";
        var key = (col ?? "code").ToLower();

        return key switch
        {
            "code" => ($"ST.Code {dirSql}", $"T.Code {dirSql}"),
            "name" => ($"ST.Name {dirSql}, ST.Code ASC", $"T.Name {dirSql}, T.Code ASC"),
            "kind" => ($"ISNULL(ST.Kind, 0) {dirSql}, ST.Code ASC", $"T.Kind {dirSql}, T.Code ASC"),
            _ => ($"ST.Code {dirSql}", $"T.Code {dirSql}")
        };
    }

    // ═══ LIST ═══
    public async Task<StockTypeListResultDto> GetListAsync(
        long orgId, long fyId, StockTypeRequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            sb.Append(" AND CAST(ST.Code AS VARCHAR(20)) LIKE @code ");
            p.Add("code", "%" + req.Code + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            sb.Append(" AND ST.Name LIKE @name ");
            p.Add("name", "%" + req.Name + "%");
        }
        if (req.Kind.HasValue)
        {
            sb.Append(" AND ISNULL(ST.Kind, 0) = @kind ");
            p.Add("kind", req.Kind.Value);
        }
        if (req.ForEst.HasValue)
        {
            sb.Append(" AND ISNULL(ST.For_EST, 0) = @forEst ");
            p.Add("forEst", req.ForEst.Value ? 1 : 0);
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;
        var (orderInner, orderOuter) = BuildSortMap(req.SortColumn, req.SortDir);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var countSql = $@"SELECT COUNT(*) FROM StockType ST {sb}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
        SELECT * FROM (
            SELECT
                CAST(ST.ID AS BIGINT)                AS Id,
                ST.Code                              AS Code,
                ST.Name                              AS Name,
                ISNULL(ST.Kind, 0)                   AS Kind,
                CASE ISNULL(ST.Kind, 0)
                    WHEN 0 THEN N'کالا'
                    WHEN 1 THEN N'محصول'
                    ELSE N'-'
                END                                  AS KindName,
                CAST(ISNULL(ST.For_EST, 0) AS BIT)   AS ForEst,
                CONVERT(INT, ISNULL(ST.Code_Col, 0))     AS CodeCol,
                CONVERT(INT, ISNULL(ST.Code_Moein, 0))   AS CodeMoein,
                CONVERT(INT, ISNULL(ST.Code_Tafzil, 0))  AS CodeTafzil,
                CONVERT(INT, ISNULL(ST.Code_Tafzil2, 0)) AS CodeTafzil2,
                (SELECT COUNT(*) FROM ArticleGroup AG WHERE AG.StockTypeID = ST.ID) AS ArticleGroupCount,
                (SELECT COUNT(*) FROM ArticleStock ASk WHERE ASk.StockTypeID = ST.ID) AS ArticleCount,
                ROW_NUMBER() OVER (ORDER BY {orderInner}) AS RowNum
            FROM StockType ST
            {sb}
        ) AS T
        WHERE T.RowNum BETWEEN @startRow AND @endRow
        ORDER BY {orderOuter}";

        var items = (await conn.QueryAsync<StockTypeListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new StockTypeListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    // ═══ DETAIL ═══
    public async Task<StockTypeDetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT
            CAST(ID AS BIGINT)                    AS Id,
            Code                                  AS Code,
            Name                                  AS Name,
            ISNULL(Kind, 0)                       AS Kind,
            CAST(ISNULL(For_EST, 0) AS BIT)       AS ForEst,
            CONVERT(INT, ISNULL(Code_Col, 0))     AS CodeCol,
            CONVERT(INT, ISNULL(Code_Moein, 0))   AS CodeMoein,
            CONVERT(INT, ISNULL(Code_Tafzil, 0))  AS CodeTafzil,
            CONVERT(INT, ISNULL(Code_Tafzil2, 0)) AS CodeTafzil2,
            CAST(ISNULL(xIs_RegMinOrderToIn, 0) AS BIT)     AS IsRegMinOrderToIn,
            CAST(ISNULL(xIs_RegMaxOrderToOut, 0) AS BIT)    AS IsRegMaxOrderToOut,
            CAST(ISNULL(xIs_RegNegativKala, 0) AS BIT)      AS IsRegNegativKala,
            CAST(ISNULL(xNotCalcPerDiscount, 0) AS BIT)     AS NotCalcPerDiscount,
            CAST(ISNULL(xNotCalcArezeshafzode, 0) AS BIT)   AS NotCalcArezeshafzode,
            CAST(ISNULL(xIs_CalcUnit2, 0) AS BIT)           AS IsCalcUnit2,
            CAST(ISNULL(xIs_CalcUnit3, 0) AS BIT)           AS IsCalcUnit3
        FROM StockType
        WHERE ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<StockTypeDetailDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    // ═══ NEXT CODE ═══
    public async Task<long> GetNextCodeAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = "SELECT ISNULL(MAX(Code), 0) + 1 FROM StockType";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══ CREATE ═══
    public async Task<StockTypeCreateResultDto> CreateAsync(
        long orgId, long fyId, StockTypeCreateDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام انبار الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // کد
            long nextCode;
            if (dto.Code is > 0)
            {
                var exists = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        "SELECT COUNT(*) FROM StockType WHERE Code = @code",
                        new { code = dto.Code.Value }, transaction: tx, cancellationToken: ct));
                if (exists > 0)
                    throw new InvalidOperationException($"کد «{dto.Code.Value}» قبلاً استفاده شده است");
                nextCode = dto.Code.Value;
            }
            else
            {
                nextCode = await conn.ExecuteScalarAsync<long>(
                    new CommandDefinition(
                        "SELECT ISNULL(MAX(Code), 0) + 1 FROM StockType",
                        transaction: tx, cancellationToken: ct));
            }

            // نام تکراری
            var dupName = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM StockType WHERE Name = @name",
                    new { name = dto.Name.Trim() }, transaction: tx, cancellationToken: ct));
            if (dupName > 0)
                throw new InvalidOperationException($"نام «{dto.Name}» قبلاً استفاده شده است");

            const string insSql = @"
            INSERT INTO StockType
                (Code, Name, Kind, For_EST,
                 Code_Col, Code_Moein, Code_Tafzil, Code_Tafzil2,
                 xIs_RegMinOrderToIn, xIs_RegMaxOrderToOut, xIs_RegNegativKala,
                 xNotCalcPerDiscount, xNotCalcArezeshafzode,
                 xIs_CalcUnit2, xIs_CalcUnit3)
            OUTPUT INSERTED.ID
            VALUES
                (@code, @name, @kind, @forEst,
                 @codeCol, @codeMoein, @codeTafzil, @codeTafzil2,
                 @isRegMinOrderToIn, @isRegMaxOrderToOut, @isRegNegativKala,
                 @notCalcPerDiscount, @notCalcArezeshafzode,
                 @isCalcUnit2, @isCalcUnit3)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insSql, new
                {
                    code = nextCode,
                    name = dto.Name.Trim(),
                    kind = dto.Kind ?? 0,
                    forEst = dto.ForEst == true ? 1 : 0,
                    codeCol = dto.CodeCol ?? 0,
                    codeMoein = dto.CodeMoein ?? 0,
                    codeTafzil = dto.CodeTafzil ?? 0,
                    codeTafzil2 = dto.CodeTafzil2 ?? 0,
                    isRegMinOrderToIn = dto.IsRegMinOrderToIn == true ? 1 : 0,
                    isRegMaxOrderToOut = dto.IsRegMaxOrderToOut == true ? 1 : 0,
                    isRegNegativKala = dto.IsRegNegativKala == true ? 1 : 0,
                    notCalcPerDiscount = dto.NotCalcPerDiscount == true ? 1 : 0,
                    notCalcArezeshafzode = dto.NotCalcArezeshafzode == true ? 1 : 0,
                    isCalcUnit2 = dto.IsCalcUnit2 == true ? 1 : 0,
                    isCalcUnit3 = dto.IsCalcUnit3 == true ? 1 : 0
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();
            return new StockTypeCreateResultDto { Id = newId, Code = nextCode };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══ UPDATE ═══
    public async Task UpdateAsync(
        long orgId, long fyId, StockTypeUpdateDto dto, CancellationToken ct = default)
    {
        if (dto.Id <= 0)
            throw new InvalidOperationException("شناسه انبار نامعتبر است");
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام انبار الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        // نام تکراری (خودش نباشه)
        var dupName = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM StockType WHERE Name = @name AND ID <> @id",
                new { name = dto.Name.Trim(), id = dto.Id }, cancellationToken: ct));
        if (dupName > 0)
            throw new InvalidOperationException($"نام «{dto.Name}» قبلاً استفاده شده است");

        const string sql = @"
        UPDATE StockType SET
            Name = @name,
            Kind = @kind,
            For_EST = @forEst,
            Code_Col = @codeCol,
            Code_Moein = @codeMoein,
            Code_Tafzil = @codeTafzil,
            Code_Tafzil2 = @codeTafzil2,
            xIs_RegMinOrderToIn = @isRegMinOrderToIn,
            xIs_RegMaxOrderToOut = @isRegMaxOrderToOut,
            xIs_RegNegativKala = @isRegNegativKala,
            xNotCalcPerDiscount = @notCalcPerDiscount,
            xNotCalcArezeshafzode = @notCalcArezeshafzode,
            xIs_CalcUnit2 = @isCalcUnit2,
            xIs_CalcUnit3 = @isCalcUnit3
        WHERE ID = @id";

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                id = dto.Id,
                name = dto.Name.Trim(),
                kind = dto.Kind ?? 0,
                forEst = dto.ForEst == true ? 1 : 0,
                codeCol = dto.CodeCol ?? 0,
                codeMoein = dto.CodeMoein ?? 0,
                codeTafzil = dto.CodeTafzil ?? 0,
                codeTafzil2 = dto.CodeTafzil2 ?? 0,
                isRegMinOrderToIn = dto.IsRegMinOrderToIn == true ? 1 : 0,
                isRegMaxOrderToOut = dto.IsRegMaxOrderToOut == true ? 1 : 0,
                isRegNegativKala = dto.IsRegNegativKala == true ? 1 : 0,
                notCalcPerDiscount = dto.NotCalcPerDiscount == true ? 1 : 0,
                notCalcArezeshafzode = dto.NotCalcArezeshafzode == true ? 1 : 0,
                isCalcUnit2 = dto.IsCalcUnit2 == true ? 1 : 0,
                isCalcUnit3 = dto.IsCalcUnit3 == true ? 1 : 0
            }, cancellationToken: ct));

        if (affected == 0)
            throw new InvalidOperationException("انبار یافت نشد");
    }

    // ═══ USAGE ═══
    public async Task<StockTypeUsageDto> GetUsageAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var groupCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM ArticleGroup WHERE StockTypeID = @id",
                new { id }, cancellationToken: ct));

        var articleCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM ArticleStock WHERE StockTypeID = @id",
                new { id }, cancellationToken: ct));

        var canDelete = groupCount == 0 && articleCount == 0;

        string? reason = null;
        if (!canDelete)
        {
            if (groupCount > 0 && articleCount > 0)
                reason = $"این انبار دارای {groupCount} گروه کالا و {articleCount} کالا است";
            else if (groupCount > 0)
                reason = $"این انبار دارای {groupCount} گروه کالا است";
            else
                reason = $"این انبار در {articleCount} کالا استفاده شده است";
        }

        return new StockTypeUsageDto
        {
            CanDelete = canDelete,
            ArticleGroupCount = groupCount,
            ArticleCount = articleCount,
            Reason = reason
        };
    }

    // ═══ DELETE ═══
    public async Task DeleteAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        var usage = await GetUsageAsync(orgId, fyId, id, ct);
        if (!usage.CanDelete)
            throw new InvalidOperationException(usage.Reason ?? "قابل حذف نیست");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM StockType WHERE ID = @id",
            new { id }, cancellationToken: ct));
    }

    // ═══ LOOKUP ═══
    public async Task<IEnumerable<StockTypeListDto>> GetLookupAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT
            CAST(ID AS BIGINT) AS Id,
            Code AS Code,
            Name AS Name,
            ISNULL(Kind, 0) AS Kind,
            CASE ISNULL(Kind, 0)
                WHEN 0 THEN N'کالا'
                WHEN 1 THEN N'محصول'
                ELSE N'-'
            END AS KindName
        FROM StockType
        ORDER BY Name";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<StockTypeListDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }
}