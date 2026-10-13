using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Stock;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class ArticleGroupRepository : IArticleGroupRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<ArticleGroupRepository> _logger;

    public ArticleGroupRepository(
        ITenantConnectionFactory factory,
        ILogger<ArticleGroupRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    private static (string inner, string outer) BuildSortMap(string? col, string? dir)
    {
        var dirSql = (dir ?? "asc").ToLower() == "desc" ? "DESC" : "ASC";
        var key = (col ?? "stocktype").ToLower();

        return key switch
        {
            "stocktype" => ($"ST.Code {dirSql}, AG.Code ASC", $"T.StockTypeCode {dirSql}, T.Code ASC"),
            "code" => ($"AG.Code {dirSql}, ST.Code ASC", $"T.Code {dirSql}, T.StockTypeCode ASC"),
            "name" => ($"AG.Name {dirSql}, AG.Code ASC", $"T.Name {dirSql}, T.Code ASC"),
            "degree" => ($"ISNULL(AG.Degree, 0) {dirSql}, AG.Code ASC", $"T.Degree {dirSql}, T.Code ASC"),
            _ => ($"ST.Code ASC, AG.Code ASC", $"T.StockTypeCode ASC, T.Code ASC")
        };
    }

    public async Task<ArticleGroupListResultDto> GetListAsync(
        long orgId, long fyId, ArticleGroupRequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            sb.Append(" AND CAST(AG.Code AS VARCHAR(20)) LIKE @code ");
            p.Add("code", "%" + req.Code + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            sb.Append(" AND AG.Name LIKE @name ");
            p.Add("name", "%" + req.Name + "%");
        }
        if (req.StockTypeId is > 0)
        {
            sb.Append(" AND AG.StockTypeID = @stockTypeId ");
            p.Add("stockTypeId", req.StockTypeId.Value);
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;
        var (orderInner, orderOuter) = BuildSortMap(req.SortColumn, req.SortDir);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var countSql = $@"
            SELECT COUNT(*) FROM ArticleGroup AG
            INNER JOIN StockType ST ON ST.ID = AG.StockTypeID
            {sb}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
        SELECT * FROM (
            SELECT
                CAST(AG.ID AS BIGINT)                 AS Id,
                CAST(AG.StockTypeID AS BIGINT)        AS StockTypeId,
                CAST(ST.Code AS NVARCHAR(50))         AS StockTypeCode,
                ST.Name                               AS StockTypeName,
                AG.Code                               AS Code,
                AG.Name                               AS Name,
                AG.Degree                             AS Degree,
                ROW_NUMBER() OVER (ORDER BY {orderInner}) AS RowNum
            FROM ArticleGroup AG
            INNER JOIN StockType ST ON ST.ID = AG.StockTypeID
            {sb}
        ) AS T
        WHERE T.RowNum BETWEEN @startRow AND @endRow
        ORDER BY {orderOuter}";

        var items = (await conn.QueryAsync<ArticleGroupListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new ArticleGroupListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    public async Task<ArticleGroupDetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT
            CAST(AG.ID AS BIGINT)              AS Id,
            CAST(AG.StockTypeID AS BIGINT)     AS StockTypeId,
            ST.Name                            AS StockTypeName,
            AG.Code                            AS Code,
            AG.Name                            AS Name,
            AG.Degree                          AS Degree,
            (SELECT COUNT(*) FROM ArticleNew AN WHERE AN.ArticleGroupID = AG.ID) AS ArticleCount
        FROM ArticleGroup AG
        INNER JOIN StockType ST ON ST.ID = AG.StockTypeID
        WHERE AG.ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<ArticleGroupDetailDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    public async Task<long> GetNextCodeAsync(
        long orgId, long fyId, long stockTypeId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT ISNULL(MAX(Code), 0) + 1 
            FROM ArticleGroup 
            WHERE StockTypeID = @stockTypeId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, new { stockTypeId }, cancellationToken: ct));
    }

    public async Task<ArticleGroupCreateResultDto> CreateAsync(
        long orgId, long fyId, ArticleGroupCreateDto dto, CancellationToken ct = default)
    {
        if (dto.StockTypeId <= 0)
            throw new InvalidOperationException("انتخاب انبار الزامی است");
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام گروه الزامی است");

        var nameTrimmed = dto.Name.Trim();
        if (nameTrimmed.Length > 50)
            throw new InvalidOperationException("نام گروه حداکثر ۵۰ کاراکتر");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // چک انبار
            var stockExists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM StockType WHERE ID = @stockTypeId",
                    new { stockTypeId = dto.StockTypeId },
                    transaction: tx, cancellationToken: ct));
            if (stockExists == 0)
                throw new InvalidOperationException("انبار انتخاب‌شده یافت نشد");

            // کد
            long nextCode;
            if (dto.Code is > 0)
            {
                if (dto.Code.Value > 999)
                    throw new InvalidOperationException("کد گروه باید حداکثر ۳ رقم باشد (تا ۹۹۹)");

                var exists = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        @"SELECT COUNT(*) FROM ArticleGroup 
                          WHERE Code = @code AND StockTypeID = @stockTypeId",
                        new { code = dto.Code.Value, stockTypeId = dto.StockTypeId },
                        transaction: tx, cancellationToken: ct));
                if (exists > 0)
                    throw new InvalidOperationException(
                        $"کد «{dto.Code.Value}» در این انبار قبلاً استفاده شده است");
                nextCode = dto.Code.Value;
            }
            else
            {
                nextCode = await conn.ExecuteScalarAsync<long>(
                    new CommandDefinition(
                        "SELECT ISNULL(MAX(Code), 0) + 1 FROM ArticleGroup WHERE StockTypeID = @stockTypeId",
                        new { stockTypeId = dto.StockTypeId },
                        transaction: tx, cancellationToken: ct));
            }

            // چک نام تکراری (سراسری)
            var dupName = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM ArticleGroup WHERE Name = @name",
                    new { name = nameTrimmed }, transaction: tx, cancellationToken: ct));
            if (dupName > 0)
                throw new InvalidOperationException($"نام «{nameTrimmed}» قبلاً استفاده شده است");

            const string insSql = @"
            INSERT INTO ArticleGroup (StockTypeID, Code, Name, Degree)
            OUTPUT INSERTED.ID
            VALUES (@stockTypeId, @code, @name, @degree)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insSql, new
                {
                    stockTypeId = dto.StockTypeId,
                    code = nextCode,
                    name = nameTrimmed,
                    degree = dto.Degree
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();
            return new ArticleGroupCreateResultDto { Id = newId, Code = nextCode };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    public async Task UpdateAsync(
        long orgId, long fyId, ArticleGroupUpdateDto dto, CancellationToken ct = default)
    {
        if (dto.Id <= 0)
            throw new InvalidOperationException("شناسه نامعتبر است");
        if (dto.StockTypeId <= 0)
            throw new InvalidOperationException("انتخاب انبار الزامی است");
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام گروه الزامی است");

        var nameTrimmed = dto.Name.Trim();

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var dupName = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM ArticleGroup WHERE Name = @name AND ID <> @id",
                new { name = nameTrimmed, id = dto.Id }, cancellationToken: ct));
        if (dupName > 0)
            throw new InvalidOperationException($"نام «{nameTrimmed}» قبلاً استفاده شده است");

        const string sql = @"
        UPDATE ArticleGroup SET
            StockTypeID = @stockTypeId,
            Name = @name,
            Degree = @degree
        WHERE ID = @id";

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                id = dto.Id,
                stockTypeId = dto.StockTypeId,
                name = nameTrimmed,
                degree = dto.Degree
            }, cancellationToken: ct));

        if (affected == 0)
            throw new InvalidOperationException("گروه یافت نشد");
    }

    public async Task<ArticleGroupUsageDto> GetUsageAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var articleCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM ArticleNew WHERE ArticleGroupID = @id",
                new { id }, cancellationToken: ct));

        return new ArticleGroupUsageDto
        {
            CanDelete = articleCount == 0,
            ArticleCount = articleCount,
            Reason = articleCount > 0
                ? $"این گروه در {articleCount} کالا استفاده شده است"
                : null
        };
    }

    public async Task DeleteAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        var usage = await GetUsageAsync(orgId, fyId, id, ct);
        if (!usage.CanDelete)
            throw new InvalidOperationException(usage.Reason ?? "قابل حذف نیست");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM ArticleGroup WHERE ID = @id",
            new { id }, cancellationToken: ct));
    }

    public async Task<IEnumerable<ArticleGroupListDto>> GetLookupAsync(
        long orgId, long fyId, long? stockTypeId, CancellationToken ct = default)
    {
        var sql = new StringBuilder(@"
        SELECT
            CAST(AG.ID AS BIGINT)         AS Id,
            CAST(AG.StockTypeID AS BIGINT) AS StockTypeId,
            AG.Code                       AS Code,
            AG.Name                       AS Name
        FROM ArticleGroup AG
        INNER JOIN StockType ST ON ST.ID = AG.StockTypeID
        WHERE 1=1 ");

        var p = new DynamicParameters();
        if (stockTypeId is > 0)
        {
            sql.Append(" AND AG.StockTypeID = @stockTypeId");
            p.Add("stockTypeId", stockTypeId.Value);
        }
        sql.Append(" ORDER BY ST.Code, AG.Code");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<ArticleGroupListDto>(
            new CommandDefinition(sql.ToString(), p, cancellationToken: ct));
    }
}