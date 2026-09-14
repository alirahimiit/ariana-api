using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Data;
using Dapper;

namespace ArianaAPI.Infrastructure.Repositories;

/// <summary>
/// پیاده‌سازی Repository نوع سند
/// نکته: چون جدول مجزایی برای KindSanad نداریم،
/// این لیست رو به صورت ثابت برمی‌گردونیم (مطابق کد Delphi قبلی)
/// </summary>
public class KindSanadRepository : IKindSanadRepository
{
    private readonly ITenantConnectionFactory _factory;

    public KindSanadRepository(ITenantConnectionFactory factory)
    {
        _factory = factory;
    }

    public Task<IEnumerable<KindSanadDto>> GetAllAsync(
        long orgId, long fyId, CancellationToken ct = default)
    {
        var list = new List<KindSanadDto>
        {
            new() { Code = 0, Name = "عادی" },
            new() { Code = 1, Name = "افتتاحیه" },
            new() { Code = 2, Name = "اختتامیه" },
            new() { Code = 3, Name = "انبار" },
            new() { Code = 4, Name = "حقوق" },
            new() { Code = 5, Name = "اموال" },
            new() { Code = 6, Name = "فروش" },
            new() { Code = 7, Name = "انتقالی" },
            new() { Code = 8, Name = "خاص" }
        };

        return Task.FromResult<IEnumerable<KindSanadDto>>(list);
    }
}