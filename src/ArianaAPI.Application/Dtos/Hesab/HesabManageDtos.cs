namespace ArianaAPI.Application.DTOs.Hesab;

/// <summary>
/// سطح حساب — col=کل، moein=معین، tafzil=تفصیلی ۱
/// </summary>
public static class HesabLevel
{
    public const string Col = "col";
    public const string Moein = "moein";
    public const string Tafzil = "tafzil";
}

/// <summary>نمایش یک حساب در لیست</summary>
public class HesabListItemDto
{
    public long HesabID { get; set; }
    public int CodeGroup { get; set; }
    public int CodeCol { get; set; }
    public int CodeMoein { get; set; }
    public int CodeTafzil { get; set; }
    public string Name { get; set; } = "";
    public string? Discript { get; set; }
    public int Mahiat { get; set; }                 // 1=بد، 2=بس، 3=عادی
    public string MahiatStr { get; set; } = "";
    public int Vaziat { get; set; }                 // 0=بسته، 1=باز
    public string VaziatStr { get; set; } = "";
    public int HasTafzili { get; set; }             // تفصیلی ۱ دارد؟
    public int HasTafzili2 { get; set; }            // تفصیلی ۲ دارد؟
    public int IsStock { get; set; }                // انباری
    public int IsCodeVahed { get; set; }            // کد واحد
    public int IsCodeMarkaz { get; set; }           // مرکز هزینه
    public int IsCodeProjeh { get; set; }           // کد پروژه
    public string Level { get; set; } = "";         // col|moein|tafzil
    public string? ParentName { get; set; }         // نام کل (برای معین)
    public string? Kind { get; set; }                  // نوع تفصیلی (0=عادی...4=بازاریاب)
}

/// <summary>درخواست ایجاد حساب جدید</summary>
public class HesabCreateDto
{
    public string Level { get; set; } = HesabLevel.Col;
    public int? CodeGroup { get; set; }
    public int? CodeCol { get; set; }
    public int? CodeMoein { get; set; }
    public int? CodeTafzil { get; set; }
    public string Name { get; set; } = "";
    public string? Discript { get; set; }
    public int Mahiat { get; set; } = 1;
    public int Vaziat { get; set; } = 1;
    public int HasTafzili { get; set; } = 0;
    public int HasTafzili2 { get; set; } = 0;
    public int IsStock { get; set; } = 0;
    public int IsCodeVahed { get; set; } = 0;
    public int IsCodeMarkaz { get; set; } = 0;
    public int IsCodeProjeh { get; set; } = 0;
    public int? Kind { get; set; } = 0;
}

/// <summary>درخواست ویرایش (null = تغییر نده)</summary>
public class HesabUpdateDto
{
    public string? Name { get; set; }
    public string? Discript { get; set; }
    public int? Mahiat { get; set; }
    public int? Vaziat { get; set; }
    public int? HasTafzili { get; set; }
    public int? HasTafzili2 { get; set; }
    public int? IsStock { get; set; }
    public int? IsCodeVahed { get; set; }
    public int? IsCodeMarkaz { get; set; }
    public int? IsCodeProjeh { get; set; }
    public int? Kind { get; set; }
}

/// <summary>وضعیت استفاده‌ی حساب در اسناد</summary>
public class HesabUsageDto
{
    public bool UsedInSanad { get; set; }
    public int SanadCount { get; set; }
    public bool HasChildren { get; set; }             // معین دارد؟ تفصیلی دارد؟
    public string? Message { get; set; }
}