using ArianaAPI.Application.DTOs.Ledger;

namespace ArianaAPI.Infrastructure.Models;

internal class LedgerRowWithCount
{
    public long SanadID { get; set; }
    public long SortKey { get; set; }   // ⭐ اضافه شد
    public long ParentSanadID { get; set; }
    public int? NoSanad { get; set; }
    public string? DateIn { get; set; }
    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public int? CodeTafzili2 { get; set; }
    public string? ColName { get; set; }
    public string? MoeinName { get; set; }
    public string? TafzilName { get; set; }
    public string? Tafzili2Name { get; set; }
    public decimal MabBed { get; set; }
    public decimal MabBes { get; set; }
    public decimal? Meghdar { get; set; }
    public string? OtherSharh { get; set; }
    public string? OtherParentSharh { get; set; }
    public int? TikRow { get; set; }
    public int TotalCount { get; set; }

    public LedgerItemDto ToItem() => new()
    {
        SanadID = SanadID,
        ParentSanadID = ParentSanadID,
        NoSanad = NoSanad,
        DateIn = DateIn,
        CodeCol = CodeCol,
        CodeMoein = CodeMoein,
        CodeTafzil = CodeTafzil,
        CodeTafzili2 = CodeTafzili2,
        ColName = ColName,
        MoeinName = MoeinName,
        TafzilName = TafzilName,
        Tafzili2Name = Tafzili2Name,
        MabBed = MabBed,
        MabBes = MabBes,
        Meghdar = Meghdar,
        OtherSharh = OtherSharh,
        OtherParentSharh = OtherParentSharh,
        TikRow = TikRow
    };
}