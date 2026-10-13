namespace ArianaAPI.Application.DTOs.Stock;

public class ArticleGroupRequestDto
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public long? StockTypeId { get; set; }
    public string? SortColumn { get; set; }
    public string? SortDir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class ArticleGroupListDto
{
    public long Id { get; set; }
    public long StockTypeId { get; set; }
    public string? StockTypeCode { get; set; }
    public string? StockTypeName { get; set; }
    public decimal Code { get; set; }
    public string? Name { get; set; }
    public decimal? Degree { get; set; }
}

public class ArticleGroupListResultDto
{
    public List<ArticleGroupListDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

public class ArticleGroupDetailDto
{
    public long Id { get; set; }
    public long StockTypeId { get; set; }
    public string? StockTypeName { get; set; }
    public decimal Code { get; set; }
    public string? Name { get; set; }
    public decimal? Degree { get; set; }
    public int ArticleCount { get; set; }
}

public class ArticleGroupCreateDto
{
    public long StockTypeId { get; set; }
    public long? Code { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? Degree { get; set; }
}

public class ArticleGroupUpdateDto : ArticleGroupCreateDto
{
    public long Id { get; set; }
}

public class ArticleGroupCreateResultDto
{
    public long Id { get; set; }
    public long Code { get; set; }
}

public class ArticleGroupUsageDto
{
    public bool CanDelete { get; set; }
    public int ArticleCount { get; set; }
    public string? Reason { get; set; }
}