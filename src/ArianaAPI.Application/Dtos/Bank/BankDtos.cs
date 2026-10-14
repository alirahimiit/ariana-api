using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Bank;

// ═══════════════════════════════════════════════════════════
//  بانک
// ═══════════════════════════════════════════════════════════

public class BankListDto
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("code")]
    public string? Code { get; set; }
}

public class BankWriteDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("code")]
    public string? Code { get; set; }
}

public class BankWriteResultDto
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }
}

// ═══════════════════════════════════════════════════════════
//  حساب بانکی
// ═══════════════════════════════════════════════════════════

public class BankAccListDto
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("bankId")]
    public long? BankId { get; set; }

    [JsonPropertyName("bankName")]
    public string? BankName { get; set; }

    [JsonPropertyName("shobe")]
    public string? Shobe { get; set; }

    [JsonPropertyName("noHesab")]
    public string? NoHesab { get; set; }

    [JsonPropertyName("descript")]
    public string? Descript { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("codeCol")]
    public int? CodeCol { get; set; }

    [JsonPropertyName("codeMoein")]
    public int? CodeMoein { get; set; }

    [JsonPropertyName("codeTafzil")]
    public int? CodeTafzil { get; set; }

    // ⭐⭐ اسم‌های کدینگ — برای نمایش در فرم و لیست
    [JsonPropertyName("codeColName")]
    public string? CodeColName { get; set; }

    [JsonPropertyName("codeMoeinName")]
    public string? CodeMoeinName { get; set; }

    [JsonPropertyName("codeTafzilName")]
    public string? CodeTafzilName { get; set; }
}

public class BankAccWriteDto
{
    [JsonPropertyName("bankId")]
    public long? BankId { get; set; }

    [JsonPropertyName("shobe")]
    public string? Shobe { get; set; }

    [JsonPropertyName("noHesab")]
    public string? NoHesab { get; set; }

    [JsonPropertyName("descript")]
    public string? Descript { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("codeCol")]
    public int? CodeCol { get; set; }

    [JsonPropertyName("codeMoein")]
    public int? CodeMoein { get; set; }

    [JsonPropertyName("codeTafzil")]
    public int? CodeTafzil { get; set; }
}

public class BankAccWriteResultDto
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("bankName")]
    public string? BankName { get; set; }

    [JsonPropertyName("noHesab")]
    public string? NoHesab { get; set; }
}

public class BankAccRequestDto
{
    [JsonPropertyName("bankId")]
    public long? BankId { get; set; }

    [JsonPropertyName("search")]
    public string? Search { get; set; }

    [JsonPropertyName("page")]
    public int Page { get; set; } = 1;

    [JsonPropertyName("pageSize")]
    public int PageSize { get; set; } = 50;
}

public class BankAccListResultDto
{
    [JsonPropertyName("items")]
    public List<BankAccListDto> Items { get; set; } = new();

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; set; }

    [JsonPropertyName("totalCount")]
    public int TotalCount { get; set; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; }
}