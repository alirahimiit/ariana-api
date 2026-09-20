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

        // ─── کد تفضیلی ───
        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            sb.Append(" AND CAST(H.Code_Tafzil AS VARCHAR(50)) LIKE @code ");
            p.Add("code", "%" + req.Code + "%");
        }

        // ─── نام ───
        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            sb.Append(" AND H.Name LIKE @name ");
            p.Add("name", "%" + req.Name + "%");
        }

        // ─── گروه تفضیلی (نکته‌ی مهم) ───
        if (req.TafziliGroupId is > 0)
        {
            sb.Append(" AND H.TafziliGroupCode = @tafziliGroupId ");
            p.Add("tafziliGroupId", req.TafziliGroupId.Value);
        }

        // ─── نوع ───
        if (req.Kind.HasValue)
        {
            sb.Append(" AND H.Kind = @kind ");
            p.Add("kind", req.Kind.Value);
        }

        // ─── تلفن ───
        if (!string.IsNullOrWhiteSpace(req.Phone))
        {
            sb.Append(" AND H.Phone LIKE @phone ");
            p.Add("phone", "%" + req.Phone + "%");
        }

        // ─── موبایل ───
        if (!string.IsNullOrWhiteSpace(req.Mobile))
        {
            sb.Append(" AND H.Mobile LIKE @mobile ");
            p.Add("mobile", "%" + req.Mobile + "%");
        }

        // ─── کد ملی ───
        if (!string.IsNullOrWhiteSpace(req.MelliCode))
        {
            sb.Append(" AND H.MelliCode LIKE @melliCode ");
            p.Add("melliCode", "%" + req.MelliCode + "%");
        }

        // ─── کد اقتصادی ───
        if (!string.IsNullOrWhiteSpace(req.EconomicCode))
        {
            sb.Append(" AND H.EconomicCode LIKE @economicCode ");
            p.Add("economicCode", "%" + req.EconomicCode + "%");
        }

        // ─── آدرس ───
        if (!string.IsNullOrWhiteSpace(req.Address))
        {
            sb.Append(" AND H.Address LIKE @address ");
            p.Add("address", "%" + req.Address + "%");
        }

        // ─── فیلتر مانده ───
        switch ((req.MandehFilter ?? "all").ToLower())
        {
            case "hasmandeh":
                sb.Append(" AND ISNULL(H.Mab_Mandeh, 0) <> 0 ");
                break;
            case "nomandeh":
                sb.Append(" AND ISNULL(H.Mab_Mandeh, 0) = 0 ");
                break;
            case "hasbed":
                sb.Append(" AND ISNULL(H.Sum_Bed, 0) > 0 ");
                break;
            case "hasbes":
                sb.Append(" AND ISNULL(H.Sum_Bes, 0) > 0 ");
                break;
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;

        _logger.LogDebug("Tafzili list - where: {Where}", sb.ToString());

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ⭐ اول شمارش
        var countSql = $@"SELECT COUNT(*) FROM Hesab H {sb}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        // ⭐ پارامترهای صفحه
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
            SELECT * FROM (
                SELECT 
                    H.HesabID               AS Id,
                    H.Code_Tafzil           AS CodeTafzil,
                    H.Name                  AS Name,
                    H.TafziliGroupCode      AS TafziliGroupId,
                    TG.Name                 AS TafziliGroupName,
                    H.Kind                  AS Kind,
                    CASE H.Kind 
                        WHEN 0 THEN N'عادی'
                        WHEN 1 THEN N'حقیقی'
                        WHEN 2 THEN N'حقوقی شرکت'
                        WHEN 3 THEN N'حقوقی سازمان'
                        WHEN 4 THEN N'بازاریاب'
                        ELSE N'عادی'
                    END                     AS KindName,
                    H.Phone                 AS Phone,
                    H.Mobile                AS Mobile,
                    H.MelliCode             AS MelliCode,
                    H.EconomicCode          AS EconomicCode,
                    ISNULL(H.Sum_Bed, 0)    AS SumBed,
                    ISNULL(H.Sum_Bes, 0)    AS SumBes,
                    ISNULL(H.Mab_Mandeh, 0) AS MabMandeh,
                    ROW_NUMBER() OVER (ORDER BY H.Code_Tafzil) AS RowNum
                FROM Hesab H
                LEFT JOIN TafziliGroup TG ON TG.ID = H.TafziliGroupCode
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
                H.HesabID               AS Id,
                H.Code_Tafzil           AS CodeTafzil,
                H.Name                  AS Name,
                H.Discript              AS Discript,
                H.TafziliGroupCode      AS TafziliGroupId,
                TG.Name                 AS TafziliGroupName,
                H.Kind                  AS Kind,
                CASE H.Kind 
                    WHEN 0 THEN N'عادی'
                    WHEN 1 THEN N'حقیقی'
                    WHEN 2 THEN N'حقوقی شرکت'
                    WHEN 3 THEN N'حقوقی سازمان'
                    WHEN 4 THEN N'بازاریاب'
                    ELSE N'عادی'
                END                     AS KindName,
                H.Phone                 AS Phone,
                H.Mobile                AS Mobile,
                H.Address               AS Address,
                H.AcountNum             AS AccountNumber,
                H.JobName               AS JobName,
                H.MelliCode             AS MelliCode,
                H.EconomicCode          AS EconomicCode,
                H.NationalCode          AS NationalCode,
                H.PostalCode            AS PostalCode,
                H.StateID               AS StateId,
                S.Name                  AS StateName,
                H.CityID                AS CityId,
                C1.Name                 AS CityName1,
                H.CityID2               AS CityId2,
                C2.Name                 AS CityName2,
                H.Mahiat                AS Mahiat,
                H.Vaziat                AS Vaziat,
                H.IsSaleMan             AS IsSaleMan,
                H.IsStock               AS IsStock,
                ISNULL(H.Sum_Bed, 0)    AS SumBed,
                ISNULL(H.Sum_Bes, 0)    AS SumBes,
                ISNULL(H.Mab_Mandeh, 0) AS MabMandeh
            FROM Hesab H
            LEFT JOIN TafziliGroup TG ON TG.ID = H.TafziliGroupCode
            LEFT JOIN State S   ON S.ID  = H.StateID
            LEFT JOIN City  C1  ON C1.ID = H.CityID
            LEFT JOIN City  C2  ON C2.ID = H.CityID2
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
}