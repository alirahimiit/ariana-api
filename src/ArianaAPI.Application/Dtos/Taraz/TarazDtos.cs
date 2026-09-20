namespace ArianaAPI.Application.DTOs.Taraz;

public class TarazRequestDto
{
    /// <summary>col | moein | tafzil | tafzil2</summary>
    public string Level { get; set; } = "moein";

    // ─── فیلترها ───
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
    public int? NoFrom { get; set; }
    public int? NoTo { get; set; }
    public int? Vazeit { get; set; }

    public int? FromCodeCol { get; set; }
    public int? ToCodeCol { get; set; }
    public int? FromCodeMoein { get; set; }
    public int? ToCodeMoein { get; set; }
    public int? FromCodeTafzil { get; set; }
    public int? ToCodeTafzil { get; set; }
    public int? CodeTafzili2 { get; set; }
    public int? TafziliGroupId { get; set; }

    /// <summary>all | noZeroMandeh | noZeroGardesh</summary>
    public string FilterOption { get; set; } = "all";

    /// <summary>نمایش همه سطوح کدینگ</summary>
    public bool SetDetail { get; set; } = false;

    // ─── کدهای ویژه ───
    public int? CodeVahed { get; set; }
    public int? CodeMarkazHazine { get; set; }
    public int? CodeProject { get; set; }

    // ─── صفحه‌بندی ───
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 500;
}

public class TarazItemDto
{
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public int CodeTafzili2 { get; set; }

    public string? ColName { get; set; }
    public string? MoeinName { get; set; }
    public string? TafzilName { get; set; }
    public string? Tafzili2Name { get; set; }
    public string? HesabName { get; set; }

    public bool HasTafzili { get; set; }       // ← جدید
    public bool HasTafzili2 { get; set; }      // ← جدید

    public decimal MabBed { get; set; }
    public decimal MabBes { get; set; }
    public decimal MabManBed { get; set; }
    public decimal MabManBes { get; set; }
    public decimal Meghdar { get; set; }
}

public class TarazResultDto
{
    public string Level { get; set; } = "col";
    public List<TarazItemDto> Items { get; set; } = new();

    public decimal TotalBed { get; set; }
    public decimal TotalBes { get; set; }
    public decimal TotalManBed { get; set; }
    public decimal TotalManBes { get; set; }
    public decimal TotalMeghdar { get; set; }

    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

public class TarazSanadRequestDto
{
    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public int? CodeTafzili2 { get; set; }

    public string? FromDate { get; set; }
    public string? ToDate { get; set; }
}

public class TarazSanadItemDto
{
    public long SanadId { get; set; }
    public long ParentSanadId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("noSanad")]
    public int? NoSanad { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("dateIn")]
    public string? DateIn { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("otherParentSharh")]
    public string? OtherParentSharh { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("otherSharh")]
    public string? OtherSharh { get; set; }

    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public int? CodeTafzili2 { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("mabBed")]
    public decimal MabBed { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("mabBes")]
    public decimal MabBes { get; set; }

    public decimal? Meghdar { get; set; }

    public string? ColName { get; set; }
    public string? MoeinName { get; set; }
    public string? TafzilName { get; set; }
    public string? Tafzili2Name { get; set; }
}