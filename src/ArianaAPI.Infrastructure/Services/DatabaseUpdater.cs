using Dapper;
using Microsoft.Data.SqlClient;
using System.Data;

namespace ArianaAPI.Infrastructure.Services;

public static class DatabaseUpdater
{
    // ⭐ نسخه دیتابیس را به امروز تغییر دادم تا فورس آپدیت شود
    public const string C_VERSION_DATABASE = "1405/06/15";

    public static async Task RunUpdaterAsync(string connectionString, bool isPermanent, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);

        // ۱. چک کردن تاریخ بروزرسانی (فقط برای Permanent)
        if (isPermanent)
        {
            try
            {
                var columnExists = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('DorehMali') AND name = 'UpDate_Database'", cancellationToken: ct));

                if (columnExists > 0)
                {
                    var currentVer = await conn.ExecuteScalarAsync<string>(
                        new CommandDefinition("SELECT MIN(UpDate_Database) FROM DorehMali", cancellationToken: ct));

                    if (!string.IsNullOrEmpty(currentVer) && string.Compare(currentVer, C_VERSION_DATABASE) >= 0)
                    {
                        return; // دیتابیس کاملاً بروز است
                    }
                }
            }
            catch { /* اگر جدول وجود نداشت، ادامه بده */ }
        }

        // ۲. اجرای اسکریپت‌ها (بدون Transaction کلی - هر دستور جداگانه اجرا می‌شود)
        var scripts = isPermanent ? GetPermanentScripts() : GetTenantScripts();
        bool hasError = false;

        foreach (var sql in scripts)
        {
            if (string.IsNullOrWhiteSpace(sql)) continue;

            try
            {
                // ⭐ هر دستور در یک تراکنش جداگانه اجرا می‌شود تا خطای یکی، بقیه را خراب نکند
                using var cmdTx = conn.BeginTransaction();
                await conn.ExecuteAsync(new CommandDefinition(sql, transaction: cmdTx, cancellationToken: ct));
                cmdTx.Commit();
            }
            catch (Exception ex)
            {
                // ⭐ خطا را چاپ می‌کنیم ولی برنامه را متوقف نمی‌کنیم
                Console.WriteLine($"[DB Update Skipped] {ex.Message}");
                hasError = true;
            }
        }

        // ۳. ثبت تاریخ جدید (فقط اگر هیچ خطایی رخ نداده باشد)
        if (isPermanent && !hasError)
        {
            try
            {
                var colExistsNow = await conn.ExecuteScalarAsync<int>(
                    new CommandDefinition("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('DorehMali') AND name = 'UpDate_Database'", cancellationToken: ct));

                if (colExistsNow > 0)
                {
                    string sqlUpdate = "UPDATE DorehMali SET UpDate_Database = @ver";
                    await conn.ExecuteAsync(new CommandDefinition(sqlUpdate, new { ver = C_VERSION_DATABASE }, cancellationToken: ct));
                }
            }
            catch { /* ignore */ }
        }
    }

    private static List<string> GetPermanentScripts()
    {
        return new List<string>
        {
            // ۱. ایجاد ستون‌ها در Permanent
            "IF COL_LENGTH('Sazman', 'LicenceSazman') IS NULL ALTER TABLE Sazman ADD LicenceSazman nvarchar(12)",
            "IF COL_LENGTH('Sazman', 'SysID') IS NULL ALTER TABLE Sazman ADD SysID nvarchar(50)",
            "IF COL_LENGTH('Sazman', 'NationalCode') IS NULL ALTER TABLE Sazman ADD NationalCode varchar(20)",
            "IF COL_LENGTH('Sazman', 'tax_software') IS NULL ALTER TABLE Sazman ADD tax_software bit default 0",
            "IF COL_LENGTH('Sazman', 'Report_App') IS NULL ALTER TABLE Sazman ADD Report_App bit default 0",
            "IF COL_LENGTH('DorehMali', 'UpDate_Database') IS NULL ALTER TABLE DorehMali ADD UpDate_Database varchar(10)",
            "IF COL_LENGTH('DorehMali', 'Tax_Per') IS NULL ALTER TABLE DorehMali ADD Tax_Per numeric(10,2), Avarez_Per numeric(10,2)",
            "IF COL_LENGTH('Setting', 'App_Tax_Path') IS NULL ALTER TABLE Setting ADD App_Tax_Path varchar(100)",
            """
            IF OBJECT_ID('dbo.vw_Sazman', 'V') IS NOT NULL 
                DROP VIEW [dbo].[vw_Sazman];
            """,
            """
              CREATE VIEW [dbo].[vw_Sazman] 
              AS  
              SELECT dbo.DorehMali.DorehMaliID, dbo.DorehMali.Name as NameDoreh, dbo.DorehMali.BeginDate, dbo.DorehMali.EndDate, dbo.DorehMali.SazmanCode,
              dbo.DorehMali.Discript, dbo.DorehMali.AddedHesabs, dbo.DorehMali.AddedUsers, dbo.DorehMali.AddedSetting, dbo.DorehMali.Code_Op,
              dbo.DorehMali.Date_Op, dbo.DorehMali.Time_Op, dbo.DorehMali.PriorDorehMaliCode, dbo.DorehMali.EndSanadNum, dbo.DorehMali.BeginSanadNum,
              dbo.DorehMali.Tax_Per, dbo.DorehMali.Avarez_Per, dbo.Sazman.SazmanID, dbo.Sazman.Name AS NameSazman, dbo.Sazman.Arm, dbo.Sazman.Discription,
              dbo.Sazman.Address, dbo.Sazman.PhonNumber, dbo.Sazman.Date_Op AS dataSazman, dbo.Sazman.Time_Op AS timeSazman, dbo.Sazman.Code_Op AS code_OPSazman,
              dbo.Sazman.PhoneNo, dbo.Sazman.EcoNo, dbo.Sazman.PostalCode,dbo.Sazman.NationalCode, dbo.Sazman.CityName1, dbo.Sazman.CityName2, dbo.Sazman.Ostan,
              dbo.Sazman.RegNo, dbo.Sazman.CoName, dbo.Sazman.LicenceSazman, dbo.Sazman.SysID
              FROM  dbo.DorehMali LEFT OUTER JOIN
               dbo.Sazman ON dbo.Sazman.SazmanID = dbo.DorehMali.SazmanCode
            """

            // ⚠️ بقیه اسکریپت‌های Permanent
        };
    }

    private static List<string> GetTenantScripts()
    {
        return new List<string>
        {
             // ============================================================
            // اصلاحات دیتابیس‌های قدیمی (Migration)
            // ============================================================
            // ⭐ اضافه کردن ستون PasswordHash به جدول Users (برای وب)
            "IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND COL_LENGTH('Users', 'PasswordHash') IS NULL ALTER TABLE Users ADD PasswordHash NVARCHAR(100) NULL;",
            // ۲. ایجاد ستون‌ها در Tenant (دیتابیس دوره)
            "IF COL_LENGTH('Sanad', 'FactorID') IS NULL ALTER TABLE Sanad ADD FactorID numeric",
            "IF COL_LENGTH('Sanad', 'MarketerFactorID') IS NULL ALTER TABLE Sanad ADD MarketerFactorID numeric",
            "IF COL_LENGTH('Sanad', 'ChequePayID') IS NULL ALTER TABLE Sanad ADD ChequePayID numeric",
            "IF COL_LENGTH('Sanad', 'Meghdar') IS NULL ALTER TABLE Sanad ADD Meghdar numeric(18,4)",
            "IF COL_LENGTH('Sanad', 'tikRow') IS NULL ALTER TABLE Sanad ADD tikRow int",
            "IF COL_LENGTH('ParentSanad', 'KindSanad') IS NULL ALTER TABLE ParentSanad ADD KindSanad numeric",
            "IF COL_LENGTH('ArticleNew', 'Code_Col') IS NULL ALTER TABLE ArticleNew ADD Code_Col numeric",
            "IF COL_LENGTH('ArticleNew', 'AmountSale') IS NULL ALTER TABLE ArticleNew ADD AmountSale numeric(18,3)",
            "IF COL_LENGTH('Hesab', 'MelliCode') IS NULL ALTER TABLE Hesab ADD MelliCode varchar(20)",
            "IF COL_LENGTH('Hesab', 'IsStock') IS NULL ALTER TABLE Hesab ADD IsStock tinyint Default 0",
            "IF COL_LENGTH('FactorDetail', 'Cost') IS NULL ALTER TABLE FactorDetail ADD Cost numeric(19,4)",
            "IF COL_LENGTH('Tafzili2', 'TafziliGroupCode') IS NULL ALTER TABLE Tafzili2 ADD TafziliGroupCode Numeric(18,0)",
            "IF COL_LENGTH('Tafzili2', 'Mobile') IS NULL ALTER TABLE Tafzili2 ADD Mobile varchar(50)",

            """
            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 156) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (156, N'ايجاد رسيد انبار', 0);

            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 157) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (157, N'ويرايش رسيد انبار', 0);

            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 158) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (158, N'حذف رسيد انبار', 0);

            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 159) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (159, N'ايجاد حواله انبار', 0);

            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 160) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (160, N'ويرايش حواله انبار', 0);

            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 161) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (161, N'حذف حواله انبار', 0);

            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 162) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (162, N'ايجاد رسيد برگشتي انبار', 0);

            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 163) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (163, N'ويرايش رسيد برگشتي انبار', 0);

            IF NOT EXISTS (SELECT * FROM [Other] WHERE Code = 164) 
                INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (164, N'حذف رسيد برگشتي انبار', 0);
            """,
            """
            -- ============================================================
            -- 165-167: تعريف خدمات (ServiceDefinition)
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 165) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (165, N'ايجاد تعريف خدمات', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 166) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (166, N'ويرايش تعريف خدمات', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 167) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (167, N'حذف تعريف خدمات', 0);

            -- ============================================================
            -- 168-170: سربرگ پرونده خدمت (ServiceCase)
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 168) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (168, N'ايجاد پرونده خدمت', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 169) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (169, N'ويرايش پرونده خدمت', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 170) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (170, N'حذف پرونده خدمت', 0);

            -- ============================================================
            -- 171-173: اقلام و مراحل پرونده (ServiceCaseDetail)
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 171) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (171, N'ايجاد مرحله پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 172) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (172, N'ويرايش مرحله پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 173) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (173, N'حذف مرحله پرونده', 0);

            -- ============================================================
            -- 174-176: پيوند فاکتورها به پرونده (ServiceCaseFactor)
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 174) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (174, N'اتصال فاکتور به پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 175) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (175, N'ويرايش فاکتور پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 176) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (176, N'حذف فاکتور از پرونده', 0);

            -- ============================================================
            -- 177-179: هزينه‌هاي مستقيم پرونده (ServiceCaseCost)
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 177) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (177, N'ايجاد هزينه پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 178) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (178, N'ويرايش هزينه پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 179) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (179, N'حذف هزينه پرونده', 0);

            -- ============================================================
            -- 180-182: تسويه‌حساب‌ها و گردش مالي (ServiceSettlement)
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 180) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (180, N'ايجاد تسويه پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 181) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (181, N'ويرايش تسويه پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 182) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (182, N'حذف تسويه پرونده', 0);

            -- ============================================================
            -- 183-188: دسترسي‌هاي عملياتي خاص
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 183) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (183, N'تأييد تسويه پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 184) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (184, N'لغو تأييد تسويه پرونده', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 185) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (185, N'بستن پرونده خدمت', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 186) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (186, N'بازگشايي پرونده خدمت', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 187) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (187, N'ايجاد سند خدمت', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 188) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (188, N'بازسازي سند خدمت', 0);

            -- ============================================================
            -- 190-198: عمليات مربوط به کالا، تفضيلي و شرح
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 190) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (190, N'درج کالا', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 191) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (191, N'ويرايش کالا', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 192) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (192, N'حذف کالا', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 193) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (193, N'درج تفضيلي', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 194) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (194, N'ويرايش تفضيلي', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 195) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (195, N'حذف تفضيلي', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 196) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (196, N'درج شرح', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 197) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (197, N'ويرايش شرح', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 198) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (198, N'حذف شرح', 0);

            -- ============================================================
            -- 199-204: عمليات مربوط به نوع سند و حساب
            -- ============================================================
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 199) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (199, N'درج نوع سند', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 200) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (200, N'ويرايش نوع سند', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 201) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (201, N'حذف نوع سند', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 202) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (202, N'درج حساب', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 203) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (203, N'ويرايش حساب', 0);
            IF NOT EXISTS (SELECT 1 FROM [Other] WHERE Code = 204) INSERT INTO [Other] (Code, [Description], Code_Op) VALUES (204, N'حذف حساب', 0);
            """,
            """
               IF OBJECT_ID(N'dbo.City', N'U') IS NULL 
            BEGIN
               CREATE TABLE [dbo].[City](
                [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                [Name] [varchar](50) NULL,
                [Code] [numeric](18, 0) NULL,
                [UpdaterName2] [varchar](50) NULL,
                [UpdaterDate2] [datetime] NULL,
                [CreatorName2] [varchar](50) NULL,
                [CreatorDate2] [datetime] NULL,
                [StateID] [numeric](18, 0) NULL,
                CONSTRAINT [PK_City] PRIMARY KEY CLUSTERED([ID]))
             END
        
            """,
            """
               IF OBJECT_ID(N'dbo.State', N'U') IS NULL 
            BEGIN
                CREATE TABLE [dbo].[State]([ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                [Name] [varchar](50) NULL,
                 [Code] [numeric](18, 0) NULL,
                 [UpdaterName2] [varchar](50) NULL,
                 [UpdaterDate2] [datetime] NULL,
                 [CreatorName2] [varchar](50) NULL,
                 [CreatorDate2] [datetime] NULL,
                CONSTRAINT [PK_State] PRIMARY KEY CLUSTERED([ID]))
            END
            """,
            """
              IF OBJECT_ID(N'dbo.ChequeBook', N'U') IS NULL 
            BEGIN
            CREATE TABLE [ChequeBook] ([ID] [numeric](18, 0) IDENTITY (1, 1) NOT NULL ,
                  [Code] [numeric](18, 0) NULL ,
                  [UpdaterName2] [varchar] (50) COLLATE Arabic_CI_AS NULL ,
                  [UpdaterDate2] [datetime] NULL , 
                  [CreatorName2] [varchar] (50) COLLATE Arabic_CI_AS NULL , 
                  [CreatorDate2] [datetime] NULL CONSTRAINT [DF_ChequeBook_CreatorDate2] DEFAULT (getdate()), 
                  [AcountNo] [varchar] (20) COLLATE Arabic_CI_AS NULL ,  
                  [BranchName] [varchar] (200) COLLATE Arabic_CI_AS NULL ,  
                  [SheetNo] [int] NULL ,
                  [Serial1] [numeric](18, 0) NULL ,  
                  [BankID] [int] NULL , 
                  CONSTRAINT [PK_ChequeBook] PRIMARY KEY  CLUSTERED  ([ID])  ON [PRIMARY] ) ON [PRIMARY]
            END
            """,
            """
               IF OBJECT_ID(N'dbo.ChequeBook_Child', N'U') IS NULL 
              BEGIN
                CREATE TABLE [ChequeBook_Child] ([ID] [numeric](18, 0) IDENTITY (1, 1) NOT NULL , 
                  [ChequeBookID] [numeric](18, 0) NULL , 
                  [Serial] [numeric](18, 0) NULL , 
                  [No_Sanad] [numeric](18, 0) NULL , 
                  [Cost] [numeric](18, 0) NULL ,
                  [DateIN] [varchar] (10) COLLATE Arabic_CI_AS NULL , 
                  [ReciverName] [varchar] (50) COLLATE Arabic_CI_AS NULL ,
                  [Des] [varchar] (200) COLLATE Arabic_CI_AS NULL ,
                  [SanadID] [numeric](18, 0) NULL , 
                  CONSTRAINT [PK_ChequeBook_Child] PRIMARY KEY  CLUSTERED 
                  ( [ID] )  ON [PRIMARY] , CONSTRAINT [FK_ChequeBook_Child_ChequeBook] FOREIGN KEY 
                  ( [ChequeBookID] ) REFERENCES [ChequeBook] ( [ID] ) ON DELETE CASCADE ) ON [PRIMARY]
                END
            """,
            """
             IF OBJECT_ID(N'dbo.HesabPrint2', N'U') IS NULL 
            BEGIN
            CREATE TABLE [HesabPrint2] ([HesabID] [numeric](18, 0) IDENTITY (1, 1) NOT NULL ,
                  	[Code_Group] [numeric](18, 0) NULL CONSTRAINT [DF__HesabPrin__Code___45377920] DEFAULT (0),
                  	[Code_Col] [numeric](18, 0) NULL CONSTRAINT [DF__HesabPrin__Code___462B9D59] DEFAULT (0),
                  	[Code_Moein] [numeric](18, 0) NULL CONSTRAINT [DF__HesabPrin__Code___471FC192] DEFAULT (0),
                  	[Code_Tafzil] [numeric](18, 0) NULL CONSTRAINT [DF__HesabPrin__Code___4813E5CB] DEFAULT (0),
                  	[Name] [varchar] (100) COLLATE Arabic_CI_AS NULL ,
                  	[Sum_Bed] [float] NULL CONSTRAINT [DF__HesabPrin__Sum_B__49080A04] DEFAULT (0),
                  	[Sum_Bes] [float] NULL CONSTRAINT [DF__HesabPrin__Sum_B__49FC2E3D] DEFAULT (0),
                  	[Mahiat] [numeric](18, 0) NULL CONSTRAINT [DF__HesabPrin__Mahia__4AF05276] DEFAULT (0),
                  	 PRIMARY KEY  CLUSTERED	([HesabID])  ON [PRIMARY]) ON [PRIMARY]
            END
            """,

            """
            IF OBJECT_ID(N'dbo.Tafzili2', N'U') IS NULL
            BEGIN
                CREATE TABLE [Tafzili2] ( 
                    [ID] [numeric](18, 0) IDENTITY (1, 1) NOT NULL , 
                    [Name] [varchar](50) COLLATE Arabic_CI_AS NULL ,   
                    [Code] [numeric](18, 0) NULL , 
                    [UpdaterName2] [varchar](50) COLLATE Arabic_CI_AS NULL , 
                    [UpdaterDate2] [datetime] NULL ,  
                    [CreatorName2] [varchar](50) COLLATE Arabic_CI_AS NULL , 
                    [CreatorDate2] [datetime] NULL CONSTRAINT [DF_Tafzili2_CreatorDate2] DEFAULT (getdate()),  
                    [StateID] [numeric](18, 0) NULL , 
                    CONSTRAINT [PK_Tafzili2] PRIMARY KEY CLUSTERED ([ID]) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.Countries', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Countries]( 
                    [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [PersianName] [varchar](50) NULL,
                    [EnglishName] [varchar](50) NULL,
                    [Date_Op] [varchar](12) NULL,
                    [Time_Op] [varchar](15) NULL,
                    [Code_Op] [numeric](18, 0) NULL,
                    PRIMARY KEY CLUSTERED([ID] ASC) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.Ghesmat', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Ghesmat](
                    [Code_G] [int] NULL,
                    [Sharh_G] [nvarchar](40) NULL,
                    [Code_A] [smallint] NULL,
                    [Kol] [smallint] NULL,
                    [Moeen] [smallint] NULL,
                    [Tafsili1] [int] NULL,
                    [Tafsili2] [int] NULL,
                    [CodeMarkaz] [nvarchar](11) NULL,
                    [CodeVahed] [nvarchar](11) NULL,
                    [CodeID] [int] IDENTITY(1,1) NOT NULL
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.ArticleUnit', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[ArticleUnit](
                    [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [Code] [numeric](18, 0) NOT NULL,
                    [Name] [varchar](50) NULL,
                    [TabileUnit] [numeric](18, 4) NULL,
                    CONSTRAINT [PK_ArticleUnit] PRIMARY KEY CLUSTERED([ID])
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.ArticleGroup', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[ArticleGroup](
                    [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [StockTypeID] [numeric](18, 0) NOT NULL,
                    [Code] [numeric](18, 0) NOT NULL,
                    [Name] [varchar](50) NULL,
                    [Degree] [numeric](18, 3) NULL,
                    CONSTRAINT [PK_ArticleGroup] PRIMARY KEY CLUSTERED([ID])
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.SpecialHesab', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SpecialHesab](
                    [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [SpecialHesabName] [nvarchar](100) NOT NULL,
                    [xSubGroupCode] [numeric](18, 0) NULL,
                    [xGroupCode] [numeric](18, 0) NULL,
                    [xDetailCode] [numeric](18, 0) NULL,
                    [xHCode] [nchar](12) NULL,
                    [xIsChild] [tinyint] NOT NULL,
                    [xKind] [int] NULL
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.Articles', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Articles](
                    [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [ArticleID] [numeric](18, 0) NULL,
                    [Code_Op] [numeric](18, 0) NULL,
                    [Date_Op] [varchar](12) NULL,
                    [Time_Op] [varchar](15) NULL,
                    [Parent_Sanad_ID] [numeric](18, 0) NULL,
                    [KindArticles] [tinyint] NOT NULL,
                    [HasEndedDate] [bit] NOT NULL,
                    [FirstExistence] [float] NULL,
                    [Inputed] [float] NULL,
                    [OutPuted] [float] NULL,
                    [Loss1] [float] NULL,
                    [Loss2] [float] NULL,
                    [FinallExistence] [float] NULL,
                    [Number] [float] NULL,
                    [CommandStock] [nvarchar](400) NULL,
                    [Tag] [int] NOT NULL DEFAULT ((1)),
                    CONSTRAINT [PK_Articles] PRIMARY KEY CLUSTERED([ID])
                );
            END;
            """,

            // ============================================================
            // جداول انبارگردانی (Inventory)
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.InventoryTagHeader', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[InventoryTagHeader] (
                    [ID] numeric(18,0) IDENTITY(1,1) NOT NULL,
                    [TagNo] varchar(20) NOT NULL,
                    [StockTypeID] numeric(18,0) NOT NULL,
                    [StageNo] int NOT NULL,
                    [TagDate] varchar(12) NOT NULL,
                    [TagStatus] tinyint NOT NULL DEFAULT 0,
                    [LocationCode] varchar(50) NULL,
                    [BarcodeImage] varbinary(MAX) NULL,
                    [CreateUserID] numeric(18,0) NULL,
                    [CreateDate] varchar(12) NULL,
                    [ConfirmUserID] numeric(18,0) NULL,
                    [ConfirmDate] varchar(12) NULL,
                    [Notes] nvarchar(200) NULL,
                    CONSTRAINT PK_InventoryTagHeader PRIMARY KEY (ID),
                    CONSTRAINT UK_TagNo UNIQUE (TagNo, StageNo)
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.InventoryTagDetail', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[InventoryTagDetail] (
                    [ID] numeric(18,0) IDENTITY(1,1) NOT NULL,
                    [TagID] numeric(18,0) NOT NULL,
                    [ArticleID] numeric(18,0) NOT NULL,
                    [SystemQty] float NOT NULL DEFAULT 0,
                    [CountedQty] float NULL,
                    [DiffQty] float NULL,
                    [ScrapQty] float NULL,
                    [CounterUserID] numeric(18,0) NULL,
                    [CountDate] varchar(12) NULL,
                    [CountTime] varchar(15) NULL,
                    [Notes] nvarchar(200) NULL,
                    CONSTRAINT PK_InventoryTagDetail PRIMARY KEY (ID)
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.InventoryStage', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[InventoryStage] (
                    [ID] int IDENTITY(1,1) NOT NULL,
                    [StockTypeID] numeric(18,0) NOT NULL,
                    [StageNo] int NOT NULL,
                    [StageName] nvarchar(100) NOT NULL,
                    [StartDate] varchar(12) NOT NULL,
                    [EndDate] varchar(12) NULL,
                    [IsActive] bit NOT NULL DEFAULT 1,
                    [IsClosed] bit NOT NULL DEFAULT 0,
                    [TotalTags] int NULL,
                    [CompletedTags] int NULL,
                    CONSTRAINT PK_InventoryStage PRIMARY KEY (ID),
                    CONSTRAINT UK_Stage UNIQUE (StockTypeID, StageNo)
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.InventoryToStockFactor', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[InventoryToStockFactor] (
                    [ID] [int] IDENTITY(1,1) NOT NULL,
                    [TagID] [numeric](18, 0) NOT NULL,
                    [TagDetailID] [numeric](18, 0) NOT NULL,
                    [StockFactorID] [numeric](18, 0) NOT NULL,
                    [StockFactorMatID] [numeric](18, 0) NOT NULL,
                    [AdjustmentType] [tinyint] NOT NULL,
                    [DiffQty] [float] NULL,
                    [ScrapQty] [float] NULL,
                    [UnitCost] [float] NULL,
                    [CreateDate] [varchar](12) NULL,
                    [CreateUserID] [numeric](18, 0) NULL,
                    CONSTRAINT PK_InventoryToStockFactor PRIMARY KEY (ID)
                );
            END;
            """,

            // ============================================================
            // جداول موقت و گزارش‌گیری (Temp & Report Tables)
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.Depreciation_Report_Temp', N'U') IS NULL
            BEGIN
                CREATE TABLE [Depreciation_Report_Temp] ( 
                    [ID] [numeric](18, 0) IDENTITY (1, 1) NOT NULL ,
                    [ComputerName] [varchar](50) COLLATE Arabic_CI_AS NULL ,
                    [ArticleName] [varchar](100) COLLATE Arabic_CI_AS NULL ,
                    [GroupName1] [varchar](50) COLLATE Arabic_CI_AS NULL ,
                    [Cost_Before] [numeric](18, 0) NULL ,
                    [BuyCost] [numeric](18, 0) NULL ,
                    [AllAsset] [numeric](18, 0) NULL , 
                    [Karkerd] [int] NULL , 
                    [Nerkh] [numeric](18, 3) NULL , 
                    [Depreciation_Before] [numeric](18, 0) NULL , 
                    [Depreciation] [numeric](18, 0) NULL ,
                    [Depreciation_Total] [numeric](18, 0) NULL ,
                    [OfficeCost] [numeric](18, 0) NULL ,
                    [Kind] [int] NULL ,
                    [ArticleID] [numeric](18, 0) NULL ,
                    [ArticleCode] [numeric](18, 0) NULL ,
                    [No_Sanad] [numeric](18, 0) NULL ,
                    [DateIN] [varchar](10) COLLATE Arabic_CI_AS NULL ,
                    [GroupName2] [varchar](50) COLLATE Arabic_CI_AS NULL ,
                    [NerkhName] [varchar](20) COLLATE Arabic_CI_AS NULL ,
                    [GroupCode1] [numeric](18, 0) NULL , 
                    [GroupCode2] [numeric](18, 0) NULL ,
                    [SanadID] [numeric](18, 0) NULL ,
                    CONSTRAINT [PK_Depreciation] PRIMARY KEY CLUSTERED ( [ID] ) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.Asset', N'U') IS NULL
            BEGIN
                CREATE TABLE [Asset] (
                    [ID] [numeric](18, 0) IDENTITY (1, 1) NOT NULL , 
                    [ArticleID] [numeric](18, 0) NULL ,
                    [DateIN] [varchar](50) COLLATE Arabic_CI_AS NULL ,
                    [Cost] [numeric](18, 0) NULL , 
                    [SanadID] [numeric](18, 0) NULL , 
                    [Depreciation_Before] [numeric](18, 0) NULL ,
                    [Depreciation] [numeric](18, 0) NULL , 
                    [Cost_Before] [numeric](18, 0) NULL ,
                    [No_Sanad] [numeric](18, 0) NULL , 
                    [Code] [numeric](18, 0) NULL , 
                    CONSTRAINT [PK_Asset] PRIMARY KEY CLUSTERED ([ID]) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            // ⚠️ توجه: چون این جدول در دلفی Drop و دوباره Create می‌شد، ما هم همان کار را می‌کنیم تا تمیز باشد
            """
            IF OBJECT_ID(N'dbo.Stock_Factor_Report', N'U') IS NOT NULL 
                DROP TABLE [dbo].[Stock_Factor_Report];

            CREATE TABLE [dbo].[Stock_Factor_Report]( 
                [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                [Name] [varchar](50) NULL,
                [Code] [numeric](18, 0) NULL,
                [DateIN] [varchar](10) NULL,
                [Val] [float] NULL,
                [InP] [float] NULL,
                [OutP] [float] NULL,
                [Rem] [float] NULL,
                [Des] [varchar](50) NULL,
                [ComputerName] [varchar](50) NULL,
                [ArticleID] [numeric](18, 0) NULL,
                [ArticleName] [varchar](50) NULL,
                [Kind] [tinyint] NULL,
                [ArticleCode] [numeric](18, 0) NULL,
                CONSTRAINT [PK_Stock_Factor_Report] PRIMARY KEY CLUSTERED ([ID] ASC)
            ) ON [PRIMARY];
            """,

            """
            IF OBJECT_ID(N'dbo.SanadTemp', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SanadTemp](
                    [SanadID] [decimal](18,0) NOT NULL,
                    [NO_Sanad] [numeric](18,0) NULL,
                    [ParentSanadCode] [numeric](18,0) NULL,
                    [ResidNum] [numeric](18,0) NULL,
                    [CheckType] [numeric](18,0) NULL,
                    [Code_Col] [numeric](18,0) NULL,
                    [Code_Moein] [numeric](18,0) NULL,
                    [Code_Tafzil] [numeric](18,0) NULL,
                    [Code_Sharh] [numeric](18,0) NULL,
                    [OtherSharh] [varchar](250) NULL, 
                    [Mab_Bed] [money] NULL, 
                    [Mab_Bes] [money] NULL, 
                    [Code_Op] [numeric](18, 0) NULL, 
                    [Date_Op] [varchar](12) NULL, 
                    [Time_Op] [varchar](15) NULL, 
                    [RowNum] [numeric](18, 0) NULL, 
                    [DoDate] [varchar](10) NULL, 
                    [DoOK] [numeric](10, 0) NULL, 
                    [FactorID] [numeric](18, 0) NULL, 
                    [ChequePayID] [numeric](18, 0) NULL, 
                    [ChequeRecID] [numeric](18, 0) NULL, 
                    [ResidPayID] [numeric](18, 0) NULL, 
                    [ResidRecID] [numeric](18, 0) NULL, 
                    [FactorNo] [numeric](18, 0) NULL, 
                    [ChequePayNo] [varchar](20) NULL, 
                    [ChequeRecNo] [varchar](20) NULL, 
                    [ResidPayNo] [numeric](18, 0) NULL, 
                    [ResidRecNo] [numeric](18, 0) NULL, 
                    [Meghdar] [numeric](18,4) NULL, 
                    [Code_Tafzil1] [numeric](18, 0) NULL, 
                    [ArticleID] [numeric](18, 0) NULL, 
                    [ChequeBook_ChildID] [numeric](18, 0) NULL, 
                    [ChequeBookDate] [varchar](10) NULL, 
                    [ChequeBook_Receiver] [varchar](50) NULL, 
                    [Tafzili2ID] [int] NULL, 
                    [Code_Tafzili2] [int] NULL,
                    [StockNo] [numeric](18,0) null,
                    [MarketerFactorID] [numeric](18,0) null 
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.Asset_Export', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Asset_Export](
                    [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [CodeReg] [numeric](18, 0) NULL,
                    [DateReg] [nvarchar](10) NULL,
                    [CodeExport] [int] NULL,
                    [DateExport] [nvarchar](10) NULL,
                    [GhesmatCode] [nvarchar](10) NULL,
                    [ArticleID] [numeric](18, 0) NULL,
                    [Code] [numeric](18, 0) NULL,
                    CONSTRAINT [PK_Asset_Export] PRIMARY KEY CLUSTERED ( [ID] ASC ) 
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.SanadMovaghat', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SanadMovaghat](
                    [SanadMovaghatID] [decimal](18, 0) IDENTITY(1,1) NOT NULL,
                    [Code_Col] [numeric](18, 0) NULL,
                    [Code_Moein] [numeric](18, 0) NULL,
                    [Code_Tafzil] [numeric](18, 0) NULL,
                    [Code_Tafzili2] [numeric](18, 0) NULL,
                    [Des] [varchar](250) NULL,
                    [Mab_Bed] [money] NULL,
                    [Mab_Bes] [money] NULL,
                    [Meghdar] [numeric](18, 4) NULL,
                    [Cu] [varchar](50) NULL 
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.FactorDetailTemp', N'U') IS NOT NULL DROP TABLE [dbo].[FactorDetailTemp];
            CREATE TABLE [dbo].[FactorDetailTemp](
                [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                [FactorID] [numeric](18, 0) NULL,
                [ArticleID] [numeric](18, 0) NULL,
                [ArticleCount] [numeric](18, 4) NULL,
                [ArticleName] [varchar](50) NULL,
                [ArticleUnit] [varchar](50) NULL,
                [Cost] [numeric](18, 4) NULL,
                [IncCost] [numeric](18, 4) NULL,
                [ArticleCode] [numeric](18, 0) NULL,
                [Discount] [numeric](18, 0) NULL,
                [Tax] [numeric](18, 0) NULL,
                [ComputerName] [varchar](50) NULL,
                [CostTax] [numeric](18, 4) NULL,
                [CostFinall] [numeric](19, 4) NULL,
                [CostItem] [numeric](19, 4) NULL,
                [StockID] [numeric](18, 0) NULL, 
                [PerDiscount] numeric(18,4) Null, 
                [MarketerCosts] numeric(18,4) Null, 
                [MarketerPercent] numeric(18,4) NULL,
                [TransCost] numeric(18,4) NULL,
                [DegreeKala] numeric(18,4) NULL,
                [DropKala] numeric(18,4) NULL,
                [TaxFi] numeric(18,4) NULL,
                CONSTRAINT [PK_FactorDetailTemp] PRIMARY KEY CLUSTERED ([ID] ASC) ON [PRIMARY]
            ) ON [PRIMARY];
            """,

            """
            IF OBJECT_ID(N'dbo.FactorParentTemp', N'U') IS NOT NULL DROP TABLE [dbo].[FactorParentTemp];
            CREATE TABLE [dbo].[FactorParentTemp](
                [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                [NoFactor] [numeric](18, 0) NULL,
                [Date_In] [varchar](12) NULL,
                [Descript] [varchar](200) NULL,
                [FactorKind] [numeric](18, 0) NULL,
                [Code_Op] [numeric](18, 0) NULL,
                [Date_Op] [varchar](12) NULL,
                [Time_Op] [varchar](15) NULL,
                [IsCaSh] [tinyint] NULL,
                [Cost] [numeric](18, 0) NULL,
                [CodeTafzil] [int] NULL,
                [ComputerName] [varchar](50) NULL,
                [Parent_Sanad_ID] [numeric](18, 0) NULL,
                [NoSanad_ID_Marketer] [numeric](18, 0) NULL,
                [NoFactor_Per] [numeric](18, 0) NULL,
                [Per_Ok] [bit] NULL,
                [CodeTaf_Marketer] [int] NULL,
                [StockID] [numeric](18, 0) NULL, 
                [TransCost] [numeric](18, 4) NULL, 
                [CarInfo] [nvarchar](10) null 
            ) ON [PRIMARY];
            """,

            """
            IF OBJECT_ID(N'dbo.SanadCopyTemp', N'U') IS NOT NULL DROP TABLE [dbo].[SanadCopyTemp];
            CREATE TABLE [dbo].[SanadCopyTemp](
                [ID] [numeric](18, 0) NULL,
                [Code_Col] [numeric](18, 0) NULL,
                [Code_Moein] [numeric](18, 0) NULL,
                [Code_Tafzil] [numeric](18, 0) NULL,
                [OtherSharh] [varchar](250) NULL,
                [Mab_Bed] [money] NULL,
                [Mab_Bes] [money] NULL,
                [Meghdar] [numeric](18, 4) NULL,
                [ComputerName] [varchar](50) NULL,
                [Code_Tafzili2] [int] NULL,
                [Tafzili2ID] [int] NULL,
                [ArticleID] [int] NULL,
                [DoDate] [varchar](10) NULL,
                [DoOK] [int] NULL,
                [Code_Tafzili1] [int] NULL,
                [Code_Tafzil1] [int] NULL 
            ) ON [PRIMARY];
            """,

            // ============================================================
            // جدول ArticleStock و روابط آن (اصلاح قطعی خطای PRIMARY KEY)
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.ArticleStock', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[ArticleStock] (
                    [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [ArticleID] [numeric](18, 0) NOT NULL,
                    [StockTypeID] [numeric](18, 0) NULL
                );
            END
            ELSE
            BEGIN
                -- ⭐ اگر جدول از قبل وجود دارد، اول رکوردهای خالی را پاک کن
                DELETE FROM [dbo].[ArticleStock] WHERE [ArticleID] IS NULL;
                
                -- ⭐ سپس ستون را از حالت NULL به NOT NULL تغییر بده تا اجازه ساخت PK داده شود
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ArticleStock') AND name = 'ArticleID' AND is_nullable = 1)
                BEGIN
                    ALTER TABLE [dbo].[ArticleStock] ALTER COLUMN [ArticleID] numeric(18,0) NOT NULL;
                END
            END;
            """,

            """
            -- پر کردن ArticleStock از ArticleNew
            INSERT INTO ArticleStock (ArticleID, StockTypeID)
            SELECT A.ID, G.StockTypeID FROM ArticleNew A
            INNER JOIN ArticleGroup G ON G.ID = A.ArticleGroupID
            WHERE NOT EXISTS (SELECT 1 FROM ArticleStock S WHERE S.ArticleID = A.ID);
            """,

            """
            -- اضافه کردن PK
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PK_ArticleStock]') AND type in (N'PK'))
            BEGIN
                ALTER TABLE [dbo].[ArticleStock] ADD CONSTRAINT [PK_ArticleStock] PRIMARY KEY ([ArticleID]);
            END;
            """,

            """
            -- اضافه کردن FK
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FK_ArticleStock_ArticleNew]') AND type in (N'F'))
            BEGIN
                ALTER TABLE [dbo].[ArticleStock] ADD CONSTRAINT [FK_ArticleStock_ArticleNew] FOREIGN KEY ([ArticleID]) REFERENCES [dbo].[ArticleNew]([ID]) ON DELETE CASCADE;
            END;
            """,

            """
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FK_ArticleStock_Stock]') AND type in (N'F'))
            BEGIN
                ALTER TABLE [dbo].[ArticleStock] ADD CONSTRAINT [FK_ArticleStock_Stock] FOREIGN KEY ([StockTypeID]) REFERENCES [dbo].[StockType]([ID]);
            END;
            """,

            // ============================================================
            // جداول پایه (Base Tables)
            // ============================================================
            // ============================================================
            // Alter Tables — بخش ۱
            // ============================================================
            """
            IF COL_LENGTH('Stock_Factor', 'SpecialCode') IS NULL ALTER TABLE Stock_Factor ADD SpecialCode numeric(18,0);
            IF COL_LENGTH('Stock_Factor', 'FactorID') IS NULL ALTER TABLE Stock_Factor ADD FactorID numeric(18,0);
            IF COL_LENGTH('Stock_Factor', 'FactorCode') IS NULL ALTER TABLE Stock_Factor ADD FactorCode numeric(18,0) NULL;
            IF COL_LENGTH('Stock_Factor', 'TolidCode') IS NULL ALTER TABLE Stock_Factor ADD TolidCode numeric(18,0) NULL;
            IF COL_LENGTH('Stock_Factor', 'TolidID') IS NULL ALTER TABLE Stock_Factor ADD TolidID numeric(18,0) NULL;
            IF COL_LENGTH('Stock_Factor', 'Parent_Sanad_ID') IS NULL ALTER TABLE Stock_Factor ADD Parent_Sanad_ID numeric(18,0);
            IF COL_LENGTH('Stock_Factor', 'PerFactor_ID') IS NULL ALTER TABLE Stock_Factor ADD PerFactor_ID numeric(18,0);
            IF COL_LENGTH('Stock_Factor', 'InventoryTagID') IS NULL ALTER TABLE Stock_Factor ADD InventoryTagID numeric(18,0) NULL;
            IF COL_LENGTH('Stock_Factor', 'InventoryStageNo') IS NULL ALTER TABLE Stock_Factor ADD InventoryStageNo int NULL;
            IF COL_LENGTH('Stock_Factor', 'AdjustmentType') IS NULL ALTER TABLE Stock_Factor ADD AdjustmentType tinyint NULL;
            IF COL_LENGTH('Stock_Factor', 'IsInventoryAdjustment') IS NULL ALTER TABLE Stock_Factor ADD IsInventoryAdjustment bit DEFAULT 0;

            IF COL_LENGTH('Stock_Factor_Mat', 'Cost') IS NULL ALTER TABLE Stock_Factor_Mat ADD Cost Float;

            IF COL_LENGTH('Sanad', 'FactorID') IS NULL ALTER TABLE Sanad ADD FactorID numeric;
            IF COL_LENGTH('Sanad', 'MarketerFactorID') IS NULL ALTER TABLE Sanad ADD MarketerFactorID numeric;
            IF COL_LENGTH('Sanad', 'ChequePayID') IS NULL ALTER TABLE Sanad ADD ChequePayID numeric;
            IF COL_LENGTH('Sanad', 'ChequeRecID') IS NULL ALTER TABLE Sanad ADD ChequeRecID numeric;
            IF COL_LENGTH('Sanad', 'ResidPayID') IS NULL ALTER TABLE Sanad ADD ResidPayID numeric;
            IF COL_LENGTH('Sanad', 'ResidRecID') IS NULL ALTER TABLE Sanad ADD ResidRecID numeric;
            IF COL_LENGTH('Sanad', 'FactorNo') IS NULL ALTER TABLE Sanad ADD FactorNo numeric;
            IF COL_LENGTH('Sanad', 'ChequePayNo') IS NULL ALTER TABLE Sanad ADD ChequePayNo varchar(20);
            IF COL_LENGTH('Sanad', 'ChequeRecNo') IS NULL ALTER TABLE Sanad ADD ChequeRecNo varchar(20);
            IF COL_LENGTH('Sanad', 'ResidPayNo') IS NULL ALTER TABLE Sanad ADD ResidPayNo numeric;
            IF COL_LENGTH('Sanad', 'ResidRecNo') IS NULL ALTER TABLE Sanad ADD ResidRecNo numeric;
            IF COL_LENGTH('Sanad', 'Meghdar') IS NULL ALTER TABLE Sanad ADD Meghdar numeric(18,4);
            IF COL_LENGTH('Sanad', 'tikRow') IS NULL ALTER TABLE Sanad ADD tikRow int;
            IF COL_LENGTH('Sanad', 'Tafzili2ID') IS NULL ALTER TABLE Sanad ADD Tafzili2ID int;
            IF COL_LENGTH('Sanad', 'Code_Tafzili2') IS NULL ALTER TABLE Sanad ADD Code_Tafzili2 int;
            IF COL_LENGTH('Sanad', 'Code_Tafzil1') IS NULL ALTER TABLE Sanad ADD Code_Tafzil1 numeric;
            IF COL_LENGTH('Sanad', 'ArticleID') IS NULL ALTER TABLE Sanad ADD ArticleID numeric;
            IF COL_LENGTH('Sanad', 'ChequeBook_ChildID') IS NULL ALTER TABLE Sanad ADD ChequeBook_ChildID numeric;
            IF COL_LENGTH('Sanad', 'ChequeBookDate') IS NULL ALTER TABLE Sanad ADD ChequeBookDate varchar(10);
            IF COL_LENGTH('Sanad', 'ChequeBook_Receiver') IS NULL ALTER TABLE Sanad ADD ChequeBook_Receiver varchar(50);
            IF COL_LENGTH('Sanad', 'StockNo') IS NULL ALTER TABLE Sanad ADD StockNo numeric;
            IF COL_LENGTH('Sanad', 'CodeMarkazH') IS NULL ALTER TABLE Sanad ADD CodeMarkazH numeric;
            IF COL_LENGTH('Sanad', 'CodeProject') IS NULL ALTER TABLE Sanad ADD CodeProject numeric;
            IF COL_LENGTH('Sanad', 'CodeVahed') IS NULL ALTER TABLE Sanad ADD CodeVahed numeric;
            
            ALTER TABLE Sanad ALTER COLUMN Meghdar numeric(18,4);
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'DF_Sanad_Meghdar') ALTER TABLE Sanad ADD CONSTRAINT [DF_Sanad_Meghdar] DEFAULT ((0)) FOR [Meghdar];
            UPDATE Sanad SET Meghdar = 0 WHERE Meghdar IS NULL;

            IF COL_LENGTH('ParentSanad', 'KindSanad') IS NULL ALTER TABLE ParentSanad ADD KindSanad numeric;
            UPDATE ParentSanad SET KindSanad = 0 WHERE KindSanad IS NULL;

            IF COL_LENGTH('TarazPrint2', 'Code_Tafzili2') IS NULL ALTER TABLE TarazPrint2 ADD Code_Tafzili2 numeric;
            IF COL_LENGTH('TarazPrint2', 'Tafzili2ID') IS NULL ALTER TABLE TarazPrint2 ADD Tafzili2ID numeric;
            IF COL_LENGTH('TarazPrint2', 'Meghdar') IS NULL ALTER TABLE TarazPrint2 ADD Meghdar numeric(18,4);
            ALTER TABLE TarazPrint2 ALTER COLUMN Meghdar numeric(18,4);

            IF COL_LENGTH('SanadTemp', 'StockNo') IS NULL ALTER TABLE SanadTemp ADD StockNo numeric;
            IF COL_LENGTH('SanadTemp', 'MarketerFactorID') IS NULL ALTER TABLE SanadTemp ADD MarketerFactorID numeric;
            ALTER TABLE SanadTemp ALTER COLUMN Meghdar numeric(18,4);
            IF COL_LENGTH('SanadTemp', 'tikRow') IS NULL ALTER TABLE SanadTemp ADD tikRow int;
            IF COL_LENGTH('SanadTemp', 'CodeMarkazH') IS NULL ALTER TABLE SanadTemp ADD CodeMarkazH numeric, CodeProject numeric, CodeVahed numeric;

            ALTER TABLE SanadMovaghat ALTER COLUMN Meghdar numeric(18,4);
            IF COL_LENGTH('SanadMovaghat', 'CodeMarkazH') IS NULL ALTER TABLE SanadMovaghat ADD CodeMarkazH numeric;
            IF COL_LENGTH('SanadMovaghat', 'CodeProject') IS NULL ALTER TABLE SanadMovaghat ADD CodeProject numeric;
            IF COL_LENGTH('SanadMovaghat', 'CodeVahed') IS NULL ALTER TABLE SanadMovaghat ADD CodeVahed numeric;

            IF COL_LENGTH('Tafzili2', 'TafziliGroupCode') IS NULL ALTER TABLE Tafzili2 ADD TafziliGroupCode Numeric(18,0);
            IF COL_LENGTH('Tafzili2', 'Phone') IS NULL ALTER TABLE Tafzili2 ADD Phone varchar(50);
            IF COL_LENGTH('Tafzili2', 'Mobile') IS NULL ALTER TABLE Tafzili2 ADD Mobile varchar(50);
            IF COL_LENGTH('Tafzili2', 'Address') IS NULL ALTER TABLE Tafzili2 ADD Address varchar(150);
            IF COL_LENGTH('Tafzili2', 'IsSaleMan') IS NULL ALTER TABLE Tafzili2 ADD IsSaleMan Tinyint;
            IF COL_LENGTH('Tafzili2', 'CityID') IS NULL ALTER TABLE Tafzili2 ADD CityID int;
            IF COL_LENGTH('Tafzili2', 'CityID2') IS NULL ALTER TABLE Tafzili2 ADD CityID2 int;
            ALTER TABLE Tafzili2 ALTER COLUMN StateID int;
            IF COL_LENGTH('Tafzili2', 'MelliCode') IS NULL ALTER TABLE Tafzili2 ADD MelliCode varchar(20);
            IF COL_LENGTH('Tafzili2', 'HasTafzili2') IS NULL ALTER TABLE Tafzili2 ADD HasTafzili2 Tinyint;
            IF COL_LENGTH('Tafzili2', 'NationalCode') IS NULL ALTER TABLE Tafzili2 ADD NationalCode varchar(20);
            IF COL_LENGTH('Tafzili2', 'EconomicCode') IS NULL ALTER TABLE Tafzili2 ADD EconomicCode varchar(20);
            IF COL_LENGTH('Tafzili2', 'PostalCode') IS NULL ALTER TABLE Tafzili2 ADD PostalCode varchar(15);
            IF COL_LENGTH('Tafzili2', 'IsStock') IS NULL ALTER TABLE Tafzili2 ADD IsStock Tinyint;

            IF COL_LENGTH('DaftarColPrintFinall2', 'Meghdar') IS NULL ALTER TABLE DaftarColPrintFinall2 ADD Meghdar numeric(18,2);
            ALTER TABLE DaftarColPrintFinall2 ALTER COLUMN Meghdar numeric(18,4);
            IF COL_LENGTH('DaftarColPrintFinall2', 'Tafzili2ID') IS NULL ALTER TABLE DaftarColPrintFinall2 ADD Tafzili2ID numeric;
            IF COL_LENGTH('DaftarColPrintFinall2', 'Code_Tafzili2') IS NULL ALTER TABLE DaftarColPrintFinall2 ADD Code_Tafzili2 numeric;
            IF COL_LENGTH('DaftarColPrintFinall2', 'TikRow') IS NULL ALTER TABLE DaftarColPrintFinall2 ADD TikRow numeric;

            IF COL_LENGTH('DaftarRoozNamehPrint2', 'Code_Tafzili2') IS NULL ALTER TABLE DaftarRoozNamehPrint2 ADD Code_Tafzili2 numeric(18,0);

            IF COL_LENGTH('DaftarColPrint2', 'Meghdar') IS NULL ALTER TABLE DaftarColPrint2 ADD Meghdar numeric(18,2);
            ALTER TABLE DaftarColPrint2 ALTER COLUMN Meghdar numeric(18,4);
            IF COL_LENGTH('DaftarColPrint2', 'Code_Tafzili2') IS NULL ALTER TABLE DaftarColPrint2 ADD Code_Tafzili2 numeric;
            IF COL_LENGTH('DaftarColPrint2', 'Tafzili2ID') IS NULL ALTER TABLE DaftarColPrint2 ADD Tafzili2ID numeric;
            IF COL_LENGTH('DaftarColPrint2', 'TikRow') IS NULL ALTER TABLE DaftarColPrint2 ADD TikRow numeric;

            IF COL_LENGTH('FactorParent', 'Parent_Sanad_ID') IS NULL ALTER TABLE FactorParent ADD Parent_Sanad_ID numeric;
            IF COL_LENGTH('FactorParent', 'NoSanad_ID_Marketer') IS NULL ALTER TABLE FactorParent ADD NoSanad_ID_Marketer numeric;
            IF COL_LENGTH('FactorParent', 'IsCaSh') IS NULL ALTER TABLE FactorParent ADD IsCaSh tinyint;
            IF COL_LENGTH('FactorParent', 'Cost') IS NULL ALTER TABLE FactorParent ADD [Cost] [numeric](18, 0) NULL;
            IF COL_LENGTH('FactorParent', 'CodeTafzil') IS NULL ALTER TABLE FactorParent ADD [CodeTafzil] [int] NULL;
            IF COL_LENGTH('FactorParent', 'Per_Ok') IS NULL ALTER TABLE FactorParent ADD Per_Ok bit;
            IF COL_LENGTH('FactorParent', 'NoFactor_Per') IS NULL ALTER TABLE FactorParent ADD NoFactor_Per numeric(18,0);
            IF COL_LENGTH('FactorParent', 'StockID') IS NULL ALTER TABLE FactorParent ADD StockID numeric(18,0);
            IF COL_LENGTH('FactorParent', 'CodeTaf_Marketer') IS NULL ALTER TABLE FactorParent ADD CodeTaf_Marketer [int] NULL;
            IF COL_LENGTH('FactorParent', 'CarInfo') IS NULL ALTER TABLE FactorParent ADD CarInfo nvarchar(10) NULL;
            IF COL_LENGTH('FactorParent', 'TransCost') IS NULL ALTER TABLE FactorParent ADD TransCost numeric(18,4);

            IF COL_LENGTH('FactorDetail', 'Cost') IS NULL ALTER TABLE FactorDetail ADD Cost numeric(19,4);
            IF COL_LENGTH('FactorDetail', 'Tax') IS NULL ALTER TABLE FactorDetail ADD Tax numeric(18,0);
            IF COL_LENGTH('FactorDetail', 'StockID') IS NULL ALTER TABLE FactorDetail ADD StockID numeric(18,0);
            IF COL_LENGTH('FactorDetail', 'ArticleCount2') IS NULL ALTER TABLE FactorDetail ADD ArticleCount2 numeric(18,4), ArticleCount3 numeric(18,4);
            IF COL_LENGTH('FactorDetail', 'PerDiscount') IS NULL ALTER TABLE FactorDetail ADD PerDiscount numeric(18,4);
            ALTER TABLE FactorDetail ALTER COLUMN Discount numeric(18,4);
            ALTER TABLE FactorDetail ALTER COLUMN ArticleCount numeric(18,4);
            IF COL_LENGTH('FactorDetail', 'MarketerPercent') IS NULL ALTER TABLE FactorDetail ADD MarketerPercent numeric(18,4);
            IF COL_LENGTH('FactorDetail', 'MarketerCosts') IS NULL ALTER TABLE FactorDetail ADD MarketerCosts numeric(18,4);
            IF COL_LENGTH('FactorDetail', 'TransCost') IS NULL ALTER TABLE FactorDetail ADD TransCost numeric(18,4);
            IF COL_LENGTH('FactorDetail', 'IncCost') IS NULL ALTER TABLE FactorDetail ADD IncCost numeric(18,4);
            IF COL_LENGTH('FactorDetail', 'DegreeKala') IS NULL ALTER TABLE FactorDetail ADD DegreeKala numeric(18,4);
            IF COL_LENGTH('FactorDetail', 'DropKala') IS NULL ALTER TABLE FactorDetail ADD DropKala numeric(18,4);
            IF COL_LENGTH('FactorDetail', 'TaxFi') IS NULL ALTER TABLE FactorDetail ADD TaxFi numeric(18,4);

            IF COL_LENGTH('Hesab', 'MelliCode') IS NULL ALTER TABLE Hesab ADD MelliCode varchar(20);
            IF COL_LENGTH('Hesab', 'HasTafzili2') IS NULL ALTER TABLE Hesab ADD HasTafzili2 tinyint;
            IF COL_LENGTH('Hesab', 'IsStock') IS NULL ALTER TABLE Hesab ADD IsStock tinyint Default 0;
            IF COL_LENGTH('Hesab', 'IsSaleMan') IS NULL ALTER TABLE Hesab ADD IsSaleMan tinyint Default 0;
            IF COL_LENGTH('Hesab', 'CityID') IS NULL ALTER TABLE Hesab ADD CityID int;
            IF COL_LENGTH('Hesab', 'StateID') IS NULL ALTER TABLE Hesab ADD StateID int;
            IF COL_LENGTH('Hesab', 'PostalCode') IS NULL ALTER TABLE Hesab ADD PostalCode varchar(15);
            IF COL_LENGTH('Hesab', 'EconomicCode') IS NULL ALTER TABLE Hesab ADD EconomicCode varchar(20);
            IF COL_LENGTH('Hesab', 'NationalCode') IS NULL ALTER TABLE Hesab ADD NationalCode varchar(20);
            IF COL_LENGTH('Hesab', 'IsCodeMarkaz') IS NULL ALTER TABLE Hesab ADD IsCodeMarkaz numeric;
            IF COL_LENGTH('Hesab', 'IsCodeVahed') IS NULL ALTER TABLE Hesab ADD IsCodeVahed numeric;
            IF COL_LENGTH('Hesab', 'IsCodeProjeh') IS NULL ALTER TABLE Hesab ADD IsCodeProjeh numeric;
            IF COL_LENGTH('Hesab', 'CityID2') IS NULL ALTER TABLE Hesab ADD CityID2 int;
            ALTER TABLE Hesab ALTER COLUMN HasTafzili2 numeric;
            """,

            // ============================================================
            // Alter Tables — بخش ۲
            // ============================================================
            """
            IF COL_LENGTH('ArticleNew', 'Code_Col') IS NULL ALTER TABLE ArticleNew ADD Code_Col numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Moein') IS NULL ALTER TABLE ArticleNew ADD Code_Moein numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Tafzil') IS NULL ALTER TABLE ArticleNew ADD Code_Tafzil numeric;
            IF COL_LENGTH('ArticleNew', 'ArticleUnitID2') IS NULL ALTER TABLE ArticleNew ADD ArticleUnitID2 numeric(18,0);
            IF COL_LENGTH('ArticleNew', 'ArticleUnitID3') IS NULL ALTER TABLE ArticleNew ADD ArticleUnitID3 numeric(18,0);
            IF COL_LENGTH('ArticleNew', 'Code_Col_Buy') IS NULL ALTER TABLE ArticleNew ADD Code_Col_Buy numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Moein_Buy') IS NULL ALTER TABLE ArticleNew ADD Code_Moein_Buy numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Tafzil_Buy') IS NULL ALTER TABLE ArticleNew ADD Code_Tafzil_Buy numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Col_ReBuy') IS NULL ALTER TABLE ArticleNew ADD Code_Col_ReBuy numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Moein_ReBuy') IS NULL ALTER TABLE ArticleNew ADD Code_Moein_ReBuy numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Tafzil_ReBuy') IS NULL ALTER TABLE ArticleNew ADD Code_Tafzil_ReBuy numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Col_ReSale') IS NULL ALTER TABLE ArticleNew ADD Code_Col_ReSale numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Moein_ReSale') IS NULL ALTER TABLE ArticleNew ADD Code_Moein_ReSale numeric;
            IF COL_LENGTH('ArticleNew', 'Code_Tafzil_ReSale') IS NULL ALTER TABLE ArticleNew ADD Code_Tafzil_ReSale numeric;
            IF COL_LENGTH('ArticleNew', 'Status') IS NULL ALTER TABLE ArticleNew ADD Status int;
            IF COL_LENGTH('ArticleNew', 'AmountFirst') IS NULL ALTER TABLE ArticleNew ADD AmountFirst numeric(18,0);
            IF COL_LENGTH('ArticleNew', 'CostFirst') IS NULL ALTER TABLE ArticleNew ADD CostFirst float NULL;
            IF COL_LENGTH('ArticleNew', 'MaxCostOrderBy') IS NULL ALTER TABLE ArticleNew ADD MaxCostOrderBy float;
            IF COL_LENGTH('ArticleNew', 'MinCostOrderBy') IS NULL ALTER TABLE ArticleNew ADD MinCostOrderBy float;
            IF COL_LENGTH('ArticleNew', 'DepreciationType') IS NULL ALTER TABLE ArticleNew ADD DepreciationType int;
            IF COL_LENGTH('ArticleNew', 'Depreciation') IS NULL ALTER TABLE ArticleNew ADD Depreciation numeric(10,3);
            IF COL_LENGTH('ArticleNew', 'AmountSale') IS NULL ALTER TABLE ArticleNew ADD AmountSale numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'inAmount1') IS NULL ALTER TABLE ArticleNew ADD inAmount1 numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'OutAmount1') IS NULL ALTER TABLE ArticleNew ADD OutAmount1 numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'BackAmount1') IS NULL ALTER TABLE ArticleNew ADD BackAmount1 numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'FinalAmount1') IS NULL ALTER TABLE ArticleNew ADD FinalAmount1 numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'inVal1') IS NULL ALTER TABLE ArticleNew ADD inVal1 numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'OutVal1') IS NULL ALTER TABLE ArticleNew ADD OutVal1 numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'BackVal1') IS NULL ALTER TABLE ArticleNew ADD BackVal1 numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'FinalVal1') IS NULL ALTER TABLE ArticleNew ADD FinalVal1 numeric(18,3);
            IF COL_LENGTH('ArticleNew', 'MarketerPercent') IS NULL ALTER TABLE ArticleNew ADD MarketerPercent numeric(18,4);
            IF COL_LENGTH('ArticleNew', 'ArticleCoding') IS NULL ALTER TABLE ArticleNew ADD ArticleCoding varchar(16);
            IF COL_LENGTH('ArticleNew', 'CodingStore') IS NULL ALTER TABLE ArticleNew ADD CodingStore varchar(4);
            IF COL_LENGTH('ArticleNew', 'CodingGroupStore') IS NULL ALTER TABLE ArticleNew ADD CodingGroupStore varchar(4);
            IF COL_LENGTH('ArticleNew', 'tax_id') IS NULL ALTER TABLE ArticleNew ADD tax_id bigint;

            IF COL_LENGTH('StockType', 'For_EST') IS NULL ALTER TABLE StockType ADD For_EST tinyint;
            IF COL_LENGTH('StockType', 'Code_Col') IS NULL ALTER TABLE StockType ADD Code_Col numeric(18,0) NULL;
            IF COL_LENGTH('StockType', 'Code_Moein') IS NULL ALTER TABLE StockType ADD Code_Moein numeric(18,0) NULL;
            IF COL_LENGTH('StockType', 'Code_Tafzil') IS NULL ALTER TABLE StockType ADD Code_Tafzil numeric(18,0) NULL;
            IF COL_LENGTH('StockType', 'Code_Tafzil2') IS NULL ALTER TABLE StockType ADD Code_Tafzil2 numeric(18,0) NULL;
            IF COL_LENGTH('StockType', 'xIs_RegMinOrderToIn') IS NULL ALTER TABLE StockType ADD xIs_RegMinOrderToIn bit NULL;
            IF COL_LENGTH('StockType', 'xIs_RegMaxOrderToOut') IS NULL ALTER TABLE StockType ADD xIs_RegMaxOrderToOut bit NULL;
            IF COL_LENGTH('StockType', 'xIs_RegNegativKala') IS NULL ALTER TABLE StockType ADD xIs_RegNegativKala bit NULL;
            IF COL_LENGTH('StockType', 'xNotCalcPerDiscount') IS NULL ALTER TABLE StockType ADD xNotCalcPerDiscount bit NULL;
            IF COL_LENGTH('StockType', 'xNotCalcArezeshafzode') IS NULL ALTER TABLE StockType ADD xNotCalcArezeshafzode bit NULL;
            IF COL_LENGTH('StockType', 'xIs_CalcUnit2') IS NULL ALTER TABLE StockType ADD xIs_CalcUnit2 bit NULL;
            IF COL_LENGTH('StockType', 'xIs_CalcUnit3') IS NULL ALTER TABLE StockType ADD xIs_CalcUnit3 bit NULL;

            IF EXISTS (SELECT * FROM sys.objects WHERE name = 'IX_ArticleGroup') ALTER TABLE ArticleGroup DROP CONSTRAINT IX_ArticleGroup;
            IF COL_LENGTH('ArticleGroup', 'Degree') IS NULL ALTER TABLE ArticleGroup ADD [Degree] [numeric](18, 3) NULL;

            IF COL_LENGTH('ArticleUnit', 'TabileUnit') IS NULL ALTER TABLE ArticleUnit ADD TabileUnit numeric (18, 0);
            IF COL_LENGTH('ArticleUnit', 'tax_id') IS NULL ALTER TABLE ArticleUnit ADD tax_id bigint;
            ALTER TABLE ArticleUnit ALTER COLUMN TabileUnit numeric (18, 4);

            IF COL_LENGTH('Articles', 'Number') IS NULL ALTER TABLE Articles ADD Number float NULL;
            IF COL_LENGTH('Articles', 'Tag') IS NULL ALTER TABLE Articles ADD Tag int NULL DEFAULT ((1));
            IF COL_LENGTH('Articles', 'CommandStock') IS NULL ALTER TABLE Articles ADD CommandStock nvarchar (400) NULL;
            IF COL_LENGTH('Articles', 'KindArticles') IS NULL ALTER TABLE Articles ADD KindArticles tinyint NOT NULL;
            IF COL_LENGTH('InventoryTagHeader', 'Notes') IS NULL ALTER TABLE InventoryTagHeader ADD Notes nvarchar(200) NULL;

            IF NOT EXISTS (SELECT * FROM [Mahiat] WHERE Code = 0) INSERT INTO Mahiat (Code, Name) VALUES (0, N'');

            IF COL_LENGTH('Asset', 'GhesmatCode') IS NULL ALTER TABLE Asset ADD GhesmatCode int, CodeTrasfer int, DateTrasfer nvarchar(10);
            IF COL_LENGTH('Asset', 'CodeTrasfer') IS NULL ALTER TABLE Asset ADD CodeTrasfer int;
            IF COL_LENGTH('Asset', 'DateTrasfer') IS NULL ALTER TABLE Asset ADD DateTrasfer nvarchar(10);
            IF COL_LENGTH('Asset', 'GhesmatCode') IS NULL ALTER TABLE Asset ADD GhesmatCode int;
            """,

            // ============================================================
            // Alter Tables — بخش ۳ (Setting & Log & CheckExpend)
            // ============================================================
            """
            IF COL_LENGTH('Setting', 'SettingID') IS NULL ALTER TABLE Setting ADD [SettingID] numeric(18, 0);
            IF COL_LENGTH('Setting', 'HesabNum_TarazFirst') IS NULL ALTER TABLE Setting ADD [HesabNum_TarazFirst] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'HesabNum_TarazLast') IS NULL ALTER TABLE Setting ADD [HesabNum_TarazLast] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'UnderSanadStatment') IS NULL ALTER TABLE Setting ADD [UnderSanadStatment] [varchar](100) NULL;
            IF COL_LENGTH('Setting', 'HasLog') IS NULL ALTER TABLE Setting ADD [HasLog] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'HasGroupRegister') IS NULL ALTER TABLE Setting ADD [HasGroupRegister] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'HasNum_Daftar') IS NULL ALTER TABLE Setting ADD [HasNum_Daftar] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'SazmanCode') IS NULL ALTER TABLE Setting ADD [SazmanCode] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'HasBackup') IS NULL ALTER TABLE Setting ADD [HasBackup] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'HasUser') IS NULL ALTER TABLE Setting ADD [HasUser] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'FirstPassword') IS NULL ALTER TABLE Setting ADD [FirstPassword] [varchar](50) NULL;
            IF COL_LENGTH('Setting', 'SavePassword') IS NULL ALTER TABLE Setting ADD [SavePassword] [varchar](50) NULL;
            IF COL_LENGTH('Setting', 'OnRegisterPrint') IS NULL ALTER TABLE Setting ADD [OnRegisterPrint] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'OnRegisterCount') IS NULL ALTER TABLE Setting ADD [OnRegisterCount] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'OnBeforeEdit') IS NULL ALTER TABLE Setting ADD [OnBeforeEdit] [int] NULL;
            IF COL_LENGTH('Setting', 'LastPassword') IS NULL ALTER TABLE Setting ADD [LastPassword] [varchar](50) NULL;
            IF COL_LENGTH('Setting', 'Date_Op') IS NULL ALTER TABLE Setting ADD [Date_Op] [varchar](12) NULL;
            IF COL_LENGTH('Setting', 'Code_Op') IS NULL ALTER TABLE Setting ADD [Code_Op] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'Time_Op') IS NULL ALTER TABLE Setting ADD [Time_Op] [varchar](15) NULL;
            IF COL_LENGTH('Setting', 'PrintTodayDate') IS NULL ALTER TABLE Setting ADD [PrintTodayDate] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'TodayDate') IS NULL ALTER TABLE Setting ADD [TodayDate] [varchar](10) NULL;
            IF COL_LENGTH('Setting', 'Code') IS NULL ALTER TABLE Setting ADD [Code] [numeric](18, 0) NULL;
            IF COL_LENGTH('Setting', 'ShowRowHandred') IS NULL ALTER TABLE Setting ADD ShowRowHandred int NULL;
            IF COL_LENGTH('Setting', 'OnCalcAvarez') IS NULL ALTER TABLE Setting ADD OnCalcAvarez int NULL;
            IF COL_LENGTH('Setting', 'OnCalcMandeHesab') IS NULL ALTER TABLE Setting ADD OnCalcMandeHesab int NULL;
            IF COL_LENGTH('Setting', 'OnNotControlVal') IS NULL ALTER TABLE Setting ADD OnNotControlVal int NULL;
            IF COL_LENGTH('Setting', 'BuyDis') IS NULL ALTER TABLE Setting ADD [BuyDis] [nvarchar](250) NULL;
            IF COL_LENGTH('Setting', 'SelsDis') IS NULL ALTER TABLE Setting ADD [SelsDis] [nvarchar](250) NULL;
            IF COL_LENGTH('Setting', 'OnCalcMarketerPercent') IS NULL ALTER TABLE Setting ADD OnCalcMarketerPercent int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnFacBuy') IS NULL ALTER TABLE Setting ADD OnSaveSnFacBuy int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnFacSale') IS NULL ALTER TABLE Setting ADD OnSaveSnFacSale int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnFacReBuy') IS NULL ALTER TABLE Setting ADD OnSaveSnFacReBuy int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnFacReSale') IS NULL ALTER TABLE Setting ADD OnSaveSnFacReSale int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnResidPay') IS NULL ALTER TABLE Setting ADD OnSaveSnResidPay int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnResidRec') IS NULL ALTER TABLE Setting ADD OnSaveSnResidRec int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnChPay') IS NULL ALTER TABLE Setting ADD OnSaveSnChPay int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnChRec') IS NULL ALTER TABLE Setting ADD OnSaveSnChRec int NULL;
            IF COL_LENGTH('Setting', 'OnSaveSnChExp') IS NULL ALTER TABLE Setting ADD OnSaveSnChExp int NULL;
            IF COL_LENGTH('Setting', 'OnCodingKalaOK') IS NULL ALTER TABLE Setting ADD OnCodingKalaOK int NULL;
            IF COL_LENGTH('Setting', 'OnAmountSaleSep') IS NULL ALTER TABLE Setting ADD OnAmountSaleSep int NULL;
            IF COL_LENGTH('Setting', 'OnSMSToSeler') IS NULL ALTER TABLE Setting ADD OnSMSToSeler int null;
            IF COL_LENGTH('Setting', 'OnInfoForosh') IS NULL ALTER TABLE Setting ADD OnInfoForosh int null;
            IF COL_LENGTH('Setting', 'PersentForoshCost') IS NULL ALTER TABLE Setting ADD PersentForoshCost numeric(18,5) null;
            IF COL_LENGTH('Setting', 'OnPersentCostForosh') IS NULL ALTER TABLE Setting ADD OnPersentCostForosh int null;

            ALTER TABLE Log ALTER COLUMN Code_Op varchar(50);
            ALTER TABLE Log ALTER COLUMN Discript varchar(300);
            IF COL_LENGTH('Log', 'CuName') IS NULL ALTER TABLE Log ADD CuName varchar(150);

            IF COL_LENGTH('CheckExpend', 'WasDuring') IS NULL ALTER TABLE CheckExpend ADD [WasDuring] [numeric](18, 0) NULL;
            UPDATE CheckExpend SET [WasDuring] = 0 WHERE WasDuring IS NULL;
            """,

            // ============================================================
            // بازسازی جدول Log (فقط در صورت خالی بودن)
            // ============================================================
            """
            IF (SELECT COUNT(*) FROM [Log]) = 0
            BEGIN
                IF OBJECT_ID(N'dbo.Log', N'U') IS NOT NULL DROP TABLE [dbo].[Log];
                CREATE TABLE [dbo].[Log](
                    [LogID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [Discript] [varchar](300) NULL,
                    [CuName] [varchar](150) NULL,
                    [Code_Op] [varchar](50) NULL,
                    [Time_Op] [varchar](15) NULL,
                    [Date_Op] [varchar](12) NULL
                );
            END;
            """,

            // ============================================================
            // کليدهاي خارجي (Foreign Keys) و ايندکس‌ها
            // ============================================================
            """
            IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InventoryTagDetail_TagHeader')
                ALTER TABLE InventoryTagDetail ADD CONSTRAINT FK_InventoryTagDetail_TagHeader FOREIGN KEY (TagID) REFERENCES InventoryTagHeader(ID) ON DELETE CASCADE;

            IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InventoryTagHeader_StockType')
                ALTER TABLE InventoryTagHeader ADD CONSTRAINT FK_InventoryTagHeader_StockType FOREIGN KEY (StockTypeID) REFERENCES StockType(ID);

            IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InventoryTagDetail_ArticleNew')
                ALTER TABLE InventoryTagDetail ADD CONSTRAINT FK_InventoryTagDetail_ArticleNew FOREIGN KEY (ArticleID) REFERENCES ArticleNew(ID);

            IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InventoryStage_StockType')
                ALTER TABLE InventoryStage ADD CONSTRAINT FK_InventoryStage_StockType FOREIGN KEY (StockTypeID) REFERENCES StockType(ID);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryTagHeader_TagStatus' AND object_id = OBJECT_ID('InventoryTagHeader'))
                CREATE INDEX IX_InventoryTagHeader_TagStatus ON InventoryTagHeader(TagStatus ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryTagHeader_StockTypeID' AND object_id = OBJECT_ID('InventoryTagHeader'))
                CREATE INDEX IX_InventoryTagHeader_StockTypeID ON InventoryTagHeader(StockTypeID ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryTagHeader_StageNo' AND object_id = OBJECT_ID('InventoryTagHeader'))
                CREATE INDEX IX_InventoryTagHeader_StageNo ON InventoryTagHeader(StageNo ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryTagHeader_TagDate' AND object_id = OBJECT_ID('InventoryTagHeader'))
                CREATE INDEX IX_InventoryTagHeader_TagDate ON InventoryTagHeader(TagDate ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryTagDetail_TagID' AND object_id = OBJECT_ID('InventoryTagDetail'))
                CREATE INDEX IX_InventoryTagDetail_TagID ON InventoryTagDetail(TagID ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryTagDetail_ArticleID' AND object_id = OBJECT_ID('InventoryTagDetail'))
                CREATE INDEX IX_InventoryTagDetail_ArticleID ON InventoryTagDetail(ArticleID ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryTagDetail_CountedQty' AND object_id = OBJECT_ID('InventoryTagDetail'))
                CREATE INDEX IX_InventoryTagDetail_CountedQty ON InventoryTagDetail(CountedQty ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryStage_StockTypeID' AND object_id = OBJECT_ID('InventoryStage'))
                CREATE INDEX IX_InventoryStage_StockTypeID ON InventoryStage(StockTypeID ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryStage_IsActive' AND object_id = OBJECT_ID('InventoryStage'))
                CREATE INDEX IX_InventoryStage_IsActive ON InventoryStage(IsActive ASC);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryToStockFactor_TagID' AND object_id = OBJECT_ID('InventoryToStockFactor'))
                CREATE INDEX IX_InventoryToStockFactor_TagID ON InventoryToStockFactor(TagID);

            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryToStockFactor_StockFactorID' AND object_id = OBJECT_ID('InventoryToStockFactor'))
                CREATE INDEX IX_InventoryToStockFactor_StockFactorID ON InventoryToStockFactor(StockFactorID);
            """,
             // ============================================================
            // جداول ماژول خدمات (ServiceDefinition & ServiceCase)
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.ServiceDefinition', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.ServiceDefinition
                ( 
                    ID numeric(18,0) IDENTITY(1,1) NOT NULL,
                    Code numeric(18,0) NULL,
                    ServiceName varchar(100) NOT NULL,
                    Description varchar(500) NULL,
                    ServiceType numeric(18,0) NOT NULL CONSTRAINT DF_ServiceDefinition_ServiceType DEFAULT (5),
                    CalculationType numeric(18,0) NOT NULL CONSTRAINT DF_ServiceDefinition_CalculationType DEFAULT (1),
                    DefaultPercent numeric(18,4) NULL,
                    DefaultAmount numeric(19,4) NULL,
                    HasPrincipal bit NOT NULL CONSTRAINT DF_ServiceDefinition_HasPrincipal DEFAULT (0),
                    HasTransactionAmount bit NOT NULL CONSTRAINT DF_ServiceDefinition_HasTransactionAmount DEFAULT (0),
                    HasSettlement bit NOT NULL CONSTRAINT DF_ServiceDefinition_HasSettlement DEFAULT (0),
                    HasDirectCost bit NOT NULL CONSTRAINT DF_ServiceDefinition_HasDirectCost DEFAULT (0),
                    ConnectToFactor bit NOT NULL CONSTRAINT DF_ServiceDefinition_ConnectToFactor DEFAULT (1),
                    IsTaxable bit NOT NULL CONSTRAINT DF_ServiceDefinition_IsTaxable DEFAULT (1),
                    TaxPercent numeric(18,4) NULL,
                    ArticleID numeric(18,0) NULL,
                    RevenueHesabID numeric(18,0) NULL,
                    CostHesabID numeric(18,0) NULL,
                    PrincipalHesabID numeric(18,0) NULL,
                    IsActive bit NOT NULL CONSTRAINT DF_ServiceDefinition_IsActive DEFAULT (1),
                    CreatorID numeric(18,0) NULL,
                    CreateDate varchar(12) NULL,
                    CreateTime varchar(15) NULL,
                    UpdaterID numeric(18,0) NULL,
                    UpdateDate varchar(12) NULL,
                    UpdateTime varchar(15) NULL,
                    CONSTRAINT PK_ServiceDefinition PRIMARY KEY (ID),
                    CONSTRAINT UQ_ServiceDefinition_Code UNIQUE (Code),
                    CONSTRAINT CK_ServiceDefinition_ServiceType CHECK (ServiceType BETWEEN 1 AND 7),
                    CONSTRAINT CK_ServiceDefinition_CalculationType CHECK (CalculationType BETWEEN 1 AND 5),
                    CONSTRAINT CK_ServiceDefinition_DefaultPercent CHECK (DefaultPercent IS NULL OR DefaultPercent >= 0),
                    CONSTRAINT CK_ServiceDefinition_TaxPercent CHECK (TaxPercent IS NULL OR TaxPercent >= 0)
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.ServiceCase', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.ServiceCase
                ( 
                    ID numeric(18,0) IDENTITY(1,1) NOT NULL,
                    CaseNo numeric(18,0) NOT NULL,
                    CaseDate varchar(12) NOT NULL,
                    ServiceDefinitionID numeric(18,0) NOT NULL,
                    Title varchar(200) NOT NULL,
                    Description varchar(1000) NULL,
                    ContractNo varchar(50) NULL,
                    ContractDate varchar(12) NULL,
                    CustomerTafziliCode numeric(18,0) NULL,
                    PrincipalTafziliCode numeric(18,0) NULL,
                    OtherTafziliCode numeric(18,0) NULL,
                    BaseAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_BaseAmount DEFAULT (0),
                    TransactionAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_TransactionAmount DEFAULT (0),
                    CommissionPercent numeric(18,4) NOT NULL CONSTRAINT DF_ServiceCase_CommissionPercent DEFAULT (0),
                    CommissionAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_CommissionAmount DEFAULT (0),
                    DiscountAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_DiscountAmount DEFAULT (0),
                    TaxPercent numeric(18,4) NOT NULL CONSTRAINT DF_ServiceCase_TaxPercent DEFAULT (0),
                    TaxAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_TaxAmount DEFAULT (0),
                    OtherAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_OtherAmount DEFAULT (0),
                    TotalAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_TotalAmount DEFAULT (0),
                    PrincipalAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_PrincipalAmount DEFAULT (0),
                    CustomerReceivableAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCase_CustomerReceivableAmount DEFAULT (0),
                    Status numeric(18,0) NOT NULL CONSTRAINT DF_ServiceCase_Status DEFAULT (1),
                    StartDate varchar(12) NULL,
                    EndDate varchar(12) NULL,
                    ResponsibleUserID numeric(18,0) NULL,
                    IsPosted bit NOT NULL CONSTRAINT DF_ServiceCase_IsPosted DEFAULT (0),
                    ParentSanadID numeric(18,0) NULL,
                    CreatorID numeric(18,0) NULL,
                    CreateDate varchar(12) NULL,
                    CreateTime varchar(15) NULL,
                    UpdaterID numeric(18,0) NULL,
                    UpdateDate varchar(12) NULL,
                    UpdateTime varchar(15) NULL,
                    CONSTRAINT PK_ServiceCase PRIMARY KEY (ID),
                    CONSTRAINT UQ_ServiceCase_CaseNo UNIQUE (CaseNo),
                    CONSTRAINT FK_ServiceCase_ServiceDefinition FOREIGN KEY (ServiceDefinitionID) REFERENCES dbo.ServiceDefinition(ID),
                    CONSTRAINT CK_ServiceCase_Status CHECK (Status BETWEEN 1 AND 5),
                    CONSTRAINT CK_ServiceCase_Amounts CHECK (
                        BaseAmount >= 0 AND TransactionAmount >= 0 AND CommissionAmount >= 0 AND 
                        DiscountAmount >= 0 AND TaxAmount >= 0 AND OtherAmount >= 0 AND 
                        TotalAmount >= 0 AND PrincipalAmount >= 0 AND CustomerReceivableAmount >= 0
                    ),
                    CONSTRAINT CK_ServiceCase_Percent CHECK (CommissionPercent >= 0 AND TaxPercent >= 0)
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.ServiceCaseDetail', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.ServiceCaseDetail
                (
                    ID numeric(18,0) IDENTITY(1,1) NOT NULL,
                    CaseID numeric(18,0) NOT NULL,
                    RowNo numeric(18,0) NOT NULL,
                    OperationDate varchar(12) NULL,
                    OperationType numeric(18,0) NOT NULL CONSTRAINT DF_ServiceCaseDetail_OperationType DEFAULT (7),
                    Title varchar(200) NOT NULL,
                    [Description] varchar(1000) NULL,
                    ReferenceNo varchar(100) NULL,
                    Quantity numeric(18,4) NOT NULL CONSTRAINT DF_ServiceCaseDetail_Quantity DEFAULT (1),
                    UnitAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCaseDetail_UnitAmount DEFAULT (0),
                    BaseAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCaseDetail_BaseAmount DEFAULT (0),
                    [Percent] numeric(18,4) NOT NULL CONSTRAINT DF_ServiceCaseDetail_Percent DEFAULT (0),
                    CommissionAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCaseDetail_CommissionAmount DEFAULT (0),
                    TaxAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCaseDetail_TaxAmount DEFAULT (0),
                    OtherAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCaseDetail_OtherAmount DEFAULT (0),
                    [Status] numeric(18,0) NOT NULL CONSTRAINT DF_ServiceCaseDetail_Status DEFAULT (1),
                    ArticleID numeric(18,0) NULL,
                    FactorID numeric(18,0) NULL,
                    FactorDetailID numeric(18,0) NULL,
                    CreatorID numeric(18,0) NULL,
                    CreateDate varchar(12) NULL,
                    CreateTime varchar(15) NULL,
                    CONSTRAINT PK_ServiceCaseDetail PRIMARY KEY (ID),
                    CONSTRAINT UQ_ServiceCaseDetail_RowNo UNIQUE (CaseID, RowNo),
                    CONSTRAINT FK_ServiceCaseDetail_ServiceCase FOREIGN KEY (CaseID) REFERENCES dbo.ServiceCase(ID),
                    CONSTRAINT CK_ServiceCaseDetail_Status CHECK (Status BETWEEN 1 AND 3),
                    CONSTRAINT CK_ServiceCaseDetail_Amounts CHECK (
                        Quantity >= 0 AND UnitAmount >= 0 AND BaseAmount >= 0 AND 
                        [Percent] >= 0 AND CommissionAmount >= 0 AND TaxAmount >= 0 AND OtherAmount >= 0
                    )
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.ServiceCaseFactor', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.ServiceCaseFactor
                ( 
                    ID numeric(18,0) IDENTITY(1,1) NOT NULL,
                    CaseID numeric(18,0) NOT NULL,
                    FactorID numeric(18,0) NOT NULL,
                    FactorRole numeric(18,0) NOT NULL,
                    Description varchar(500) NULL,
                    CreatorID numeric(18,0) NULL,
                    CreateDate varchar(12) NULL,
                    CreateTime varchar(15) NULL,
                    CONSTRAINT PK_ServiceCaseFactor PRIMARY KEY (ID),
                    CONSTRAINT UQ_ServiceCaseFactor UNIQUE (CaseID, FactorID, FactorRole),
                    CONSTRAINT FK_ServiceCaseFactor_ServiceCase FOREIGN KEY (CaseID) REFERENCES dbo.ServiceCase(ID),
                    CONSTRAINT CK_ServiceCaseFactor_FactorRole CHECK (FactorRole BETWEEN 1 AND 6)
                );
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.ServiceSettlement', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.ServiceSettlement
                (
                    ID numeric(18,0) IDENTITY(1,1) NOT NULL,
                    CaseID numeric(18,0) NOT NULL,
                    SettlementDate varchar(12) NOT NULL,
                    SettlementType numeric(18,0) NOT NULL,
                    TafziliCode numeric(18,0) NULL,
                    Amount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceSettlement_Amount DEFAULT (0),
                    PaymentMethod numeric(18,0) NULL,
                    ReferenceNo varchar(100) NULL,
                    Description varchar(1000) NULL,
                    FactorID numeric(18,0) NULL,
                    ParentSanadID numeric(18,0) NULL,
                    IsConfirmed bit NOT NULL CONSTRAINT DF_ServiceSettlement_IsConfirmed DEFAULT (0),
                    CreatorID numeric(18,0) NULL,
                    CreateDate varchar(12) NULL,
                    CreateTime varchar(15) NULL,
                    ConfirmerID numeric(18,0) NULL,
                    ConfirmDate varchar(12) NULL,
                    ConfirmTime varchar(15) NULL,
                    CONSTRAINT PK_ServiceSettlement PRIMARY KEY (ID),
                    CONSTRAINT FK_ServiceSettlement_ServiceCase FOREIGN KEY (CaseID) REFERENCES dbo.ServiceCase(ID),
                    CONSTRAINT CK_ServiceSettlement_Type CHECK (SettlementType BETWEEN 1 AND 6),
                    CONSTRAINT CK_ServiceSettlement_PaymentMethod CHECK (PaymentMethod IS NULL OR PaymentMethod BETWEEN 1 AND 6),
                    CONSTRAINT CK_ServiceSettlement_Amount CHECK (Amount >= 0)
                );
            END;
            """,

            // ============================================================
            // ایجاد ایندکس‌ها (Indexes)
            // ============================================================
            """
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceCase_CustomerTafziliCode' AND object_id = OBJECT_ID(N'dbo.ServiceCase'))
                CREATE INDEX IX_ServiceCase_CustomerTafziliCode ON dbo.ServiceCase(CustomerTafziliCode);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceCase_PrincipalTafziliCode' AND object_id = OBJECT_ID(N'dbo.ServiceCase'))
                CREATE INDEX IX_ServiceCase_PrincipalTafziliCode ON dbo.ServiceCase(PrincipalTafziliCode);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceCase_CaseDate' AND object_id = OBJECT_ID(N'dbo.ServiceCase'))
                CREATE INDEX IX_ServiceCase_CaseDate ON dbo.ServiceCase(CaseDate);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceCaseFactor_FactorID' AND object_id = OBJECT_ID(N'dbo.ServiceCaseFactor'))
                CREATE INDEX IX_ServiceCaseFactor_FactorID ON dbo.ServiceCaseFactor(FactorID);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceCaseCost_FactorID' AND object_id = OBJECT_ID(N'dbo.ServiceCaseCost'))
                CREATE INDEX IX_ServiceCaseCost_FactorID ON dbo.ServiceCaseCost(FactorID);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceSettlement_FactorID' AND object_id = OBJECT_ID(N'dbo.ServiceSettlement'))
                CREATE INDEX IX_ServiceSettlement_FactorID ON dbo.ServiceSettlement(FactorID);
            """,

            // ============================================================
            // حذف و اضافه کردن فیلدهای جدید در ServiceDefinition
            // ============================================================
            """
            -- حذف ستون‌های قدیمی (فقط اگر وجود داشته باشند)
            IF COL_LENGTH('dbo.ServiceDefinition', 'RevenueHesabID') IS NOT NULL ALTER TABLE dbo.ServiceDefinition DROP COLUMN RevenueHesabID;
            IF COL_LENGTH('dbo.ServiceDefinition', 'CostHesabID') IS NOT NULL ALTER TABLE dbo.ServiceDefinition DROP COLUMN CostHesabID;
            IF COL_LENGTH('dbo.ServiceDefinition', 'PrincipalHesabID') IS NOT NULL ALTER TABLE dbo.ServiceDefinition DROP COLUMN PrincipalHesabID;

            -- اضافه کردن ستون‌های جدید (فقط اگر وجود نداشته باشند)
            IF COL_LENGTH('dbo.ServiceDefinition', 'RevenueCode_Col') IS NULL ALTER TABLE dbo.ServiceDefinition ADD RevenueCode_Col numeric(18,0) NULL;
            IF COL_LENGTH('dbo.ServiceDefinition', 'RevenueCode_Moein') IS NULL ALTER TABLE dbo.ServiceDefinition ADD RevenueCode_Moein numeric(18,0) NULL;
            IF COL_LENGTH('dbo.ServiceDefinition', 'RevenueCode_Tafzil') IS NULL ALTER TABLE dbo.ServiceDefinition ADD RevenueCode_Tafzil numeric(18,0) NULL;
            
            IF COL_LENGTH('dbo.ServiceDefinition', 'CostCode_Col') IS NULL ALTER TABLE dbo.ServiceDefinition ADD CostCode_Col numeric(18,0) NULL;
            IF COL_LENGTH('dbo.ServiceDefinition', 'CostCode_Moein') IS NULL ALTER TABLE dbo.ServiceDefinition ADD CostCode_Moein numeric(18,0) NULL;
            IF COL_LENGTH('dbo.ServiceDefinition', 'CostCode_Tafzil') IS NULL ALTER TABLE dbo.ServiceDefinition ADD CostCode_Tafzil numeric(18,0) NULL;
            
            IF COL_LENGTH('dbo.ServiceDefinition', 'PrincipalCode_Col') IS NULL ALTER TABLE dbo.ServiceDefinition ADD PrincipalCode_Col numeric(18,0) NULL;
            IF COL_LENGTH('dbo.ServiceDefinition', 'PrincipalCode_Moein') IS NULL ALTER TABLE dbo.ServiceDefinition ADD PrincipalCode_Moein numeric(18,0) NULL;
            IF COL_LENGTH('dbo.ServiceDefinition', 'PrincipalCode_Tafzil') IS NULL ALTER TABLE dbo.ServiceDefinition ADD PrincipalCode_Tafzil numeric(18,0) NULL;
            """,
            """
            SET ARITHABORT ON;
            SET ANSI_NULLS ON;
            SET ANSI_PADDING ON;
            SET ANSI_WARNINGS ON;
            SET CONCAT_NULL_YIELDS_NULL ON;
            SET QUOTED_IDENTIFIER ON;
            SET NUMERIC_ROUNDABORT OFF;

                IF OBJECT_ID(N'dbo.ServiceCaseCost', N'U') IS NULL 
                BEGIN
                 CREATE TABLE dbo.ServiceCaseCost
                 ( 
                    ID numeric(18,0) IDENTITY(1,1) NOT NULL,
                    CaseID numeric(18,0) NOT NULL,
                    CostDate varchar(12) NOT NULL,
                    CostType numeric(18,0) NOT NULL,
                    Title varchar(200) NOT NULL,
                    Description varchar(1000) NULL,
                    TafziliCode numeric(18,0) NULL,
                    Code_Col numeric(18,0) NULL,
                    Code_Moein numeric(18,0) NULL,
                    Code_Tafzil numeric(18,0) NULL, 
                    Amount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCaseCost_Amount DEFAULT (0),
                    TaxPercent numeric(18,4) NOT NULL CONSTRAINT DF_ServiceCaseCost_TaxPercent DEFAULT (0),
                    TaxAmount numeric(19,4) NOT NULL CONSTRAINT DF_ServiceCaseCost_TaxAmount DEFAULT (0),
                    TotalAmount AS(CONVERT(numeric(19,4), Amount + TaxAmount)) PERSISTED,
                    FactorID numeric(18,0) NULL,
                    FactorDetailID numeric(18,0) NULL,
                    ParentSanadID numeric(18,0) NULL,
                    IsPaid bit NOT NULL CONSTRAINT DF_ServiceCaseCost_IsPaid DEFAULT (0),
                    CreatorID numeric(18,0) NULL,
                    CreateDate varchar(12) NULL,
                    CreateTime varchar(15) NULL,
                    CONSTRAINT PK_ServiceCaseCost PRIMARY KEY (ID),
                    CONSTRAINT FK_ServiceCaseCost_ServiceCase FOREIGN KEY (CaseID) REFERENCES dbo.ServiceCase(ID),
                    CONSTRAINT CK_ServiceCaseCost_CostType CHECK (CostType BETWEEN 1 AND 7),
                    CONSTRAINT CK_ServiceCaseCost_Amounts CHECK (Amount >= 0 AND TaxAmount >= 0 AND TaxPercent >= 0)
                    );
                END
            """,

    // ============================================================
            // Functions — بخش اول (توابع پایه)
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.Get_CashOK', N'FN') IS NOT NULL DROP FUNCTION [dbo].[Get_CashOK];
            IF OBJECT_ID(N'dbo.Get_CashName', N'FN') IS NOT NULL DROP FUNCTION [dbo].[Get_CashName];
            IF OBJECT_ID(N'dbo.GetArticleCount', N'FN') IS NOT NULL DROP FUNCTION [dbo].[GetArticleCount];
            IF OBJECT_ID(N'dbo.GetArticleCost', N'FN') IS NOT NULL DROP FUNCTION [dbo].[GetArticleCost];
            IF OBJECT_ID(N'dbo.GetDateDiff', N'FN') IS NOT NULL DROP FUNCTION [dbo].[GetDateDiff];
            IF OBJECT_ID(N'dbo.GetStockKalaVal', N'FN') IS NOT NULL DROP FUNCTION [dbo].[GetStockKalaVal];
            IF OBJECT_ID(N'dbo.GetStockKalaAmount', N'FN') IS NOT NULL DROP FUNCTION [dbo].[GetStockKalaAmount];
            IF OBJECT_ID(N'dbo.fnArticle_WithDate', N'IF') IS NOT NULL DROP FUNCTION [dbo].[fnArticle_WithDate];
            IF OBJECT_ID(N'dbo.GetMToSDate', N'FN') IS NOT NULL DROP FUNCTION [dbo].[GetMToSDate];
            IF OBJECT_ID(N'dbo.GetStockTypeKind', N'FN') IS NOT NULL DROP FUNCTION [dbo].[GetStockTypeKind];
            IF OBJECT_ID(N'dbo.fn_GetArticleStock', N'FN') IS NOT NULL DROP FUNCTION [dbo].[fn_GetArticleStock];
            IF OBJECT_ID(N'dbo.fn_GetCurrentStock', N'FN') IS NOT NULL DROP FUNCTION [dbo].[fn_GetCurrentStock];
            IF OBJECT_ID(N'dbo.fn_GetArticleCost', N'FN') IS NOT NULL DROP FUNCTION [dbo].[fn_GetArticleCost];
            IF OBJECT_ID(N'dbo.Get_Depreciation_Type', N'FN') IS NOT NULL DROP FUNCTION [dbo].[Get_Depreciation_Type];
            IF OBJECT_ID(N'dbo.fn_GetNTSW_Data', N'IF') IS NOT NULL DROP FUNCTION [dbo].[fn_GetNTSW_Data];
            """,
           """
            CREATE FUNCTION [dbo].[Get_Depreciation_Type] (@Kind int)
            RETURNS varchar(30) AS BEGIN
                Declare @Temp varchar(30)
                set @Temp = N'درصدی'
                if IsNull(@Kind,0) = 0 set @Temp = N'مستقیم'
                return(@Temp)
            END;
            """,

            """
            CREATE FUNCTION [dbo].[Get_CashOK](@Kind int, @Val int)
            RETURNS int AS
            BEGIN
                Declare @Temp int
                set @Temp = 0
                if IsNull(@Kind,0) = IsNull(@Val,0)
                    set @Temp = 1
                return(@Temp)
            END;
            """,

            """
            CREATE FUNCTION [dbo].[Get_CashName](@Kind int)
            RETURNS varchar(30) AS
            BEGIN
                Declare @Temp varchar(30)
                set @Temp =''
                if IsNull(@Kind,0) = 1
                    set @Temp = N'نقدی'
                else if IsNull(@Kind,0) = 2
                    set @Temp = N'غیرنقدی'
                return(@Temp)
            END;
            """,

            """
            CREATE FUNCTION [dbo].[GetArticleCount](@ArticleID numeric, @aType int)
            RETURNS float AS
            BEGIN
                Declare @aTemp Float
                set @aTemp = 0
                select @aTemp = Sum(ArticleCount) from FactorDetail where ArticleID = @ArticleID and
                        FactorID in (Select ID From FactorParent where FactorKind = @aType)
                return(IsNull(@aTemp, 0))
            END;
            """,

            """
            CREATE FUNCTION [dbo].[GetArticleCost](@ArticleID numeric)
            RETURNS numeric AS
            BEGIN
                Declare @aTemp numeric
                Set @aTemp = 0
                Select @aTemp = IsNull((Select Top 1 Sum(IsNull(CostTax,0)) / isnull(Sum(ArticleCount),0)
                    from FactorDetail_VIEW
                    where ArticleID = @ArticleID and FactorKind = 0), 0)
                return(IsNull(@aTemp, 0))
            END;
            """,

            """
            CREATE FUNCTION [dbo].[GetDateDiff] (@aDate1 varchar(10), @aTime1 varchar(5), @aDate2 varchar(10), @aTime2 varchar(5), @aDiffType varchar(2))
            RETURNS integer AS
            BEGIN
                Declare @aMDate1 datetime, @aMDate2 datetime
                Declare @aTemp integer, @aHour int, @aMin int
                Declare @aStrTemp varchar(2), @aStrTemp2 varchar(2)
                
                if CharIndex(':', @aTime1) = 0 set @aTime1 = stuff(@aTime1, 3, 0, ':')
                if CharIndex(':', @aTime2) = 0 set @aTime2 = stuff(@aTime2, 3, 0, ':')
                
                if CharIndex('/', convert(varchar(10),@aDate1, 111)) = 0 
                    set @aDate1 = Stuff(stuff(@aDate1, 5, 0, '/'), 8, 0, '/')
                if CharIndex('/', convert(varchar(10),@aDate2, 111)) = 0 
                    set @aDate2 = Stuff(stuff(@aDate2, 5, 0, '/'), 8, 0, '/')
                
                if convert(int, Substring(@aDate1, 1, 4)) < 1300 Return(0)
                if convert(int, Substring(@aDate2, 1, 4)) < 1300 Return(0)
                if convert(int, Substring(@aDate1, 6, 2)) < 1 or convert(int, Substring(@aDate1, 6, 2)) > 12 Return(0)
                if convert(int, Substring(@aDate2, 6, 2)) < 1 or convert(int, Substring(@aDate2, 6, 2)) > 12 Return(0)
                if convert(int, Substring(@aDate1, 9, 2)) < 1 or convert(int, Substring(@aDate1, 9, 2)) > 31 Return(0)
                if convert(int, Substring(@aDate2, 9, 2)) < 1 or convert(int, Substring(@aDate2, 9, 2)) > 31 Return(0)
                
                set @aMin = Convert(int, Substring(@aTime1, 4, 2))
                if @aMin >= 60
                begin
                    set @aStrTemp = convert(varchar(2), @aMin%60)
                    if len(@aStrTemp) < 2 set @aStrTemp = '0' + @aStrTemp
                    set @aHour = Convert(int, Substring(@aTime1, 1, 2)) + (@aMin / 60)
                    set @aTime1 = convert(varchar(2), @aHour)
                    if len(@aTime1) < 2 set @aTime1 = '0' + @aTime1
                    set @aTime1 = @aTime1 + ':' + @aStrTemp
                end
                
                set @aMin = Convert(int, Substring(@aTime2, 4, 2))
                if @aMin >= 60
                begin
                    set @aStrTemp = convert(varchar(2), @aMin%60)
                    if len(@aStrTemp) < 2 set @aStrTemp = '0' + @aStrTemp
                    set @aHour = Convert(int, Substring(@aTime2, 1, 2)) + (@aMin / 60)
                    set @aTime2 = convert(varchar(2), @aHour)
                    if len(@aTime2) < 2 set @aTime2 = '0' + @aTime2
                    set @aTime2 = @aTime2 + ':' + @aStrTemp
                end
                
                set @aHour = Convert(int, Substring(@aTime1, 1, 2))
                if @aHour >= 24
                begin
                    set @aStrTemp = convert(varchar(2), @aHour%24)
                    if len(@aStrTemp) < 2 set @aStrTemp = '0' + @aStrTemp
                    set @aTime1 = Stuff(@aTime1, 1, 2, @aStrTemp)
                    Set @aMDate1 = convert(datetime, dbo.GetStoMDate(@aDate1) + ' ' + @aTime1)
                    set @aMDate1 = DateAdd(Day, @aHour/24, @aMDate1)
                end
                else
                    Set @aMDate1 = convert(datetime, dbo.GetStoMDate(@aDate1) + ' ' + @aTime1)
                
                set @aHour = Convert(int, Substring(@aTime2, 1, 2))
                if @aHour >= 24
                begin
                    set @aStrTemp = convert(varchar(2), @aHour%24)
                    if len(@aStrTemp) < 2 set @aStrTemp = '0' + @aStrTemp
                    set @aTime2 = Stuff(@aTime2, 1, 2, @aStrTemp)
                    Set @aMDate2 = convert(datetime, dbo.GetStoMDate(@aDate2) + ' ' + @aTime2)
                    set @aMDate2 = DateAdd(Day, @aHour/24, @aMDate2)
                end
                else
                    Set @aMDate2 = convert(datetime, dbo.GetStoMDate(@aDate2) + ' ' + @aTime2)
                
                Set @aTemp = case
                    when upper(@aDiffType) = 'MS' then (Select DateDiff(millisecond, @aMDate1, @aMDate2))
                    when upper(@aDiffType) = 'SE' then (Select DateDiff(Second, @aMDate1, @aMDate2))
                    when upper(@aDiffType) = 'MI' then (Select DateDiff(Minute, @aMDate1, @aMDate2))
                    when upper(@aDiffType) = 'HO' then (Select DateDiff(Hour, @aMDate1, @aMDate2))
                    when upper(@aDiffType) = 'DA' then (Select DateDiff(Day, @aMDate1, @aMDate2))
                    when upper(@aDiffType) = 'WE' then (Select DateDiff(Week, @aMDate1, @aMDate2))
                    when upper(@aDiffType) = 'MO' then (Select DateDiff(Month, @aMDate1, @aMDate2))
                    when upper(@aDiffType) = 'YE' then (Select DateDiff(Year, @aMDate1, @aMDate2))
                end
                Return(@aTemp)
            END;
            """,

            """
            CREATE FUNCTION [dbo].[GetStockKalaVal](@ArticleID numeric, @Kind int, @aDatefrom varchar(10), @aDateTo varchar(10), @Type int)
            RETURNS Float AS
            BEGIN
                Declare @aTemp Float
                Set @aTemp = 0
                if @aDatefrom = '' Set @aDatefrom = '0000/00/00'
                if @aDateTo = '' Set @aDateTo = '9999/99/99'
                
                if @Type = 0
                begin
                    Select @aTemp = IsNull((Select Sum(IsNull(Val,0)) from Stock_Factor_All_VIEW
                        where ArticleID = @ArticleID and Kind = @Kind and isNull(FactorID,0) = 0
                        and DateIn >= @aDatefrom and DateIn <= @aDateTo), 0)
                end
                if @Type = 1
                begin
                    Select @aTemp = IsNull((Select Sum(IsNull(ArticleCount,0)) from FactorDetail_VIEW
                        where ArticleID = @ArticleID and FactorKind = @Kind
                        and DateIn >= @aDatefrom and DateIn <= @aDateTo), 0)
                end
                return(IsNull(@aTemp, 0))
            END;
            """,

            """
            CREATE FUNCTION [dbo].[GetStockKalaAmount](@ArticleID numeric, @Kind int, @aDatefrom varchar(10), @aDateTo varchar(10), @Type int)
            RETURNS Float AS
            BEGIN
                Declare @aTemp Float
                Set @aTemp = 0
                if @aDatefrom = '' Set @aDatefrom = '0000/00/00'
                if @aDateTo = '' Set @aDateTo = '9999/99/99'
                
                if @Type = 0
                begin
                    Select @aTemp = IsNull((Select Sum(IsNull(Cost,0)) * Sum(IsNull(Val,0)) from Stock_Factor_All_VIEW
                        where ArticleID = @ArticleID and Kind = @Kind
                        and DateIn >= @aDatefrom and DateIn <= @aDateTo), 0)
                end
                if @Type = 1
                begin
                    Select @aTemp = IsNull((Select Sum(IsNull(CostTax,0)) from FactorDetail_VIEW
                        where ArticleID = @ArticleID and FactorKind = @Kind
                        and DateIn >= @aDatefrom and DateIn <= @aDateTo), 0)
                end
                return(IsNull(@aTemp, 0))
            END;
            """,
            // ============================================================
            // View های دیتابیس Tenant
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.ArticleNew_VIEW', N'V') IS NOT NULL DROP VIEW dbo.ArticleNew_VIEW;
            IF OBJECT_ID(N'dbo.InventoryTagView', N'V') IS NOT NULL DROP VIEW dbo.InventoryTagView;
            IF OBJECT_ID(N'dbo.InventoryTagDetailView', N'V') IS NOT NULL DROP VIEW dbo.InventoryTagDetailView;
            IF OBJECT_ID(N'dbo.InventoryDiffReportView', N'V') IS NOT NULL DROP VIEW dbo.InventoryDiffReportView;
            IF OBJECT_ID(N'dbo.InventoryHistoryView', N'V') IS NOT NULL DROP VIEW dbo.InventoryHistoryView;
            IF OBJECT_ID(N'dbo.Article_View', N'V') IS NOT NULL DROP VIEW dbo.Article_View;
            IF OBJECT_ID(N'dbo.InventoryStageSummaryView', N'V') IS NOT NULL DROP VIEW dbo.InventoryStageSummaryView;
            IF OBJECT_ID(N'dbo.ChequeBank_View', N'V') IS NOT NULL DROP VIEW dbo.ChequeBank_View;
            IF OBJECT_ID(N'dbo.ChequeBook_View', N'V') IS NOT NULL DROP VIEW dbo.ChequeBook_View;
            IF OBJECT_ID(N'dbo.FactorDetail_VIEW', N'V') IS NOT NULL DROP VIEW dbo.FactorDetail_VIEW;
            IF OBJECT_ID(N'dbo.ConstHesabs_View', N'V') IS NOT NULL DROP VIEW dbo.ConstHesabs_View;
            IF OBJECT_ID(N'dbo.ChequeBook_Child_View', N'V') IS NOT NULL DROP VIEW dbo.ChequeBook_Child_View;
            IF OBJECT_ID(N'dbo.ParentSanad_VIEW', N'V') IS NOT NULL DROP VIEW dbo.ParentSanad_VIEW;
            IF OBJECT_ID(N'dbo.Tafzili1_Report_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Tafzili1_Report_VIEW;
            IF OBJECT_ID(N'dbo.Tafzili_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Tafzili_VIEW;
            IF OBJECT_ID(N'dbo.FactorParent_View', N'V') IS NOT NULL DROP VIEW dbo.FactorParent_View;
            IF OBJECT_ID(N'dbo.VW_SelectHesab', N'V') IS NOT NULL DROP VIEW dbo.VW_SelectHesab;
            IF OBJECT_ID(N'dbo.Hesab_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Hesab_VIEW;
            IF OBJECT_ID(N'dbo.Moein_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Moein_VIEW;
            IF OBJECT_ID(N'dbo.Col_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Col_VIEW;
            IF OBJECT_ID(N'dbo.Tafzili2_Report_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Tafzili2_Report_VIEW;
            IF OBJECT_ID(N'dbo.Asset_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Asset_VIEW;
            IF OBJECT_ID(N'dbo.ArticleLenCode_View', N'V') IS NOT NULL DROP VIEW dbo.ArticleLenCode_View;
            IF OBJECT_ID(N'dbo.Asset_Export_View', N'V') IS NOT NULL DROP VIEW dbo.Asset_Export_View;
            IF OBJECT_ID(N'dbo.ArticleGroup_View', N'V') IS NOT NULL DROP VIEW dbo.ArticleGroup_View;
            IF OBJECT_ID(N'dbo.vw_TalfighSanad', N'V') IS NOT NULL DROP VIEW dbo.vw_TalfighSanad;
            IF OBJECT_ID(N'dbo.Stock_Factor_Mat_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Stock_Factor_Mat_VIEW;
            IF OBJECT_ID(N'dbo.Stock_Factor_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Stock_Factor_VIEW;
            IF OBJECT_ID(N'dbo.Stock_Factor_All_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Stock_Factor_All_VIEW;
            IF OBJECT_ID(N'dbo.Tafzili_Customer_VIEW', N'V') IS NOT NULL DROP VIEW dbo.Tafzili_Customer_VIEW;
            IF OBJECT_ID(N'dbo.Vw_ExcelSanad', N'V') IS NOT NULL DROP VIEW dbo.Vw_ExcelSanad;
            IF OBJECT_ID(N'dbo.vw_CheckExpend2', N'V') IS NOT NULL DROP VIEW dbo.vw_CheckExpend2;
            IF OBJECT_ID(N'dbo.ServiceDefinition_VIEW', N'V') IS NOT NULL DROP VIEW dbo.ServiceDefinition_VIEW;
            IF OBJECT_ID(N'dbo.ServiceCase_VIEW', N'V') IS NOT NULL DROP VIEW dbo.ServiceCase_VIEW;
            IF OBJECT_ID(N'dbo.ServiceCaseDetail_VIEW', N'V') IS NOT NULL DROP VIEW dbo.ServiceCaseDetail_VIEW;
            IF OBJECT_ID(N'dbo.ServiceCaseCost_VIEW', N'V') IS NOT NULL DROP VIEW dbo.ServiceCaseCost_VIEW;
            IF OBJECT_ID(N'dbo.ServiceSettlement_VIEW', N'V') IS NOT NULL DROP VIEW dbo.ServiceSettlement_VIEW;
            IF OBJECT_ID(N'dbo.ServiceCaseFinancial_VIEW', N'V') IS NOT NULL DROP VIEW dbo.ServiceCaseFinancial_VIEW;
            """,
            """
            CREATE VIEW dbo.Hesab_VIEW 
            AS    
            SELECT     HesabID, Code_Group, Code_Col, Code_Moein, Code_Tafzil, Name, Mahiat, Vaziat, HasTafzili, GroupTypeCode, dbo.GetMahiatName(Mahiat) AS MahiatName,
             dbo.GetActiveName(Vaziat) AS VaziatName,
                (SELECT     TOP 1 P.Name FROM  Hesab AS P  WHERE  P.Code_Group = Hesab.Code_Group AND IsNull(P.Code_Col, 0) = 0 AND IsNull(P.Code_Moein, 0) = 0) AS GroupName,
             IsStock, HasTafzili2 , IsCodeMarkaz, IsCodeVahed, IsCodeProjeh 
             FROM   dbo.Hesab;
            """,
            """
            CREATE VIEW dbo.Col_VIEW 
            AS  
            SELECT DISTINCT Code_Col, Name 
            FROM         dbo.Hesab  WHERE     (Code_Col > 0) AND (Code_Moein = 0);
            """,
            """
            CREATE VIEW dbo.Moein_VIEW 
            AS 
            SELECT DISTINCT Name, Code_Moein, Code_Col 
            FROM         dbo.Hesab WHERE     (Code_Col > 0) AND (Code_Moein > 0);
            """,
            """
            CREATE VIEW [dbo].[Tafzili_VIEW]
            AS
            SELECT     HesabID, Code_Tafzil, Name, JobName, EconomicCode, NationalCode, PostalCode, Address, MelliCode, StateID, CityID, CityID2, Mobile, Phone, Kind, 
             (CASE Kind WHEN 0 THEN 'عادی' WHEN 1 THEN 'حقیقی' WHEN 2 THEN 'حقوقی شرکت' WHEN 3 THEN 'حقوقی سازمان' WHEN 4 THEN 'بازاریاب' ELSE 'عادی' END) 
             AS DisKind 
            FROM         dbo.Hesab
            WHERE     (Code_Col = - 1);
            """,

           """
            CREATE VIEW [dbo].[Tafzili_Customer_VIEW]
            AS
            SELECT     dbo.Hesab.HesabID, dbo.Hesab.Code_Tafzil, dbo.Hesab.Name, City_1.Name AS CityName1, dbo.State.Name AS StateName,
                  City_2.Name AS CityName2, dbo.Hesab.Phone, dbo.Hesab.Mobile, dbo.Hesab.Address, dbo.Hesab.PostalCode, dbo.Hesab.EconomicCode,
                  dbo.Hesab.NationalCode,Kind 
            FROM   dbo.Hesab LEFT OUTER JOIN
                  dbo.State ON dbo.Hesab.StateID = dbo.State.ID LEFT OUTER JOIN
                  dbo.City City_1 ON dbo.Hesab.CityID = City_1.ID LEFT OUTER JOIN
                  dbo.City City_2 ON dbo.Hesab.CityID2 = City_2.ID
            WHERE     (dbo.Hesab.Code_Col = - 1) AND (dbo.Hesab.Code_Tafzil > 0);
            """,

            """
            CREATE VIEW dbo.Tafzili2_Report_VIEW 
            AS 
            SELECT  PS.NO_Sanad, PS.Date_IN, S.Code_Col, s.Code_Moein, S.Code_Tafzil, S.Mab_Bed, 
                  S.Mab_Bes, S.OtherSharh, S.Code_Tafzil1, S.SanadID, T2.Name AS Tafzili2Name, T2.Code AS Tafzili2Code, 
                  TV.Name AS Tafzili_Name, cv.Name AS Col_Name, mv.Name AS Moein_Name
            FROM  dbo.Moein_VIEW mv RIGHT OUTER JOIN
                dbo.Sanad S INNER JOIN
                dbo.ParentSanad PS ON S.ParentSanadCode = PS.ParentSanadID ON mv.Code_Col = S.Code_Col AND 
                mv.Code_Moein = S.Code_Moein LEFT OUTER JOIN
                dbo.Col_VIEW cv ON S.Code_Col = cv.Code_Col LEFT OUTER JOIN
                dbo.Tafzili_VIEW TV ON S.Code_Tafzil = TV.Code_Tafzil LEFT OUTER JOIN
                dbo.Tafzili2 T2 ON S.Tafzili2ID = T2.ID;
            """,
            """
            CREATE VIEW dbo.ParentSanad_VIEW 
            AS  
            SELECT  PS.NO_Sanad, PS.Date_IN, S.DoDate,S.DoOK, S.Mab_Bed, S.Mab_Bes,
                S.Meghdar, S.OtherSharh, S.Code_Col,S.Code_Moein, S.Code_Tafzil, PS.ParentSanadID,
                S.SanadID,PS.OtherParentSharh,S.ArticleID, S.ChequeBook_ChildID,S.ChequeBookDate,S.ChequeBook_Receiver,
                S.RowNum, S.Tafzili2ID, S.Code_Tafzili2,S.tikRow
            FROM dbo.Sanad AS S
            INNER JOIN dbo.ParentSanad AS PS ON S.ParentSanadCode = PS.ParentSanadID;
            """,
 

  
            """
            CREATE VIEW [dbo].[ArticleGroup_View]
            AS 
            SELECT  dbo.ArticleGroup.ID, dbo.ArticleGroup.StockTypeID, dbo.ArticleGroup.Code,
             dbo.ArticleGroup.Name,dbo.ArticleGroup.Degree, dbo.StockType.Name AS StockTypeName,
             dbo.StockType.Code AS StockTypeCode
             FROM   dbo.ArticleGroup LEFT OUTER JOIN dbo.StockType ON dbo.ArticleGroup.StockTypeID = dbo.StockType.ID;
            """,
            """
            CREATE VIEW dbo.ChequeBook_View 
            AS     
            SELECT   dbo.ChequeBook.ID, dbo.ChequeBook.Code, dbo.ChequeBook.AcountNo, dbo.ChequeBook.BranchName, dbo.ChequeBook.SheetNo, dbo.ChequeBook.Serial1,
               dbo.ChequeBook.BankID, dbo.Bank.Name AS BankName 
            FROM  dbo.ChequeBook LEFT OUTER JOIN dbo.Bank ON dbo.ChequeBook.BankID = dbo.Bank.ID;
            """,
           """
            CREATE VIEW [dbo].[ChequeBank_View]
            AS
            SELECT  CP.ID,CP.BankAccID, CP.CheckSeries, CP.CheckMab,CP.CheckDate,
            CP.CheckPerson, BA.Shobe, BA.NoHesab,B.Name,cp.Code_Tafzil,tcv.NationalCode 
            FROM  dbo.CheckPay  CP  
            LEFT  JOIN dbo.BankAcc BA ON CP.BankAccID = BA.ID 
            LEFT  JOIN dbo.Bank B ON BA.BankID = B.ID 
            LEFT JOIN Tafzili_Customer_VIEW TCV ON tcv.Code_Tafzil = cp.Code_Tafzil;
            """,

            """
            CREATE VIEW dbo.ConstHesabs_View 
            AS 
            SELECT dbo.ConstHesabs.Type, dbo.ConstHesabs.HesabID, dbo.Hesab.Code_Col, dbo.Hesab.Code_Moein 
            FROM    dbo.ConstHesabs INNER JOIN dbo.Hesab ON dbo.ConstHesabs.HesabID = dbo.Hesab.HesabID;
            """,

            """
            CREATE VIEW dbo.ChequeBook_Child_View 
            AS 
            SELECT  dbo.ChequeBook.Code, dbo.ChequeBook.AcountNo, dbo.ChequeBook.BranchName, dbo.ChequeBook.SheetNo, dbo.ChequeBook_Child.Serial,
             dbo.ChequeBook_Child.Cost, dbo.ChequeBook_Child.ReciverName, dbo.ChequeBook_Child.Des, dbo.ChequeBook_Child.ID, dbo.ChequeBook_Child.SanadID,
             dbo.Sanad.NO_Sanad, dbo.ChequeBook_Child.DateIN, dbo.ParentSanad.Date_IN AS SanadDate, dbo.Bank.Name AS BankName 
             FROM  dbo.Bank RIGHT OUTER JOIN dbo.ChequeBook INNER JOIN 
             dbo.ChequeBook_Child ON dbo.ChequeBook.ID = dbo.ChequeBook_Child.ChequeBookID ON dbo.Bank.ID = dbo.ChequeBook.BankID LEFT OUTER JOIN 
             dbo.ParentSanad 
                INNER JOIN dbo.Sanad ON dbo.ParentSanad.ParentSanadID = dbo.Sanad.ParentSanadCode
                ON dbo.ChequeBook_Child.SanadID = dbo.Sanad.SanadID;
            """,

            //--------------------
            //سطح بدون نیاز
            //-------------------
                      """
            CREATE VIEW dbo.FactorParent_View 
            AS   
            SELECT  TOP 100 PERCENT  FP.ID,FP.NoFactor,FP.Date_In,FP.Date_In AS DateIn,FP.CodeTafzil,TV.Name AS HesabName,FP.IsCaSh,
                CASE ISNULL(FP.IsCaSh, 0) WHEN 1 THEN 'نقدی' WHEN 2 THEN 'غیرنقدی'  ELSE '' END AS IsCashName,
                CASE WHEN ISNULL(FP.IsCaSh, 0) = 1 THEN 1 ELSE 0 END AS CashOK,
                CASE WHEN ISNULL(FP.IsCaSh, 0) = 2 THEN 1 ELSE 0 END AS CashUnOK,
                CASE
                      WHEN FP.FactorKind = 0 THEN N'خرید'
                      WHEN FP.FactorKind = 1 THEN N'فروش'
                      WHEN FP.FactorKind = 2 THEN N'برگشت از خرید'
                      WHEN FP.FactorKind = 3 THEN N'برگشت از فروش'
                      WHEN FP.FactorKind = 4 THEN N'پیش فاکتور'
                      ELSE N'نامشخص'
                END AS FactorKindTitle,
                FP.FactorKind,FP.Descript,FP.Cost,TV.EconomicCode,TV.NationalCode,TV.PostalCode,ST.Name AS StateName, 
                C1.Name AS CityName1,C2.Name AS CityName2,TV.Address,TV.Phone,TV.MelliCode, 
                FP.Parent_Sanad_ID,FP.NoSanad_ID_Marketer,PS.NO_Sanad,PS.Date_IN AS DateSanad,FP.Per_Ok, 
                FP.NoFactor_Per,FP.TransCost,FP.StockID AS StockParentFactor, C1.ID AS CityID,C2.ID AS CityID2, C1.Code AS CityCode, 
                C2.Code AS CityCode2, TV.DisKind,TV.Kind,TV.Mobile,TV.StateID,ST.Code AS StateCode,FP.CodeTaf_Marketer, 
                TM.Name AS MarkerName,PSM.NO_Sanad AS NoSanad_Marketer,PSM.Date_IN AS Date_IN_SanadMarketer,TM.Phone AS MarkerPhon, 
                TM.Mobile AS MarkerMobile,  FP.CarInfo 
            FROM dbo.FactorParent AS FP
            LEFT JOIN dbo.Tafzili_VIEW AS TV ON FP.CodeTafzil = TV.Code_Tafzil
            LEFT JOIN dbo.City AS C1 ON TV.CityID = C1.ID
            LEFT JOIN dbo.City AS C2 ON TV.CityID2 = C2.ID
            LEFT JOIN dbo.State AS ST ON TV.StateID = ST.ID
            LEFT JOIN dbo.ParentSanad AS PS ON FP.Parent_Sanad_ID = PS.ParentSanadID
            LEFT JOIN dbo.ParentSanad AS PSM ON FP.NoSanad_ID_Marketer = PSM.ParentSanadID
            LEFT JOIN dbo.Tafzili_VIEW AS TM ON FP.CodeTaf_Marketer = TM.Code_Tafzil
            ORDER BY FP.Date_In DESC;
            """,
            """
            CREATE VIEW dbo.ArticleNew_VIEW AS 
            SELECT A.ID,A.Code,A.Name,A.ArticleUnitID, U1.Name AS ArticleUnitName,
            A.ArticleUnitID2,U2.Name AS ArticleUnitName2,
            A.ArticleUnitID3,U3.Name AS ArticleUnitName3,
            U1.TabileUnit AS Tabdil1,U2.TabileUnit AS Tabdil2,U3.TabileUnit AS Tabdil3,
            A.ArticleGroupID,AG.Code AS ArticleGroupCode,AG.Name AS ArticleGroupName,
            ISNULL(ST.ID,1) AS StockTypeID,ST.Code AS StockTypeCode,ST.Name AS StockTypeName,
            ST.Kind,ST.For_EST,ST.xIs_RegMinOrderToIn,ST.xIs_RegMaxOrderToOut,ST.xIs_RegNegativKala,
            ST.xNotCalcPerDiscount,ST.xNotCalcArezeshafzode,ST.xIs_CalcUnit2,ST.xIs_CalcUnit3,
            A.Code_Col,A.Code_Moein,A.Code_Tafzil,A.Code_Col_Buy,A.Code_Moein_Buy,
            A.Code_Tafzil_Buy,A.Code_Col_ReBuy,A.Code_Moein_ReBuy, A.Code_Tafzil_ReBuy,
            A.Code_Col_ReSale,A.Code_Moein_ReSale,A.Code_Tafzil_ReSale,
            A.Depreciation,A.DepreciationType, dbo.Get_Depreciation_Type(A.DepreciationType) AS DepreciationTypeName,
            A.AmountFirst, A.CostFirst,A.AmountSale,
            A.Status,
            CASE A.Status WHEN 0 THEN N'انباری' WHEN 1 THEN N'اموالی' ELSE N'نامشخص' END AS StatusName,
            A.MaxCostOrderBy,A.MinCostOrderBy,A.MarketerPercent,
            A.ArticleCoding,A.CodingStore,A.CodingGroupStore,
            A.tax_id,A.inAmount1,A.OutAmount1,A.BackAmount1,A.FinalAmount1,
            A.inVal1,A.OutVal1,A.BackVal1,A.FinalVal1 
            FROM dbo.ArticleNew A 
            LEFT JOIN dbo.ArticleGroup AG ON AG.ID = A.ArticleGroupID 
            LEFT JOIN dbo.ArticleStock AST ON AST.ArticleID = A.ID 
            LEFT JOIN dbo.StockType ST ON ST.ID = AST.StockTypeID 
            LEFT JOIN dbo.ArticleUnit U1 ON U1.ID = A.ArticleUnitID 
            LEFT JOIN dbo.ArticleUnit U2 ON U2.ID = A.ArticleUnitID2 
            LEFT JOIN dbo.ArticleUnit U3 ON U3.ID = A.ArticleUnitID3;
            """,
            """
            CREATE VIEW dbo.Tafzili1_Report_VIEW 
            AS  
            SELECT dbo.ParentSanad.NO_Sanad, dbo.ParentSanad.Date_IN, dbo.Sanad.Code_Col, dbo.Sanad.Code_Moein, dbo.Sanad.Code_Tafzil, dbo.Sanad.Mab_Bed, 
            dbo.Sanad.Mab_Bes, dbo.Sanad.OtherSharh, dbo.Sanad.Code_Tafzil1, dbo.Sanad.FactorID, dbo.Sanad.SanadID, dbo.Sanad.FactorNo,
            TBCol.Name AS NameCol, TBMoein.Name AS NameMoein, tbTaf1.Name AS Name, tbTaf1.Discript, tbTaf1.Address, tbTaf1.Mobile, tbTaf1.Phone,
            tbTaf1.EconomicCode, tbTaf1.PostalCode, tbTaf1.TafziliGroupCode, tbTaf1.NationalCode, tbTaf1.MelliCode
            FROM dbo.Sanad LEFT OUTER JOIN
            dbo.ParentSanad ON dbo.Sanad.ParentSanadCode = dbo.ParentSanad.ParentSanadID LEFT OUTER JOIN
            dbo.Hesab AS TBCol ON dbo.Sanad.Code_Col = TBCol.Code_Col LEFT OUTER JOIN
            dbo.Hesab AS TBMoein ON dbo.Sanad.Code_Col = TBMoein.Code_Col AND dbo.Sanad.Code_Moein = TBMoein.Code_Moein LEFT OUTER JOIN
            dbo.Hesab AS tbTaf1 ON tbTaf1.Code_Col = - 1 AND dbo.Sanad.Code_Tafzil = tbTaf1.Code_Tafzil;
            """,
            """
            CREATE View VW_SelectHesab 
            as
            Select Substring(isNull(col.Name,''),1,30)+'-'+Substring(isNull(Moein.Name,''),1,30)+'-'+Substring(isNull(Taf.Name,''),1,30) as NameCoding 
            ,isNull(col.Name,'') as NameCol,isNull(Moein.Name,'') as NameMoein,isNull(Taf.Name,'')as NameTafzil1,isNull(Taf2.Name,'') as NameTafzil2
            ,S.Code_Col,S.Code_Moein,S.Code_Tafzil,S.Code_Tafzili2
            ,(Cast(S.Code_Col as varchar)+'-'+Cast(S.Code_Moein as varchar)+'-'+Cast(S.Code_Tafzil as varchar)
            +'-'+Cast(S.Code_Tafzili2 as varchar)) as HesabCode,Moein.Mahiat as Mahiat
            from Sanad S
            Left Join Hesab Col On S.Code_Col = Col.Code_Col and Col.Code_Moein = 0
            Left Join Hesab Moein On S.Code_Col = Moein.Code_Col And S.Code_Moein = Moein.Code_Moein
            Left Join Hesab Taf On S.Code_Tafzil = Taf.Code_Tafzil and Taf.Code_Col = -1
            Left Join Tafzili2 Taf2 On  S.Code_Tafzili2 = Taf2.Code
            Group by  S.Code_Col,S.Code_Moein,S.Code_Tafzil,S.Code_Tafzili2,Col.Name,Moein.Name,Taf.Name,Taf2.Name,Moein.Mahiat;
            """,
            """
            CREATE VIEW dbo.FactorDetail_VIEW 
            AS  
            SELECT     FD.ID, FD.FactorID, FD.ArticleID, AN.Name AS ArticleName,
                  AG.Name AS ArticleGroupName, U1.Name AS ArticleUnitName, AN.Code AS ArticleCode,AN.Tax_ID,
                  Calc.CostItem,
                  Calc.CostItem - ISNULL(FD.Discount, 0) AS CostTax,
                  Calc.CostItem - ISNULL(FD.Discount, 0) + ISNULL(FD.Tax, 0) AS FinallCost,
                  isnull(FD.IncCost,0) as IncCost,ISNULL(FD.TransCost, 0)as TransCost,
                  FD.ArticleCount, FD.ArticleCount2, FD.ArticleCount3, (isnull(FD.Cost,0)) as Cost, FD.Discount,
                  FD.PerDiscount, FD.Tax, FPV.NoFactor, FPV.DateIn, FPV.Descript,
                  FPV.FactorKind, FPV.CodeTafzil, FPV.ID AS FactorParentID, AG.StockTypeID,
                  ST.Name AS StockName, AN.AmountSale, FPV.Per_Ok, FPV.NoFactor_Per,
                  FD.StockID, FPV.StockParentFactor, FPV.EconomicCode, FPV.NationalCode,
                  FPV.PostalCode, FPV.StateName, FPV.CityName1, FPV.CityName2,
                  FPV.Address, FPV.CashOK, FPV.CashUnOK, FPV.MelliCode,
                  FPV.Phone, FPV.DateSanad, FPV.CityID, FPV.CityID2,
                  FPV.CityCode, FPV.CityCode2, FPV.DisKind, FPV.Kind,
                  FPV.HesabName, FPV.Mobile, FPV.StateID, FPV.StateCode,
                  U2.Name AS ArticleUnitName2, U1.TabileUnit AS Tabdil1, U2.TabileUnit AS Tabdil2, AN.ArticleUnitID2,
                  U3.Name AS ArticleUnitName3, U3.TabileUnit AS Tabdil3, AN.ArticleUnitID3,
                  AN.MarketerPercent AS ArticleMarkerPer, FD.MarketerPercent,FD.MarketerCosts, FPV.MarkerName,
                  FPV.CodeTaf_Marketer,FPV.TransCost as FPTransCost,
                  FD.DegreeKala,FD.DropKala,FD.TaxFi,FPV.CarInfo 
            FROM dbo.FactorDetail FD
            LEFT JOIN dbo.FactorParent_View FPV ON FD.FactorID = FPV.ID
            LEFT JOIN dbo.ArticleNew AN ON FD.ArticleID = AN.ID
            LEFT JOIN dbo.ArticleGroup AG ON AN.ArticleGroupID = AG.ID
            LEFT JOIN dbo.StockType ST ON AG.StockTypeID = ST.ID
            LEFT JOIN dbo.ArticleUnit AS U1 ON AN.ArticleUnitID = U1.ID
            LEFT JOIN dbo.ArticleUnit AS U2 ON AN.ArticleUnitID2 = U2.ID
            LEFT JOIN dbo.ArticleUnit AS U3 ON AN.ArticleUnitID3 = U3.ID
            CROSS APPLY (
               SELECT CAST(ISNULL(FD.ArticleCount, 0) * ISNULL(FD.Cost, 0) AS NUMERIC(18, 0)) AS CostItem
            ) AS Calc;
            """,

           """
            CREATE VIEW [dbo].[InventoryTagView] AS 
            SELECT TH.ID AS TagHeaderID,TH.TagNo,TH.StageNo,ISg.StageName AS StageName,
            ST.Name AS StockName,ST.Code AS StockCode,ST.ID As StockTypeID,
            TH.TagDate,TH.TagStatus,
            CASE TH.TagStatus WHEN 0 THEN N'چاپ شده' WHEN 1 THEN N'در حال شمارش' WHEN 2 THEN N'تکمیل شده' WHEN 3 THEN N'تأیید نهایی' ELSE N'نامشخص' END AS StatusName,
            TH.LocationCode,TH.CreateUserID,U1.Name AS CreateUserName,
            TH.CreateDate,TH.ConfirmUserID,U2.Name AS ConfirmUserName,TH.ConfirmDate,
            ISNULL((SELECT COUNT(*) FROM InventoryTagDetail WHERE TagID = TH.ID), 0) AS TotalItems,
            ISNULL((SELECT COUNT(*) FROM InventoryTagDetail WHERE TagID = TH.ID AND CountedQty IS NOT NULL), 0) AS CountedItems,
            ISNULL((SELECT COUNT(*) FROM InventoryTagDetail WHERE TagID = TH.ID AND CountedQty IS NOT NULL AND DiffQty <> 0), 0) AS DiffItems,
            ISNULL((SELECT SUM(Abs(DiffQty)) FROM InventoryTagDetail WHERE TagID = TH.ID AND DiffQty IS NOT NULL), 0) AS TotalDifference,
            CASE WHEN ISNULL((SELECT COUNT(*) FROM InventoryTagDetail WHERE TagID = TH.ID), 0) = 0 THEN 0 
                ELSE (ISNULL((SELECT COUNT(*) FROM InventoryTagDetail 
                                WHERE TagID = TH.ID AND CountedQty IS NOT NULL), 0) * 100) / 
                                ISNULL((SELECT COUNT(*) FROM InventoryTagDetail WHERE TagID = TH.ID), 1) END AS ProgressPercent,
            ISNULL((SELECT STUFF((SELECT ', ' + CAST(SF.SpecialCode AS VARCHAR(20)) FROM Stock_Factor SF WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1 
            ORDER BY SF.SpecialCode FOR XML PATH('')), 1, 2, '')), '') AS SanadNos,
            CAST(ISNULL((SELECT STUFF((SELECT ', ' + CASE SF.Kind WHEN 0 THEN 'رسید' WHEN 1 THEN 
             CASE SF.AdjustmentType WHEN 1 THEN 'حواله(کمبود)' WHEN 3 THEN 'حواله(ضایعات)' END END + ':' + CAST(SF.SpecialCode AS VARCHAR(20)) 
            FROM Stock_Factor SF WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1 ORDER BY SF.SpecialCode FOR XML PATH('')), 1, 2, '')), '') AS NVARCHAR(500)) AS SanadFullInfo,
            ISNULL((SELECT COUNT(*) FROM Stock_Factor SF WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1), 0) AS SanadCount,
            ISNULL((SELECT COUNT(*) FROM Stock_Factor SF WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1 AND SF.Kind = 0), 0) AS ResidCount,
            ISNULL((SELECT COUNT(*) FROM Stock_Factor SF WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1 AND SF.Kind = 1 AND SF.AdjustmentType = 1), 0) AS HavalehCount,
            ISNULL((SELECT COUNT(*) FROM Stock_Factor SF WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1 AND SF.Kind = 1 AND SF.AdjustmentType = 3), 0) AS ScrapCount,
            ISNULL((SELECT STUFF((SELECT ', ' + CAST(SF.ID AS VARCHAR(20)) FROM Stock_Factor SF 
             WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1 AND SF.Kind = 0 ORDER BY SF.ID FOR XML PATH('')), 1, 2, '')), '') AS ResidSanadNos,
            ISNULL((SELECT STUFF((SELECT ', ' + CAST(SF.ID AS VARCHAR(20)) FROM Stock_Factor SF 
             WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1 AND SF.Kind = 1 AND SF.AdjustmentType = 1 ORDER BY SF.ID FOR XML PATH('')), 1, 2, '')), '') AS HavalehSanadNos,
            ISNULL((SELECT STUFF((SELECT ', ' + CAST(SF.ID AS VARCHAR(20)) FROM Stock_Factor SF 
             WHERE SF.InventoryTagID = TH.ID AND SF.IsInventoryAdjustment = 1 AND SF.Kind = 1 AND SF.AdjustmentType = 3 ORDER BY SF.ID FOR XML PATH('')), 1, 2, '')), '') AS ScrapSanadNos,
            CASE WHEN ISNULL((SELECT COUNT(*) FROM Stock_Factor WHERE InventoryTagID = TH.ID AND IsInventoryAdjustment = 1), 0) = 0 THEN N'بدون سند' ELSE N'دارای سند' END AS SanadStatus 
            FROM InventoryTagHeader TH 
            INNER JOIN StockType ST ON ST.ID = TH.StockTypeID 
            LEFT JOIN Users U1 ON U1.UsersID = TH.CreateUserID 
            LEFT JOIN Users U2 ON U2.UsersID = TH.ConfirmUserID 
            LEFT JOIN InventoryStage ISg ON ISg.StockTypeID = TH.StockTypeID AND ISg.StageNo = TH.StageNo AND ISg.IsActive = 1;
            """,

            """
            CREATE VIEW [dbo].[InventoryTagDetailView] AS 
            SELECT TD.ID AS DetailID, TD.TagID,TH.TagNo, TH.StageNo,TH.StockTypeID, ST.Name AS StockName, TD.ArticleID,
            AN.Code AS ArticleCode, AN.Name AS ArticleName, AN.ArticleCoding, AU.Name AS UnitName, TD.SystemQty,
            TD.CountedQty, TD.DiffQty,
            CASE WHEN TD.DiffQty > 0 THEN N'کمبود' WHEN TD.DiffQty < 0 THEN N'اضافه' ELSE N'مشابه' END AS DiffType,
            ISNULL(ABS(TD.DiffQty), 0) AS AbsDiffQty,
            TD.ScrapQty,TD.Notes,TD.CounterUserID, U.Name AS CounterUserName,TD.CountDate,TD.CountTime,TH.TagStatus, TH.ConfirmDate 
            FROM InventoryTagDetail TD 
            INNER JOIN InventoryTagHeader TH ON TH.ID = TD.TagID 
            INNER JOIN StockType ST ON ST.ID = TH.StockTypeID 
            INNER JOIN ArticleNew AN ON AN.ID = TD.ArticleID 
            INNER JOIN ArticleUnit AU ON AU.ID = AN.ArticleUnitID 
            LEFT JOIN Users U ON U.UsersID = TD.CounterUserID;
            """,

            """
            CREATE VIEW [dbo].[InventoryDiffReportView] AS 
            SELECT TH.ID AS TagHeaderID,TH.TagNo,TH.StageNo,TH.StockTypeID,ST.Name AS StockName,TH.TagDate,TH.ConfirmDate,TD.ArticleID,
            AN.Code AS ArticleCode, AN.Name AS ArticleName,AN.ArticleCoding,AU.Name AS UnitName,TD.SystemQty,TD.CountedQty,TD.DiffQty,
            TD.ScrapQty,ABS(ISNULL(TD.DiffQty, 0)) AS AbsDiffQty, TD.Notes,U1.Name AS CounterUserName,U2.Name AS ConfirmUserName, TH.TagStatus,
            CASE TH.TagStatus WHEN 0 THEN N'چاپ شده' WHEN 1 THEN N'در حال شمارش' WHEN 2 THEN N'تکمیل شده' WHEN 3 THEN N'تأیید نهایی' ELSE N'نامشخص' END AS StatusTagName,
            CASE WHEN SystemQty < 0 THEN 'موجودی منفی' WHEN DiffQty > 0 THEN 'اضافه' WHEN DiffQty < 0 THEN 'کمبود' ELSE 'مشابه' END AS QtyStatus 
            FROM InventoryTagHeader TH 
            INNER JOIN StockType ST ON ST.ID = TH.StockTypeID 
            INNER JOIN InventoryTagDetail TD ON TD.TagID = TH.ID 
            INNER JOIN ArticleNew AN ON AN.ID = TD.ArticleID 
            INNER JOIN ArticleUnit AU ON AU.ID = AN.ArticleUnitID 
            LEFT JOIN Users U1 ON U1.UsersID = TD.CounterUserID 
            LEFT JOIN Users U2 ON U2.UsersID = TH.ConfirmUserID 
            WHERE TH.TagStatus >= 2 AND ISNULL(TD.DiffQty, 0) <> 0;
            """,

            """
            CREATE VIEW [dbo].[InventoryHistoryView] AS 
            SELECT TH.ID AS TagHeaderID,TH.TagNo,TH.StageNo,ST.Name AS StockName,TH.TagDate AS CreateDate,
            'ایجاد تگ' AS OperationType, TH.CreateUserID AS UserID, U.Name AS UserName,TH.CreateDate AS OperationDate,
            NULL AS OperationTime, CAST(TH.TagNo AS nvarchar(50)) + ' - ایجاد تگ برای انبار ' + ST.Name AS Description 
            FROM InventoryTagHeader TH 
            INNER JOIN StockType ST ON ST.ID = TH.StockTypeID 
            LEFT JOIN Users U ON U.UsersID = TH.CreateUserID 
            UNION ALL 
            SELECT TD.TagID AS TagHeaderID,TH.TagNo,TH.StageNo,ST.Name AS StockName,TH.TagDate AS CreateDate, 'شمارش کالا' AS OperationType,
            TD.CounterUserID AS UserID,U.Name AS UserName,TD.CountDate AS OperationDate, TD.CountTime AS OperationTime,
            'شمارش کالای ' + AN.Name + ' - مقدار: ' + CAST(ISNULL(TD.CountedQty, 0) AS nvarchar(20)) AS Description 
            FROM InventoryTagDetail TD 
            INNER JOIN InventoryTagHeader TH ON TH.ID = TD.TagID 
            INNER JOIN StockType ST ON ST.ID = TH.StockTypeID 
            INNER JOIN ArticleNew AN ON AN.ID = TD.ArticleID 
            LEFT JOIN Users U ON U.UsersID = TD.CounterUserID 
            WHERE TD.CountedQty IS NOT NULL 
            UNION ALL 
            SELECT TH.ID AS TagHeaderID,TH.TagNo,TH.StageNo,ST.Name AS StockName,TH.TagDate AS CreateDate,'تأیید تگ' AS OperationType,TH.ConfirmUserID AS UserID,
            U.Name AS UserName,TH.ConfirmDate AS OperationDate,NULL AS OperationTime, 'تأیید نهایی تگ ' + TH.TagNo AS Description 
            FROM InventoryTagHeader TH 
            INNER JOIN StockType ST ON ST.ID = TH.StockTypeID 
            LEFT JOIN Users U ON U.UsersID = TH.ConfirmUserID 
            WHERE TH.TagStatus >= 2;
            """,

            """
            CREATE VIEW [dbo].[InventoryStageSummaryView] AS
            SELECT  TH.StockTypeID,ST.Name AS StockName,TH.StageNo,TH.TagDate AS StageStartDate, MAX(TH.ConfirmDate) AS StageEndDate,
            COUNT(DISTINCT TH.ID) AS TotalTags,
            SUM(CASE WHEN TH.TagStatus = 0 THEN 1 ELSE 0 END) AS PrintedTags,
            SUM(CASE WHEN TH.TagStatus = 1 THEN 1 ELSE 0 END) AS CountingTags,
            SUM(CASE WHEN TH.TagStatus = 2 THEN 1 ELSE 0 END) AS CompletedTags,
            SUM(CASE WHEN TH.TagStatus = 3 THEN 1 ELSE 0 END) AS ConfirmedTags,
            ISNULL(SUM(TD.SystemQty), 0) AS TotalSystemQty,
            ISNULL(SUM(TD.CountedQty), 0) AS TotalCountedQty,
            ISNULL(SUM(TD.DiffQty), 0) AS TotalDiffQty,
            ISNULL(SUM(ABS(TD.DiffQty)), 0) AS TotalAbsDiffQty,
            -- درصد اختلاف
            CASE 
                WHEN ISNULL(SUM(TD.SystemQty), 0) = 0 THEN 0
                ELSE (ABS(ISNULL(SUM(TD.DiffQty), 0)) * 100) / ISNULL(SUM(TD.SystemQty), 1)
            END AS DiffPercent
            FROM InventoryTagHeader TH
             INNER JOIN StockType ST ON ST.ID = TH.StockTypeID
             LEFT JOIN InventoryTagDetail TD ON TD.TagID = TH.ID
             GROUP BY TH.StockTypeID, ST.Name, TH.StageNo, TH.TagDate;
            """,
            """
            CREATE VIEW [Article_View] AS 
            SELECT AN.Name AS ArticleName,AN.Code, AN.ArticleCoding,
            AN.StockTypeName, AN.ArticleGroupID, AN.ArticleGroupName,
            AN.ArticleUnitID,AN.ArticleUnitName,
            A.ID,A.Date_Op,A.Time_Op,A.Code_Op,A.KindArticles,
            (CASE A.KindArticles WHEN 0 THEN 'مرحله اول' WHEN 1 THEN 'میان دوره' WHEN 2 THEN 'پایان دوره' ELSE 'نامشخص' END) AS KindName,
            A.ArticleID,A.HasEndedDate,A.FirstExistence,A.Inputed,A.OutPuted, A.Loss1, A.Loss2 ,FinallExistence,
            A.Number,Parent_Sanad_ID,A.CommandStock,A.Tag 
            FROM dbo.Articles A LEFT JOIN dbo.ArticleNew_VIEW AN ON A.ArticleID = AN.ID;
            """,

            """
            CREATE VIEW [dbo].[Asset_VIEW]
            AS
            SELECT     dbo.Asset.ArticleID, dbo.Asset.DateIN, dbo.Asset.Cost, dbo.Asset.SanadID, dbo.Asset.Depreciation_Before, dbo.Asset.Depreciation, 
             dbo.Asset.Cost_Before, dbo.ArticleNew_VIEW.Name, dbo.ArticleNew_VIEW.ArticleGroupName, dbo.ArticleNew_VIEW.Depreciation AS Nerkh,
             dbo.ArticleNew_VIEW.DepreciationType, dbo.Asset.No_Sanad, dbo.Asset.ID, dbo.Asset.Code, dbo.ArticleNew_VIEW.StockTypeName,
             dbo.ArticleNew_VIEW.StockTypeCode, dbo.ArticleNew_VIEW.Code AS ArticleCode, dbo.ArticleNew_VIEW.ArticleGroupCode, dbo.ArticleNew_VIEW.Kind,
             dbo.Asset.GhesmatCode, dbo.Asset.DateTrasfer, dbo.Asset.CodeTrasfer, dbo.Ghesmat.Sharh_G,
             dbo.Phone.FirstName + ' ' + dbo.Phone.LastName AS NameTrasfer, dbo.ArticleNew_VIEW.ArticleUnitName, dbo.ArticleNew_VIEW.ArticleGroupID,
             dbo.ArticleNew_VIEW.StockTypeID, dbo.ArticleNew_VIEW.DepreciationTypeName, dbo.ArticleNew_VIEW.For_EST, dbo.ArticleNew_VIEW.Status
             FROM  dbo.Asset LEFT OUTER JOIN
            dbo.Ghesmat ON dbo.Asset.GhesmatCode = dbo.Ghesmat.Code_G LEFT OUTER JOIN
                  dbo.Phone ON dbo.Asset.CodeTrasfer = dbo.Phone.Code LEFT OUTER JOIN
                  dbo.ArticleNew_VIEW ON dbo.Asset.ArticleID = dbo.ArticleNew_VIEW.ID;
            """,

            """
            CREATE VIEW [dbo].[ArticleLenCode_View]
            AS
            SELECT    ID, Code,ArticleGroupID ,ArticleGroupCode,StockTypeCode
            ,(Case len(StockTypeCode) when 1 then '00'+ cast(StockTypeCode AS varchar(3)) 
            when 2 then '0'+ cast(StockTypeCode AS varchar(3)) else cast(StockTypeCode AS varchar(3)) end) as CodeStore
            ,(Case len(ArticleGroupCode) when 1 then '00'+ cast(ArticleGroupCode AS varchar(3)) 
            when 2 then '0'+ cast(ArticleGroupCode AS varchar(3)) else cast(ArticleGroupCode AS varchar(3)) end)AS GroupCode
            FROM   dbo.ArticleNew_VIEW;
            """,

            """
            CREATE VIEW [dbo].[Asset_Export_View] 
            AS
            SELECT  dbo.Asset_Export.ID, dbo.Asset_Export.CodeReg, dbo.Asset_Export.DateReg, dbo.Asset_Export.CodeExport, dbo.Asset_Export.DateExport,
                  dbo.Asset_Export.GhesmatCode, dbo.Asset_Export.ArticleID, dbo.Ghesmat.Code_G, dbo.Ghesmat.Sharh_G,
                  dbo.Phone.FirstName + ' ' + dbo.Phone.LastName AS NameExport, dbo.Asset_Export.Code, dbo.ArticleNew_VIEW.Name,
                  dbo.ArticleNew_VIEW.ArticleGroupName, dbo.ArticleNew_VIEW.ArticleUnitID, dbo.ArticleNew_VIEW.ArticleUnitName,
                  dbo.ArticleNew_VIEW.ArticleGroupID, dbo.ArticleNew_VIEW.StockTypeCode, dbo.ArticleNew_VIEW.StockTypeName, dbo.ArticleNew_VIEW.StockTypeID,
                  dbo.ArticleNew_VIEW.Kind, dbo.ArticleNew_VIEW.For_EST, dbo.ArticleNew_VIEW.Status, dbo.Asset_VIEW.NameTrasfer
                  FROM   dbo.Asset_Export LEFT OUTER JOIN
                  dbo.Phone ON dbo.Asset_Export.CodeExport = dbo.Phone.Code LEFT OUTER JOIN
                  dbo.ArticleNew_VIEW ON dbo.Asset_Export.ArticleID = dbo.ArticleNew_VIEW.ID LEFT OUTER JOIN
                  dbo.Ghesmat ON dbo.Asset_Export.GhesmatCode = dbo.Ghesmat.Code_G LEFT OUTER JOIN
                  dbo.Asset_VIEW ON dbo.Asset_VIEW.ArticleCode = dbo.Asset_Export.Code;
            """,
            """
            CREATE VIEW [dbo].[vw_TalfighSanad]
            AS
            SELECT   ParentSanadID,No_Sanad,RowNum,
            Date_IN,isnull(Mab_Bed,0) Mab_Bed,isnull(Mab_Bes,0) Mab_Bes, OtherSharh, Code_Col, Code_Moein, Code_Tafzil, OtherParentSharh, ArticleID,
            ChequeBook_ChildID, ChequeBookDate, ChequeBook_Receiver, Tafzili2ID, Code_Tafzili2,Meghdar
             FROM   dbo.ParentSanad_VIEW;
            """,
            """
            CREATE VIEW [dbo].[Stock_Factor_Mat_VIEW] 
            AS 
            SELECT     dbo.Stock_Factor_Mat.ID, dbo.Stock_Factor_Mat.ArticleID, dbo.Stock_Factor_Mat.Val, dbo.ArticleNew.Code AS ArticleCode, 
                  dbo.ArticleNew.Name AS ArticleName, dbo.ArticleGroup_View.StockTypeName, dbo.ArticleGroup_View.StockTypeCode,
                  dbo.ArticleGroup_View.Code AS ArticleGroupCode, dbo.ArticleGroup_View.Name AS ArticleGroupName, dbo.Stock_Factor_Mat.StockFacorID,
                  UnitName1.Name AS ArticleUnit, dbo.ArticleNew.ArticleGroupID, dbo.ArticleGroup_View.StockTypeID, dbo.Stock_Factor_Mat.Cost,
                  dbo.Stock_Factor_Mat.Val * dbo.Stock_Factor_Mat.Cost AS Amount, dbo.ArticleNew.Code_Col, dbo.ArticleNew.Code_Moein, dbo.ArticleNew.Code_Tafzil,
                  dbo.ArticleNew.Code_Col_Buy, dbo.ArticleNew.Code_Moein_Buy, dbo.ArticleNew.Code_Tafzil_Buy, dbo.ArticleNew.Code_Col_ReBuy,
                  dbo.ArticleNew.Code_Moein_ReBuy, dbo.ArticleNew.Code_Tafzil_ReBuy, dbo.ArticleNew.Code_Col_ReSale, dbo.ArticleNew.Code_Moein_ReSale,
                  dbo.ArticleNew.Code_Tafzil_ReSale, dbo.ArticleNew.Status, dbo.ArticleNew.AmountFirst, dbo.ArticleNew.CostFirst, dbo.ArticleNew.MaxCostOrderBy,
                  dbo.ArticleNew.MinCostOrderBy, dbo.ArticleNew.AmountSale, UnitName1.TabileUnit AS Tabdil1, UnitName2.Name AS ArticleUnit2,
                  UnitName2.TabileUnit AS Tabdil2, dbo.ArticleNew.ArticleUnitID2,
                  UnitName3.TabileUnit AS Tabdil3, dbo.ArticleNew.ArticleUnitID3,UnitName3.Name AS ArticleUnit3
            FROM   dbo.ArticleUnit AS UnitName1 RIGHT OUTER JOIN
                  dbo.ArticleNew ON UnitName1.ID = dbo.ArticleNew.ArticleUnitID LEFT OUTER JOIN
                  dbo.ArticleUnit AS UnitName2 ON UnitName2.ID = dbo.ArticleNew.ArticleUnitID2 LEFT OUTER JOIN
                  dbo.ArticleUnit AS UnitName3 ON UnitName3.ID = dbo.ArticleNew.ArticleUnitID3 LEFT OUTER JOIN
                  dbo.ArticleGroup_View ON dbo.ArticleNew.ArticleGroupID = dbo.ArticleGroup_View.ID RIGHT OUTER JOIN
                  dbo.Stock_Factor_Mat ON dbo.ArticleNew.ID = dbo.Stock_Factor_Mat.ArticleID;
            """,

            """
            CREATE VIEW [dbo].[Stock_Factor_VIEW]
            AS
            SELECT  SF.ID,SF.Code, SF.Des, SF.Kind, SF.DateIN, SF.StockTypeID, 
                 ST.Code AS StockTypeCode, ST.Name AS StockTypeName, ST.Kind AS StockTypeKind, SF.FactorID,
                 SF.FactorCode AS NoFactor, SF.TolidID, SF.TolidCode, SF.SpecialCode,
                 SF.Parent_Sanad_ID, ST.Code_Tafzil2, ST.Code_Tafzil, ST.Code_Moein, ST.Code_Col,
                 SF.PerFactor_ID, PS.NO_Sanad,fp.CodeTafzil as CodeCustumer 
            FROM  dbo.Stock_Factor SF
             LEFT JOIN dbo.StockType ST ON SF.StockTypeID = ST.ID 
             LEFT JOIN dbo.ParentSanad PS ON PS.ParentSanadID = SF.Parent_Sanad_ID 
             left join dbo.FactorParent FP ON fp.ID =  SF.FactorID;
            """,

            """
            CREATE VIEW [dbo].[Stock_Factor_All_VIEW]
            AS
            SELECT     dbo.Stock_Factor.ID, dbo.Stock_Factor.Code, dbo.Stock_Factor.Des, dbo.Stock_Factor.Kind, dbo.Stock_Factor.DateIN, dbo.Stock_Factor.StockTypeID,
            dbo.ArticleNew.Code AS ArticleCode, dbo.ArticleNew.Name AS ArticleName, dbo.ArticleNew.ArticleUnitID, dbo.Stock_Factor_Mat.ArticleID,
            dbo.Stock_Factor_Mat.Val, dbo.Stock_Factor.SpecialCode, dbo.Stock_Factor_Mat.Cost,AmountSale, dbo.ArticleNew.Status,dbo.Stock_Factor.PerFactor_ID
            ,(dbo.Stock_Factor_Mat.Val * dbo.Stock_Factor_Mat.Cost) as Amount, dbo.Stock_Factor.Parent_Sanad_ID
            ,dbo.Stock_Factor.FactorID, dbo.Stock_Factor.FactorCode 
            FROM   dbo.Stock_Factor INNER JOIN
             dbo.Stock_Factor_Mat ON dbo.Stock_Factor.ID = dbo.Stock_Factor_Mat.StockFacorID LEFT OUTER JOIN
             dbo.ArticleNew ON dbo.Stock_Factor_Mat.ArticleID = dbo.ArticleNew.ID;
            """,
 

            """
            CREATE VIEW [dbo].[vw_CheckExpend2]
            AS 
            SELECT     dbo.CheckExpend.ID, dbo.CheckExpend.CheuqeReceiveID, dbo.CheckExpend.Code_OP, dbo.CheckExpend.Time_Op, dbo.CheckExpend.Date_OP,
                  dbo.CheckExpend.ResidNumber, dbo.CheckExpend.SanadID, dbo.CheckExpend.Code_Col, dbo.CheckExpend.Code_Moein,
                  dbo.CheckExpend.Code_Tafzil, dbo.CheckExpend.ParentSanadID, dbo.CheckExpend.ResidDes, dbo.CheckExpend.Code_Col_Pay,
                  dbo.CheckExpend.Code_Moein_Pay, dbo.CheckExpend.Code_Tafzil_Pay, dbo.CheckExpend.ResidDate, dbo.CheckExpend.SanadPersonID,
                  dbo.CheckRecive.BankID, dbo.CheckRecive.CheckDate, dbo.CheckRecive.CheckSeries, dbo.CheckRecive.BankBrunch, dbo.CheckRecive.CheckMab,
                  dbo.CheckRecive.NoHesabCheck, dbo.CheckRecive.CheckPerson, dbo.CheckRecive.CheckState, dbo.CheckRecive.IsNaghd,
                  dbo.CheckRecive.ChequeOK, dbo.CheckRecive.OkDate, dbo.CheckRecive.WasExpended, dbo.CheckRecive.Code_Col_Pay_OK,
                  dbo.CheckRecive.Code_Moein_Pay_OK, dbo.CheckRecive.Code_Tafzil_Pay_OK, dbo.CheckRecive.Code_Col_OK, dbo.CheckRecive.Code_Moein_OK,
                  dbo.CheckRecive.Code_Tafzil_OK, dbo.CheckRecive.ParentSanadOKID, dbo.CheckRecive.UnOkDate, dbo.CheckRecive.UnOkSanadIDBed,
                  dbo.CheckRecive.UnOkSanadIDBes, dbo.CheckRecive.UnOkParentSanadID, dbo.Bank.Name as BankName
            FROM   dbo.CheckExpend
                LEFT OUTER JOIN dbo.CheckRecive ON dbo.CheckExpend.CheuqeReceiveID = dbo.CheckRecive.ID 
                LEFT OUTER JOIN dbo.Bank ON dbo.CheckRecive.BankID = dbo.Bank.ID;
            """,
            """
            CREATE VIEW dbo.Vw_ExcelSanad
            AS
            SELECT     dbo.ParentSanad_View.NO_Sanad AS 'شماره سند' 
                  ,dbo.ParentSanad_View.Date_IN AS 'تاریخ سند حسابداری' 
                  ,dbo.ParentSanad_View.OtherParentSharh AS 'شرح هدر سند' 
                  ,dbo.ParentSanad_View.OtherSharh AS 'شرح سند' 
                  ,dbo.ParentSanad_View.Code_Col AS 'کد کل' 
                  ,dbo.ParentSanad_View.Code_Moein AS 'کد معین' 
                  , dbo.ParentSanad_View.Code_Tafzil AS 'کد تفصیل' 
                  , dbo.ParentSanad_View.Code_Tafzili2 AS 'کد تفصیل2' 
                  , ViewCol.Name AS 'شرح حساب کل' 
                  ,ViewMoein.Name AS 'شرح حساب معین' 
                  ,isnull((SELECT [Name] FROM  dbo.Hesab_VIEW AS VWTafsili
                        WHERE     VWTafsili.code_col = - 1
                        AND VWTafsili.Code_Tafzil = ParentSanad_View.Code_Tafzil),'') AS 'شرح حساب تفصیل' 
                  ,isnull((SELECT isnull([Name],'') FROM  dbo.Tafzili2
                        WHERE Code = ParentSanad_View.Code_Tafzili2),'') AS 'شرح حساب تفصیل 2' 
                  ,dbo.ParentSanad_View.Mab_Bed AS 'مبلغ -بدهکار' 
                  , dbo.ParentSanad_View.Mab_Bes AS 'مبلغ - بستانکار' 
            FROM   dbo.ParentSanad_View LEFT OUTER JOIN
                  dbo.Hesab_VIEW ViewCol ON ViewCol.Code_Col = dbo.ParentSanad_View.Code_Col
                  AND ViewCol.Code_Moein = 0 LEFT OUTER JOIN
                  dbo.Hesab_VIEW ViewMoein ON ViewMoein.Code_Col = dbo.ParentSanad_View.Code_Col AND
                  ViewMoein.Code_Moein = dbo.ParentSanad_View.Code_Moein;
            """,

            """
            CREATE VIEW dbo.ServiceDefinition_VIEW
            AS
            SELECT
                SD.ID,SD.Code,SD.ServiceName,SD.Description,SD.ServiceType,
                CASE SD.ServiceType
                    WHEN 1 THEN N'مشاوره'
                    WHEN 2 THEN N'واسطه‌گری'
                    WHEN 3 THEN N'حق‌العمل‌کاری'
                    WHEN 4 THEN N'دلالی'
                    WHEN 5 THEN N'خدمات عمومی'
                    WHEN 6 THEN N'نمایندگی و پیگیری'
                    WHEN 7 THEN N'گردشگری'
                    ELSE N'نامشخص'
                END AS ServiceTypeTitle,
                SD.CalculationType,
                CASE SD.CalculationType
                    WHEN 1 THEN N'مبلغ ثابت'
                    WHEN 2 THEN N'تعداد × مبلغ'
                    WHEN 3 THEN N'درصد از مبلغ پایه'
                    WHEN 4 THEN N'درصد از مبلغ معامله'
                    WHEN 5 THEN N'ترکیبی'
                    ELSE N'نامشخص'
                END AS CalculationTypeTitle,
                SD.DefaultPercent,SD.DefaultAmount,SD.HasPrincipal,SD.HasTransactionAmount,
                SD.HasSettlement,SD.HasDirectCost,SD.ConnectToFactor,SD.IsTaxable,SD.TaxPercent,
                SD.ArticleID, AN.Code AS ArticleCode,AN.Name AS ArticleName,SD.RevenueCode_Col,
                SD.RevenueCode_Moein,SD.RevenueCode_Tafzil,RH_Col.Name AS RevenueColName,
                RH_Moein.Name AS RevenueMoeinName,RevenueTaf.[Name] AS RevenueTafzilName,
                SD.CostCode_Col,SD.CostCode_Moein,SD.CostCode_Tafzil,CH_Col.Name AS CostColName,
                CH_Moein.Name AS CostMoeinName,CostTaf.[Name] AS CostTafzilName,SD.PrincipalCode_Col,
                SD.PrincipalCode_Moein,SD.PrincipalCode_Tafzil,PH_Col.Name AS PrincipalColName,PH_Moein.Name AS PrincipalMoeinName,
                PrincipalTaf.[Name] AS PrincipalTafzilName,SD.IsActive,
                SD.CreatorID,SD.CreateDate,SD.CreateTime,SD.UpdaterID,SD.UpdateDate,SD.UpdateTime
            FROM dbo.ServiceDefinition AS SD
            LEFT JOIN dbo.ArticleNew AS AN ON AN.ID = SD.ArticleID
            LEFT JOIN dbo.Hesab AS RH_Col ON RH_Col.Code_Col = SD.RevenueCode_Col AND RH_Col.Code_Moein = 0 AND (RH_Col.Code_Tafzil IS NULL OR RH_Col.Code_Tafzil = 0)
            LEFT JOIN dbo.Hesab AS RH_Moein ON RH_Moein.Code_Col = SD.RevenueCode_Col AND RH_Moein.Code_Moein = SD.RevenueCode_Moein AND (RH_Moein.Code_Tafzil IS NULL OR RH_Moein.Code_Tafzil = 0)
            LEFT JOIN dbo.Tafzili_View AS RevenueTaf ON RevenueTaf.Code_Tafzil = SD.RevenueCode_Tafzil
            LEFT JOIN dbo.Hesab AS CH_Col ON CH_Col.Code_Col = SD.CostCode_Col AND CH_Col.Code_Moein = 0 AND (CH_Col.Code_Tafzil IS NULL OR CH_Col.Code_Tafzil = 0)
            LEFT JOIN dbo.Hesab AS CH_Moein ON CH_Moein.Code_Col = SD.CostCode_Col AND CH_Moein.Code_Moein = SD.CostCode_Moein AND (CH_Moein.Code_Tafzil IS NULL OR CH_Moein.Code_Tafzil = 0)
            LEFT JOIN dbo.Tafzili_View AS CostTaf ON CostTaf.Code_Tafzil = SD.CostCode_Tafzil
            LEFT JOIN dbo.Hesab AS PH_Col ON PH_Col.Code_Col = SD.PrincipalCode_Col AND PH_Col.Code_Moein = 0 AND (PH_Col.Code_Tafzil IS NULL OR PH_Col.Code_Tafzil = 0)
            LEFT JOIN dbo.Hesab AS PH_Moein ON PH_Moein.Code_Col = SD.PrincipalCode_Col AND PH_Moein.Code_Moein = SD.PrincipalCode_Moein AND (PH_Moein.Code_Tafzil IS NULL OR PH_Moein.Code_Tafzil = 0)
            LEFT JOIN dbo.Tafzili_View AS PrincipalTaf ON PrincipalTaf.Code_Tafzil = SD.PrincipalCode_Tafzil;
            """,

            """
            CREATE VIEW [dbo].[ServiceCase_VIEW]
            AS
            SELECT
                SC.ID, SC.CaseNo,SC.CaseDate,SC.ServiceDefinitionID,SD.ServiceName,
                SD.ServiceType,SD.CalculationType,SC.Title,SC.Description,SC.ContractNo,
                SC.ContractDate,SC.CustomerTafziliCode,CustomerTaf.[Name] AS CustomerName,
                CustomerTaf.JobName AS CustomerJobName,CustomerTaf.Mobile AS CustomerMobile,
                SC.PrincipalTafziliCode,PrincipalTaf.[Name] AS PrincipalName,PrincipalTaf.JobName AS PrincipalJobName,
                PrincipalTaf.Mobile AS PrincipalMobile,SC.OtherTafziliCode,OtherTaf.[Name] AS OtherTafziliName,OtherTaf.JobName AS OtherTafziliJobName,
                SC.BaseAmount,SC.TransactionAmount,SC.CommissionPercent,SC.CommissionAmount,SC.DiscountAmount,
                SC.TaxPercent,SC.TaxAmount,SC.OtherAmount,SC.TotalAmount,SC.PrincipalAmount,SC.CustomerReceivableAmount, SC.Status,
                CASE SC.Status
                    WHEN 1 THEN N'پیش‌نویس'
                    WHEN 2 THEN N'فعال'
                    WHEN 3 THEN N'در انتظار تسویه'
                    WHEN 4 THEN N'تسویه شده'
                    WHEN 5 THEN N'لغو شده'
                    ELSE N'نامشخص'
                END AS StatusTitle,
                SC.StartDate,SC.EndDate,SC.ResponsibleUserID,SC.IsPosted,SC.CreatorID,
                SC.CreateDate,SC.CreateTime,SC.UpdaterID,SC.UpdateDate,SC.UpdateTime, SC.ParentSanadID
            FROM dbo.ServiceCase AS SC
            INNER JOIN dbo.ServiceDefinition AS SD ON SD.ID = SC.ServiceDefinitionID
            LEFT JOIN dbo.Tafzili_View AS CustomerTaf ON CustomerTaf.Code_Tafzil = SC.CustomerTafziliCode
            LEFT JOIN dbo.Tafzili_View AS PrincipalTaf ON PrincipalTaf.Code_Tafzil = SC.PrincipalTafziliCode
            LEFT JOIN dbo.Tafzili_View AS OtherTaf ON OtherTaf.Code_Tafzil = SC.OtherTafziliCode;
            """,

            """
            CREATE VIEW dbo.ServiceCaseDetail_VIEW
            AS
            SELECT SCD.ID,SCD.CaseID,SC.CaseNo,SC.CaseDate,SC.Title AS CaseTitle,SCD.RowNo,
                SCD.OperationDate,SCD.OperationType, 
                CASE SCD.OperationType
                    WHEN 1 THEN N'شروع عملیات'
                    WHEN 2 THEN N'ارائه خدمت'
                    WHEN 3 THEN N'دریافت مدارک'
                    WHEN 4 THEN N'پیگیری'
                    WHEN 5 THEN N'محاسبه کارمزد'
                    WHEN 6 THEN N'پرداخت'
                    WHEN 7 THEN N'سایر'
                    ELSE N'نامشخص'
                END AS OperationTypeTitle,
                SCD.Title,SCD.[Description],SCD.ReferenceNo,SCD.Quantity,SCD.UnitAmount,SCD.BaseAmount,
                SCD.[Percent],SCD.CommissionAmount,SCD.TaxAmount,SCD.OtherAmount,SCD.Status,
                CASE SCD.[Status]
                    WHEN 1 THEN N'باز'
                    WHEN 2 THEN N'انجام شده'
                    WHEN 3 THEN N'لغو شده'
                    ELSE N'نامشخص'
                END AS StatusTitle,
                SCD.ArticleID,AN.Code AS ArticleCode,AN.Name AS ArticleName,SCD.FactorID,
                SCD.FactorDetailID,SCD.CreatorID,SCD.CreateDate,SCD.CreateTime
            FROM dbo.ServiceCaseDetail AS SCD
            INNER JOIN dbo.ServiceCase AS SC ON SC.ID = SCD.CaseID
            LEFT JOIN dbo.ArticleNew AS AN ON AN.ID = SCD.ArticleID;
            """,

            """
            CREATE VIEW dbo.ServiceCaseCost_VIEW
            AS
            SELECT SCC.ID,SCC.CaseID,SC.CaseNo,SC.CaseDate,SC.Title AS CaseTitle,SCC.CostDate,SCC.CostType,
                CASE SCC.CostType
                    WHEN 1 THEN N'کارشناس'
                    WHEN 2 THEN N'مأموریت'
                    WHEN 3 THEN N'حمل'
                    WHEN 4 THEN N'تبلیغات'
                    WHEN 5 THEN N'پیگیری'
                    WHEN 6 THEN N'ابزار'
                    WHEN 7 THEN N'سایر'
                    ELSE N'نامشخص'
                END AS CostTypeTitle,
                SCC.Title,SCC.Description,SCC.TafziliCode,SCC.Code_Col,SCC.Code_Moein,SCC.Code_Tafzil,SCC.Amount,
                SCC.TaxPercent,SCC.TaxAmount,SCC.TotalAmount,SCC.FactorID,SCC.FactorDetailID,SCC.ParentSanadID,SCC.IsPaid 
            FROM dbo.ServiceCaseCost AS SCC 
            INNER JOIN dbo.ServiceCase AS SC ON SC.ID = SCC.CaseID;
            """,

            """
            CREATE VIEW dbo.ServiceSettlement_VIEW
            AS
            SELECT SS.ID,SS.CaseID,SC.CaseNo,SC.CaseDate,SC.Title AS CaseTitle,SS.SettlementDate,SS.SettlementType,
              CASE SS.SettlementType
                    WHEN 1 THEN N'دریافت از مشتری'
                    WHEN 2 THEN N'پرداخت به موکل'
                    WHEN 3 THEN N'دریافت از طرف معامله'
                    WHEN 4 THEN N'پرداخت هزینه'
                    WHEN 5 THEN N'برگشت وجه'
                    WHEN 6 THEN N'سایر'
                    ELSE N'نامشخص'
                END AS SettlementTypeTitle,
               SS.TafziliCode,TV.Name AS TafziliName,TV.JobName AS TafziliJobName,SS.Amount,SS.PaymentMethod,
                CASE SS.PaymentMethod
                    WHEN 1 THEN N'نقدی'
                    WHEN 2 THEN N'کارتخوان'
                    WHEN 3 THEN N'بانک'
                    WHEN 4 THEN N'چک'
                    WHEN 5 THEN N'حواله'
                    WHEN 6 THEN N'سایر'
                    ELSE N'نامشخص'
                END AS PaymentMethodTitle,
                SS.ReferenceNo,SS.Description,SS.FactorID,SS.ParentSanadID,SS.IsConfirmed,SS.CreatorID,
                SS.CreateDate,SS.CreateTime,SS.ConfirmerID,SS.ConfirmDate,SS.ConfirmTime
            FROM dbo.ServiceSettlement AS SS
            INNER JOIN dbo.ServiceCase AS SC ON SC.ID = SS.CaseID
            LEFT JOIN dbo.Tafzili_VIEW AS TV ON TV.Code_Tafzil = SS.TafziliCode;
            """,

            """
            CREATE VIEW dbo.ServiceCaseFinancial_VIEW
            AS
            SELECT SC.ID AS CaseID,SC.CaseNo,SC.CaseDate,SC.Title AS CaseTitle,SC.ServiceDefinitionID,
                SD.ServiceName,SC.CustomerTafziliCode,CustomerTaf.Name AS CustomerName,SC.PrincipalTafziliCode,
                PrincipalTaf.Name AS PrincipalName,SC.BaseAmount,SC.TransactionAmount,SC.CommissionPercent,
                SC.CommissionAmount,SC.DiscountAmount,SC.TaxAmount,SC.OtherAmount,SC.TotalAmount,SC.PrincipalAmount,SC.CustomerReceivableAmount,
                ISNULL(Costs.TotalCost, 0) AS TotalCost, 
                ISNULL(Settlements.TotalReceived, 0) AS TotalReceived,
                ISNULL(Settlements.TotalPaidToPrincipal, 0) AS TotalPaidToPrincipal,
                ISNULL(Settlements.TotalOtherPayment, 0) AS TotalOtherPayment,
                ISNULL(Settlements.TotalReceived, 0) - ISNULL(Settlements.TotalPaidToPrincipal, 0)
                - ISNULL(Settlements.TotalOtherPayment, 0) AS CashBalance,
                SC.CommissionAmount - ISNULL(Costs.TotalCost, 0) AS GrossProfit,
                SC.CustomerReceivableAmount - ISNULL(Settlements.TotalReceived, 0) AS ReceivableBalance,
                SC.PrincipalAmount
                - ISNULL(Settlements.TotalPaidToPrincipal, 0) AS PrincipalBalance,SC.Status,
                CASE SC.Status
                    WHEN 1 THEN N'پیش‌نویس'
                    WHEN 2 THEN N'فعال'
                    WHEN 3 THEN N'در انتظار تسویه'
                    WHEN 4 THEN N'تسویه شده'
                    WHEN 5 THEN N'لغو شده'
                    ELSE N'نامشخص'
                END AS StatusTitle
            FROM dbo.ServiceCase AS SC
            INNER JOIN dbo.ServiceDefinition AS SD ON SD.ID = SC.ServiceDefinitionID
            LEFT JOIN dbo.Tafzili_View AS CustomerTaf ON CustomerTaf.Code_Tafzil = SC.CustomerTafziliCode
            LEFT JOIN dbo.Tafzili_View AS PrincipalTaf ON PrincipalTaf.Code_Tafzil = SC.PrincipalTafziliCode
            OUTER APPLY
            (SELECT SUM(SCC.TotalAmount) AS TotalCost
                FROM dbo.ServiceCaseCost AS SCC
                WHERE SCC.CaseID = SC.ID) AS Costs
            OUTER APPLY
            (SELECT SUM(CASE WHEN SS.SettlementType IN (1, 3) AND SS.IsConfirmed = 1
                            THEN SS.Amount
                            ELSE 0  END) AS TotalReceived,
                    SUM(CASE WHEN SS.SettlementType = 2 AND SS.IsConfirmed = 1 THEN SS.Amount ELSE 0  END ) AS TotalPaidToPrincipal,
                    SUM(CASE WHEN SS.SettlementType IN (4, 5, 6) AND SS.IsConfirmed = 1
                            THEN SS.Amount ELSE 0 END ) AS TotalOtherPayment
               FROM dbo.ServiceSettlement AS SS
                WHERE SS.CaseID = SC.ID
            ) AS Settlements;
            """,
        

            // ============================================================
            // Functions — بخش دوم (توابع جدولی و محاسباتی سنگین)
            // ============================================================
            """
            CREATE FUNCTION [dbo].[fnArticle_WithDate] (@Date1 nvarchar(10), @Date2 nvarchar(10))
            RETURNS Table AS return
            Select [ID], [Code], [Name], [ArticleUnitID],
            [ArticleGroupName],[ArticleGroupCode], [ArticleUnitName],[ArticleGroupID],[StockTypeCode],[StockTypeName],
            [StockTypeID],[Code_Col],[Code_Moein],[Code_Tafzil],[Kind], [Depreciation],[DepreciationTypeName],
            [DepreciationType],[For_EST],[Code_Col_Buy],[Code_Moein_Buy],[Code_Tafzil_Buy],
            [Code_Col_ReBuy],[Code_Moein_ReBuy],[Code_Tafzil_ReBuy],[Code_Col_ReSale],[Code_Moein_ReSale],
            [Code_Tafzil_ReSale],[AmountFirst],[CostFirst],[Status],[StatusName],
            [MaxCostOrderBy],[MinCostOrderBy],[xIs_RegMinOrderToIn],[xIs_RegMaxOrderToOut],[xIs_RegNegativKala],
            [xNotCalcPerDiscount],[xNotCalcArezeshafzode],[xIs_CalcUnit2],[xIs_CalcUnit3],[AmountSale],
            [ArticleUnitName2],[ArticleUnitID2],[Tabdil1],[Tabdil2],[ArticleUnitName3],[ArticleUnitID3],[Tabdil3],
            isnull((Select Sum(isnull(Cost,0)) * Sum(isnull(Val,0)) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 0 and DateIn >= @Date1 and DateIn <= @Date2), 0)
            + isnull((Select Sum(CostTax) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 0 and DateIn >= @Date1 and DateIn <= @Date2), 0) as inAmount,
            isnull((Select isnull(Sum(Val),0) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 0 and DateIn >= @Date1 and DateIn <= @Date2), 0)
            + isnull((Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 0 and DateIn >= @Date1 and DateIn <= @Date2), 0) as InVal,
            isnull((Select Sum(isnull(Cost,0)) * Sum(isnull(Val,0)) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 1 and DateIn >= @Date1 and DateIn <= @Date2), 0)
            + isnull((Select Sum(CostTax) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 1 and DateIn >= @Date1 and DateIn <= @Date2), 0) as OutAmount,
            isnull((Select isnull(Sum(Val),0) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 1 and DateIn >= @Date1 and DateIn <= @Date2), 0)
            + (Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 1 and DateIn >= @Date1 and DateIn <= @Date2) as OutVal,
            isnull((Select Sum(isnull(Cost,0)) * Sum(isnull(Val,0)) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 2 and DateIn >= @Date1 and DateIn <= @Date2), 0)
            + isnull((Select Sum(CostTax) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 3 and DateIn >= @Date1 and DateIn <= @Date2), 0) as BackAmount,
            isnull((Select Sum(Val) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 2 and DateIn >= @Date1 and DateIn <= @Date2), 0)
            + isnull((Select Sum(ArticleCount) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 3 and DateIn >= @Date1 and DateIn <= @Date2), 0) as BackVal,
            isnull((Select Sum(CostTax) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 2 and DateIn >= @Date1 and DateIn <= @Date2), 0) as BuyBakcAmount,
            isnull((Select Sum(ArticleCount) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 2 and DateIn >= @Date1 and DateIn <= @Date2), 0) as BuyBakVal,
            dbo.GetArticleCost(x.ID) * 
            (((((Select isnull(Sum(Val),0) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 2 and DateIn >= @Date1 and DateIn <= @Date2)
            + (Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 3 and DateIn >= @Date1 and DateIn <= @Date2))
            + (Select isnull(Sum(Val),0) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 0 and DateIn >= @Date1 and DateIn <= @Date2)
            + (Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 0 and DateIn >= @Date1 and DateIn <= @Date2))
            + isNull(CostFirst,0))
            - (((Select isnull(Sum(Val),0) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 1 and DateIn >= @Date1 and DateIn <= @Date2)
            + (Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 1 and DateIn >= @Date1 and DateIn <= @Date2))
            + ((Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 2 and DateIn >= @Date1 and DateIn <= @Date2)))) as FinalAmount,
            (((((Select isnull(Sum(Val),0) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 2 and DateIn >= @Date1 and DateIn <= @Date2)
            + (Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 3 and DateIn >= @Date1 and DateIn <= @Date2))
            + (Select isnull(Sum(Val),0) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 0 and DateIn >= @Date1 and DateIn <= @Date2)
            + (Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 0 and DateIn >= @Date1 and DateIn <= @Date2))
            + isNull(CostFirst,0))
            - (((Select isnull(Sum(Val),0) from Stock_Factor_All_VIEW where ArticleID = x.ID and Kind = 1 and DateIn >= @Date1 and DateIn <= @Date2)
            + (Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 1 and DateIn >= @Date1 and DateIn <= @Date2))
            + ((Select isnull(Sum(ArticleCount),0) from FactorDetail_VIEW where ArticleID = x.ID and FactorKind = 2 and DateIn >= @Date1 and DateIn <= @Date2)))) as FinalVal
            From ArticleNew_VIEW as X;
            """,

            """
            CREATE FUNCTION [dbo].[GetMToSDate](@aDateIN DateTime)
            RETURNS varchar(10) AS
            BEGIN
                Declare @aTemp varchar(10)
                Declare @M____M int, @R____R int, @Y____Y int
                Declare @sM____M varchar(10), @sR____R varchar(10), @sY____Y varchar(10)
                Declare @TAR____RAT datetime
                Declare @DA____TA int
                
                if CharIndex('/', convert(varchar(10),@aDateIn, 111)) = 0
                begin
                    set @aDateIn = Stuff(stuff(@aDateIn, 5, 0, '/'), 8, 0, '/')
                end
                
                set @TAR____RAT = @aDateIN
                set @Y____Y = DATEPART(Year, @TAR____RAT) - 622
                set @DA____TA = DATEDIFF(Day, Cast(Year(@aDateIN) as varchar(4)) + '/01/01', @TAR____RAT)
                
                if Year(@TAR____RAT) % 4 = 1
                    set @DA____TA = @DA____TA + 288
                else
                    set @DA____TA = @DA____TA + 287
                
                if @Y____Y % 4 = 3
                    if @DA____TA > 366
                    begin
                        set @DA____TA = @DA____TA - 366
                        set @Y____Y = (@Y____Y + 1)
                    end
                    else
                        set @Y____Y = (@Y____Y)
                else
                    if @DA____TA > 365
                    begin
                        set @DA____TA = @DA____TA - 365
                        set @Y____Y = (@Y____Y + 1)
                    end
                    else
                        set @Y____Y = (@Y____Y)
                
                if (@DA____TA >= 1) and (@DA____TA <= 31)
                begin
                    set @M____M = 1
                    set @R____R = @DA____TA
                end
                if (@DA____TA >= 32) and (@DA____TA <= 62)
                begin
                    set @M____M = 02
                    set @R____R = @DA____TA - 31
                end
                if (@DA____TA >= 63) and (@DA____TA <= 93)
                begin
                    set @M____M = 03
                    set @R____R = @DA____TA - 62
                end
                if (@DA____TA >= 94) and (@DA____TA <= 124)
                begin
                    set @M____M = 04
                    set @R____R = @DA____TA - 93
                end
                if (@DA____TA >= 125) and (@DA____TA <= 155)
                begin
                    set @M____M = 05
                    set @R____R = @DA____TA - 124
                end
                if (@DA____TA >= 156) and (@DA____TA <= 186)
                begin
                    set @M____M = 6
                    set @R____R = @DA____TA - 155
                end
                if (@DA____TA >= 187) and (@DA____TA <= 216)
                begin
                    set @M____M = 07
                    set @R____R = @DA____TA - 186
                end
                if (@DA____TA >= 217) and (@DA____TA <= 246)
                begin
                    set @M____M = 08
                    set @R____R = @DA____TA - 216
                end
                if (@DA____TA >= 247) and (@DA____TA <= 276)
                begin
                    set @M____M = 9
                    set @R____R = @DA____TA - 246
                end
                if (@DA____TA >= 277) and (@DA____TA <= 306)
                begin
                    set @M____M = 10
                    set @R____R = @DA____TA - 276
                end
                if (@DA____TA >= 307) and (@DA____TA <= 336)
                begin
                    set @M____M = 11
                    set @R____R = @DA____TA - 306
                end
                if (@DA____TA >= 337)
                begin
                    set @M____M = 12
                    set @R____R = @DA____TA - 336
                end
                
                set @sR____R = cast(@R____R as varchar(10))
                while len(@sR____R) < 2
                begin
                    Set @sR____R = '0' + @sR____R
                end
                set @sM____M = cast(@M____M as varchar(10))
                while len(@sM____M) < 2
                begin
                    set @sM____M = '0' + @sM____M
                end
                set @sY____Y = cast(@Y____Y as varchar(10))
                while len(@sY____Y) < 2
                begin
                    set @sY____Y = '0' + @sY____Y
                end
                
                select @aTemp = @sY____Y + '/' + @sM____M + '/' + @sR____R
                Return(@aTemp)
            END;
            """,

            """
            CREATE FUNCTION [dbo].[GetStockTypeKind] (@Kind int)
            RETURNS varchar(20) AS
            BEGIN
                Declare @aTemp varchar(20)
                if @Kind = 0 set @aTemp = N'کالا'
                else if @Kind = 1 set @aTemp = N'محصول'
                return(@aTemp)
            END;
            """,

            // ============================================================
            // Functions — بخش سوم (توابع موجودی و مودیان)
            // ============================================================
            """
            CREATE FUNCTION [dbo].[fn_GetArticleStock](@ArticleID numeric(18,0), @StockTypeID numeric(18,0))
            RETURNS FLOAT AS BEGIN
                DECLARE @Result FLOAT; DECLARE @FirstExistence FLOAT;
                SELECT @FirstExistence = ISNULL(AmountFirst, 0) FROM [dbo].[ArticleNew] WHERE ID = @ArticleID;
                SELECT @Result = ISNULL(@FirstExistence, 0)
                + ISNULL((SELECT SUM(ISNULL(AD.ArticleCount, 0)) FROM [dbo].[FactorDetail] AD INNER JOIN [dbo].[FactorParent] AP ON AP.ID = AD.FactorID WHERE AD.ArticleID = @ArticleID AND AP.FactorKind = 0), 0)
                + ISNULL((SELECT SUM(ISNULL(SM.Val, 0)) FROM [dbo].[Stock_Factor_Mat] SM INNER JOIN [dbo].[Stock_Factor] SF ON SF.ID = SM.StockFacorID WHERE SM.ArticleID = @ArticleID AND SF.Kind = 0), 0)
                + ISNULL((SELECT SUM(ISNULL(SM.Val, 0)) FROM [dbo].[Stock_Factor_Mat] SM INNER JOIN [dbo].[Stock_Factor] SF ON SF.ID = SM.StockFacorID WHERE SM.ArticleID = @ArticleID AND SF.Kind = 2), 0)
                + ISNULL((SELECT SUM(ISNULL(AD.ArticleCount, 0)) FROM [dbo].[FactorDetail] AD INNER JOIN [dbo].[FactorParent] AP ON AP.ID = AD.FactorID WHERE AD.ArticleID = @ArticleID AND AP.FactorKind = 2), 0)
                - ISNULL((SELECT SUM(ISNULL(AD.ArticleCount, 0)) FROM [dbo].[FactorDetail] AD INNER JOIN [dbo].[FactorParent] AP ON AP.ID = AD.FactorID WHERE AD.ArticleID = @ArticleID AND AP.FactorKind = 1), 0)
                - ISNULL((SELECT SUM(ISNULL(SM.Val, 0)) FROM [dbo].[Stock_Factor_Mat] SM INNER JOIN [dbo].[Stock_Factor] SF ON SF.ID = SM.StockFacorID WHERE SM.ArticleID = @ArticleID AND SF.Kind = 1), 0)
                - ISNULL((SELECT SUM(ISNULL(SM.Val, 0)) FROM [dbo].[Stock_Factor_Mat] SM INNER JOIN [dbo].[Stock_Factor] SF ON SF.ID = SM.StockFacorID WHERE SM.ArticleID = @ArticleID AND SF.Kind = 3), 0);
                RETURN ISNULL(@Result, 0);
            END;
            """,

            """
            CREATE FUNCTION [dbo].[fn_GetCurrentStock](@ArticleID numeric(18,0), @StockTypeID numeric(18,0))
            RETURNS FLOAT AS BEGIN
                DECLARE @Result FLOAT;
                SELECT @Result = ISNULL(SUM(CASE WHEN A.KindArticles = 1 THEN A.Inputed ELSE 0 END), 0) - ISNULL(SUM(CASE WHEN A.KindArticles = 2 THEN A.OutPuted ELSE 0 END), 0)
                FROM [dbo].[Articles] A INNER JOIN [dbo].[ArticleStock] AST ON AST.ArticleID = A.ArticleID
                WHERE A.ArticleID = @ArticleID AND AST.StockTypeID = @StockTypeID;
                RETURN ISNULL(@Result, 0);
            END;
            """,

            """
            CREATE FUNCTION [dbo].[fn_GetArticleCost](@ArticleID numeric(18,0))
            RETURNS FLOAT AS BEGIN
                DECLARE @Result FLOAT;
                SELECT TOP 1 @Result = CASE WHEN ISNULL(A.CostFirst, 0) > 0 THEN A.CostFirst WHEN ISNULL(A.AmountFirst, 0) > 0 THEN A.AmountFirst ELSE ISNULL(AVG(FD.Cost), 0) END
                FROM [dbo].[ArticleNew] A
                LEFT JOIN [dbo].[FactorDetail] FD ON FD.ArticleID = A.ID
                LEFT JOIN [dbo].[FactorParent] FP ON FP.ID = FD.FactorID AND FP.FactorKind = 0 AND FD.Cost > 0 AND FD.Cost IS NOT NULL
                WHERE A.ID = @ArticleID
                GROUP BY A.ID, A.CostFirst, A.AmountFirst;
                RETURN ISNULL(@Result, 0);
            END;
            """,


            """
            CREATE FUNCTION [dbo].[fn_GetNTSW_Data] (@SazmanCode INT, @DorehMaliID INT, @FactorKind INT,
            @FactorNoFrom INT = NULL, @FactorNoTo INT = NULL, @DateFrom NVARCHAR(20) = NULL, @DateTo NVARCHAR(20) = NULL,
            @CodeTafzil INT = NULL, @ArticleCode BIGINT = NULL)
            RETURNS TABLE
            AS
            RETURN
            (
                SELECT
                    COALESCE(PS.Date_IN, FP.Date_In) AS [تاریخ سند  *],
                    FP.NoFactor AS [شماره صورتحساب],
                    TV.NationalCode AS [* کد/شناسه ملی خریدار],
                    TV.Kind AS [کد نقش تجاری خریدار],
                    TV.Name AS [نام خریدار],
                    TV.Mobile AS [تلفن همراه],
                    CAST(
                        CASE
                            WHEN @FactorKind = -1 THEN SZ.PostalCode
                            WHEN @FactorKind =  0 THEN TV.PostalCode
                            WHEN @FactorKind = -3 THEN TV.PostalCode
                            ELSE SZ.PostalCode
                        END
                    AS NVARCHAR(50)) AS [* کدپستی انبار مبدا],
                    CAST(
                        CASE
                            WHEN @FactorKind = -1 THEN TV.PostalCode
                            WHEN @FactorKind =  0 THEN SZ.PostalCode
                            WHEN @FactorKind = -3 THEN SZ.PostalCode
                            ELSE TV.PostalCode
                        END
                    AS NVARCHAR(50)) AS [کدپستی انبار مقصد],
                    CAST(NULL AS NVARCHAR(50)) AS [شماره قرارداد بورس],
                    N'بدون بارنامه' AS [*وضعیت حمل],
                    CAST(NULL AS NVARCHAR(50)) AS [شماره بارنامه],
                    CAST(NULL AS NVARCHAR(10)) AS [تاریخ بارنامه],
                    CAST(NULL AS NVARCHAR(50)) AS [سریال بارنامه],
                    COALESCE(
                        NULLIF(LTRIM(RTRIM(PS.OtherParentSharh)), N''),
                        NULLIF(LTRIM(RTRIM(FP.Descript)), N''),
                        N''
                    ) AS [شرح سند],
                    AN.Tax_ID AS [* شناسه کالا],
                    FD.ArticleCount AS [* تعداد/مقدار],
                    FD.Cost AS [مبلغ واحد (ریال)],
                    FD.Discount AS [مبلغ تخفیف (ریال)],
                    FD.Tax AS [مبلغ مالیات و عوارض (ریال)],
                    ISNULL(FD.IncCost, 0) AS [سایر اضافات (ریال)]
                FROM dbo.FactorDetail_VIEW AS FD
                INNER JOIN dbo.FactorParent_View AS FP ON FP.ID = FD.FactorID
                LEFT JOIN dbo.ParentSanad AS PS ON PS.ParentSanadID = FP.Parent_Sanad_ID
                INNER JOIN dbo.Tafzili_VIEW AS TV ON TV.Code_Tafzil = FP.CodeTafzil
                INNER JOIN dbo.ArticleNew AS AN ON AN.ID = FD.ArticleID
                INNER JOIN Permanent.dbo.vw_Sazman AS SZ ON SZ.SazmanCode = @SazmanCode AND SZ.DorehMaliID = @DorehMaliID
                WHERE FP.FactorKind = @FactorKind
                AND (@FactorNoFrom IS NULL OR FP.NoFactor >= @FactorNoFrom)
                AND (@FactorNoTo   IS NULL OR FP.NoFactor <= @FactorNoTo)
                AND (@DateFrom     IS NULL OR COALESCE(PS.Date_IN, FP.Date_In) >= @DateFrom)
                AND (@DateTo       IS NULL OR COALESCE(PS.Date_IN, FP.Date_In) <= @DateTo)
                AND (@CodeTafzil   IS NULL OR FP.CodeTafzil = @CodeTafzil)
                AND (@ArticleCode  IS NULL OR AN.Code = @ArticleCode)
            );
            """,
                        // ============================================================
            // Procedures — بخش اول
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.Create_ChequeBook_Child', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Create_ChequeBook_Child];
            IF OBJECT_ID(N'dbo.Update_ChequeBook_Child', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Update_ChequeBook_Child];
            IF OBJECT_ID(N'dbo.Update_Asset', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Update_Asset];
            IF OBJECT_ID(N'dbo.Prepare_Depreciation_Report', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Prepare_Depreciation_Report];
            IF OBJECT_ID(N'dbo.PrepareRotateArticle', N'P') IS NOT NULL DROP PROCEDURE [dbo].[PrepareRotateArticle];
            IF OBJECT_ID(N'dbo.Insert_Sanad', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Insert_Sanad];
            IF OBJECT_ID(N'dbo.GetStockDescript', N'P') IS NOT NULL DROP PROCEDURE [dbo].[GetStockDescript];
            IF OBJECT_ID(N'dbo.Save_Factor_Sanad', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Save_Factor_Sanad];
            """,

            """
            CREATE PROCEDURE [dbo].[Create_ChequeBook_Child] 
                @ID numeric   
            AS 
            BEGIN
                SET NOCOUNT ON;
                Declare @Index int, @Count int, @ChequeBook_Child Varchar(30), @Serial1 numeric, @Serial numeric 
                set @Index = 1 
                set @Count = 0 
                Delete from ChequeBook_Child where ChequeBookID = @ID 
                Select @Count = IsNull(SheetNo,0), @Serial1 = IsNull(Serial1,0) from ChequeBook where ID = @ID 
                while @Index <= @Count  
                begin        
                    set @Serial = @Serial1 + @Index 
                    insert into ChequeBook_Child(ChequeBookID, Serial) Values(@ID, @Serial)  
                    set @Index = @Index + 1 
                end
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Update_ChequeBook_Child] 
                @SanadID numeric, 
                @OpKind int   
            AS  
            BEGIN
                SET NOCOUNT ON;
                Declare @ChequeBookID numeric, @ChequeBookDate varchar(10), @ChequeBook_Receiver varchar(50), @No_Sanad numeric, @Cost numeric 
                set @ChequeBookID = 0 
                select @ChequeBookID=ChequeBook_ChildID, @ChequeBookDate=ChequeBookDate, @ChequeBook_Receiver=ChequeBook_Receiver, @Cost=Mab_Bes, @No_Sanad=No_sanad 
                from ParentSanad_VIEW where SanadID=@SanadID 
                
                if Isnull(@ChequeBookID,0) > 0 
                begin 
                    if IsNull(@OpKind,0) = 1 
                        update ChequeBook_Child set SanadID=@SanadID, No_Sanad=@No_Sanad, Cost=@Cost, DateIN=@ChequeBookDate, ReciverName=@ChequeBook_Receiver where ID = @ChequeBookID 
                    else 
                        update ChequeBook_Child set SanadID=null, No_Sanad=null, Cost=null, DateIN=null, ReciverName=null where ID = @ChequeBookID 
                end 
                else 
                    update ChequeBook_Child set SanadID=null, No_Sanad=null, Cost=null, DateIN=null, ReciverName=null where SanadID = @SanadID 
                
                if @@Error = 0 
                    return(1) 
                else 
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Update_Asset] 
                @SanadID numeric, 
                @OpKind int 
            AS 
            BEGIN
                SET NOCOUNT ON;
                Declare @Code numeric  
                set @Code = 0   
                
                if @OpKind = 2  
                    Delete from Asset where SanadID = @SanadID  
                else   
                if @OpKind = 1    
                begin   
                    select @Code = Max(Code) from Asset  
                    set @Code = IsNull(@Code,0) + 1  
                    
                    if Exists(Select ID from Asset where SanadID = @SanadID)  
                        update Asset set ArticleID=P.ArticleID, DateIN=P.Date_IN, Cost=P.Mab_Bed, No_Sanad=P.No_Sanad    
                        from ParentSanad_VIEW as P where P.SanadID=@SanadID and Asset.SanadID=@SanadID  
                    else  
                        insert into Asset(No_Sanad, Cost, DateIN, ArticleID, Code, SanadID)  
                        select No_Sanad, Mab_Bed, Date_IN, ArticleID, @Code, @SanadID from ParentSanad_VIEW where SanadID = @SanadID and ISNull(ArticleID,0) > 0   
                    
                    Delete from Asset where SanadID = @SanadID and ISNull(ArticleID,0) = 0   
                end    
                     
                if @@Error = 0   
                    return(1)   
                else       
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Prepare_Depreciation_Report] 
                @ComputerName varchar(50), 
                @Date1 varchar(10),  
                @Date2 Varchar(10), 
                @aNoSanad1 int, 
                @aNoSanad2 int, 
                @aStockTypeCode int, 
                @aArticleGrgCode int 
            AS  
            BEGIN
                SET NOCOUNT ON;
                delete from Depreciation_Report_Temp where ComputerName = @ComputerName   
                
                insert into Depreciation_Report_Temp(ComputerName, ArticleName, GroupName2, BuyCost, Nerkh, Kind, ArticleID, No_Sanad, DateIN, Depreciation_Before, Cost_Before, GroupName1, ArticleCode, GroupCode1, GroupCode2, SanadID)  
                Select @ComputerName, Name, ArticleGroupName, IsNull(Cost,0), Nerkh, DepreciationType, ArticleID, No_Sanad, DateIN, Depreciation_Before, Cost_Before, StockTypeName, ArticleCode, StockTypeCode, ArticleGroupCode, SanadID   
                from Asset_VIEW 
                where ((@Date1 ='    /  /  ' or DateIN >= @Date1) and (@Date2='    /  /  ' or DateIN <= @Date2)) 
                and (@aNoSanad1=0 OR No_Sanad>=@aNoSanad1)  
                and (@aNoSanad2=0 OR No_Sanad<=@aNoSanad2)  
                and (@aStockTypeCode=0 OR StockTypeCode =@aStockTypeCode) 
                and (@aArticleGrgCode=0 OR ArticleGroupCode=@aArticleGrgCode)  
                
                update Depreciation_Report_Temp set Karkerd= 1+dbo.GetDateDiff(DateIN, '00:00', @Date2, '00:00', 'DA'), AllAsset = IsNull(Cost_Before,0)+ IsNull(BuyCost,0)  
                where ComputerName = @ComputerName  
                
                update Depreciation_Report_Temp set Depreciation = (AllAsset*IsNull(Karkerd,0))/(Nerkh*365)  
                where ComputerName = @ComputerName and IsNull(Kind,0)=0 and (IsNull(Nerkh,0)*IsNull(Karkerd,0)) >0   
                
                update Depreciation_Report_Temp set Depreciation = (AllAsset - IsNull(Depreciation_Before,0))*(Nerkh*Karkerd)/36500   
                where ComputerName = @ComputerName and IsNull(Kind,0)=1  
                
                update Depreciation_Report_Temp set Depreciation_Total = IsNull(Depreciation_Before,0)+IsNull(Depreciation,0), OfficeCost = AllAsset - IsNull(Depreciation,0)  
                where ComputerName = @ComputerName and IsNull(Depreciation,0)>=0  
                
                update Depreciation_Report_Temp set Depreciation=0 where ComputerName = @ComputerName and IsNull(Depreciation,0)<0   
                
                if @@Error = 0  
                    return(1)  
                else       
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[PrepareRotateArticle]  
                @aDate1 varchar(10), 
                @aDate2 varchar(10), 
                @ShowMande bit, 
                @StockID varchar(10), 
                @aArticleID varchar(20), 
                @ComputerName varchar(50), 
                @WhereSQL nvarchar(3000)
            AS
            BEGIN
                SET NOCOUNT ON;
                Declare @SQL nvarchar(3000)
                
                IF EXISTS(SELECT name FROM tempdb..sysobjects WHERE name = N'##tmp_Stock_Factor_Report' AND type = 'U')
                    DROP TABLE ##tmp_Stock_Factor_Report
                    
                CREATE TABLE [##tmp_Stock_Factor_Report] (
                    [ID] [numeric](18, 0) IDENTITY(1,1) NOT NULL,
                    [Name] [varchar](50) NULL,
                    [Code] [numeric](18, 0) NULL,
                    [DateIN] [varchar](10) NULL,
                    [Val] [float] NULL,
                    [InP] [float] NULL,
                    [OutP] [float] NULL,
                    [Rem] [float] NULL,
                    [Des] [varchar](50) NULL,
                    [ComputerName] [varchar](50) NULL,
                    [ArticleID] [numeric](18, 0) NULL,
                    [ArticleName] [varchar](50) NULL,
                    [Kind] [tinyint] NULL,
                    [ArticleCode] [numeric](18, 0) NULL,
                    CONSTRAINT [PK_tmp_Stock_Factor_Report] PRIMARY KEY CLUSTERED ([ID]) ON [PRIMARY]
                ) ON [PRIMARY]
                
                Delete from Stock_Factor_Report where ComputerName = @ComputerName
                
                set @SQL = 'Insert into ##tmp_Stock_Factor_Report(Name, Code, DateIN, Val, InP, OutP, Rem, ComputerName, ArticleName, ArticleID, Kind, ArticleCode) ' +
                ' Select ' + QUOTENAME(N'موجودی اولیه', '''') + ', StockTypeCode, SubString(@aDate1,1,4)+''/01/01'','' + ' +
                ' isNull(CostFirst,0), isNull(CostFirst,0),0,0, @ComputerName, Name, [ID], ' +
                ' 10, Code ' +
                ' from ArticleNew_VIEW where StockTypeID =''+@StockID'
                
                if @aArticleID <> 0
                    set @SQL = @SQL + ' and Code =''+@aArticleID'
                if @WhereSQL = ''
                    set @WhereSQL = ' where 1=1'
                set @SQL = @SQL + ' Order by Code'
                
                EXECUTE sp_ExecuteSQL @SQL, N'@ComputerName varchar(50), @aDate1 varchar(10)', @ComputerName, @aDate1
                
                if @ShowMande = 1
                begin
                    set @SQL = 'insert into ##tmp_Stock_Factor_Report(Name, Code, DateIN, Val, InP, OutP, Rem, Des, ComputerName, ArticleName, ArticleID, ArticleCode) ' +
                    ' select ' + QUOTENAME(N'مانده قبل از تاریخ', '''') + ' + @aDate1, 0, ' + QUOTENAME('', '''') + ', ' +
                    ' IsNull((Select Sum(P.Val)from Stock_Factor_All_View as P ' +
                    ' where P.ArticleID = K.ArticleID and P.DateIN< @aDate1 and P.Kind = 0 ), 0) - ' +
                    ' IsNull((Select Sum(P.Val)from Stock_Factor_All_View as P ' +
                    ' where P.ArticleID = K.ArticleID and P.DateIN< @aDate1 and P.Kind = 1 ), 0), ' +
                    ' 0,0,0,'''', @ComputerName, ArticleName, ArticleID, ArticleCode from Stock_Factor_All_View as K ' +
                    ' where StockTypeID =''+@StockID'
                    
                    if @aArticleID <> 0
                        set @SQL = @SQL + ' and ArticleCode = ''+@aArticleID'
                        
                    set @SQL = @SQL + ' and K.DateIN <= @aDate1 group by ArticleName, ArticleID, ArticleCode '
                    
                    EXECUTE sp_ExecuteSQL @SQL, N'@ComputerName varchar(50), @aDate1 varchar(10), @aDate2 varchar(10)', @ComputerName, @aDate1, @aDate2
                end
                
                set @SQL = 'insert into ##tmp_Stock_Factor_Report(Name, Code, DateIN, Val, InP, OutP, Rem, ComputerName, ArticleName, ArticleID, Kind, ArticleCode) ' +
                ' select Des, Code, DateIN, Val, 0,0,0, @ComputerName, ArticleName, ArticleID, Kind, ArticleCode from ' +
                ' Stock_Factor_All_View as K ' + @WhereSQL + ' and isNull(FactorID,0) = 0 Order by DateIN, Kind, ArticleName '
                
                EXECUTE sp_ExecuteSQL @SQL, N'@ComputerName varchar(50)', @ComputerName
                
                set @SQL = 'Insert into ##tmp_Stock_Factor_Report(Name, Code, DateIN, Val, InP, OutP, Rem, ComputerName, ArticleName, ArticleID, Kind, ArticleCode) ' +
                ' Select HesabName, NoFactor, DateIN, ArticleCount, 0,0,0, @ComputerName, ArticleName, ArticleID, ' +
                ' kind =(case FactorKind when 0 then 3 when 1 then 4 when 2 then 5 when 3 then 6 end), ArticleCode ' +
                ' from FactorDetail_VIEW as K ' + @WhereSQL + ' and FactorKind in(0,1,2,3) Order by DateIN, kind'
                
                EXECUTE sp_ExecuteSQL @SQL, N'@ComputerName varchar(50)', @ComputerName
                
                update ##tmp_Stock_Factor_Report set InP = Val where Kind = 0 and ComputerName = @ComputerName
                update ##tmp_Stock_Factor_Report set OutP = Val where Kind = 1 and ComputerName = @ComputerName
                update ##tmp_Stock_Factor_Report set InP = Val where Kind = 2 and ComputerName = @ComputerName
                update ##tmp_Stock_Factor_Report set InP = Val where Kind = 3 and ComputerName = @ComputerName
                update ##tmp_Stock_Factor_Report set OutP = Val where Kind = 4 and ComputerName = @ComputerName
                update ##tmp_Stock_Factor_Report set OutP = Val where Kind = 5 and ComputerName = @ComputerName
                update ##tmp_Stock_Factor_Report set InP = Val where Kind = 6 and ComputerName = @ComputerName
                update ##tmp_Stock_Factor_Report set InP = Val where Kind = 10 and ComputerName = @ComputerName
                
                insert into Stock_Factor_Report([Code],[DateIN],[Val],[InP],[OutP],[Rem],[Des],[ComputerName],[ArticleID],[ArticleName],[Kind],[ArticleCode],[Name])
                select [Code],[DateIN],isnull([Val],0),isNull([InP],0),isNull([OutP],0),[Rem],[Des],[ComputerName],[ArticleID],[ArticleName],[Kind],[ArticleCode],[Name]
                from ##tmp_Stock_Factor_Report order by ArticleID,DateIn
                
                update Stock_Factor_Report set Rem = IsNull((Select sum(IsNull(P.Inp,0)) - sum(IsNull(P.OutP,0)) from Stock_Factor_Report as P
                where P.ComputerName = @ComputerName and P.ID <= Stock_Factor_Report.ID and P.ArticleID = Stock_Factor_Report.ArticleID), 0)
                where ComputerName = @ComputerName
                
                Delete from Stock_Factor_Report where ComputerName = @ComputerName and IsNull(Val, 0) = 0
                
                update Stock_Factor_Report set Des = N'رسید' where Kind = 0 and ComputerName = @ComputerName and Code > 0
                update Stock_Factor_Report set Des = N'حواله' where Kind = 1 and ComputerName = @ComputerName and Code > 0
                update Stock_Factor_Report set Des = N'رسید برگشتی' where Kind = 2 and ComputerName = @ComputerName and Code > 0
                update Stock_Factor_Report set Des = N'خرید' where Kind = 3 and ComputerName = @ComputerName and Code > 0
                update Stock_Factor_Report set Des = N'فروش' where Kind = 4 and ComputerName = @ComputerName and Code > 0
                update Stock_Factor_Report set Des = N'برگشت خرید' where Kind = 5 and ComputerName = @ComputerName and Code > 0
                update Stock_Factor_Report set Des = N'برگشت فروش' where Kind = 6 and ComputerName = @ComputerName and Code > 0
                update Stock_Factor_Report set Des = N'موجودی اولیه' where Kind = 10 and ComputerName = @ComputerName and Code > 0
                update Stock_Factor_Report set Rem = Round(rem,2)
                
                if @@Error = 0
                    return(1)
                else
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Insert_Sanad]  
                @aNo_Sanad numeric, 
                @aParentSanadID numeric, 
                @aCode_Col numeric, 
                @aCode_Moein numeric, 
                @Code_Tafzili numeric, 
                @Des varchar(1000), 
                @Mab_Bed numeric, 
                @Mab_Bes numeric,  
                @FactorID numeric 
            AS 
            BEGIN
                SET NOCOUNT ON;
                declare @RowNum int 
                select @RowNum=max(RowNum) from Sanad where ParentSanadCode=@aParentSanadID 
                set @RowNum=isnull(@RowNum,0)+1  
                
                insert into Sanad(NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil, OtherSharh, Mab_Bed, Mab_Bes, Code_Op, Date_Op, Time_Op, RowNum, FactorID) 
                Values(@aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Mab_Bed, @Mab_Bes, -1, dbo.GetMToSDate(getdate()), getdate(), @RowNum, @FactorID) 
                
                update Sanad set Meghdar = 0 where meghdar is null
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[GetStockDescript]  
                @aSumDes varchar(5000) ='' output
            AS
            BEGIN
                SET NOCOUNT ON;
                Declare @aTemp varchar(5000), @aTemp2 varchar(250), @aCount int, @aIndex int
                select @aCount = Count(distinct [Des]) from Stock_Factor_VIEW
                
                if @aCount >100 
                    set @aCount = 100
                    
                set @aIndex = 1
                set @aTemp = ''
                
                DECLARE MyCursor Cursor for Select Distinct top 100 [Des] From Stock_Factor_VIEW
                Open myCursor
                fetch myCursor into @aTemp2
                
                while @aIndex <=@aCount
                begin 
                    set @aTemp = @aTemp + @aTemp2 + char(13) 
                    set @aIndex = @aIndex + 1 
                    fetch myCursor into @aTemp2 
                end
                
                CLOSE myCursor
                DEALLOCATE myCursor
                set @aSumDes = @aTemp
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Save_Factor_Sanad] 
                @FactorKind int, 
                @aNo_Sanad numeric, 
                @FactorID numeric,
                @TAX_Tax numeric(10,3), 
                @TAX_Avarez numeric(10,3), 
                @BuyDis nvarchar(250), 
                @SelsDis nvarchar(250)
            AS
            BEGIN
                SET NOCOUNT ON;
                BEGIN TRANSACTION;
                
                DECLARE @SharhSanad nvarchar(200), @aParentSanadID numeric, @aDateIN varchar(20), @aNow varchar(20),
                @aCode_Col numeric, @aCode_Moein numeric, @Code_Tafzili numeric, @Des varchar(1000), @FactorNo numeric,
                @Discount numeric, @TAX numeric, @Tax_Error numeric, @ArticleID numeric, @Cost_T numeric, @ArticleCount numeric,
                @ArticleName varchar(500), @UnitName varchar(50), @KindCash int,
                @FinalCost numeric, @Mab_Bed numeric, @Mab_Bes numeric, @HesabNameTaf nvarchar(200), @TafziliCode_ForTax numeric = 0; 
                
                SELECT @Code_Tafzili = CodeTafzil, @aDateIN = Date_IN, @FactorNo = NoFactor FROM FactorParent WHERE ID = @FactorID;
                SELECT @FinalCost = SUM(FinallCost), @TAX = SUM(ISNULL(TAX,0)), @Discount = SUM(ISNULL(Discount,0)) FROM FactorDetail_VIEW WHERE FactorParentID = @FactorID;
                
                select top 1 @HesabNameTaf = HesabName, @KindCash = ISNULL(CashOK, 0) + (ISNULL(CashUnOK, 0) * 2) from FactorDetail_VIEW where FactorParentID=@FactorID
                
                SET @SharhSanad = CASE @FactorKind 
                    WHEN 0 THEN ISNULL(NULLIF(@BuyDis, ''), N'خرید کالا فاکتور شماره ' + CAST(@FactorNo AS VARCHAR(20))) 
                    WHEN 1 THEN ISNULL(NULLIF(@SelsDis, ''), N'فروش کالا فاکتور شماره ' + CAST(@FactorNo AS VARCHAR(20)))
                    WHEN 2 THEN N'برگشت از خرید فاکتور شماره ' + CAST(@FactorNo AS VARCHAR(20))
                    WHEN 3 THEN N'برگشت از فروش فاکتور شماره ' + CAST(@FactorNo AS VARCHAR(20))
                END;
                
                SET @aNow = dbo.GetMToSDate(GETDATE()); 
                
                IF ISNULL(@aNo_Sanad, 0) = 0
                BEGIN
                    SELECT @aNo_Sanad = ISNULL(MAX(No_Sanad), 0) + 1 FROM ParentSanad;
                    INSERT INTO ParentSanad(NO_Sanad, Date_IN, Vazeit, OtherParentSharh, Code_Op, Date_Op, Time_Op)
                    VALUES(@aNo_Sanad, @aDateIN, 0, @SharhSanad, -1, @aNow, GETDATE());
                    SET @aParentSanadID = SCOPE_IDENTITY();
                END
                ELSE 
                    SELECT @aParentSanadID = ParentSanadID FROM ParentSanad WHERE No_Sanad = @aNo_Sanad;
                    
                DELETE FROM Sanad WHERE FactorID = @FactorID;
                UPDATE FactorParent SET Parent_Sanad_ID = @aParentSanadID WHERE ID = @FactorID;
                
                -- 1. ثبت طرف حساب
                SELECT @aCode_Col = Code_Col, @aCode_Moein = Code_Moein FROM ConstHesabs_View
                WHERE Type = CASE @FactorKind WHEN 0 THEN 19 WHEN 1 THEN 18 WHEN 2 THEN 19 WHEN 3 THEN 18 END;
                
                SET @Mab_Bed = CASE WHEN @FactorKind IN (1, 2) THEN @FinalCost ELSE 0 END;
                SET @Mab_Bes = CASE WHEN @FactorKind IN (0, 3) THEN @FinalCost ELSE 0 END;
                SET @Des= CASE @FactorKind WHEN 0 THEN N'خرید ' WHEN 1 THEN N'فروش ' WHEN 2 THEN N'برگشت از خرید ' WHEN 3 THEN N'برگشت از فروش ' end + N' بشماره '+ cast(@FactorNo as varchar(20))
                
                EXEC Insert_Sanad @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Mab_Bed, @Mab_Bes, @FactorID;
                
                -- 2. ثبت اقلام کالا
                DECLARE cur CURSOR FOR SELECT ArticleID, CostItem, ArticleName, ArticleUnitName, ArticleCount FROM FactorDetail_VIEW WHERE FactorParentID = @FactorID;
                OPEN cur; 
                FETCH NEXT FROM cur INTO @ArticleID, @Cost_T, @ArticleName, @UnitName, @ArticleCount;
                
                WHILE @@FETCH_STATUS = 0
                BEGIN
                    SELECT @aCode_Col = CASE @FactorKind WHEN 0 THEN Code_Col_Buy WHEN 1 THEN Code_Col WHEN 2 THEN Code_Col_ReBuy WHEN 3 THEN Code_Col_ReSale END,
                    @aCode_Moein = CASE @FactorKind WHEN 0 THEN Code_Moein_Buy WHEN 1 THEN Code_Moein WHEN 2 THEN Code_Moein_ReBuy WHEN 3 THEN Code_Moein_ReSale END,
                    @Code_Tafzili = CASE @FactorKind WHEN 0 THEN Code_Tafzil_Buy WHEN 1 THEN Code_Tafzil WHEN 2 THEN Code_Tafzil_ReBuy WHEN 3 THEN Code_Tafzil_ReSale END
                    FROM ArticleNew WHERE ID = @ArticleID;
                    
                    if @Code_Tafzili = 0 
                        SELECT @Code_Tafzili = CodeTafzil FROM FactorParent WHERE ID = @FactorID
                        
                    SELECT @Code_Tafzili = CASE WHEN h.HasTafzili = 1 THEN @Code_Tafzili ELSE 0 END
                    FROM Hesab_VIEW h
                    WHERE h.Code_Col = @aCode_Col AND h.Code_Moein = @aCode_Moein;
                    
                    SET @Mab_Bed = CASE WHEN @FactorKind IN (0, 3) THEN @Cost_T ELSE 0 END;
                    SET @Mab_Bes = CASE WHEN @FactorKind IN (1, 2) THEN @Cost_T ELSE 0 END;
                    SET @Des= CASE @FactorKind WHEN 0 THEN N'خرید ' WHEN 1 THEN N'فروش ' WHEN 2 THEN N'برگشت از خرید ' WHEN 3 THEN N'برگشت از فروش ' end
                    + cast(@ArticleCount as varchar(20)) + ' ' + isnull(@UnitName,'') + ' ' + isnull(@ArticleName,'') + N' طی فاکتور ' + cast(@FactorNo as varchar(20))    
                    
                    EXEC Insert_Sanad_Factor @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Mab_Bed, @Mab_Bes, @FactorID, @ArticleCount;
                    
                    FETCH NEXT FROM cur INTO @ArticleID, @Cost_T, @ArticleName, @UnitName, @ArticleCount;
                END
                CLOSE cur; DEALLOCATE cur;
                
                -- 3. ثبت تخفیف
                IF @Discount <> 0
                BEGIN
                    SELECT @aCode_Col = Code_Col, @aCode_Moein = Code_Moein FROM ConstHesabs_View 
                    WHERE Type = CASE @FactorKind WHEN 0 THEN 3 WHEN 1 THEN 7 WHEN 2 THEN 4 WHEN 3 THEN 8 END;
                    
                    SELECT @Code_Tafzili = CodeTafzil FROM FactorParent WHERE ID = @FactorID
                    SELECT @Code_Tafzili = CASE WHEN h.HasTafzili = 1 THEN @Code_Tafzili ELSE 0 END
                    FROM Hesab_VIEW h
                    WHERE h.Code_Col = @aCode_Col AND h.Code_Moein = @aCode_Moein;
                    
                    SET @Mab_Bed = CASE WHEN @FactorKind IN (1, 2) THEN @Discount ELSE 0 END;
                    SET @Mab_Bes = CASE WHEN @FactorKind IN (0, 3) THEN @Discount ELSE 0 END;
                    SET @Des=N' بابت تخفیفات اعطایی فاکتور '+ 
                    CASE @FactorKind 
                        WHEN 0 THEN N'خرید ' 
                        WHEN 1 THEN N'فروش ' 
                        WHEN 2 THEN N'برگشت از خرید ' 
                        WHEN 3 THEN N'برگشت از فروش ' 
                        end + N' بشماره '+cast(@FactorNo as varchar(20)) + ' ' + ISNULL(@HesabNameTaf, '')
                    
                    EXEC Insert_Sanad @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Mab_Bed, @Mab_Bes, @FactorID;
                END
                
                -- 4. ثبت مالیات
                IF ISNULL(@TAX, 0) > 0 AND (@TAX_Tax + @TAX_Avarez) > 0
                BEGIN
                    DECLARE @Tax_Val numeric(18,0), @Avarez_Val numeric(18,0);
                    SET @Tax_Val = ROUND(@TAX * (@TAX_Tax / (@TAX_Tax + @TAX_Avarez)), 0);
                    SET @Avarez_Val = @TAX - @Tax_Val;
                    SELECT @Code_Tafzili = CodeTafzil FROM FactorParent WHERE ID = @FactorID;
                    
                    -- الف) ثبت ردیف مالیات ارزش افزوده
                    if @KindCash = 1
                        SELECT TOP 1 @aCode_Col = Code_Col, @aCode_Moein = Code_Moein FROM ConstHesabs_View WHERE Type = CASE WHEN @FactorKind IN (0, 2) THEN 27 ELSE 29 END;
                    if @KindCash = 2
                        SELECT TOP 1 @aCode_Col = Code_Col, @aCode_Moein = Code_Moein FROM ConstHesabs_View WHERE Type = CASE WHEN @FactorKind IN (0, 2) THEN 32 ELSE 34 END;
                        
                    SELECT @TafziliCode_ForTax = CASE WHEN h.HasTafzili = 1 THEN @Code_Tafzili ELSE 0 END
                    FROM Hesab_VIEW h
                    WHERE h.Code_Col = @aCode_Col AND h.Code_Moein = @aCode_Moein;
                    
                    SET @Des = N'مالیات بر ارزش افزوده فاکتور ' + 
                    CASE @FactorKind WHEN 0 THEN N'خرید ' 
                                     WHEN 1 THEN N'فروش ' 
                                     WHEN 2 THEN N'برگشت از خرید ' 
                                     WHEN 3 THEN N'برگشت از فروش ' end + N' بشماره '+ CAST(@FactorNo AS VARCHAR(20)) + ' ' + ISNULL(@HesabNameTaf, '');
                    SET @Mab_Bed = CASE WHEN @FactorKind IN (0, 3) THEN @Tax_Val ELSE 0 END;
                    SET @Mab_Bes = CASE WHEN @FactorKind IN (1, 2) THEN @Tax_Val ELSE 0 END;
                    
                    IF @Mab_Bed <> 0 OR @Mab_Bes <> 0
                        EXEC Insert_Sanad @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @TafziliCode_ForTax, @Des, @Mab_Bed, @Mab_Bes, @FactorID;
                        
                    -- ب) ثبت ردیف عوارض ارزش افزوده
                    if @KindCash = 1
                        SELECT TOP 1 @aCode_Col = Code_Col, @aCode_Moein = Code_Moein FROM ConstHesabs_View WHERE Type = CASE WHEN @FactorKind IN (0, 2) THEN 26 ELSE 28 END;
                    if @KindCash = 2
                        SELECT TOP 1 @aCode_Col = Code_Col, @aCode_Moein = Code_Moein FROM ConstHesabs_View WHERE Type = CASE WHEN @FactorKind IN (0, 2) THEN 31 ELSE 33 END;
                        
                    SELECT @TafziliCode_ForTax = CASE WHEN h.HasTafzili = 1 THEN @Code_Tafzili ELSE 0 END
                    FROM Hesab_VIEW h
                    WHERE h.Code_Col = @aCode_Col AND h.Code_Moein = @aCode_Moein;
                    
                    SET @Des = N'عوارض بر ارزش افزوده فاکتور ' + 
                    CASE @FactorKind WHEN 0 THEN N'خرید ' 
                                     WHEN 1 THEN N'فروش ' 
                                     WHEN 2 THEN N'برگشت از خرید ' 
                                     WHEN 3 THEN N'برگشت از فروش ' 
                                    end + N' بشماره '+ CAST(@FactorNo AS VARCHAR(20)) + ' ' + ISNULL(@HesabNameTaf, '');
                    SET @Mab_Bed = CASE WHEN @FactorKind IN (0, 3) THEN @Avarez_Val ELSE 0 END;
                    SET @Mab_Bes = CASE WHEN @FactorKind IN (1, 2) THEN @Avarez_Val ELSE 0 END;
                    
                    IF @Mab_Bed <> 0 OR @Mab_Bes <> 0
                        EXEC Insert_Sanad @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @TafziliCode_ForTax, @Des, @Mab_Bed, @Mab_Bes, @FactorID;
                END
                
                IF @@Error = 0 
                BEGIN 
                    COMMIT TRANSACTION;
                    RETURN(1); 
                END
                ELSE
                BEGIN 
                    ROLLBACK TRANSACTION;
                    RETURN(0); 
                END
            END;
            """,
                        // ============================================================
            // Procedures — بخش دوم (سند فاکتور، انبار، اسناد موقت)
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.Insert_Sanad_Factor', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Insert_Sanad_Factor];
            IF OBJECT_ID(N'dbo.Insert_Sanad_Marketer', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Insert_Sanad_Marketer];
            IF OBJECT_ID(N'dbo.Save_Factor_SanadMarketer', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Save_Factor_SanadMarketer];
            IF OBJECT_ID(N'dbo.Insert_Sanad_Stock', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Insert_Sanad_Stock];
            IF OBJECT_ID(N'dbo.Save_Stock_Sanad', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Save_Stock_Sanad];
            IF OBJECT_ID(N'dbo.InsertLogUser', N'P') IS NOT NULL DROP PROCEDURE [dbo].[InsertLogUser];
            IF OBJECT_ID(N'dbo.SaveFactor', N'P') IS NOT NULL DROP PROCEDURE [dbo].[SaveFactor];
            IF OBJECT_ID(N'dbo.OpenFactor', N'P') IS NOT NULL DROP PROCEDURE [dbo].[OpenFactor];
            IF OBJECT_ID(N'dbo.SaveFactor_FromStock', N'P') IS NOT NULL DROP PROCEDURE [dbo].[SaveFactor_FromStock];
            IF OBJECT_ID(N'dbo.Save_Sanad_Movaghat', N'P') IS NOT NULL DROP PROCEDURE [dbo].[Save_Sanad_Movaghat];
            IF OBJECT_ID(N'dbo.UpDate_Article', N'P') IS NOT NULL DROP PROCEDURE [dbo].[UpDate_Article];
            """,

            """
            CREATE PROCEDURE [dbo].[Insert_Sanad_Factor]    
                @aNo_Sanad numeric, 
                @aParentSanadID numeric, 
                @aCode_Col numeric, 
                @aCode_Moein numeric, 
                @Code_Tafzili numeric, 
                @Des varchar(1000), 
                @Mab_Bed numeric, 
                @Mab_Bes numeric,  
                @FactorID numeric, 
                @MeghdarID numeric  
            AS
            BEGIN
                SET NOCOUNT ON;
                declare @RowNum int
                select @RowNum=max(RowNum) from Sanad where ParentSanadCode=@aParentSanadID
                set @RowNum=isnull(@RowNum,0)+1
                
                insert into Sanad(NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil, OtherSharh, Mab_Bed, Mab_Bes, Code_Op, Date_Op, Time_Op, RowNum, FactorID, Meghdar)
                Values(@aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Mab_Bed, @Mab_Bes, -1, dbo.GetMToSDate(getdate()), getdate(), @RowNum, @FactorID, @MeghdarID)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Insert_Sanad_Marketer]  
                @aNo_Sanad numeric, 
                @aParentSanadID numeric, 
                @aCode_Col numeric, 
                @aCode_Moein numeric, 
                @Code_Tafzili numeric, 
                @Des varchar(1000), 
                @Mab_Bed numeric, 
                @Mab_Bes numeric,  
                @FactorID numeric 
            AS
            BEGIN
                SET NOCOUNT ON;
                declare @RowNum int
                select @RowNum=max(RowNum) from Sanad where ParentSanadCode=@aParentSanadID
                set @RowNum=isnull(@RowNum,0)+1
                
                insert into Sanad(NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil, OtherSharh, Mab_Bed, Mab_Bes, Code_Op, Date_Op, Time_Op, RowNum, MarketerFactorID)
                Values(@aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Mab_Bed, @Mab_Bes, -1, dbo.GetMToSDate(getdate()), getdate(), @RowNum, @FactorID)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Save_Factor_SanadMarketer] 
                @FactorKind int, 
                @aNo_Sanad numeric, 
                @FactorID numeric
            AS
            BEGIN
                SET NOCOUNT ON;
                declare @SharhSand nvarchar(200), @aParentSanadID numeric, @aDateIN varchar(20), @aNow varchar(20),
                @aCode_Col numeric, @aCode_Moein numeric, @Code_Tafzili numeric, @Des varchar(1000),
                @Mab_Bed numeric, @Mab_Bes numeric, @RowNum int, @FactorNo numeric, @MarketerCosts numeric
                
                select @Code_Tafzili=CodeTaf_Marketer, @aDateIN=Date_IN, @FactorNo= NoFactor
                from FactorParent where ID= @FactorID
                
                set @aNow=dbo.GetMToSDate(getdate())
                
                if @FactorKind = 0
                    set @SharhSand = N'ثبت سند بازاریابی خرید به شرح سند'
                if @FactorKind = 1
                    set @SharhSand = N'ثبت سند بازاریابی فروش به شرح سند'
                    
                if isnull(@aNo_Sanad,0)=0
                begin
                    select @aNo_Sanad = isnull(max(No_Sanad),0) + 1 from ParentSanad
                    insert into ParentSanad(NO_Sanad, Date_IN, Vazeit, OtherParentSharh, Code_Op, Date_Op, Time_Op)
                    Values(@aNo_Sanad, @aDateIN, 0, @SharhSand, -1, @aNow, getdate())
                    set @aParentSanadID=SCOPE_IDENTITY()
                end
                else
                    select @aParentSanadID=ParentSanadID from ParentSanad where No_Sanad=@aNo_Sanad
                    
                delete from Sanad where MarketerFactorID=@FactorID
                update FactorParent set NoSanad_ID_Marketer=@aParentSanadID where ID = @FactorID
                
                select @MarketerCosts= sum(MarketerCosts)
                from FactorDetail_VIEW where FactorParentID=@FactorID
                
                select top 1 @aCode_Col= Code_Col, @aCode_Moein= Code_Moein from ConstHesabs_View where Type=30
                set @Des=N'هزینه بازاریابی فاکتور فروش بشماره ' + cast(@FactorNo as varchar(20))
                set @Mab_Bed= @MarketerCosts
                set @Mab_Bes=0
                
                exec Insert_Sanad_Marketer @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, 0, @Des, @Mab_Bed, @Mab_Bes, @FactorID
                
                select top 1 @aCode_Col= Code_Col, @aCode_Moein= Code_Moein from ConstHesabs_View where Type=19
                set @Des=N'هزینه بازاریابی فاکتور فروش بشماره ' + cast(@FactorNo as varchar(20))
                set @Mab_Bed= 0
                set @Mab_Bes=@MarketerCosts
                
                exec Insert_Sanad_Marketer @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Mab_Bed, @Mab_Bes, @FactorID
                
                if @@Error = 0
                    return(1)
                else
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Insert_Sanad_Stock]    
                @aNo_Sanad numeric, 
                @aParentSanadID numeric, 
                @aCode_Col numeric, 
                @aCode_Moein numeric, 
                @Code_Tafzili numeric, 
                @Des varchar(1000), 
                @Mab_Bed numeric, 
                @Mab_Bes numeric,  
                @StockID numeric, 
                @MeghdarID numeric  
            AS
            BEGIN
                SET NOCOUNT ON;
                DECLARE @RowNum int;
                BEGIN TRANSACTION;
                SELECT @RowNum = ISNULL(MAX(RowNum), 0) + 1
                FROM Sanad WITH (UPDLOCK, HOLDLOCK)
                WHERE ParentSanadCode = @aParentSanadID;
                COMMIT TRANSACTION;
                
                INSERT INTO Sanad (NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil, OtherSharh, Mab_Bed, Mab_Bes, Code_Op, Date_Op, Time_Op, RowNum, StockNo, Meghdar)
                VALUES (@aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Mab_Bed, @Mab_Bes, -1, dbo.GetMToSDate(GETDATE()), GETDATE(), @RowNum, @StockID, @MeghdarID);
                
                IF @@ERROR = 0
                    RETURN 1
                ELSE
                    RETURN 0
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Save_Stock_Sanad] 
                @StockKind int, 
                @aNo_Sanad numeric, 
                @StockID numeric 
            AS
            BEGIN
                SET NOCOUNT ON;
                DECLARE @aParentSanadID numeric, @aDateIN varchar(20), @aNow varchar(20),
                        @StockNo numeric, @StokName nvarchar(150), @FinalAmount money,
                        @aCode_Col_Hesab numeric, @aCode_Moein_Hesab numeric,
                        @Des varchar(1000), @RowNum int;
                        
                SELECT TOP 1 @aDateIN = DateIN, @StockNo = SpecialCode, @StokName = StockTypeName
                FROM Stock_Factor_VIEW 
                WHERE ID = @StockID;
                
                SET @aNow = dbo.GetMToSDate(GETDATE());
                
                IF ISNULL(@aNo_Sanad, 0) = 0
                BEGIN
                    SELECT @aNo_Sanad = ISNULL(MAX(No_Sanad), 0) + 1 FROM ParentSanad;
                    INSERT INTO ParentSanad (NO_Sanad, Date_IN, Vazeit, OtherParentSharh, Code_Op, Date_Op, Time_Op)
                    VALUES (@aNo_Sanad, @aDateIN, 0, 
                            CASE @StockKind WHEN 0 THEN N'سند رسید' 
                                            WHEN 1 THEN N'سند حواله' 
                                            WHEN 2 THEN N'سند برگشتی' 
                                            ELSE N'سند انبار' END,
                            -1, @aNow, GETDATE());
                    SET @aParentSanadID = SCOPE_IDENTITY();
                END
                ELSE
                BEGIN
                    SELECT @aParentSanadID = ParentSanadID FROM ParentSanad WHERE No_Sanad = @aNo_Sanad;
                END
                
                DELETE FROM Sanad WHERE StockNo = @StockID;
                UPDATE Stock_Factor SET Parent_Sanad_ID = @aParentSanadID WHERE ID = @StockID AND Kind = @StockKind;
                
                SELECT @RowNum = ISNULL(MAX(RowNum), 0) FROM Sanad WHERE ParentSanadCode = @aParentSanadID;
                
                DECLARE @TempItems TABLE (
                    RowNum int IDENTITY(1,1),
                    ArticleID numeric,
                    Amount money,
                    ArticleName varchar(500),
                    UnitName varchar(50),
                    Val float
                );
                
                INSERT INTO @TempItems (ArticleID, Amount, ArticleName, UnitName, Val)
                SELECT SFM.ArticleID, ISNULL(SFM.Val, 0) * ISNULL(SFM.Cost, 0) AS Amount, AN.Name, AU.Name,
                        SFM.Val
                FROM Stock_Factor_Mat SFM
                INNER JOIN ArticleNew AN ON AN.ID = SFM.ArticleID
                LEFT JOIN ArticleUnit AU ON AU.ID = AN.ArticleUnitID
                WHERE SFM.StockFacorID = @StockID;
                
                DECLARE @i int = 1, @Count int;
                SELECT @Count = COUNT(*) FROM @TempItems;
                
                DECLARE @ArticleID numeric, @Cost_T money, @ArticleName varchar(500),
                        @UnitName varchar(50), @ArticleCount float,
                        @aCode_Col numeric, @aCode_Moein numeric, @Code_Tafzili numeric;
                        
                IF @StockKind = 0
                BEGIN
                    WHILE @i <= @Count
                    BEGIN
                        SELECT @ArticleID = ArticleID, @Cost_T = Amount, @ArticleName = ArticleName, @UnitName = UnitName, @ArticleCount = Val
                        FROM @TempItems WHERE RowNum = @i;
                        
                        SELECT TOP 1 @aCode_Col = ISNULL(AN.Code_Col_Buy, SF.Code_Col),
                                      @aCode_Moein = ISNULL(AN.Code_Moein_Buy, SF.Code_Moein),
                                      @Code_Tafzili = ISNULL(AN.Code_Tafzil_Buy, SF.Code_Tafzil)
                        FROM ArticleNew AN
                        CROSS JOIN Stock_Factor_VIEW SF
                        WHERE AN.ID = @ArticleID AND SF.ID = @StockID;
                        
                        SET @Des = N'ورود به ' + @StokName + N' به شماره رسید ' + 
                                    CAST(@StockNo AS VARCHAR(20)) + 
                                   N' به تعداد ' + CAST(@ArticleCount AS VARCHAR(20)) + ' ' + ISNULL(@UnitName, '') + 
                                   N' بابت کالای ' + ISNULL(@ArticleName, '');
                                   
                        SET @RowNum = @RowNum + 1;
                        
                        EXEC Insert_Sanad_Stock @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Cost_T, 0, @StockID, @ArticleCount;
                        
                        SET @i = @i + 1;
                    END
                    
                    SELECT @FinalAmount = SUM(Amount) FROM Stock_Factor_All_VIEW WHERE ID = @StockID AND Kind = @StockKind GROUP BY SpecialCode, DateIn;
                    
                    SELECT TOP 1 @aCode_Col_Hesab = Code_Col, @aCode_Moein_Hesab = Code_Moein
                    FROM ConstHesabs_View WHERE Type = 19;
                    
                    SET @RowNum = @RowNum + 1;
                    SET @Des = N'ورود کالا به ' + @StokName + N' طبق شماره رسید ' + CAST(@StockNo AS VARCHAR(20));
                    
                    EXEC Insert_Sanad_Stock @aNo_Sanad, @aParentSanadID, @aCode_Col_Hesab, @aCode_Moein_Hesab, 0, @Des, 0, @FinalAmount, @StockID, 0;
                END
                
                ELSE IF @StockKind = 1
                BEGIN
                    SELECT @FinalAmount = SUM(Amount) FROM Stock_Factor_All_VIEW WHERE ID = @StockID AND Kind = @StockKind GROUP BY SpecialCode, DateIn;
                    
                    SELECT TOP 1 @aCode_Col_Hesab = Code_Col, @aCode_Moein_Hesab = Code_Moein
                    FROM ConstHesabs_View WHERE Type = 25;
                    
                    SET @RowNum = @RowNum + 1;
                    SET @Des = N'خروج کالا به ' + @StokName + N' طبق شماره حواله ' + CAST(@StockNo AS VARCHAR(20));
                    
                    EXEC Insert_Sanad_Stock @aNo_Sanad, @aParentSanadID, @aCode_Col_Hesab, @aCode_Moein_Hesab, 0, @Des, @FinalAmount, 0, @StockID, 0;
                    
                    SET @i = 1;
                    WHILE @i <= @Count
                    BEGIN
                        SELECT @ArticleID = ArticleID, @Cost_T = Amount, @ArticleName = ArticleName, @UnitName = UnitName, @ArticleCount = Val
                        FROM @TempItems WHERE RowNum = @i;
                        
                        SELECT TOP 1 @aCode_Col = ISNULL(AN.Code_Col, SF.Code_Col),
                                      @aCode_Moein = ISNULL(AN.Code_Moein, SF.Code_Moein),
                                      @Code_Tafzili = ISNULL(AN.Code_Tafzil, SF.Code_Tafzil)
                        FROM ArticleNew AN
                        CROSS JOIN Stock_Factor_VIEW SF
                        WHERE AN.ID = @ArticleID AND SF.ID = @StockID;
                        
                        SET @Des = N'خروج به ' + @StokName + N' به شماره حواله ' + CAST(@StockNo AS VARCHAR(20)) + 
                                   N' به تعداد ' + CAST(@ArticleCount AS VARCHAR(20)) + ' ' + ISNULL(@UnitName, '') + 
                                   N' بابت کالای ' + ISNULL(@ArticleName, '');
                                   
                        SET @RowNum = @RowNum + 1;
                        
                        EXEC Insert_Sanad_Stock @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, 0, @Cost_T, @StockID, @ArticleCount;
                        
                        SET @i = @i + 1;
                    END
                END
                
                ELSE IF @StockKind = 2
                BEGIN
                    WHILE @i <= @Count
                    BEGIN
                        SELECT @ArticleID = ArticleID, @Cost_T = Amount, @ArticleName = ArticleName, @UnitName = UnitName, @ArticleCount = Val
                        FROM @TempItems WHERE RowNum = @i;
                        
                        SELECT TOP 1 @aCode_Col = ISNULL(AN.Code_Col_ReSale, SF.Code_Col),
                                      @aCode_Moein = ISNULL(AN.Code_Moein_ReSale, SF.Code_Moein),
                                      @Code_Tafzili = ISNULL(AN.Code_Tafzil_ReSale, SF.Code_Tafzil)
                        FROM ArticleNew AN
                        CROSS JOIN Stock_Factor_VIEW SF
                        WHERE AN.ID = @ArticleID AND SF.ID = @StockID;
                        
                        SET @Des = N'ورود به ' + @StokName + N' به شماره برگشتی ' + CAST(@StockNo AS VARCHAR(20)) + 
                                   N' به تعداد ' + CAST(@ArticleCount AS VARCHAR(20)) + ' ' + ISNULL(@UnitName, '') + 
                                   N' بابت کالای ' + ISNULL(@ArticleName, '');
                                   
                        SET @RowNum = @RowNum + 1;
                        
                        EXEC Insert_Sanad_Stock @aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Des, @Cost_T, 0, @StockID, @ArticleCount;
                        
                        SET @i = @i + 1;
                    END
                    
                    SELECT @FinalAmount = SUM(Amount) FROM Stock_Factor_All_VIEW WHERE ID = @StockID AND Kind = @StockKind GROUP BY SpecialCode, DateIn;
                    
                    SELECT TOP 1 @aCode_Col_Hesab = Code_Col, @aCode_Moein_Hesab = Code_Moein
                    FROM ConstHesabs_View WHERE Type = 19;
                    
                    SET @RowNum = @RowNum + 1;
                    SET @Des = N'ورود کالا به ' + @StokName + N' طبق شماره برگشتی ' + CAST(@StockNo AS VARCHAR(20));
                    
                    EXEC Insert_Sanad_Stock @aNo_Sanad, @aParentSanadID, @aCode_Col_Hesab, @aCode_Moein_Hesab, 0, @Des, 0, @FinalAmount, @StockID, 0;
                END
                
                IF @@ERROR = 0
                    RETURN 1
                ELSE
                    RETURN 0
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[InsertLogUser]  
                @ComputerName varchar(50), 
                @Dis varchar(300), 
                @UserCode varchar(1)
            AS
            BEGIN
                SET NOCOUNT ON;
                Insert into [Log](Discript, CuName, Code_Op, Date_Op, Time_Op)
                Values(@Dis, @ComputerName, @UserCode, dbo.GetMToSDate(getdate()), Right(GetDate(), 8))
                
                if @@Error = 0
                    return(1)
                else
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[SaveFactor]  
                @FactorID numeric OUTPUT, 
                @IDTemp numeric,  
                @ComputerName varchar(50) 
            AS 
            BEGIN
                SET NOCOUNT ON;
                Declare @NoFactor numeric
                set @NoFactor = 0
                
                select @NoFactor = NoFactor from FactorParentTemp where ID = @IDTemp
                
                if IsNull(@NoFactor,0) = 0
                begin
                    select @NoFactor = Max(NoFactor) from FactorParent
                    set @NoFactor = IsNull(@NoFactor,0) + 1
                end
                
                if @FactorID = 0
                begin
                    insert into FactorParent (NoFactor, Date_In, Descript, FactorKind, IsCaSh, Cost, CodeTafzil, Per_Ok, StockID, NoFactor_Per, CodeTaf_Marketer, TransCost, CarInfo)
                    select @NoFactor, Date_In, Descript, FactorKind, IsCaSh, Cost, CodeTafzil, Per_Ok, StockID, NoFactor_Per, CodeTaf_Marketer, TransCost, CarInfo  
                    from FactorParentTemp where ID = @IDTemp
                    set @FactorID = SCOPE_IDENTITY()
                end
                else
                begin
                    update FactorParent set
                    NoFactor = @NoFactor,
                    Date_In = P.Date_In,
                    Descript = P.Descript,
                    FactorKind = P.FactorKind,
                    IsCaSh = P.IsCaSh,
                    Cost = P.Cost,
                    CodeTafzil = P.CodeTafzil,
                    NoFactor_Per = P.NoFactor_Per,
                    Per_Ok = P.Per_Ok,
                    StockID = P.StockID,
                    CodeTaf_Marketer = P.CodeTaf_Marketer,
                    TransCost = P.TransCost,
                    CarInfo = P.CarInfo
                    from FactorParentTemp as P
                    where FactorParent.ID = @FactorID and P.ID = @IDTemp
                end
                
                Delete from FactorDetail where FactorID = @FactorID
                
                insert into FactorDetail(FactorID, ArticleID, ArticleCount, Cost, IncCost, Discount, PerDiscount, Tax, StockID, MarketerPercent, MarketerCosts, TransCost, DegreeKala, DropKala, TaxFi)
                SELECT @FactorID, ArticleID, ArticleCount, Cost, IncCost, Discount, PerDiscount, Tax, StockID, MarketerPercent, MarketerCosts, TransCost, DegreeKala, DropKala, TaxFi
                FROM FactorDetailTemp where ComputerName = @ComputerName
                
                if @@Error = 0
                    return(1)
                else
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[OpenFactor]  
                @FactorID numeric, 
                @ComputerName varchar(50) 
            AS
            BEGIN
                SET NOCOUNT ON;
                Delete from FactorParentTemp where ComputerName = @ComputerName
                
                insert into FactorParentTemp(NoFactor, Date_In, Descript, FactorKind, IsCaSh, Cost, CodeTafzil,
                ComputerName, Parent_Sanad_ID, NoSanad_ID_Marketer, Per_OK, StockID, NoFactor_Per, CodeTaf_Marketer, TransCost, CarInfo)
                select NoFactor, Date_In, Descript, FactorKind, IsCaSh, Cost, CodeTafzil, @ComputerName,
                (select top 1 p.NO_Sanad from ParentSanad p where P.ParentSanadID = FactorParent.Parent_Sanad_ID),
                (select top 1 p.NO_Sanad from ParentSanad p where P.ParentSanadID = FactorParent.NoSanad_ID_Marketer),
                Per_OK, StockID, NoFactor_Per, CodeTaf_Marketer, TransCost, CarInfo  
                from FactorParent where ID = @FactorID
                
                delete from FactorDetailTemp where ComputerName = @ComputerName
                
                insert into FactorDetailTemp(FactorID, ArticleID, ArticleCount, ArticleName, ArticleUnit, Cost, IncCost, ArticleCode, Discount, PerDiscount, Tax, ComputerName, CostTax, CostFinall, CostItem, StockID, MarketerPercent, MarketerCosts, TransCost, DegreeKala, DropKala, TaxFi)
                SELECT FactorID, ArticleID, ArticleCount, ArticleName, ArticleUnitName, Cost, IncCost, ArticleCode, Discount, PerDiscount, Tax, @ComputerName, CostTax, FinallCost, CostItem, StockID, MarketerPercent, MarketerCosts, TransCost, DegreeKala, DropKala, TaxFi 
                FROM FactorDetail_View where FactorID = @FactorID
                
                if @@Error = 0
                    return(1)
                else
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[SaveFactor_FromStock]  
                @NoFactor numeric, 
                @StockID numeric, 
                @TafziliCode numeric
            AS
            BEGIN
                SET NOCOUNT ON;
                Declare @FactorID numeric, @FactorKind integer, @Desc Nvarchar(200)
                
                set @FactorID = 0
                Set @Desc = N'ثبت حواله انبار از فاکتور'
                
                select @FactorKind = Kind, @FactorID = isNull(FactorID,0) from dbo.Stock_Factor_VIEW where ID = @StockID
                
                if IsNull(@NoFactor,0) = 0
                begin
                    select @NoFactor = Max(NoFactor) from FactorParent where FactorKind=@FactorKind
                    set @NoFactor = IsNull(@NoFactor,0) + 1
                end
                else
                    select @FactorID = ID from FactorParent where FactorKind=@FactorKind And NoFactor = @NoFactor
                    
                if @FactorID = 0
                begin
                    insert into FactorParent (NoFactor, Date_In, Descript, FactorKind, IsCaSh, Cost, CodeTafzil, Per_Ok, StockID, NoFactor_Per)
                    select @NoFactor, DateIn, @Desc, @FactorKind, 0, 0, @TafziliCode, 0, @StockID, 0 from Stock_Factor_VIEW where ID = @StockID
                    set @FactorID = SCOPE_IDENTITY()
                end
                else
                begin
                    update FactorParent set StockID = P.ID
                    from Stock_Factor_VIEW as P
                    where FactorParent.ID = @FactorID and P.ID = @StockID
                end
                
                update dbo.Stock_Factor set FactorID=@FactorID, FactorCode = @NoFactor where ID = @StockID
                
                delete from FactorDetail where StockID = @StockID
                
                insert into FactorDetail(FactorID, ArticleID, ArticleCount, Cost, Discount, Tax, StockID)
                SELECT @FactorID, P.ArticleID, cast(P.Val as numeric(18,4)), cast(P.Cost as numeric(19,4)), 0, 0, P.StockFacorID
                FROM Stock_Factor_Mat_VIEW As P where P.StockFacorID = @StockID
                
                if @@Error = 0
                    return(1)
                else
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[Save_Sanad_Movaghat]  
                @ComputerName varchar(50), 
                @aDateIN varchar(20)
            AS
            BEGIN
                SET NOCOUNT ON;
                declare @aParentSanadID numeric, @aNo_Sanad numeric, @aNow varchar(20),
                @aCode_Col numeric, @aCode_Moein numeric, @Code_Tafzili numeric, @Code_Tafzili2 numeric, @Des varchar(1000),
                @Mab_Bed numeric, @Mab_Bes numeric, @RowNum int, @Tafzili2ID int, @CodeVahed numeric, @CodeHazine numeric, @CodeProject numeric
                
                set @aNow = dbo.GetMToSDate(getdate())
                select @aNo_Sanad = isnull(max(No_Sanad),0) + 1 from ParentSanad
                
                insert into ParentSanad(NO_Sanad, Date_IN, Vazeit, OtherParentSharh, Code_Op, Date_Op, Time_Op)
                Values(@aNo_Sanad, @aDateIN, 0, N'ثبت سند موقت', -1, @aNow, getdate())
                
                set @aParentSanadID = SCOPE_IDENTITY()
                
                delete from SanadMovaghat where Mab_Bes = 0 and Mab_Bed = 0 and cu = @ComputerName
                
                declare my_cur1 CURSOR FOR
                select Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, CodeVahed, CodeMarkazH, CodeProject, isNull(Mab_Bes,0), isNull(Mab_Bed,0)
                from SanadMovaghat where cu = @ComputerName order by Mab_Bed
                
                open my_cur1
                Fetch next from my_cur1 into @aCode_Col, @aCode_Moein, @Code_Tafzili, @Code_Tafzili2, @CodeVahed, @CodeHazine, @CodeProject, @Mab_Bed, @Mab_Bes
                
                while (@@FETCH_STATUS = 0)
                begin
                    select @RowNum=max(RowNum) from Sanad where ParentSanadCode=@aParentSanadID
                    set @RowNum=isnull(@RowNum,0)+1
                    
                    Select @Tafzili2ID =ID from Tafzili2 where Code =isnull(@Code_Tafzili2,0)
                    
                    insert into Sanad(NO_Sanad, ParentSanadCode, Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, Tafzili2ID, CodeVahed, CodeMarkazH, CodeProject, OtherSharh, Mab_Bed, Mab_Bes, Code_Op, Date_Op, Time_Op, RowNum, FactorID)
                    Values(@aNo_Sanad, @aParentSanadID, @aCode_Col, @aCode_Moein, @Code_Tafzili, @Code_Tafzili2, @Tafzili2ID, @CodeVahed, @CodeHazine, @CodeProject, N'بابت بستن حسابها موقت', @Mab_Bed, @Mab_Bes, -1, dbo.GetMToSDate(getdate()), getdate(), @RowNum, 0)
                    
                    Fetch next from my_cur1 into @aCode_Col, @aCode_Moein, @Code_Tafzili, @Code_Tafzili2, @CodeVahed, @CodeHazine, @CodeProject, @Mab_Bed, @Mab_Bes
                end
                
                close my_cur1
                deallocate my_cur1
                
                if @@Error = 0
                    return(1)
                else
                    return(0)
            END;
            """,

            """
            CREATE PROCEDURE [dbo].[UpDate_Article] 
            AS
            BEGIN
                SET NOCOUNT ON;
                DECLARE @aStoreCode As integer
                DECLARE @aGroupCode As integer
                DECLARE @aCodeNewKala As integer
                DECLARE @aIDKala As integer
                DECLARE @aStoreStrCode As varchar(3)
                DECLARE @aGroupStrCode As varchar(3)
                DECLARE @aDetailsStrCode As varchar(4)
                
                DECLARE StorList CURSOR FOR  
                SELECT StockTypeCode FROM dbo.ArticleLenCode_View 
                group by StockTypeCode Order by StockTypeCode
                
                open StorList
                FETCH NEXT FROM StorList into @aStoreCode
                
                while @@Fetch_Status = 0
                begin
                    DECLARE GrouKalaList CURSOR FOR  
                    SELECT ArticleGroupCode FROM dbo.ArticleLenCode_View 
                    WHERE StockTypeCode= @aStoreCode group by ArticleGroupCode Order by ArticleGroupCode 
                    
                    open GrouKalaList 
                    FETCH NEXT FROM GrouKalaList into @aGroupCode
                    set @aCodeNewKala = 1
                    
                    while @@Fetch_Status = 0
                    begin
                        DECLARE CodeKalaList CURSOR FOR  
                        SELECT ID, CodeStore, GroupCode FROM dbo.ArticleLenCode_View 
                        WHERE StockTypeCode= @aStoreCode and ArticleGroupCode=@aGroupCode Order by ID 
                        
                        open CodeKalaList
                        FETCH NEXT FROM CodeKalaList into @aIDKala, @aStoreStrCode, @aGroupStrCode
                        
                        while @@Fetch_Status = 0
                        begin
                            set @aDetailsStrCode = (case len(@aCodeNewKala) when 1 then '000'+CAST(@aCodeNewKala as Varchar(4))
                            when 2 then '00'+CAST(@aCodeNewKala as Varchar(4)) 
                            when 3 then '0'+CAST(@aCodeNewKala as Varchar(4))
                            when 4 then CAST(@aCodeNewKala as Varchar(4)) end)
                            
                            update ArticleNew set ArticleCoding = (@aStoreStrCode+''+@aGroupStrCode+''+@aDetailsStrCode),
                            CodingStore = @aStoreStrCode, CodingGroupStore = @aGroupStrCode,
                            Code = cast((@aStoreStrCode+''+@aGroupStrCode+''+@aDetailsStrCode) AS integer)
                            where id = @aIDKala
                            
                            set @aCodeNewKala = @aCodeNewKala + 1
                            FETCH NEXT FROM CodeKalaList into @aIDKala, @aStoreStrCode, @aGroupStrCode
                        end
                        
                        close CodeKalaList
                        deallocate CodeKalaList
                        set @aCodeNewKala = 1
                        
                        FETCH NEXT FROM GrouKalaList into @aGroupCode
                    end
                    
                    close GrouKalaList
                    deallocate GrouKalaList
                    
                    FETCH NEXT FROM StorList into @aStoreCode
                end
                
                close StorList
                deallocate StorList
                
                if @@Error = 0 
                    return(1)
                else
                    return(0)
            END;
            """,
                        // ============================================================
            // جداول سامانه مودیان (Moadian / Tax)
            // ============================================================
            """
            IF OBJECT_ID(N'dbo.tax_body', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[tax_body]( 
                    [id] [bigint] IDENTITY(1,1) NOT NULL,
                    [header_id] [bigint] NULL,
                    [stuff_id] [bigint] NULL,
                    [unit_id] [bigint] NULL,
                    [am] [float] NULL,
                    [nw] [float] NULL,
                    [fee] [bigint] NULL,
                    [cfee] [bigint] NULL,
                    [cut] [nvarchar](50) NULL,
                    [exr] [bigint] NULL,
                    [ssrv] [bigint] NULL,
                    [sscv] [bigint] NULL,
                    [prdis] [bigint] NULL,
                    [dis] [bigint] NULL,
                    [adis] [bigint] NULL,
                    [vra] [bigint] NULL,
                    [vam] [bigint] NULL,
                    [odt] [nvarchar](150) NULL,
                    [odr] [bigint] NULL,
                    [odam] [bigint] NULL,
                    [olt] [nvarchar](150) NULL,
                    [olr] [bigint] NULL,
                    [olam] [bigint] NULL,
                    [consfee] [bigint] NULL,
                    [spro] [bigint] NULL,
                    [bros] [bigint] NULL,
                    [tcpbs] [bigint] NULL,
                    [cop] [bigint] NULL,
                    [vop] [bigint] NULL,
                    [bsrn] [nvarchar](50) NULL,
                    [tsstam] [bigint] NULL,
                    CONSTRAINT [PK_tax_bodies] PRIMARY KEY CLUSTERED ([id] ASC) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.tax_erorr', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[tax_erorr]( 
                    [id] [bigint] IDENTITY(1,1) NOT NULL,
                    [header_id] [bigint] NOT NULL,
                    [msg] [nvarchar](250) NULL,
                    CONSTRAINT [PK_tax_erorrs] PRIMARY KEY CLUSTERED ([id] ASC) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.tax_header', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[tax_header]( 
                    [id] [bigint] IDENTITY(1,1) NOT NULL,
                    [taxid] [nvarchar](50) NULL, 
                    [indatim] [bigint] NULL, 
                    [indati2m] [bigint] NULL, 
                    [inty] [int] NULL, 
                    [inno] [bigint] NULL, 
                    [irtaxid] [nvarchar](50) NULL, 
                    [inp] [int] NULL, 
                    [ins] [int] NULL, 
                    [ft] [int] NULL, 
                    [scln] [nvarchar](50) NULL, 
                    [scc] [nvarchar](50) NULL, 
                    [cdcn] [nvarchar](50) NULL, 
                    [cdcd] [bigint] NULL, 
                    [crn] [nvarchar](50) NULL, 
                    [billid] [nvarchar](50) NULL, 
                    [tprdis] [bigint] NULL, 
                    [tdis] [bigint] NULL, 
                    [tadis] [bigint] NULL, 
                    [tvam] [bigint] NULL, 
                    [todam] [bigint] NULL, 
                    [tbill] [bigint] NULL, 
                    [tonw] [float] NULL, 
                    [torv] [bigint] NULL, 
                    [tocv] [bigint] NULL, 
                    [setm] [int] NULL, 
                    [cap] [bigint] NULL, 
                    [insp] [bigint] NULL, 
                    [tvop] [bigint] NULL, 
                    [tax17] [bigint] NULL, 
                    [uid] [nvarchar](50) NULL, 
                    [ref_number] [nvarchar](50) NULL, 
                    [tax_status] [nvarchar](50) NULL, 
                    [status] [int] NULL, 
                    [accept_ref_number] [nvarchar](50) NULL, 
                    [indatim_datetime] [datetime] NULL, 
                    [indati2m_datetime] [datetime] NULL, 
                    [indatim_persian] [nvarchar](50) NULL, 
                    [indati2m_persian] [nvarchar](50) NULL, 
                    [sbc] [nvarchar](50) NULL, 
                    [bbc] [nvarchar](50) NULL, 
                    [factor_id] [bigint] NULL, 
                    [CustomerCode] [bigint] NULL,
                    CONSTRAINT [PK_tax_headers] PRIMARY KEY CLUSTERED ([id] ASC) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.tax_history', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[tax_history]( 
                    [id] [bigint] IDENTITY(1,1) NOT NULL,
                    [header_id] [bigint] NULL,
                    [uid] [nvarchar](50) NULL,
                    [ref_number] [nvarchar](50) NULL,
                    [tax_id] [nvarchar](50) NULL,
                    [create_date] [datetime] NULL,
                    CONSTRAINT [PK_tax_histories] PRIMARY KEY CLUSTERED ([id] ASC) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.tax_payment', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[tax_payment]( 
                    [id] [bigint] IDENTITY(1,1) NOT NULL,
                    [header_id] [bigint] NULL,
                    [iinn] [nvarchar](50) NULL,
                    [acn] [nvarchar](50) NULL,
                    [trmn] [nvarchar](50) NULL,
                    [pmt] [bigint] NULL,
                    [trn] [nvarchar](50) NULL,
                    [pcn] [nvarchar](50) NULL,
                    [pid] [nvarchar](50) NULL,
                    [pdt] [bigint] NULL,
                    [pv] [bigint] NULL,
                    [pdt_persian] [nvarchar](50) NULL,
                    [pdt_dateformat] [datetime] NULL,
                    CONSTRAINT [PK_tax_payments] PRIMARY KEY CLUSTERED ([id] ASC) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
                ) ON [PRIMARY];
            END;
            """,

            """
            IF OBJECT_ID(N'dbo.tax_setting', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[tax_setting](
                    [tax_user_name] [nvarchar](10) NULL,
                    [private_key] [nvarchar](max) NULL,
                    [code_egtesadi] [nvarchar](30) NULL,
                    [is_sandbox] [bit] NULL,
                    [invoice] [bit] NULL,
                    [stuff] [bit] NULL,
                    [customer] [bit] NULL
                ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];
            END;
            """,

            // ============================================================
            // کلیدهای خارجی (Foreign Keys) برای جداول مودیان
            // ============================================================
            """
            IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_tax_bodies_tax_headers')
                ALTER TABLE [dbo].[tax_body] WITH CHECK ADD CONSTRAINT [FK_tax_bodies_tax_headers] FOREIGN KEY([header_id]) REFERENCES [dbo].[tax_header] ([id]) ON DELETE CASCADE;
            
            IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_tax_erorrs_tax_headers')
                ALTER TABLE [dbo].[tax_erorr] WITH CHECK ADD CONSTRAINT [FK_tax_erorrs_tax_headers] FOREIGN KEY([header_id]) REFERENCES [dbo].[tax_header] ([id]) ON DELETE CASCADE;
            
            IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_tax_histories_tax_headers')
                ALTER TABLE [dbo].[tax_history] WITH CHECK ADD CONSTRAINT [FK_tax_histories_tax_headers] FOREIGN KEY([header_id]) REFERENCES [dbo].[tax_header] ([id]) ON DELETE CASCADE;
            
            IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_tax_payments_tax_headers')
                ALTER TABLE [dbo].[tax_payment] WITH CHECK ADD CONSTRAINT [FK_tax_payments_tax_headers] FOREIGN KEY([header_id]) REFERENCES [dbo].[tax_header] ([id]) ON DELETE CASCADE;
            """,

            // ============================================================
            // Alter Columns (اصلاح نوع ستون‌های مودیان)
            // ============================================================
            """
            IF COL_LENGTH('dbo.tax_body', 'tsstam') IS NOT NULL ALTER TABLE [dbo].[tax_body] ALTER COLUMN [tsstam] decimal(18, 0);
            IF COL_LENGTH('dbo.tax_body', 'prdis') IS NOT NULL ALTER TABLE [dbo].[tax_body] ALTER COLUMN [prdis] decimal(18, 0);
            IF COL_LENGTH('dbo.tax_header', 'tprdis') IS NOT NULL ALTER TABLE [dbo].[tax_header] ALTER COLUMN [tprdis] decimal(18, 0);
            IF COL_LENGTH('dbo.tax_header', 'tbill') IS NOT NULL ALTER TABLE [dbo].[tax_header] ALTER COLUMN [tbill] decimal(18, 0);
            """
        };
    }
}