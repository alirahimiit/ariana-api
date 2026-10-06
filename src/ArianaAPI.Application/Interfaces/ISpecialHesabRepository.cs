using ArianaAPI.Application.DTOs.SpecialHesab;

namespace ArianaAPI.Application.Interfaces;

public interface ISpecialHesabRepository
{
    /// <summary>لیست حساب‌های ویژه بر اساس نوع</summary>
    Task<List<SpecialHesabItemDto>> GetListAsync(
        long orgId,
        long fyId,
        SpecialHesabKind kind,
        CancellationToken ct = default);
}