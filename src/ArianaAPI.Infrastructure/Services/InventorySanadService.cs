using System.Data;
using ArianaAPI.Application.DTOs.Inventory;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services;

public class InventorySanadService : IInventorySanadService
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<InventorySanadService> _logger;

    public InventorySanadService(ITenantConnectionFactory factory, ILogger<InventorySanadService> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<InventorySanadResultDto> CreateSanadAsync(
        long orgId, long fyId, long tagId, long userId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        using var tx = conn.BeginTransaction();

        try
        {
            // 1. خواندن اطلاعات تگ با کلاس تایپ‌شده
            var tag = await conn.QueryFirstOrDefaultAsync<TagInfo>(
                new CommandDefinition("SELECT StockTypeID, StageNo, TagNo FROM InventoryTagHeader WHERE ID = @tagId", new { tagId }, tx, cancellationToken: ct));

            if (tag is null) return new InventorySanadResultDto { Success = false, Error = "تگ یافت نشد" };

            long stockTypeId = tag.StockTypeID;
            int stageNo = tag.StageNo;
            string tagNo = tag.TagNo;

            // 2. خواندن جزئیات با کلاس تایپ‌شده (Nullable double)
            var details = (await conn.QueryAsync<TagDetailRow>(
                new CommandDefinition(@"
                    SELECT ID, ArticleID, DiffQty, ScrapQty 
                    FROM InventoryTagDetail WHERE TagID = @tagId AND (DiffQty <> 0 OR ScrapQty > 0)", new { tagId }, tx, cancellationToken: ct))).ToList();

            if (details.Count == 0)
                return new InventorySanadResultDto { Success = false, Error = "هیچ اختلافی برای صدور سند وجود ندارد." };

            // 3. تعیین هدرهای مورد نیاز
            bool hasDecrease = details.Any(d => d.DiffQty.HasValue && d.DiffQty.Value < 0);
            bool hasIncrease = details.Any(d => d.DiffQty.HasValue && d.DiffQty.Value > 0);
            bool hasScrap = details.Any(d => d.ScrapQty.HasValue && d.ScrapQty.Value > 0);

            long idDecrease = 0, idIncrease = 0, idScrap = 0;

            if (hasDecrease) idDecrease = await CreateStockFactorHeaderAsync(conn, tx, 1, 1, stockTypeId, tagId, stageNo, $"انبارگردانی - کسر موجودی - {tagNo}", ct);
            if (hasIncrease) idIncrease = await CreateStockFactorHeaderAsync(conn, tx, 0, 2, stockTypeId, tagId, stageNo, $"انبارگردانی - اضافه موجودی - {tagNo}", ct);
            if (hasScrap) idScrap = await CreateStockFactorHeaderAsync(conn, tx, 1, 3, stockTypeId, tagId, stageNo, $"انبارگردانی - ضایعات - {tagNo}", ct);

            // 4. درج ردیف‌های کالا (استفاده از مقادیر تایپ‌شده)
            foreach (var d in details)
            {
                long detailId = d.ID;
                long articleId = d.ArticleID;

                double diff = d.DiffQty ?? 0;
                double scrap = d.ScrapQty ?? 0;

                var unitCost = await conn.ExecuteScalarAsync<double?>(
                    new CommandDefinition("SELECT dbo.fn_GetArticleCost(@articleId)", new { articleId }, tx, cancellationToken: ct)) ?? 0;

                if (diff < 0 && idDecrease > 0)
                    await InsertMatAndLinkAsync(conn, tx, idDecrease, tagId, detailId, articleId, Math.Abs(diff), unitCost, 1, diff, 0, userId, ct);

                if (diff > 0 && idIncrease > 0)
                    await InsertMatAndLinkAsync(conn, tx, idIncrease, tagId, detailId, articleId, diff, unitCost, 2, diff, 0, userId, ct);

                if (scrap > 0 && idScrap > 0)
                    await InsertMatAndLinkAsync(conn, tx, idScrap, tagId, detailId, articleId, scrap, unitCost, 3, 0, scrap, userId, ct);
            }

            // 5. اجرای SP سند خودکار
            if (idDecrease > 0) await ExecuteSaveSanadSpAsync(conn, tx, 1, idDecrease, ct);
            if (idIncrease > 0) await ExecuteSaveSanadSpAsync(conn, tx, 0, idIncrease, ct);
            if (idScrap > 0) await ExecuteSaveSanadSpAsync(conn, tx, 1, idScrap, ct);

            // 6. تغییر وضعیت تگ
            await conn.ExecuteAsync(new CommandDefinition("UPDATE InventoryTagHeader SET TagStatus = 3 WHERE ID = @tagId", new { tagId }, tx, cancellationToken: ct));

            tx.Commit();
            return new InventorySanadResultDto { Success = true, TagId = tagId, Message = "سند با موفقیت صادر شد." };
        }
        catch (Exception ex)
        {
            tx.Rollback();
            _logger.LogError(ex, "خطا در صدور سند انبارگردانی برای تگ {TagId}", tagId);
            return new InventorySanadResultDto { Success = false, Error = ex.Message };
        }
    }

    // ⭐ کلاس‌های کمکی برای جلوگیری از خطای DBNull
    private class TagInfo
    {
        public long StockTypeID { get; set; }
        public int StageNo { get; set; }
        public string TagNo { get; set; } = string.Empty;
    }

    private class TagDetailRow
    {
        public long ID { get; set; }
        public long ArticleID { get; set; }
        public double? DiffQty { get; set; }
        public double? ScrapQty { get; set; }
    }
    public async Task<InventorySanadResultDto> RecreateSanadAsync(
        long orgId, long fyId, long tagId, long userId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        using var tx = conn.BeginTransaction();

        try
        {
            var factors = (await conn.QueryAsync<long>(
                new CommandDefinition("SELECT ID FROM Stock_Factor WHERE InventoryTagID = @tagId", new { tagId }, tx, cancellationToken: ct))).ToList();

            foreach (var fid in factors)
            {
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Sanad WHERE StockNo = @fid", new { fid }, tx, cancellationToken: ct));

                var parentId = await conn.ExecuteScalarAsync<long?>(
                    new CommandDefinition("SELECT Parent_Sanad_ID FROM Stock_Factor WHERE ID = @fid", new { fid }, tx, cancellationToken: ct));

                if (parentId > 0)
                {
                    var remain = await conn.ExecuteScalarAsync<int>(
                        new CommandDefinition("SELECT COUNT(*) FROM Sanad WHERE ParentSanadCode = @pid", new { pid = parentId }, tx, cancellationToken: ct));
                    if (remain == 0)
                        await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ParentSanad WHERE ParentSanadID = @pid", new { pid = parentId }, tx, cancellationToken: ct));
                }

                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Stock_Factor_Mat WHERE StockFacorID = @fid", new { fid }, tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM InventoryToStockFactor WHERE StockFactorID = @fid", new { fid }, tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Stock_Factor WHERE ID = @fid", new { fid }, tx, cancellationToken: ct));
            }

            await conn.ExecuteAsync(new CommandDefinition("UPDATE InventoryTagHeader SET TagStatus = 2 WHERE ID = @tagId", new { tagId }, tx, cancellationToken: ct));
            tx.Commit();
        }
        catch (Exception ex)
        {
            tx.Rollback();
            return new InventorySanadResultDto { Success = false, Error = "خطا در پاک‌سازی سند قبلی: " + ex.Message };
        }

        // فراخوانی مجدد ایجاد سند
        return await CreateSanadAsync(orgId, fyId, tagId, userId, ct);
    }

    // ─── Helpers ───
    private async Task<long> CreateStockFactorHeaderAsync(
        SqlConnection conn, SqlTransaction tx, int kind, int adjType, long stockTypeId, long tagId, int stageNo, string des, CancellationToken ct)
    {
        var nextCode = (await conn.ExecuteScalarAsync<long?>(
            new CommandDefinition("SELECT ISNULL(MAX(Code), 0) + 1 FROM Stock_Factor", transaction: tx, cancellationToken: ct))) ?? 1;

        var nextSp = (await conn.ExecuteScalarAsync<long?>(
            new CommandDefinition("SELECT ISNULL(MAX(SpecialCode), 0) + 1 FROM Stock_Factor WHERE Kind = @k AND StockTypeID = @s",
            new { k = kind, s = stockTypeId }, transaction: tx, cancellationToken: ct))) ?? 1;

        const string sql = @"
            INSERT INTO Stock_Factor (Code, SpecialCode, Des, Kind, DateIN, StockTypeID, InventoryTagID, InventoryStageNo, AdjustmentType, IsInventoryAdjustment)
            VALUES (@code, @sp, @des, @kind, @date, @stId, @tagId, @stage, @adj, 1);
            SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(sql, new
        {
            code = nextCode,
            sp = nextSp,
            des,
            kind,
            date = GetTodayPersian(),
            stId = stockTypeId,
            tagId,
            stage = stageNo,
            adj = adjType
        }, transaction: tx, cancellationToken: ct));
    }

    private async Task InsertMatAndLinkAsync(
        SqlConnection conn, SqlTransaction tx, long factorId, long tagId, long detailId, long articleId,
        double val, double cost, int adjType, double diff, double scrap, long userId, CancellationToken ct)
    {
        var matId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(@"
            INSERT INTO Stock_Factor_Mat (StockFacorID, ArticleID, Val, Cost)
            VALUES (@fid, @aid, @val, @cost);
            SELECT CAST(SCOPE_IDENTITY() AS BIGINT);",
            new { fid = factorId, aid = articleId, val, cost }, transaction: tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(@"
            INSERT INTO InventoryToStockFactor (TagID, TagDetailID, StockFactorID, StockFactorMatID, AdjustmentType, DiffQty, ScrapQty, UnitCost, CreateDate, CreateUserID)
            VALUES (@tagId, @detailId, @fid, @matId, @adjType, @diff, @scrap, @cost, @date, @userId)",
            new { tagId, detailId, fid = factorId, matId, adjType, diff, scrap, cost, date = GetTodayPersian(), userId },
            transaction: tx, cancellationToken: ct));
    }

    private async Task ExecuteSaveSanadSpAsync(SqlConnection conn, SqlTransaction tx, int kind, long factorId, CancellationToken ct)
    {
        var p = new DynamicParameters();
        p.Add("@StockKind", kind);
        p.Add("@aNo_Sanad", 0);
        p.Add("@StockID", factorId);
        p.Add("RETURN_VALUE", dbType: DbType.Int32, direction: ParameterDirection.ReturnValue);

        await conn.ExecuteAsync(new CommandDefinition("Save_Stock_Sanad", p, transaction: tx, commandType: CommandType.StoredProcedure, cancellationToken: ct));
    }

    private static string GetTodayPersian()
    {
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }
}