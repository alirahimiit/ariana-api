namespace ArianaAPI.Application.Common;

/// <summary>
/// ساختار استاندارد پاسخ API (همه‌ی Endpoint ها این رو برمی‌گردونن)
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public int Code { get; set; } = 200;

    public static ApiResponse<T> Ok(T data) => new()
    {
        Success = true,
        Data = data,
        Code = 200
    };

    public static ApiResponse<T> Fail(string error, int code = 400) => new()
    {
        Success = false,
        Error = error,
        Code = code
    };
}

/// <summary>
/// پاسخ بدون داده (فقط برای عملیات موفق)
/// </summary>
public class ApiResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public int Code { get; set; } = 200;

    public static ApiResponse Ok() => new() { Success = true, Code = 200 };
    public static ApiResponse Fail(string error, int code = 400) => new()
    {
        Success = false,
        Error = error,
        Code = code
    };
}