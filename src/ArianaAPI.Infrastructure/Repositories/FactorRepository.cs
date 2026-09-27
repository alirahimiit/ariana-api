using System.Data;
using System.Text;
using ArianaAPI.Application.DTOs.Factor;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class FactorRepository : IFactorRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<FactorRepository> _logger;

    public FactorRepository(
        ITenantConnectionFactory factory,
        ILogger<FactorRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    // ═══════════════════════════════════════════════════
    //  لیست فاکتورها
    // ═══════════════════════════════════════════════════
    public async Task<FactorListResultDto> GetListAsync(
        long orgId, long fyId, FactorRequestDto req, CancellationToken ct = default)
    {
        var sb = new StringBuilder(" WHERE 1=1 ");
        var p = new DynamicParameters();

        // ─── نوع فاکتور ───
        if (req.FactorKind.HasValue)
        {
            sb.Append(" AND FactorKind = @factorKind ");
            p.Add("factorKind", req.FactorKind.Value);
        }

        // ─── شماره فاکتور ───
        if (req.NoFrom is > 0)
        {
            sb.Append(" AND NoFactor >= @noFrom ");
            p.Add("noFrom", req.NoFrom.Value);
        }
        if (req.NoTo is > 0)
        {
            sb.Append(" AND NoFactor <= @noTo ");
            p.Add("noTo", req.NoTo.Value);
        }

        // ─── مبلغ ───
        if (req.CostFrom.HasValue)
        {
            sb.Append(" AND Cost >= @costFrom ");
            p.Add("costFrom", req.CostFrom.Value);
        }
        if (req.CostTo.HasValue)
        {
            sb.Append(" AND Cost <= @costTo ");
            p.Add("costTo", req.CostTo.Value);
        }

        // ─── تاریخ ───
        if (!string.IsNullOrWhiteSpace(req.DateFrom))
        {
            sb.Append(" AND Date_In >= @dateFrom ");
            p.Add("dateFrom", req.DateFrom);
        }
        if (!string.IsNullOrWhiteSpace(req.DateTo))
        {
            sb.Append(" AND Date_In <= @dateTo ");
            p.Add("dateTo", req.DateTo);
        }

        // ─── طرف حساب ───
        if (req.CodeTafzil is > 0)
        {
            sb.Append(" AND CodeTafzil = @codeTafzil ");
            p.Add("codeTafzil", req.CodeTafzil.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.HesabName))
        {
            sb.Append(" AND HesabName LIKE @hesabName ");
            p.Add("hesabName", "%" + req.HesabName + "%");
        }

        // ─── شرح ───
        if (!string.IsNullOrWhiteSpace(req.Descript))
        {
            sb.Append(" AND Descript LIKE @descript ");
            p.Add("descript", "%" + req.Descript + "%");
        }

        // ─── کالا (زیر‌کوئری) ───
        if (!string.IsNullOrWhiteSpace(req.ArticleName))
        {
            sb.Append(@" AND ID IN (
                SELECT DISTINCT FD.FactorID FROM FactorDetail FD
                INNER JOIN ArticleNew AN ON AN.ID = FD.ArticleID
                WHERE AN.Name LIKE @articleName) ");
            p.Add("articleName", "%" + req.ArticleName + "%");
        }
        if (!string.IsNullOrWhiteSpace(req.ArticleCode))
        {
            sb.Append(@" AND ID IN (
                SELECT DISTINCT FD.FactorID FROM FactorDetail FD
                INNER JOIN ArticleNew AN ON AN.ID = FD.ArticleID
                WHERE AN.Code = @articleCode) ");
            p.Add("articleCode", req.ArticleCode);
        }

        // ─── صفحه‌بندی ───
        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 50;
        if (req.PageSize > 10000) req.PageSize = 10000;

        var offset = (req.Page - 1) * req.PageSize;

        _logger.LogDebug("Factor list - where: {Where}", sb.ToString());

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ⭐ اول شمارش کل (با پارامترهای فعلی، بدون صفحه‌بندی)
        var countSql = $@"SELECT COUNT(*) FROM FactorParent_View {sb}";
        var total = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(countSql, p, cancellationToken: ct));

        // ⭐ بعد پارامترهای صفحه رو اضافه کن
        p.Add("startRow", offset + 1);
        p.Add("endRow", offset + req.PageSize);

        var sql = $@"
            SELECT * FROM (
                SELECT 
                    ID             AS Id,
                    NoFactor       AS NoFactor,
                    Date_In        AS DateIn,
                    Descript       AS Descript,
                    FactorKind     AS FactorKind,
                    CASE FactorKind
                        WHEN 0 THEN N'خرید'
                        WHEN 1 THEN N'فروش'
                        WHEN 2 THEN N'برگشت از خرید'
                        WHEN 3 THEN N'برگشت از فروش'
                        WHEN 4 THEN N'پیش فاکتور'
                        WHEN 5 THEN N'امانی ما نزد دیگران'
                        WHEN 6 THEN N'امانی دیگران نزد ما'
                        WHEN 7 THEN N'ارائه خدمات'
                        WHEN 8 THEN N'دریافت خدمات'
                        WHEN 9 THEN N'ضایعات'
                        ELSE N'نامشخص'
                    END            AS FactorKindTitle,
                    CodeTafzil     AS CodeTafzil,
                    HesabName      AS HesabName,
                    IsCaSh         AS IsCash,
                    CASE ISNULL(IsCaSh, 0)
                        WHEN 1 THEN N'نقدی'
                        WHEN 2 THEN N'غیرنقدی'
                        ELSE N''
                    END            AS IsCashName,
                    Cost           AS Cost,
                    NO_Sanad       AS NoSanad,
                    DateSanad      AS DateSanad,
                    MarkerName     AS MarkerName,
                    ISNULL(TransCost, 0) AS TransCost,
                    ROW_NUMBER() OVER (ORDER BY NoFactor DESC, ID DESC) AS RowNum
                FROM FactorParent_View
                {sb}
            ) AS T
            WHERE T.RowNum BETWEEN @startRow AND @endRow
            ORDER BY T.RowNum";

        _logger.LogDebug("Factor list SQL:\n{Sql}", sql);

        var items = (await conn.QueryAsync<FactorListDto>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        var totalPages = (int)Math.Ceiling(total / (double)req.PageSize);

        return new FactorListResultDto
        {
            Items = items,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = total,
            TotalPages = totalPages
        };
    }

    // ═══════════════════════════════════════════════════
    //  جزئیات فاکتور
    // ═══════════════════════════════════════════════════
    public async Task<FactorResultDto?> GetDetailAsync(
        long orgId, long fyId, long factorId, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ─── سر فاکتور ───
        const string headerSql = @"
            SELECT 
                ID           AS Id,
                NoFactor     AS NoFactor,
                Date_In      AS DateIn,
                Descript     AS Descript,
                FactorKind   AS FactorKind,
                CASE FactorKind
                    WHEN 0 THEN N'خرید'
                    WHEN 1 THEN N'فروش'
                    WHEN 2 THEN N'برگشت از خرید'
                    WHEN 3 THEN N'برگشت از فروش'
                    WHEN 4 THEN N'پیش فاکتور'
                    WHEN 5 THEN N'امانی ما نزد دیگران'
                    WHEN 6 THEN N'امانی دیگران نزد ما'
                    WHEN 7 THEN N'ارائه خدمات'
                    WHEN 8 THEN N'دریافت خدمات'
                    WHEN 9 THEN N'ضایعات'
                    ELSE N'نامشخص'
                END          AS FactorKindTitle,
                Cost         AS Cost,
                ISNULL(TransCost, 0) AS TransCost,
                CarInfo      AS CarInfo,
                CodeTafzil   AS CodeTafzil,
                HesabName    AS HesabName,
                Phone        AS Phone,
                Mobile       AS Mobile,
                EconomicCode AS EconomicCode,
                NationalCode AS NationalCode,
                PostalCode   AS PostalCode,
                Address      AS Address,
                StateName    AS StateName,
                CityName1    AS CityName1,
                CityName2    AS CityName2,
                Parent_Sanad_ID AS ParentSanadId,
                NO_Sanad     AS NoSanad,
                DateSanad    AS DateSanad,
                CodeTaf_Marketer AS CodeTafMarketer,
                MarkerName   AS MarkerName,
                MarkerMobile AS MarkerMobile
            FROM FactorParent_View
            WHERE ID = @factorId";

        var header = await conn.QueryFirstOrDefaultAsync<FactorDetailDto>(
            new CommandDefinition(headerSql, new { factorId }, cancellationToken: ct));

        if (header is null) return null;

        // ─── ردیف‌ها ───
        const string itemsSql = @"
            SELECT 
                ID              AS Id,
                ArticleID       AS ArticleId,
                ArticleCode     AS ArticleCode,
                ArticleName     AS ArticleName,
                ArticleUnitName AS ArticleUnitName,
                ArticleGroupName AS ArticleGroupName,
                ISNULL(ArticleCount, 0)  AS ArticleCount,
                ISNULL(ArticleCount2, 0) AS ArticleCount2,
                ISNULL(ArticleCount3, 0) AS ArticleCount3,
                ISNULL(Cost, 0)          AS Cost,
                ISNULL(CostItem, 0)      AS CostItem,
                ISNULL(Discount, 0)      AS Discount,
                ISNULL(Tax, 0)           AS Tax,
                ISNULL(TransCost, 0)     AS TransCost,
                ISNULL(CostTax, 0)       AS CostTax,
                ISNULL(FinallCost, 0)    AS FinallCost,
                ISNULL(PerDiscount, 0)   AS PerDiscount,
                ISNULL(MarketerPercent, 0) AS MarketerPercent,
                ISNULL(MarketerCosts, 0)   AS MarketerCosts,
                ISNULL(DegreeKala, 0)    AS DegreeKala,
                ISNULL(DropKala, 0)      AS DropKala,
                ISNULL(TaxFi, 0)         AS TaxFi
            FROM FactorDetail_VIEW
            WHERE FactorID = @factorId
            ORDER BY ID";

        var items = (await conn.QueryAsync<FactorItemDto>(
            new CommandDefinition(itemsSql, new { factorId }, cancellationToken: ct))).ToList();

        return new FactorResultDto
        {
            Header = header,
            Items = items,
            TotalRows = items.Count,
            TotalCostItem = items.Sum(x => x.CostItem),
            TotalDiscount = items.Sum(x => x.Discount),
            TotalTax = items.Sum(x => x.Tax),
            TotalTransCost = items.Sum(x => x.TransCost),
            TotalFinall = items.Sum(x => x.FinallCost)
        };
    }
    // ═══════════════════════════════════════════════════════════
    //  ⭐ متدهای جدید — ثبت/ویرایش/حذف/محاسبات
    // ═══════════════════════════════════════════════════════════

    // ─── 1. Lookups (نرخ مالیات + تنظیمات سراسری) ───
    public async Task<FactorLookupsDto> GetLookupsAsync(
    long orgId, long fyId, CancellationToken ct = default)
    {
        decimal taxPer = 0, avarezPer = 0;
        string fiscalYearStr = "";      // ⭐ جدید: سال شروع دوره مالی (مثلاً "1404")

        // ─── نرخ مالیات + سال مالی از DorehMali ───
        try
        {
            await using var permConn = _factory.CreatePermanentConnection();
            await permConn.OpenAsync(ct);

            var row = await permConn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(@"
                SELECT 
                    ISNULL(Tax_Per, 0)     AS TaxPer,
                    ISNULL(Avarez_Per, 0)  AS AvarezPer,
                    BeginDate              AS BeginDate
                FROM DorehMali
                WHERE DorehMaliID = @fyId AND SazmanCode = @orgId",
                    new { fyId, orgId }, cancellationToken: ct));

            if (row != null)
            {
                var d = (IDictionary<string, object>)row;
                taxPer = GetDecimalSafe(d, "TaxPer");
                avarezPer = GetDecimalSafe(d, "AvarezPer");

                // BeginDate مثل "1404/01/01"
                var beginDate = d.ContainsKey("BeginDate") && d["BeginDate"] != null && d["BeginDate"] != DBNull.Value
                    ? d["BeginDate"].ToString() ?? ""
                    : "";

                if (beginDate.Length >= 4)
                    fiscalYearStr = beginDate.Substring(0, 4);
            }
        }
        catch { /* ignore */ }

        // ─── تنظیمات سراسری ───
        bool calcMandeh = true, calcMarketer = true, showForosh = false, notControl = false;
        try
        {
            await using var conn = _factory.CreateTenantConnection(orgId, fyId);
            await conn.OpenAsync(ct);

            var setting = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition("SELECT TOP 1 * FROM Setting", cancellationToken: ct));

            if (setting != null)
            {
                var d = (IDictionary<string, object>)setting;
                calcMandeh = GetBoolSafe(d, "OnCalcMandeHesab", true);
                calcMarketer = GetBoolSafe(d, "OnCalcMarketerPercent", true);
                showForosh = GetBoolSafe(d, "OnInfoForosh", false);
                notControl = GetBoolSafe(d, "OnNotControlVal", false);
            }
        }
        catch { /* ignore */ }

        // ⭐ محاسبه‌ی تاریخ پیش‌فرض با تطبیق سال مالی
        string todayDate = ComputeTodayInFiscalYear(fiscalYearStr);

        return new FactorLookupsDto
        {
            TaxPer = taxPer,
            AvarezPer = avarezPer,
            TaxFi = taxPer + avarezPer,
            CalcMandehHesab = calcMandeh,
            CalcMarketerPercent = calcMarketer,
            ShowInfoForosh = showForosh,
            NotControlVal = notControl,
            TodayDate = todayDate,
            FiscalYear = int.TryParse(fiscalYearStr, out var fy) ? fy : 0
        };
    }

    // ═══════════════════════════════════════════════════════════
    //  Helper: امروز، ولی با سال دوره مالی (1404 به جای 1405)
    // ═══════════════════════════════════════════════════════════
    private static string ComputeTodayInFiscalYear(string fiscalYearStr)
    {
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        var realToday = $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
        // realToday = "1405/07/04"

        if (string.IsNullOrEmpty(fiscalYearStr) || fiscalYearStr.Length != 4)
            return realToday;

        var realYear = pc.GetYear(now);              // 1405
        var fiscalYear = int.Parse(fiscalYearStr);   // 1404

        if (realYear == fiscalYear)
            return realToday;   // تطبیق داره

        if (realYear > fiscalYear)
        {
            // امروز بعد از سال مالی → سال مالی + ماه/روز امروز
            // مثلاً: fiscalYear=1404، realToday=1405/07/04 → "1404/07/04"
            return fiscalYear.ToString("D4") + "/" + realToday.Substring(5);
        }

        // امروز قبل از شروع سال مالی (نادر) → روز اول سال مالی
        return fiscalYear.ToString("D4") + "/01/01";
    }

    // ─── 2. شماره بعدی فاکتور (بر اساس نوع) ───
    public async Task<FactorNextNoDto> GetNextNoAsync(
        long orgId, long fyId, long factorKind, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var last = await conn.ExecuteScalarAsync<long?>(
            new CommandDefinition(@"
            SELECT MAX(NoFactor) 
            FROM FactorParent 
            WHERE FactorKind = @factorKind",
                new { factorKind }, cancellationToken: ct));

        return new FactorNextNoDto { NoFactor = (last ?? 0) + 1 };
    }

    // ─── 3. اطلاعات محاسباتی یک کالا ⭐ (مهم‌ترین متد) ───
    public async Task<FactorArticleCalcDto?> GetArticleCalcAsync(
        long orgId, long fyId, long articleId, long factorKind,
        long? codeTafzil, string? factorDate, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ─── الف) اطلاعات پایه‌ی کالا ───
        const string articleSql = @"
        SELECT 
            AN.ID                       AS ArticleId,
            AN.ArticleUnitName          AS UnitName,
            AN.ArticleUnitName2         AS UnitName2,
            AN.ArticleUnitName3         AS UnitName3,
            ISNULL(AN.Tabdil2, 0)       AS Tabdil2,
            ISNULL(AN.Tabdil3, 0)       AS Tabdil3,
            AN.AmountSale               AS AmountSale,
            AN.AmountFirst              AS AmountFirst,
            ISNULL(AN.MarketerPercent, 0) AS MarketerPercent,
            AN.StockTypeID              AS StockTypeId,
            AN.StockTypeName            AS StockTypeName,
            ISNULL(AN.xIs_RegMinOrderToIn, 0)  AS XIsRegMinOrderToIn,
            ISNULL(AN.xIs_RegMaxOrderToOut, 0) AS XIsRegMaxOrderToOut,
            ISNULL(AN.xIs_RegNegativKala, 0)   AS XIsRegNegativKala,
            AN.MaxCostOrderBy           AS MaxCostOrderBy,
            AN.MinCostOrderBy           AS MinCostOrderBy,
            CASE WHEN ISNULL(AN.xNotCalcPerDiscount, 0) = 1 THEN 0 ELSE 1 END AS CalcPerDiscount
        FROM ArticleNew_VIEW AN
        WHERE AN.ID = @articleId";

        var dto = await conn.QueryFirstOrDefaultAsync<FactorArticleCalcDto>(
            new CommandDefinition(articleSql, new { articleId }, cancellationToken: ct));

        if (dto is null) return null;

        // ─── ب) موجودی فعلی ───
        dto.FinallExistence = await conn.ExecuteScalarAsync<decimal?>(
            new CommandDefinition(@"
            SELECT SUM(A.FinallExistence)
            FROM Article_View A
            WHERE A.ArticleID = @articleId",
                new { articleId }, cancellationToken: ct)) ?? 0;

        // ─── ج) میانگین قیمت خرید/فروش (از FactorDetail_VIEW) ───
        //     طبق دلفی: از فاکتورهای قبلی همون FactorKind
        var avg = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
            SELECT 
                SUM(CostItem)   AS SumCost,
                SUM(ArticleCount) AS SumCount
            FROM FactorDetail_VIEW
            WHERE FactorKind = @factorKind
              AND ArticleID = @articleId
              AND ISNULL(ArticleCount, 0) > 0",
                new { factorKind, articleId }, cancellationToken: ct));

        if (avg != null)
        {
            var d = (IDictionary<string, object>)avg;
            decimal sumCost = GetDecimalSafe(d, "SumCost");
            decimal sumCount = GetDecimalSafe(d, "SumCount");
            if (sumCount > 0)
            {
                var avgValue = sumCost / sumCount;
                // خرید (0) و برگشت‌ازفروش (3) → میانگین خرید
                // فروش (1) و برگشت‌ازخرید (2) → میانگین فروش
                if (factorKind == 0 || factorKind == 3)
                    dto.LastBuyCost = Math.Round(avgValue, 0);
                else
                    dto.LastSaleCost = Math.Round(avgValue, 0);
            }
        }

 

        return dto;
    }

    // ─── 4. ایجاد فاکتور جدید ───
    public async Task<FactorWriteResultDto> CreateAsync(
        long orgId, long fyId, FactorWriteDto dto, long userCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── ۱. شماره فاکتور ───
            long noFactor;
            if (dto.NoFactor is > 0)
            {
                // چک تکراری نبودن
                var dup = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(@"
                    SELECT COUNT(*) FROM FactorParent 
                    WHERE NoFactor = @no AND FactorKind = @kind",
                        new { no = dto.NoFactor, kind = dto.FactorKind },
                        transaction: tx, cancellationToken: ct));

                if (dup > 0)
                    throw new InvalidOperationException(
                        $"شماره فاکتور {dto.NoFactor} قبلاً برای این نوع ثبت شده است");

                noFactor = dto.NoFactor.Value;
            }
            else
            {
                // ⭐ MAX+1 اتمیک با قفل
                var last = await conn.ExecuteScalarAsync<long?>(
                    new CommandDefinition(@"
                    SELECT MAX(NoFactor) 
                    FROM FactorParent WITH (TABLOCKX)
                    WHERE FactorKind = @kind",
                        new { kind = dto.FactorKind },
                        transaction: tx, cancellationToken: ct));

                noFactor = (last ?? 0) + 1;
            }

            // ─── ۲. درج هدر ───
            var today = GetTodayPersian();
            var nowTime = DateTime.Now.ToString("HH:mm:ss");

            // ⭐ جمع Cost از ردیف‌ها (اتکا به مقدار ارسالی)
            var headerCost = dto.Cost != 0
                ? dto.Cost
                : (dto.Items?.Sum(i => i.FinallCost) ?? 0);

            const string insertHeaderSql = @"
            INSERT INTO FactorParent (
                NoFactor, Date_In, Descript, FactorKind, Code_Op, Date_Op, Time_Op,
                IsCaSh, Cost, CodeTafzil, Per_Ok, NoFactor_Per, StockID,
                CodeTaf_Marketer, TransCost, CarInfo
            ) VALUES (
                @noFactor, @dateIn, @descript, @factorKind, @codeOp, @dateOp, @timeOp,
                @isCash, @cost, @codeTafzil, @perOk, @noFactorPer, @stockId,
                @codeTafMarketer, @transCost, @carInfo
            );
            SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";

            var newId = await conn.ExecuteScalarAsync<long>(
                new CommandDefinition(insertHeaderSql, new
                {
                    noFactor,
                    dateIn = dto.DateIn ?? today,
                    descript = dto.Descript ?? "",
                    factorKind = dto.FactorKind,
                    codeOp = userCode,
                    dateOp = today,
                    timeOp = nowTime,
                    isCash = dto.IsCash ?? 1,
                    cost = headerCost,
                    codeTafzil = dto.CodeTafzil ?? 0,
                    perOk = dto.PerOk ?? 0,
                    noFactorPer = dto.NoFactorPer ?? 0,
                    stockId = dto.StockId ?? 0,
                    codeTafMarketer = dto.CodeTafMarketer ?? 0,
                    transCost = dto.TransCost,
                    carInfo = (object?)dto.CarInfo ?? DBNull.Value
                }, transaction: tx, cancellationToken: ct));

            // ─── ۳. درج ردیف‌ها ───
            await InsertItemsAsync(conn, tx, newId, dto.Items, ct);

            tx.Commit();

            _logger.LogInformation(
                "فاکتور جدید ثبت شد: Id={Id}, No={No}, Kind={Kind}, By UserCode={User}",
                newId, noFactor, dto.FactorKind, userCode);

            return new FactorWriteResultDto { Id = newId, NoFactor = noFactor };
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ─── 5. ویرایش فاکتور ───
    public async Task UpdateAsync(
        long orgId, long fyId, long factorId, FactorWriteDto dto, long userCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── ۱. چک وجود ───
            var exists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM FactorParent WHERE ID = @id",
                    new { id = factorId }, transaction: tx, cancellationToken: ct));

            if (exists == 0)
                throw new InvalidOperationException("فاکتور یافت نشد");

            // ─── ۲. شماره فاکتور ───
            long noFactor;
            if (dto.NoFactor is > 0)
            {
                var dup = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(@"
                    SELECT COUNT(*) FROM FactorParent 
                    WHERE NoFactor = @no AND FactorKind = @kind AND ID <> @id",
                        new { no = dto.NoFactor, kind = dto.FactorKind, id = factorId },
                        transaction: tx, cancellationToken: ct));

                if (dup > 0)
                    throw new InvalidOperationException(
                        $"شماره فاکتور {dto.NoFactor} قبلاً برای این نوع ثبت شده است");

                noFactor = dto.NoFactor.Value;
            }
            else
            {
                var current = await conn.ExecuteScalarAsync<long>(
                    new CommandDefinition(
                        "SELECT NoFactor FROM FactorParent WHERE ID = @id",
                        new { id = factorId }, transaction: tx, cancellationToken: ct));
                noFactor = current;
            }

            // ─── ۳. آپدیت هدر ───
            var today = GetTodayPersian();
            var nowTime = DateTime.Now.ToString("HH:mm:ss");

            var headerCost = dto.Cost != 0
                ? dto.Cost
                : (dto.Items?.Sum(i => i.FinallCost) ?? 0);

            const string updateHeaderSql = @"
            UPDATE FactorParent SET
                NoFactor          = @noFactor,
                Date_In           = @dateIn,
                Descript          = @descript,
                FactorKind        = @factorKind,
                Date_Op           = @dateOp,
                Time_Op           = @timeOp,
                IsCaSh            = @isCash,
                Cost              = @cost,
                CodeTafzil        = @codeTafzil,
                Per_Ok            = @perOk,
                NoFactor_Per      = @noFactorPer,
                StockID           = @stockId,
                CodeTaf_Marketer  = @codeTafMarketer,
                TransCost         = @transCost,
                CarInfo           = @carInfo
            WHERE ID = @id";

            await conn.ExecuteAsync(
                new CommandDefinition(updateHeaderSql, new
                {
                    id = factorId,
                    noFactor,
                    dateIn = dto.DateIn ?? today,
                    descript = dto.Descript ?? "",
                    factorKind = dto.FactorKind,
                    dateOp = today,
                    timeOp = nowTime,
                    isCash = dto.IsCash ?? 1,
                    cost = headerCost,
                    codeTafzil = dto.CodeTafzil ?? 0,
                    perOk = dto.PerOk ?? 0,
                    noFactorPer = dto.NoFactorPer ?? 0,
                    stockId = dto.StockId ?? 0,
                    codeTafMarketer = dto.CodeTafMarketer ?? 0,
                    transCost = dto.TransCost,
                    carInfo = (object?)dto.CarInfo ?? DBNull.Value
                }, transaction: tx, cancellationToken: ct));

            // ─── ۴. حذف ردیف‌های قبلی و درج جدید ───
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM FactorDetail WHERE FactorID = @id",
                    new { id = factorId }, transaction: tx, cancellationToken: ct));

            await InsertItemsAsync(conn, tx, factorId, dto.Items, ct);

            tx.Commit();

            _logger.LogInformation(
                "فاکتور ویرایش شد: Id={Id}, No={No}, By UserCode={User}",
                factorId, noFactor, userCode);
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ─── 6. حذف فاکتور ───
    public async Task DeleteAsync(
        long orgId, long fyId, long factorId, long userCode, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        using var tx = conn.BeginTransaction();
        try
        {
            // ─── ۱. چک وجود ───
            var noFactor = await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(
                    "SELECT NoFactor FROM FactorParent WHERE ID = @id",
                    new { id = factorId }, transaction: tx, cancellationToken: ct));

            if (noFactor is null)
                throw new InvalidOperationException("فاکتور یافت نشد");

            // ─── ۲. حذف سندهای مرتبط (اگه هستن) ───
            // طبق دلفی: Delete from Sanad where FactorID = X
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM Sanad WHERE FactorID = @id",
                    new { id = factorId }, transaction: tx, cancellationToken: ct));

            // ─── ۳. حذف ردیف‌ها ───
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM FactorDetail WHERE FactorID = @id",
                    new { id = factorId }, transaction: tx, cancellationToken: ct));

            // ─── ۴. حذف هدر ───
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM FactorParent WHERE ID = @id",
                    new { id = factorId }, transaction: tx, cancellationToken: ct));

            tx.Commit();

            _logger.LogInformation(
                "فاکتور حذف شد: Id={Id}, No={No}, By UserCode={User}",
                factorId, noFactor, userCode);
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  Helper: درج ردیف‌های فاکتور
    // ═══════════════════════════════════════════════════════════
    private static async Task InsertItemsAsync(
    SqlConnection conn, SqlTransaction tx,
    long factorId, List<FactorItemWriteDto>? items, CancellationToken ct)
    {
        if (items is null || items.Count == 0) return;

        // ⭐ توجه: FactorDetail فقط این ستون‌ها رو داره.
        //     CostItem / CostTax / FinallCost در VIEW محاسبه می‌شن.
        const string insertItemSql = @"
        INSERT INTO FactorDetail (
            FactorID, ArticleID, ArticleCount,
            Cost, IncCost, Discount, PerDiscount,
            Tax, TaxFi, TransCost,
            StockID, MarketerPercent, MarketerCosts,
            DegreeKala, DropKala
        ) VALUES (
            @factorId, @articleId, @articleCount,
            @cost, @incCost, @discount, @perDiscount,
            @tax, @taxFi, @transCost,
            @stockId, @marketerPercent, @marketerCosts,
            @degreeKala, @dropKala
        )";

        foreach (var item in items)
        {
            await conn.ExecuteAsync(
                new CommandDefinition(insertItemSql, new
                {
                    factorId,
                    articleId = item.ArticleId,
                    articleCount = item.ArticleCount,
                    cost = item.Cost,
                    incCost = item.IncCost,
                    discount = item.Discount,
                    perDiscount = item.PerDiscount,
                    tax = item.Tax,
                    taxFi = item.TaxFi,
                    transCost = item.TransCost,
                    stockId = item.StockId ?? 0,
                    marketerPercent = item.MarketerPercent,
                    marketerCosts = item.MarketerCosts,
                    degreeKala = item.DegreeKala,
                    dropKala = item.DropKala
                }, transaction: tx, cancellationToken: ct));
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════
    private static string GetTodayPersian()
    {
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        return $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
    }

    private static bool GetBoolSafe(IDictionary<string, object> d, string key, bool def)
    {
        if (!d.ContainsKey(key) || d[key] is null || d[key] is DBNull) return def;
        try { return Convert.ToInt32(d[key]) == 1; }
        catch { return def; }
    }

    private static decimal GetDecimalSafe(IDictionary<string, object> d, string key)
    {
        if (!d.ContainsKey(key) || d[key] is null || d[key] is DBNull) return 0;
        try { return Convert.ToDecimal(d[key]); }
        catch { return 0; }
    }
    // ═══════════════════════════════════════════════════════════
    //  سند خودکار
    // ═══════════════════════════════════════════════════════════

    public async Task<SanadCreateResultDto> CreateSanadAsync(
        long orgId, long fyId, long factorId, SanadCreateRequestDto request,
        CancellationToken ct = default)
    {
        var result = new SanadCreateResultDto { FactorId = factorId };

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        // ─── ۱. اطلاعات فاکتور ───
        var factor = await conn.QueryFirstOrDefaultAsync<dynamic>(
            new CommandDefinition(@"
            SELECT ID, NoFactor, FactorKind, Parent_Sanad_ID, NoSanad_ID_Marketer
            FROM FactorParent WHERE ID = @factorId",
                new { factorId }, cancellationToken: ct));

        if (factor is null)
        {
            result.Error = "فاکتور یافت نشد";
            return result;
        }

        var fd = (IDictionary<string, object>)factor;
        result.NoFactor = Convert.ToInt64(fd["NoFactor"] ?? 0L);
        var factorKind = Convert.ToInt32(fd["FactorKind"] ?? 0);

        // ─── ۲. نرخ مالیات از Permanent ───
        decimal taxPer = 0, avarezPer = 0;
        try
        {
            await using var permConn = _factory.CreatePermanentConnection();
            await permConn.OpenAsync(ct);

            var taxRow = await permConn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(@"
                SELECT ISNULL(Tax_Per, 0) AS TaxPer, ISNULL(Avarez_Per, 0) AS AvarezPer
                FROM DorehMali
                WHERE DorehMaliID = @fyId AND SazmanCode = @orgId",
                    new { fyId, orgId }, cancellationToken: ct));

            if (taxRow != null)
            {
                var td = (IDictionary<string, object>)taxRow;
                taxPer = GetDecimalSafe(td, "TaxPer");
                avarezPer = GetDecimalSafe(td, "AvarezPer");
            }
        }
        catch { }

        // ─── ۳. BuyDis/SelsDis از Setting ───
        string buyDis = "", selsDis = "";
        try
        {
            var setting = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition("SELECT TOP 1 * FROM Setting", cancellationToken: ct));
            if (setting != null)
            {
                var sd = (IDictionary<string, object>)setting;
                if (sd.ContainsKey("BuyDis") && sd["BuyDis"] != DBNull.Value)
                    buyDis = sd["BuyDis"].ToString() ?? "";
                if (sd.ContainsKey("SelsDis") && sd["SelsDis"] != DBNull.Value)
                    selsDis = sd["SelsDis"].ToString() ?? "";
            }
        }
        catch { }

        // ─── ۴. پاک کردن سند قبلی (ParentSanad قدیمی — orphan رو تمیز می‌کنیم) ───
        // نکته: SP خودش Sanad ها رو DELETE می‌کنه، ولی ParentSanad قدیمی رو نمی‌زنه.
        // اگه قبلاً سند داشته، اول ParentSanad قدیمی رو پاک می‌کنیم.
        var existingParentId = fd["Parent_Sanad_ID"];
        if (existingParentId != null && existingParentId != DBNull.Value)
        {
            var oldPid = Convert.ToInt64(existingParentId);
            if (oldPid > 0)
            {
                // اگه Vazeit=2 (قطعی) باشه، اجازه‌ی حذف نده
                var vazeit = await conn.ExecuteScalarAsync<int?>(
                    new CommandDefinition(
                        "SELECT Vazeit FROM ParentSanad WHERE ParentSanadID = @pid",
                        new { pid = oldPid }, cancellationToken: ct));

                if (vazeit == 2)
                {
                    result.Error = "سند قبلی قطعی است — ابتدا از صفحه اسناد قطعیت آن را لغو کنید";
                    return result;
                }

                // پاک کردن Sanad های قدیمی + ParentSanad قدیمی
                await conn.ExecuteAsync(new CommandDefinition(
                    "DELETE FROM Sanad WHERE ParentSanadCode = @pid",
                    new { pid = oldPid }, cancellationToken: ct));

                await conn.ExecuteAsync(new CommandDefinition(
                    "DELETE FROM ParentSanad WHERE ParentSanadID = @pid",
                    new { pid = oldPid }, cancellationToken: ct));

                // خالی کردن فیلد فاکتور
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE FactorParent SET Parent_Sanad_ID = NULL WHERE ID = @fid",
                    new { fid = factorId }, cancellationToken: ct));
            }
        }

        // ─── ۵. صدا زدن SP (فقط همین — SP همه کار رو می‌کنه) ───
        try
        {
            var p = new DynamicParameters();
            p.Add("FactorKind", factorKind);
            p.Add("aNo_Sanad", request.NoSanad);
            p.Add("FactorID", factorId);
            p.Add("TAX_Tax", taxPer);
            p.Add("TAX_Avarez", avarezPer);
            p.Add("BuyDis", buyDis);
            p.Add("SelsDis", selsDis);
            p.Add("Return_Value",
                  dbType: System.Data.DbType.Int32,
                  direction: System.Data.ParameterDirection.ReturnValue);

            await conn.ExecuteAsync(new CommandDefinition(
                "Save_Factor_Sanad",
                p,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct));

            var returnCode = p.Get<int>("Return_Value");

            // ─── ۶. خواندن شماره سند جدید ───
            var newSanadNo = await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(@"
                SELECT TOP 1 P.No_Sanad 
                FROM FactorParent F
                INNER JOIN ParentSanad P ON P.ParentSanadID = F.Parent_Sanad_ID
                WHERE F.ID = @factorId",
                    new { factorId }, cancellationToken: ct));

            if (newSanadNo == null)
            {
                result.Error = $"SP اجرا شد (Return={returnCode}) ولی سند ثبت نشد";
                return result;
            }

            result.NoSanad = newSanadNo;
            result.Success = true;

            _logger.LogInformation(
                "سند فاکتور {FactorId} ثبت شد — سند {NoSanad} (SP Return={Ret})",
                factorId, newSanadNo, returnCode);

            // ─── ۷. سند بازاریاب (اختیاری) ───
            if (request.WithMarketer)
            {
                try
                {
                    // اگه بازاریاب قبلاً سند داشت، پاک کن
                    var oldMkParentId = fd["NoSanad_ID_Marketer"];
                    if (oldMkParentId != null && oldMkParentId != DBNull.Value)
                    {
                        var oldMk = Convert.ToInt64(oldMkParentId);
                        if (oldMk > 0)
                        {
                            await conn.ExecuteAsync(new CommandDefinition(
                                "DELETE FROM Sanad WHERE ParentSanadCode = @pid",
                                new { pid = oldMk }, cancellationToken: ct));
                            await conn.ExecuteAsync(new CommandDefinition(
                                "DELETE FROM ParentSanad WHERE ParentSanadID = @pid",
                                new { pid = oldMk }, cancellationToken: ct));
                        }
                    }

                    var pm = new DynamicParameters();
                    pm.Add("FactorKind", factorKind);
                    pm.Add("aNo_Sanad", request.NoSanadMarketer);
                    pm.Add("FactorID", factorId);
                    pm.Add("Return_Value",
                           dbType: System.Data.DbType.Int32,
                           direction: System.Data.ParameterDirection.ReturnValue);

                    await conn.ExecuteAsync(new CommandDefinition(
                        "Save_Factor_SanadMarketer",
                        pm,
                        commandType: CommandType.StoredProcedure,
                        cancellationToken: ct));

                    var mkNo = await conn.ExecuteScalarAsync<long?>(
                        new CommandDefinition(@"
                        SELECT TOP 1 P.No_Sanad 
                        FROM FactorParent F
                        INNER JOIN ParentSanad P ON P.ParentSanadID = F.NoSanad_ID_Marketer
                        WHERE F.ID = @factorId",
                            new { factorId }, cancellationToken: ct));

                    result.NoSanadMarketer = mkNo;
                }
                catch (Exception mkEx)
                {
                    _logger.LogWarning(mkEx, "خطا در سند بازاریاب فاکتور {FactorId}", factorId);
                }
            }

            return result;
        }
        catch (Exception ex)
        {
            result.Error = ex.Message;
            _logger.LogError(ex, "خطا در ثبت سند فاکتور {FactorId}", factorId);
            return result;
        }
    }

    public async Task<SanadBulkResultDto> BulkCreateSanadAsync(
        long orgId, long fyId, SanadBulkRequestDto request,
        CancellationToken ct = default)
    {
        var result = new SanadBulkResultDto();

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        // ─── لیست فاکتورهای بدون سند (یا با فیلتر) ───
        var sql = @"
        SELECT ID, NoFactor
        FROM FactorParent
        WHERE Parent_Sanad_ID IS NULL OR Parent_Sanad_ID = 0";

        // اگه فیلتر داده شده، اضافه کن
        var p = new DynamicParameters();
        if (request.Filter != null)
        {
            if (request.Filter.FactorKind.HasValue)
            {
                sql += " AND FactorKind = @kind";
                p.Add("kind", request.Filter.FactorKind.Value);
            }
            if (request.Filter.NoFrom.HasValue)
            {
                sql += " AND NoFactor >= @noFrom";
                p.Add("noFrom", request.Filter.NoFrom.Value);
            }
            if (request.Filter.NoTo.HasValue)
            {
                sql += " AND NoFactor <= @noTo";
                p.Add("noTo", request.Filter.NoTo.Value);
            }
        }

        sql += " ORDER BY NoFactor";

        var factors = (await conn.QueryAsync<dynamic>(
            new CommandDefinition(sql, p, cancellationToken: ct))).ToList();

        result.TotalCount = factors.Count;

        if (factors.Count == 0)
            return result;

        // ─── نرخ مالیات (یک بار) ───
        decimal taxPer = 0, avarezPer = 0;
        try
        {
            await using var permConn = _factory.CreatePermanentConnection();
            await permConn.OpenAsync(ct);

            var taxRow = await permConn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition(@"
                SELECT ISNULL(Tax_Per, 0) AS TaxPer, ISNULL(Avarez_Per, 0) AS AvarezPer
                FROM DorehMali
                WHERE DorehMaliID = @fyId AND SazmanCode = @orgId",
                    new { fyId, orgId }, cancellationToken: ct));

            if (taxRow != null)
            {
                var td = (IDictionary<string, object>)taxRow;
                taxPer = GetDecimalSafe(td, "TaxPer");
                avarezPer = GetDecimalSafe(td, "AvarezPer");
            }
        }
        catch { }

        string buyDis = "", selsDis = "";
        try
        {
            var setting = await conn.QueryFirstOrDefaultAsync<dynamic>(
                new CommandDefinition("SELECT TOP 1 * FROM Setting", cancellationToken: ct));
            if (setting != null)
            {
                var sd = (IDictionary<string, object>)setting;
                if (sd.ContainsKey("BuyDis") && sd["BuyDis"] != null && sd["BuyDis"] != DBNull.Value)
                    buyDis = sd["BuyDis"].ToString() ?? "";
                if (sd.ContainsKey("SelsDis") && sd["SelsDis"] != null && sd["SelsDis"] != DBNull.Value)
                    selsDis = sd["SelsDis"].ToString() ?? "";
            }
        }
        catch { }

        // ─── شماره سند مشترک برای mode 0 ───
        long? sharedSanadNo = null;
        if (request.Mode == 0)
        {
            // حالت «یک سند کلی»
            // بار اول 0 پاس می‌دیم، SP خودش شماره جدید می‌سازه
            // بعدش MAX رو می‌گیریم و برای بقیه پاس می‌دیم
        }

        // ─── حلقه روی فاکتورها ───
        foreach (var f in factors)
        {
            var fd = (IDictionary<string, object>)f;
            var factorId = Convert.ToInt64(fd["ID"]);
            var noFactor = Convert.ToInt64(fd["NoFactor"]);

            var itemResult = new SanadCreateResultDto
            {
                FactorId = factorId,
                NoFactor = noFactor
            };

            try
            {
                var factorKind = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition(
                        "SELECT FactorKind FROM FactorParent WHERE ID = @id",
                        new { id = factorId }, cancellationToken: ct));

                // ─── انتخاب شماره سند ───
                long sanadNoToPass;
                if (request.Mode == 0)
                {
                    // یک سند کلی
                    sanadNoToPass = sharedSanadNo ?? 0;
                }
                else
                {
                    // جداگانه
                    sanadNoToPass = 0;
                }

                await conn.ExecuteAsync(
                    new CommandDefinition(
                        "Save_Factor_Sanad",
                        new
                        {
                            FactorKind = factorKind,
                            aNo_Sanad = sanadNoToPass,
                            FactorID = factorId,
                            TAX_Tax = taxPer,
                            TAX_Avarez = avarezPer,
                            BuyDis = buyDis,
                            SelsDis = selsDis
                        },
                        commandType: CommandType.StoredProcedure,
                        cancellationToken: ct));
                var newParentId = await conn.ExecuteScalarAsync<long?>(
                    new CommandDefinition(
                        "SELECT Parent_Sanad_ID FROM FactorParent WHERE ID = @factorId",
                        new { factorId }, cancellationToken: ct));

                if (newParentId == null || newParentId == 0)
                {
                    itemResult.Error = "SP اجرا شد ولی سند ثبت نشد";
                    result.FailCount++;
                    result.Results.Add(itemResult);
                    continue;
                }
                // ─── بعد از اولین فاکتور در mode 0، MAX رو بگیر ───
                if (request.Mode == 0 && sharedSanadNo == null)
                {
                    sharedSanadNo = await conn.ExecuteScalarAsync<long?>(
                        new CommandDefinition(
                            "SELECT MAX(No_Sanad) FROM ParentSanad",
                            cancellationToken: ct));
                }

                // ─── شماره سند نهایی فاکتور ───
                var newSanadNo = await conn.ExecuteScalarAsync<long?>(
                    new CommandDefinition(@"
                    SELECT TOP 1 P.No_Sanad 
                    FROM FactorParent F
                    INNER JOIN ParentSanad P ON P.ParentSanadID = F.Parent_Sanad_ID
                    WHERE F.ID = @factorId",
                        new { factorId }, cancellationToken: ct));

                itemResult.NoSanad = newSanadNo;
                itemResult.Success = true;
                result.SuccessCount++;
            }
            catch (Exception ex)
            {
                itemResult.Error = ex.Message;
                result.FailCount++;
                _logger.LogError(ex, "خطا در ثبت سند گروهی فاکتور {FactorId}", factorId);
            }

            result.Results.Add(itemResult);
        }

        return result;
    }

    public async Task DeleteSanadAsync(
        long orgId, long fyId, long factorId,
        CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        if (conn.State != ConnectionState.Open)
            await conn.OpenAsync(ct);

        // ─── چک: آیا فاکتور سند داره؟ ───
        var parentId = await conn.ExecuteScalarAsync<long?>(
            new CommandDefinition(
                "SELECT Parent_Sanad_ID FROM FactorParent WHERE ID = @factorId",
                new { factorId }, cancellationToken: ct));

        if (parentId == null || parentId == 0)
            throw new InvalidOperationException("این فاکتور سند ثبت‌شده ندارد");

        // ─── چک: وضعیت سند (اگه قطعی باشه، حذف نکن) ───
        var vazeit = await conn.ExecuteScalarAsync<int?>(
            new CommandDefinition(
                "SELECT Vazeit FROM ParentSanad WHERE ParentSanadID = @parentId",
                new { parentId }, cancellationToken: ct));

        if (vazeit == 2)
            throw new InvalidOperationException(
                "سند قطعی است و قابل حذف نیست — ابتدا از صفحه اسناد، قطعیت آن را لغو کنید");

        await using var tx = conn.BeginTransaction();
        try
        {
            // ─── حذف ردیف‌های سند ───
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM Sanad WHERE ParentSanadCode = @parentId",
                    new { parentId }, transaction: tx, cancellationToken: ct));

            // ─── حذف سرسند ───
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM ParentSanad WHERE ParentSanadID = @parentId",
                    new { parentId }, transaction: tx, cancellationToken: ct));

            // ─── خالی کردن فیلد فاکتور ───
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "UPDATE FactorParent SET Parent_Sanad_ID = NULL WHERE ID = @factorId",
                    new { factorId }, transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { }
            throw;
        }
    }
}