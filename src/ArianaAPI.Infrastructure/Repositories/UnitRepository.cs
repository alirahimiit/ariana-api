using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Stock;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class UnitRepository : IUnitRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<UnitRepository> _logger;

    public UnitRepository(ITenantConnectionFactory factory, ILogger<UnitRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    private static (string inner, string outer) BuildSortMap(string? col, string? dir)
    {
        var dirSql = (dir ?? "asc").ToLower() == "desc" ? "DESC" : "ASC";
        var key = (col ?? "code").ToLower();

        return key switch
        {
            "code" => ($"U.Code {dirSql}", $"T.Code {dirSql}"),
            "name" => ($"U.Name {dirSql}, U.Code ASC", $"T.Name {dirSql}, T.Code ASC"),
            "tabileunit" => ($"ISNULL(U.TabileUnit, 0) {dirSql}, U.Code ASC", $"T.TabileUnit {dirSql}, T.Code ASC"),
            _ => ($"U.Code {dirSql}", $"T.Code {dirSql}")
        };
    }

    public async Task<UnitListResultDto> GetListAsync(
        long orgId, long fyId, UnitRequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            sb.Append(" AND CAST(U.Code AS VARCHAR(20)) LIKE @code ");
            p.Add("code", "%" + req.Code + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            sb.Append(" AND U.Name LIKE @name ");
            p.Add("name", "%" + req.Name + "%");
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;
        var (orderInner, orderOuter) = BuildSortMap(req.SortColumn, req.SortDir);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var countSql = $@"SELECT COUNT(*) FROM ArticleUnit U {sb}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
        SELECT * FROM (
            SELECT
                CAST(U.ID AS BIGINT)     AS Id,
                U.Code                   AS Code,
                U.Name                   AS Name,
                U.TabileUnit             AS TabileUnit,
                U.tax_id                 AS TaxId,
                (SELECT COUNT(*) FROM ArticleNew AN 
                  WHERE AN.ArticleUnitID = U.ID 
                     OR AN.ArticleUnitID2 = U.ID 
                     OR AN.ArticleUnitID3 = U.ID)     AS ArticleCount,
                ROW_NUMBER() OVER (ORDER BY {orderInner}) AS RowNum
            FROM ArticleUnit U
            {sb}
        ) AS T
        WHERE T.RowNum BETWEEN @startRow AND @endRow
        ORDER BY {orderOuter}";

        var items = (await conn.QueryAsync<UnitListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new UnitListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    public async Task<UnitDetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT
            CAST(U.ID AS BIGINT)     AS Id,
            U.Code                   AS Code,
            U.Name                   AS Name,
            U.TabileUnit             AS TabileUnit,
            U.tax_id                 AS TaxId,
            (SELECT COUNT(*) FROM ArticleNew AN 
              WHERE AN.ArticleUnitID = U.ID 
                 OR AN.ArticleUnitID2 = U.ID 
                 OR AN.ArticleUnitID3 = U.ID)     AS ArticleCount
        FROM ArticleUnit U
        WHERE U.ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<UnitDetailDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    public async Task<long> GetNextCodeAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = "SELECT ISNULL(MAX(Code), 0) + 1 FROM ArticleUnit";
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<UnitCreateResultDto> CreateAsync(
        long orgId, long fyId, UnitCreateDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام واحد الزامی است");

        var name = dto.Name.Trim();
        if (name.Length > 50)
            throw new InvalidOperationException("نام واحد حداکثر ۵۰ کاراکتر");

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
                        "SELECT COUNT(*) FROM ArticleUnit WHERE Code = @code",
                        new { code = dto.Code.Value }, transaction: tx, cancellationToken: ct));
                if (exists > 0)
                    throw new InvalidOperationException($"کد «{dto.Code.Value}» قبلاً استفاده شده است");
                nextCode = dto.Code.Value;
            }
            else
            {
                nextCode = await conn.ExecuteScalarAsync<long>(
                    new CommandDefinition(
                        "SELECT ISNULL(MAX(Code), 0) + 1 FROM ArticleUnit",
                        transaction: tx, cancellationToken: ct));
            }

            // چک نام تکراری
            var dupName = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM ArticleUnit WHERE Name = @name",
                    new { name }, transaction: tx, cancellationToken: ct));
            if (dupName > 0)
                throw new InvalidOperationException($"نام «{name}» قبلاً استفاده شده است");

            const string insSql = @"
            INSERT INTO ArticleUnit (Code, Name, TabileUnit, tax_id)
            OUTPUT INSERTED.ID
            VALUES (@code, @name, @tabileUnit, @taxId)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insSql, new
                {
                    code = nextCode,
                    name,
                    tabileUnit = dto.TabileUnit,
                    taxId = dto.TaxId
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();
            return new UnitCreateResultDto { Id = newId, Code = nextCode };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    public async Task UpdateAsync(
        long orgId, long fyId, UnitUpdateDto dto, CancellationToken ct = default)
    {
        if (dto.Id <= 0)
            throw new InvalidOperationException("شناسه نامعتبر است");
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام واحد الزامی است");

        var name = dto.Name.Trim();

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var dupName = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM ArticleUnit WHERE Name = @name AND ID <> @id",
                new { name, id = dto.Id }, cancellationToken: ct));
        if (dupName > 0)
            throw new InvalidOperationException($"نام «{name}» قبلاً استفاده شده است");

        const string sql = @"
        UPDATE ArticleUnit SET
            Code = ISNULL(@code, Code),
            Name = @name,
            TabileUnit = @tabileUnit,
            tax_id = @taxId
        WHERE ID = @id";

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                id = dto.Id,
                code = dto.Code,
                name,
                tabileUnit = dto.TabileUnit,
                taxId = dto.TaxId
            }, cancellationToken: ct));

        if (affected == 0)
            throw new InvalidOperationException("واحد یافت نشد");
    }

    public async Task<UnitUsageDto> GetUsageAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                @"SELECT COUNT(*) FROM ArticleNew 
                  WHERE ArticleUnitID = @id OR ArticleUnitID2 = @id OR ArticleUnitID3 = @id",
                new { id }, cancellationToken: ct));

        return new UnitUsageDto
        {
            CanDelete = count == 0,
            ArticleCount = count,
            Reason = count > 0 ? $"این واحد در {count} کالا استفاده شده است" : null
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
            "DELETE FROM ArticleUnit WHERE ID = @id",
            new { id }, cancellationToken: ct));
    }

    public async Task<IEnumerable<UnitListDto>> GetLookupAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT
            CAST(ID AS BIGINT) AS Id,
            Code               AS Code,
            Name               AS Name,
            TabileUnit         AS TabileUnit,
            tax_id             AS TaxId
        FROM ArticleUnit
        ORDER BY Name";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<UnitListDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }
}