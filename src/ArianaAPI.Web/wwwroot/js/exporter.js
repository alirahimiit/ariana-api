/* ═══════════════════════════════════════════════════
   Exporter — ماژول مشترک خروجی Excel (xlsx) و چاپ
   نسخه‌ی ۲ — با SheetJS و AOA تمیز
   ═══════════════════════════════════════════════════ */

const Exporter = {

    _styleInjected: false,

    // ═══════════════════════════════════════════
    //  تزریق CSS
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
            .export-bar button:active { transform: translateY(0); }
        `;
        document.head.appendChild(style);
    },

    // ═══════════════════════════════════════════
    //  attach — دکمه‌ها
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

        // پاک کردن نوار قبلی
        el.querySelectorAll(':scope > .export-bar').forEach(b => b.remove());

        const bar = document.createElement('div');
        bar.className = 'export-bar';
        bar.innerHTML = `
            <button type="button" data-act="excel">📥 خروجی Excel</button>
            <button type="button" data-act="print">🖨️ چاپ</button>
        `;

        el.insertBefore(bar, el.firstChild);

        // ═══════════════════════════════════════
        //  Excel
        // ═══════════════════════════════════════
        bar.querySelector('[data-act="excel"]').addEventListener('click', async () => {
            const btn = bar.querySelector('[data-act="excel"]');
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'در حال تهیه...';

            try {
                // ⭐ گرفتن جدول
                let table;
                if (typeof options.getFullTable === 'function') {
                    table = await options.getFullTable();
                } else {
                    table = this._resolveTable(el, options);
                }
                if (!table) { alert('جدولی یافت نشد'); return; }

                // ⭐ اگه SheetJS هست، xlsx تمیز بساز
                if (typeof XLSX !== 'undefined') {
                    const clean = this.tableToCleanAoa(table);
                    const ok = this.toExcelXlsx({
                        headers: clean.headers,
                        rows: clean.rows,
                        title: options.title || 'گزارش',
                        subtitle: options.subtitle || '',
                        filename: options.filename || 'Report'
                    });
                    if (ok) return;
                }

                // fallback: HTML-in-Excel
                this.toExcelHtml({
                    content: table.outerHTML,
                    title: options.title || 'گزارش',
                    subtitle: options.subtitle || '',
                    filename: options.filename || 'Report'
                });
            } catch (err) {
                alert('خطا در تهیه خروجی: ' + err.message);
                console.error(err);
            } finally {
                btn.disabled = false;
                btn.textContent = original;
            }
        });

        // ═══════════════════════════════════════
        //  چاپ
        // ═══════════════════════════════════════
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
                console.error(err);
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
    //  ⭐ تبدیل جدول HTML به {headers, rows} تمیز (برای xlsx)
    // ═══════════════════════════════════════════
    tableToCleanAoa(tableEl) {
        if (!tableEl) return { headers: [], rows: [] };

        // هدرها
        const headers = [];
        tableEl.querySelectorAll('thead th').forEach(th => {
            let t = th.textContent.trim()
                .replace(/[⇅▲▼]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            headers.push(t);
        });

        // ردیف‌ها
        const rows = [];
        tableEl.querySelectorAll('tbody tr').forEach(tr => {
            const row = [];
            Array.from(tr.children).forEach(td => {
                // clone بدون تغییر DOM
                const clone = td.cloneNode(true);
                // حذف badge
                clone.querySelectorAll('.badge').forEach(b => b.remove());

                let text = clone.textContent
                    .replace(/\s+/g, ' ')
                    .trim();

                // اگه عدد خالص بود → number
                if (text && text !== '-' && text !== '—') {
                    const norm = text
                        .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                        .replace(/[,\s٬،]/g, '');

                    const m = norm.match(/^-?\(?\d+(\.\d+)?\)?$/);
                    if (m) {
                        let n = parseFloat(norm.replace(/[()]/g, ''));
                        if (!isNaN(n)) {
                            if (norm.startsWith('(') && norm.endsWith(')')) n = -n;
                            row.push(n);
                            return;
                        }
                    }
                }
                row.push(text);
            });
            rows.push(row);
        });

        return { headers, rows };
    },

    // ═══════════════════════════════════════════
    //  ⭐ خروجی XLSX واقعی
    // ═══════════════════════════════════════════
    toExcelXlsx({ headers, rows, title, subtitle, filename }) {
        if (typeof XLSX === 'undefined') {
            console.warn('SheetJS not loaded');
            return false;
        }

        const aoa = [];
        const merges = [];
        const colCount = Math.max((headers && headers.length) || 1, 1);

        // عنوان
        if (title) {
            aoa.push([title]);
            merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: colCount - 1 } });
        }
        if (subtitle) {
            aoa.push([subtitle]);
            merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: colCount - 1 } });
        }
        if (title || subtitle) aoa.push([]);

        // هدر
        if (headers && headers.length) aoa.push(headers);

        // ردیف‌ها
        (rows || []).forEach(r => aoa.push(r));

        // ساخت worksheet
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        if (merges.length) ws['!merges'] = merges;

        // عرض ستون‌ها
        const widths = (headers || []).map((h, i) => {
            let maxLen = String(h || '').length;
            (rows || []).forEach(r => {
                const v = r[i];
                if (v == null) return;
                const s = String(v);
                if (s.length > maxLen) maxLen = s.length;
            });
            return { wch: Math.min(Math.max(maxLen + 2, 8), 32) };
        });
        ws['!cols'] = widths;

        // Workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'گزارش');

        const fname = `${filename || 'Report'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fname);
        return true;
    },

    // ═══════════════════════════════════════════
    //  Excel از HTML (fallback)
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

        const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
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
                        direction: rtl; margin: 0; padding: 12px;
                        color: #111; font-size: 12px;
                    }
                    .header {
                        text-align: center; margin-bottom: 12px;
                        padding-bottom: 8px; border-bottom: 2px solid #4F46E5;
                    }
                    .header h1 { font-size: 17px; margin: 0 0 4px; color: #4F46E5; }
                    .header .meta { font-size: 11px; color: #666; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th {
                        background: #4F46E5 !important; color: white !important;
                        padding: 6px 6px; border: 1px solid #333; font-weight: bold;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                    td {
                        padding: 5px 6px; border: 1px solid #999;
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
                    button, .export-bar { display: none !important; }
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