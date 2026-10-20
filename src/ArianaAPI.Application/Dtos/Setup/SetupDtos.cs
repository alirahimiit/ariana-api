namespace ArianaAPI.Application.DTOs.Setup;

public class SetupLoginDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class SazmanItemDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string LicenceSazman { get; set; } = string.Empty;
}

public class DorehMaliItemDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string BeginDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public string SazmanName { get; set; } = string.Empty;
}

public class SetupSazmanListResultDto
{
    public List<SazmanItemDto> ExistingSazmans { get; set; } = new();
    public bool CanCreateNew { get; set; }
    public long NextAvailableId { get; set; }
    public int TotalAuthorized { get; set; }
    public int UsedCount { get; set; }
}

public class SetupRequestDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    public long SazmanId { get; set; }
    public string? SazmanName { get; set; }
    public string? SazmanCode { get; set; }

    public string? SazmanNationalCode { get; set; }
    public string? SazmanRegNo { get; set; }
    public string? SazmanEcoNo { get; set; }
    public string? SazmanPostalCode { get; set; }
    public string? SazmanOstan { get; set; }
    public string? SazmanCityName1 { get; set; }
    public string? SazmanCityName2 { get; set; }
    public string? SazmanAddress { get; set; }
    public string? SazmanPhoneNo { get; set; }

    public string Name { get; set; } = string.Empty;
    public string BeginDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public decimal Tax_Per { get; set; }
    public decimal Avarez_Per { get; set; }

    public long PriorSazmanCode { get; set; }
    public long PriorDorehMaliCode { get; set; }
    public bool IsFirstDoreh { get; set; }

    public bool CopyHesabs { get; set; }
    public bool CopyTafzili { get; set; }
    public bool CopyTafzili2 { get; set; }
    public bool CopyUsers { get; set; }
    public bool CopyBank { get; set; }
    public bool CopyArticle { get; set; }
    public bool CopyConstHesabs { get; set; }
    public bool CopySetting { get; set; }
    public bool CreateSanadEftetah { get; set; }
}

public class SetupResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public long NewDorehMaliId { get; set; }
    public string NewDbName { get; set; } = string.Empty;
}

public class SazmanEditDto
{
    public long SazmanId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? LicenceSazman { get; set; }
    public string? NationalCode { get; set; }
    public string? RegNo { get; set; }
    public string? EcoNo { get; set; }
    public string? PostalCode { get; set; }
    public string? Ostan { get; set; }
    public string? CityName1 { get; set; }
    public string? CityName2 { get; set; }
    public string? Address { get; set; }
    public string? PhoneNo { get; set; }
}

public class DorehMaliEditDto
{
    public long DorehMaliId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string BeginDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public decimal Tax_Per { get; set; }
    public decimal Avarez_Per { get; set; }
    public string? UpDate_Database { get; set; }
}