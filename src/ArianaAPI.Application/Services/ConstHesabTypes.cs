namespace ArianaAPI.Application.Services;

/// <summary>
/// انواع حساب‌های ویژه (ConstHesabs) — مطابق دقیق با HesabTypeName دلفی
/// ⚠️ ترتیب اعداد نباید تغییر کنه — با DB موجود و برنامه دلفی سازگاره
/// </summary>
public static class ConstHesabTypes
{
    // ─── TConstHesabType enum دلفی ───
    public const int Cash = 0;                       // chtCash
    public const int Buy = 1;                        // chtBuy
    public const int BackBuy = 2;                    // chtBackBuy
    public const int BuyDiscount = 3;                // chtBuyDiscount
    public const int BackBuyDiscount = 4;            // chtBackBuyDiscount
    public const int Sale = 5;                       // chtSale
    public const int BackSale = 6;                   // chtBackSale
    public const int SaleDiscount = 7;               // chtSaleDiscount
    public const int BackSaleDiscount = 8;           // chtBackSaleDiscount
    public const int ServiceOffer = 9;               // chtServiceOffer
    public const int ServiceRecieve = 10;            // chtServiceRecieve
    public const int MyAwardArticleInOther = 11;     // chtMyAwardArticleInOther
    public const int OtherAwardArticleWithMe = 12;   // chtOtherAwardArticleWithMe
    public const int ReceivableDocument = 13;        // chtReceivableDocument
    public const int PayableDocument = 14;           // chtPayableDocument
    public const int FirstStoreExistence = 15;       // chtFirstStoreExistence
    public const int LastStoreExistence = 16;        // chtLastStoreExistence
    public const int Loss = 17;                      // chtLoss
    public const int Bed = 18;                       // chtBed
    public const int Bes = 19;                       // chtBes
    public const int SaftehPay = 20;                 // chtSaftehPay
    public const int VamPay = 21;                    // chtVamPay
    public const int Tankhah = 22;                   // chtTankhah
    public const int HazinehHaml = 23;               // chtHazinehHaml
    public const int Daftar = 24;                    // chtDaftar
    public const int BahaTamam = 25;                 // chtBahaTamam
    public const int AvarezBuy = 26;                 // chtAvarezBuy
    public const int TaxBuy = 27;                    // chtTaxBuy
    public const int AvarezSale = 28;                // chtAvarezSale
    public const int TaxSale = 29;                   // chtTaxSale
    public const int MarketerSales = 30;             // chtMarketerSeles

    // ─── این ۴ مورد توی enum دلفی نیستن، فقط توی HesabTypeName ───
    public const int AvarezBuyNasiyeh = 31;          // عوارض ارزش افزوده خرید نسیه
    public const int TaxBuyNasiyeh = 32;             // مالیات ارزش افزوده خرید نسیه
    public const int AvarezSaleNasiyeh = 33;         // عوارض ارزش افزوده فروش نسیه
    public const int TaxSaleNasiyeh = 34;            // مالیات ارزش افزوده فروش نسیه

    /// <summary>تعداد کل انواع (طبق _MaxHesab = 34)</summary>
    public const int MaxType = 34;

    /// <summary>نام فارسی هر نوع — دقیقاً مطابق HesabTypeName دلفی</summary>
    public static readonly Dictionary<int, string> Names = new()
    {
        { 0,  "صندوق" },
        { 1,  "خرید" },
        { 2,  "برگشت از خرید" },
        { 3,  "تخفیفات خرید" },
        { 4,  "تخفیفات برگشت از خرید" },
        { 5,  "فروش" },
        { 6,  "برگشت از فروش" },
        { 7,  "تخفیفات فروش" },
        { 8,  "تخفیفات برگشت از فروش" },
        { 9,  "درآمد حاصل از ارائه خدمات" },
        { 10, "هزینه خدمات" },
        { 11, "کالای امانی ما نزد دیگران" },
        { 12, "کالای امانی دیگران نزد ما" },
        { 13, "اسناد دریافتنی" },
        { 14, "اسناد پرداختنی" },
        { 15, "موجودی ابتدای دوره" },
        { 16, "موجودی انتهای دوره" },
        { 17, "ضایعات فروش" },
        { 18, "بدهکاران" },
        { 19, "بستانکاران" },
        { 20, "سفته‌های پرداختی" },
        { 21, "اقساط وام‌های دریافتی" },
        { 22, "تنخواه" },
        { 23, "هزینه حمل" },
        { 24, "دفتر" },
        { 25, "بهای تمام شده کالا" },
        { 26, "عوارض بر ارزش افزوده خرید نقدی" },
        { 27, "مالیات بر ارزش افزوده خرید نقدی" },
        { 28, "عوارض بر ارزش افزوده فروش نقدی" },
        { 29, "مالیات بر ارزش افزوده فروش نقدی" },
        { 30, "حساب بازاریابی فروش" },
        { 31, "عوارض بر ارزش افزوده خرید نسیه" },
        { 32, "مالیات بر ارزش افزوده خرید نسیه" },
        { 33, "عوارض بر ارزش افزوده فروش نسیه" },
        { 34, "مالیات بر ارزش افزوده فروش نسیه" }
    };

    /// <summary>لیست کامل انواع (برای dropdown/list)</summary>
    public static IReadOnlyList<(int Type, string Name)> All =>
        Names.Select(kv => (kv.Key, kv.Value)).ToList();
}