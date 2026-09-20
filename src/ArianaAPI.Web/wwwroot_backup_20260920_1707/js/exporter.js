/* ═══════════════════════════════════════════════════
   Exporter — ماژول مشترک خروجی Excel و چاپ
   استفاده:
     Exporter.attach(element, { title, subtitle, filename });
   → دکمه‌های Excel و چاپ را خودکار اضافه می‌کند
   ═══════════════════════════════════════════════════ */

const Exporter = {

    _styleInjected: false,

    // ═══════════════════════════════════════════
    //  تزریق CSS — فقط بار اول
    // ═══════════════════════════════════════════
    _injectStyle() {
        if (this._styleInjected) return;
        this._styleInjected = true;

        const style = document.createElement('style');
        style.textContent = `
            .export-bar {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 8px;
                margin: 12px 0 4px;
                padding: 10px 0;
                border-top: 1px dashed #E5E7EB;
            }
            .export-bar button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 7px 14px;
                font-family: inherit;
                font-size: 12.5px;
                font-weight: 500;
                border-radius: 8px;
                border: 1px solid #E5E7EB;
                background: #fff;
                color: #111827;
                cursor: pointer;
                transition: all 0.15s;
            }
            .export-bar button:hover {
                background: #EEF2FF;
                border-color: #4F46E5;
                color: #4F46E5;
                transform: translateY(-1px);
            }
            .export-bar button:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    },

    // ═══════════════════════════════════════════
    //  attach — دکمه‌ها را به یک المنت اضافه می‌کند
    // ═══════════════════════════════════════════
    attach(selector, options = {}) {
        this._injectStyle();

        const el = typeof selector === 'string'
            ? document.querySelector(selector)
            : selector;

        if (!el) {
            console.warn('Exporter.attach: element not found →', selector);
            return;
        }

        // اگه قبلاً اضافه شده، حذفش کن
        el.querySelectorAll(':scope > .export-bar').forEach(b => b.remove());

        const bar = document.createElement('div');
        bar.className = 'export-bar';
        bar.innerHTML = `
            <button type="button" data-act="excel">📥 خروجی Excel</button>
            <button type="button" data-act="print">🖨️ چاپ</button>
        `;

        el.insertBefore(bar, el.firstChild);

        bar.querySelector('[data-act="excel"]').addEventListener('click', async () => {
            const btn = bar.querySelector('[data-act="excel"]');
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'در حال تهیه...';

            try {
                let content;
                if (typeof options.customHtml === 'function') {
                    content = await options.customHtml();
                } else if (options.customHtml) {
                    content = options.customHtml;
                } else {
                    let table;
                    if (options.getFullTable) {
                        table = await options.getFullTable();
                    } else {
                        table = this._resolveTable(el, options);
                    }
                    if (!table) { alert('جدولی یافت نشد'); return; }
                    content = table.outerHTML;
                }

                this.toExcelHtml({
                    content,
                    title: options.title || 'گزارش',
                    subtitle: options.subtitle || '',
                    filename: options.filename || 'Report'
                });
            } catch (err) {
                alert('خطا در تهیه خروجی: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = original;
            }
        });

        bar.querySelector('[data-act="print"]').addEventListener('click', async () => {
            const btn = bar.querySelector('[data-act="print"]');
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'در حال تهیه...';

            try {
                let content;
                if (typeof options.customHtml === 'function') {
                    content = await options.customHtml();
                } else if (options.customHtml) {
                    content = options.customHtml;
                } else {
                    let table;
                    if (options.getFullTable) {
                        table = await options.getFullTable();
                    } else {
                        table = this._resolveTable(el, options);
                    }
                    if (!table) { alert('جدولی یافت نشد'); return; }
                    content = table.outerHTML;
                }

                this.printHtml({
                    content,
                    title: options.title || 'گزارش',
                    subtitle: options.subtitle || ''
                });
            } catch (err) {
                alert('خطا در تهیه خروجی: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = original;
            }
        });
    },

    // ═══════════════════════════════════════════
    //  پیدا کردن جدول
    // ═══════════════════════════════════════════
    _resolveTable(el, options) {
        if (options.table) {
            if (typeof options.table === 'string') return document.querySelector(options.table);
            if (options.table instanceof HTMLElement) return options.table;
        }
        if (el.tagName === 'TABLE') return el;
        return el.querySelector('table');
    },
    // ═══════════════════════════════════════════
    //  Excel از HTML کامل
    // ═══════════════════════════════════════════
    toExcelHtml({ content, title = 'گزارش', subtitle = '', filename = 'Report' }) {
        const now = new Date().toLocaleString('fa-IR');

        const html = `
            <html xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Tahoma; direction: rtl; }
                    table { border-collapse: collapse; direction: rtl; font-family: Tahoma; width: 100%; }
                    td, th {
                        border: 1px solid #999;
                        padding: 6px 10px;
                        font-size: 12px;
                        text-align: center;
                    }
                    th { background: #4F46E5; color: white; font-weight: bold; }
                    .title { font-size: 16px; font-weight: bold; color: #4F46E5; background: #EEF2FF; }
                    .meta  { font-size: 12px; color: #444; background: #F9FAFB; }
                    .num { text-align: left; direction: ltr; }
                    .text-left { text-align: left; }
                    .text-center { text-align: center; }
                    .section-title {
                        font-size: 13px;
                        font-weight: bold;
                        color: #4F46E5;
                        background: #EEF2FF;
                        padding: 8px;
                        margin-top: 12px;
                    }
                    tfoot td { font-weight: bold; background: #EEF2FF; }
                </style>
            </head>
            <body>
                <table>
                    <tr><td class="title" colspan="20">${this._esc(title)}</td></tr>
                    ${subtitle ? `<tr><td class="meta" colspan="20">${this._esc(subtitle)}</td></tr>` : ''}
                    <tr><td class="meta" colspan="20">تاریخ تهیه: ${now}</td></tr>
                </table>
                ${content}
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff' + html], {
            type: 'application/vnd.ms-excel;charset=utf-8'
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    },

    // ═══════════════════════════════════════════
    //  چاپ از HTML کامل
    // ═══════════════════════════════════════════
    printHtml({ content, title = 'گزارش', subtitle = '' }) {
        const now = new Date().toLocaleString('fa-IR');

        const printWin = window.open('', '_blank', 'width=1200,height=800');
        if (!printWin) { alert('لطفاً پاپ‌آپ را فعال کنید'); return; }

        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>${this._esc(title)}</title>
                <style>
                    @page { size: A4 landscape; margin: 8mm 6mm; }
                    * { box-sizing: border-box; }
                    body {
                        font-family: Tahoma, Arial, sans-serif;
                        direction: rtl;
                        margin: 0;
                        padding: 12px;
                        color: #111;
                        font-size: 12px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 12px;
                        padding-bottom: 8px;
                        border-bottom: 2px solid #4F46E5;
                    }
                    .header h1 {
                        font-size: 17px;
                        margin: 0 0 4px;
                        color: #4F46E5;
                    }
                    .header .meta {
                        font-size: 11px;
                        color: #666;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                    }
                    th {
                        background: #4F46E5 !important;
                        color: white !important;
                        padding: 6px 6px;
                        border: 1px solid #333;
                        font-weight: bold;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    td {
                        padding: 5px 6px;
                        border: 1px solid #999;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    tbody tr:nth-child(even) { background: #F9FAFB; }
                    tfoot td {
                        background: #EEF2FF !important;
                        font-weight: bold;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; }
                    .text-left { text-align: left; }
                    .text-center { text-align: center; }

                    /* فاکتور هدر */
                    .factor-info-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 10px;
                    }
                    .factor-info-table td {
                        border: 1px solid #ccc;
                        padding: 6px 8px;
                        font-size: 11px;
                    }
                    .factor-info-table .label {
                        background: #EEF2FF !important;
                        font-weight: bold;
                        color: #4338CA;
                        width: 110px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .section-title {
                        font-size: 13px;
                        font-weight: bold;
                        color: #4F46E5;
                        background: #EEF2FF !important;
                        padding: 6px 10px;
                        margin: 12px 0 6px;
                        border-right: 4px solid #4F46E5;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .totals-table {
                        width: 100%;
                        margin-top: 10px;
                        border-collapse: collapse;
                    }
                    .totals-table td {
                        border: 1px solid #999;
                        padding: 6px 10px;
                        font-size: 11px;
                    }
                    .totals-table .label {
                        background: #F9FAFB !important;
                        font-weight: bold;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .totals-table .final-row td {
                        background: #EEF2FF !important;
                        font-weight: bold;
                        color: #4F46E5;
                        font-size: 13px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    button, .export-bar { display: none !important; }

                    @media print {
                        body { padding: 0; font-size: 10.5px; }
                        .header h1 { font-size: 15px; }
                        th, td { padding: 4px 5px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${this._esc(title)}</h1>
                    <div class="meta">
                        ${subtitle ? `<span>${this._esc(subtitle)}</span> | ` : ''}
                        <span>تاریخ تهیه: ${now}</span>
                    </div>
                </div>
                ${content}
            </body>
            </html>
        `);

        printWin.document.close();
        setTimeout(() => {
            printWin.focus();
            printWin.print();
        }, 500);
    },
    // ═══════════════════════════════════════════
    //  Excel
    // ═══════════════════════════════════════════
    toExcel({ table, title = 'گزارش', subtitle = '', filename = 'Report' }) {
        if (!table) return;
        const now = new Date().toLocaleString('fa-IR');

        const html = `
            <html xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <style>
                    table { border-collapse: collapse; direction: rtl; font-family: Tahoma; }
                    td, th {
                        border: 1px solid #999;
                        padding: 6px 10px;
                        font-size: 12px;
                        text-align: center;
                    }
                    th { background: #4F46E5; color: white; font-weight: bold; }
                    .title { font-size: 16px; font-weight: bold; color: #4F46E5; background: #EEF2FF; }
                    .meta  { font-size: 12px; color: #444; background: #F9FAFB; }
                    .num { text-align: left; direction: ltr; }
                    .text-left { text-align: left; }
                    .text-center { text-align: center; }
                    tfoot td { font-weight: bold; background: #EEF2FF; }
                </style>
            </head>
            <body>
                <table>
                    <tr><td colspan="30" class="title">${this._esc(title)}</td></tr>
                    ${subtitle ? `<tr><td colspan="30" class="meta">${this._esc(subtitle)}</td></tr>` : ''}
                    <tr><td colspan="30" class="meta">تاریخ تهیه: ${now}</td></tr>
                    <tr><td colspan="30"></td></tr>
                    ${table.outerHTML}
                </table>
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff' + html], {
            type: 'application/vnd.ms-excel;charset=utf-8'
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    },

    // ═══════════════════════════════════════════
    //  چاپ
    // ═══════════════════════════════════════════
    print({ table, title = 'گزارش', subtitle = '' }) {
        if (!table) return;
        const now = new Date().toLocaleString('fa-IR');

        const printWin = window.open('', '_blank', 'width=1200,height=800');
        if (!printWin) { alert('لطفاً پاپ‌آپ را فعال کنید'); return; }

        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>${this._esc(title)}</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm 8mm; }
                    * { box-sizing: border-box; }
                    body {
                        font-family: Tahoma, Arial, sans-serif;
                        direction: rtl; margin: 0; padding: 16px; color: #111;
                    }
                    .header {
                        text-align: center; margin-bottom: 16px;
                        padding-bottom: 12px; border-bottom: 2px solid #4F46E5;
                    }
                    .header h1 { font-size: 18px; margin: 0 0 6px; color: #4F46E5; }
                    .header .meta {
                        font-size: 12px; color: #666;
                        display: flex; justify-content: center; gap: 24px; flex-wrap: wrap;
                    }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th {
                        background: #4F46E5 !important; color: white !important;
                        padding: 6px 8px; border: 1px solid #333; font-weight: bold;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                    td {
                        padding: 5px 8px; border: 1px solid #999;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                    tbody tr:nth-child(even) { background: #F9FAFB; }
                    tfoot td {
                        background: #EEF2FF !important; font-weight: bold;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                    .num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; }
                    .text-left { text-align: left; }
                    .text-center { text-align: center; }
                    .badge { padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: bold; }
                    .badge-warning { background: #FEF3C7; color: #92400E; }
                    .badge-info { background: #DBEAFE; color: #1E40AF; }
                    .badge-success { background: #D1FAE5; color: #065F46; }
                    .badge-danger { background: #FEE2E2; color: #991B1B; }
                    .badge-gray { background: #F3F4F6; color: #374151; }
                    button, .export-bar { display: none !important; }
                    @media print {
                        body { padding: 0; }
                        .header h1 { font-size: 15px; }
                        table { font-size: 10px; }
                        th, td { padding: 4px 6px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${this._esc(title)}</h1>
                    <div class="meta">
                        ${subtitle ? `<span>${this._esc(subtitle)}</span>` : ''}
                        <span>تاریخ تهیه: ${now}</span>
                    </div>
                </div>
                ${table.outerHTML}
            </body>
            </html>
        `);

        printWin.document.close();
        setTimeout(() => {
            printWin.focus();
            printWin.print();
        }, 500);
    },

    // ═══════════════════════════════════════════
    //  Helper
    // ═══════════════════════════════════════════
    _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};