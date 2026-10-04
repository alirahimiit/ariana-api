namespace ArianaAPI.Application.Dtos.Moadian;

public class MoadianPendingListRequestDto
{
    /// <summary>جستجو در: شماره فاکتور، کد مشتری، نام مشتری</summary>
    public string? Search { get; set; }

    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }

    /// <summary>no | date | amount | customer</summary>
    public string SortBy { get; set; } = "date";

    /// <summary>asc | desc</summary>
    public string SortDir { get; set; } = "desc";

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class MoadianPendingListItemDto
{
    public long Id { get; set; }
    public string? FldFacNo { get; set; }
    public string? FldFacDate { get; set; }
    public string? FldSumKol { get; set; }
    public long CustomerCode { get; set; }
    public string? FldCustName { get; set; }
    public int IsCash { get; set; }
}

public class MoadianPendingListResultDto
{
    public List<MoadianPendingListItemDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}