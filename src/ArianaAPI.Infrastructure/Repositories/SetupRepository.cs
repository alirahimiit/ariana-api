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

    // ⭐ جدید: خواندن maxOrgs از فایل لایسنس
    private int GetMaxOrgsFromLicense()
    {
        try
        {
            var licPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ariana.lic");
            if (!File.Exists(licPath)) return 0;
            using var doc = JsonDocument.Parse(File.ReadAllText(licPath));
            if (doc.RootElement.TryGetProperty("payload", out var payload) &&
                payload.TryGetProperty("maxOrgs", out var maxOrgs))
            {
                return maxOrgs.GetInt32();
            }
        }
        catch { }
        return 0;
    }

    public async Task<bool> AuthenticateAsync(string username, string password, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_permanentConnectionString);
        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM Setting WHERE UName = @u AND UP = @p",
                new { u = username, p = password }, cancellationToken: ct));
        return count > 0;
    }

    public async Task<SetupSazmanListResultDto> GetSazmansAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_permanentConnectionString);

        var dbList = (await conn.QueryAsync<SazmanItemDto>(
            new CommandDefinition(
                "SELECT SazmanID AS Id, Name, ISNULL(LicenceSazman, '') AS LicenceSazman FROM Sazman ORDER BY SazmanID",
                cancellationToken: ct))).ToList();

        var maxOrgs = GetMaxOrgsFromLicense();

        // ⭐ اول N سازمان (به ترتیب SazmanID)
        var validExistingSazmans = dbList.Take(maxOrgs).ToList();

        var canCreateNew = dbList.Count < maxOrgs;
        var nextAvailableId = dbList.Count > 0
            ? dbList.Max(x => x.Id) + 1
            : 1L;

        return new SetupSazmanListResultDto
        {
            ExistingSazmans = validExistingSazmans,
            CanCreateNew = canCreateNew,
            NextAvailableId = nextAvailableId,
            TotalAuthorized = maxOrgs,          // ⭐ نامش قدیمیه، ولی معنی‌اش maxOrgs هست
            UsedCount = dbList.Count
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

        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        var todayPersian = $"{pc.GetYear(now):D4}/{pc.GetMonth(now):D2}/{pc.GetDayOfMonth(now):D2}";
        var currentTime = now.ToString("HH:mm");

        // ⭐ ۲. ثبت سازمان جدید (در صورت نیاز) — با چک تعداد
        if (finalSazmanId == 0)
        {
            var maxOrgs = GetMaxOrgsFromLicense();
            if (maxOrgs <= 0)
                throw new Exception("محدودیت لایسنس: فایل لایسنس معتبر نیست یا maxOrgs تعریف نشده.");

            var currentCount = await permConn.ExecuteScalarAsync<int>(
                new CommandDefinition("SELECT COUNT(*) FROM Sazman", cancellationToken: ct));

            if (currentCount >= maxOrgs)
                throw new Exception(
                    $"محدودیت لایسنس: حداکثر {maxOrgs} سازمان مجاز است و در حال حاضر {currentCount} سازمان وجود دارد.");

            // ID بعدی = MAX + 1
            finalSazmanId = await permConn.ExecuteScalarAsync<long>(
                new CommandDefinition("SELECT ISNULL(MAX(SazmanID), 0) + 1 FROM Sazman", cancellationToken: ct));

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

        string defaultDataPath = Path.Combine(AppContext.BaseDirectory, "Data", "Database");
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
            await conn.ExecuteAsync(new CommandDefinition("EXEC sp_MSforeachtable \"ALTER TABLE ? NOCHECK CONSTRAINT all\"", transaction: tx, cancellationToken: ct));

            if (req.CopyArticle)
            {
                await conn.ExecuteAsync(new CommandDefinition(@"
                    UPDATE A
                    SET 
                        A.AmountFirst = 
                            ISNULL(A.AmountFirst, 0) 
                            + ISNULL((SELECT SUM(ArticleCount) FROM FactorDetail fd INNER JOIN FactorParent fp ON fp.ID = fd.FactorID WHERE fd.ArticleID = A.ID AND fp.FactorKind = 0), 0)
                            + ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat sfm INNER JOIN Stock_Factor sf ON sf.ID = sfm.StockFacorID WHERE sfm.ArticleID = A.ID AND sf.Kind = 0), 0)
                            + ISNULL((SELECT SUM(ArticleCount) FROM FactorDetail fd INNER JOIN FactorParent fp ON fp.ID = fd.FactorID WHERE fd.ArticleID = A.ID AND fp.FactorKind = 2), 0)
                            + ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat sfm INNER JOIN Stock_Factor sf ON sf.ID = sfm.StockFacorID WHERE sfm.ArticleID = A.ID AND sf.Kind = 2), 0)
                            - ISNULL((SELECT SUM(ArticleCount) FROM FactorDetail fd INNER JOIN FactorParent fp ON fp.ID = fd.FactorID WHERE fd.ArticleID = A.ID AND fp.FactorKind = 1), 0)
                            - ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat sfm INNER JOIN Stock_Factor sf ON sf.ID = sfm.StockFacorID WHERE sfm.ArticleID = A.ID AND sf.Kind = 1), 0)
                            - ISNULL((SELECT SUM(Val) FROM Stock_Factor_Mat sfm INNER JOIN Stock_Factor sf ON sf.ID = sfm.StockFacorID WHERE sfm.ArticleID = A.ID AND sf.Kind = 3), 0),
                        
                        A.CostFirst = COALESCE(NULLIF(A.FinalVal1, 0), A.CostFirst, 0),

                        A.inAmount1 = 0, A.OutAmount1 = 0, A.BackAmount1 = 0, A.FinalAmount1 = 0,
                        A.inVal1 = 0, A.OutVal1 = 0, A.BackVal1 = 0, A.FinalVal1 = 0
                    FROM ArticleNew A
                ", transaction: tx, cancellationToken: ct));
            }
            else
            {
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleNew", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleGroup", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM StockType", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleUnit", transaction: tx, cancellationToken: ct));
            }

            await conn.ExecuteAsync(new CommandDefinition(@"
                UPDATE CheckPay SET ParentSanadID = NULL, ParentSanadOKID = NULL;
                UPDATE CheckRecive SET ParentSanadID = NULL, ParentSanadOKID = NULL, UnOkParentSanadID = NULL;
                UPDATE CheckExpend SET ParentSanadID = NULL;
            ", transaction: tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(@"
                DELETE FROM Sanad;
                DELETE FROM ParentSanad;
                DELETE FROM RecycleSanad;
                DELETE FROM RecycleParentSanad;
            ", transaction: tx, cancellationToken: ct));

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