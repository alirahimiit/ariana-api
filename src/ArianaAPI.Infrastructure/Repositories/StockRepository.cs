using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Stock;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class StockRepository : IStockRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<StockRepository> _logger;

    public StockRepository(ITenantConnectionFactory factory, ILogger<StockRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════
    //  لیست
    // ═══════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════
    //  لیست
    // ═══════════════════════════════════════════════════
    public async Task<StockListResultDto> GetListAsync(
        long orgId, long fyId, StockRequestDto req, CancellationToken ct = default)
    {
        var where = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        if (req.Kind.HasValue)
        {
            where.Append(" AND V.Kind = @kind ");
            p.Add("kind", req.Kind.Value);
        }
        if (req.StockTypeId is > 0)
        {
            where.Append(" AND V.StockTypeID = @stockId ");
            p.Add("stockId", req.StockTypeId.Value);
        }
        if (req.SpecialCode is > 0)
        {
            where.Append(" AND V.SpecialCode = @specialCode ");
            p.Add("specialCode", req.SpecialCode.Value);
        }
        if (req.CodeFrom is > 0)
        {
            where.Append(" AND V.Code >= @codeFrom ");
            p.Add("codeFrom", req.CodeFrom.Value);
        }
        if (req.CodeTo is > 0)
        {
            where.Append(" AND V.Code <= @codeTo ");
            p.Add("codeTo", req.CodeTo.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.Descript))
        {
            where.Append(" AND V.Des LIKE @des ");
            p.Add("des", "%" + req.Descript.Trim() + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            where.Append(" AND V.DateIN >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom.Trim());
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            where.Append(" AND V.DateIN <= @dateTo ");
            p.Add("dateTo", req.DateTo.Trim());
        }
        if (req.Vazeit.HasValue)
        {
            if (req.Vazeit.Value == -1)
            {
                where.Append(" AND ISNULL(P.Vazeit, -1) = -1 ");
            }
            else
            {
                where.Append(" AND ISNULL(P.Vazeit, -1) = @vazeit ");
                p.Add("vazeit", req.Vazeit.Value);
            }
        }

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ═══ کوئری شمارش ═══
        var countSql = $@"
            SELECT COUNT(*) 
            FROM Stock_Factor_VIEW V
            LEFT JOIN ParentSanad P ON P.ParentSanadID = V.Parent_Sanad_ID
            {where}";

        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        var offset = (req.Page - 1) * req.PageSize;
        var orderCol = (req.SortBy ?? "Code").ToLower() switch
        {
            "code" => "V.Code",
            "datein" => "V.DateIN",
            "specialcode" => "V.SpecialCode",
            "stocktypename" => "V.StockTypeName",
            "totalamount" => "T.TotalAmount",
            "nosanad" => "V.NO_Sanad",
            _ => "V.Code"
        };
        var orderDir = (req.SortDir ?? "desc").ToLower() == "asc" ? "ASC" : "DESC";
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        // ═══ کوئری اصلی (اصلاح کلمه رزرو شده RowCount) ═══
        var sql = $@"
            SELECT * FROM (
                SELECT 
                    V.ID                                    AS Id,
                    V.Code                                  AS Code,
                    V.SpecialCode                           AS SpecialCode,
                    V.DateIN                                AS DateIn,
                    V.Kind                                  AS Kind,
                    CASE V.Kind
                        WHEN 0 THEN N'رسید انبار'
                        WHEN 1 THEN N'حواله انبار'
                        WHEN 2 THEN N'رسید برگشتی'
                        ELSE N'نامشخص'
                    END                                     AS KindTitle,
                    ISNULL(V.Des, '')                       AS Des,
                    V.StockTypeID                           AS StockTypeId,
                    V.StockTypeCode                         AS StockTypeCode,
                    V.StockTypeName                         AS StockTypeName,
                    V.FactorID                              AS FactorId,
                    V.NoFactor                              AS NoFactor,
                    V.NO_Sanad                              AS NoSanad,
                    V.Parent_Sanad_ID                       AS ParentSanadId,
                    ISNULL(P.Vazeit, -1)                    AS Vazeit,
                    CASE ISNULL(P.Vazeit, -1)
                        WHEN -1 THEN N'بدون سند'
                        WHEN 0 THEN N'پیش‌نویس'
                        WHEN 2 THEN N'قطعی'
                        ELSE N''
                    END                                     AS VazeitTitle,
                    V.TolidID                               AS TolidId,
                    V.CodeCustumer                          AS CodeCustomer,
                    ISNULL(T.TotalAmount, 0)                AS TotalAmount,
                    ISNULL(T.[RowCount], 0)                 AS [RowCount], -- ⭐ استفاده از کروشه برای کلمه رزرو شده
                    ROW_NUMBER() OVER (ORDER BY {orderCol} {orderDir}) AS RN
                FROM Stock_Factor_VIEW V
                LEFT JOIN ParentSanad P ON P.ParentSanadID = V.Parent_Sanad_ID
                LEFT JOIN (
                    SELECT ID, SUM(Amount) AS TotalAmount, CAST(COUNT(*) AS INT) AS [RowCount] -- ⭐ استفاده از کروشه
                    FROM Stock_Factor_All_VIEW
                    GROUP BY ID
                ) T ON T.ID = V.ID
                {where}
            ) AS Base
            WHERE Base.RN BETWEEN @startRow AND @endRow 
            ORDER BY Base.RN";

        var items = (await conn.QueryAsync<StockListItemDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        return new StockListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = (int)Math.Ceiling(total / (double)req.PageSize)
        };
    }
    // ═══════════════════════════════════════════════════
    //  جزئیات
    // ═══════════════════════════════════════════════════
    public async Task<StockDetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        const string headerSql = @"
            SELECT 
                SF.ID                                   AS Id,
                SF.Code                                 AS Code,
                SF.SpecialCode                          AS SpecialCode,
                SF.DateIN                               AS DateIn,
                SF.Kind                                 AS Kind,
                CASE SF.Kind
                    WHEN 0 THEN N'رسید انبار'
                    WHEN 1 THEN N'حواله انبار'
                    WHEN 2 THEN N'رسید برگشتی'
                    ELSE N'نامشخص'
                END                                     AS KindTitle,
                ISNULL(SF.Des, '')                      AS Des,
                SF.StockTypeID                          AS StockTypeId,
                ISNULL(ST.Name, '')                     AS StockTypeName,
                SF.FactorID                             AS FactorId,
                ISNULL(FP.NoFactor, 0)                  AS NoFactor,
                ISNULL(P.No_Sanad, 0)                   AS NoSanad,
                SF.Parent_Sanad_ID                      AS ParentSanadId,
                ISNULL(P.Vazeit, -1)                    AS Vazeit,
                SF.TolidID                              AS TolidId,
                ISNULL(FP.CodeTafzil, 0)                AS CodeCustomer,
                SF.PerFactor_ID                         AS PerFactorId,
                ISNULL((SELECT SUM(Amount) FROM Stock_Factor_All_VIEW WHERE ID = SF.ID), 0) AS TotalAmount
            FROM Stock_Factor SF
            LEFT JOIN StockType ST ON ST.ID = SF.StockTypeID
            LEFT JOIN ParentSanad P ON P.ParentSanadID = SF.Parent_Sanad_ID
            LEFT JOIN FactorParent FP ON FP.ID = SF.FactorID
            WHERE SF.ID = @id";

        var header = await conn.QueryFirstOrDefaultAsync<StockDetailDto>(
            new CommandDefinition(headerSql, new { id }, cancellationToken: ct));

        if (header is null) return null;

        const string itemsSql = @"
            SELECT 
                M.ID                            AS Id,
                ROW_NUMBER() OVER (ORDER BY M.ID) AS RowNum,
                M.ArticleID                     AS ArticleId,
                CAST(M.ArticleCode AS NVARCHAR(50)) AS ArticleCode,
                M.ArticleName                   AS ArticleName,
                ISNULL(M.ArticleUnit, '')       AS ArticleUnit,
                ISNULL(M.ArticleGroupName, '')  AS ArticleGroupName,
                ISNULL(M.Val, 0)                AS Val,
                ISNULL(M.Cost, 0)               AS Cost,
                ISNULL(M.Amount, 0)             AS Amount
            FROM Stock_Factor_Mat_VIEW M
            WHERE M.StockFacorID = @id
            ORDER BY M.ID";

        header.Items = (await conn.QueryAsync<StockItemDto>(
            new CommandDefinition(itemsSql, new { id }, cancellationToken: ct))).ToList();

        return header;
    }

    // ═══════════════════════════════════════════════════
    //  Lookups
    // ═══════════════════════════════════════════════════
    public async Task<StockLookupsDto> GetLookupsAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var stockTypes = (await conn.QueryAsync<StockTypeLookupItem>(
            new CommandDefinition(@"
                SELECT ID AS Id, Code, Name 
                FROM StockType 
                WHERE ISNULL(Kind, 0) >= 0
                ORDER BY Name", cancellationToken: ct))).ToList();

        // ⭐ خواندن شرح‌ها مستقیماً از جدول (بدون نیاز به SP)
        var descriptions = (await conn.QueryAsync<string>(
            new CommandDefinition(@"
                SELECT DISTINCT TOP 100 Des 
                FROM Stock_Factor 
                WHERE Des IS NOT NULL AND Des <> ''
                ORDER BY Des", cancellationToken: ct))).ToList();

        return new StockLookupsDto
        {
            StockTypes = stockTypes,
            Descriptions = descriptions,
            TodayDate = GetTodayPersian()
        };
    }
    // ═══════════════════════════════════════════════════
    //  شماره بعدی
    // ═══════════════════════════════════════════════════
    public async Task<StockNextNumberDto> GetNextNumberAsync(
        long orgId, long fyId, int kind, long? stockTypeId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var lastCode = await conn.ExecuteScalarAsync<long?>(
            new CommandDefinition("SELECT MAX(Code) FROM Stock_Factor",
                cancellationToken: ct));
        var code = (lastCode ?? 0) + 1;

        long specialCode = 1;
        if (stockTypeId is > 0)
        {
            var lastSp = await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(@"
                    SELECT MAX(SpecialCode) FROM Stock_Factor 
                    WHERE Kind = @kind AND StockTypeID = @stockId",
                    new { kind, stockId = stockTypeId.Value }, cancellationToken: ct));
            specialCode = (lastSp ?? 0) + 1;
        }

        return new StockNextNumberDto
        {
            Code = code,
            SpecialCode = specialCode,
            Kind = kind
        };
    }

    // ═══════════════════════════════════════════════════
    //  محاسبه کالا
    // ═══════════════════════════════════════════════════
    public async Task<StockArticleCalcDto?> GetArticleCalcAsync(
        long orgId, long fyId, long articleId, int kind, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        const string sql = @"
            SELECT 
                AN.ID                           AS ArticleId,
                CAST(AN.Code AS NVARCHAR(50))   AS ArticleCode,
                AN.Name                         AS ArticleName,
                AN.ArticleUnitName              AS UnitName,
                AN.ArticleUnitName2             AS UnitName2,
                AN.ArticleUnitName3             AS UnitName3,
                ISNULL(AN.Tabdil2, 0)           AS Tabdil2,
                ISNULL(AN.Tabdil3, 0)           AS Tabdil3,
                ISNULL(AN.AmountSale, 0)        AS AmountSale,
                AN.StockTypeID                  AS StockTypeId,
                AN.StockTypeName                AS StockTypeName,
                ISNULL(AN.xIs_RegMinOrderToIn, 0)  AS XIs_RegMinOrderToIn,
                ISNULL(AN.xIs_RegMaxOrderToOut, 0) AS XIs_RegMaxOrderToOut,
                ISNULL(AN.xIs_RegNegativKala, 0)   AS XIs_RegNegativKala,
                ISNULL(AN.MaxCostOrderBy, 0)    AS MaxCostOrderBy,
                ISNULL(AN.MinCostOrderBy, 0)    AS MinCostOrderBy
            FROM ArticleNew_VIEW AN
            WHERE AN.ID = @articleId";

        var dto = await conn.QueryFirstOrDefaultAsync<StockArticleCalcDto>(
            new CommandDefinition(sql, new { articleId }, cancellationToken: ct));

        if (dto is null) return null;

        try
        {
            var cost = await conn.ExecuteScalarAsync<double?>(
                new CommandDefinition(
                    "SELECT dbo.fn_GetArticleCost(@articleId)",
                    new { articleId }, cancellationToken: ct));
            dto.LastBuyCost = Math.Round((decimal)(cost ?? 0), 0);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "خطا در fn_GetArticleCost({ArticleId})", articleId);
            dto.LastBuyCost = 0;
        }

        dto.FinallExistence = await conn.ExecuteScalarAsync<decimal?>(
            new CommandDefinition(@"
                SELECT 
                    ISNULL((SELECT SUM(ArticleCount) FROM FactorDetail_VIEW
                            WHERE ArticleID = @articleId AND FactorKind IN (0, 3)), 0)
                  - ISNULL((SELECT SUM(ArticleCount) FROM FactorDetail_VIEW
                            WHERE ArticleID = @articleId AND FactorKind IN (1, 2, 9)), 0)
                  + ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat SFM
                            INNER JOIN Stock_Factor SF ON SF.ID = SFM.StockFacorID
                            WHERE SFM.ArticleID = @articleId AND SF.Kind IN (0, 2)), 0)
                  - ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat SFM
                            INNER JOIN Stock_Factor SF ON SF.ID = SFM.StockFacorID
                            WHERE SFM.ArticleID = @articleId AND SF.Kind = 1), 0)",
                new { articleId }, cancellationToken: ct)) ?? 0;

        return dto;
    }

    // ═══════════════════════════════════════════════════
    //  ایجاد
    // ═══════════════════════════════════════════════════
    public async Task<StockWriteResultDto> CreateAsync(
        long orgId, long fyId, StockWriteDto dto, long userCode, CancellationToken ct = default)
    {
        ValidateWrite(dto);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            long code;
            if (dto.Code is > 0)
            {
                var dup = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        "SELECT COUNT(*) FROM Stock_Factor WHERE Code = @c",
                        new { c = dto.Code }, transaction: tx, cancellationToken: ct));
                if (dup > 0)
                    throw new InvalidOperationException($"شماره سیستمی {dto.Code} قبلاً ثبت شده است");
                code = dto.Code.Value;
            }
            else
            {
                var last = await conn.ExecuteScalarAsync<long?>(
                    new CommandDefinition("SELECT MAX(Code) FROM Stock_Factor",
                        transaction: tx, cancellationToken: ct));
                code = (last ?? 0) + 1;
            }

            long specialCode;
            if (dto.SpecialCode is > 0)
            {
                var dup = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(@"
                        SELECT COUNT(*) FROM Stock_Factor 
                        WHERE SpecialCode = @sc AND Kind = @k AND StockTypeID = @sid",
                        new { sc = dto.SpecialCode, k = dto.Kind, sid = dto.StockTypeId },
                        transaction: tx, cancellationToken: ct));
                if (dup > 0)
                    throw new InvalidOperationException(
                        $"شماره {dto.SpecialCode} قبلاً در این انبار ثبت شده است");
                specialCode = dto.SpecialCode.Value;
            }
            else
            {
                var last = await conn.ExecuteScalarAsync<long?>(
                    new CommandDefinition(@"
                        SELECT MAX(SpecialCode) FROM Stock_Factor 
                        WHERE Kind = @k AND StockTypeID = @sid",
                        new { k = dto.Kind, sid = dto.StockTypeId },
                        transaction: tx, cancellationToken: ct));
                specialCode = (last ?? 0) + 1;
            }

            const string insHeader = @"
                INSERT INTO Stock_Factor 
                    (Code, SpecialCode, DateIN, Kind, Des, StockTypeID, PerFactor_ID)
                VALUES 
                    (@code, @specialCode, @dateIn, @kind, @des, @stockTypeId, @perFactorId);
                SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insHeader, new
                {
                    code,
                    specialCode,
                    dateIn = dto.DateIn ?? GetTodayPersian(),
                    kind = dto.Kind,
                    des = dto.Des ?? "",
                    stockTypeId = dto.StockTypeId ?? 0,
                    perFactorId = 0
                }, transaction: tx, cancellationToken: ct));

            await InsertItemsAsync(conn, tx, newId, dto.Items, ct);

            var sanadResult = await SaveSanadAndFactorAsync(
                conn, tx, newId, dto, ct);

            tx.Commit();

            _logger.LogInformation(
                "Stock created: Kind={Kind}, Id={Id}, Code={Code}, By={User}",
                dto.Kind, newId, code, userCode);

            return new StockWriteResultDto
            {
                Id = newId,
                Code = code,
                SpecialCode = specialCode,
                NoSanad = sanadResult.NoSanad,
                NoFactor = sanadResult.NoFactor,
                Success = true
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════
    //  ویرایش
    // ═══════════════════════════════════════════════════
    public async Task<StockWriteResultDto> UpdateAsync(
        long orgId, long fyId, long id, StockWriteDto dto, long userCode, CancellationToken ct = default)
    {
        ValidateWrite(dto);

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(@"
                    SELECT SF.ID, SF.Kind, SF.Code, SF.SpecialCode, SF.TolidID,
                           SF.Parent_Sanad_ID, P.Vazeit
                    FROM Stock_Factor SF
                    LEFT JOIN ParentSanad P ON P.ParentSanadID = SF.Parent_Sanad_ID
                    WHERE SF.ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (existing is null)
                throw new InvalidOperationException("رسید/حواله یافت نشد");

            var ed = (IDictionary<string, object>)existing;
            var oldKind = Convert.ToInt32(ed["Kind"] ?? 0);
            var vazeit = ed["Vazeit"] != DBNull.Value
                ? Convert.ToInt32(ed["Vazeit"]) : -1;
            var tolidId = ed["TolidID"] != DBNull.Value
                ? Convert.ToInt64(ed["TolidID"]) : 0L;

            if (oldKind != dto.Kind)
                throw new InvalidOperationException("نوع سند قابل تغییر نیست");

            if (tolidId > 0)
                throw new InvalidOperationException("این سند از تولید خودکار ایجاد شده و قابل ویرایش نیست");

            if (vazeit == 2)
                throw new InvalidOperationException(
                    "سند حسابداری این رسید/حواله قطعی شده است — ابتدا از صفحه اسناد، قطعیت آن را لغو کنید");

            long code;
            if (dto.Code is > 0)
            {
                var dup = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        "SELECT COUNT(*) FROM Stock_Factor WHERE Code = @c AND ID <> @id",
                        new { c = dto.Code, id }, transaction: tx, cancellationToken: ct));
                if (dup > 0)
                    throw new InvalidOperationException($"شماره سیستمی {dto.Code} قبلاً ثبت شده است");
                code = dto.Code.Value;
            }
            else
            {
                code = ed["Code"] != DBNull.Value ? Convert.ToInt64(ed["Code"]) : 0;
            }

            long specialCode;
            if (dto.SpecialCode is > 0)
            {
                var dup = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(@"
                        SELECT COUNT(*) FROM Stock_Factor 
                        WHERE SpecialCode = @sc AND Kind = @k AND StockTypeID = @sid AND ID <> @id",
                        new { sc = dto.SpecialCode, k = dto.Kind, sid = dto.StockTypeId, id },
                        transaction: tx, cancellationToken: ct));
                if (dup > 0)
                    throw new InvalidOperationException(
                        $"شماره {dto.SpecialCode} قبلاً در این انبار ثبت شده است");
                specialCode = dto.SpecialCode.Value;
            }
            else
            {
                specialCode = ed["SpecialCode"] != DBNull.Value
                    ? Convert.ToInt64(ed["SpecialCode"]) : 0;
            }

            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE Stock_Factor SET
                    Code        = @code,
                    SpecialCode = @specialCode,
                    DateIN      = @dateIn,
                    Des         = @des,
                    StockTypeID = @stockTypeId
                WHERE ID = @id",
                new
                {
                    id,
                    code,
                    specialCode,
                    dateIn = dto.DateIn ?? GetTodayPersian(),
                    des = dto.Des ?? "",
                    stockTypeId = dto.StockTypeId ?? 0
                }, transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Stock_Factor_Mat WHERE StockFacorID = @id",
                new { id }, transaction: tx, cancellationToken: ct));

            await InsertItemsAsync(conn, tx, id, dto.Items, ct);

            var sanadResult = await SaveSanadAndFactorAsync(
                conn, tx, id, dto, ct);

            tx.Commit();

            _logger.LogInformation(
                "Stock updated: Id={Id}, Code={Code}, By={User}",
                id, code, userCode);

            return new StockWriteResultDto
            {
                Id = id,
                Code = code,
                SpecialCode = specialCode,
                NoSanad = sanadResult.NoSanad,
                NoFactor = sanadResult.NoFactor,
                Success = true
            };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════
    //  حذف
    // ═══════════════════════════════════════════════════
    public async Task DeleteAsync(
        long orgId, long fyId, long id, long userCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(@"
                    SELECT SF.ID, SF.Code, SF.Kind, SF.TolidID, SF.Parent_Sanad_ID, P.Vazeit
                    FROM Stock_Factor SF
                    LEFT JOIN ParentSanad P ON P.ParentSanadID = SF.Parent_Sanad_ID
                    WHERE SF.ID = @id",
                    new { id }, transaction: tx, cancellationToken: ct));

            if (existing is null)
                throw new InvalidOperationException("رسید/حواله یافت نشد");

            var ed = (IDictionary<string, object>)existing;
            var vazeit = ed["Vazeit"] != DBNull.Value ? Convert.ToInt32(ed["Vazeit"]) : -1;
            var tolidId = ed["TolidID"] != DBNull.Value ? Convert.ToInt64(ed["TolidID"]) : 0L;
            var parentSanadId = ed["Parent_Sanad_ID"] != DBNull.Value
                ? Convert.ToInt64(ed["Parent_Sanad_ID"]) : 0L;

            if (tolidId > 0)
                throw new InvalidOperationException(
                    "این سند از تولید خودکار ایجاد شده — از فاکتور مربوطه حذف کنید");

            if (vazeit == 2)
                throw new InvalidOperationException(
                    "سند حسابداری قطعی است — ابتدا از صفحه اسناد، قطعیت آن را لغو کنید");

            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Sanad WHERE StockNo = @id",
                new { id }, transaction: tx, cancellationToken: ct));

            if (parentSanadId > 0)
            {
                var remain = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        "SELECT COUNT(*) FROM Sanad WHERE ParentSanadCode = @pid",
                        new { pid = parentSanadId }, transaction: tx, cancellationToken: ct));
                if (remain == 0)
                {
                    await conn.ExecuteAsync(new CommandDefinition(
                        "DELETE FROM ParentSanad WHERE ParentSanadID = @pid",
                        new { pid = parentSanadId }, transaction: tx, cancellationToken: ct));
                }
            }

            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM FactorDetail WHERE StockID = @id",
                new { id }, transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Stock_Factor_Mat WHERE StockFacorID = @id",
                new { id }, transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Stock_Factor WHERE ID = @id",
                new { id }, transaction: tx, cancellationToken: ct));

            tx.Commit();

            _logger.LogInformation("Stock deleted: Id={Id}, By={User}", id, userCode);
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════
    //  سند خودکار
    // ═══════════════════════════════════════════════════
    public async Task<StockSanadResultDto> CreateSanadAsync(
        long orgId, long fyId, long id, StockSanadRequestDto request,
        CancellationToken ct = default)
    {
        var result = new StockSanadResultDto { StockId = id };

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);

        var stock = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
                SELECT SF.ID, SF.Code, SF.Kind, SF.Parent_Sanad_ID, P.Vazeit
                FROM Stock_Factor SF
                LEFT JOIN ParentSanad P ON P.ParentSanadID = SF.Parent_Sanad_ID
                WHERE SF.ID = @id",
                new { id }, cancellationToken: ct));

        if (stock is null)
        {
            result.Error = "رسید/حواله یافت نشد";
            return result;
        }

        var sd = (IDictionary<string, object>)stock;
        result.Code = sd["Code"] != DBNull.Value ? Convert.ToInt64(sd["Code"]) : null;
        var kind = Convert.ToInt32(sd["Kind"] ?? 0);
        var vazeit = sd["Vazeit"] != DBNull.Value ? Convert.ToInt32(sd["Vazeit"]) : -1;

        if (vazeit == 2)
        {
            result.Error = "سند قبلی قطعی است — ابتدا قطعیت را لغو کنید";
            return result;
        }

        try
        {
            var p = new DynamicParameters();
            p.Add("@StockKind", kind);
            p.Add("@aNo_Sanad", request.NoSanad ?? 0);
            p.Add("@StockID", id);
            p.Add("RETURN_VALUE", dbType: DbType.Int32,
                  direction: ParameterDirection.ReturnValue);

            await conn.ExecuteAsync(new CommandDefinition(
                "Save_Stock_Sanad", p,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct));

            var returnCode = p.Get<int>("RETURN_VALUE");

            var noSanad = await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(@"
                    SELECT P.No_Sanad 
                    FROM Stock_Factor SF
                    INNER JOIN ParentSanad P ON P.ParentSanadID = SF.Parent_Sanad_ID
                    WHERE SF.ID = @id",
                    new { id }, cancellationToken: ct));

            if (noSanad is null)
            {
                result.Error = $"SP اجرا شد (Ret={returnCode}) ولی سند ثبت نشد";
                return result;
            }

            result.NoSanad = noSanad;
            result.Success = true;
            return result;
        }
        catch (Exception ex)
        {
            result.Error = ex.Message;
            _logger.LogError(ex, "خطا در CreateSanadAsync({Id})", id);
            return result;
        }
    }

    // ═══════════════════════════════════════════════════
    //  Helper: درج ردیف‌ها
    // ═══════════════════════════════════════════════════
    private static async Task InsertItemsAsync(
        SqlConnection conn,
        SqlTransaction tx,
        long stockId, List<StockItemWriteDto> items, CancellationToken ct)
    {
        if (items is null || items.Count == 0) return;

        const string sql = @"
            INSERT INTO Stock_Factor_Mat (StockFacorID, ArticleID, Val, Cost)
            VALUES (@sid, @aid, @val, @cost)";

        foreach (var item in items)
        {
            await conn.ExecuteAsync(new CommandDefinition(sql, new
            {
                sid = stockId,
                aid = item.ArticleId,
                val = item.Val,
                cost = item.Cost
            }, transaction: tx, cancellationToken: ct));
        }
    }

    // ═══════════════════════════════════════════════════
    //  Helper: ذخیره سند + فاکتور
    // ═══════════════════════════════════════════════════
    private async Task<(long? NoSanad, long? NoFactor)> SaveSanadAndFactorAsync(
        SqlConnection conn,
        SqlTransaction tx,
        long stockId, StockWriteDto dto, CancellationToken ct)
    {
        long? noSanad = null;
        long? noFactor = null;

        if (dto.SaveSanad)
        {
            var oldParentId = await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(
                    "SELECT Parent_Sanad_ID FROM Stock_Factor WHERE ID = @id",
                    new { id = stockId }, transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Sanad WHERE StockNo = @id",
                new { id = stockId }, transaction: tx, cancellationToken: ct));

            if (oldParentId is > 0)
            {
                var remain = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        "SELECT COUNT(*) FROM Sanad WHERE ParentSanadCode = @pid",
                        new { pid = oldParentId }, transaction: tx, cancellationToken: ct));
                if (remain == 0)
                {
                    await conn.ExecuteAsync(new CommandDefinition(
                        "DELETE FROM ParentSanad WHERE ParentSanadID = @pid",
                        new { pid = oldParentId }, transaction: tx, cancellationToken: ct));
                }
            }

            var sp = new DynamicParameters();
            sp.Add("@StockKind", dto.Kind);
            sp.Add("@aNo_Sanad", dto.NoSanad ?? 0);
            sp.Add("@StockID", stockId);
            sp.Add("RETURN_VALUE", dbType: DbType.Int32,
                   direction: ParameterDirection.ReturnValue);

            await conn.ExecuteAsync(new CommandDefinition(
                "Save_Stock_Sanad", sp,
                commandType: CommandType.StoredProcedure,
                transaction: tx, cancellationToken: ct));

            noSanad = await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(@"
                    SELECT P.No_Sanad
                    FROM Stock_Factor SF
                    INNER JOIN ParentSanad P ON P.ParentSanadID = SF.Parent_Sanad_ID
                    WHERE SF.ID = @id",
                    new { id = stockId }, transaction: tx, cancellationToken: ct));
        }
        else
        {
            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE Stock_Factor SET Parent_Sanad_ID = NULL WHERE ID = @id",
                new { id = stockId }, transaction: tx, cancellationToken: ct));
        }

        if (dto.SaveFactor && dto.Kind == 1)
        {
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM FactorDetail WHERE StockID = @id",
                new { id = stockId }, transaction: tx, cancellationToken: ct));

            var sp = new DynamicParameters();
            sp.Add("@NoFactor", dto.NoFactor ?? 0);
            sp.Add("@StockID", stockId);
            sp.Add("@TafziliCode", dto.CodeTafzil ?? 0);
            sp.Add("RETURN_VALUE", dbType: DbType.Int32,
                   direction: ParameterDirection.ReturnValue);

            await conn.ExecuteAsync(new CommandDefinition(
                "SaveFactor_FromStock", sp,
                commandType: CommandType.StoredProcedure,
                transaction: tx, cancellationToken: ct));

            noFactor = await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(@"
                    SELECT FP.NoFactor
                    FROM Stock_Factor SF
                    INNER JOIN FactorParent FP ON FP.ID = SF.FactorID
                    WHERE SF.ID = @id",
                    new { id = stockId }, transaction: tx, cancellationToken: ct));
        }
        else if (!dto.SaveFactor)
        {
            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE Stock_Factor SET FactorID = 0, FactorCode = 0 WHERE ID = @id",
                new { id = stockId }, transaction: tx, cancellationToken: ct));
        }

        return (noSanad, noFactor);
    }

    // ═══════════════════════════════════════════════════
    //  Helper: اعتبارسنجی
    // ═══════════════════════════════════════════════════
    private static void ValidateWrite(StockWriteDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.DateIn))
            throw new InvalidOperationException("تاریخ را وارد کنید");

        if (dto.StockTypeId is null or 0)
            throw new InvalidOperationException("انبار را انتخاب کنید");

        if (dto.Items is null || dto.Items.Count == 0)
            throw new InvalidOperationException("حداقل یک ردیف کالا لازم است");

        foreach (var it in dto.Items)
        {
            if (it.ArticleId <= 0)
                throw new InvalidOperationException("کد کالا نامعتبر است");
            if (it.Val < 0)
                throw new InvalidOperationException("تعداد نمی‌تواند منفی باشد");
            if (it.Cost < 0)
                throw new InvalidOperationException("مبلغ نمی‌تواند منفی باشد");
        }

        // ⭐ چک قیمت‌گذاری قبل از صدور سند
        if (dto.SaveSanad && dto.Items.Any(x => x.Cost <= 0))
        {
            throw new InvalidOperationException("برای صدور سند حسابداری، ابتدا باید قیمت واحد تمام ردیف‌ها مشخص شود.");
        }
        if (dto.SaveFactor && dto.Kind == 1)
        {
            if (dto.CodeTafzil is null or 0)
                throw new InvalidOperationException("برای صدور فاکتور، کد مشتری الزامی است");

            if (!dto.Items.Any() || dto.Items.Sum(x => x.Val * x.Cost) <= 0)
                throw new InvalidOperationException("برای صدور فاکتور، مبلغ فاکتور باید بیشتر از صفر باشد");
        }
        if (dto.SaveFactor && dto.Kind != 1)
            throw new InvalidOperationException("«صدور فاکتور فروش» فقط برای حواله انبار مجاز است");

        if (dto.SaveFactor && (dto.NoFactor is null or 0) && (dto.CodeTafzil is null or 0))
            throw new InvalidOperationException("کد مشتری وارد نشده است");
    }
    public async Task<List<FactorListItemDto>> GetFactorListAsync(long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT TOP 100 
                ID AS Id, 
                NoFactor, 
                Date_In AS DateIn, 
                CodeTafzil, 
                HesabName,
                ISNULL(Cost, 0) AS TotalAmount
            FROM FactorParent_View 
            WHERE FactorKind = 1 
            ORDER BY NoFactor DESC";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        var list = await conn.QueryAsync<FactorListItemDto>(new CommandDefinition(sql, cancellationToken: ct));
        return list.ToList();
    }
    private static string GetTodayPersian()
    {
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }
}