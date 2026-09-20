using ArianaAPI.Application.Dtos.Reports;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class ProfitLossRepository : IProfitLossRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<ProfitLossRepository> _logger;

    // کدهای GroupType مطابق دلفی
    private const int GT_FOROOSH = 3;  // فروش  → Revenue
    private const int GT_KHARID = 4;  // خرید  → Expense
    private const int GT_HAZINEH = 5;  // هزینه → Expense   ← اصلاح
    private const int GT_DARAMAD = 6;  // درآمد → Revenue   ← اصلاح

    public ProfitLossRepository(
        ITenantConnectionFactory factory,
        ILogger<ProfitLossRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<ProfitLossResultDto> GetReportAsync(
        long orgId, long fyId, ProfitLossRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

        // ─────────────────────────────────────────────
        // منطق SQL مطابق PrepareRemainderGroup در دلفی:
        //   1. برای هر GroupType، ردیف هدر رو در Hesab پیدا کن
        //      (Code_Col=0 AND Code_Moein=0 AND Code_Group>0)
        //   2. Code_Group هدر رو بگیر
        //   3. همه Code_Col های زیر آن Code_Group رو جمع بزن
        // ─────────────────────────────────────────────
        const string sql = @"
;WITH GroupTypeMap AS (
    SELECT 
        GT.GroupTypeCode AS GroupTypeCode,
        GT.Name          AS GroupTypeName,
        H.Code_Group     AS CodeGroup
    FROM GroupType GT
    INNER JOIN Hesab H 
        ON  H.GroupTypeCode = GT.GroupTypeCode
        AND H.Code_Col      = 0
        AND H.Code_Moein    = 0
        AND H.Code_Group    > 0
    WHERE GT.GroupTypeCode IN (3, 4, 5, 6)
)
SELECT 
    GTM.GroupTypeCode          AS GroupTypeCode,
    GTM.GroupTypeName          AS GroupTypeName,
    H.Code_Col                 AS CodeCol,
    H.Name                     AS HesabName,
    ISNULL(SUM(S.Mab_Bed), 0)  AS SumMabBed,
    ISNULL(SUM(S.Mab_Bes), 0)  AS SumMabBes
FROM Sanad S
INNER JOIN ParentSanad P 
    ON P.ParentSanadID = S.ParentSanadCode
INNER JOIN Hesab H 
    ON  H.Code_Col     = S.Code_Col
    AND H.Code_Moein   = 0
    AND H.Code_Tafzil  = 0
INNER JOIN GroupTypeMap GTM 
    ON GTM.CodeGroup = H.Code_Group
WHERE S.Code_Col > 0
  AND (@fromDate IS NULL OR P.Date_IN >= @fromDate)
  AND (@toDate   IS NULL OR P.Date_IN <= @toDate)
GROUP BY GTM.GroupTypeCode, GTM.GroupTypeName, H.Code_Col, H.Name
ORDER BY GTM.GroupTypeCode, H.Code_Col";

        var fromDate = string.IsNullOrWhiteSpace(req.FromDate) ? null : req.FromDate;
        var toDate = string.IsNullOrWhiteSpace(req.ToDate) ? null : req.ToDate;

        _logger.LogDebug("ProfitLoss - from={From}, to={To}", fromDate, toDate);

        var rows = (await conn.QueryAsync<RawProfitLossRow>(
            new CommandDefinition(sql, new { fromDate, toDate }, cancellationToken: ct))).ToList();

        // ─────────────────────────────────────────────
        // ساخت گروه‌ها
        // ─────────────────────────────────────────────
        var revenues = new List<ProfitLossGroupDto>();
        var expenses = new List<ProfitLossGroupDto>();
        var groupMap = new Dictionary<int, ProfitLossGroupDto>();

        foreach (var row in rows)
        {
            if (!groupMap.TryGetValue(row.GroupTypeCode, out var group))
            {
                bool isRevenue =
                    row.GroupTypeCode == GT_FOROOSH ||
                    row.GroupTypeCode == GT_DARAMAD;

                group = new ProfitLossGroupDto
                {
                    GroupTypeCode = row.GroupTypeCode,
                    GroupTypeName = row.GroupTypeName,
                    Nature = isRevenue ? "revenue" : "expense"
                };

                groupMap[row.GroupTypeCode] = group;
                if (isRevenue) revenues.Add(group);
                else expenses.Add(group);
            }

            // مانده بر اساس ماهیت:
            //   درآمد → بستانکار - بدهکار
            //   هزینه → بدهکار - بستانکار
            decimal mabMan = group.Nature == "revenue"
                ? row.SumMabBes - row.SumMabBed
                : row.SumMabBed - row.SumMabBes;

            if (!req.IncludeZeroBalance && mabMan == 0 && row.SumMabBed == 0 && row.SumMabBes == 0)
                continue;

            group.Items.Add(new ProfitLossItemDto
            {
                CodeCol = row.CodeCol,
                HesabName = row.HesabName,
                MabBed = row.SumMabBed,
                MabBes = row.SumMabBes,
                MabMan = mabMan
            });

            group.TotalMabBed += row.SumMabBed;
            group.TotalMabBes += row.SumMabBes;
            group.Total += mabMan;
        }

        // ─────────────────────────────────────────────
        // محاسبه سود/زیان
        // ─────────────────────────────────────────────
        decimal totalRevenue = revenues.Sum(g => g.Total);
        decimal totalExpense = expenses.Sum(g => g.Total);
        decimal netProfit = totalRevenue - totalExpense;

        string resultType = netProfit > 0 ? "profit"
                          : netProfit < 0 ? "loss"
                          : "zero";
        string resultText = netProfit > 0 ? "سود"
                          : netProfit < 0 ? "زیان"
                          : "بدون سود و زیان";

        return new ProfitLossResultDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            Revenues = revenues,
            Expenses = expenses,
            TotalRevenue = totalRevenue,
            TotalExpense = totalExpense,
            NetProfit = netProfit,
            ResultType = resultType,
            ResultText = resultText
        };
    }

    // DTO داخلی برای Dapper
    internal class RawProfitLossRow
    {
        public int GroupTypeCode { get; set; }
        public string GroupTypeName { get; set; } = "";
        public int CodeCol { get; set; }
        public string HesabName { get; set; } = "";
        public decimal SumMabBed { get; set; }
        public decimal SumMabBes { get; set; }
    }
}