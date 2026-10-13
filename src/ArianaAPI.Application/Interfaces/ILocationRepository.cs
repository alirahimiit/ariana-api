using ArianaAPI.Application.DTOs.Lookup;

namespace ArianaAPI.Application.Interfaces;

public interface ILocationRepository
{
    /// <summary>لیست استان‌ها (برای dropdown)</summary>
    Task<IEnumerable<StateDto>> GetStatesAsync(
        long orgId, long fyId, CancellationToken ct = default);

    /// <summary>لیست شهرها — اگه stateId داده شه، فقط شهرهای اون استان</summary>
    Task<IEnumerable<CityDto>> GetCitiesAsync(
        long orgId, long fyId, long? stateId, CancellationToken ct = default);

    /// <summary>کد بعدی استان (برای درج خودکار)</summary>
    Task<decimal> GetNextStateCodeAsync(
        long orgId, long fyId, CancellationToken ct = default);

    /// <summary>کد بعدی شهر</summary>
    Task<decimal> GetNextCityCodeAsync(
        long orgId, long fyId, CancellationToken ct = default);
}