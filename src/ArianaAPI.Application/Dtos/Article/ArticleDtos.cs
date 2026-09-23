namespace ArianaAPI.Application.DTOs.Article;

// ═══════════════════════════════════════════
//  Request
// ═══════════════════════════════════════════
public class ArticleRequestDto
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? TaxId { get; set; }
    public long? GroupId { get; set; }
    public long? StockTypeId { get; set; }
    public long? UnitId { get; set; }
    public int? Status { get; set; }
    public string StockFilter { get; set; } = "all";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

// ═══════════════════════════════════════════
//  List
// ═══════════════════════════════════════════
public class ArticleListDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
    public long? TaxId { get; set; }

    // ⭐ گروه و انبار
    public long? ArticleGroupId { get; set; }
    public string? ArticleGroupName { get; set; }
    public decimal? ArticleGroupCode { get; set; }      // ← جدید

    public long? StockTypeId { get; set; }
    public string? StockTypeName { get; set; }
    public decimal? StockTypeCode { get; set; }         // ← جدید

    // ⭐ واحد
    public long? ArticleUnitId { get; set; }
    public string? ArticleUnitName { get; set; }

    // ⭐ قیمت و موجودی
    public decimal? AmountSale { get; set; }
    public decimal? MarketerPercent { get; set; }
    public string? ArticleCoding { get; set; }
    public decimal? FinallExistence { get; set; }

    // ⭐ آمار حرکات (از ArticleNew)
    public decimal? AmountFirst { get; set; }       // موجودی اولیه مقدار
    public double? CostFirst { get; set; }          // موجودی اولیه ریالی
    public decimal? InAmount1 { get; set; }         // خرید مقدار
    public decimal? InVal1 { get; set; }            // خرید ریالی
    public decimal? OutAmount1 { get; set; }        // فروش مقدار
    public decimal? OutVal1 { get; set; }           // فروش ریالی
    public decimal? BackAmount1 { get; set; }       // برگشت مقدار
    public decimal? BackVal1 { get; set; }          // برگشت ریالی
    public decimal? FinalAmount1 { get; set; }      // موجودی فعلی مقدار
    public decimal? FinalVal1 { get; set; }         // موجودی فعلی ریالی

    // ⭐ وضعیت
    public int? Status { get; set; }
    public string? StatusName { get; set; }
}

public class ArticleListResultDto
{
    public List<ArticleListDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

// ═══════════════════════════════════════════
//  Detail
// ═══════════════════════════════════════════
public class ArticleDetailDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
    public long? TaxId { get; set; }
    public string? ArticleCoding { get; set; }
    public string? CodingStore { get; set; }
    public string? CodingGroupStore { get; set; }

    public long? ArticleGroupId { get; set; }
    public decimal? ArticleGroupCode { get; set; }
    public string? ArticleGroupName { get; set; }

    public long? StockTypeId { get; set; }
    public decimal? StockTypeCode { get; set; }
    public string? StockTypeName { get; set; }
    public int? StockTypeKind { get; set; }

    public long? ArticleUnitId { get; set; }
    public string? ArticleUnitName { get; set; }
    public long? ArticleUnitId2 { get; set; }
    public string? ArticleUnitName2 { get; set; }
    public long? ArticleUnitId3 { get; set; }
    public string? ArticleUnitName3 { get; set; }
    public decimal? Tabdil1 { get; set; }
    public decimal? Tabdil2 { get; set; }
    public decimal? Tabdil3 { get; set; }

    public decimal? CodeCol { get; set; }
    public decimal? CodeMoein { get; set; }
    public decimal? CodeTafzil { get; set; }

    public decimal? CodeColBuy { get; set; }
    public decimal? CodeMoeinBuy { get; set; }
    public decimal? CodeTafzilBuy { get; set; }

    public decimal? CodeColReBuy { get; set; }
    public decimal? CodeMoeinReBuy { get; set; }
    public decimal? CodeTafzilReBuy { get; set; }

    public decimal? CodeColReSale { get; set; }
    public decimal? CodeMoeinReSale { get; set; }
    public decimal? CodeTafzilReSale { get; set; }

    public decimal? AmountSale { get; set; }

    public decimal? MarketerPercent { get; set; }
    public double? MaxCostOrderBy { get; set; }
    public double? MinCostOrderBy { get; set; }

    public bool? XIsRegMinOrderToIn { get; set; }
    public bool? XIsRegMaxOrderToOut { get; set; }
    public bool? XIsRegNegativKala { get; set; }
    public bool? XNotCalcPerDiscount { get; set; }
    public bool? XNotCalcArezeshafzode { get; set; }
    public bool? XIsCalcUnit2 { get; set; }
    public bool? XIsCalcUnit3 { get; set; }

    public decimal? Depreciation { get; set; }
    public int? DepreciationType { get; set; }
    public string? DepreciationTypeName { get; set; }

    public int? Status { get; set; }
    public string? StatusName { get; set; }
    public int? Kind { get; set; }
    public int? ForEst { get; set; }

    public decimal? FirstExistence { get; set; }
    public decimal? Inputed { get; set; }
    public decimal? OutPuted { get; set; }
    public decimal? Loss1 { get; set; }
    public decimal? Loss2 { get; set; }
    public decimal? FinallExistence { get; set; }

    // ⭐ آمار حرکات (از ArticleNew)
    public decimal? AmountFirst { get; set; }       // موجودی اولیه (مقدار)
    public double? CostFirst { get; set; }          // ارزش اولیه (ریالی)
    public decimal? InAmount1 { get; set; }         // خرید (مقدار)
    public decimal? InVal1 { get; set; }            // خرید (ریالی)
    public decimal? OutAmount1 { get; set; }        // فروش (مقدار)
    public decimal? OutVal1 { get; set; }           // فروش (ریالی)
    public decimal? BackAmount1 { get; set; }       // برگشت (مقدار)
    public decimal? BackVal1 { get; set; }          // برگشت (ریالی)
    public decimal? FinalAmount1 { get; set; }      // موجودی فعلی (مقدار)
    public decimal? FinalVal1 { get; set; }         // موجودی فعلی (ریالی)
}

// ═══════════════════════════════════════════
//  Update
// ═══════════════════════════════════════════
public class ArticleUpdateDto
{
    public string? Name { get; set; }
    public long? TaxId { get; set; }
    public string? ArticleCoding { get; set; }
    public string? CodingStore { get; set; }
    public string? CodingGroupStore { get; set; }

    public decimal? ArticleGroupId { get; set; }
    public decimal? ArticleUnitId { get; set; }
    public decimal? ArticleUnitId2 { get; set; }
    public decimal? ArticleUnitId3 { get; set; }

    public decimal? CodeCol { get; set; }
    public decimal? CodeMoein { get; set; }
    public decimal? CodeTafzil { get; set; }

    public decimal? CodeColBuy { get; set; }
    public decimal? CodeMoeinBuy { get; set; }
    public decimal? CodeTafzilBuy { get; set; }

    public decimal? CodeColReBuy { get; set; }
    public decimal? CodeMoeinReBuy { get; set; }
    public decimal? CodeTafzilReBuy { get; set; }

    public decimal? CodeColReSale { get; set; }
    public decimal? CodeMoeinReSale { get; set; }
    public decimal? CodeTafzilReSale { get; set; }

    public decimal? AmountFirst { get; set; }
    public double? CostFirst { get; set; }
    public decimal? AmountSale { get; set; }

    public decimal? MarketerPercent { get; set; }
    public double? MaxCostOrderBy { get; set; }
    public double? MinCostOrderBy { get; set; }

    public decimal? Depreciation { get; set; }
    public int? DepreciationType { get; set; }

    public int? Status { get; set; }
}

// ═══════════════════════════════════════════
//  Create
// ═══════════════════════════════════════════
public class ArticleCreateDto
{
    public string? Name { get; set; }
    public long? TaxId { get; set; }
    public string? ArticleCoding { get; set; }

    public long StockTypeId { get; set; }
    public long ArticleGroupId { get; set; }

    public decimal? ArticleUnitId { get; set; }
    public decimal? ArticleUnitId2 { get; set; }
    public decimal? ArticleUnitId3 { get; set; }

    public decimal? CodeCol { get; set; }
    public decimal? CodeMoein { get; set; }
    public decimal? CodeTafzil { get; set; }

    public decimal? CodeColBuy { get; set; }
    public decimal? CodeMoeinBuy { get; set; }
    public decimal? CodeTafzilBuy { get; set; }

    public decimal? CodeColReBuy { get; set; }
    public decimal? CodeMoeinReBuy { get; set; }
    public decimal? CodeTafzilReBuy { get; set; }

    public decimal? CodeColReSale { get; set; }
    public decimal? CodeMoeinReSale { get; set; }
    public decimal? CodeTafzilReSale { get; set; }

    public decimal? AmountFirst { get; set; }
    public double? CostFirst { get; set; }
    public decimal? AmountSale { get; set; }
    public decimal? MarketerPercent { get; set; }
    public double? MaxCostOrderBy { get; set; }
    public double? MinCostOrderBy { get; set; }

    public decimal? Depreciation { get; set; }
    public int? DepreciationType { get; set; }

    public int? Status { get; set; }
}

public class ArticleNextCodeDto
{
    public string FullCode { get; set; } = "";
    public long Code { get; set; }
    public string CodingStore { get; set; } = "";
    public string CodingGroupStore { get; set; } = "";
    public int Sequence { get; set; }
}

public class ArticleCreateResultDto
{
    public long Id { get; set; }
    public long Code { get; set; }
    public string FullCode { get; set; } = "";
}

// ═══════════════════════════════════════════
//  Lookups
// ═══════════════════════════════════════════
public class ArticleLookupsDto
{
    public List<ArticleGroupLookupDto> Groups { get; set; } = new();
    public List<ArticleUnitLookupDto> Units { get; set; } = new();
    public List<StockTypeLookupDto> StockTypes { get; set; } = new();
}

public class ArticleGroupLookupDto
{
    public long Id { get; set; }
    public long? StockTypeId { get; set; }
    public string? StockTypeName { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
}

public class ArticleUnitLookupDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
}

public class StockTypeLookupDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
}