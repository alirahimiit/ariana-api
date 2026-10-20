using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Services;

public class SanadMovaghatService : ISanadMovaghatService
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<SanadMovaghatService> _logger;

    public SanadMovaghatService(ITenantConnectionFactory factory, ILogger<SanadMovaghatService> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task AddRowAsync(long orgId, long fyId, SanadMovaghatPreviewRequestDto filter, string cu, CancellationToken ct = default)
    {
        if (filter.CodeCol <= 0 && (!filter.CodeTafzil.HasValue || filter.CodeTafzil.Value <= 0))
            throw new ArgumentException("حداقل یکی از کد کل یا کد تفصیلی الزامی است");

        using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var sql = @"
            SELECT
                Code_Col     AS CodeCol,
                Code_Moein   AS CodeMoein,
                Code_Tafzil  AS CodeTafzil,
                ISNULL(Code_Tafzili2, 0) AS CodeTafzili2,
                ISNULL(CodeVahed, 0)     AS CodeVahed,
                ISNULL(CodeMarkazH, 0)   AS CodeMarkazH,
                ISNULL(CodeProject, 0)   AS CodeProject,
                SUM(ISNULL(Mab_Bed, 0))  AS SumBed,
                SUM(ISNULL(Mab_Bes, 0))  AS SumBes,
                SUM(ISNULL(Meghdar, 0))  AS SumMeghdar
            FROM Sanad WHERE 1=1";

        if (filter.CodeCol > 0) sql += " AND Code_Col = @CodeCol";
        if (filter.CodeMoein.HasValue && filter.CodeMoein.Value > 0) sql += " AND Code_Moein = @CodeMoein";
        if (filter.CodeTafzil.HasValue && filter.CodeTafzil.Value > 0) sql += " AND Code_Tafzil = @CodeTafzil";
        if (filter.CodeTafzili2.HasValue && filter.CodeTafzili2.Value > 0) sql += " AND Code_Tafzili2 = @CodeTafzili2";

        sql += @"
            GROUP BY Code_Col, Code_Moein, Code_Tafzil,
                     ISNULL(Code_Tafzili2, 0), ISNULL(CodeVahed, 0),
                     ISNULL(CodeMarkazH, 0), ISNULL(CodeProject, 0)
            ORDER BY Code_Col, Code_Moein, Code_Tafzil";

        var raw = await conn.QueryAsync<dynamic>(sql, filter);

        foreach (var r in raw)
        {
            decimal sumBed = (decimal)(r.SumBed ?? 0m);
            decimal sumBes = (decimal)(r.SumBes ?? 0m);
            decimal diff = Math.Round(sumBed) - Math.Round(sumBes);

            decimal bed = 0, bes = 0;
            if (diff > 0) bed = diff;
            else bes = Math.Abs(diff);

            if (bed == 0 && bes == 0) continue;

            await conn.ExecuteAsync(@"
                INSERT INTO SanadMovaghat 
                (Code_Col, Code_Moein, Code_Tafzil, Code_Tafzili2, CodeVahed, CodeMarkazH, CodeProject, Mab_Bed, Mab_Bes, Meghdar, Cu)
                VALUES 
                (@cCol, @cMoein, @cTafzil, @cTafzili2, @cVahed, @cMarkazH, @cProject, @bed, @bes, @meghdar, @cu)",
                new
                {
                    cCol = (long)r.CodeCol,
                    cMoein = (long)r.CodeMoein,
                    cTafzil = (long)r.CodeTafzil,
                    cTafzili2 = (long)r.CodeTafzili2,
                    cVahed = (long)r.CodeVahed,
                    cMarkazH = (long)r.CodeMarkazH,
                    cProject = (long)r.CodeProject,
                    bed = bed,
                    bes = bes,
                    meghdar = Math.Round((decimal)(r.SumMeghdar ?? 0m)),
                    cu = cu
                });
        }
    }

    public async Task<List<SanadMovaghatStagingRowDto>> GetStagingRowsAsync(long orgId, long fyId, string cu, CancellationToken ct = default)
    {
        using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var rows = await conn.QueryAsync<SanadMovaghatStagingRowDto>(@"
            SELECT SanadMovaghatID, Code_Col AS CodeCol, Code_Moein AS CodeMoein, Code_Tafzil AS CodeTafzil, 
                   ISNULL(Code_Tafzili2,0) AS CodeTafzili2, Des, Mab_Bed AS MabBed, Mab_Bes AS MabBes, 
                   ISNULL(Meghdar,0) AS Meghdar, ISNULL(CodeVahed,0) AS CodeVahed, ISNULL(CodeMarkazH,0) AS CodeMarkazH, ISNULL(CodeProject,0) AS CodeProject
            FROM SanadMovaghat 
            WHERE Cu = @cu
            ORDER BY SanadMovaghatID", new { cu });

        var result = new List<SanadMovaghatStagingRowDto>();
        foreach (var r in rows)
        {
            r.HesabName = await GetHesabNameAsync(conn, r.CodeCol, r.CodeMoein, r.CodeTafzil);
            result.Add(r);
        }
        return result;
    }

    public async Task DeleteRowAsync(long orgId, long fyId, long id, CancellationToken ct = default)
    {
        using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync("DELETE FROM SanadMovaghat WHERE SanadMovaghatID = @id", new { id });
    }

    public async Task ClearStagingAsync(long orgId, long fyId, string cu, CancellationToken ct = default)
    {
        using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.ExecuteAsync("DELETE FROM SanadMovaghat WHERE Cu = @cu", new { cu });
    }

    public async Task<SanadClosingResultDto> SaveAsync(long orgId, long fyId, string cu, string dateIn, CancellationToken ct = default)
    {
        using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ۱) بررسی خالی نبودن سبد
        var count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM SanadMovaghat WHERE Cu = @cu", new { cu });
        if (count == 0)
            return new SanadClosingResultDto { Success = false, Message = "جدول سند موقت خالی است. ابتدا حساب اضافه کنید." };

        using var tx = await conn.BeginTransactionAsync(ct);
        try
        {
            // ۲) اجرای استور پروسیجر دلفی
            var p = new DynamicParameters();
            p.Add("@ComputerName", cu);
            p.Add("@aDateIN", dateIn);
            p.Add("@Return_Value", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.ReturnValue);

            await conn.ExecuteAsync("Save_Sanad_Movaghat", p, transaction: tx, commandType: System.Data.CommandType.StoredProcedure);

            var retVal = p.Get<int>("@Return_Value");
            if (retVal != 1)
                throw new Exception("استور پروسیجر خطا داد (Return Value = 0)");

            // ۳) پیدا کردن ParentSanad جدید (آخرین سند)
            var parent = await conn.QueryFirstOrDefaultAsync<dynamic>(
                "SELECT TOP 1 ParentSanadID, NO_Sanad, (SELECT SUM(Mab_Bed) " +
                "   FROM Sanad WHERE ParentSanadCode = ParentSanadID) AS TB, " +
                " (SELECT SUM(Mab_Bes) FROM Sanad WHERE ParentSanadCode = ParentSanadID) AS TS " +
                "   FROM ParentSanad ORDER BY ParentSanadID DESC",
                transaction: tx);

            if (parent == null)
                throw new Exception("سند ثبت شد اما در دیتابیس یافت نشد.");

            long newParentId = (long)parent.ParentSanadID;
            long newNoSanad = (long)parent.NO_Sanad;
            decimal tBed = (decimal)(parent.TB ?? 0m);
            decimal tBes = (decimal)(parent.TS ?? 0m);

            // ۴) پاکسازی جدول میانی
            await conn.ExecuteAsync("DELETE FROM SanadMovaghat WHERE Cu = @cu", new { cu }, transaction: tx);

            await tx.CommitAsync(ct);

            return new SanadClosingResultDto
            {
                Success = true,
                ParentSanadId = newParentId,
                NoSanad = newNoSanad,
                RowsCreated = count,
                TotalBed = tBed,
                TotalBes = tBes,
                Message = $"سند موقت شماره {newNoSanad} با {count} ردیف ثبت شد (ناتراز)"
            };
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            _logger.LogError(ex, "SanadMovaghat Save Failed");
            return new SanadClosingResultDto { Success = false, Message = ex.Message };
        }
    }

    private static async Task<string?> GetHesabNameAsync(SqlConnection conn, long codeCol, long codeMoein, long codeTafzil)
    {
        try
        {
            if (codeTafzil > 0)
                return await conn.ExecuteScalarAsync<string>("SELECT TOP 1 Name FROM Hesab WHERE Code_Col = -1 AND Code_Moein = 0 AND Code_Tafzil = @c", new { c = codeTafzil });
            if (codeMoein > 0)
                return await conn.ExecuteScalarAsync<string>("SELECT TOP 1 Name FROM Hesab WHERE Code_Col = @col AND Code_Moein = @moein AND Code_Tafzil = 0", new { col = codeCol, moein = codeMoein });
            return await conn.ExecuteScalarAsync<string>("SELECT TOP 1 Name FROM Hesab WHERE Code_Col = @col AND Code_Moein = 0 AND Code_Tafzil = 0", new { col = codeCol });
        }
        catch { return null; }
    }
}