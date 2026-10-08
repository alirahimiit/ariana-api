using ArianaAPI.Application.DTOs.Sanad;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ArianaAPI.Web.Filters;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SanadController : ControllerBase
{
    private readonly ISanadRepository _repo;

    public SanadController(ISanadRepository repo)
    {
        _repo = repo;
    }

    // ═══════════════════════════════════════════
    //  READ
    // ═══════════════════════════════════════════

    /// <summary>لیست اسناد</summary>
    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null,
        [FromQuery] int? noFrom = null,
        [FromQuery] int? noTo = null,
        [FromQuery] int? vazeit = null,
        [FromQuery] int? kindSanad = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        [FromQuery] bool? onlyWithErrors = null,
        [FromQuery] int? codeCol = null,        
        [FromQuery] int? codeMoein = null,    
        [FromQuery] int? codeTafzil = null,   
        CancellationToken ct = default)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var list = await _repo.GetListAsync(
            orgId, fyId,
            fromDate, toDate, noFrom, noTo, vazeit, kindSanad,
            sortBy, sortDir, page, pageSize,
            onlyWithErrors,
            codeCol, codeMoein, codeTafzil,
            ct);

        return Ok(list);
    }

    /// <summary>جزئیات یک سند</summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<SanadDetailDto>> GetById(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetByIdAsync(orgId, fyId, id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>آیتم‌های یک سند</summary>
    [HttpGet("{id:long}/items")]
    public async Task<ActionResult<IEnumerable<SanadItemDto>>> GetItems(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var result = await _repo.GetItemsAsync(orgId, fyId, id, ct);
        return Ok(result);
    }

    /// <summary>تعداد کل اسناد</summary>
    [HttpGet("count")]
    public async Task<ActionResult<int>> GetCount(
        [FromQuery] string? fromDate = null,
        [FromQuery] string? toDate = null,
        [FromQuery] int? vazeit = null,
        CancellationToken ct = default)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var count = await _repo.GetCountAsync(orgId, fyId, fromDate, toDate, vazeit, ct);
        return Ok(new { count });
    }

    // ═══════════════════════════════════════════
    //  WRITE (جدید - فاز ۱۱)
    // ═══════════════════════════════════════════

    /// <summary>ایجاد سند جدید</summary>
    [HttpPost]
    [RequirePermission(101)]
    public async Task<ActionResult<SanadCreateResultDto>> Create(
        [FromBody] SanadCreateDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            var result = await _repo.CreateAsync(orgId, fyId, dto, userCode, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>ویرایش سند</summary>
    [HttpPut("{id:long}")]
    [RequirePermission(102)]
    public async Task<IActionResult> Update(
        long id,
        [FromBody] SanadUpdateDto dto,
        CancellationToken ct)
    {
        if (id != dto.ParentSanadId)
            return BadRequest(new { error = "شناسه سند در URL و بدنه یکسان نیست" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.UpdateAsync(orgId, fyId, dto, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>حذف سند</summary>
    [HttpDelete("{id:long}")]
    [RequirePermission(108)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            await _repo.DeleteAsync(orgId, fyId, id, userCode, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>وضعیت سند (برای چک قابل‌ویرایش بودن)</summary>
    [HttpGet("{id:long}/vazeit")]
    public async Task<ActionResult<int>> GetVazeit(long id, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        var vazeit = await _repo.GetVazeitAsync(orgId, fyId, id, ct);
        if (vazeit < 0) return NotFound();
        return Ok(new { vazeit });
    }


    // ═══════════════════════════════════════════
    //  حذف گروهی اسناد
    // ═══════════════════════════════════════════
    [HttpPost("bulk-delete")]
    [RequirePermission(108)]
    public async Task<IActionResult> BulkDelete(
        [FromBody] SanadBulkDeleteRequestDto dto, CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            var deleted = await _repo.BulkDeleteAsync(orgId, fyId, dto.SanadIds, userCode, ct);
            return Ok(new { deleted });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ═══════════════════════════════════════════
    //  📤 Export to CSV
    // ═══════════════════════════════════════════
    [HttpPost("export-csv")]
    public async Task<IActionResult> ExportCsv(
        [FromBody] SanadBulkDeleteRequestDto dto,   // فقط SanadIds لازمه
        CancellationToken ct)
    {
        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();

        try
        {
            var csv = await _repo.ExportCsvAsync(orgId, fyId, dto.SanadIds, ct);

            // ⭐ BOM برای Excel فارسی
            var bytes = System.Text.Encoding.UTF8.GetPreamble()
                .Concat(System.Text.Encoding.UTF8.GetBytes(csv)).ToArray();

            return File(bytes, "text/csv; charset=utf-8",
                $"Sanad_Export_{DateTime.Now:yyyyMMdd_HHmmss}.csv");
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ═══════════════════════════════════════════
    //  📥 Import Preview (بدون DB write)
    // ═══════════════════════════════════════════
    [HttpPost("import-preview")]
    [RequirePermission(101)]
    public async Task<ActionResult<SanadImportPreviewResult>> ImportPreview(
        [FromBody] SanadImportRequest dto,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.CsvContent))
            return BadRequest(new { error = "محتوای فایل خالی است" });

        try
        {
            var orgId = User.GetOrgId();
            var fyId = User.GetFyId();

            // ⭐ شماره‌های موجود
            var existing = await _repo.GetAllNoSanadAsync(orgId, fyId, ct);

            var result = _repo.ParseAndValidateCsv(dto.CsvContent, existing);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "خطا در پردازش فایل: " + ex.Message });
        }
    }

    // ═══════════════════════════════════════════
    //  📥 Import Commit
    // ═══════════════════════════════════════════
    [HttpPost("import-commit")]
    [RequirePermission(101)]
    public async Task<ActionResult<SanadImportResult>> ImportCommit(
        [FromBody] SanadImportRequest dto,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.CsvContent))
            return BadRequest(new { error = "محتوای فایل خالی است" });

        var orgId = User.GetOrgId();
        var fyId = User.GetFyId();
        var userCode = User.GetUserId();

        try
        {
            var result = await _repo.ImportFromCsvAsync(
                orgId, fyId, dto.CsvContent, dto.ForceNewNumbers, userCode, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "خطا در ورود اسناد: " + ex.Message });
        }
    }
}