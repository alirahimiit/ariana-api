using ArianaAPI.Application.DTOs.Setup;
using ArianaAPI.Application.Interfaces;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace ArianaAPI.Web.Controllers;

[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly ISetupRepository _repo;
    private readonly IConfiguration _config;

    public SetupController(ISetupRepository repo, IConfiguration config)
    {
        _repo = repo;
        _config = config;
    }

    private string GetPermanentConnectionString()
    {
        var server = _config["Database:Server"] ?? "localhost";
        var user = _config["Database:UserId"] ?? "sa";
        var pass = _config["Database:Password"] ?? "";
        var permanentDb = _config["Database:DatabaseName"] ?? "Permanent";

        return new SqlConnectionStringBuilder
        {
            DataSource = server,
            UserID = user,
            Password = pass,
            InitialCatalog = permanentDb,
            TrustServerCertificate = true,
            ConnectTimeout = 60
        }.ConnectionString;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] SetupLoginDto dto, CancellationToken ct)
    {
        var ok = await _repo.AuthenticateAsync(dto.Username, dto.Password, ct);
        if (!ok) return Unauthorized(new { error = "نام کاربری یا رمز عبور نامعتبر است" });
        return Ok(new { success = true });
    }

    [HttpGet("sazmans")]
    public async Task<IActionResult> GetSazmans(CancellationToken ct)
    {
        var list = await _repo.GetSazmansAsync(ct);
        return Ok(list);
    }

    [HttpGet("doreh-malis")]
    public async Task<IActionResult> GetDorehMalis([FromQuery] long sazmanId, CancellationToken ct)
    {
        var list = await _repo.GetDorehMalisAsync(sazmanId, ct);
        return Ok(list);
    }

    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] SetupRequestDto req, CancellationToken ct)
    {
        try
        {
            var result = await _repo.CreateDorehMaliAsync(req, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  Endpoints برای ویرایش سازمان و دوره مالی (جلسه جدید)
    // ═══════════════════════════════════════════════════════════

    [HttpGet("sazman/{id}")]
    public async Task<IActionResult> GetSazman(long id, CancellationToken ct)
    {
        await using var conn = new SqlConnection(GetPermanentConnectionString());
        var sql = @"
            SELECT 
                SazmanID AS SazmanId, 
                Name, 
                LicenceSazman, 
                NationalCode, 
                RegNo, 
                EcoNo, 
                PostalCode, 
                Ostan, 
                CityName1, 
                CityName2, 
                Address, 
                PhoneNo 
            FROM Sazman 
            WHERE SazmanID = @id";

        var result = await conn.QueryFirstOrDefaultAsync<SazmanEditDto>(sql, new { id });
        if (result == null) return NotFound(new { error = "سازمان یافت نشد" });
        return Ok(result);
    }

    [HttpPut("sazman/{id}")]
    public async Task<IActionResult> UpdateSazman(long id, [FromBody] SazmanEditDto dto, CancellationToken ct)
    {
        await using var conn = new SqlConnection(GetPermanentConnectionString());

        // ⭐ ۱. خواندن نام فعلی سازمان از دیتابیس قبل از تغییر
        var currentName = await conn.ExecuteScalarAsync<string>(
            "SELECT Name FROM Sazman WHERE SazmanID = @id",
            new { id });

        if (currentName == null)
            return NotFound(new { error = "سازمان یافت نشد" });

        // ⭐ ۲. منطق قفل کردن نام سازمان
        // اگر نام فعلی شامل کلمه "تست" نبود، نام جدیدِ ارسالی از سمت کاربر را نادیده بگیر
        if (!currentName.Contains("تست"))
        {
            dto.Name = currentName; // بازگرداندن نام قبلی
        }

        // ۳. اجرای آپدیت در دیتابیس
        var sql = @"
            UPDATE Sazman SET 
                Name = @Name, 
                LicenceSazman = @LicenceSazman, 
                NationalCode = @NationalCode,
                RegNo = @RegNo, 
                EcoNo = @EcoNo, 
                PostalCode = @PostalCode,
                Ostan = @Ostan, 
                CityName1 = @CityName1, 
                CityName2 = @CityName2,
                Address = @Address, 
                PhoneNo = @PhoneNo
            WHERE SazmanID = @id";

        await conn.ExecuteAsync(sql, new
        {
            id,
            dto.Name,
            dto.LicenceSazman,
            dto.NationalCode,
            dto.RegNo,
            dto.EcoNo,
            dto.PostalCode,
            dto.Ostan,
            dto.CityName1,
            dto.CityName2,
            dto.Address,
            dto.PhoneNo
        });
        return Ok(new { success = true });
    }

    [HttpGet("doreh-mali/{id}")]
    public async Task<IActionResult> GetDorehMali(long id, CancellationToken ct)
    {
        await using var conn = new SqlConnection(GetPermanentConnectionString());
        var sql = @"
            SELECT 
                DorehMaliID AS DorehMaliId, 
                Name, 
                BeginDate, 
                EndDate, 
                Tax_Per, 
                Avarez_Per, 
                UpDate_Database 
            FROM DorehMali 
            WHERE DorehMaliID = @id";

        var result = await conn.QueryFirstOrDefaultAsync<DorehMaliEditDto>(sql, new { id });
        if (result == null) return NotFound(new { error = "دوره مالی یافت نشد" });
        return Ok(result);
    }

    [HttpPut("doreh-mali/{id}")]
    public async Task<IActionResult> UpdateDorehMali(long id, [FromBody] DorehMaliEditDto dto, CancellationToken ct)
    {
        await using var conn = new SqlConnection(GetPermanentConnectionString());
        var sql = @"
            UPDATE DorehMali SET 
                Name = @Name, 
                BeginDate = @BeginDate, 
                EndDate = @EndDate, 
                Tax_Per = @Tax_Per, 
                Avarez_Per = @Avarez_Per, 
                UpDate_Database = @UpDate_Database
            WHERE DorehMaliID = @id";

        await conn.ExecuteAsync(sql, new
        {
            id,
            dto.Name,
            dto.BeginDate,
            dto.EndDate,
            dto.Tax_Per,
            dto.Avarez_Per,
            dto.UpDate_Database
        });
        return Ok(new { success = true });
    }
}