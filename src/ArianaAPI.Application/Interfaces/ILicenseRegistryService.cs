namespace ArianaAPI.Application.Interfaces;

public interface ILicenseRegistryService
{
    Task<bool> IsRegisteredAsync(long productCode, CancellationToken ct = default);
    Task RegisterAsync(long productCode, string systemId, string serial, CancellationToken ct = default);
}

public static class LicenseProductCodes
{
    public const long ArianaMIS_Windows = 1001;
    public const long ArianaAPI_Web = 2001;
}