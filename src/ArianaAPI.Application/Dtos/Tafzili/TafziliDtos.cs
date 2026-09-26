namespace ArianaAPI.Application.DTOs.Tafzili;

public class TafziliRequestDto
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public long? TafziliGroupId { get; set; }   // ← گروه تفضیلی (مهم)
    public int? Kind { get; set; }               // 0-4
    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? MelliCode { get; set; }
    public string? EconomicCode { get; set; }
    public string? Address { get; set; }

    /// <summary>all | hasMandeh | noMandeh | hasBed | hasBes</summary>
    public string MandehFilter { get; set; } = "all";

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class TafziliGroupDto
{
    public long Id { get; set; }
    public string? Name { get; set; }
}

public class TafziliListDto
{
    public long Id { get; set; }
    public decimal? CodeTafzil { get; set; }
    public string? Name { get; set; }

    public long? TafziliGroupId { get; set; }
    public string? TafziliGroupName { get; set; }

    public int? Kind { get; set; }
    public string? KindName { get; set; }

    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? MelliCode { get; set; }
    public string? EconomicCode { get; set; }

    public decimal? SumBed { get; set; }
    public decimal? SumBes { get; set; }
    public decimal? MabMandeh { get; set; }
    public decimal? MabManBed { get; set; }
    public decimal? MabManBes { get; set; }
}

public class TafziliDetailDto
{
    public long Id { get; set; }
    public decimal? CodeTafzil { get; set; }
    public string? Name { get; set; }
    public string? Discript { get; set; }

    // ─── گروه تفضیلی ───
    public long? TafziliGroupId { get; set; }
    public string? TafziliGroupName { get; set; }

    // ─── نوع ───
    public int? Kind { get; set; }
    public string? KindName { get; set; }

    // ─── تماس ───
    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? Address { get; set; }

    // ─── اطلاعات مالی ───
    public string? AccountNumber { get; set; }    // شماره حساب بانکی
    public string? JobName { get; set; }          // شغل
    public string? MelliCode { get; set; }        // کد ملی
    public string? EconomicCode { get; set; }     // کد اقتصادی
    public string? NationalCode { get; set; }     // شناسه ثبت
    public string? PostalCode { get; set; }       // کد پستی

    // ─── موقعیت ───
    public int? StateId { get; set; }
    public string? StateName { get; set; }
    public int? CityId { get; set; }
    public string? CityName1 { get; set; }
    public int? CityId2 { get; set; }
    public string? CityName2 { get; set; }

    // ─── وضعیت ───
    public int? Mahiat { get; set; }
    public int? Vaziat { get; set; }
    public bool? IsSaleMan { get; set; }
    public bool? IsStock { get; set; }

    // ─── مانده ───
    public decimal? SumBed { get; set; }
    public decimal? SumBes { get; set; }
    public decimal? MabManBed { get; set; }
    public decimal? MabManBes { get; set; }
    public decimal? MabMandeh { get; set; }
}

public class TafziliListResultDto
{
    public List<TafziliListDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

public class TafziliGroupSaveDto
{
    public long? Id { get; set; }             // null = جدید
    public string Name { get; set; } = string.Empty;
}

public class TafziliCreateDto
{
    public string? Name { get; set; }
    public long? TafziliGroupId { get; set; }
    public int? Kind { get; set; }              // 0-4
    public string? Discript { get; set; }

    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? Address { get; set; }
    public string? PostalCode { get; set; }

    public string? AccountNumber { get; set; }
    public string? JobName { get; set; }
    public string? MelliCode { get; set; }
    public string? EconomicCode { get; set; }
    public string? NationalCode { get; set; }

    public int? StateId { get; set; }
    public int? CityId { get; set; }
    public int? CityId2 { get; set; }

    public int? Mahiat { get; set; }            // 1=بدهکار، 2=بستانکار
    public int? Vaziat { get; set; } = 1;       // 0/1
    public bool? IsSaleMan { get; set; }
    public bool? IsStock { get; set; }
}

public class TafziliUpdateDto : TafziliCreateDto
{
    public long Id { get; set; }
}

public class TafziliCreateResultDto
{
    public long Id { get; set; }
    public long CodeTafzil { get; set; }
}