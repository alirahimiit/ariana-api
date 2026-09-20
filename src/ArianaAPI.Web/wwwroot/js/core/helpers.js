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
        if (n == null || n === '') return '-';
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

    return {
        fmt,
        fmtSigned,
        fmtAcc,
        esc,
        toLatinDigits,
        parseNumber,
        isValidDate,
        compareDates
    };
})();