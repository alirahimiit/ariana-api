namespace ArianaAPI.Application.DTOs.Stock;

// ═══════════════════════════════════════════
//  Request
// ═══════════════════════════════════════════
public class StockTypeRequestDto
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public int? Kind { get; set; }              // 0=کالا، 1=محصول
    public bool? ForEst { get; set; }

    public string? SortColumn { get; set; }
    public string? SortDir { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

// ═══════════════════════════════════════════
//  List
// ═══════════════════════════════════════════
public class StockTypeListDto
{
    public long Id { get; set; }
    public decimal Code { get; set; }
    public string? Name { get; set; }
    public int? Kind { get; set; }
    public string? KindName { get; set; }
    public bool? ForEst { get; set; }

    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public int? CodeTafzil2 { get; set; }

    // آمار
    public int ArticleGroupCount { get; set; }
    public int ArticleCount { get; set; }
}

public class StockTypeListResultDto
{
    public List<StockTypeListDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

// ═══════════════════════════════════════════
//  Detail
// ═══════════════════════════════════════════
public class StockTypeDetailDto
{
    public long Id { get; set; }
    public decimal Code { get; set; }
    public string? Name { get; set; }
    public int? Kind { get; set; }
    public bool? ForEst { get; set; }

    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public int? CodeTafzil2 { get; set; }

    // 7 چک‌باکس
    public bool? IsRegMinOrderToIn { get; set; }
    public bool? IsRegMaxOrderToOut { get; set; }
    public bool? IsRegNegativKala { get; set; }
    public bool? NotCalcPerDiscount { get; set; }
    public bool? NotCalcArezeshafzode { get; set; }
    public bool? IsCalcUnit2 { get; set; }
    public bool? IsCalcUnit3 { get; set; }
}

// ═══════════════════════════════════════════
//  Create / Update
// ═══════════════════════════════════════════
public class StockTypeCreateDto
{
    public long? Code { get; set; }              // null → MAX+1
    public string Name { get; set; } = string.Empty;
    public int? Kind { get; set; }
    public bool? ForEst { get; set; }

    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public int? CodeTafzil2 { get; set; }

    public bool? IsRegMinOrderToIn { get; set; }
    public bool? IsRegMaxOrderToOut { get; set; }
    public bool? IsRegNegativKala { get; set; }
    public bool? NotCalcPerDiscount { get; set; }
    public bool? NotCalcArezeshafzode { get; set; }
    public bool? IsCalcUnit2 { get; set; }
    public bool? IsCalcUnit3 { get; set; }
}

public class StockTypeUpdateDto : StockTypeCreateDto
{
    public long Id { get; set; }
}

public class StockTypeCreateResultDto
{
    public long Id { get; set; }
    public long Code { get; set; }
}

// ═══════════════════════════════════════════
//  Usage (قبل از حذف)
// ═══════════════════════════════════════════
public class StockTypeUsageDto
{
    public bool CanDelete { get; set; }
    public int ArticleGroupCount { get; set; }
    public int ArticleCount { get; set; }
    public string? Reason { get; set; }
}