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
                INSERT INTO Sazman (SazmanID, Name, LicenceSazman, SysID, Date_Op, Time_Op) 
                VALUES (@Id, @Name, @Code, '', dbo.GetMToSDate(GETDATE()), CONVERT(varchar(8), GETDATE(), 108))",
                new { Id = finalSazmanId, Name = req.SazmanName, Code = req.SazmanCode }, cancellationToken: ct));
            await permConn.ExecuteAsync(new CommandDefinition("SET IDENTITY_INSERT Sazman OFF", cancellationToken: ct));
        }

        var newFyId = await permConn.ExecuteScalarAsync<long>(
            new CommandDefinition(@"
                INSERT INTO DorehMali (Name, BeginDate, EndDate, SazmanCode, PriorDorehMaliCode, Tax_Per, Avarez_Per, UpDate_Database)
                OUTPUT INSERTED.DorehMaliID
                VALUES (@Name, @BeginDate, @EndDate, @SazmanCode, @Prior, @Tax, @Avarez, @Ver)",
                new
                {
                    Name = req.Name,
                    BeginDate = req.BeginDate,
                    EndDate = req.EndDate,
                    SazmanCode = finalSazmanId,
                    Prior = req.PriorDorehMaliCode,
                    Tax = req.Tax_Per,
                    Avarez = req.Avarez_Per,
                    Ver = DatabaseUpdater.C_VERSION_DATABASE
                }, cancellationToken: ct));

        var newDbName = $"{_prefix}{finalSazmanId}_{newFyId}";

        await using var masterConn = new SqlConnection(_masterConnectionString);
        await masterConn.OpenAsync(ct);

        var dbExists = await masterConn.ExecuteScalarAsync<int>(
            new CommandDefinition("SELECT COUNT(*) FROM sys.databases WHERE name = @name", new { name = newDbName }, cancellationToken: ct));

        if (dbExists > 0) throw new InvalidOperationException($"دیتابیس {newDbName} از قبل وجود دارد.");

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

            await masterConn.ExecuteAsync(new CommandDefinition($"BACKUP DATABASE [{priorDbName}] TO DISK = N'{tempBak}' WITH INIT", commandTimeout: 300, cancellationToken: ct));
            await RestoreDatabaseAsync(masterConn, newDbName, tempBak, ct);
            if (File.Exists(tempBak)) File.Delete(tempBak);
        }

        await DatabaseUpdater.RunUpdaterAsync(_permanentConnectionString, isPermanent: true, ct);

        var newDbConnStr = BuildConnStr(_config["Database:Server"] ?? "localhost", newDbName, _config["Database:UserId"] ?? "sa", _config["Database:Password"] ?? "");
        await DatabaseUpdater.RunUpdaterAsync(newDbConnStr, isPermanent: false, ct);

        await using var newConn = new SqlConnection(newDbConnStr);
        await newConn.OpenAsync(ct);
        await ProcessDataCopyAndCleanupAsync(newConn, req, priorDbName, ct);

        return new SetupResultDto { Success = true, Message = "دوره مالی با موفقیت ایجاد شد.", NewDorehMaliId = newFyId, NewDbName = newDbName };
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
            // ۱. غیرفعال کردن موقت Foreign Key ها
            await conn.ExecuteAsync(new CommandDefinition("EXEC sp_MSforeachtable \"ALTER TABLE ? NOCHECK CONSTRAINT all\"", transaction: tx, cancellationToken: ct));

            // ۲. حذف اسناد غیر مرتبط با چک‌ها
            // ⚠️ توجه: فقط اسنادی پاک می‌شوند که به CheckPay، CheckRecive یا CheckExpend متصل نیستند.
            await conn.ExecuteAsync(new CommandDefinition(@"
                DELETE FROM Sanad 
                WHERE ParentSanadCode NOT IN (
                    SELECT ParentSanadID FROM CheckPay WHERE ParentSanadID IS NOT NULL
                    UNION
                    SELECT ParentSanadID FROM CheckRecive WHERE ParentSanadID IS NOT NULL
                    UNION
                    SELECT ParentSanadID FROM CheckExpend WHERE ParentSanadID IS NOT NULL
                );
                DELETE FROM ParentSanad WHERE ParentSanadID NOT IN (SELECT ParentSanadCode FROM Sanad);
                DELETE FROM FactorDetail;
                DELETE FROM FactorParent;
                DELETE FROM FactorDetailTemp;
                DELETE FROM FactorParentTemp;
                DELETE FROM SanadTemp;
                DELETE FROM SanadMovaghat;
                DELETE FROM SanadCopyTemp;
                DELETE FROM RecycleSanad;
                DELETE FROM RecycleParentSanad;
                DELETE FROM tax_body;
                DELETE FROM tax_header;
            ", transaction: tx, cancellationToken: ct));

            // ۳. حذف جداول چاپی و رسیدها با چک کردن وجود جدول (رفع خطای Invalid object name)
            var tablesToClear = new[] {
                "BilanPrint", "DaftarColPrint", "DaftarColPrintFinall",
                "DaftarRoozNamehPrint", "TarazPrint", "TavaliAsnad", "HesabPrint2", "CheckResids"
            };

            foreach (var tbl in tablesToClear)
            {
                await conn.ExecuteAsync(new CommandDefinition($"IF OBJECT_ID('{tbl}') IS NOT NULL DELETE FROM [{tbl}]", transaction: tx, cancellationToken: ct));
            }

            // ۴. پاکسازی جداول پایه (طبق تیک‌های کاربر)
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
            if (!req.CopyArticle)
            {
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleNew", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleGroup", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM StockType", transaction: tx, cancellationToken: ct));
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ArticleUnit", transaction: tx, cancellationToken: ct));
            }
            if (!req.CopyConstHesabs)
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM ConstHesabs", transaction: tx, cancellationToken: ct));
            if (!req.CopySetting)
                await conn.ExecuteAsync(new CommandDefinition("DELETE FROM Setting", transaction: tx, cancellationToken: ct));

            // ۵. فعال کردن مجدد Foreign Key ها
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