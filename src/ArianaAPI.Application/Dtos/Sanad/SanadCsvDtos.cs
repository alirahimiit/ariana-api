namespace ArianaAPI.Application.DTOs.Sanad;

public class SanadImportRequest
{
    public string CsvContent { get; set; } = "";
    /// <summary>اگر true باشه، شماره سند موجود در CSV نادیده گرفته می‌شه و شماره جدید ساخته می‌شه</summary>
    public bool ForceNewNumbers { get; set; } = false;
}

public class SanadImportPreviewResult
{
    public bool IsValid { get; set; }
    public int TotalLines { get; set; }
    public int ValidLines { get; set; }
    public int SanadCount { get; set; }
    public int ItemCount { get; set; }
    public decimal TotalBed { get; set; }
    public decimal TotalBes { get; set; }
    public List<SanadImportError> Errors { get; set; } = new();
    public List<SanadImportWarning> Warnings { get; set; } = new();
    public List<SanadImportPreviewItem> Preview { get; set; } = new();
}

public class SanadImportPreviewItem
{
    public int SourceNoSanad { get; set; }
    public int NewNoSanad { get; set; }
    public string? DateIn { get; set; }
    public string? Sharh { get; set; }
    public int ItemCount { get; set; }
    public decimal TotalBed { get; set; }
    public decimal TotalBes { get; set; }
    public bool IsBalanced { get; set; }
}

public class SanadImportError
{
    public int LineNumber { get; set; }
    public string Column { get; set; } = "";
    public string Message { get; set; } = "";
}

public class SanadImportWarning
{
    public int LineNumber { get; set; }
    public string Message { get; set; } = "";
}

public class SanadImportResult
{
    public int CreatedSanads { get; set; }
    public int CreatedItems { get; set; }
    public List<int> NewNoSanads { get; set; } = new();
    public List<long> ParentSanadIds { get; set; } = new();
}