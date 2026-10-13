namespace ArianaAPI.Application.DTOs.Tafzili2;

// ═══════════════════════════════════════════
//  Request — فیلتر/سورت/صفحه
// ═══════════════════════════════════════════
public class Tafzili2RequestDto
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public long? TafziliGroupCode { get; set; }

    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? MelliCode { get; set; }
    public string? EconomicCode { get; set; }
    public string? Address { get; set; }

    // ⭐ سورت
    public string? SortColumn { get; set; }
    public string? SortDir { get; set; }   // asc | desc

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

// ═══════════════════════════════════════════
//  List DTO
// ═══════════════════════════════════════════
public class Tafzili2ListDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }

    public long? TafziliGroupCode { get; set; }
    public string? TafziliGroupName { get; set; }

    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? MelliCode { get; set; }
    public string? EconomicCode { get; set; }

    public bool? IsSaleMan { get; set; }
    public bool? IsStock { get; set; }

    public string? CreatorName { get; set; }
    public DateTime? CreatorDate { get; set; }
    public string? UpdaterName { get; set; }
    public DateTime? UpdaterDate { get; set; }
}

public class Tafzili2ListResultDto
{
    public List<Tafzili2ListDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

// ═══════════════════════════════════════════
//  Detail DTO
// ═══════════════════════════════════════════
public class Tafzili2DetailDto
{
    public long Id { get; set; }
    public decimal? Code { get; set; }
    public string? Name { get; set; }

    public long? TafziliGroupCode { get; set; }
    public string? TafziliGroupName { get; set; }

    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }

    public int? StateId { get; set; }
    public string? StateName { get; set; }
    public int? CityId { get; set; }
    public string? CityName1 { get; set; }
    public int? CityId2 { get; set; }
    public string? CityName2 { get; set; }

    public string? MelliCode { get; set; }
    public string? EconomicCode { get; set; }
    public string? NationalCode { get; set; }

    public bool? IsSaleMan { get; set; }
    public bool? IsStock { get; set; }
    public bool? HasTafzili2 { get; set; }

    // audit
    public string? CreatorName { get; set; }
    public DateTime? CreatorDate { get; set; }
    public string? UpdaterName { get; set; }
    public DateTime? UpdaterDate { get; set; }
}

// ═══════════════════════════════════════════
//  Create / Update
// ═══════════════════════════════════════════
public class Tafzili2CreateDto
{
    /// <summary>اگه null یا 0، خودکار MAX+1</summary>
    public long? Code { get; set; }

    public string Name { get; set; } = string.Empty;
    public long? TafziliGroupCode { get; set; }

    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }

    public int? StateId { get; set; }
    public int? CityId { get; set; }
    public int? CityId2 { get; set; }

    public string? MelliCode { get; set; }
    public string? EconomicCode { get; set; }
    public string? NationalCode { get; set; }

    public bool? IsSaleMan { get; set; }
    public bool? IsStock { get; set; }
    public bool? HasTafzili2 { get; set; }
}

public class Tafzili2UpdateDto : Tafzili2CreateDto
{
    public long Id { get; set; }
}

public class Tafzili2CreateResultDto
{
    public long Id { get; set; }
    public long Code { get; set; }
}

// ═══════════════════════════════════════════
//  Usage — چک قبل از حذف
// ═══════════════════════════════════════════
public class Tafzili2UsageDto
{
    public bool CanDelete { get; set; }
    public int SanadCount { get; set; }
    public string? Reason { get; set; }
}