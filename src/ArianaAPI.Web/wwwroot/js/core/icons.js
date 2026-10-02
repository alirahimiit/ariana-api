/* ═══════════════════════════════════════════════════
   App.Icons — SVG Icons مشترک برای همه‌ی برنامه
   ═══════════════════════════════════════════════════
   روش استفاده:
     - در HTML: <span data-icon="sanad"></span>
     - در JS:   App.Icons.applyAll(container)
     - خودکار:  sidebar و کارت‌ها (بعد از هر route)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

window.App.Icons = (function () {
    'use strict';

    const SIZE = '20';
    const STROKE = '2';

    // ⭐ پایه‌ی همه‌ی SVG ها
    function svg(content, size) {
        const s = size || SIZE;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
    }

    // ═══════════════════════════════════════════════════
    //  دیکشنری آیکن‌ها
    // ═══════════════════════════════════════════════════
    const ICONS = {

        // ─── گروه‌ها ───
        'group-main': svg('<path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>'),
        'group-accounting': svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
        'group-reports': svg('<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>'),
        'group-goods': svg('<path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
        'group-payments': svg('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>'),
        'group-article': svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),

        // ─── آیتم‌های اصلی ───
        'dashboard': svg('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'),
        'sanad': svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>'),
        'ledger': svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
        'taraz': svg('<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 7h6z"/><path d="M19 7l-3 7h6z"/><path d="M8 21h8"/>'),

        // ─── گزارشات مالی ───
        'profitloss': svg('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'),
        'bilan': svg('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>'),
        'daybook': svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/>'),

        // ─── فاکتورها ───
        'factor': svg('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>'),
        'factor-buy': svg('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/><polyline points="14 5 17 8 20 5"/>'),
        'factor-sell': svg('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/><polyline points="14 8 17 5 20 8"/>'),
        'factor-buy-return': svg('<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>'),
        'factor-sell-return': svg('<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>'),
        'factor-scrap': svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
        'factor-pre': svg('<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>'),

        // ─── انبار ───
        'stock-receipt': svg('<path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
        'stock-transfer': svg('<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 3l-7 7"/><path d="M3 3l7 7"/><path d="M16 21h5v-5"/><path d="M8 21H3v-5"/><path d="M21 21l-7-7"/><path d="M3 21l7-7"/>'),
        'stock-return': svg('<path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
        'asset': svg('<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>'),
        'asset-transfer': svg('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
        'stock-count': svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><polyline points="9 14 11 16 15 12"/>'),

        // ─── دریافت/پرداخت ───
        'receive-cash': svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>'),
        'receive-cheque': svg('<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M2 10h20"/><path d="M7 15h2"/><path d="M13 15h4"/>'),
        'pay-cash': svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/><polyline points="8 3 12 6 16 3"/>'),
        'pay-cheque': svg('<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M2 10h20"/><path d="M7 15h2"/><path d="M13 15h4"/><polyline points="10 3 12 5 14 3"/>'),

        // ─── گزارشات انبار ───
        'article-rotate': svg('<path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>'),
        'kardex': svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>'),
        'article-stock': svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
        'party-factor': svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
        'factor-profit-loss': svg('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/><line x1="2" y1="2" x2="22" y2="22"/>'),

        // ─── اطلاعات پایه ───
        'hesab': svg('<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="9" y1="12" x2="9" y2="12"/><line x1="9" y1="15" x2="9" y2="15"/>'),
        'tafzili': svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
        'article': svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
        'sharh': svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
        'kind': svg('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'),
        //مودیان
        'moadian': svg('<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="9" y1="12" x2="9" y2="12"/><line x1="9" y1="15" x2="9" y2="15"/><circle cx="15" cy="8" r="2"/><circle cx="15" cy="15" r="2"/>'),
        // ─── عمومی ───
        'default': svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
        'search': svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
        'filter': svg('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
        'settings': svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
        'logout': svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
        'user': svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')
    };

    // ═══════════════════════════════════════════════════
    //  API
    // ═══════════════════════════════════════════════════

    /** گرفتن SVG یک آیکن با نام */
    function get(name) {
        return ICONS[name] || ICONS['default'];
    }

    /** اعمال روی همه‌ی [data-icon] ها در یه container */
    function applyAll(container) {
        const root = container || document;
        root.querySelectorAll('[data-icon]').forEach(function (el) {
            const name = el.dataset.icon;
            if (ICONS[name]) {
                el.innerHTML = ICONS[name];
                el.classList.add('has-icon-svg');
            }
        });
    }

    // ═══════════════════════════════════════════════════
    //  مپینگ صفحه → آیکن
    // ═══════════════════════════════════════════════════
    const PAGE_ICON_MAP = {
        'dashboard': 'dashboard',
        'sanad': 'sanad',
        'ledger': 'ledger',
        'taraz': 'taraz',
        'profitloss': 'profitloss',
        'bilan': 'bilan',
        'daybook': 'daybook',
        'factor': 'factor',
        'factor-buy': 'factor-buy',
        'factor-sell': 'factor-sell',
        'factor-buy-return': 'factor-buy-return',
        'factor-sell-return': 'factor-sell-return',
        'factor-scrap': 'factor-scrap',
        'factor-pre': 'factor-pre',
        'stock-receipt': 'stock-receipt',
        'stock-transfer': 'stock-transfer',
        'stock-return-receipt': 'stock-return',
        'asset-goods': 'asset',
        'asset-goods-transfer': 'asset-transfer',
        'stock-count': 'stock-count',
        'receive-cash': 'receive-cash',
        'receive-cheque': 'receive-cheque',
        'pay-cash': 'pay-cash',
        'pay-cheque': 'pay-cheque',
        'kardex': 'kardex',
        'article-rotate': 'article-rotate',
        'article-stock': 'article-stock',
        'party-factor': 'party-factor',
        'factor-profit-loss': 'factor-profit-loss',
        'moadian': 'moadian',
        'hesab': 'hesab',
        'tafzili': 'tafzili',
        'article': 'article',
        'sharh': 'sharh',
        'kind': 'kind'
    };

    const GROUP_ICON_MAP = {
        'main': 'group-main',
        'accounting': 'group-accounting',
        'reports': 'group-reports',
        'goods': 'group-goods',
        'payments': 'group-payments',
        'moadian': 'moadian',
        'report-articl': 'group-article'
    };

    // ═══════════════════════════════════════════════════
    //  ⭐ جانشین خودکار ایموجی ها در Sidebar
    // ═══════════════════════════════════════════════════
    function replaceSidebarIcons() {
        // ═══ گروه‌ها ═══
        document.querySelectorAll('.nav-group[data-group]').forEach(function (g) {
            const key = g.dataset.group;
            const iconName = GROUP_ICON_MAP[key];
            if (!iconName) return;

            const iconEl = g.querySelector('.nav-group-icon');
            if (iconEl && !iconEl.querySelector('svg')) {
                iconEl.innerHTML = ICONS[iconName];
                iconEl.classList.add('has-svg');
            }
        });

        // ═══ آیتم‌ها ═══
        document.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
            const page = item.dataset.page;
            const iconName = PAGE_ICON_MAP[page];
            if (!iconName) return;

            const iconEl = item.querySelector('.nav-icon');
            if (iconEl && !iconEl.querySelector('svg')) {
                iconEl.innerHTML = ICONS[iconName];
                iconEl.classList.add('has-svg');
            }
        });
    }

    // ═══════════════════════════════════════════════════
    //  راه‌اندازی
    // ═══════════════════════════════════════════════════
    function init() {
        // ۱. جایگزینی در sidebar
        replaceSidebarIcons();

        // ۲. اعمال روی همه‌ی [data-icon] های موجود
        applyAll(document);

        // ۳. MutationObserver — هر بار sidebar عوض شد، دوباره اعمال کن
        if (!window._iconsObserver) {
            window._iconsObserver = new MutationObserver(function () {
                replaceSidebarIcons();
                applyAll(document);
            });
            window._iconsObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        console.log('✅ App.Icons initialized');
    }

    // وقتی DOM آماده شد
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        get: get,
        applyAll: applyAll,
        replaceSidebarIcons: replaceSidebarIcons,
        ICONS: ICONS
    };
})();