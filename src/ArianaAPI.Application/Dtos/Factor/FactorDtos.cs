namespace ArianaAPI.Application.DTOs.Factor;

public class FactorRequestDto
{
    /// <summary>نوع فاکتور: null=همه، 0=خرید، 1=فروش، 2=برگشت خرید، 3=برگشت فروش، 4=پیش‌فاکتور</summary>
    public int? FactorKind { get; set; }

    // ─── شماره فاکتور ───
    public long? NoFrom { get; set; }
    public long? NoTo { get; set; }

    // ─── مبلغ ───
    public decimal? CostFrom { get; set; }
    public decimal? CostTo { get; set; }

    // ─── تاریخ ───
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }

    // ─── طرف حساب ───
    public int? CodeTafzil { get; set; }
    public string? HesabName { get; set; }

    // ─── شرح ───
    public string? Descript { get; set; }

    // ─── کالا ───
    public string? ArticleCode { get; set; }
    public string? ArticleName { get; set; }

    // ─── صفحه‌بندی ───
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class FactorListDto
{
    public long Id { get; set; }
    public long? NoFactor { get; set; }
    public string? DateIn { get; set; }
    public string? Descript { get; set; }
    public int FactorKind { get; set; }
    public string? FactorKindTitle { get; set; }
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public int? IsCash { get; set; }
    public string? IsCashName { get; set; }
    public decimal Cost { get; set; }
    public long? NoSanad { get; set; }
    public string? DateSanad { get; set; }
    public string? MarkerName { get; set; }
    public decimal TransCost { get; set; }
}

public class FactorDetailDto
{
    public long Id { get; set; }
    public long? NoFactor { get; set; }
    public string? DateIn { get; set; }
    public string? Descript { get; set; }
    public int FactorKind { get; set; }
    public string? FactorKindTitle { get; set; }
    public decimal Cost { get; set; }
    public decimal TransCost { get; set; }
    public string? CarInfo { get; set; }

    // ─── طرف حساب ───
    public long? CodeTafzil { get; set; }
    public string? HesabName { get; set; }
    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? EconomicCode { get; set; }
    public string? NationalCode { get; set; }
    public string? PostalCode { get; set; }
    public string? Address { get; set; }
    public string? StateName { get; set; }
    public string? CityName1 { get; set; }
    public string? CityName2 { get; set; }

    // ─── سند ───
    public long? ParentSanadId { get; set; }
    public long? NoSanad { get; set; }
    public string? DateSanad { get; set; }

    // ─── بازاریاب ───
    public int? CodeTafMarketer { get; set; }
    public string? MarkerName { get; set; }
    public string? MarkerMobile { get; set; }
}

public class FactorItemDto
{
    public long Id { get; set; }

    public long ArticleId { get; set; }
    public decimal? ArticleCode { get; set; }
    public string? ArticleName { get; set; }
    public string? ArticleUnitName { get; set; }
    public string? ArticleGroupName { get; set; }

    public decimal ArticleCount { get; set; }
    public decimal ArticleCount2 { get; set; }
    public decimal ArticleCount3 { get; set; }

    public decimal Cost { get; set; }
    public decimal CostItem { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal TransCost { get; set; }
    public decimal CostTax { get; set; }
    public decimal FinallCost { get; set; }

    public decimal PerDiscount { get; set; }
    public decimal MarketerPercent { get; set; }
    public decimal MarketerCosts { get; set; }

    public decimal DegreeKala { get; set; }
    public decimal DropKala { get; set; }
    public decimal TaxFi { get; set; }
}

public class FactorResultDto
{
    public FactorDetailDto Header { get; set; } = new();
    public List<FactorItemDto> Items { get; set; } = new();

    // ─── جمع‌ها ───
    public int TotalRows { get; set; }
    public decimal TotalCostItem { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalTax { get; set; }
    public decimal TotalTransCost { get; set; }
    public decimal TotalFinall { get; set; }
}

public class FactorListResultDto
{
    public List<FactorListDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}