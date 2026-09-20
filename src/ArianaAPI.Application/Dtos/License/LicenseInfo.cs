using System.Text.Json.Serialization;

namespace ArianaAPI.Application.DTOs.License;

public class LicensePayload
{
    [JsonPropertyName("version")]
    public int Version { get; set; }

    [JsonPropertyName("licenseId")]
    public string LicenseId { get; set; } = string.Empty;

    [JsonPropertyName("customerName")]
    public string CustomerName { get; set; } = string.Empty;

    [JsonPropertyName("customerId")]
    public string CustomerId { get; set; } = string.Empty;

    [JsonPropertyName("issuedAt")]
    public string IssuedAt { get; set; } = string.Empty;

    [JsonPropertyName("expiresAt")]
    public string ExpiresAt { get; set; } = string.Empty;

    [JsonPropertyName("authorizedOrgs")]
    public long[] AuthorizedOrgs { get; set; } = Array.Empty<long>();

    [JsonPropertyName("features")]
    public string[] Features { get; set; } = Array.Empty<string>();

    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}

public class LicenseFile
{
    [JsonPropertyName("payload")]
    public LicensePayload Payload { get; set; } = new();

    [JsonPropertyName("signature")]
    public string Signature { get; set; } = string.Empty;
}

/// <summary>وضعیت لایسنس بعد از بررسی</summary>
public class LicenseStatus
{
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }
    public LicensePayload? Payload { get; set; }

    public static LicenseStatus Invalid(string msg) =>
        new() { IsValid = false, ErrorMessage = msg };

    public static LicenseStatus Valid(LicensePayload payload) =>
        new() { IsValid = true, Payload = payload };
}