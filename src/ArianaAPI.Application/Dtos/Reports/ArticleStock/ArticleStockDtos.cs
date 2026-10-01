namespace ArianaAPI.Application.Dtos.Reports.ArticleStock;

public class ArticleStockRequestDto
{
    public long? StockId { get; set; }
    public long? ArticleGroupId { get; set; }
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }
    public int StockFilter { get; set; } = 0;
    public string OrderBy { get; set; } = "name";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class ArticleStockItemDto
{
    public long ArticleId { get; set; }
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }
    public string? ArticleUnitName { get; set; }
    public string? ArticleGroupCode { get; set; }
    public string? ArticleGroupName { get; set; }
    public string? StockTypeCode { get; set; }
    public string? StockTypeName { get; set; }
    public decimal AmountFirst { get; set; }
    public decimal CostFirst { get; set; }
    public decimal TotalBuyQty { get; set; }
    public decimal TotalBuyVal { get; set; }
    public decimal TotalSellQty { get; set; }
    public decimal TotalSellVal { get; set; }
    public decimal FinalQty { get; set; }
    public decimal FinalVal { get; set; }
    public decimal AvgPrice { get; set; }
    public decimal SalePrice { get; set; }
}

public class ArticleStockResultDto
{
    public List<ArticleStockItemDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    public decimal TotalFinalQty { get; set; }
    public decimal TotalFinalVal { get; set; }
    public decimal TotalCostFirst { get; set; }
    public int WithStockCount { get; set; }
    public int ZeroCount { get; set; }
    public int NegativeCount { get; set; }
}