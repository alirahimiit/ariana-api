using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Ledger;

public class LedgerRequestDto
{
    /// <summary>col | moein | tafzil | tafzil2</summary>
    public string Level { get; set; } = "col";

    // ─── فیلترهای تاریخ ───
    public string? FromDate { get; set; }
    public string? ToDate { get; set; }

    // ─── فیلترهای شماره سند ───
    public int? NoFrom { get; set; }
    public int? NoTo { get; set; }

    // ─── فیلتر وضعیت ───
    public int? Vazeit { get; set; }

    // ─── فیلترهای حساب (بسته به سطح) ───
    public int? FromCodeCol { get; set; }
    public int? ToCodeCol { get; set; }
    public int? FromCodeMoein { get; set; }
    public int? ToCodeMoein { get; set; }
    public int? FromCodeTafzil { get; set; }
    public int? ToCodeTafzil { get; set; }
    public int? CodeTafzili2 { get; set; }
    public int? TafziliGroupId { get; set; }

    // ─── اختیارات ───
    public bool IncludeMandehBefore { get; set; } = true;
    public int? TikRow { get; set; } // null=همه، 0=بدون تیک، 1=تیک‌دار
                                     // ─── صفحه‌بندی ───
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;   // برای export، مقدار بزرگ می‌فرستیم
}

public class LedgerItemDto
{
    public long SanadID { get; set; }
    public long ParentSanadID { get; set; }

    [JsonPropertyName("noSanad")]
    public int? NoSanad { get; set; }

    [JsonPropertyName("dateIn")]
    public string? DateIn { get; set; }

    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public int? CodeTafzili2 { get; set; }

    public string? ColName { get; set; }
    public string? MoeinName { get; set; }
    public string? TafzilName { get; set; }
    public string? Tafzili2Name { get; set; }

    [JsonPropertyName("mabBed")]
    public decimal MabBed { get; set; }

    [JsonPropertyName("mabBes")]
    public decimal MabBes { get; set; }

    [JsonPropertyName("mabMan")]
    public decimal MabMan { get; set; }

    public decimal? Meghdar { get; set; }

    [JsonPropertyName("otherSharh")]
    public string? OtherSharh { get; set; }

    [JsonPropertyName("otherParentSharh")]
    public string? OtherParentSharh { get; set; }

    public int? TikRow { get; set; }
    public bool IsMandehBefore { get; set; }
   
}

public class LedgerResultDto
{
    public string Level { get; set; } = "col";
    public decimal TotalBed { get; set; }
    public decimal TotalBes { get; set; }
    public decimal TotalMan { get; set; }
    public decimal? MandehBefore { get; set; }
    public List<LedgerItemDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }

}