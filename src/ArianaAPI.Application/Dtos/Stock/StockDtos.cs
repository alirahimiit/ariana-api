namespace ArianaAPI.Application.DTOs.Stock;

// ═══ لیست ═══
public class StockRequestDto
{
    public int? Kind { get; set; }
    public long? StockTypeId { get; set; }
    public string? Descript { get; set; }
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public long? SpecialCode { get; set; }
    public long? CodeFrom { get; set; }
    public long? CodeTo { get; set; }
    public int? Vazeit { get; set; }  // -1=بدون سند، 0=پیش‌نویس، 2=قطعی
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
    public string? SortBy { get; set; }
    public string? SortDir { get; set; }
}

public class StockListItemDto
{
    public long Id { get; set; }
    public long Code { get; set; }
    public long? SpecialCode { get; set; }
    public string? DateIn { get; set; }
    public int Kind { get; set; }
    public string? KindTitle { get; set; }
    public string? Des { get; set; }
    public long? StockTypeId { get; set; }
    public long? StockTypeCode { get; set; }
    public string? StockTypeName { get; set; }
    public long? FactorId { get; set; }
    public long? NoFactor { get; set; }
    public long? NoSanad { get; set; }
    public long? ParentSanadId { get; set; }
    public int? Vazeit { get; set; }
    public string? VazeitTitle { get; set; }
    public long? TolidId { get; set; }
    public long? CodeCustomer { get; set; }
    public decimal TotalAmount { get; set; }
    public int RowCount { get; set; }
}

public class StockListResultDto
{
    public List<StockListItemDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

// ═══ جزئیات ═══
public class StockDetailDto
{
    public long Id { get; set; }
    public long Code { get; set; }
    public long? SpecialCode { get; set; }
    public string? DateIn { get; set; }
    public int Kind { get; set; }
    public string? KindTitle { get; set; }
    public string? Des { get; set; }
    public long? StockTypeId { get; set; }
    public string? StockTypeName { get; set; }
    public long? FactorId { get; set; }
    public long? NoFactor { get; set; }
    public long? NoSanad { get; set; }
    public long? ParentSanadId { get; set; }
    public int? Vazeit { get; set; }
    public long? TolidId { get; set; }
    public long? CodeCustomer { get; set; }
    public long? PerFactorId { get; set; }
    public decimal TotalAmount { get; set; }
    public List<StockItemDto> Items { get; set; } = new();
}

public class StockItemDto
{
    public long Id { get; set; }
    public int RowNum { get; set; }
    public long ArticleId { get; set; }
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }
    public string? ArticleUnit { get; set; }
    public string? ArticleGroupName { get; set; }
    public decimal Val { get; set; }
    public decimal Cost { get; set; }
    public decimal Amount { get; set; }
}

// ═══ نوشتن ═══
public class StockWriteDto
{
    public int Kind { get; set; }
    public long? Code { get; set; }
    public long? SpecialCode { get; set; }
    public string? DateIn { get; set; }
    public string? Des { get; set; }
    public long? StockTypeId { get; set; }
    public bool SaveSanad { get; set; }
    public long? NoSanad { get; set; }  // 0 = جدید
    public bool SaveFactor { get; set; }
    public long? NoFactor { get; set; } // 0 = جدید
    public long? CodeTafzil { get; set; }
    public List<StockItemWriteDto> Items { get; set; } = new();
}

public class StockItemWriteDto
{
    public long ArticleId { get; set; }
    public decimal Val { get; set; }
    public decimal Cost { get; set; }
}

public class StockWriteResultDto
{
    public long Id { get; set; }
    public long Code { get; set; }
    public long? SpecialCode { get; set; }
    public long? NoSanad { get; set; }
    public long? NoFactor { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
}

// ═══ Lookups ═══
public class StockLookupsDto
{
    public List<StockTypeLookupItem> StockTypes { get; set; } = new();
    public List<string> Descriptions { get; set; } = new();
    public string TodayDate { get; set; } = "";
}

public class StockTypeLookupItem
{
    public long Id { get; set; }
    public long? Code { get; set; }
    public string? Name { get; set; }
}

public class StockNextNumberDto
{
    public long Code { get; set; }
    public long SpecialCode { get; set; }
    public int Kind { get; set; }
}

public class StockArticleCalcDto
{
    public long ArticleId { get; set; }
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }
    public string? UnitName { get; set; }
    public string? UnitName2 { get; set; }
    public string? UnitName3 { get; set; }
    public decimal Tabdil2 { get; set; }
    public decimal Tabdil3 { get; set; }
    public decimal AmountSale { get; set; }
    public decimal LastBuyCost { get; set; }
    public decimal FinallExistence { get; set; }
    public long? StockTypeId { get; set; }
    public string? StockTypeName { get; set; }
    public bool XIs_RegMinOrderToIn { get; set; }
    public bool XIs_RegMaxOrderToOut { get; set; }
    public bool XIs_RegNegativKala { get; set; }
    public decimal MaxCostOrderBy { get; set; }
    public decimal MinCostOrderBy { get; set; }
}

// ═══ سند ═══
public class StockSanadRequestDto
{
    public long? NoSanad { get; set; }
}

public class StockSanadResultDto
{
    public long StockId { get; set; }
    public long? Code { get; set; }
    public long? NoSanad { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
}

public class FactorListItemDto
{
    public long Id { get; set; }
    public long NoFactor { get; set; }
    public string? DateIn { get; set; }
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public decimal TotalAmount { get; set; }
}