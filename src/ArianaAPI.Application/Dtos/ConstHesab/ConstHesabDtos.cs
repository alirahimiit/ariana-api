using System.Text.Json.Serialization;

namespace ArianaAPI.Application.Dtos.ConstHesab;

public class ConstHesabItemDto
{
    [JsonPropertyName("type")]
    public int Type { get; set; }

    [JsonPropertyName("typeName")]
    public string TypeName { get; set; } = string.Empty;

    [JsonPropertyName("hesabId")]
    public long? HesabId { get; set; }

    [JsonPropertyName("codeCol")]
    public int? CodeCol { get; set; }

    [JsonPropertyName("codeMoein")]
    public int? CodeMoein { get; set; }

    [JsonPropertyName("codeTafzil")]
    public int? CodeTafzil { get; set; }

    [JsonPropertyName("hesabName")]
    public string? HesabName { get; set; }

    [JsonPropertyName("colName")]
    public string? ColName { get; set; }       // ⭐ نام کل

    [JsonPropertyName("isSet")]
    public bool IsSet => HesabId.HasValue && HesabId.Value > 0;
}

public class ConstHesabSetDto
{
    [JsonPropertyName("type")]
    public int Type { get; set; }

    [JsonPropertyName("codeCol")]
    public int CodeCol { get; set; }

    [JsonPropertyName("codeMoein")]
    public int CodeMoein { get; set; }

    [JsonPropertyName("codeTafzil")]
    public int CodeTafzil { get; set; }
}