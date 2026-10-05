namespace ArianaAPI.Application.Dtos.Moadian;

public class MoadianHeaderListRequestDto
{
    /// <summary>جستجو در: شماره فاکتور، نام مشتری، سریال، RefNumber</summary>
    public string? Search { get; set; }

    /// <summary>0-3 یا null برای همه</summary>
    public int? Status { get; set; }

    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }

    /// <summary>date | serial | amount | customer | factor | status</summary>
    public string SortBy { get; set; } = "date";

    /// <summary>asc | desc</summary>
    public string SortDir { get; set; } = "desc";

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class MoadianHeaderListItemDto
{
    public long Id { get; set; }
    public int Status { get; set; }
    public string? Inno { get; set; }
    public string? IndatimPersian { get; set; }
    public long? FactorId { get; set; }
    public string? FactorNo { get; set; }        // FactorParent.NoFactor
    public long CustomerCode { get; set; }
    public string? CustomerName { get; set; }    // Hesab.Name
    public decimal? Tbill { get; set; }
    public string? RefNumber { get; set; }
    public string? TaxId { get; set; }
    public string? Uid { get; set; }
    public int? Inty { get; set; }               // ⭐ نوع: 1/2/3
    public int? Ins { get; set; }                // ⭐ موضوع: 1/2/3/4
    public string? IrTaxId { get; set; }         // ⭐ فاکتور مرجع (برای ابطالی/اصلاحی)
}

public class MoadianHeaderListResultDto
{
    public List<MoadianHeaderListItemDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }

    // آمار (مستقل از صفحه‌بندی)
    public int CountAll { get; set; }
    public int CountPending { get; set; }
    public int CountSent { get; set; }
    public int CountError { get; set; }
    public int CountSuccess { get; set; }
    

}

public class CustomerTaxInfo
{
    public long CodeTafzil { get; set; }
    public string? Name { get; set; }
    public int Kind { get; set; }
    public string? EconomicCode { get; set; }
    public string? MelliCode { get; set; }
    public string? NationalCode { get; set; }
}