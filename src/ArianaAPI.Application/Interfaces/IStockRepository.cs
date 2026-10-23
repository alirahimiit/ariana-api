using ArianaAPI.Application.DTOs.Stock;

namespace ArianaAPI.Application.Interfaces;

public interface IStockRepository
{
    Task<StockListResultDto> GetListAsync(
        long orgId, long fyId, StockRequestDto request, CancellationToken ct = default);

    Task<StockDetailDto?> GetDetailAsync(
        long orgId, long fyId, long id, CancellationToken ct = default);

    Task<StockLookupsDto> GetLookupsAsync(
        long orgId, long fyId, CancellationToken ct = default);

    Task<StockNextNumberDto> GetNextNumberAsync(
        long orgId, long fyId, int kind, long? stockTypeId, CancellationToken ct = default);

    Task<StockArticleCalcDto?> GetArticleCalcAsync(
        long orgId, long fyId, long articleId, int kind, CancellationToken ct = default);

    Task<StockWriteResultDto> CreateAsync(
        long orgId, long fyId, StockWriteDto dto, long userCode, CancellationToken ct = default);

    Task<StockWriteResultDto> UpdateAsync(
        long orgId, long fyId, long id, StockWriteDto dto, long userCode, CancellationToken ct = default);

    Task DeleteAsync(
        long orgId, long fyId, long id, long userCode, CancellationToken ct = default);

    Task<StockSanadResultDto> CreateSanadAsync(
        long orgId, long fyId, long id, StockSanadRequestDto request, CancellationToken ct = default);

    Task<List<FactorListItemDto>> GetFactorListAsync(long orgId, long fyId, CancellationToken ct = default);
}