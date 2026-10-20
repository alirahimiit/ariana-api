/* ═══════════════════════════════════════════════════
   Feature / TarazSheshSotooni (تراز آزمایشی ۶ ستونی)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.TarazSheshSotooni = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════
    //  RENDER FORM
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');

        const levelLabels = {
            col: 'کل',
            moein: 'معین',
            tafzil: 'تفصیلی 1',
            tafzil2: 'تفصیلی 2'
        };

        const radioHtml = Object.entries(levelLabels).map(([lv, label]) => `
            <label class="radio-item">
                <input type="radio" name="t6Level" value="${lv}" ${lv === 'col' ? 'checked' : ''}>
                <span>${label}</span>
            </label>
        `).join('');

        c.innerHTML = `
        <div class="card">
            <div class="card-title">📊 تنظیمات تراز آزمایشی ۶ ستونی</div>

            <div class="form-group">
                <label>سطح گزارش</label>
                <div class="radio-group">
                    ${radioHtml}
                </div>
            </div>

            <div class="filters">
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="t6FromDate" placeholder="1403/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="t6ToDate" placeholder="1403/12/29">
                </div>
                <div class="form-group">
                    <label title="می‌توانید چند سند را با کاما یا کلمه «و» جدا کنید">شماره اسناد افتتاحیه</label>
                    <input type="text" id="t6OpeningNo" placeholder="مثلا: 360 یا 360,361">
                </div>
                <div class="form-group">
                    <label title="می‌توانید چند سند را با کاما یا کلمه «و» جدا کنید">شماره اسناد اختتامیه</label>
                    <input type="text" id="t6ClosingNo" placeholder="مثلا: 500">
                </div>
                <div class="form-group">
                    <label>نمایش حساب‌ها</label>
                    <select id="t6FilterOption">
                        <option value="all">همه حساب‌ها</option>
                        <option value="noZeroClosing">فقط مانده پایان غیرصفر</option>
                        <option value="noZeroTurnover">فقط گردش غیرصفر</option>
                        <option value="noZeroBoth" selected>مانده و گردش غیرصفر</option>
                    </select>
                </div>
            </div>

            <div class="filters" id="t6AccountFilters"></div>

            <button class="btn btn-primary" id="t6BtnRun" style="margin-top:12px;">
                📊 تهیه گزارش
            </button>
        </div>

        <div id="t6Result">
            <div class="empty">
                <div class="empty-icon">📊</div>
                <p>تنظیمات را انتخاب کنید و دکمه «تهیه گزارش» را بزنید</p>
            </div>
        </div>`;

        buildAccountFilters('col');

        document.querySelectorAll('input[name="t6Level"]').forEach(r => {
            r.addEventListener('change', (e) => buildAccountFilters(e.target.value));
        });

        document.getElementById('t6BtnRun').addEventListener('click', () => run(1));
    }

    function buildAccountFilters(level) {
        const box = document.getElementById('t6AccountFilters');
        let html = `
            <div class="form-group">
                <label>از کد کل</label>
                <input type="number" id="t6FromCodeCol">
            </div>
            <div class="form-group">
                <label>تا کد کل</label>
                <input type="number" id="t6ToCodeCol">
            </div>`;

        if (level !== 'col') {
            html += `
                <div class="form-group">
                    <label>از کد معین</label>
                    <input type="number" id="t6FromCodeMoein">
                </div>
                <div class="form-group">
                    <label>تا کد معین</label>
                    <input type="number" id="t6ToCodeMoein">
                </div>`;
        }

        if (level === 'tafzil' || level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>از کد تفصیلی 1</label>
                    <input type="number" id="t6FromCodeTafzil">
                </div>
                <div class="form-group">
                    <label>تا کد تفصیلی 1</label>
                    <input type="number" id="t6ToCodeTafzil">
                </div>`;
        }

        if (level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>کد تفصیلی 2</label>
                    <input type="number" id="t6CodeTafzili2">
                </div>`;
        }

        box.innerHTML = html;
    }

    // ═══════════════════════════════════════════
    //  RUN
    // ═══════════════════════════════════════════
    async function run(page = 1) {
        const btn = document.getElementById('t6BtnRun');
        if (btn) { btn.disabled = true; btn.textContent = 'در حال تهیه...'; }

        const payload = buildPayload(page);

        try {
            const result = await window.App.Http.api('/api/taraz-shesh-sotooni/report', {
                method: 'POST',
                body: JSON.stringify(payload),
                silent: true
            });
            renderResult(result, payload);
        } catch (err) {
            if (!err.handled) {
                window.App.toast(err.message || 'خطا در تهیه گزارش', 'error');
            }
            document.getElementById('t6Result').innerHTML =
                `<div class="error-box">${H.esc(err.message || 'خطای نامشخص')}</div>`;
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '📊 تهیه گزارش'; }
        }
    }

    function buildPayload(page, pageSizeOverride = null) {
        const parseI = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const parseSanadNos = (id) => {
            const el = document.getElementById(id);
            if (!el || !el.value) return null;
            // تبدیل اعداد فارسی و جایگزینی 'و' و '،' با کاما انگلیسی
            const val = H.toLatinDigits(el.value).replace(/و/g, ',').replace(/،/g, ',');
            const parts = val.split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n));
            return parts.length > 0 ? parts : null;
        };

        const toLatin = (s) => {
            if (!s) return null;
            return H.toLatinDigits(s.trim()) || null;
        };

        const level = document.querySelector('input[name="t6Level"]:checked')?.value || 'col';

        return {
            level: level,
            page: page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize || 500,
            fromDate: toLatin(document.getElementById('t6FromDate')?.value),
            toDate: toLatin(document.getElementById('t6ToDate')?.value),
            openingSanadNos: parseSanadNos('t6OpeningNo'), // ⭐ تغییر به آرایه
            closingSanadNos: parseSanadNos('t6ClosingNo'), // ⭐ تغییر به آرایه
            filterOption: document.getElementById('t6FilterOption')?.value || 'noZeroBoth',
            fromCodeCol: parseI('t6FromCodeCol'),
            toCodeCol: parseI('t6ToCodeCol'),
            fromCodeMoein: parseI('t6FromCodeMoein'),
            toCodeMoein: parseI('t6ToCodeMoein'),
            fromCodeTafzil: parseI('t6FromCodeTafzil'),
            toCodeTafzil: parseI('t6ToCodeTafzil'),
            codeTafzili2: parseI('t6CodeTafzili2')
        };
    }

    // ═══════════════════════════════════════════
    //  RENDER RESULT
    // ═══════════════════════════════════════════
    function renderResult(data, payload) {
        const container = document.getElementById('t6Result');
        const items = data.items || [];
        const level = data.level || 'col';

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>موردی یافت نشد</p>
                </div>`;
            return;
        }

        // ─── ردیف‌ها ───
        const startIdx = (data.page - 1) * data.pageSize;
        const rows = items.map((it, idx) => {
            const rowNum = startIdx + idx + 1;
            return `
                <tr>
                    <td class="num text-center" style="color:#94A3B8;">${H.fmt(rowNum)}</td>
                    <td class="num text-center" style="font-weight:600; color:var(--primary);">${H.esc(it.fullCode || '')}</td>
                    <td>${H.esc(it.hesabName || '-')}</td>
                    <td class="num text-left t6-col-debit">${H.fmtT(it.openingDebit)}</td>
                    <td class="num text-left t6-col-credit">${H.fmtT(it.openingCredit)}</td>
                    <td class="num text-left t6-col-debit">${H.fmtT(it.turnoverDebit)}</td>
                    <td class="num text-left t6-col-credit">${H.fmtT(it.turnoverCredit)}</td>
                    <td class="num text-left t6-col-debit" style="font-weight:600;">${H.fmtT(it.closingDebit)}</td>
                    <td class="num text-left t6-col-credit" style="font-weight:600;">${H.fmtT(it.closingCredit)}</td>
                </tr>`;
        }).join('');

        // ─── هشدار ناترازی ───
        const imbalanceHtml = !data.isBalanced
            ? `<div style="background:#FEF2F2; border-right:4px solid #EF4444; color:#991B1B; padding:10px 14px; margin-bottom:12px; border-radius:6px; font-size:13px;">
                   ⚠️ <strong>توجه:</strong> جمع ستون‌های بدهکار و بستانکار برابر نیست (سند ناتراز یا داده ناقص).
               </div>`
            : '';

        container.innerHTML = `
            <div class="card">
                <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>📊 نتیجه تراز ۶ ستونی (${H.fmt(items.length)} از ${H.fmt(data.totalCount)})</span>
                </div>
                ${imbalanceHtml}
                <div class="table-wrapper">
                    <table class="t6-table">
                        <thead>
                            <tr>
                                <th rowspan="2" class="text-center" style="width:50px;">#</th>
                                <th rowspan="2" class="text-center" style="width:110px;">کد</th>
                                <th rowspan="2">نام حساب</th>
                                <th colspan="2" class="text-center" style="border-bottom:1px solid #CBD5E1;">مانده اول دوره</th>
                                <th colspan="2" class="text-center" style="border-bottom:1px solid #CBD5E1;">گردش دوره</th>
                                <th colspan="2" class="text-center" style="border-bottom:1px solid #CBD5E1;">مانده پایان دوره</th>
                            </tr>
                            <tr>
                                <th class="text-left t6-col-debit" style="width:110px;">بدهکار</th>
                                <th class="text-left t6-col-credit" style="width:110px;">بستانکار</th>
                                <th class="text-left t6-col-debit" style="width:110px;">بدهکار</th>
                                <th class="text-left t6-col-credit" style="width:110px;">بستانکار</th>
                                <th class="text-left t6-col-debit" style="width:110px;">بدهکار</th>
                                <th class="text-left t6-col-credit" style="width:110px;">بستانکار</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                        <tfoot>
                            <tr style="background:#EEF2FF; font-weight:700;">
                                <td colspan="3" class="text-center">جمع کل</td>
                                <td class="num text-left t6-col-debit">${H.fmtT(data.totalOpeningDebit)}</td>
                                <td class="num text-left t6-col-credit">${H.fmtT(data.totalOpeningCredit)}</td>
                                <td class="num text-left t6-col-debit">${H.fmtT(data.totalTurnoverDebit)}</td>
                                <td class="num text-left t6-col-credit">${H.fmtT(data.totalTurnoverCredit)}</td>
                                <td class="num text-left t6-col-debit">${H.fmtT(data.totalClosingDebit)}</td>
                                <td class="num text-left t6-col-credit">${H.fmtT(data.totalClosingCredit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                ${buildPagination(data)}
            </div>`;

        // ─── Export ───
        if (typeof Exporter !== 'undefined' && Exporter.attach) {
            container.querySelectorAll('.export-bar').forEach(el => el.remove());
            Exporter.attach(container.querySelector('.card'), {
                title: 'تراز آزمایشی ۶ ستونی',
                subtitle: subtitle(),
                filename: 'Taraz6_' + level,
                getFullTable: async () => {
                    const fullPayload = buildPayload(1, 500000);
                    const full = await window.App.Http.api('/api/taraz-shesh-sotooni/report', {
                        method: 'POST',
                        body: JSON.stringify(fullPayload),
                        silent: true
                    });
                    return buildExportTable(full);
                }
            });
        }

        // ─── موبایل ───
        if (window.App.UI && window.App.UI.TableCardView) {
            requestAnimationFrame(() => window.App.UI.TableCardView.apply(container));
        }
    }

    // ═══════════════════════════════════════════
    //  EXPORT TABLE
    // ═══════════════════════════════════════════
    function buildExportTable(data) {
        const items = data.items || [];
        const rows = items.map((it, idx) => `
            <tr>
                <td class="num text-center">${idx + 1}</td>
                <td class="num text-center">${H.esc(it.fullCode || '')}</td>
                <td>${H.esc(it.hesabName || '')}</td>
                <td class="num text-left">${H.fmtT(it.openingDebit)}</td>
                <td class="num text-left">${H.fmtT(it.openingCredit)}</td>
                <td class="num text-left">${H.fmtT(it.turnoverDebit)}</td>
                <td class="num text-left">${H.fmtT(it.turnoverCredit)}</td>
                <td class="num text-left">${H.fmtT(it.closingDebit)}</td>
                <td class="num text-left">${H.fmtT(it.closingCredit)}</td>
            </tr>`).join('');

        const t = document.createElement('table');
        t.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>کد</th>
                    <th>نام حساب</th>
                    <th class="text-left">مانده اول بدهکار</th>
                    <th class="text-left">مانده اول بستانکار</th>
                    <th class="text-left">گردش بدهکار</th>
                    <th class="text-left">گردش بستانکار</th>
                    <th class="text-left">مانده پایان بدهکار</th>
                    <th class="text-left">مانده پایان بستانکار</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr style="background:#EEF2FF; font-weight:700;">
                    <td colspan="3" class="text-center">جمع کل</td>
                    <td class="num text-left">${H.fmtT(data.totalOpeningDebit)}</td>
                    <td class="num text-left">${H.fmtT(data.totalOpeningCredit)}</td>
                    <td class="num text-left">${H.fmtT(data.totalTurnoverDebit)}</td>
                    <td class="num text-left">${H.fmtT(data.totalTurnoverCredit)}</td>
                    <td class="num text-left">${H.fmtT(data.totalClosingDebit)}</td>
                    <td class="num text-left">${H.fmtT(data.totalClosingCredit)}</td>
                </tr>
            </tfoot>`;
        return t;
    }

    // ═══════════════════════════════════════════
    //  PAGINATION
    // ═══════════════════════════════════════════
    function buildPagination(data) {
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || 0;
        const itemCount = (data.items || []).length;

        if (totalPages <= 1) {
            return `<div class="pagination-bar"><div class="pagination-info">مجموع: ${H.fmt(totalCount)} ردیف</div></div>`;
        }

        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.TarazSheshSotooni.run(${p})">${p}</button>`;
        }

        return `
            <div class="pagination-bar">
                <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} ردیف</div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.TarazSheshSotooni.run(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.TarazSheshSotooni.run(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.TarazSheshSotooni.run(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.TarazSheshSotooni.run(${totalPages})">»</button>
                </div>
            </div>`;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    return { render, run };
})();

window.App.renderTarazSheshSotooni = window.App.Features.TarazSheshSotooni.render;
window.App.runTarazSheshSotooni = window.App.Features.TarazSheshSotooni.run;