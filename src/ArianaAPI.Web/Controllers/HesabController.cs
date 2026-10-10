using ArianaAPI.Application.DTOs.Common;
using ArianaAPI.Application.DTOs.Hesab;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HesabController : ControllerBase
{
    private readonly IHesabRepository _repo;

    public HesabController(IHesabRepository repo)
    {
        _repo = repo;
    }

    /// <summary>همه حساب‌های کل</summary>
    [HttpGet("cols")]
    public async Task<ActionResult<IEnumerable<HesabDto>>> GetCols(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetAllColsAsync(orgId, fyId, ct));
    }

    /// <summary>معین‌های یک کل خاص</summary>
    [HttpGet("cols/{codeCol:int}/moeins")]
    public async Task<ActionResult<IEnumerable<HesabDto>>> GetMoeins(int codeCol, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetMoeinsAsync(orgId, fyId, codeCol, ct));
    }

    /// <summary>تفصیل‌ها (اختیاری فیلتر بر اساس codeCol)</summary>
    [HttpGet("tafzils")]
    public async Task<ActionResult<IEnumerable<HesabDto>>> GetTafzils(
        [FromQuery] int? codeCol, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetTafzilsAsync(orgId, fyId, codeCol, ct));
    }

    /// <summary>همه حساب‌ها (برای tree کامل)</summary>
    [HttpGet("all")]
    public async Task<ActionResult<IEnumerable<HesabDto>>> GetAll(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetAllAsync(orgId, fyId, ct));
    }
    /// <summary>درخت کامل حساب‌ها</summary>
    [HttpGet("tree")]
    public async Task<ActionResult<IEnumerable<HesabTreeDto>>> GetTree(CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        return Ok(await _repo.GetTreeAsync(orgId, fyId, ct));
    }


    // ══════════════════════════════════════════════════
    //  ⭐ مدیریت — لیست / جزئیات
    // ══════════════════════════════════════════════════

    /// <summary>
    /// لیست حساب‌ها برای صفحه مدیریت
    /// level: col | moein | tafzil
    /// </summary>
    [HttpGet("list")]
    public async Task<ActionResult<List<HesabListItemDto>>> GetList(
        [FromQuery] string level = "col",
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (level != "col" && level != "moein" && level != "tafzil")
            return BadRequest(new { error = "سطح نامعتبر" });

        var list = await _repo.GetListAsync(User.GetOrgId(), User.GetFyId(), level, search, ct);
        return Ok(list);
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<HesabListItemDto>> GetById(long id, CancellationToken ct)
    {
        var item = await _repo.GetByIdAsync(User.GetOrgId(), User.GetFyId(), id, ct);
        return item == null ? NotFound() : Ok(item);
    }

    /// <summary>بررسی استفاده‌ی حساب در اسناد</summary>
    [HttpGet("{id:long}/usage")]
    public async Task<ActionResult<HesabUsageDto>> GetUsage(long id, CancellationToken ct)
        => Ok(await _repo.GetUsageAsync(User.GetOrgId(), User.GetFyId(), id, ct));

    /// <summary>کد بعدی برای ایجاد سریع</summary>
    [HttpGet("next-code")]
    public async Task<ActionResult<object>> GetNextCode(
        [FromQuery] string level,
        [FromQuery] int? codeCol,
        CancellationToken ct)
    {
        var next = await _repo.GetNextCodeAsync(User.GetOrgId(), User.GetFyId(), level, codeCol, ct);
        return Ok(new { nextCode = next });
    }

    // ══════════════════════════════════════════════════
    //  ⭐ مدیریت — CRUD
    // ══════════════════════════════════════════════════

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] HesabCreateDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { error = "نام حساب الزامی است" });

        if (dto.Level != "col" && dto.Level != "moein" && dto.Level != "tafzil")
            return BadRequest(new { error = "سطح نامعتبر" });

        if (dto.Level == "moein" && (dto.CodeCol ?? 0) <= 0)
            return BadRequest(new { error = "کد کل برای معین الزامی است" });

        try
        {
            var id = await _repo.CreateAsync(User.GetOrgId(), User.GetFyId(), dto, ct);
            return Ok(new { hesabId = id, message = "حساب با موفقیت ثبت شد" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<object>> Update(
        long id, [FromBody] HesabUpdateDto dto, CancellationToken ct)
    {
        try
        {
            var ok = await _repo.UpdateAsync(User.GetOrgId(), User.GetFyId(), id, dto, ct);
            if (!ok) return NotFound();
            return Ok(new { message = "تغییرات ذخیره شد" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult<object>> Delete(long id, CancellationToken ct)
    {
        try
        {
            await _repo.DeleteAsync(User.GetOrgId(), User.GetFyId(), id, ct);
            return Ok(new { message = "حساب حذف شد" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ══════════════════════════════════════════════════
    //  ⭐ جستجوی سریع برای Picker
    // ══════════════════════════════════════════════════

    /// <summary>
    /// جستجو در حساب‌ها برای Picker
    /// level: col | moein | tafzil
    /// onlyWithTafzili: فقط حساب‌هایی که تفصیلی دارند (برای فیلد تفضیلی)
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<List<HesabListItemDto>>> Search(
        [FromQuery] string level,
        [FromQuery] string? q,
        [FromQuery] int? codeCol,
        [FromQuery] bool onlyWithTafzili = false,
        CancellationToken ct = default)
    {
        if (level != "col" && level != "moein" && level != "tafzil")
            return BadRequest(new { error = "سطح نامعتبر" });

        var list = await _repo.SearchAsync(
            User.GetOrgId(), User.GetFyId(), level, q, codeCol, onlyWithTafzili, ct);
        return Ok(list);
    }
}