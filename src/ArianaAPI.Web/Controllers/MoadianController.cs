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

        //var token = await GetOrRefreshTokenAsync(svc, ct);
        //if (token is null) return BadRequest(new { error = "دریافت توکن ناموفق" });

        //var result = await svc.GetFiscalInformationAsync(token, ct);
        //return Ok(result);
        var (token, tokenError) = await GetOrRefreshTokenAsync(svc, ct);
        if (token is null)
            return BadRequest(new { error = "دریافت توکن ناموفق: " + tokenError });

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

    [HttpPost("factors/pending-list")]
    public async Task<IActionResult> GetPendingFactorsPaged(
    [FromBody] MoadianPendingListRequestDto req, CancellationToken ct)
    {
        var result = await _repo.GetPendingFactorsPagedAsync(GetOrgId(), GetFyId(), req, ct);
        return Ok(result);
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

    [HttpPost("headers/list")]
    public async Task<IActionResult> GetHeadersPaged(
    [FromBody] MoadianHeaderListRequestDto req, CancellationToken ct)
    {
        var result = await _repo.GetHeadersPagedAsync(GetOrgId(), GetFyId(), req, ct);
        return Ok(result);
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
        // ✅ اصلاح: قیمت × تعداد
        // ⭐ جمعها — همه به long تبدیل بشن
        var tprdis = (long)rows.Sum(r => (decimal)r.FldPrice * (decimal)r.FldQty);   // جمع قبل تخفیف
        var tdis = (long)rows.Sum(r => (decimal)r.Discount);                       // جمع تخفیف
        var tadis = tprdis - tdis;                                                  // جمع بعد تخفیف
        var tvam = (long)rows.Sum(r => (decimal)r.FldTaxAmount);                   // جمع مالیات
        var tbill = tadis + tvam;                                                   // مبلغ نهایی

        // ⭐ تاریخ میلادی (تبدیل از تاریخ شمسی FactorParent.Date_In)
        var persianDate = string.IsNullOrWhiteSpace(factor.FldFacDate)
            ? DateTime.Now.ToString("yyyy/MM/dd")
            : factor.FldFacDate;

        var gregorianDate = PersianToGregorian(persianDate);
        var unixMillis = new DateTimeOffset(gregorianDate).ToUnixTimeMilliseconds();

        Console.WriteLine($"📅 Persian: {persianDate} | Gregorian: {gregorianDate:yyyy-MM-dd} | Millis: {unixMillis}");

        var setting = await _repo.GetSettingAsync(GetOrgId(), GetFyId(), ct);
        var memoryId = setting?.TaxUserName ?? "";

        var taxId = MoadianCryptoHelper.GenerateTaxId(memoryId, nextInno, gregorianDate);


        Console.WriteLine($"🆔 TaxId Generated: {taxId} (length={taxId.Length})");
        Console.WriteLine($"📅 persianDate = '{persianDate}', gregorianDate = {gregorianDate}, unixMillis = {unixMillis}");

        // ⭐ ساخت هدر
        var header = new Domain.Entities.Moadian.TaxHeader
        {
            Status = 0,
            FactorId = req.FactorId,
            CustomerCode = factor.CustomerCode,
            Inno = nextInno.ToString().PadLeft(10, '0') ,
            TaxId = taxId,
            Inty = req.Inty < 1 || req.Inty > 3 ? 1 : req.Inty,            // نوع اول
            Inp = 1,             // الگوی فروش
            Ins = 1,             // اصلی
            Setm = factor.IsCash == 1 ? 1 : 2,  // نقد/نسیه
            Indatim = unixMillis,
            IndatimPersian = persianDate,
            Indati2mPersian = persianDate,          // ⭐ این هم اضافه کن
            Indati2mDatetime = gregorianDate,        // ⭐ این هم
            Tprdis = tprdis,
            Tdis = tdis,
            Tadis = tadis,
            Tvam = tvam,
            Todam = 0,
            Tbill = tbill,
            Tonw = null,
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
            var qty = (decimal)r.FldQty;
            var price = (decimal)r.FldPrice;
            var lineTotal = (long)(price * qty);

            var body = new Domain.Entities.Moadian.TaxBody
            {
                HeaderId = headerId,
                StuffId = r.StuffId,
                UnitId = r.UnitId,
                Am = r.FldQty,
                Fee = r.FldPrice,
                Prdis = lineTotal,                       // ✅ long
                Dis = r.Discount,
                Adis = lineTotal - (long)r.Discount,    // ✅ long
                Vra = r.FldVra,
                Vam = r.FldTaxAmount,
                Tsstam = lineTotal,                       // ✅ long
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
        //var token = await GetOrRefreshTokenAsync(svc, ct);
        //if (token is null) return BadRequest(new { error = "دریافت توکن ناموفق" });
        var (token, tokenError) = await GetOrRefreshTokenAsync(svc, ct);
        if (token is null)
            return BadRequest(new { error = "دریافت توکن ناموفق: " + tokenError });

        // ⭐ کلید عمومی سرور
        var serverInfo = _cachedServerInfo ?? await svc.GetServerInformationAsync(ct);
        if (!serverInfo.Success || string.IsNullOrEmpty(serverInfo.PublicKey))
            return BadRequest(new { error = "دریافت کلید سرور ناموفق" });
        _cachedServerInfo = serverInfo;

        // ⭐ ساخت فاکتور
        var bodies = await _repo.GetBodyByHeaderIdAsync(GetOrgId(), GetFyId(), req.HeaderId, ct);
        var customerInfo = await _repo.GetCustomerTaxInfoAsync(
            GetOrgId(), GetFyId(), header.CustomerCode, ct);

        Console.WriteLine($"👤 Customer Kind={customerInfo?.Kind}, Eco={customerInfo?.EconomicCode}, Melli={customerInfo?.MelliCode}, National={customerInfo?.NationalCode}");

        var invoice = MoadianInvoiceBuilder.Build(
            header, bodies, svc.Options.EconomicCode, customerInfo);

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

        var (token, tokenError) = await GetOrRefreshTokenAsync(svc, ct);
        if (token is null)
            return BadRequest(new { error = "دریافت توکن ناموفق: " + tokenError });

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
            // ⭐ هشدارها رو ذخیره کن
            await _repo.ClearErrorsAsync(GetOrgId(), GetFyId(), header.Id, ct);

            if (item.Warnings != null && item.Warnings.Count > 0)
            {
                // ⭐ فقط هشدارهای مهم رو ذخیره کن:
                //   - 1300501 = سریال صورتحساب منطبق نیست (مهم)
                //   - 14xxx = فیلد اضافی در الگو (بی‌اهمیت)
                //   - 00000 = پیام سیستمی (بی‌اهمیت)
                var criticalWarnings = item.Warnings
                    .Where(w =>
                    {
                        var code = w.Code ?? "";
                        if (string.IsNullOrEmpty(code)) return false;
                         // ⭐ فیلتر همه‌ی هشدارهای بی‌اهمیت
                        if (code.StartsWith("14")) return false;      // فیلد اضافی در الگو
                        if (code == "00000") return false;             // پیام سیستمی
                        if (code == "1300501") return false;           // سریال صورتحساب (warning فقط)

                        return true;
                    })
                    .ToList();

                Console.WriteLine($"⚠️ {item.Warnings.Count} هشدار ({criticalWarnings.Count} مهم):");
                foreach (var w in criticalWarnings.Take(5))
                    Console.WriteLine($"   [{w.Code ?? "?"}] {w.Msg ?? ""}");

                foreach (var w in criticalWarnings)
                {
                    await _repo.AddErrorAsync(GetOrgId(), GetFyId(), header.Id,
                        $"[{w.Code ?? "?"}] {w.Msg ?? ""}", ct);
                }
            }

            // ⭐ در کارپوشه نشسته
            header.Status = 3;
            header.TaxStatus = "SUCCESS";

            header.AcceptRefNumber = item.ConfirmationReferenceId;
            if (string.IsNullOrEmpty(header.RefNumber) && !string.IsNullOrEmpty(item.ReferenceNumber))
                header.RefNumber = item.ReferenceNumber;
            if (string.IsNullOrEmpty(header.Uid) && !string.IsNullOrEmpty(item.Uid))
                header.Uid = item.Uid;

            Console.WriteLine($"✅ INQUIRY: Uid={item.Uid} | Status={item.Status} | Warnings={item.Warnings?.Count ?? 0} → header.Status=3");

            await _repo.UpdateHeaderAsync(GetOrgId(), GetFyId(), header, ct);
        }
        else if (item.Errors.Count > 0)
        {
            await _repo.ClearErrorsAsync(GetOrgId(), GetFyId(), header.Id, ct);

            foreach (var err in item.Errors)
            {
                await _repo.AddErrorAsync(GetOrgId(), GetFyId(), header.Id,
                    $"[{err.Code ?? "?"}] {err.Msg ?? ""}", ct);
            }

            header.Status = 2;
            header.TaxStatus = "ERROR";
            await _repo.UpdateHeaderAsync(GetOrgId(), GetFyId(), header, ct);

            Console.WriteLine($"❌ INQUIRY ERROR: {item.Errors.Count} خطا");
        }

        return Ok(new
        {
            success = true,
            status = item.Status,
            confirmationRefId = item.ConfirmationReferenceId,
            errors = item.Errors,
            warnings = item.Warnings
        });
    }
    [HttpGet("headers/{id:long}/errors")]
    public async Task<IActionResult> GetHeaderErrors(long id, CancellationToken ct)
    {
        var list = await _repo.GetErrorsAsync(GetOrgId(), GetFyId(), id, ct);
        return Ok(new { items = list, count = list.Count });
    }
    [HttpPost("inquiry-by-ref")]
    public async Task<IActionResult> InquiryByRef([FromBody] InquiryRequest req, CancellationToken ct)
    {
        var svc = await BuildServiceAsync(ct);
        if (svc is null) return BadRequest(new { error = "تنظیمات ناقصه" });

        var header = await _repo.GetHeaderByIdAsync(GetOrgId(), GetFyId(), req.HeaderId, ct);
        if (header is null || string.IsNullOrEmpty(header.RefNumber))
            return BadRequest(new { error = "RefNumber موجود نیست" });

        var (token, tokenError) = await GetOrRefreshTokenAsync(svc, ct);
        if (token is null) return BadRequest(new { error = "توکن ناموفق: " + tokenError });

        var result = await svc.InquiryByReferenceNumberAsync(token, new[] { header.RefNumber }, ct);

        return Ok(new
        {
            success = result.Success,
            raw = result.Result,
            error = result.Error
        });
    }
    // ═══════════════════════════════════════════════════════════
    //  CORRECTION — چک قبلی
    // ═══════════════════════════════════════════════════════════
    [HttpGet("headers/{id:long}/has-correction")]
    public async Task<IActionResult> HasCorrection(long id, CancellationToken ct)
    {
        var header = await _repo.GetHeaderByIdAsync(GetOrgId(), GetFyId(), id, ct);
        if (header is null || string.IsNullOrEmpty(header.TaxId))
            return Ok(new { has = false });

        var existing = await _repo.GetCorrectionByRefTaxIdAsync(GetOrgId(), GetFyId(), header.TaxId, ct);
        if (existing is null)
            return Ok(new { has = false });

        return Ok(new
        {
            has = true,
            correction = new
            {
                id = existing.Id,
                inno = existing.Inno,
                ins = existing.Ins,
                status = existing.Status
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  CORRECTION — ابطالی (فاز ۲)
    // ═══════════════════════════════════════════════════════════
    [HttpPost("headers/{id:long}/correct")]
    public async Task<IActionResult> CorrectHeader(long id, [FromBody] CorrectHeaderRequest req, CancellationToken ct)
    {
        var header = await _repo.GetHeaderByIdAsync(GetOrgId(), GetFyId(), id, ct);
        if (header is null) return NotFound(new { error = "سند یافت نشد" });

        if (header.Status != 3)
            return BadRequest(new { error = "فقط اسناد در کارپوشه قابل اصلاح/ابطال هستن" });

        if (header.Ins != null && header.Ins != 1)
            return BadRequest(new { error = "فقط فاکتورهای اصلی قابل اصلاح/ابطال هستن" });

        if (string.IsNullOrEmpty(header.TaxId))
            return BadRequest(new { error = "شماره مالیاتی اصلی موجود نیست" });

        // چک: قبلاً ساخته شده؟
        var existing = await _repo.GetCorrectionByRefTaxIdAsync(GetOrgId(), GetFyId(), header.TaxId, ct);
        if (existing is not null)
            return BadRequest(new { error = $"قبلاً یه سند اصلاحی/ابطالی برای این فاکتور ساخته شده (سریال {existing.Inno})" });

        // ⭐⭐⭐ ابطالی
        if (req.Mode == "cancel")
        {
            var setting = await _repo.GetSettingAsync(GetOrgId(), GetFyId(), ct);
            var memoryId = setting?.TaxUserName ?? "";

            var nextInno = await _repo.GetLastInnoAsync(GetOrgId(), GetFyId(), ct) + 1;

            // تاریخ امروز (شمسی + میلادی)
            var todayPersian = DateTime.Now.ToString("yyyy/MM/dd");
            var pc = new System.Globalization.PersianCalendar();
            var now = DateTime.Now;
            todayPersian = $"{pc.GetYear(now):0000}/{pc.GetMonth(now):00}/{pc.GetDayOfMonth(now):00}";
            var gregorianDate = PersianToGregorian(todayPersian);
            var unixMillis = new DateTimeOffset(gregorianDate).ToUnixTimeMilliseconds();

            var taxId = MoadianCryptoHelper.GenerateTaxId(memoryId, nextInno, gregorianDate);
            Console.WriteLine($"🆔 Cancel TaxId: {taxId} | inno: {nextInno.ToString().PadLeft(10, '0')}");

            var cancelHeader = new Domain.Entities.Moadian.TaxHeader
            {
                Status = 0,
                FactorId = header.FactorId,
                CustomerCode = header.CustomerCode,
                Inno = nextInno.ToString().PadLeft(10, '0'),
                Inty = header.Inty ?? 1,
                Inp = header.Inp ?? 1,
                Ins = 3,                        // ⭐ ابطالی
                Setm = header.Setm,
                Indatim = unixMillis,
                IndatimDatetime = gregorianDate,
                Indati2mDatetime = gregorianDate,
                IndatimPersian = todayPersian,
                Indati2mPersian = todayPersian,
                Tprdis = 0,
                Tdis = 0,
                Tadis = 0,
                Tvam = 0,
                Todam = 0,
                Tbill = 0,
                Tonw = null,
                Torv = null,
                Tocv = null,
                Tvop = 0,
                Cap = 0,
                Insp = 0,
                IrTaxId = header.TaxId,        // ⭐ لینک به فاکتور اصلی
                TaxId = taxId
            };

            var newId = await _repo.AddHeaderAsync(GetOrgId(), GetFyId(), cancelHeader, ct);

            Console.WriteLine($"✅ ابطالی ساخته شد: Id={newId}, inno={nextInno}, ref={header.TaxId}");

            return Ok(new
            {
                success = true,
                headerId = newId,
                inno = nextInno.ToString().PadLeft(10, '0'),
                ins = 3
            });
        }

        // ⭐ برگشت و اصلاحی → فاز ۳
        if (req.Mode == "return" || req.Mode == "amend")
            return BadRequest(new { error = "این حالت در فاز بعدی فعال میشه" });

        return BadRequest(new { error = "حالت ناشناخته: " + req.Mode });
    }
    // ═══════════════════════════════════════════════════════════
    //  برگشت از فروش / اصلاحی با اقلام
    // ═══════════════════════════════════════════════════════════
    [HttpPost("headers/{id:long}/correct-with-items")]
    public async Task<IActionResult> CorrectWithItems(long id, [FromBody] CorrectItemsRequest req, CancellationToken ct)
    {
        var header = await _repo.GetHeaderByIdAsync(GetOrgId(), GetFyId(), id, ct);
        if (header is null) return NotFound(new { error = "سند یافت نشد" });

        if (header.Status != 3)
            return BadRequest(new { error = "فقط اسناد در کارپوشه قابل اصلاح/برگشت هستن" });

        if (header.Ins != null && header.Ins != 1)
            return BadRequest(new { error = "فقط فاکتورهای اصلی قابل اصلاح/برگشت هستن" });

        if (string.IsNullOrEmpty(header.TaxId))
            return BadRequest(new { error = "شماره مالیاتی اصلی موجود نیست" });

        // چک: قبلاً ساخته شده؟
        var existing = await _repo.GetCorrectionByRefTaxIdAsync(GetOrgId(), GetFyId(), header.TaxId, ct);
        if (existing is not null)
            return BadRequest(new { error = $"قبلاً یه سند اصلاحی/برگشتی برای این فاکتور ساخته شده (سریال {existing.Inno})" });

        // ⭐ اقلام اصلی
        var originalBodies = await _repo.GetBodyByHeaderIdAsync(GetOrgId(), GetFyId(), id, ct);
        if (originalBodies.Count == 0)
            return BadRequest(new { error = "فاکتور اصلی ردیف نداره" });

        // ⭐ محاسبه‌ی اقلام برای سند جدید
        // ⭐ اقلام سند جدید — همون چیزی که کاربر وارد کرده
        // (برای هر دو حالت اصلاحی و برگشتی یکسانه)
        // ⭐ محاسبه‌ی اقلام سند جدید
        // ⭐ محاسبه‌ی اقلام سند جدید
        var finalItems = new List<(long StuffId, long UnitId, double Am, long Fee, long Dis, long Vra)>();

        if (req.Mode == "amend")
        {
            // ⭐ اصلاحی: مقدار وارد‌شده = مقدار نهایی سند اصلاحی
            foreach (var it in req.Items)
            {
                if (it.Am <= 0) continue;
                finalItems.Add((it.StuffId, it.UnitId, it.Am, it.Fee, it.Dis, it.Vra));
            }
        }
        else // return
        {
            // ⭐ برگشتی: مقدار وارد‌شده = باقی‌مونده → برگشتی = اصلی - باقی‌مونده
            foreach (var ob in originalBodies)
            {
                var match = req.Items.FirstOrDefault(x => x.StuffId == ob.StuffId && x.UnitId == ob.UnitId);

                double remaining = match?.Am ?? 0;      // اگه کاربر ردیف رو حذف کرده → 0
                double returned = (ob.Am) - remaining;

                if (returned <= 0.0001) continue;       // چیزی برگشت نخورده

                // ⭐ برگشتی با قیمت و تخفیف و VAT اصلی
                finalItems.Add((ob.StuffId, ob.UnitId, returned, ob.Fee ?? 0L, ob.Dis ?? 0L, ob.Vra ?? 0L));
            }
        }

        if (finalItems.Count == 0)
            return BadRequest(new { error = "هیچ تغییری وجود نداره (همه‌ی مقادیر یکسانن)" });

        // ⭐ محاسبه‌ی جمع‌ها
        long tprdis = 0, tdis = 0, tadis = 0, tvam = 0;
        var newBodyRows = new List<(long StuffId, long UnitId, double Am, long Fee, long Dis, long Vra, long Prdis, long Adis, long Vam, long Tsstam)>();

        foreach (var it in finalItems)
        {
            long linePrdis = (long)Math.Round(it.Fee * (decimal)it.Am);
            long lineDis = it.Dis;
            long lineAdis = linePrdis - lineDis;
            long lineVam = (long)Math.Truncate((decimal)lineAdis * it.Vra / 100m);
            long lineTsstam = lineAdis + lineVam;

            tprdis += linePrdis;
            tdis += lineDis;
            tadis += lineAdis;
            tvam += lineVam;

            newBodyRows.Add((it.StuffId, it.UnitId, it.Am, it.Fee, it.Dis, it.Vra, linePrdis, lineAdis, lineVam, lineTsstam));
        }

        long tbill = tadis + tvam;

        // ⭐ تاریخ
        var pc = new System.Globalization.PersianCalendar();
        var now = DateTime.Now;
        var todayPersian = $"{pc.GetYear(now):0000}/{pc.GetMonth(now):00}/{pc.GetDayOfMonth(now):00}";
        var persianDate = string.IsNullOrWhiteSpace(req.IndatimPersian) ? todayPersian : req.IndatimPersian.Trim();
        var gregorianDate = PersianToGregorian(persianDate);
        var unixMillis = new DateTimeOffset(gregorianDate).ToUnixTimeMilliseconds();

        // ⭐ TaxId جدید
        var setting = await _repo.GetSettingAsync(GetOrgId(), GetFyId(), ct);
        var memoryId = setting?.TaxUserName ?? "";
        var nextInno = await _repo.GetLastInnoAsync(GetOrgId(), GetFyId(), ct) + 1;
        var taxId = MoadianCryptoHelper.GenerateTaxId(memoryId, nextInno, gregorianDate);

        int insValue = req.Mode == "amend" ? 2 : 4;   // 2=اصلاحی، 4=برگشت

        Console.WriteLine($"🆔 {req.Mode} TaxId: {taxId} | inno: {nextInno.ToString().PadLeft(10, '0')} | ins: {insValue}");

        // ⭐ ساخت هدر جدید
        var newHeader = new Domain.Entities.Moadian.TaxHeader
        {
            Status = 0,
            FactorId = header.FactorId,
            CustomerCode = header.CustomerCode,
            Inno = nextInno.ToString().PadLeft(10, '0'),
            Inty = header.Inty ?? 1,
            Inp = header.Inp ?? 1,
            Ins = insValue,
            Setm = req.Setm ?? header.Setm,
            Indatim = unixMillis,
            IndatimDatetime = gregorianDate,
            Indati2mDatetime = gregorianDate,
            IndatimPersian = persianDate,
            Indati2mPersian = persianDate,
            Tprdis = tprdis,
            Tdis = tdis,
            Tadis = tadis,
            Tvam = tvam,
            Todam = 0,
            Tbill = tbill,
            Tonw = null,
            Torv = null,
            Tocv = null,
            Tvop = null,
            Cap = null,
            Insp = null,
            IrTaxId = header.TaxId,
            TaxId = taxId
        };

        var newHeaderId = await _repo.AddHeaderAsync(GetOrgId(), GetFyId(), newHeader, ct);

        // ⭐ ساخت ردیف‌ها
        foreach (var b in newBodyRows)
        {
            var body = new Domain.Entities.Moadian.TaxBody
            {
                HeaderId = newHeaderId,
                StuffId = b.StuffId,
                UnitId = b.UnitId,
                Am = b.Am,
                Fee = b.Fee,
                Prdis = b.Prdis,
                Dis = b.Dis,
                Adis = b.Adis,
                Vra = b.Vra,
                Vam = b.Vam,
                Tsstam = b.Tsstam,
                Cut = "IRR"
            };
            await _repo.AddBodyAsync(GetOrgId(), GetFyId(), body, ct);
        }

        Console.WriteLine($"✅ {req.Mode} ساخته شد: Id={newHeaderId}, inno={nextInno}, tbill={tbill}");

        return Ok(new
        {
            success = true,
            headerId = newHeaderId,
            inno = nextInno.ToString().PadLeft(10, '0'),
            ins = insValue,
            tbill = tbill
        });
    }
    // ═══════════════════════════════════════════════════════════
    //  جستجوی کالا (برای Picker)
    // ═══════════════════════════════════════════════════════════
    [HttpGet("articles/search")]
    public async Task<IActionResult> SearchArticles([FromQuery] string? q, CancellationToken ct)
    {
        var items = await _repo.SearchArticlesAsync(GetOrgId(), GetFyId(), q ?? "", ct);
        return Ok(new { items });
    }
    // ═══════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════

    private async Task<(string? Token, string? Error)> GetOrRefreshTokenAsync(IMoadianService svc, CancellationToken ct)
    {
        if (_cachedToken?.Success == true && DateTime.UtcNow < _tokenExpireAt)
            return (_cachedToken.Token, null);

        var r = await svc.GetTokenAsync(ct);
        if (!r.Success)
            return (null, r.Error ?? "خطای نامشخص در دریافت توکن");

        _cachedToken = r;
        var expiresInSec = Math.Min(r.ExpiresIn, 86400);

        // ⭐ ۵ دقیقه قبل از انقضا، renew کن
        _tokenExpireAt = DateTime.UtcNow.AddSeconds(Math.Max(60, expiresInSec - 300));

        return (r.Token, null);
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