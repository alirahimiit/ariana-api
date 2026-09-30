namespace ArianaAPI.Application.Dtos.Reports.ArticleRotate;

public class ArticleRotateRequestDto
{
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public long? StockId { get; set; }
    public long? ArticleGroupId { get; set; }
    public long? ArticleId { get; set; }
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }

    /// <summary>0=همه | 1=فقط دارای موجودی | 2=فقط بدون موجودی</summary>
    public int MandehFilter { get; set; } = 0;

    /// <summary>name | code | groupCode | groupName</summary>
    public string OrderBy { get; set; } = "name";

    // ⭐ صفحه‌بندی
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class ArticleRotateItemDto
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

    public decimal BuyQty { get; set; }
    public decimal BuyVal { get; set; }

    public decimal BuyBackQty { get; set; }
    public decimal BuyBackVal { get; set; }

    public decimal SellQty { get; set; }
    public decimal SellVal { get; set; }

    public decimal SellBackQty { get; set; }
    public decimal SellBackVal { get; set; }

    public decimal ScrapQty { get; set; }
    public decimal ScrapVal { get; set; }

    public decimal FinalQty { get; set; }
    public decimal FinalVal { get; set; }
}

public class ArticleRotateResultDto
{
    public List<ArticleRotateItemDto> Items { get; set; } = new();
    public int TotalCount { get; set; }

    // ⭐ صفحه‌بندی
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }

    // ─── جمع‌ها (از همه‌ی ردیف‌ها، نه فقط صفحه‌ی فعلی) ───
    public decimal TotalAmountFirst { get; set; }
    public decimal TotalCostFirst { get; set; }
    public decimal TotalBuyQty { get; set; }
    public decimal TotalBuyVal { get; set; }
    public decimal TotalSellQty { get; set; }
    public decimal TotalSellVal { get; set; }
    public decimal TotalFinalQty { get; set; }
    public decimal TotalFinalVal { get; set; }
}