using ArianaAPI.Application.Dtos.Moadian;
using ArianaAPI.Application.Interfaces;
using ArianaAPI.Infrastructure.Services.Moadian;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/moadian")]
[Authorize]
public class MoadianController : ControllerBase
{
    private readonly IMoadianRepository _repo;
    private readonly MoadianServiceFactory _serviceFactory;
    private readonly ILogger<MoadianController> _logger;

    // ═══ Cache در حافظه (per controller lifecycle) ═══
    private MoadianServerInfoResponse? _cachedServerInfo;
    private MoadianTokenResponse? _cachedToken;
    private DateTime _tokenExpireAt = DateTime.MinValue;

    public MoadianController(
        IMoadianRepository repo,
        MoadianServiceFactory serviceFactory,
        ILogger<MoadianController> logger)
    {
        _repo = repo;
        _serviceFactory = serviceFactory;
        _logger = logger;
    }

    private long GetOrgId() => long.Parse(User.FindFirst("orgId")?.Value ?? "0");
    private long GetFyId() => long.Parse(User.FindFirst("fyId")?.Value ?? "0");

    // ═══════════════════════════════════════════════════════════
    //  HELPER: ساخت MoadianService با تنظیمات DB
    // ═══════════════════════════════════════════════════════════
    private async Task<IMoadianService?> BuildServiceAsync(CancellationToken ct)
    {
        var setting = await _repo.GetSettingAsync(GetOrgId(), GetFyId(), ct);
        if (setting is null || string.IsNullOrEmpty(setting.TaxUserName) || string.IsNullOrEmpty(setting.PrivateKey))
        {
            _logger.LogWarning("تنظیمات مودیان کامل نیست");
            return null;
        }

        var options = new MoadianOptions
        {
            TaxUserName = setting.TaxUserName,
            PrivateKey = setting.PrivateKey,
            EconomicCode = setting.CodeEgtesadi ?? "",
            IsSandbox = setting.IsSandbox
        };

        return _serviceFactory.Create(options);
    }

    // ═══════════════════════════════════════════════════════════
    //  SETTINGS
    // ═══════════════════════════════════════════════════════════
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        var s = await _repo.GetSettingAsync(GetOrgId(), GetFyId(), ct);

        return Ok(new MoadianSettingsDto
        {
            TaxUserName = s?.TaxUserName,
            PrivateKey = string.IsNullOrEmpty(s?.PrivateKey) ? null : "***",  // امنیتی
            CodeEgtesadi = s?.CodeEgtesadi,
            IsSandbox = s?.IsSandbox ?? true,
            Invoice = s?.Invoice ?? true,
            Customer = s?.Customer ?? true,
            Stuff = s?.Stuff ?? true
        });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] MoadianSettingsDto dto, CancellationToken ct)
    {
        // ⭐ اگه PrivateKey = "***" بود، یعنی نخواستیم عوضش کنیم
        if (dto.PrivateKey == "***")
        {
            var current = await _repo.GetSettingAsync(GetOrgId(), GetFyId(), ct);
            dto.PrivateKey = current?.PrivateKey;
        }

        var setting = new Domain.Entities.Moadian.TaxSetting
        {
            TaxUserName = dto.TaxUserName,
            PrivateKey = dto.PrivateKey,
            CodeEgtesadi = dto.CodeEgtesadi,
            IsSandbox = dto.IsSandbox,
            Invoice = dto.Invoice,
            Customer = dto.Customer,
            Stuff = dto.Stuff
        };

        await _repo.UpdateSettingAsync(GetOrgId(), GetFyId(), setting, ct);
        return Ok(new { success = true });
    }

    // ═══════════════════════════════════════════════════════════
    //  TEST CONNECTION
    // ═══════════════════════════════════════════════════════════
    [HttpGet("test-connection")]
    public async Task<IActionResult> TestConnection(CancellationToken ct)
    {
        var svc = await BuildServiceAsync(ct);
        if (svc is null)
            return BadRequest(new { error = "اول تنظیمات مودیان رو کامل کن" });

        var result = await svc.GetServerInformationAsync(ct);

        if (!result.Success)
            return Ok(new { success = false, error = result.Error });

        _cachedServerInfo = result;

        return Ok(new
        {
            success = true,
            serverTime = result.ServerTime,
            keyId = result.PublicKeyId,
            algorithm = result.PublicKeyAlgorithm,
            isSandbox = svc.Options.IsSandbox
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  FISCAL INFO
    // ═══════════════════════════════════════════════════════════
    [HttpGet("fiscal-info")]
    public async Task<IActionResult> GetFiscalInfo(CancellationToken ct)
    {
        var svc = await BuildServiceAsync(ct);
        if (svc is null) return BadRequest(new { error = "تنظیمات ناقصه" });

        var token = await GetOrRefreshTokenAsync(svc, ct);
        if (token is null) return BadRequest(new { error = "دریافت توکن ناموفق" });

        var result = await svc.GetFiscalInformationAsync(token, ct);
        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════
    //  ECONOMIC CODE INFO
    // ═══════════════════════════════════════════════════════════
    [HttpGet("economic-info/{code}")]
    public async Task<IActionResult> GetEconomicInfo(string code, CancellationToken ct)
    {
        var svc = await BuildServiceAsync(ct);
        if (svc is null) return BadRequest(new { error = "تنظیمات ناقصه" });

        var result = await svc.GetEconomicCodeInfoAsync(code, ct);
        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════
    //  PENDING FACTORS (برای انتخاب و ارسال)
    // ═══════════════════════════════════════════════════════════
    [HttpGet("factors/pending")]
    public async Task<IActionResult> GetPendingFactors(CancellationToken ct)
    {
        var list = await _repo.GetPendingFactorsAsync(GetOrgId(), GetFyId(), ct);
        return Ok(new { items = list, count = list.Count });
    }

    // ═══════════════════════════════════════════════════════════
    //  HEADERS (لیست فاکتورهای مالیاتی)
    // ═══════════════════════════════════════════════════════════
    [HttpGet("headers")]
    public async Task<IActionResult> GetHeaders(CancellationToken ct)
    {
        var list = await _repo.GetAllHeadersAsync(GetOrgId(), GetFyId(), ct);
        return Ok(new { items = list, count = list.Count });
    }

    [HttpGet("headers/{id:long}")]
    public async Task<IActionResult> GetHeader(long id, CancellationToken ct)
    {
        var header = await _repo.GetHeaderByIdAsync(GetOrgId(), GetFyId(), id, ct);
        if (header is null) return NotFound(new { error = "سند یافت نشد" });

        var body = await _repo.GetBodyByHeaderIdAsync(GetOrgId(), GetFyId(), id, ct);

        return Ok(new { header, body });
    }

    [HttpDelete("headers/{id:long}")]
    public async Task<IActionResult> DeleteHeader(long id, CancellationToken ct)
    {
        var header = await _repo.GetHeaderByIdAsync(GetOrgId(), GetFyId(), id, ct);
        if (header is null) return NotFound(new { error = "سند یافت نشد" });

        if (header.Status == 3)
            return BadRequest(new { error = "سند ارسال‌شده رو نمی‌تونی حذف کنی" });

        await _repo.DeleteHeaderAsync(GetOrgId(), GetFyId(), id, ct);
        return Ok(new { success = true });
    }

    // ═══════════════════════════════════════════════════════════
    //  CREATE FROM FACTOR
    //  ⭐ ساخت tax_header + tax_body از FactorParent
    // ═══════════════════════════════════════════════════════════
    [HttpPost("headers/from-factor")]
    public async Task<IActionResult> CreateFromFactor([FromBody] CreateFromFactorRequest req, CancellationToken ct)
    {
        var factor = await _repo.GetFactorSourceByIdAsync(GetOrgId(), GetFyId(), req.FactorId, ct);
        if (factor is null)
            return NotFound(new { error = "فاکتور یافت نشد یا قبلاً ارسال شده" });

        var rows = await _repo.GetFactorRowsAsync(GetOrgId(), GetFyId(), req.FactorId, ct);
        if (rows.Count == 0)
            return BadRequest(new { error = "فاکتور ردیف نداره" });

        // ⭐ شماره سریال بعدی
        var lastInno = await _repo.GetLastInnoAsync(GetOrgId(), GetFyId(), ct);
        var nextInno = lastInno + 1;

        // ⭐ جمع‌ها
        var tprdis = rows.Sum(r => r.FldPrice);                  // جمع قبل تخفیف
        var tdis = rows.Sum(r => r.Discount);                  // جمع تخفیف
        var tadis = tprdis - tdis;                              // جمع بعد تخفیف
        var tvam = rows.Sum(r => r.FldTaxAmount);              // جمع مالیات
        var tbill = tadis + tvam;                               // مبلغ نهایی

        // ⭐ تاریخ میلادی (تبدیل از تاریخ شمسی FactorParent.Date_In)
        var persianDate = factor.FldFacDate ?? "";
        var gregorianDate = PersianToGregorian(persianDate);
        var unixSeconds = new DateTimeOffset(gregorianDate).ToUnixTimeSeconds();

        // ⭐ ساخت هدر
        var header = new Domain.Entities.Moadian.TaxHeader
        {
            Status = 0,
            FactorId = req.FactorId,
            CustomerCode = factor.CustomerCode,
            Inno = nextInno.ToString(),
            Inty = 1,            // نوع اول
            Inp = 1,             // الگوی فروش
            Ins = 1,             // اصلی
            Setm = factor.IsCash == 1 ? 1 : 2,  // نقد/نسیه
            Indatim = unixSeconds,
            IndatimDatetime = gregorianDate,
            IndatimPersian = persianDate,
            Tprdis = tprdis,
            Tdis = tdis,
            Tadis = tadis,
            Tvam = tvam,
            Todam = 0,
            Tbill = tbill,
            Tonw = 0,
            Torv = 0,
            Tocv = 0,
            Tvop = 0,
            Cap = factor.IsCash == 1 ? tbill : 0,
            Insp = factor.IsCash == 1 ? 0 : tbill
        };

        var headerId = await _repo.AddHeaderAsync(GetOrgId(), GetFyId(), header, ct);

        // ⭐ ساخت ردیف‌ها
        foreach (var r in rows)
        {
            var body = new Domain.Entities.Moadian.TaxBody
            {
                HeaderId = headerId,
                StuffId = r.StuffId,
                UnitId = r.UnitId,
                Am = r.FldQty,
                Fee = r.FldPrice,
                Prdis = r.FldPrice * (decimal)r.FldQty,
                Dis = r.Discount,
                Adis = (long)(r.FldPrice * (decimal)r.FldQty) - r.Discount,
                Vra = r.FldVra,
                Vam = r.FldTaxAmount,
                Tsstam = (long)(r.FldPrice * (decimal)r.FldQty),
                Cut = "IRR"
            };

            await _repo.AddBodyAsync(GetOrgId(), GetFyId(), body, ct);
        }

        return Ok(new { success = true, headerId, inno = nextInno });
    }

    // ═══════════════════════════════════════════════════════════
    //  SEND SINGLE
    // ═══════════════════════════════════════════════════════════
    [HttpPost("send")]
    public async Task<IActionResult> Send([FromBody] SendInvoiceRequest req, CancellationToken ct)
    {
        var svc = await BuildServiceAsync(ct);
        if (svc is null) return BadRequest(new { error = "تنظیمات ناقصه" });

        var header = await _repo.GetHeaderByIdAsync(GetOrgId(), GetFyId(), req.HeaderId, ct);
        if (header is null) return NotFound(new { error = "سند یافت نشد" });

        if (header.Status == 3)
            return BadRequest(new { error = "این سند قبلاً با موفقیت ارسال شده" });

        // ⭐ توکن
        var token = await GetOrRefreshTokenAsync(svc, ct);
        if (token is null) return BadRequest(new { error = "دریافت توکن ناموفق" });

        // ⭐ کلید عمومی سرور
        var serverInfo = _cachedServerInfo ?? await svc.GetServerInformationAsync(ct);
        if (!serverInfo.Success || string.IsNullOrEmpty(serverInfo.PublicKey))
            return BadRequest(new { error = "دریافت کلید سرور ناموفق" });
        _cachedServerInfo = serverInfo;

        // ⭐ ساخت فاکتور
        var bodies = await _repo.GetBodyByHeaderIdAsync(GetOrgId(), GetFyId(), req.HeaderId, ct);
        var invoice = MoadianInvoiceBuilder.Build(header, bodies, svc.Options.EconomicCode);

        // ⭐ UID یکتا
        var uid = Guid.NewGuid().ToString();

        // ⭐ ارسال
        var result = await svc.EnqueueAsync(
            token,
            serverInfo.PublicKey!,
            serverInfo.PublicKeyId ?? "",
            "INVOICE.V01",
            uid,
            invoice,
            ct);

        // ⭐ ذخیره‌ی نتیجه
        if (result.Success)
        {
            header.Uid = uid;
            header.RefNumber = result.ReferenceNumber;
            header.Status = 1;  // ارسال شده، بدون استعلام
            await _repo.UpdateHeaderAsync(GetOrgId(), GetFyId(), header, ct);

            await _repo.AddHistoryAsync(GetOrgId(), GetFyId(), new Domain.Entities.Moadian.TaxHistory
            {
                HeaderId = header.Id,
                Uid = uid,
                RefNumber = result.ReferenceNumber,
                TaxId = header.TaxId
            }, ct);
        }
        else
        {
            header.Status = 2;  // خطا
            await _repo.UpdateHeaderAsync(GetOrgId(), GetFyId(), header, ct);
        }

        return Ok(new
        {
            success = result.Success,
            uid = result.Uid,
            referenceNumber = result.ReferenceNumber,
            error = result.Error
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  SEND BULK
    // ═══════════════════════════════════════════════════════════
    [HttpPost("send-bulk")]
    public async Task<IActionResult> SendBulk([FromBody] SendBulkRequest req, CancellationToken ct)
    {
        if (req.HeaderIds.Count == 0)
            return BadRequest(new { error = "لیست خالی" });

        var results = new List<object>();

        foreach (var id in req.HeaderIds)
        {
            try
            {
                var r = await Send(new SendInvoiceRequest { HeaderId = id }, ct);
                results.Add(new { headerId = id, ok = r is OkObjectResult });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "خطا در ارسال bulk header {Id}", id);
                results.Add(new { headerId = id, ok = false, error = ex.Message });
            }
        }

        var successCount = results.Count(r => (bool)r.GetType().GetProperty("ok")!.GetValue(r)!);

        return Ok(new
        {
            total = req.HeaderIds.Count,
            success = successCount,
            failed = req.HeaderIds.Count - successCount,
            details = results
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  INQUIRY
    // ═══════════════════════════════════════════════════════════
    [HttpPost("inquiry")]
    public async Task<IActionResult> Inquiry([FromBody] InquiryRequest req, CancellationToken ct)
    {
        var svc = await BuildServiceAsync(ct);
        if (svc is null) return BadRequest(new { error = "تنظیمات ناقصه" });

        var header = await _repo.GetHeaderByIdAsync(GetOrgId(), GetFyId(), req.HeaderId, ct);
        if (header is null) return NotFound(new { error = "سند یافت نشد" });

        if (string.IsNullOrEmpty(header.Uid))
            return BadRequest(new { error = "این سند هنوز UID نداره (ارسال نشده)" });

        var token = await GetOrRefreshTokenAsync(svc, ct);
        if (token is null) return BadRequest(new { error = "دریافت توکن ناموفق" });

        var uids = new List<MoadianUidModel>
        {
            new() { Uid = header.Uid, FiscalId = svc.Options.TaxUserName }
        };

        var result = await svc.InquiryByUidAsync(token, uids, ct);
        if (!result.Success || result.Result.Count == 0)
            return Ok(new { success = false, error = result.Error });

        // ⭐ آپدیت وضعیت
        var item = result.Result[0];
        if (item.Errors.Count == 0 && item.Status == "SUCCESS")
        {
            header.Status = 3;  // موفق
            header.TaxStatus = "SUCCESS";
            header.AcceptRefNumber = item.ConfirmationReferenceId;
            await _repo.UpdateHeaderAsync(GetOrgId(), GetFyId(), header, ct);
        }
        else if (item.Errors.Count > 0)
        {
            header.Status = 2;  // خطا
            header.TaxStatus = "ERROR";
            await _repo.UpdateHeaderAsync(GetOrgId(), GetFyId(), header, ct);
        }

        return Ok(new
        {
            success = true,
            status = item.Status,
            taxResult = item.TaxResult,
            confirmationRefId = item.ConfirmationReferenceId,
            errors = item.Errors,
            warnings = item.Warnings
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════
    private async Task<string?> GetOrRefreshTokenAsync(IMoadianService svc, CancellationToken ct)
    {
        if (_cachedToken?.Success == true && DateTime.UtcNow < _tokenExpireAt)
            return _cachedToken.Token;

        var r = await svc.GetTokenAsync(ct);
        if (!r.Success) return null;

        _cachedToken = r;
        // ⭐ با ۵ دقیقه حاشیه
        _tokenExpireAt = DateTime.UtcNow.AddSeconds(Math.Max(60, r.ExpiresIn - 300));
        return r.Token;
    }

    private static DateTime PersianToGregorian(string persianDate)
    {
        try
        {
            var parts = persianDate.Split('/');
            if (parts.Length != 3) return DateTime.Now;

            var y = int.Parse(parts[0]);
            var m = int.Parse(parts[1]);
            var d = int.Parse(parts[2]);

            var pc = new System.Globalization.PersianCalendar();
            return pc.ToDateTime(y, m, d, 0, 0, 0, 0);
        }
        catch
        {
            return DateTime.Now;
        }
    }
}