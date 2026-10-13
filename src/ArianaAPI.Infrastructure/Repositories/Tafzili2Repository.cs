using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Tafzili2;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class Tafzili2Repository : ITafzili2Repository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<Tafzili2Repository> _logger;

    public Tafzili2Repository(
        ITenantConnectionFactory factory,
        ILogger<Tafzili2Repository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════
    //  Sort Map (با tie-breaker)
    // ═══════════════════════════════════════════
    private static (string inner, string outer) BuildSortMap(string? col, string? dir)
    {
        var dirSql = (dir ?? "asc").ToLower() == "desc" ? "DESC" : "ASC";
        var key = (col ?? "code").ToLower();
        

        return key switch
        {
            "code" => ($"T2.Code {dirSql}", $"T.Code {dirSql}"),
            "name" => ($"T2.Name {dirSql}, T2.Code ASC", $"T.Name {dirSql}, T.Code ASC"),
            "tafziligroupname" => ($"TG.Name {dirSql}, T2.Code ASC", $"T.TafziliGroupName {dirSql}, T.Code ASC"),
            "mobile" => ($"T2.Mobile {dirSql}, T2.Code ASC", $"T.Mobile {dirSql}, T.Code ASC"),
            "mellicode" => ($"T2.MelliCode {dirSql}, T2.Code ASC", $"T.MelliCode {dirSql}, T.Code ASC"),
            "economiccode" => ($"T2.EconomicCode {dirSql}, T2.Code ASC", $"T.EconomicCode {dirSql}, T.Code ASC"),
            _ => ($"T2.Code {dirSql}", $"T.Code {dirSql}")
        };
    }

    // ═══════════════════════════════════════════
    //  List
    // ═══════════════════════════════════════════
    public async Task<Tafzili2ListResultDto> GetListAsync(
        long orgId, long fyId, Tafzili2RequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            sb.Append(" AND CAST(T2.Code AS VARCHAR(50)) LIKE @code ");
            p.Add("code", "%" + req.Code + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            sb.Append(" AND T2.Name LIKE @name ");
            p.Add("name", "%" + req.Name + "%");
        }
        if (req.TafziliGroupCode is > 0)
        {
            sb.Append(" AND T2.TafziliGroupCode = @groupId ");
            p.Add("groupId", req.TafziliGroupCode.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.Phone))
        {
            sb.Append(" AND T2.Phone LIKE @phone ");
            p.Add("phone", "%" + req.Phone + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.Mobile))
        {
            sb.Append(" AND T2.Mobile LIKE @mobile ");
            p.Add("mobile", "%" + req.Mobile + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.MelliCode))
        {
            sb.Append(" AND T2.MelliCode LIKE @melliCode ");
            p.Add("melliCode", "%" + req.MelliCode + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.EconomicCode))
        {
            sb.Append(" AND T2.EconomicCode LIKE @economicCode ");
            p.Add("economicCode", "%" + req.EconomicCode + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.Address))
        {
            sb.Append(" AND T2.Address LIKE @address ");
            p.Add("address", "%" + req.Address + "%");
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;
        var (orderInner, orderOuter) = BuildSortMap(req.SortColumn, req.SortDir);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var countSql = $@"SELECT COUNT(*) FROM Tafzili2 T2 {sb}";

        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
        SELECT * FROM (
            SELECT
                CAST(T2.ID AS BIGINT)              AS Id,
                T2.Code                            AS Code,
                T2.Name                            AS Name,
                CAST(T2.TafziliGroupCode AS BIGINT) AS TafziliGroupCode,
                TG.Name                            AS TafziliGroupName,
                T2.Phone                           AS Phone,
                T2.Mobile                          AS Mobile,
                T2.MelliCode                       AS MelliCode,
                T2.EconomicCode                    AS EconomicCode,
                CAST(T2.IsSaleMan AS BIT)          AS IsSaleMan,
                CAST(T2.IsStock   AS BIT)          AS IsStock,
                T2.CreatorName2                    AS CreatorName,
                T2.CreatorDate2                    AS CreatorDate,
                T2.UpdaterName2                    AS UpdaterName,
                T2.UpdaterDate2                    AS UpdaterDate,
                ROW_NUMBER() OVER (ORDER BY {orderInner}) AS RowNum
            FROM Tafzili2 T2
            LEFT JOIN TafziliGroup TG ON TG.ID = T2.TafziliGroupCode
            {sb}
        ) AS T
        WHERE T.RowNum BETWEEN @startRow AND @endRow
        ORDER BY {orderOuter}";

        _logger.LogDebug("Tafzili2 list SQL:\n{Sql}", sql);

        var items = (await conn.QueryAsync<Tafzili2ListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new Tafzili2ListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    // ═══════════════════════════════════════════
    //  Detail
    // ═══════════════════════════════════════════
    public async Task<Tafzili2DetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT
            CAST(T2.ID AS BIGINT)               AS Id,
            T2.Code                             AS Code,
            T2.Name                             AS Name,
            CAST(T2.TafziliGroupCode AS BIGINT) AS TafziliGroupCode,
            TG.Name                             AS TafziliGroupName,
            T2.Phone                            AS Phone,
            T2.Mobile                           AS Mobile,
            T2.Address                          AS Address,
            T2.PostalCode                       AS PostalCode,
            T2.StateID                          AS StateId,
            S.Name                              AS StateName,
            T2.CityID                           AS CityId,
            C1.Name                             AS CityName1,
            T2.CityID2                          AS CityId2,
            C2.Name                             AS CityName2,
            T2.MelliCode                        AS MelliCode,
            T2.EconomicCode                     AS EconomicCode,
            T2.NationalCode                     AS NationalCode,
            CAST(T2.IsSaleMan    AS BIT)        AS IsSaleMan,
            CAST(T2.IsStock      AS BIT)        AS IsStock,
            CAST(T2.HasTafzili2  AS BIT)        AS HasTafzili2,
            T2.CreatorName2                     AS CreatorName,
            T2.CreatorDate2                     AS CreatorDate,
            T2.UpdaterName2                     AS UpdaterName,
            T2.UpdaterDate2                     AS UpdaterDate
        FROM Tafzili2 T2
        LEFT JOIN TafziliGroup TG ON TG.ID = T2.TafziliGroupCode
        LEFT JOIN State S  ON S.ID  = T2.StateID
        LEFT JOIN City  C1 ON C1.ID = T2.CityID
        LEFT JOIN City  C2 ON C2.ID = T2.CityID2
        WHERE T2.ID = @id";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<Tafzili2DetailDto>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════
    //  Next Code
    // ═══════════════════════════════════════════
    public async Task<long> GetNextCodeAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = "SELECT ISNULL(MAX(Code), 0) + 1 FROM Tafzili2";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════
    //  Is Code Exists
    // ═══════════════════════════════════════════
    public async Task<bool> IsCodeExistsAsync(
        long orgId, long fyId, long code, long? excludeId = null,
        CancellationToken ct = default)
    {
        var sql = "SELECT COUNT(*) FROM Tafzili2 WHERE Code = @code";
        var p = new DynamicParameters();
        p.Add("code", code);

        if (excludeId is > 0)
        {
            sql += " AND ID <> @excludeId";
            p.Add("excludeId", excludeId.Value);
        }

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, p, cancellationToken: ct));
        return count > 0;
    }

    // ═══════════════════════════════════════════
    //  Create
    // ═══════════════════════════════════════════
    public async Task<Tafzili2CreateResultDto> CreateAsync(
        long orgId, long fyId, Tafzili2CreateDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام تفضیلی ۲ الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ۱. کد
            long nextCode;
            if (dto.Code is > 0)
            {
                var exists = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        "SELECT COUNT(*) FROM Tafzili2 WHERE Code = @code",
                        new { code = dto.Code.Value },
                        transaction: tx, cancellationToken: ct));

                if (exists > 0)
                    throw new InvalidOperationException(
                        $"کد «{dto.Code.Value}» قبلاً استفاده شده است");

                nextCode = dto.Code.Value;
            }
            else
            {
                nextCode = await conn.ExecuteScalarAsync<long>(
                    new CommandDefinition(
                        "SELECT ISNULL(MAX(Code), 0) + 1 FROM Tafzili2",
                        transaction: tx, cancellationToken: ct));
            }

            // ۲. Insert
            const string insertSql = @"
            INSERT INTO Tafzili2
                (Name, Code, StateID, TafziliGroupCode,
                 Phone, Mobile, Address,
                 IsSaleMan, CityID, CityID2,
                 MelliCode, NationalCode, EconomicCode, PostalCode,
                 IsStock, HasTafzili2,
                 CreatorName2, CreatorDate2)
            OUTPUT INSERTED.ID
            VALUES
                (@name, @code, @stateId, @groupId,
                 @phone, @mobile, @address,
                 @isSaleMan, @cityId, @cityId2,
                 @melliCode, @nationalCode, @economicCode, @postalCode,
                 @isStock, @hasTafzili2,
                 @creatorName, GETDATE())";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertSql, new
                {
                    name = dto.Name,
                    code = nextCode,
                    stateId = dto.StateId ?? 0,
                    groupId = dto.TafziliGroupCode ?? 0,
                    phone = dto.Phone ?? "",
                    mobile = dto.Mobile ?? "",
                    address = dto.Address ?? "",
                    isSaleMan = dto.IsSaleMan == true ? 1 : 0,
                    cityId = dto.CityId ?? 0,
                    cityId2 = dto.CityId2 ?? 0,
                    melliCode = dto.MelliCode ?? "",
                    nationalCode = dto.NationalCode ?? "",
                    economicCode = dto.EconomicCode ?? "",
                    postalCode = dto.PostalCode ?? "",
                    isStock = dto.IsStock == true ? 1 : 0,
                    hasTafzili2 = dto.HasTafzili2 == true ? 1 : 0,
                    creatorName = userCode.ToString()
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();

            return new Tafzili2CreateResultDto
            {
                Id = newId,
                Code = nextCode
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════
    //  Update
    // ═══════════════════════════════════════════
    public async Task UpdateAsync(
        long orgId, long fyId, Tafzili2UpdateDto dto, long userCode,
        CancellationToken ct = default)
    {
        if (dto.Id <= 0)
            throw new InvalidOperationException("شناسه تفضیلی ۲ نامعتبر است");

        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام تفضیلی ۲ الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        // ⭐ چک تکراری کد
        if (dto.Code is > 0)
        {
            var exists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Tafzili2 WHERE Code = @code AND ID <> @id",
                    new { code = dto.Code.Value, id = dto.Id },
                    cancellationToken: ct));

            if (exists > 0)
                throw new InvalidOperationException(
                    $"کد «{dto.Code.Value}» قبلاً استفاده شده است");
        }

        const string sql = @"
        UPDATE Tafzili2 SET
            Code = ISNULL(@code, Code),
            Name = @name,
            StateID = @stateId,
            TafziliGroupCode = @groupId,
            Phone = @phone,
            Mobile = @mobile,
            Address = @address,
            IsSaleMan = @isSaleMan,
            CityID = @cityId,
            CityID2 = @cityId2,
            MelliCode = @melliCode,
            NationalCode = @nationalCode,
            EconomicCode = @economicCode,
            PostalCode = @postalCode,
            IsStock = @isStock,
            HasTafzili2 = @hasTafzili2,
            UpdaterName2 = @updaterName,
            UpdaterDate2 = GETDATE()
        WHERE ID = @id";

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                id = dto.Id,
                code = dto.Code,
                name = dto.Name,
                stateId = dto.StateId ?? 0,
                groupId = dto.TafziliGroupCode ?? 0,
                phone = dto.Phone ?? "",
                mobile = dto.Mobile ?? "",
                address = dto.Address ?? "",
                isSaleMan = dto.IsSaleMan == true ? 1 : 0,
                cityId = dto.CityId ?? 0,
                cityId2 = dto.CityId2 ?? 0,
                melliCode = dto.MelliCode ?? "",
                nationalCode = dto.NationalCode ?? "",
                economicCode = dto.EconomicCode ?? "",
                postalCode = dto.PostalCode ?? "",
                isStock = dto.IsStock == true ? 1 : 0,
                hasTafzili2 = dto.HasTafzili2 == true ? 1 : 0,
                updaterName = userCode.ToString()
            }, cancellationToken: ct));

        if (affected == 0)
            throw new InvalidOperationException("تفضیلی ۲ یافت نشد");
    }

    // ═══════════════════════════════════════════
    //  Delete
    // ═══════════════════════════════════════════
    public async Task DeleteAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        // چک استفاده در اسناد
        var code = await conn.ExecuteScalarAsync<decimal?>(
            new CommandDefinition(
                "SELECT Code FROM Tafzili2 WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (code == null)
            throw new InvalidOperationException("تفضیلی ۲ یافت نشد");

        var usedInSanad = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM Sanad WHERE Code_Tafzili2 = @code",
                new { code = code.Value }, cancellationToken: ct));

        if (usedInSanad > 0)
            throw new InvalidOperationException(
                "این تفضیلی ۲ در اسناد استفاده شده و قابل حذف نیست");

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Tafzili2 WHERE ID = @id",
            new { id }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════
    //  Usage
    // ═══════════════════════════════════════════
    public async Task<Tafzili2UsageDto> GetUsageAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);

        var code = await conn.ExecuteScalarAsync<decimal?>(
            new CommandDefinition(
                "SELECT Code FROM Tafzili2 WHERE ID = @id",
                new { id }, cancellationToken: ct));

        if (code == null)
        {
            return new Tafzili2UsageDto
            {
                CanDelete = false,
                Reason = "تفضیلی ۲ یافت نشد"
            };
        }

        var sanadCount = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM Sanad WHERE Code_Tafzili2 = @code",
                new { code = code.Value }, cancellationToken: ct));

        return new Tafzili2UsageDto
        {
            CanDelete = sanadCount == 0,
            SanadCount = sanadCount,
            Reason = sanadCount > 0
                ? $"در {sanadCount} سند استفاده شده"
                : null
        };
    }
}