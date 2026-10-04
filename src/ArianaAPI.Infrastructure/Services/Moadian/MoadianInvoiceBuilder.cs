using ArianaAPI.Application.Dtos.Moadian;
using ArianaAPI.Domain.Entities.Moadian;

namespace ArianaAPI.Infrastructure.Services.Moadian;

/// <summary>
/// تبدیل TaxHeader + TaxBody → MoadianInvoice (فرمت نهایی برای ارسال)
/// </summary>
public static class MoadianInvoiceBuilder
{
    public static MoadianInvoice Build(
        TaxHeader header,
        List<TaxBody> bodies,
        string sellerEconomicCode,
        CustomerTaxInfo? customer = null)
    {
        var invoice = new MoadianInvoice
        {
            Header = new MoadianInvoiceHeader
            {
                TaxId = header.TaxId,
                Indatim = header.Indatim,
                Inty = header.Inty ?? 1,
                Inno = PadInno(header.Inno),
                IrTaxId = NullIfEmpty(header.IrTaxId),
                Inp = header.Inp ?? 1,
                Ins = header.Ins ?? 1,
                Tins = sellerEconomicCode,

                // ⭐ اینجا اطلاعات خریدار ست میشه
                Tob = 1,           // پیش‌فرض — پایین‌تر overwrite میشه
                Bid = null,
                Tinb = null,

                Sbc = NullIfEmpty(header.Sbc),
                Bpc = NullIfEmpty(header.Bpc),
                Bbc = NullIfEmpty(header.Bbc),
                Ft = header.Ft,
                Bpn = NullIfEmpty(header.Bpn),
                Scln = NullIfEmpty(header.Scln),
                Scc = NullIfEmpty(header.Scc),
                Cdcn = NullIfEmpty(header.Cdcn),
                Cdcd = header.Cdcd,
                Crn = NullIfEmpty(header.Crn),
                BillId = NullIfEmpty(header.BillId),
                Tprdis = header.Tprdis.HasValue ? (long?)header.Tprdis.Value : null,
                Tdis = header.Tdis,
                Tadis = header.Tadis,
                Tvam = header.Tvam,
                Todam = header.Todam,
                Tbill = header.Tbill.HasValue ? (long?)header.Tbill.Value : null,
                Tonw = header.Tonw,
                Torv = header.Torv,
                Tocv = header.Tocv,
                Setm = header.Setm,
                Cap = header.Cap,
                Insp = header.Insp,
                Tvop = header.Tvop,
                Tax17 = header.Tax17
            },

            Body = bodies.Select(b => new MoadianInvoiceBody
            {
                Sstid = b.Sstid ?? "",
                Sstt = b.Sstt ?? "",
                Am = b.Am,
                Mu = b.Mu ?? "",
                Nw = b.Nw,
                Fee = b.Fee,
                Cfee = b.Cfee,
                Cut = b.Cut,
                Exr = b.Exr,
                Ssrv = b.Ssrv,
                Sscv = b.Sscv,
                Prdis = b.Prdis.HasValue ? (long?)b.Prdis.Value : null,
                Dis = b.Dis,
                Adis = b.Adis,
                Vra = b.Vra,
                Vam = b.Vam,
                Odt = NullIfEmpty(b.Odt),
                Odr = b.Odr,
                Odam = b.Odam,
                Olt = NullIfEmpty(b.Olt),
                Olr = b.Olr,
                Olam = b.Olam,
                Consfee = b.Consfee,
                Spro = b.Spro,
                Bros = b.Bros,
                Tcpbs = b.Tcpbs,
                Cop = b.Cop,
                Vop = b.Vop,
                Bsrn = NullIfEmpty(b.Bsrn),
                Tsstam = b.Tsstam.HasValue ? (long?)b.Tsstam.Value : null
            }).ToList(),

            Payments = new List<MoadianInvoicePayment>(),
            Extension = new List<MoadianInvoiceExtension>()
        };

        // ⭐⭐⭐ تعیین نوع خریدار و شماره اقتصادی/ملی — دقیقاً طبق WinForms
        if (customer != null)
        {
            if (customer.Kind == 1 || customer.Kind == 4)
            {
                // حقیقی یا اتباع غیرایرانی
                invoice.Header.Tob = 1;
                invoice.Header.Tinb = NullIfEmpty(customer.EconomicCode);
                invoice.Header.Bid = NullIfEmpty(customer.MelliCode);

                // اگه شماره اقتصادی ۱۱ رقمی بود → مشارکت مدنی
                if (customer.EconomicCode?.Length == 11)
                {
                    invoice.Header.Tob = 3;
                    invoice.Header.Bid = customer.EconomicCode;
                }
            }
            else
            {
                // حقوقی یا مشارکت مدنی
                invoice.Header.Tob = 2;
                invoice.Header.Tinb = NullIfEmpty(customer.EconomicCode);
                invoice.Header.Bid = NullIfEmpty(customer.NationalCode);
            }
        }

        // ⭐ صادرات (inp=7): اطلاعات خریدار لازم نیست
        if (header.Inp == 7)
        {
            invoice.Header.Tinb = null;
            invoice.Header.Bid = null;
        }

        return invoice;
    }



    private static string? NullIfEmpty(string? s)
        => string.IsNullOrWhiteSpace(s) ? null : s;

    /// <summary>
    /// تعیین نوع خریدار:
    /// 1=حقیقی، 2=حقوقی، 3=مشارکت مدنی، 4=اتباع غیرایرانی، 5=مصرف‌کننده نهایی
    /// </summary>
    private static int DetermineTob(long customerCode)
    {
        // TODO: بعداً از جدول Hesab خوانده می‌شود (kind یا kindName)
        return 1; // پیش‌فرض: حقیقی
    }
    private static string PadInno(string? inno)
    {
        if (string.IsNullOrWhiteSpace(inno)) return "0000000000";
        var s = inno.Trim();
        if (s.Length >= 10) return s.Substring(s.Length - 10);   // اگه بیشتر بود، از راست ۱۰ تا
        return s.PadLeft(10, '0');
    }
}