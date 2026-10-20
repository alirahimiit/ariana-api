using System.Text;
using ArianaAPI.Application.DTOs.Taraz;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class TarazSheshSotooniRepository : ITarazSheshSotooniRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<TarazSheshSotooniRepository> _logger;

    public TarazSheshSotooniRepository(
        ITenantConnectionFactory factory,
        ILogger<TarazSheshSotooniRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<TarazSheshSotooniResultDto> GetTarazAsync(
        long orgId, long fyId, TarazSheshSotooniRequestDto req, CancellationToken ct = default)
    {
        var level = (req.Level ?? "col").ToLowerInvariant();
        if (level != "col" && level != "moein" && level != "tafzil" && level != "tafzil2")
            level = "col";

        string groupCols = level switch
        {
            "col" => "S.Code_Col",
            "moein" => "S.Code_Col, S.Code_Moein",
            "tafzil" => "S.Code_Col, S.Code_Moein, S.Code_Tafzil",
            "tafzil2" => "S.Code_Col, S.Code_Moein, S.Code_Tafzil, S.Code_Tafzili2",
            _ => "S.Code_Col"
        };

        string selectMoein = (level == "col") ? "0" : "MAX(ISNULL(S.Code_Moein,0))";
        string selectTafzil = (level == "col" || level == "moein") ? "0" : "MAX(ISNULL(S.Code_Tafzil,0))";
        string selectTafzili2 = (level == "tafzil2") ? "MAX(ISNULL(S.Code_Tafzili2,0))" : "0";

        string levelFilter = level switch
        {
            "moein" => " AND ISNULL(S.Code_Moein,0) > 0 ",
            "tafzil" => " AND ISNULL(S.Code_Tafzil,0) > 0 ",
            "tafzil2" => " AND ISNULL(S.Code_Tafzili2,0) > 0 ",
            _ => ""
        };

        var sbWhere = new StringBuilder();
        var p = new DynamicParameters();

        bool hasOpening = req.OpeningSanadNos != null && req.OpeningSanadNos.Any();
        bool hasClosing = req.ClosingSanadNos != null && req.ClosingSanadNos.Any();

        if (hasOpening) p.Add("openingNos", req.OpeningSanadNos);
        if (hasClosing) p.Add("closingNos", req.ClosingSanadNos);

        p.Add("fromDate", req.FromDate);
        p.Add("toDate", req.ToDate);

        if (req.FromCodeCol is > 0) { sbWhere.Append(" AND S.Code_Col >= @fromCodeCol "); p.Add("fromCodeCol", req.FromCodeCol.Value); }
        if (req.ToCodeCol is > 0) { sbWhere.Append(" AND S.Code_Col <= @toCodeCol "); p.Add("toCodeCol", req.ToCodeCol.Value); }
        if (req.FromCodeMoein is > 0) { sbWhere.Append(" AND S.Code_Moein >= @fromCodeMoein "); p.Add("fromCodeMoein", req.FromCodeMoein.Value); }
        if (req.ToCodeMoein is > 0) { sbWhere.Append(" AND S.Code_Moein <= @toCodeMoein "); p.Add("toCodeMoein", req.ToCodeMoein.Value); }
        if (req.FromCodeTafzil is > 0) { sbWhere.Append(" AND S.Code_Tafzil >= @fromCodeTafzil "); p.Add("fromCodeTafzil", req.FromCodeTafzil.Value); }
        if (req.ToCodeTafzil is > 0) { sbWhere.Append(" AND S.Code_Tafzil <= @toCodeTafzil "); p.Add("toCodeTafzil", req.ToCodeTafzil.Value); }
        if (req.CodeTafzili2 is > 0) { sbWhere.Append(" AND S.Code_Tafzili2 = @codeTafzili2 "); p.Add("codeTafzili2", req.CodeTafzili2.Value); }
        if (req.TafziliGroupId is > 0)
        {
            sbWhere.Append(@" AND S.Code_Tafzil IN (
                SELECT Code_Tafzil FROM Hesab 
                WHERE TafziliGroupCode = @tafziliGroupId AND Code_Tafzil > 0) ");
            p.Add("tafziliGroupId", req.TafziliGroupId.Value);
        }

        // شرط افتتاحیه: اگر لیست پر بود، همون‌ها، در غیر این صورت KindSanad=1
        string isOpeningCond = hasOpening
            ? " P.No_Sanad IN @openingNos "
            : " ISNULL(P.KindSanad,0) = 1 ";

        // شرط گردش: باید KindSanad=0 باشه، در بازه تاریخ باشه، و جزو سند افتتاحیه یا اختتامیهِ override نباشه
        string isTurnoverCond = $@"
            ISNULL(P.KindSanad,0) = 0
            AND (@fromDate IS NULL OR P.Date_In >= @fromDate)
            AND (@toDate IS NULL OR P.Date_In <= @toDate)
            {(hasOpening ? "AND P.No_Sanad NOT IN @openingNos" : "")}
            {(hasClosing ? "AND P.No_Sanad NOT IN @closingNos" : "")}
        ";

        string innerSql = $@"
            SELECT
                S.Code_Col,
                {selectMoein} AS Code_Moein,
                {selectTafzil} AS Code_Tafzil,
                {selectTafzili2} AS Code_Tafzili2,
                SUM(CASE WHEN {isOpeningCond} THEN ISNULL(S.Mab_Bed, 0) ELSE 0 END) AS OpeningDebit,
                SUM(CASE WHEN {isOpeningCond} THEN ISNULL(S.Mab_Bes, 0) ELSE 0 END) AS OpeningCredit,
                SUM(CASE WHEN {isTurnoverCond} THEN ISNULL(S.Mab_Bed, 0) ELSE 0 END) AS TurnoverDebit,
                SUM(CASE WHEN {isTurnoverCond} THEN ISNULL(S.Mab_Bes, 0) ELSE 0 END) AS TurnoverCredit
            FROM Sanad S
            INNER JOIN ParentSanad P ON P.ParentSanadID = S.ParentSanadCode
            WHERE S.Code_Col > 0
              {levelFilter}
              {sbWhere}
            GROUP BY {groupCols}
            HAVING
                SUM(CASE WHEN {isOpeningCond} THEN ISNULL(S.Mab_Bed, 0) + ISNULL(S.Mab_Bes, 0) ELSE 0 END) <> 0
                OR SUM(CASE WHEN {isTurnoverCond} THEN ISNULL(S.Mab_Bed, 0) + ISNULL(S.Mab_Bes, 0) ELSE 0 END) <> 0
        ";

        string finalSql = $@"
            SELECT
                R.Code_Col,
                R.Code_Moein,
                R.Code_Tafzil,
                R.Code_Tafzili2,
                ISNULL((SELECT TOP 1 Name FROM Hesab
                        WHERE Code_Col = R.Code_Col AND Code_Moein = 0 AND Code_Tafzil = 0), '') AS ColName,
                ISNULL((SELECT TOP 1 Name FROM Hesab
                        WHERE Code_Col = R.Code_Col AND Code_Moein = R.Code_Moein AND Code_Tafzil = 0), '') AS MoeinName,
                ISNULL((SELECT TOP 1 Name FROM Hesab
                        WHERE Code_Col = -1 AND Code_Tafzil = R.Code_Tafzil), '') AS TafzilName,
                '' AS Tafzili2Name,
                ISNULL((SELECT TOP 1 HasTafzili FROM Hesab
                        WHERE Code_Col = R.Code_Col AND Code_Moein = R.Code_Moein AND Code_Tafzil = 0), 0) AS HasTafzili,
                ISNULL((SELECT TOP 1 HasTafzili2 FROM Hesab
                        WHERE Code_Col = R.Code_Col AND Code_Moein = R.Code_Moein AND Code_Tafzil = 0), 0) AS HasTafzili2,
                R.OpeningDebit, R.OpeningCredit, R.TurnoverDebit, R.TurnoverCredit
            FROM ({innerSql}) R
            ORDER BY R.Code_Col, R.Code_Moein, R.Code_Tafzil, R.Code_Tafzili2
        ";

        _logger.LogDebug("TarazSheshSotooni Level={Level} OpeningNos={OpeningNos} ClosingNos={ClosingNos}",
            level, string.Join(",", req.OpeningSanadNos ?? new List<int>()), string.Join(",", req.ClosingSanadNos ?? new List<int>()));

        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        var rows = (await conn.QueryAsync<TarazSheshSotooniItemDto>(
            new CommandDefinition(finalSql, p, cancellationToken: ct))).ToList();

        foreach (var r in rows)
        {
            var openingNet = r.OpeningDebit - r.OpeningCredit;
            var turnoverNet = r.TurnoverDebit - r.TurnoverCredit;
            var closingNet = openingNet + turnoverNet;

            if (closingNet >= 0)
            {
                r.ClosingDebit = closingNet;
                r.ClosingCredit = 0;
            }
            else
            {
                r.ClosingDebit = 0;
                r.ClosingCredit = Math.Abs(closingNet);
            }

            var nameParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(r.ColName)) nameParts.Add(r.ColName);
            if (level != "col" && !string.IsNullOrWhiteSpace(r.MoeinName)) nameParts.Add(r.MoeinName);
            if ((level == "tafzil" || level == "tafzil2") && !string.IsNullOrWhiteSpace(r.TafzilName)) nameParts.Add(r.TafzilName);
            if (level == "tafzil2" && !string.IsNullOrWhiteSpace(r.Tafzili2Name)) nameParts.Add(r.Tafzili2Name);
            r.HesabName = string.Join(" - ", nameParts);

            var codeParts = new List<string> { r.CodeCol.ToString() };
            if (level != "col" && r.CodeMoein > 0) codeParts.Add(r.CodeMoein.ToString());
            if ((level == "tafzil" || level == "tafzil2") && r.CodeTafzil > 0) codeParts.Add(r.CodeTafzil.ToString());
            if (level == "tafzil2" && r.CodeTafzili2 > 0) codeParts.Add(r.CodeTafzili2.ToString());
            r.FullCode = string.Join("-", codeParts);
        }

        IEnumerable<TarazSheshSotooniItemDto> filtered = rows;
        switch (req.FilterOption)
        {
            case "noZeroClosing":
                filtered = rows.Where(x => x.ClosingDebit != 0 || x.ClosingCredit != 0);
                break;
            case "noZeroTurnover":
                filtered = rows.Where(x => x.TurnoverDebit != 0 || x.TurnoverCredit != 0);
                break;
            case "noZeroBoth":
                filtered = rows.Where(x =>
                    (x.ClosingDebit != 0 || x.ClosingCredit != 0) &&
                    (x.TurnoverDebit != 0 || x.TurnoverCredit != 0));
                break;
        }
        var finalList = filtered.ToList();

        var totalOpeningDebit = finalList.Sum(x => x.OpeningDebit);
        var totalOpeningCredit = finalList.Sum(x => x.OpeningCredit);
        var totalTurnoverDebit = finalList.Sum(x => x.TurnoverDebit);
        var totalTurnoverCredit = finalList.Sum(x => x.TurnoverCredit);
        var totalClosingDebit = finalList.Sum(x => x.ClosingDebit);
        var totalClosingCredit = finalList.Sum(x => x.ClosingCredit);

        var isBalanced =
            Math.Abs(totalOpeningDebit - totalOpeningCredit) < 0.01m &&
            Math.Abs(totalTurnoverDebit - totalTurnoverCredit) < 0.01m &&
            Math.Abs(totalClosingDebit - totalClosingCredit) < 0.01m;

        if (req.Page < 1) req.Page = 1;
        if (req.PageSize < 1) req.PageSize = 500;
        if (req.PageSize > 500000) req.PageSize = 500000;

        var totalCount = finalList.Count;
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)req.PageSize);
        var pagedItems = finalList
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .ToList();

        return new TarazSheshSotooniResultDto
        {
            Level = level,
            Items = pagedItems,
            TotalOpeningDebit = totalOpeningDebit,
            TotalOpeningCredit = totalOpeningCredit,
            TotalTurnoverDebit = totalTurnoverDebit,
            TotalTurnoverCredit = totalTurnoverCredit,
            TotalClosingDebit = totalClosingDebit,
            TotalClosingCredit = totalClosingCredit,
            Page = req.Page,
            PageSize = req.PageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            IsBalanced = isBalanced
        };
    }
}