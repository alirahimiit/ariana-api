using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Inventory;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class InventoryRepository : IInventoryRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<InventoryRepository> _logger;

    public InventoryRepository(ITenantConnectionFactory factory, ILogger<InventoryRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════
    //  Stages (مراحل)
    // ═══════════════════════════════════════════════════
    public async Task<List<InventoryStageDto>> GetStagesAsync(
        long orgId, long fyId, long? stockTypeId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var sql = @"
            SELECT ID as Id, StockTypeID as StockTypeId, StageNo, StageName, 
                   StartDate, EndDate, IsActive, IsClosed
            FROM InventoryStage 
            WHERE 1=1 ";

        if (stockTypeId is > 0)
            sql += " AND StockTypeID = @stockTypeId ";

        sql += " ORDER BY StageNo";

        return (await conn.QueryAsync<InventoryStageDto>(
            new CommandDefinition(sql, new { stockTypeId }, cancellationToken: ct))).ToList();
    }

    public async Task<long> CreateStageAsync(
        long orgId, long fyId, InventoryStageWriteDto dto, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var dup = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM InventoryStage WHERE StockTypeID = @s AND StageNo = @n",
            new { s = dto.StockTypeId, n = dto.StageNo }, cancellationToken: ct));

        if (dup > 0) throw new InvalidOperationException("این شماره مرحله قبلاً ثبت شده است.");

        const string sql = @"
            INSERT INTO InventoryStage (StockTypeID, StageNo, StageName, StartDate, IsActive, IsClosed)
            VALUES (@StockTypeId, @StageNo, @StageName, @StartDate, @IsActive, 0);
            SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(sql, dto, cancellationToken: ct));
    }

    public async Task UpdateStageAsync(
        long orgId, long fyId, long id, InventoryStageWriteDto dto, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        const string sql = @"
            UPDATE InventoryStage 
            SET StageName = @StageName, StartDate = @StartDate, IsActive = @IsActive
            WHERE ID = @id";

        await conn.ExecuteAsync(new CommandDefinition(sql,
            new { id, dto.StageName, dto.StartDate, dto.IsActive }, cancellationToken: ct));
    }

    public async Task DeleteStageAsync(long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var hasTags = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM InventoryTagHeader WHERE StageNo = (SELECT StageNo FROM InventoryStage WHERE ID = @id) AND StockTypeID = (SELECT StockTypeID FROM InventoryStage WHERE ID = @id)",
            new { id }, cancellationToken: ct));

        if (hasTags > 0) throw new InvalidOperationException("این مرحله دارای تگ ثبت شده است و قابل حذف نیست.");

        await conn.ExecuteAsync(new CommandDefinition("DELETE FROM InventoryStage WHERE ID = @id", new { id }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════
    //  Tags (تگ‌ها)
    // ═══════════════════════════════════════════════════
    public async Task<InventoryTagListResultDto> GetTagsAsync(
        long orgId, long fyId, InventoryTagRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var where = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (req.StockTypeId is > 0) { where.Append(" AND TH.StockTypeID = @sid "); p.Add("sid", req.StockTypeId); }
        if (req.StageNo is > 0) { where.Append(" AND TH.StageNo = @stage "); p.Add("stage", req.StageNo); }
        if (req.TagStatus.HasValue) { where.Append(" AND TH.TagStatus = @status "); p.Add("status", req.TagStatus); }
        if (!string.IsNullOrWhiteSpace(req.TagNo)) { where.Append(" AND TH.TagNo LIKE @tagNo + '%' "); p.Add("tagNo", req.TagNo); }

        var countSql = $@"
            SELECT COUNT(*) 
            FROM InventoryTagHeader TH
            {where}";
        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition(countSql, p, cancellationToken: ct));

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;

        var offset = (req.Page - 1) * req.PageSize;
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        // استفاده از ROW_NUMBER برای سازگاری با SQL Server 2008 R2
        var sql = $@"
            SELECT * FROM (
                SELECT TH.ID as Id, TH.TagNo, TH.StockTypeID as StockTypeId, ST.Name as StockName, 
                       TH.StageNo, ISNULL(TH.LocationCode, '') as LocationCode,
                       TH.TagDate, TH.TagStatus,
                       CASE TH.TagStatus 
                           WHEN 0 THEN N'چاپ شده' 
                           WHEN 1 THEN N'در حال شمارش' 
                           WHEN 2 THEN N'تکمیل شده' 
                           WHEN 3 THEN N'سند صادر شده' 
                           ELSE N'نامشخص' 
                       END as StatusName,
                       (SELECT COUNT(*) FROM InventoryTagDetail TD WHERE TD.TagID = TH.ID) as TotalItems,
                       (SELECT COUNT(*) FROM InventoryTagDetail TD WHERE TD.TagID = TH.ID AND TD.CountedQty IS NOT NULL) as CountedItems,
                       (SELECT ISNULL(SUM(DiffQty), 0) FROM InventoryTagDetail TD WHERE TD.TagID = TH.ID) as TotalDifference,
                       ISNULL((SELECT COUNT(*) FROM InventoryTagDetail TD WHERE TD.TagID = TH.ID AND TD.CountedQty IS NOT NULL) * 100 / NULLIF((SELECT COUNT(*) FROM InventoryTagDetail TD WHERE TD.TagID = TH.ID), 0), 0) as ProgressPercent,
                       
                       -- ⭐ استخراج شماره سندهای مرتبط (سازگار با SQL 2008)
                       STUFF((
                           SELECT ', ' + CAST(P.No_Sanad AS VARCHAR(20)) 
                           FROM Stock_Factor SF 
                           INNER JOIN ParentSanad P ON P.ParentSanadID = SF.Parent_Sanad_ID 
                           WHERE SF.InventoryTagID = TH.ID 
                           FOR XML PATH('')
                       ), 1, 2, '') as SanadFullInfo,

                       ROW_NUMBER() OVER (ORDER BY TH.TagDate DESC, TH.TagNo DESC) AS RN
                FROM InventoryTagHeader TH
                LEFT JOIN StockType ST ON ST.ID = TH.StockTypeID
                {where}
            ) AS Base
            WHERE Base.RN BETWEEN @startRow AND @endRow
            ORDER BY Base.RN";

        var items = (await conn.QueryAsync<InventoryTagListDto>(new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        return new InventoryTagListResultDto
        {
            Items = items,
            TotalCount = total,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalPages = (int)Math.Ceiling(total / (double)req.PageSize)
        };
    }

    public async Task<InventoryTagDetailDto?> GetTagDetailAsync(
        long orgId, long fyId, long tagId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var header = await conn.QueryFirstOrDefaultAsync<InventoryTagDetailDto>(
            new CommandDefinition(@"
                SELECT TH.ID as Id, TH.TagNo, TH.StockTypeID as StockTypeId, ST.Name as StockName, 
                       TH.StageNo, TH.TagDate, TH.TagStatus, TH.LocationCode, TH.Notes
                FROM InventoryTagHeader TH
                LEFT JOIN StockType ST ON ST.ID = TH.StockTypeID
                WHERE TH.ID = @tagId", new { tagId }, cancellationToken: ct));

        if (header is null) return null;

        header.Items = (await conn.QueryAsync<InventoryTagItemDto>(
            new CommandDefinition(@"
                SELECT TD.ID as Id, TD.ArticleID as ArticleId, CAST(AN.Code AS NVARCHAR(50)) as ArticleCode, 
                       AN.Name as ArticleName, ISNULL(AU.Name, '') as UnitName, 
                       TD.SystemQty, TD.CountedQty, TD.ScrapQty, TD.DiffQty, TD.Notes
                FROM InventoryTagDetail TD
                INNER JOIN ArticleNew AN ON AN.ID = TD.ArticleID
                LEFT JOIN ArticleUnit AU ON AU.ID = AN.ArticleUnitID
                WHERE TD.TagID = @tagId
                ORDER BY AN.Code", new { tagId }, cancellationToken: ct))).ToList();

        return header;
    }
    public async Task<long> CreateTagAsync(
        long orgId, long fyId, InventoryCreateTagDto dto, long userId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        using var tx = conn.BeginTransaction();

        try
        {
            var tagNo = dto.TagNo;
            if (string.IsNullOrWhiteSpace(tagNo))
                tagNo = await GetNextTagNoInternalAsync(conn, tx, dto.StockTypeId, dto.StageNo, ct);

            const string insHeader = @"
                INSERT INTO InventoryTagHeader (TagNo, StockTypeID, StageNo, TagDate, TagStatus, LocationCode, CreateUserID, CreateDate, Notes)
                VALUES (@tagNo, @stockId, @stageNo, @date, 0, @loc, @userId, @date, @notes);
                SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

            var tagId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(insHeader, new
            {
                tagNo,
                stockId = dto.StockTypeId,
                stageNo = dto.StageNo,
                date = dto.TagDate,
                loc = dto.LocationCode ?? "",
                userId,
                notes = dto.Notes ?? ""
            }, tx, cancellationToken: ct));

            const string insDetail = @"
                INSERT INTO InventoryTagDetail (TagID, ArticleID, SystemQty, Notes)
                VALUES (@tagId, @articleId, @sysQty, 'ایجاد شده از وب');";

            foreach (var articleId in dto.ArticleIds)
            {
                var sysQty = await conn.ExecuteScalarAsync<double?>(
                    new CommandDefinition("SELECT dbo.fn_GetArticleStock(@articleId, @stockId)",
                    new { articleId, stockId = dto.StockTypeId }, tx, cancellationToken: ct)) ?? 0;

                await conn.ExecuteAsync(new CommandDefinition(insDetail, new { tagId, articleId, sysQty }, tx, cancellationToken: ct));
            }

            tx.Commit();
            return tagId;
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public async Task SaveCountAsync(
        long orgId, long fyId, long tagId, InventoryCountRequestDto dto, long userId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        const string sql = @"
            UPDATE InventoryTagDetail 
            SET CountedQty = @counted, ScrapQty = @scrap, 
                DiffQty = (@counted - @scrap) - SystemQty,
                CounterUserID = @userId, CountDate = @date, CountTime = @time
            WHERE ID = @detailId AND TagID = @tagId;

            UPDATE InventoryTagHeader SET TagStatus = 1 WHERE ID = @tagId AND TagStatus = 0;";

        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            detailId = dto.TagDetailId,
            tagId,
            counted = dto.CountedQty,
            scrap = dto.ScrapQty,
            userId,
            date = GetTodayPersian(),
            time = DateTime.Now.ToString("HH:mm:ss")
        }, cancellationToken: ct));
    }

    public async Task ConfirmTagAsync(long orgId, long fyId, long tagId, long userId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var uncounted = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM InventoryTagDetail WHERE TagID = @tagId AND CountedQty IS NULL",
            new { tagId }, cancellationToken: ct));

        if (uncounted > 0) throw new InvalidOperationException($"تعداد {uncounted} قلم کالا هنوز شمارش نشده است.");

        await conn.ExecuteAsync(new CommandDefinition(@"
            UPDATE InventoryTagHeader SET TagStatus = 2, ConfirmUserID = @userId, ConfirmDate = @date
            WHERE ID = @tagId", new { tagId, userId, date = GetTodayPersian() }, cancellationToken: ct));
    }

    public async Task DeleteTagAsync(long orgId, long fyId, long tagId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        using var tx = conn.BeginTransaction();

        try
        {
            // 1. پیدا کردن Stock_Factor های مرتبط
            var factors = (await conn.QueryAsync<long>(
                new CommandDefinition("SELECT ID FROM Stock_Factor WHERE InventoryTagID = @tagId", new { tagId }, tx, cancellationToken: ct))).ToList();

            foreach (var fid in factors)
            {
                // حذف Sanad های مرتبط (قانون ۴)
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Sanad WHERE StockNo = @fid", new { fid }, tx, cancellationToken: ct));

                // چک کردن ParentSanad خالی
                var parentId = await conn.ExecuteScalarAsync<long?>(
                    new CommandDefinition("SELECT Parent_Sanad_ID FROM Stock_Factor WHERE ID = @fid", new { fid }, tx, cancellationToken: ct));

                if (parentId > 0)
                {
                    var remain = await conn.ExecuteScalarAsync<int>(
                        new CommandDefinition("SELECT COUNT(*) FROM Sanad WHERE ParentSanadCode = @pid", new { pid = parentId }, tx, cancellationToken: ct));
                    if (remain == 0)
                        await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ParentSanad WHERE ParentSanadID = @pid", new { pid = parentId }, tx, cancellationToken: ct));
                }

                // حذف جزئیات سند و فاکتور
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Stock_Factor_Mat WHERE StockFacorID = @fid", new { fid }, tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM InventoryToStockFactor WHERE StockFactorID = @fid", new { fid }, tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Stock_Factor WHERE ID = @fid", new { fid }, tx, cancellationToken: ct));
            }

            // 2. حذف خود تگ (Cascade جزئیات را پاک می‌کند)
            await conn.ExecuteAsync(new CommandDefinition("DELETE FROM InventoryTagHeader WHERE ID = @tagId", new { tagId }, tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // ═══════════════════════════════════════════════════
    //  Lookups & Utilities
    // ═══════════════════════════════════════════════════
    public async Task<InventoryLookupsDto> GetLookupsAsync(long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var stocks = (await conn.QueryAsync<InventoryStockLookupDto>(
            new CommandDefinition("SELECT ID as Id, Name FROM StockType ORDER BY Name", cancellationToken: ct))).ToList();

        var stages = (await conn.QueryAsync<InventoryStageLookupDto>(
            new CommandDefinition("SELECT DISTINCT StageNo, StageName FROM InventoryStage WHERE IsActive = 1 ORDER BY StageNo", cancellationToken: ct))).ToList();

        var groups = (await conn.QueryAsync<InventoryGroupLookupDto>(
            new CommandDefinition("SELECT ID as Id, StockTypeID as StockTypeId, Name FROM ArticleGroup ORDER BY Name", cancellationToken: ct))).ToList();

        return new InventoryLookupsDto
        {
            StockTypes = stocks,
            Stages = stages,
            ArticleGroups = groups,
            TodayDate = GetTodayPersian()
        };
    }

    public async Task<double> GetArticleStockAsync(
        long orgId, long fyId, long articleId, long stockTypeId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        return await conn.ExecuteScalarAsync<double?>(
            new CommandDefinition("SELECT dbo.fn_GetArticleStock(@articleId, @stockTypeId)", new { articleId, stockTypeId }, cancellationToken: ct)) ?? 0;
    }

    public async Task<string> GetNextTagNoAsync(
        long orgId, long fyId, long stockTypeId, int stageNo, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        return await GetNextTagNoInternalAsync(conn, null, stockTypeId, stageNo, ct);
    }

    private async Task<string> GetNextTagNoInternalAsync(
        SqlConnection conn, SqlTransaction? tx, long stockTypeId, int stageNo, CancellationToken ct)
    {
        var sql = @"
            SELECT ISNULL(MAX(CAST(SUBSTRING(TagNo, CHARINDEX('-', TagNo) + 1, LEN(TagNo)) AS INT)), 0) + 1
            FROM InventoryTagHeader 
            WHERE StockTypeID = @s AND StageNo = @n";

        var lastNo = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition(sql, new { s = stockTypeId, n = stageNo }, transaction: tx, cancellationToken: ct)) ?? 1;

        return $"TAG-{stockTypeId}-{stageNo}-{lastNo:D4}";
    }

    private static string GetTodayPersian()
    {
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }


    public async Task<List<InventoryDiffReportDto>> GetDiffReportAsync(
        long orgId, long fyId, long? stockTypeId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var where = " WHERE (TD.DiffQty <> 0 OR TD.ScrapQty > 0) ";
        if (stockTypeId is > 0) where += " AND TH.StockTypeID = @sid ";

        var sql = $@"
            SELECT TH.ID as TagHeaderId, TH.TagNo, ST.Name as StockName,
                   CAST(AN.Code AS NVARCHAR(50)) as ArticleCode, AN.Name as ArticleName,
                   ISNULL(AU.Name, '') as UnitName,
                   TD.SystemQty, TD.CountedQty, TD.DiffQty, TD.ScrapQty,
                   ABS(ISNULL(TD.DiffQty, 0)) as AbsDiffQty, TD.Notes
            FROM InventoryTagDetail TD
            INNER JOIN InventoryTagHeader TH ON TH.ID = TD.TagID
            LEFT JOIN StockType ST ON ST.ID = TH.StockTypeID
            INNER JOIN ArticleNew AN ON AN.ID = TD.ArticleID
            LEFT JOIN ArticleUnit AU ON AU.ID = AN.ArticleUnitID
            {where}
            ORDER BY ABS(ISNULL(TD.DiffQty, 0)) DESC";

        return (await conn.QueryAsync<InventoryDiffReportDto>(
            new CommandDefinition(sql, new { sid = stockTypeId }, cancellationToken: ct))).ToList();
    }

    public async Task<List<InventoryHistoryDto>> GetHistoryReportAsync(
        long orgId, long fyId, long? stockTypeId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var where = " WHERE 1=1 ";
        if (stockTypeId is > 0) where += " AND TH.StockTypeID = @sid ";

        // ترکیب تاریخ ایجاد و تاریخ تأیید به عنوان تاریخچه
        var sql = $@"
            SELECT TH.ID as TagHeaderId, TH.TagNo, ST.Name as StockName,
                   CASE 
                       WHEN TH.TagStatus = 3 THEN N'صدور سند'
                       WHEN TH.TagStatus = 2 THEN N'تأیید نهایی'
                       WHEN TH.TagStatus = 1 THEN N'در حال شمارش'
                       ELSE N'ایجاد تگ'
                   END as OperationType,
                   U1.UserName as UserName,
                   TH.ConfirmDate as OperationDate,
                   '' as OperationTime,
                   CASE 
                       WHEN TH.TagStatus = 3 THEN N'سند حسابداری صادر شد'
                       WHEN TH.TagStatus = 2 THEN N'شمارش توسط ' + ISNULL(U2.UserName, 'کاربر') + N' تأیید شد'
                       ELSE N'تگ ایجاد شد'
                   END as Description
            FROM InventoryTagHeader TH
            LEFT JOIN StockType ST ON ST.ID = TH.StockTypeID
            LEFT JOIN Users U1 ON U1.UserCode = TH.ConfirmUserID
            LEFT JOIN Users U2 ON U2.UserCode = TH.CreateUserID
            {where}
            ORDER BY TH.ID DESC";

        try
        {
            return (await conn.QueryAsync<InventoryHistoryDto>(
                new CommandDefinition(sql, new { sid = stockTypeId }, cancellationToken: ct))).ToList();
        }
        catch
        {
            // اگر جدول Users نامش متفاوت بود، بدون جوین یوزر برمی‌گردانیم
            var simpleSql = $@"
                SELECT TH.ID as TagHeaderId, TH.TagNo, ST.Name as StockName,
                       CASE WHEN TH.TagStatus = 3 THEN N'صدور سند' WHEN TH.TagStatus = 2 THEN N'تأیید نهایی' WHEN TH.TagStatus = 1 THEN N'در حال شمارش' ELSE N'ایجاد تگ' END as OperationType,
                       N'سیستم' as UserName, TH.TagDate as OperationDate, '' as OperationTime, N'عملیات انجام شد' as Description
                FROM InventoryTagHeader TH LEFT JOIN StockType ST ON ST.ID = TH.StockTypeID {where} ORDER BY TH.ID DESC";
            return (await conn.QueryAsync<InventoryHistoryDto>(
                new CommandDefinition(simpleSql, new { sid = stockTypeId }, cancellationToken: ct))).ToList();
        }
    }
}