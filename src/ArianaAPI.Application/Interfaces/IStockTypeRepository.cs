using ArianaAPI.Application.DTOs.Stock;

namespace ArianaAPI.Application.Interfaces;

public interface IStockTypeRepository
{
    Task<StockTypeListResultDto> GetListAsync(
        long orgId, long fyId, StockTypeRequestDto req, CancellationToken ct = default);

    Task<StockTypeDetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<StockTypeCreateResultDto> CreateAsync(
        long orgId, long fyId, StockTypeCreateDto dto, CancellationToken ct = default);

    Task UpdateAsync(
        long orgId, long fyId, StockTypeUpdateDto dto, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<long> GetNextCodeAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<StockTypeUsageDto> GetUsageAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    /// <summary>لیست ساده برای dropdown (در فرم گروه کالا و Article)</summary>
    Task<IEnumerable<StockTypeListDto>> GetLookupAsync(
        long orgId, long fyId, CancellationToken ct = default);
}