using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using System.Text;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository اسناد با Dapper
/// </summary>
public class SanadRepository : ISanadRepository
{
    private readonly ITenantConnectionFactory _factory;

    public SanadRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    // ═══════════════════════════════════════════════════
    //  لیست اسناد
    // ═══════════════════════════════════════════════════

    public async Task<IEnumerable<SanadListDto>> GetListAsync(
    long orgId,
    long fyId,
    string? fromDate = null,
    string? toDate = null,
    int? noFrom = null,
    int? noTo = null,
    int? vazeit = null,
    int? kindSanad = null,
    int page = 1,
    int pageSize = 100,
    CancellationToken ct = default)
    {
        // ساخت WHERE دینامیک
        var where = new StringBuilder(" WHERE 1=1 ");
        var parameters = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(fromDate))
        {
            where.Append(" AND P.Date_IN >= @fromDate ");
            parameters.Add("fromDate", fromDate);
        }

        if (!string.IsNullOrWhiteSpace(toDate))
        {
            where.Append(" AND P.Date_IN <= @toDate ");
            parameters.Add("toDate", toDate);
        }

        if (noFrom.HasValue)
        {
            where.Append(" AND P.NO_Sanad >= @noFrom ");
            parameters.Add("noFrom", noFrom.Value);
        }

        if (noTo.HasValue)
        {
            where.Append(" AND P.NO_Sanad <= @noTo ");
            parameters.Add("noTo", noTo.Value);
        }

        if (vazeit.HasValue)
        {
            where.Append(" AND P.Vazeit = @vazeit ");
            parameters.Add("vazeit", vazeit.Value);
        }

        if (kindSanad.HasValue)
        {
            where.Append(" AND P.KindSanad = @kindSanad ");
            parameters.Add("kindSanad", kindSanad.Value);
        }

        // صفحه‌بندی
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 1000) pageSize = 100;
        var offset = (page - 1) * pageSize;

        parameters.Add("startRow", offset + 1);
        parameters.Add("endRow", offset + pageSize);

        // ⚠️ استفاده از ROW_NUMBER به جای OFFSET/FETCH
        // چون SQL Server 2008 یا قدیمی‌تر OFFSET/FETCH رو پشتیبانی نمی‌کنه
        var sql = $@"
        SELECT * FROM (
            SELECT 
                P.ParentSanadID,
                P.NO_Sanad,
                P.Date_IN,
                P.OtherParentSharh,
                P.Vazeit,
                P.KindSanad,
                ISNULL(S.SumBed, 0) AS Mab_Bed,
                ISNULL(S.SumBes, 0) AS Mab_Bes,
                ROW_NUMBER() OVER (ORDER BY P.NO_Sanad DESC) AS RowNum
            FROM ParentSanad P
            LEFT JOIN (
                SELECT ParentSanadCode,
                       SUM(Mab_Bed) AS SumBed,
                       SUM(Mab_Bes) AS SumBes
                FROM Sanad
                GROUP BY ParentSanadCode
            ) S ON S.ParentSanadCode = P.ParentSanadID
            {where}
        ) AS T
        WHERE T.RowNum BETWEEN @startRow AND @endRow
        ORDER BY T.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<SanadListDto>(
            new CommandDefinition(sql, parameters, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════
    //  جزئیات سند
    // ═══════════════════════════════════════════════════

    public async Task<SanadDetailDto?> GetByIdAsync(
        long orgId,
        long fyId,
        long sanadId,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                ParentSanadID, NO_Sanad, Date_IN, OtherParentSharh,
                ParentSharh_Code, Vazeit, KindSanad, Creator, Confirmer,
                Date_Op, Time_Op
            FROM ParentSanad
            WHERE ParentSanadID = @sanadId";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryFirstOrDefaultAsync<SanadDetailDto>(
            new CommandDefinition(sql, new { sanadId }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════
    //  آیتم‌های سند
    // ═══════════════════════════════════════════════════

    public async Task<IEnumerable<SanadItemDto>> GetItemsAsync(
        long orgId,
        long fyId,
        long parentSanadId,
        CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                S.SanadID,
                S.NO_Sanad,
                S.RowNum,
                S.Code_Col,
                S.Code_Moein,
                S.Code_Tafzil,
                S.Code_Tafzili2,
                S.Mab_Bed,
                S.Mab_Bes,
                S.Meghdar,
                S.OtherSharh,
                S.TikRow,
                S.Code_Sharh,
                S.DoDate,
                S.DoOK,
                ISNULL(H1.Name, '') AS ColName,
                ISNULL(H2.Name, '') AS MoeinName,
                ISNULL(H3.Name, '') AS TafzilName,
                ISNULL(T2.Name, '') AS Tafzili2Name
            FROM Sanad S
            LEFT JOIN Hesab H1 
                ON H1.Code_Col = S.Code_Col 
               AND H1.Code_Moein = 0 
               AND H1.Code_Tafzil = 0
            LEFT JOIN Hesab H2 
                ON H2.Code_Col = S.Code_Col 
               AND H2.Code_Moein = S.Code_Moein 
               AND H2.Code_Tafzil = 0
            LEFT JOIN Hesab H3 
                ON H3.Code_Col = -1 
               AND H3.Code_Tafzil = S.Code_Tafzil
            LEFT JOIN Tafzili2 T2 
                ON T2.Code = S.Code_Tafzili2
            WHERE S.ParentSanadCode = @parentSanadId
            ORDER BY S.RowNum";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.QueryAsync<SanadItemDto>(
            new CommandDefinition(sql, new { parentSanadId }, cancellationToken: ct));
    }

    // ═══════════════════════════════════════════════════
    //  تعداد کل اسناد
    // ═══════════════════════════════════════════════════

    public async Task<int> GetCountAsync(
        long orgId,
        long fyId,
        string? fromDate = null,
        string? toDate = null,
        int? vazeit = null,
        CancellationToken ct = default)
    {
        var where = new StringBuilder(" WHERE 1=1 ");
        var parameters = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(fromDate))
        {
            where.Append(" AND Date_IN >= @fromDate ");
            parameters.Add("fromDate", fromDate);
        }

        if (!string.IsNullOrWhiteSpace(toDate))
        {
            where.Append(" AND Date_IN <= @toDate ");
            parameters.Add("toDate", toDate);
        }

        if (vazeit.HasValue)
        {
            where.Append(" AND Vazeit = @vazeit ");
            parameters.Add("vazeit", vazeit.Value);
        }

        var sql = $"SELECT COUNT(*) FROM ParentSanad {where}";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        return await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, parameters, cancellationToken: ct));
    }
}