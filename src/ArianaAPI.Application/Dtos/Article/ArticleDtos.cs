namespace ArianaAPI.Application.DTOs.Article;

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

public class ArticleListDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
    public long? TaxId { get; set; }          // ← جدید


    public long? ArticleGroupId { get; set; }
    public string? ArticleGroupName { get; set; }

    public long? StockTypeId { get; set; }
    public string? StockTypeName { get; set; }

    public long? ArticleUnitId { get; set; }
    public string? ArticleUnitName { get; set; }

    public decimal? AmountSale { get; set; }
    public decimal? MarketerPercent { get; set; }

    public string? ArticleCoding { get; set; }
    public int? Status { get; set; }
    public string? StatusName { get; set; }

    // از Article_View (موجودی)
    public decimal? FinallExistence { get; set; }
}

public class ArticleDetailDto
{
    // ─── اطلاعات پایه ───
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }
    public string? ArticleCoding { get; set; }
    public string? CodingStore { get; set; }
    public string? CodingGroupStore { get; set; }

    // ─── گروه و انبار ───
    public long? ArticleGroupId { get; set; }
    public decimal? ArticleGroupCode { get; set; }
    public string? ArticleGroupName { get; set; }

    public long? StockTypeId { get; set; }
    public decimal? StockTypeCode { get; set; }
    public string? StockTypeName { get; set; }
    public int? StockTypeKind { get; set; }

    // ─── واحدها ───
    public long? ArticleUnitId { get; set; }
    public string? ArticleUnitName { get; set; }
    public long? ArticleUnitId2 { get; set; }
    public string? ArticleUnitName2 { get; set; }
    public long? ArticleUnitId3 { get; set; }
    public string? ArticleUnitName3 { get; set; }
    public decimal? Tabdil1 { get; set; }
    public decimal? Tabdil2 { get; set; }
    public decimal? Tabdil3 { get; set; }

    // ─── کدینگ حسابداری ───
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

    // ─── قیمت‌ها ───
    public decimal? AmountFirst { get; set; }
    public double? CostFirst { get; set; }
    public decimal? AmountSale { get; set; }

    // ─── تنظیمات ───
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

    // ─── استهلاک ───
    public decimal? Depreciation { get; set; }
    public int? DepreciationType { get; set; }
    public string? DepreciationTypeName { get; set; }

    // ─── وضعیت ───
    public int? Status { get; set; }
    public string? StatusName { get; set; }
    public int? Kind { get; set; }
    public int? ForEst { get; set; }

    // ─── موجودی ───
    public decimal? FirstExistence { get; set; }
    public decimal? Inputed { get; set; }
    public decimal? OutPuted { get; set; }
    public decimal? Loss1 { get; set; }
    public decimal? Loss2 { get; set; }
    public decimal? FinallExistence { get; set; }
}

public class ArticleListResultDto
{
    public List<ArticleListDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}