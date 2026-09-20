using ArianaAPI.Application.Dtos.Reports;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;
using Microsoft.Extensions.Logging;

namespace ArianaAPI.Infrastructure.Repositories;

public class BilanRepository : IBilanRepository
{
    private readonly ITenantConnectionFactory _factory;
    private readonly ILogger<BilanRepository> _logger;

    // ─── کدهای GroupType مطابق دلفی ───
    private const int GT_DARAEI = 1;  // دارایی → Asset
    private const int GT_BEDEHI = 2;  // بدهی  → Liability

    public BilanRepository(
        ITenantConnectionFactory factory,
        ILogger<BilanRepository> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task<BilanResultDto> GetReportAsync(
        long orgId, long fyId, BilanRequestDto req, CancellationToken ct = default)
    {
        await using var conn = _factory.CreateTenantConnection(orgId, fyId);
        await conn.OpenAsync(ct);

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
    WHERE GT.GroupTypeCode IN (1, 2)
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

        _logger.LogDebug("Bilan - from={From}, to={To}", fromDate, toDate);

        var rows = (await conn.QueryAsync<RawBilanRow>(
            new CommandDefinition(sql, new { fromDate, toDate }, cancellationToken: ct))).ToList();

        var assets = new List<BilanGroupDto>();
        var liabilities = new List<BilanGroupDto>();
        var groupMap = new Dictionary<int, BilanGroupDto>();

        foreach (var row in rows)
        {
            if (!groupMap.TryGetValue(row.GroupTypeCode, out var group))
            {
                bool isAsset = row.GroupTypeCode == GT_DARAEI;

                group = new BilanGroupDto
                {
                    GroupTypeCode = row.GroupTypeCode,
                    GroupTypeName = row.GroupTypeName,
                    Nature = isAsset ? "asset" : "liability"
                };

                groupMap[row.GroupTypeCode] = group;
                if (isAsset) assets.Add(group);
                else liabilities.Add(group);
            }

            // مانده = بدهکار − بستانکار (برای هر دو ماهیت)
            decimal mabMan = row.SumMabBed - row.SumMabBes;

            if (!req.IncludeZeroBalance && mabMan == 0 && row.SumMabBed == 0 && row.SumMabBes == 0)
                continue;

            group.Items.Add(new BilanItemDto
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

        decimal totalAssets = assets.Sum(g => g.Total);
        decimal totalLiabilities = Math.Abs(liabilities.Sum(g => g.Total));
        decimal diff = totalAssets - totalLiabilities;

        return new BilanResultDto
        {
            FromDate = fromDate,
            ToDate = toDate,
            Assets = assets,
            Liabilities = liabilities,
            TotalAssets = totalAssets,
            TotalLiabilities = totalLiabilities,
            Difference = diff,
            IsBalanced = Math.Abs(diff) < 1,
            ResultText = Math.Abs(diff) < 1 ? "تراز است ✅" : "تراز نیست ⚠️"
        };
    }

    internal class RawBilanRow
    {
        public int GroupTypeCode { get; set; }
        public string GroupTypeName { get; set; } = "";
        public int CodeCol { get; set; }
        public string HesabName { get; set; } = "";
        public decimal SumMabBed { get; set; }
        public decimal SumMabBes { get; set; }
    }
}