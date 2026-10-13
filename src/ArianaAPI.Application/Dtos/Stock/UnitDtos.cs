namespace ArianaAPI.Application.DTOs.Stock;

public class UnitRequestDto
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? SortColumn { get; set; }
    public string? SortDir { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class UnitListDto
{
    public long Id { get; set; }
    public decimal Code { get; set; }
    public string? Name { get; set; }
    public decimal? TabileUnit { get; set; }
    public long? TaxId { get; set; }
    public int ArticleCount { get; set; }
}

public class UnitListResultDto
{
    public List<UnitListDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

public class UnitDetailDto
{
    public long Id { get; set; }
    public decimal Code { get; set; }
    public string? Name { get; set; }
    public decimal? TabileUnit { get; set; }
    public long? TaxId { get; set; }
    public int ArticleCount { get; set; }
}

public class UnitCreateDto
{
    public long? Code { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? TabileUnit { get; set; }
    public long? TaxId { get; set; }
}

public class UnitUpdateDto : UnitCreateDto
{
    public long Id { get; set; }
}

public class UnitCreateResultDto
{
    public long Id { get; set; }
    public long Code { get; set; }
}

public class UnitUsageDto
{
    public bool CanDelete { get; set; }
    public int ArticleCount { get; set; }
    public string? Reason { get; set; }
}