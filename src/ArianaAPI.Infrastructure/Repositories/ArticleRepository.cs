using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Article;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class ArticleRepository : IArticleRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<ArticleRepository> _logger;

    public ArticleRepository(
        ITenantConnectionFactory factory,
        ILogger<ArticleRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════
    //  لیست کالاها
    // ═══════════════════════════════════════════
    public async Task<ArticleListResultDto> GetListAsync(
           long orgId, long fyId, ArticleRequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        // ─── کد کالا ───
        if (!string.IsNullOrWhiteSpace(req.Code))
        {
            sb.Append(" AND CAST(AN.Code AS VARCHAR(50)) LIKE @code ");
            p.Add("code", "%" + req.Code + "%");
        }

        // ─── نام کالا ───
        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            sb.Append(" AND AN.Name LIKE @name ");
            p.Add("name", "%" + req.Name + "%");
        }

        // ─── شناسه مالیاتی ───
        if (!string.IsNullOrWhiteSpace(req.TaxId))
        {
            sb.Append(" AND CAST(AN.tax_id AS VARCHAR(50)) LIKE @taxId ");
            p.Add("taxId", "%" + req.TaxId + "%");
        }

        // ─── گروه ───
        if (req.GroupId is > 0)
        {
            sb.Append(" AND AN.ArticleGroupID = @groupId ");
            p.Add("groupId", req.GroupId.Value);
        }

        // ─── انبار ───
        if (req.StockTypeId is > 0)
        {
            sb.Append(" AND AN.StockTypeID = @stockTypeId ");
            p.Add("stockTypeId", req.StockTypeId.Value);
        }

        // ─── واحد ───
        if (req.UnitId is > 0)
        {
            sb.Append(" AND AN.ArticleUnitID = @unitId ");
            p.Add("unitId", req.UnitId.Value);
        }

        // ─── وضعیت ───
        if (req.Status.HasValue)
        {
            sb.Append(" AND AN.Status = @status ");
            p.Add("status", req.Status.Value);
        }

        // ─── فیلتر موجودی ───
        // ⚠️ این فیلتر روی مقدار Sum(FinallExistence) از Article_View اعمال می‌شه
        // چون باید در WHERE باشه، از زیرکوئری استفاده می‌کنیم
        switch ((req.StockFilter ?? "all").ToLower())
        {
            case "hasstock":
                sb.Append(@" AND ISNULL((SELECT SUM(A.FinallExistence) 
                                         FROM Article_View A 
                                         WHERE A.ArticleID = AN.ID), 0) > 0 ");
                break;
            case "nostock":
                sb.Append(@" AND ISNULL((SELECT SUM(A.FinallExistence) 
                                         FROM Article_View A 
                                         WHERE A.ArticleID = AN.ID), 0) = 0 ");
                break;
            case "negativestock":
                sb.Append(@" AND ISNULL((SELECT SUM(A.FinallExistence) 
                                         FROM Article_View A 
                                         WHERE A.ArticleID = AN.ID), 0) < 0 ");
                break;
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;

        _logger.LogDebug("Article list - where: {Where}", sb.ToString());

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ⭐ اول شمارش کل
        var countSql = $@"SELECT COUNT(*) FROM ArticleNew_VIEW AN {sb}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        // ⭐ پارامترهای صفحه
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
            SELECT * FROM (
                                SELECT 
                    AN.ID                       AS Id,
                    AN.Code                     AS Code,
                    AN.Name                     AS Name,
                    AN.tax_id                   AS TaxId,
                    AN.ArticleGroupID           AS ArticleGroupId,
                    AN.ArticleGroupName         AS ArticleGroupName,
                    AN.ArticleGroupCode         AS ArticleGroupCode,
                    AN.StockTypeID              AS StockTypeId,
                    AN.StockTypeName            AS StockTypeName,
                    AN.StockTypeCode            AS StockTypeCode,
                    AN.ArticleUnitID            AS ArticleUnitId,
                    AN.ArticleUnitName          AS ArticleUnitName,
                    AN.AmountSale               AS AmountSale,
                    AN.MarketerPercent          AS MarketerPercent,
                    AN.ArticleCoding            AS ArticleCoding,
                    AN.Status                   AS Status,
                    AN.StatusName               AS StatusName,
                    AN.AmountFirst              AS AmountFirst,
                    AN.CostFirst                AS CostFirst,
                    AN.inAmount1                AS InAmount1,
                    AN.inVal1                   AS InVal1,
                    AN.OutAmount1               AS OutAmount1,
                    AN.OutVal1                  AS OutVal1,
                    AN.BackAmount1              AS BackAmount1,
                    AN.BackVal1                 AS BackVal1,
                    AN.FinalAmount1             AS FinalAmount1,
                    AN.FinalVal1                AS FinalVal1,
                    (SELECT SUM(A.FinallExistence) 
                     FROM Article_View A 
                     WHERE A.ArticleID = AN.ID) AS FinallExistence,
                    ROW_NUMBER() OVER (ORDER BY AN.Code) AS RowNum
                FROM ArticleNew_VIEW AN
                {sb}
            ) AS T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        _logger.LogDebug("Article list SQL:\n{Sql}", sql);

        var items = (await conn.QueryAsync<ArticleListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new ArticleListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    // ═══════════════════════════════════════════
    //  جزئیات کالا
    // ═══════════════════════════════════════════
    public async Task<ArticleDetailDto?> GetDetailAsync(
        long orgId, long fyId, long articleId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        const string sql = @"
            SELECT 
                AN.ID                       AS Id,
                AN.Code                     AS Code,
                AN.Name                     AS Name,
                AN.tax_id                   AS TaxId,
                AN.ArticleCoding            AS ArticleCoding,
                AN.CodingStore              AS CodingStore,
                AN.CodingGroupStore         AS CodingGroupStore,

                AN.ArticleGroupID           AS ArticleGroupId,
                AN.ArticleGroupCode         AS ArticleGroupCode,
                AN.ArticleGroupName         AS ArticleGroupName,

                AN.StockTypeID              AS StockTypeId,
                AN.StockTypeCode            AS StockTypeCode,
                AN.StockTypeName            AS StockTypeName,
                AN.Kind                     AS StockTypeKind,

                AN.ArticleUnitID            AS ArticleUnitId,
                AN.ArticleUnitName          AS ArticleUnitName,
                AN.ArticleUnitID2           AS ArticleUnitId2,
                AN.ArticleUnitName2         AS ArticleUnitName2,
                AN.ArticleUnitID3           AS ArticleUnitId3,
                AN.ArticleUnitName3         AS ArticleUnitName3,
                AN.Tabdil1                  AS Tabdil1,
                AN.Tabdil2                  AS Tabdil2,
                AN.Tabdil3                  AS Tabdil3,

                AN.Code_Col                 AS CodeCol,
                AN.Code_Moein               AS CodeMoein,
                AN.Code_Tafzil              AS CodeTafzil,

                AN.Code_Col_Buy             AS CodeColBuy,
                AN.Code_Moein_Buy           AS CodeMoeinBuy,
                AN.Code_Tafzil_Buy          AS CodeTafzilBuy,

                AN.Code_Col_ReBuy           AS CodeColReBuy,
                AN.Code_Moein_ReBuy         AS CodeMoeinReBuy,
                AN.Code_Tafzil_ReBuy        AS CodeTafzilReBuy,

                AN.Code_Col_ReSale          AS CodeColReSale,
                AN.Code_Moein_ReSale        AS CodeMoeinReSale,
                AN.Code_Tafzil_ReSale       AS CodeTafzilReSale,

                AN.AmountFirst              AS AmountFirst,
                AN.CostFirst                AS CostFirst,
                AN.AmountSale               AS AmountSale,

                AN.MarketerPercent          AS MarketerPercent,
                AN.MaxCostOrderBy           AS MaxCostOrderBy,
                AN.MinCostOrderBy           AS MinCostOrderBy,

                AN.xIs_RegMinOrderToIn      AS XIsRegMinOrderToIn,
                AN.xIs_RegMaxOrderToOut     AS XIsRegMaxOrderToOut,
                AN.xIs_RegNegativKala       AS XIsRegNegativKala,
                AN.xNotCalcPerDiscount      AS XNotCalcPerDiscount,
                AN.xNotCalcArezeshafzode    AS XNotCalcArezeshafzode,
                AN.xIs_CalcUnit2            AS XIsCalcUnit2,
                AN.xIs_CalcUnit3            AS XIsCalcUnit3,

                AN.Depreciation             AS Depreciation,
                AN.DepreciationType         AS DepreciationType,
                AN.DepreciationTypeName     AS DepreciationTypeName,

                AN.Status                   AS Status,
                AN.StatusName               AS StatusName,
                AN.Kind                     AS Kind,
                AN.For_EST                  AS ForEst,

                AN.AmountFirst              AS AmountFirst,
                AN.CostFirst                AS CostFirst,
                AN.inAmount1                AS InAmount1,
                AN.inVal1                   AS InVal1,
                AN.OutAmount1               AS OutAmount1,
                AN.OutVal1                  AS OutVal1,
                AN.BackAmount1              AS BackAmount1,
                AN.BackVal1                 AS BackVal1,
                AN.FinalAmount1             AS FinalAmount1,
                AN.FinalVal1                AS FinalVal1,

                (SELECT SUM(A.FirstExistence)   FROM Article_View A WHERE A.ArticleID = AN.ID) AS FirstExistence,
                (SELECT SUM(A.Inputed)          FROM Article_View A WHERE A.ArticleID = AN.ID) AS Inputed,
                (SELECT SUM(A.OutPuted)         FROM Article_View A WHERE A.ArticleID = AN.ID) AS OutPuted,
                (SELECT SUM(A.Loss1)            FROM Article_View A WHERE A.ArticleID = AN.ID) AS Loss1,
                (SELECT SUM(A.Loss2)            FROM Article_View A WHERE A.ArticleID = AN.ID) AS Loss2,
                (SELECT SUM(A.FinallExistence)  FROM Article_View A WHERE A.ArticleID = AN.ID) AS FinallExistence
            FROM ArticleNew_VIEW AN
            WHERE AN.ID = @articleId";

        return await conn.QueryFirstOrDefaultAsync<ArticleDetailDto>(
            new CommandDefinition(sql, new { articleId }, cancellationToken: ct));
    }
    // ═══════════════════════════════════════════
    //  ویرایش کالا
    // ═══════════════════════════════════════════

    public async Task UpdateAsync(
        long orgId, long fyId, long articleId, ArticleUpdateDto dto, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var exists = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM ArticleNew WHERE ID = @id",
                new { id = articleId }, cancellationToken: ct));
        if (exists == 0)
            throw new InvalidOperationException("کالا یافت نشد");

        const string sql = @"
            UPDATE ArticleNew SET
                Name                  = @name,
                tax_id                = @taxId,
                CodingStore           = @codingStore,
                CodingGroupStore      = @codingGroupStore,
                ArticleCoding         = ISNULL(@articleCoding, ArticleCoding),

                ArticleGroupID        = @articleGroupId,
                ArticleUnitID         = @articleUnitId,
                ArticleUnitID2        = @articleUnitId2,
                ArticleUnitID3        = @articleUnitId3,
                HasUnit2              = CASE WHEN @articleUnitId2 > 0 THEN 1 ELSE 0 END,

                Code_Col              = @codeCol,
                Code_Moein            = @codeMoein,
                Code_Tafzil           = @codeTafzil,

                Code_Col_Buy          = @codeColBuy,
                Code_Moein_Buy        = @codeMoeinBuy,
                Code_Tafzil_Buy       = @codeTafzilBuy,

                Code_Col_ReBuy        = @codeColReBuy,
                Code_Moein_ReBuy      = @codeMoeinReBuy,
                Code_Tafzil_ReBuy     = @codeTafzilReBuy,

                Code_Col_ReSale       = @codeColReSale,
                Code_Moein_ReSale     = @codeMoeinReSale,
                Code_Tafzil_ReSale    = @codeTafzilReSale,

                AmountFirst           = @amountFirst,
                CostFirst             = @costFirst,
                AmountSale            = @amountSale,
                MarketerPercent       = @marketerPercent,

                MaxCostOrderBy        = @maxCostOrderBy,
                MinCostOrderBy        = @minCostOrderBy,

                Depreciation          = @depreciation,
                DepreciationType      = @depreciationType,

                Status                = @status
            WHERE ID = @id";

        await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                id = articleId,
                name = dto.Name ?? "",
                taxId = dto.TaxId,
                codingStore = dto.CodingStore,
                codingGroupStore = dto.CodingGroupStore,
                articleCoding = dto.ArticleCoding,


                articleGroupId = dto.ArticleGroupId ?? 0,
                articleUnitId = dto.ArticleUnitId ?? 0,
                articleUnitId2 = dto.ArticleUnitId2 ?? 0,
                articleUnitId3 = dto.ArticleUnitId3 ?? 0,
                codeCol = dto.CodeCol ?? 0,
                codeMoein = dto.CodeMoein ?? 0,
                codeTafzil = dto.CodeTafzil ?? 0,

                codeColBuy = dto.CodeColBuy ?? 0,
                codeMoeinBuy = dto.CodeMoeinBuy ?? 0,
                codeTafzilBuy = dto.CodeTafzilBuy ?? 0,

                codeColReBuy = dto.CodeColReBuy ?? 0,
                codeMoeinReBuy = dto.CodeMoeinReBuy ?? 0,
                codeTafzilReBuy = dto.CodeTafzilReBuy ?? 0,

                codeColReSale = dto.CodeColReSale ?? 0,
                codeMoeinReSale = dto.CodeMoeinReSale ?? 0,
                codeTafzilReSale = dto.CodeTafzilReSale ?? 0,

                amountFirst = dto.AmountFirst ?? 0,
                costFirst = dto.CostFirst ?? 0,
                amountSale = dto.AmountSale ?? 0,
                marketerPercent = dto.MarketerPercent ?? 0,

                maxCostOrderBy = dto.MaxCostOrderBy ?? 0,
                minCostOrderBy = dto.MinCostOrderBy ?? 0,

                depreciation = dto.Depreciation ?? 0,
                depreciationType = dto.DepreciationType ?? 0,

                status = dto.Status ?? 1
            }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════
    //  Lookups
    // ═══════════════════════════════════════════
    public async Task<ArticleLookupsDto> GetLookupsAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var groups = (await conn.QueryAsync<ArticleGroupLookupDto>(
            new CommandDefinition(@"
                SELECT 
                    AG.ID             AS Id,
                    AG.StockTypeID    AS StockTypeId,
                    ST.Name           AS StockTypeName,
                    AG.Code           AS Code,
                    AG.Name           AS Name
                FROM ArticleGroup AG
                LEFT JOIN StockType ST ON ST.ID = AG.StockTypeID
                ORDER BY AG.Name",
                cancellationToken: ct))).ToList();

        var units = (await conn.QueryAsync<ArticleUnitLookupDto>(
            new CommandDefinition(@"
                SELECT ID AS Id, Code, Name 
                FROM ArticleUnit 
                ORDER BY Name",
                cancellationToken: ct))).ToList();

        var stockTypes = (await conn.QueryAsync<StockTypeLookupDto>(
            new CommandDefinition(@"
                SELECT ID AS Id, Code, Name 
                FROM StockType 
                ORDER BY Name",
                cancellationToken: ct))).ToList();

        return new ArticleLookupsDto
        {
            Groups = groups,
            Units = units,
            StockTypes = stockTypes
        };
    }

    // ═══════════════════════════════════════════
    //  محاسبه کد بعدی کالا
    // ═══════════════════════════════════════════
    public async Task<ArticleNextCodeDto> GetNextCodeAsync(
    long orgId, long fyId, long stockTypeId, long groupId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var stockCode = await conn.ExecuteScalarAsync<decimal?>(
            new CommandDefinition("SELECT Code FROM StockType WHERE ID = @id",
                new { id = stockTypeId }, cancellationToken: ct));

        var groupCode = await conn.ExecuteScalarAsync<decimal?>(
            new CommandDefinition("SELECT Code FROM ArticleGroup WHERE ID = @id",
                new { id = groupId }, cancellationToken: ct));

        if (stockCode == null || groupCode == null)
            throw new InvalidOperationException("انبار یا گروه یافت نشد");

        var padStock = ((long)stockCode.Value).ToString().PadLeft(3, '0');
        var padGroup = ((long)groupCode.Value).ToString().PadLeft(3, '0');

        // prefix = {stock:3}{group:3}   مثلا 001001
        var prefixStr = padStock + padGroup;              // "001001"
        var minCode = long.Parse(prefixStr + "0000");     // 0010010000
        var maxCode = long.Parse(prefixStr + "9999");     // 0010019999

        // ⭐ آخرین کد ثبت‌شده در این انبار+گروه
        var lastCode = await conn.ExecuteScalarAsync<long?>(
            new CommandDefinition(@"
                SELECT TOP 1 CAST(Code AS BIGINT)
                FROM ArticleNew
                WHERE CAST(Code AS BIGINT) BETWEEN @minCode AND @maxCode
                ORDER BY CAST(Code AS BIGINT) DESC",
                new { minCode, maxCode }, cancellationToken: ct));

        long nextCodeNum;
        int nextSeq;

        if (lastCode.HasValue)
        {
            // آخرین کد موجود + 1
            nextCodeNum = lastCode.Value + 1;
            nextSeq = (int)(nextCodeNum % 10000);
        }
        else
        {
            nextSeq = 1;
            nextCodeNum = long.Parse(prefixStr + "0001");
        }

        // اطمینان از اینکه کد جدید تداخل نداره
        while (true)
        {
            var exists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM ArticleNew WHERE CAST(Code AS BIGINT) = @c",
                    new { c = nextCodeNum }, cancellationToken: ct));
            if (exists == 0) break;
            nextCodeNum++;
            nextSeq = (int)(nextCodeNum % 10000);
        }

        var fullCode = prefixStr + nextSeq.ToString().PadLeft(4, '0');

        return new ArticleNextCodeDto
        {
            FullCode = fullCode,
            Code = nextCodeNum,
            CodingStore = padStock,
            CodingGroupStore = padGroup,
            Sequence = nextSeq
        };
    }

    // ═══════════════════════════════════════════
    //  درج کالای جدید
    // ═══════════════════════════════════════════
    public async Task<ArticleCreateResultDto> CreateAsync(
        long orgId, long fyId, ArticleCreateDto dto, CancellationToken ct = default)
    {
        // گرفتن کد بعدی
        var nextCode = await GetNextCodeAsync(orgId, fyId, dto.StockTypeId, dto.ArticleGroupId, ct);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        const string sql = @"
            INSERT INTO ArticleNew (
                ArticleGroupID, Code, Name, ArticleUnitID,
                Code_Col, Code_Moein, Code_Tafzil,
                DepreciationType, Depreciation,
                Code_Col_Buy, Code_Moein_Buy, Code_Tafzil_Buy,
                Status, AmountFirst, CostFirst,
                Code_Col_ReBuy, Code_Moein_ReBuy, Code_Tafzil_ReBuy,
                Code_Col_ReSale, Code_Moein_ReSale, Code_Tafzil_ReSale,
                ArticleUnitID2, HasUnit2, MaxCostOrderBy, MinCostOrderBy,
                AmountSale, ArticleUnitID3, MarketerPercent,
                ArticleCoding, CodingStore, CodingGroupStore, tax_id
            ) VALUES (
                @articleGroupId, @code, @name, @articleUnitId,
                @codeCol, @codeMoein, @codeTafzil,
                @depreciationType, @depreciation,
                @codeColBuy, @codeMoeinBuy, @codeTafzilBuy,
                @status, @amountFirst, @costFirst,
                @codeColReBuy, @codeMoeinReBuy, @codeTafzilReBuy,
                @codeColReSale, @codeMoeinReSale, @codeTafzilReSale,
                @articleUnitId2, @hasUnit2, @maxCostOrderBy, @minCostOrderBy,
                @amountSale, @articleUnitId3, @marketerPercent,
                @ArticleCoding,@codingStore, @codingGroupStore, @taxId
            );
            SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

        var newId = await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, new
            {
                articleGroupId = dto.ArticleGroupId,
                code = nextCode.Code,
                name = dto.Name ?? "",
                articleUnitId = dto.ArticleUnitId ?? 0,
                articleCoding = nextCode.FullCode,
                codeCol = dto.CodeCol ?? 0,
                codeMoein = dto.CodeMoein ?? 0,
                codeTafzil = dto.CodeTafzil ?? 0,
                depreciationType = dto.DepreciationType ?? 0,
                depreciation = dto.Depreciation ?? 0,
                codeColBuy = dto.CodeColBuy ?? 0,
                codeMoeinBuy = dto.CodeMoeinBuy ?? 0,
                codeTafzilBuy = dto.CodeTafzilBuy ?? 0,
                status = dto.Status ?? 1,
                amountFirst = dto.AmountFirst ?? 0,
                costFirst = dto.CostFirst ?? 0,
                codeColReBuy = dto.CodeColReBuy ?? 0,
                codeMoeinReBuy = dto.CodeMoeinReBuy ?? 0,
                codeTafzilReBuy = dto.CodeTafzilReBuy ?? 0,
                codeColReSale = dto.CodeColReSale ?? 0,
                codeMoeinReSale = dto.CodeMoeinReSale ?? 0,
                codeTafzilReSale = dto.CodeTafzilReSale ?? 0,
                articleUnitId2 = dto.ArticleUnitId2 ?? 0,
                hasUnit2 = (dto.ArticleUnitId2 ?? 0) > 0,
                maxCostOrderBy = dto.MaxCostOrderBy ?? 0,
                minCostOrderBy = dto.MinCostOrderBy ?? 0,
                amountSale = dto.AmountSale ?? 0,
                articleUnitId3 = dto.ArticleUnitId3 ?? 0,
                marketerPercent = dto.MarketerPercent ?? 0,
                codingStore = nextCode.CodingStore,
                codingGroupStore = nextCode.CodingGroupStore,
                taxId = dto.TaxId
            }, cancellationToken: ct));

        return new ArticleCreateResultDto
        {
            Id = newId,
            Code = nextCode.Code,
            FullCode = nextCode.FullCode
        };
    }
    public async Task DeleteAsync(
    long orgId, long fyId, long articleId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ۱. چک کن در فاکتورها استفاده نشده
            var used = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM FactorDetail WHERE ArticleID = @articleId",
                    new { articleId }, transaction: tx, cancellationToken: ct));

            if (used > 0)
                throw new InvalidOperationException(
                    "این کالا در فاکتورها استفاده شده و قابل حذف نیست");

            // ۲. حذف از ArticleStock (many-to-many)
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM ArticleStock WHERE ArticleID = @articleId",
                new { articleId }, transaction: tx, cancellationToken: ct));

            // ۳. حذف از ArticleNew
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM ArticleNew WHERE ID = @articleId",
                new { articleId }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
    // ═══════════════════════════════════════════
    //  اصلاح کدینگ‌های خراب (SP: UpDate_Article)
    // ═══════════════════════════════════════════
    public async Task FixCodingAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        await conn.ExecuteAsync(
            new CommandDefinition("EXEC UpDate_Article", cancellationToken: ct));
    }
}