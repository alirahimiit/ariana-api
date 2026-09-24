using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Tafzili;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class TafziliRepository : ITafziliRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<TafziliRepository> _logger;

    public TafziliRepository(
        ITenantConnectionFactory factory,
        ILogger<TafziliRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════
    //  لیست گروه‌های تفضیلی (برای dropdown فیلتر)
    // ═══════════════════════════════════════════
    public async Task<IEnumerable<TafziliGroupDto>> GetGroupsAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                ID      AS Id,
                Name    AS Name
            FROM TafziliGroup
            ORDER BY Name";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<TafziliGroupDto>(
            new CommandDefinition(sql, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════
    //  لیست تفضیلی‌ها
    // ═══════════════════════════════════════════
    public async Task<TafziliListResultDto> GetListAsync(
    long orgId, long fyId, TafziliRequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE H.Code_Col = -1 ");
        var p = new DynamicParameters();

        // ─── فیلترهای ساده (روی Hesab) ───
        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            sb.Append(" AND CAST(H.Code_Tafzil AS VARCHAR(50)) LIKE @code ");
            p.Add("code", "%" + req.Code + "%");
        }

        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            sb.Append(" AND H.Name LIKE @name ");
            p.Add("name", "%" + req.Name + "%");
        }

        if (req.TafziliGroupId is > 0)
        {
            sb.Append(" AND H.TafziliGroupCode = @tafziliGroupId ");
            p.Add("tafziliGroupId", req.TafziliGroupId.Value);
        }

        if (req.Kind.HasValue)
        {
            sb.Append(" AND ISNULL(CAST(H.Kind AS INT), 0) = @kind ");
            p.Add("kind", req.Kind.Value);
        }

        if (!string.IsNullOrWhiteSpace(req.Phone))
        {
            sb.Append(" AND H.Phone LIKE @phone ");
            p.Add("phone", "%" + req.Phone + "%");
        }

        if (!string.IsNullOrWhiteSpace(req.Mobile))
        {
            sb.Append(" AND H.Mobile LIKE @mobile ");
            p.Add("mobile", "%" + req.Mobile + "%");
        }

        if (!string.IsNullOrWhiteSpace(req.MelliCode))
        {
            sb.Append(" AND H.MelliCode LIKE @melliCode ");
            p.Add("melliCode", "%" + req.MelliCode + "%");
        }

        if (!string.IsNullOrWhiteSpace(req.EconomicCode))
        {
            sb.Append(" AND H.EconomicCode LIKE @economicCode ");
            p.Add("economicCode", "%" + req.EconomicCode + "%");
        }

        if (!string.IsNullOrWhiteSpace(req.Address))
        {
            sb.Append(" AND H.Address LIKE @address ");
            p.Add("address", "%" + req.Address + "%");
        }

        // ⭐ فیلتر مانده — روی مقادیر aggregate از Sanad
        switch ((req.MandehFilter ?? "all").ToLower())
        {
            case "hasmandeh":
                sb.Append(" AND ISNULL(SA.SumBed, 0) <> ISNULL(SA.SumBes, 0) ");
                break;
            case "nomandeh":
                sb.Append(" AND ISNULL(SA.SumBed, 0) = ISNULL(SA.SumBes, 0) ");
                break;
            case "hasbed":
                sb.Append(" AND ISNULL(SA.SumBed, 0) > 0 ");
                break;
            case "hasbes":
                sb.Append(" AND ISNULL(SA.SumBes, 0) > 0 ");
                break;
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;

        // ⭐ Subquery aggregation روی Sanad
        const string sanadAggSql = @"
        SELECT 
            S.Code_Tafzil,
            SUM(ISNULL(S.Mab_Bed, 0)) AS SumBed,
            SUM(ISNULL(S.Mab_Bes, 0)) AS SumBes
        FROM Sanad S
        INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
        WHERE ISNULL(S.Code_Tafzil, 0) > 0
        GROUP BY S.Code_Tafzil";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ⭐ شمارش با همان JOIN ها
        var countSql = $@"
        SELECT COUNT(*) 
        FROM Hesab H
        LEFT JOIN ({sanadAggSql}) SA ON SA.Code_Tafzil = H.Code_Tafzil
        {sb}";

        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
        SELECT * FROM (
            SELECT 
                H.HesabID                       AS Id,
                H.Code_Tafzil                   AS CodeTafzil,
                H.Name                          AS Name,
                H.TafziliGroupCode              AS TafziliGroupId,
                TG.Name                         AS TafziliGroupName,
                ISNULL(CAST(H.Kind AS INT), 0)  AS Kind,
                CASE ISNULL(CAST(H.Kind AS INT), 0)
                    WHEN 0 THEN N'عادی'
                    WHEN 1 THEN N'حقیقی'
                    WHEN 2 THEN N'حقوقی شرکت'
                    WHEN 3 THEN N'حقوقی سازمان'
                    WHEN 4 THEN N'بازاریاب'
                    ELSE N'عادی'
                END                             AS KindName,
                H.Phone                         AS Phone,
                H.Mobile                        AS Mobile,
                H.MelliCode                     AS MelliCode,
                H.EconomicCode                  AS EconomicCode,

                ISNULL(SA.SumBed, 0)            AS SumBed,
                ISNULL(SA.SumBes, 0)            AS SumBes,

                CASE 
                    WHEN ISNULL(SA.SumBed, 0) > ISNULL(SA.SumBes, 0)
                        THEN ISNULL(SA.SumBed, 0) - ISNULL(SA.SumBes, 0)
                    ELSE 0
                END                             AS MabManBed,

                CASE 
                    WHEN ISNULL(SA.SumBes, 0) > ISNULL(SA.SumBed, 0)
                        THEN ISNULL(SA.SumBes, 0) - ISNULL(SA.SumBed, 0)
                    ELSE 0
                END                             AS MabManBes,

                ISNULL(H.Mab_Mandeh, 0)         AS MabMandeh,

                ROW_NUMBER() OVER (ORDER BY H.Code_Tafzil) AS RowNum
            FROM Hesab H
            LEFT JOIN TafziliGroup TG ON TG.ID = H.TafziliGroupCode
            LEFT JOIN ({sanadAggSql}) SA ON SA.Code_Tafzil = H.Code_Tafzil
            {sb}
        ) AS T
        WHERE T.RowNum BETWEEN @startRow AND @endRow
        ORDER BY T.RowNum";

        _logger.LogDebug("Tafzili list SQL:\n{Sql}", sql);

        var items = (await conn.QueryAsync<TafziliListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new TafziliListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }
    // ═══════════════════════════════════════════
    //  جزئیات تفضیلی
    // ═══════════════════════════════════════════
    public async Task<TafziliDetailDto?> GetDetailAsync(
        long orgId, long fyId, long tafziliId, CancellationToken ct = default)
    {
        const string sql = @"
        SELECT 
            H.HesabID                       AS Id,
            H.Code_Tafzil                   AS CodeTafzil,
            H.Name                          AS Name,
            H.Discript                      AS Discript,
            H.TafziliGroupCode              AS TafziliGroupId,
            TG.Name                         AS TafziliGroupName,
            ISNULL(CAST(H.Kind AS INT), 0)  AS Kind,
            CASE ISNULL(CAST(H.Kind AS INT), 0)
                WHEN 0 THEN N'عادی'
                WHEN 1 THEN N'حقیقی'
                WHEN 2 THEN N'حقوقی شرکت'
                WHEN 3 THEN N'حقوقی سازمان'
                WHEN 4 THEN N'بازاریاب'
                ELSE N'عادی'
            END                             AS KindName,
            H.Phone                         AS Phone,
            H.Mobile                        AS Mobile,
            H.Address                       AS Address,
            H.AcountNum                     AS AccountNumber,
            H.JobName                       AS JobName,
            H.MelliCode                     AS MelliCode,
            H.EconomicCode                  AS EconomicCode,
            H.NationalCode                  AS NationalCode,
            H.PostalCode                    AS PostalCode,
            H.StateID                       AS StateId,
            S.Name                          AS StateName,
            H.CityID                        AS CityId,
            C1.Name                         AS CityName1,
            H.CityID2                       AS CityId2,
            C2.Name                         AS CityName2,
            H.Mahiat                        AS Mahiat,
            H.Vaziat                        AS Vaziat,
            H.IsSaleMan                     AS IsSaleMan,
            H.IsStock                       AS IsStock,

            ISNULL(SA.SumBed, 0)            AS SumBed,
            ISNULL(SA.SumBes, 0)            AS SumBes,
            ISNULL(H.Mab_Mandeh, 0)         AS MabMandeh
        FROM Hesab H
        LEFT JOIN TafziliGroup TG ON TG.ID = H.TafziliGroupCode
        LEFT JOIN State S   ON S.ID  = H.StateID
        LEFT JOIN City  C1  ON C1.ID = H.CityID
        LEFT JOIN City  C2  ON C2.ID = H.CityID2
        LEFT JOIN (
            SELECT 
                S.Code_Tafzil,
                SUM(ISNULL(S.Mab_Bed, 0)) AS SumBed,
                SUM(ISNULL(S.Mab_Bes, 0)) AS SumBes
            FROM Sanad S
            INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
            WHERE ISNULL(S.Code_Tafzil, 0) > 0
            GROUP BY S.Code_Tafzil
        ) SA ON SA.Code_Tafzil = H.Code_Tafzil
        WHERE H.Code_Col = -1 AND H.HesabID = @tafziliId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<TafziliDetailDto>(
            new CommandDefinition(sql, new { tafziliId }, cancellationToken: ct));
    }
    // ═══════════════════════════════════════════
    //  ذخیره گروه تفضیلی (جدید یا ویرایش)
    // ═══════════════════════════════════════════
    public async Task<long> SaveGroupAsync(
        long orgId, long fyId, TafziliGroupSaveDto dto, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        if (dto.Id is > 0)
        {
            // ─── ویرایش ───
            const string updSql = @"
                UPDATE TafziliGroup 
                SET Name = @name,
                    Date_Op = @dateOp,
                    Time_Op = @timeOp
                WHERE ID = @id";

            await conn.ExecuteAsync(new CommandDefinition(updSql, new
            {
                id = dto.Id.Value,
                name = dto.Name,
                dateOp = DateTime.Now.ToString("yyyy/MM/dd"),
                timeOp = DateTime.Now.ToString("HH:mm:ss")
            }, cancellationToken: ct));

            return dto.Id.Value;
        }
        else
        {
            // ─── جدید ───
            const string insSql = @"
                INSERT INTO TafziliGroup (Name, Code_Op, Date_Op, Time_Op)
                VALUES (@name, 0, @dateOp, @timeOp);
                SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insSql, new
                {
                    name = dto.Name,
                    dateOp = DateTime.Now.ToString("yyyy/MM/dd"),
                    timeOp = DateTime.Now.ToString("HH:mm:ss")
                }, cancellationToken: ct));

            return newId;
        }
    }

    // ═══════════════════════════════════════════
    //  حذف گروه تفضیلی
    // ═══════════════════════════════════════════
    public async Task<bool> DeleteGroupAsync(
        long orgId, long fyId, long groupId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ⚠️ چک کن تفضیلی‌ای از این گروه استفاده نکنه
        const string checkSql = @"
            SELECT COUNT(*) FROM Hesab 
            WHERE Code_Col = -1 AND TafziliGroupCode = @groupId";

        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(checkSql, new { groupId }, cancellationToken: ct));

        if (count > 0)
            throw new InvalidOperationException(
                $"این گروه در {count} تفضیلی استفاده شده و قابل حذف نیست.");

        const string delSql = "DELETE FROM TafziliGroup WHERE ID = @groupId";

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(delSql, new { groupId }, cancellationToken: ct));

        return affected > 0;
    }

    // ═══════════════════════════════════════════
    //  CREATE — درج تفضیلی جدید (Code_Col = -1)
    // ═══════════════════════════════════════════
    public async Task<TafziliCreateResultDto> CreateAsync(
    long orgId, long fyId, TafziliCreateDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام تفضیلی الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ۱. کد جدید
            var nextCode = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(
                    "SELECT ISNULL(MAX(Code_Tafzil), 0) + 1 FROM Hesab WHERE Code_Col = -1",
                    transaction: tx, cancellationToken: ct));

            // ۲. درج در Hesab
            const string insertSql = @"
            INSERT INTO Hesab 
                (Code_Group, Code_Col, Code_Moein, Code_Tafzil,
                 Name, Discript, Mahiat, Vaziat, Kind,
                 TafziliGroupCode,
                 Phone, Mobile, Address,
                 MelliCode, EconomicCode, NationalCode, PostalCode,
                 AcountNum, JobName,
                 StateID, CityID, CityID2,
                 IsSaleMan, IsStock)
            OUTPUT INSERTED.HesabID
            VALUES
                (0, -1, 0, @nextCode,
                 @name, @discript, @mahiat, @vaziat, @kind,
                 @groupId,
                 @phone, @mobile, @address,
                 @melliCode, @economicCode, @nationalCode, @postalCode,
                 @accountNumber, @jobName,
                 @stateId, @cityId, @cityId2,
                 @isSaleMan, @isStock)";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertSql, new
                {
                    nextCode,
                    name = dto.Name,
                    discript = dto.Discript ?? "",
                    mahiat = dto.Mahiat ?? 2,
                    vaziat = dto.Vaziat ?? 1,
                    kind = (dto.Kind ?? 0).ToString(),   // ⭐ varchar
                    groupId = dto.TafziliGroupId ?? 0,
                    phone = dto.Phone ?? "",
                    mobile = dto.Mobile ?? "",
                    address = dto.Address ?? "",
                    melliCode = dto.MelliCode ?? "",
                    economicCode = dto.EconomicCode ?? "",
                    nationalCode = dto.NationalCode ?? "",
                    postalCode = dto.PostalCode ?? "",
                    accountNumber = dto.AccountNumber ?? "",
                    jobName = dto.JobName ?? "",
                    stateId = dto.StateId ?? 0,
                    cityId = dto.CityId ?? 0,
                    cityId2 = dto.CityId2 ?? 0,
                    isSaleMan = dto.IsSaleMan == true ? 1 : 0,   // ⭐ tinyint
                    isStock = dto.IsStock == true ? 1 : 0
                }, transaction: tx, cancellationToken: ct));

            tx.Commit();

            return new TafziliCreateResultDto
            {
                Id = newId,
                CodeTafzil = nextCode
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════
    //  UPDATE
    // ═══════════════════════════════════════════
    public async Task UpdateAsync(
    long orgId, long fyId, TafziliUpdateDto dto, CancellationToken ct = default)
    {
        if (dto.Id <= 0)
            throw new InvalidOperationException("شناسه تفضیلی نامعتبر است");

        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("نام تفضیلی الزامی است");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        const string sql = @"
        UPDATE Hesab SET
            Name = @name,
            Discript = @discript,
            Mahiat = @mahiat,
            Vaziat = @vaziat,
            Kind = @kind,
            TafziliGroupCode = @groupId,
            Phone = @phone,
            Mobile = @mobile,
            Address = @address,
            MelliCode = @melliCode,
            EconomicCode = @economicCode,
            NationalCode = @nationalCode,
            PostalCode = @postalCode,
            AcountNum = @accountNumber,
            JobName = @jobName,
            StateID = @stateId,
            CityID = @cityId,
            CityID2 = @cityId2,
            IsSaleMan = @isSaleMan,
            IsStock = @isStock
        WHERE HesabID = @id AND Code_Col = -1";

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                id = dto.Id,
                name = dto.Name,
                discript = dto.Discript ?? "",
                mahiat = dto.Mahiat ?? 2,
                vaziat = dto.Vaziat ?? 1,
                kind = (dto.Kind ?? 0).ToString(),   // ⭐ varchar
                groupId = dto.TafziliGroupId ?? 0,
                phone = dto.Phone ?? "",
                mobile = dto.Mobile ?? "",
                address = dto.Address ?? "",
                melliCode = dto.MelliCode ?? "",
                economicCode = dto.EconomicCode ?? "",
                nationalCode = dto.NationalCode ?? "",
                postalCode = dto.PostalCode ?? "",
                accountNumber = dto.AccountNumber ?? "",
                jobName = dto.JobName ?? "",
                stateId = dto.StateId ?? 0,
                cityId = dto.CityId ?? 0,
                cityId2 = dto.CityId2 ?? 0,
                isSaleMan = dto.IsSaleMan == true ? 1 : 0,
                isStock = dto.IsStock == true ? 1 : 0
            }, cancellationToken: ct));

        if (affected == 0)
            throw new InvalidOperationException("تفضیلی یافت نشد");
    }

    // ═══════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════
    public async Task DeleteAsync(
        long orgId, long fyId, long tafziliId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ۱. کد تفضیلی رو بگیر
            var codeTafzil = await conn.ExecuteScalarAsync<int?>(
                new CommandDefinition(
                    "SELECT Code_Tafzil FROM Hesab WHERE HesabID = @id AND Code_Col = -1",
                    new { id = tafziliId }, transaction: tx, cancellationToken: ct));

            if (codeTafzil == null)
                throw new InvalidOperationException("تفضیلی یافت نشد");

            // ۲. چک کن در اسناد استفاده نشده
            var usedInSanad = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM Sanad WHERE Code_Tafzil = @code",
                    new { code = codeTafzil.Value }, transaction: tx, cancellationToken: ct));

            if (usedInSanad > 0)
                throw new InvalidOperationException(
                    "این تفضیلی در اسناد استفاده شده و قابل حذف نیست");

            // ۳. حذف از Hesab
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Hesab WHERE HesabID = @id AND Code_Col = -1",
                new { id = tafziliId }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
}