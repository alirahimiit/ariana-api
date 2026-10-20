using ArianaAPI.Application.DTOs.Setup;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Services;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System.Data;
using System.Text.Json;
using System.Linq;

namespace ArianaAPI.Infrastructure.Repositories;

public class SetupRepository : ISetupRepository
{
    private readonly IConfiguration _config;
    private readonly string _masterConnectionString;
    private readonly string _permanentConnectionString;
    private readonly string _prefix;

    private class RestoreFileListResult
    {
        public string LogicalName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
    }

    public SetupRepository(IConfiguration config)
    {
        _config = config;
        var server = _config["Database:Server"] ?? "localhost";
        var user = _config["Database:UserId"] ?? "sa";
        var pass = _config["Database:Password"] ?? "";
        var permanentDb = _config["Database:DatabaseName"] ?? "Permanent";
        _prefix = _config["Database:Prefix"] ?? "Acounting_";

        _masterConnectionString = BuildConnStr(server, "master", user, pass);
        _permanentConnectionString = BuildConnStr(server, permanentDb, user, pass);
    }

    private string BuildConnStr(string server, string db, string user, string pass)
    {
        return new SqlConnectionStringBuilder
        {
            DataSource = server,
            UserID = user,
            Password = pass,
            InitialCatalog = db,
            TrustServerCertificate = true,
            ConnectTimeout = 60
        }.ConnectionString;
    }

    private List<long> GetAuthorizedOrgsFromLicense()
    {
        try
        {
            var licPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ariana.lic");
            if (!File.Exists(licPath)) return new List<long>();
            using var doc = JsonDocument.Parse(File.ReadAllText(licPath));
            if (doc.RootElement.TryGetProperty("payload", out var payload) &&
                payload.TryGetProperty("authorizedOrgs", out var orgs))
            {
                return orgs.EnumerateArray().Select(x => x.GetInt64()).ToList();
            }
        }
        catch { }
        return new List<long>();
    }

    public async Task<bool> AuthenticateAsync(string username, string password, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_permanentConnectionString);
        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM Setting WHERE UName = @u AND UP = @p", new { u = username, p = password }, cancellationToken: ct));
        return count > 0;
    }

    public async Task<SetupSazmanListResultDto> GetSazmansAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_permanentConnectionString);

        // دریافت تمام سازمان‌های موجود در دیتابیس
        var dbList = (await conn.QueryAsync<SazmanItemDto>(
            new CommandDefinition("SELECT SazmanID AS Id, Name, ISNULL(LicenceSazman, '') AS LicenceSazman FROM Sazman", cancellationToken: ct))).ToList();

        // خواندن IDهای مجاز از فایل لایسنس
        var authorizedIds = GetAuthorizedOrgsFromLicense();

        // ⭐ فیلتر کردن سازمان‌های دیتابیس: فقط سازمان‌هایی که ID آن‌ها در لایسنس هست نمایش داده شوند
        var validExistingSazmans = dbList.Where(x => authorizedIds.Contains(x.Id)).ToList();

        // محاسبه IDهایی که در لایسنس هستند ولی هنوز در دیتابیس ساخته نشده‌اند
        var existingIds = validExistingSazmans.Select(x => x.Id).ToList();
        var availableIds = authorizedIds.Except(existingIds).ToList();

        return new SetupSazmanListResultDto
        {
            ExistingSazmans = validExistingSazmans, // ⭐ فقط سازمان‌های مجاز
            CanCreateNew = availableIds.Any(),
            NextAvailableId = availableIds.FirstOrDefault(),
            TotalAuthorized = authorizedIds.Count(),
            UsedCount = validExistingSazmans.Count // تعداد سازمان‌های مجازِ ساخته‌شده
        };
    }
    public async Task<List<DorehMaliItemDto>> GetDorehMalisAsync(long sazmanId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_permanentConnectionString);
        var list = await conn.QueryAsync<DorehMaliItemDto>(
            new CommandDefinition(@"
                SELECT D.DorehMaliID AS Id, D.Name, D.BeginDate, D.EndDate, ISNULL(S.Name, '') AS SazmanName
                FROM DorehMali D
                LEFT JOIN Sazman S ON S.SazmanID = D.SazmanCode
                WHERE D.SazmanCode = @sazmanId
                ORDER BY D.BeginDate DESC",
                new { sazmanId }, cancellationToken: ct));
        return list.ToList();
    }

    public async Task<SetupResultDto> CreateDorehMaliAsync(SetupRequestDto req, CancellationToken ct = default)
    {
        if (!await AuthenticateAsync(req.Username, req.Password, ct))
            throw new UnauthorizedAccessException("نام کاربری یا رمز عبور نامعتبر است.");

        long finalSazmanId = req.SazmanId;

        await using var permConn = new SqlConnection(_permanentConnectionString);
        await permConn.OpenAsync(ct);

        // ⭐ ۱. دریافت تاریخ و ساعت شمسی (فقط یک بار در بالاترین سطح)
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        var todayPersian = $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
        var currentTime = now.ToString("HH:mm");

        // ⭐ ۲. ثبت سازمان جدید (در صورت نیاز)
        if (finalSazmanId == 0)
        {
            var authorizedIds = GetAuthorizedOrgsFromLicense();
            var existingIds = (await permConn.QueryAsync<long>(
                new CommandDefinition("SELECT SazmanID FROM Sazman", cancellationToken: ct))).ToList();

            var availableIds = authorizedIds.Except(existingIds).ToList();
            if (!availableIds.Any()) throw new Exception("محدودیت لایسنس: تمام سازمان‌های مجاز ایجاد شده‌اند.");

            finalSazmanId = availableIds.First();

            await permConn.ExecuteAsync(new CommandDefinition("SET IDENTITY_INSERT Sazman ON", cancellationToken: ct));
            await permConn.ExecuteAsync(new CommandDefinition(@"
                INSERT INTO Sazman (
                    SazmanID, Name, LicenceSazman, SysID, NationalCode, RegNo, EcoNo, PostalCode, 
                    Ostan, CityName1, CityName2, Address, PhoneNo, Date_Op, Time_Op
                ) 
                VALUES (
                    @Id, @Name, @Code, '', @NationalCode, @RegNo, @EcoNo, @PostalCode, 
                    @Ostan, @CityName1, @CityName2, @Address, @PhoneNo, @DateOp, @TimeOp
                )",
                new
                {
                    Id = finalSazmanId,
                    Name = req.SazmanName,
                    Code = req.SazmanCode,
                    NationalCode = req.SazmanNationalCode ?? "",
                    RegNo = req.SazmanRegNo ?? "",
                    EcoNo = req.SazmanEcoNo ?? "",
                    PostalCode = req.SazmanPostalCode ?? "",
                    Ostan = req.SazmanOstan ?? "",
                    CityName1 = req.SazmanCityName1 ?? "",
                    CityName2 = req.SazmanCityName2 ?? "",
                    Address = req.SazmanAddress ?? "",
                    PhoneNo = req.SazmanPhoneNo ?? "",
                    DateOp = todayPersian,
                    TimeOp = currentTime
                }, cancellationToken: ct));
            await permConn.ExecuteAsync(new CommandDefinition("SET IDENTITY_INSERT Sazman OFF", cancellationToken: ct));
        }

        // ⭐ ۳. ثبت دوره مالی جدید
        var newFyId = await permConn.ExecuteScalarAsync<long>(
            new CommandDefinition(@"
                INSERT INTO DorehMali (
                    Name, BeginDate, EndDate, SazmanCode, PriorDorehMaliCode, Tax_Per, Avarez_Per, UpDate_Database,
                    Discript, AddedHesabs, AddedUsers, AddedSetting, Code_Op, Date_Op, Time_Op, EndSanadNum, BeginSanadNum
                )
                OUTPUT INSERTED.DorehMaliID
                VALUES (
                    @Name, @BeginDate, @EndDate, @SazmanCode, @Prior, @Tax, @Avarez, @Ver,
                    '', 0, 0, 0, 0, @DateOp, @TimeOp, 0, 0
                )",
                new
                {
                    Name = req.Name,
                    BeginDate = req.BeginDate,
                    EndDate = req.EndDate,
                    SazmanCode = finalSazmanId,
                    Prior = req.PriorDorehMaliCode,
                    Tax = req.Tax_Per,
                    Avarez = req.Avarez_Per,
                    Ver = DatabaseUpdater.C_VERSION_DATABASE,
                    DateOp = todayPersian,
                    TimeOp = currentTime
                }, cancellationToken: ct));

        var newDbName = $"{_prefix}{finalSazmanId}_{newFyId}";

        await using var masterConn = new SqlConnection(_masterConnectionString);
        await masterConn.OpenAsync(ct);

        var dbExists = await masterConn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM sys.databases WHERE name = @name",
            new { name = newDbName }, cancellationToken: ct));

        if (dbExists > 0)
            throw new InvalidOperationException($"دیتابیس {newDbName} از قبل وجود دارد.");

        string? priorDbName = null;
        if (req.IsFirstDoreh)
        {
            var bakPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "system", "DorehCreation.bak");
            await RestoreDatabaseAsync(masterConn, newDbName, bakPath, ct);
        }
        else
        {
            var sourceSazmanId = req.PriorSazmanCode > 0 ? req.PriorSazmanCode : finalSazmanId;
            priorDbName = $"{_prefix}{sourceSazmanId}_{req.PriorDorehMaliCode}";

            var tempBak = Path.Combine(Path.GetTempPath(), $"{newDbName}_temp.bak");

            await masterConn.ExecuteAsync(new CommandDefinition(
                $"BACKUP DATABASE [{priorDbName}] TO DISK = N'{tempBak}' WITH INIT",
                commandTimeout: 300, cancellationToken: ct));

            await RestoreDatabaseAsync(masterConn, newDbName, tempBak, ct);

            if (File.Exists(tempBak)) File.Delete(tempBak);
        }

        // اجرای آپدیتر روی Permanent (با مدیریت خطا)
        try
        {
            await DatabaseUpdater.RunUpdaterAsync(_permanentConnectionString, isPermanent: true, ct);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Setup Repo Permanent Update Error] {ex.Message}");
        }

        var newDbConnStr = BuildConnStr(
            _config["Database:Server"] ?? "localhost",
            newDbName,
            _config["Database:UserId"] ?? "sa",
            _config["Database:Password"] ?? "");

        // اجرای آپدیتر روی دیتابیس دوره جدید (با مدیریت خطا)
        try
        {
            await DatabaseUpdater.RunUpdaterAsync(newDbConnStr, isPermanent: false, ct);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Setup Repo Tenant Update Error] {ex.Message}");
        }

        await using var newConn = new SqlConnection(newDbConnStr);
        await newConn.OpenAsync(ct);
        await ProcessDataCopyAndCleanupAsync(newConn, req, priorDbName, ct);

        return new SetupResultDto
        {
            Success = true,
            Message = "دوره مالی با موفقیت ایجاد شد.",
            NewDorehMaliId = newFyId,
            NewDbName = newDbName
        };
    }

    private async Task RestoreDatabaseAsync(SqlConnection conn, string newDbName, string bakPath, CancellationToken ct)
    {
        var fileList = await conn.QueryAsync<RestoreFileListResult>(new CommandDefinition($"RESTORE FILELISTONLY FROM DISK = N'{bakPath}'", commandTimeout: 120, cancellationToken: ct));
        var dataFile = fileList.FirstOrDefault(x => x.Type.Trim() == "D");
        var logFile = fileList.FirstOrDefault(x => x.Type.Trim() == "L");

        if (dataFile == null || logFile == null) throw new InvalidOperationException("ساختار فایل بک‌آپ نامعتبر است.");

        string defaultDataPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data", "Database");
        if (!Directory.Exists(defaultDataPath)) Directory.CreateDirectory(defaultDataPath);

        var sql = $@"
            RESTORE DATABASE [{newDbName}] 
            FROM DISK = N'{bakPath}' 
            WITH 
                MOVE N'{dataFile.LogicalName}' TO N'{Path.Combine(defaultDataPath, $"{newDbName}.mdf")}',
                MOVE N'{logFile.LogicalName}' TO N'{Path.Combine(defaultDataPath, $"{newDbName}_log.ldf")}',
                REPLACE, RECOVERY";

        await conn.ExecuteAsync(new CommandDefinition(sql, commandTimeout: 600, cancellationToken: ct));
    }

    private async Task ProcessDataCopyAndCleanupAsync(SqlConnection conn, SetupRequestDto req, string? priorDbName, CancellationToken ct)
    {
        using var tx = conn.BeginTransaction();
        try
        {
            // ⭐ ۱. غیرفعال کردن موقت Foreign Key ها
            await conn.ExecuteAsync(new CommandDefinition("EXEC sp_MSforeachtable \"ALTER TABLE ? NOCHECK CONSTRAINT all\"", transaction: tx, cancellationToken: ct));

            // ⭐ ۲. محاسبه مانده واقعی کالاها و انتقال به موجودی اولیه (قبل از حذف اسناد و فاکتورها)
            if (req.CopyArticle)
            {
                await conn.ExecuteAsync(new CommandDefinition(@"
                    UPDATE A
                    SET 
                        -- محاسبه مانده مقداری (خرید + رسید + برگشت خرید + رسید برگشتی - فروش - حواله - ضایعات)
                        A.AmountFirst = 
                            ISNULL(A.AmountFirst, 0) 
                            + ISNULL((SELECT SUM(ArticleCount) FROM FactorDetail fd INNER JOIN FactorParent fp ON fp.ID = fd.FactorID WHERE fd.ArticleID = A.ID AND fp.FactorKind = 0), 0)
                            + ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat sfm INNER JOIN Stock_Factor sf ON sf.ID = sfm.StockFacorID WHERE sfm.ArticleID = A.ID AND sf.Kind = 0), 0)
                            + ISNULL((SELECT SUM(ArticleCount) FROM FactorDetail fd INNER JOIN FactorParent fp ON fp.ID = fd.FactorID WHERE fd.ArticleID = A.ID AND fp.FactorKind = 2), 0)
                            + ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat sfm INNER JOIN Stock_Factor sf ON sf.ID = sfm.StockFacorID WHERE sfm.ArticleID = A.ID AND sf.Kind = 2), 0)
                            - ISNULL((SELECT SUM(ArticleCount) FROM FactorDetail fd INNER JOIN FactorParent fp ON fp.ID = fd.FactorID WHERE fd.ArticleID = A.ID AND fp.FactorKind = 1), 0)
                            - ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat sfm INNER JOIN Stock_Factor sf ON sf.ID = sfm.StockFacorID WHERE sfm.ArticleID = A.ID AND sf.Kind = 1), 0)
                            - ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat sfm INNER JOIN Stock_Factor sf ON sf.ID = sfm.StockFacorID WHERE sfm.ArticleID = A.ID AND sf.Kind = 3), 0),
                        
                        -- محاسبه مانده ریالی (اگر FinalVal1 صفر بود، همان CostFirst قبلی می‌ماند)
                        A.CostFirst = COALESCE(NULLIF(A.FinalVal1, 0), A.CostFirst, 0),

                        -- صفر کردن فیلدهای تراکنشی برای شروع سال جدید
                        A.inAmount1 = 0, A.OutAmount1 = 0, A.BackAmount1 = 0, A.FinalAmount1 = 0,
                        A.inVal1 = 0, A.OutVal1 = 0, A.BackVal1 = 0, A.FinalVal1 = 0
                    FROM ArticleNew A
                ", transaction: tx, cancellationToken: ct));
            }
            else
            {
                // اگر تیک انتقال کالا زده نشده، کالاها را کاملاً پاک کن
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleNew", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleGroup", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM StockType", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleUnit", transaction: tx, cancellationToken: ct));
            }

            // ⭐ ۳. قطع ارتباط چک‌ها با اسناد
            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckPay SET ParentSanadID = NULL, ParentSanadOKID = NULL;
                UPDATE CheckRecive SET ParentSanadID = NULL, ParentSanadOKID = NULL, UnOkParentSanadID = NULL;
                UPDATE CheckExpend SET ParentSanadID = NULL;
            ", transaction: tx, cancellationToken: ct));

            // ⭐ ۴. حذف کامل تمام اسناد (هیچ سندی منتقل نمی‌شود)
            await conn.ExecuteAsync(new CommandDefinition(@"
                DELETE FROM Sanad;
                DELETE FROM ParentSanad;
                DELETE FROM RecycleSanad;
                DELETE FROM RecycleParentSanad;
            ", transaction: tx, cancellationToken: ct));

            // ⭐ ۵. حذف فاکتورها، اسناد موقت و جداول چاپی
            var tablesToClear = new[] {
                "FactorDetail", "FactorParent", "FactorDetailTemp", "FactorParentTemp",
                "SanadTemp", "SanadMovaghat", "SanadCopyTemp",
                "tax_body", "tax_header",
                "BilanPrint", "DaftarColPrint", "DaftarColPrintFinall",
                "DaftarRoozNamehPrint", "TarazPrint", "TavaliAsnad", "HesabPrint2", "CheckResids",
                "Stock_Factor", "Stock_Factor_Mat"
            };

            foreach (var tbl in tablesToClear)
            {
                await conn.ExecuteAsync(new CommandDefinition($"IF OBJECT_ID('{tbl}') IS NOT NULL DELETE FROM [{tbl}]", transaction: tx, cancellationToken: ct));
            }

            // ⭐ ۶. پاکسازی جداول پایه (طبق تیک‌های کاربر)
            if (!req.CopyHesabs)
            {
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Hesab", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ConstHesabs", transaction: tx, cancellationToken: ct));
            }
            if (!req.CopyTafzili)
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Hesab WHERE Code_Col = -1", transaction: tx, cancellationToken: ct));
            if (!req.CopyTafzili2)
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Tafzili2", transaction: tx, cancellationToken: ct));
            if (!req.CopyUsers)
            {
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Users", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM UserGroup", transaction: tx, cancellationToken: ct));
            }
            if (!req.CopyBank)
            {
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Bank", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM BankAcc", transaction: tx, cancellationToken: ct));
            }
            if (!req.CopyConstHesabs)
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ConstHesabs", transaction: tx, cancellationToken: ct));
            if (!req.CopySetting)
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Setting", transaction: tx, cancellationToken: ct));

            // ⭐ ۷. فعال کردن مجدد Foreign Key ها
            await conn.ExecuteAsync(new CommandDefinition("EXEC sp_MSforeachtable \"ALTER TABLE ? CHECK CONSTRAINT all\"", transaction: tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }
}