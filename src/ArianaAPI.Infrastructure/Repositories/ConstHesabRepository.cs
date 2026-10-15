using ArianaAPI.Application.Dtos.ConstHesab;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Application.Services;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

public class ConstHesabRepository : IConstHesabRepository
{
    private readonly ITenantConnectionFactory _factory;

    public ConstHesabRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    // ═══════════════════════════════════════════════════════════
    //  GET LIST — با نام کل + نام معین
    // ═══════════════════════════════════════════════════════════
    public async Task<List<ConstHesabItemDto>> GetListAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        const string sql = @"
            SELECT 
                CH.Type        AS Type,
                CH.HesabID     AS HesabId,
                H.Code_Col     AS CodeCol,
                H.Code_Moein   AS CodeMoein,
                H.Code_Tafzil  AS CodeTafzil,
                H.Name         AS HesabName,
                HC.Name        AS ColName
            FROM ConstHesabs CH
            LEFT JOIN Hesab H  ON H.HesabID = CH.HesabID
            LEFT JOIN Hesab HC ON HC.Code_Col = H.Code_Col 
                              AND ISNULL(HC.Code_Moein, 0) = 0 
                              AND ISNULL(HC.Code_Tafzil, 0) = 0";

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var rows = (await conn.QueryAsync<ConstHesabItemDto>(
            new CommandDefinition(sql, cancellationToken: ct))).ToList();

        var map = rows.ToDictionary(r => r.Type, r => r);

        var result = new List<ConstHesabItemDto>();
        foreach (var (type, name) in ConstHesabTypes.All)
        {
            if (map.TryGetValue(type, out var row))
            {
                row.TypeName = name;
                result.Add(row);
            }
            else
            {
                result.Add(new ConstHesabItemDto
                {
                    Type = type,
                    TypeName = name
                });
            }
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════
    //  SET (INSERT or UPDATE) — بدون تغییر
    // ═══════════════════════════════════════════════════════════
    public async Task<bool> SetAsync(
        long orgId, long fyId, ConstHesabSetDto dto,
        long userCode, CancellationToken ct = default)
    {
        if (dto.Type < 0 || dto.Type > ConstHesabTypes.MaxType)
            throw new ArgumentException($"Type نامعتبر: {dto.Type}");

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        try
        {
            const string findSql = @"
                SELECT TOP 1 HesabID FROM Hesab 
                WHERE Code_Col = @codeCol 
                  AND ISNULL(Code_Moein, 0) = @codeMoein 
                  AND ISNULL(Code_Tafzil, 0) = @codeTafzil";

            var hesabId = await conn.ExecuteScalarAsync<long?>(
                new CommandDefinition(findSql, new
                {
                    codeCol = dto.CodeCol,
                    codeMoein = dto.CodeMoein,
                    codeTafzil = dto.CodeTafzil
                }, transaction: tx, cancellationToken: ct));

            if (!hesabId.HasValue || hesabId.Value == 0)
                throw new InvalidOperationException("حساب موردنظر در جدول Hesab پیدا نشد");

            var exists = await conn.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COUNT(*) FROM ConstHesabs WHERE Type = @type",
                    new { type = dto.Type }, transaction: tx, cancellationToken: ct));

            var userStr = userCode.ToString();
            var dateStr = DateTime.Now.ToString("yyyy/MM/dd");
            var timeStr = DateTime.Now.ToString("HH:mm:ss");

            if (exists > 0)
            {
                const string upd = @"
                    UPDATE ConstHesabs 
                    SET HesabID = @hesabId,
                        Code_Op = @codeOp,
                        Date_OP = @dateOp,
                        Time_Op = @timeOp
                    WHERE Type = @type";

                await conn.ExecuteAsync(new CommandDefinition(upd, new
                {
                    hesabId = hesabId.Value,
                    codeOp = userStr,
                    dateOp = dateStr,
                    timeOp = timeStr,
                    type = dto.Type
                }, transaction: tx, cancellationToken: ct));
            }
            else
            {
                const string ins = @"
                    INSERT INTO ConstHesabs (HesabID, Type, Code_Op, Date_OP, Time_Op)
                    VALUES (@hesabId, @type, @codeOp, @dateOp, @timeOp)";

                await conn.ExecuteAsync(new CommandDefinition(ins, new
                {
                    hesabId = hesabId.Value,
                    type = dto.Type,
                    codeOp = userStr,
                    dateOp = dateStr,
                    timeOp = timeStr
                }, transaction: tx, cancellationToken: ct));
            }

            await tx.CommitAsync(ct);
            return true;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  CLEAR — بدون تغییر
    // ═══════════════════════════════════════════════════════════
    public async Task<bool> ClearAsync(
        long orgId, long fyId, int type, CancellationToken ct = default)
    {
        if (type < 0 || type > ConstHesabTypes.MaxType) return false;

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM ConstHesabs WHERE Type = @type",
            new { type }, cancellationToken: ct));

        return affected > 0;
    }
}