/* ═══════════════════════════════════════════════════
   Core / Helpers
   توابع کمکی عمومی — فرمت‌بندی، escape، تبدیل اعداد
   ═══════════════════════════════════════════════════
   وابستگی: هیچ
   استفاده:
     App.Helpers.fmt(1234)
     App.Helpers.esc('<script>')
     App.Helpers.fmtSigned(-5000)
     App.Helpers.fmtAcc(-5000)  // (۵,۰۰۰)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

App.Helpers = (function () {
    'use strict';

    /**
     * فرمت‌بندی عدد با جداکننده هزارگان فارسی
     * @param {number|string|null} n
     * @returns {string} مثال: "۱,۲۳۴,۵۶۷"
     */
    function fmt(n) {
        if (n == null || n === '' || n === 0) return '';
        const num = Number(n);
        if (isNaN(num)) return esc(String(n));
        return num.toLocaleString('fa-IR');
    }
    /**
 * فرمت مخصوص جدول — برای صفر/null خط تیره برمی‌گردونه
 */
    function fmtT(n) {
        if (n == null || n === '' || n === 0) return '-';
        const num = Number(n);
        if (isNaN(num)) return esc(String(n));
        return num.toLocaleString('fa-IR');
    }

    /**
     * فرمت عدد علامت‌دار — صفر با "-" نمایش داده می‌شود
     * @param {number|string|null} n
     * @returns {string}
     */
    function fmtSigned(n) {
        if (n == null || n === '') return '-';
        const num = Number(n);
        if (isNaN(num)) return esc(String(n));
        if (num === 0) return '-';
        return num.toLocaleString('fa-IR');
    }

    /**
     * فرمت حسابداری: عدد منفی داخل پرانتز
     * @param {number|string|null} n
     * @returns {string} مثال: "(۵,۰۰۰)"
     */
    function fmtAcc(n) {
        if (n == null || n === '') return '-';
        const num = Number(n);
        if (isNaN(num)) return esc(String(n));
        if (num < 0) return `(${Math.abs(num).toLocaleString('fa-IR')})`;
        return num.toLocaleString('fa-IR');
    }

    /**
     * Escape کردن HTML — برای جلوگیری از XSS
     * @param {string|null} s
     * @returns {string}
     */
    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * تبدیل اعداد فارسی/عربی به لاتین
     * @param {string} str
     * @returns {string}
     */
    function toLatinDigits(str) {
        if (!str) return '';
        return String(str)
            .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
            .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    }

    /**
     * تبدیل رشته به عدد (با حمایت از اعداد فارسی و کاما)
     * @param {string} str
     * @returns {number|null}
     */
    function parseNumber(str) {
        if (str == null || str === '') return null;
        const norm = toLatinDigits(str).replace(/[,\s٬،]/g, '');
        const n = parseFloat(norm);
        return isNaN(n) ? null : n;
    }

    /**
     * اعتبارسنجی قالب تاریخ شمسی
     * @param {string} s
     * @returns {boolean}
     */
    function isValidDate(s) {
        if (!s) return false;
        return /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(toLatinDigits(s));
    }

    /**
     * مقایسه دو تاریخ شمسی (برای sort)
     * @param {string} a
     * @param {string} b
     * @returns {number}
     */
    function compareDates(a, b) {
        const na = toLatinDigits(a || '').replace(/\//g, '');
        const nb = toLatinDigits(b || '').replace(/\//g, '');
        return na.localeCompare(nb);
    }
    function todayPersian() {  // ← function declaration
        const now = new Date();
        return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(now);
        // خروجی: 1404/09/26 (خودش اسلش می‌ذاره)
    }


    // ═══════════════════════════════════════════════════
    //  تبدیل عدد به حروف فارسی (پشتیبانی از میلیارد و تریلیون)
    // ═══════════════════════════════════════════════════
    function toPersianWords(n) {
        if (!n || isNaN(n)) return '';

        n = Math.floor(Math.abs(n));
        if (n === 0) return 'صفر ریال';

        const yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
        const dahgan = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
        const dah = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
        const sadgan = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];

        function threeDigitsToWords(x) {
            const s = Math.floor(x / 100);
            const d = Math.floor((x % 100) / 10);
            const y = x % 10;
            const out = [];
            if (s > 0) out.push(sadgan[s]);
            if (d === 1) out.push(dah[y]);
            else {
                if (d > 1) out.push(dahgan[d]);
                if (y > 0) out.push(yekan[y]);
            }
            return out.join(' و ');
        }

        const parts = [];
        const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'همت'];
        let scaleIndex = 0;

        // حلقه برای خواندن عدد به صورت سه رقم سه رقم (هزار، میلیون، میلیارد و ...)
        while (n > 0) {
            const chunk = n % 1000;
            if (chunk > 0) {
                const words = threeDigitsToWords(chunk);
                if (words) {
                    parts.unshift(words + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : ''));
                }
            }
            n = Math.floor(n / 1000);
            scaleIndex++;
        }

        return parts.join(' و ') + ' ریال';
    }


    return {
        fmt,
        fmtT,
        fmtSigned,
        fmtAcc,
        esc,
        toLatinDigits,
        parseNumber,
        isValidDate,
        compareDates,
        todayPersian,
        toPersianWords: toPersianWords
    };
})();