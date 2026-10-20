using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.Taraz;

public class TarazSheshSotooniRequestDto
{
    public string Level { get; set; } = "col";

    public string? FromDate { get; set; }
    public string? ToDate { get; set; }

    /// <summary>
    /// لیست شماره اسناد افتتاحیه (اختیاری). 
    /// اگر خالی باشد، KindSanad=1 در نظر گرفته می‌شود.
    /// </summary>
    public List<int>? OpeningSanadNos { get; set; }

    /// <summary>
    /// لیست شماره اسناد اختتامیه (اختیاری). 
    /// این اسناد از گردش دوره حذف می‌شوند.
    /// </summary>
    public List<int>? ClosingSanadNos { get; set; }

    public string FilterOption { get; set; } = "noZeroBoth";

    public int? FromCodeCol { get; set; }
    public int? ToCodeCol { get; set; }
    public int? FromCodeMoein { get; set; }
    public int? ToCodeMoein { get; set; }
    public int? FromCodeTafzil { get; set; }
    public int? ToCodeTafzil { get; set; }
    public int? CodeTafzili2 { get; set; }
    public int? TafziliGroupId { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 500;
}

public class TarazSheshSotooniItemDto
{
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public int CodeTafzili2 { get; set; }

    public string? ColName { get; set; }
    public string? MoeinName { get; set; }
    public string? TafzilName { get; set; }
    public string? Tafzili2Name { get; set; }

    public string HesabName { get; set; } = "";
    public string FullCode { get; set; } = "";

    public bool HasTafzili { get; set; }
    public bool HasTafzili2 { get; set; }

    public decimal OpeningDebit { get; set; }
    public decimal OpeningCredit { get; set; }
    public decimal TurnoverDebit { get; set; }
    public decimal TurnoverCredit { get; set; }
    public decimal ClosingDebit { get; set; }
    public decimal ClosingCredit { get; set; }
}

public class TarazSheshSotooniResultDto
{
    public string Level { get; set; } = "col";
    public List<TarazSheshSotooniItemDto> Items { get; set; } = new();

    public decimal TotalOpeningDebit { get; set; }
    public decimal TotalOpeningCredit { get; set; }
    public decimal TotalTurnoverDebit { get; set; }
    public decimal TotalTurnoverCredit { get; set; }
    public decimal TotalClosingDebit { get; set; }
    public decimal TotalClosingCredit { get; set; }

    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
    public bool IsBalanced { get; set; }
}