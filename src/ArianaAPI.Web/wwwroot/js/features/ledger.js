/* ═══════════════════════════════════════════════════
   Feature / Ledger (دفتر حساب)
   مسئولیت: گزارش دفتر با ۴ سطح (کل/معین/تفضیلی ۱/تفضیلی ۲)
             + صفحه‌بندی + export کل داده
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Ledger = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');

        // ⭐ مپینگ subKey → level
        const subToLevel = {
            'Col': 'col',
            'Moein': 'moein',
            'Tafzili': 'tafzil',
            'Tafzili2': 'tafzil2'
        };
        const levelLabels = {
            col: 'کل',
            moein: 'معین',
            tafzil: 'تفضیلی 1',
            tafzil2: 'تفضیلی 2'
        };

        // ⭐ سطوح مجاز
        const visibleSubs = window.App.Permissions
            ? window.App.Permissions.getVisibleSubKeys('Ledger')
            : ['Col', 'Moein', 'Tafzili', 'Tafzili2'];

        const visibleLevels = visibleSubs
            .map(s => subToLevel[s])
            .filter(Boolean);

        // ⭐ اگه هیچ سطحی مجاز نبود
        if (visibleLevels.length === 0) {
            c.innerHTML = `
            <div class="card">
                <div class="empty" style="padding: 60px 20px;">
                    <div class="empty-icon" style="font-size:64px; opacity:0.4;">🚫</div>
                    <h2 style="margin: 16px 0 8px; color: var(--text); font-size: 18px;">
                        دسترسی ندارید
                    </h2>
                    <p class="muted" style="font-size: 14px;">
                        شما به هیچ سطحی از دفتر حساب دسترسی ندارید
                    </p>
                </div>
            </div>`;
            return;
        }

        // ⭐ اولین سطح مجاز = default
        const defaultLevel = visibleLevels[0];
        const radioHtml = visibleLevels.map(lv => `
        <label class="radio-item">
            <input type="radio" name="ledLevel" value="${lv}" ${lv === defaultLevel ? 'checked' : ''}>
            <span>${levelLabels[lv]}</span>
        </label>
    `).join('');

        c.innerHTML = `
        <div class="card">
            <div class="card-title">⚙️ تنظیمات گزارش</div>

            <div class="form-group">
                <label>سطح گزارش</label>
                <div class="radio-group">
                    ${radioHtml}
                </div>
            </div>

            <div class="filters">
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="ledFromDate" placeholder="1403/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="ledToDate" placeholder="1403/12/29">
                </div>
                <div class="form-group">
                    <label>از شماره سند</label>
                    <input type="number" id="ledNoFrom">
                </div>
                <div class="form-group">
                    <label>تا شماره سند</label>
                    <input type="number" id="ledNoTo">
                </div>
                <div class="form-group">
                    <label>وضعیت</label>
                    <select id="ledVazeit">
                        <option value="">همه</option>
                        <option value="0">پیش‌نویس</option>
                        <option value="1">رسیدگی</option>
                        <option value="2">قطعی</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>وضعیت ردیف</label>
                    <select id="ledTikRow">
                        <option value="">همه</option>
                        <option value="1">تیک‌دار</option>
                        <option value="0">بدون تیک</option>
                    </select>
                </div>
            </div>

            <div class="filters" id="ledAccountFilters"></div>

            <button class="btn btn-primary" id="ledBtnRun" style="margin-top:12px;">
                📊 تهیه گزارش
            </button>
        </div>

        <div id="ledResult">
            <div class="empty">
                <div class="empty-icon">📒</div>
                <p>تنظیمات را انتخاب کنید و دکمه «تهیه گزارش» را بزنید</p>
            </div>
        </div>`;

        // ⭐ default level
        buildAccountFilters(defaultLevel);

        document.querySelectorAll('input[name="ledLevel"]').forEach(r => {
            r.addEventListener('change', (e) => buildAccountFilters(e.target.value));
        });

        document.getElementById('ledBtnRun').addEventListener('click', () => run(1));
    }

    function buildAccountFilters(level) {
        const box = document.getElementById('ledAccountFilters');
        let html = `
            <div class="form-group">
                <label>از کد کل</label>
                <input type="number" id="ledFromCodeCol">
            </div>
            <div class="form-group">
                <label>تا کد کل</label>
                <input type="number" id="ledToCodeCol">
            </div>`;

        if (level === 'moein' || level === 'tafzil' || level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>از کد معین</label>
                    <input type="number" id="ledFromCodeMoein">
                </div>
                <div class="form-group">
                    <label>تا کد معین</label>
                    <input type="number" id="ledToCodeMoein">
                </div>`;
        }

        if (level === 'tafzil' || level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>از کد تفصیلی 1</label>
                    <input type="number" id="ledFromCodeTafzil">
                </div>
                <div class="form-group">
                    <label>تا کد تفصیلی 1</label>
                    <input type="number" id="ledToCodeTafzil">
                </div>`;
        }

        if (level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>کد تفصیلی 2</label>
                    <input type="number" id="ledCodeTafzili2">
                </div>`;
        }

        box.innerHTML = html;
    }

    // ═══════════════════════════════════════════
    //  RUN
    // ═══════════════════════════════════════════
    async function run(page = 1) {
        // ⭐ گارد دسترسی
        if (window.App.Permissions) {
            const visibleSubs = window.App.Permissions.getVisibleSubKeys('Ledger');
            if (visibleSubs.length === 0) {
                window.App.toast('شما به دفتر حساب دسترسی ندارید', 'error');
                return;
            }
        }        
        const btn = document.getElementById('ledBtnRun');
        btn.disabled = true;
        btn.textContent = 'در حال تهیه...';

        const level = document.querySelector('input[name="ledLevel"]:checked').value;
        const payload = buildPayload(level, page);

        try {
            const result = await window.App.Http.api('/api/ledger', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            renderResult(result);
        } catch (err) {
            document.getElementById('ledResult').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '📊 تهیه گزارش';
        }
    }

    function buildPayload(level, page, pageSizeOverride = null) {
        const parseI = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        return {
            level,
            page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize,
            fromDate: document.getElementById('ledFromDate').value || null,
            toDate: document.getElementById('ledToDate').value || null,
            noFrom: parseI('ledNoFrom'),
            noTo: parseI('ledNoTo'),
            vazeit: parseI('ledVazeit'),
            tikRow: parseI('ledTikRow'),
            fromCodeCol: parseI('ledFromCodeCol'),
            toCodeCol: parseI('ledToCodeCol'),
            fromCodeMoein: parseI('ledFromCodeMoein'),
            toCodeMoein: parseI('ledToCodeMoein'),
            fromCodeTafzil: parseI('ledFromCodeTafzil'),
            toCodeTafzil: parseI('ledToCodeTafzil'),
            codeTafzili2: parseI('ledCodeTafzili2'),
            includeMandehBefore: false
        };
    }

    // ═══════════════════════════════════════════
    //  RENDER RESULT
    // ═══════════════════════════════════════════
    function renderResult(data) {
        const container = document.getElementById('ledResult');
        const items = data.items || [];
        const level = data.level;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>موردی یافت نشد</p>
                </div>`;
            return;
        }

        // ─── ستون‌های کد بر اساس سطح ───
        const { headers: codeHeaders, colSpan: codeColSpan } = buildCodeHeaders(level);

        // ─── ردیف‌ها ───
        const rows = items.map(it => {
            const codeCells = buildCodeCells(it, level);
            const manValue = it.mabMan;
            const manBadge = manValue > 0 ? 'بس' : (manValue < 0 ? 'بد' : '');
            const manAbs = Math.abs(manValue);

            return `
                <tr class="clickable-row"
                    onclick="App.Features.Sanad.showDetail(${it.parentSanadID})"
                    title="کلیک برای مشاهده سند">
                    <td class="num text-center">${H.fmt(it.noSanad)}</td>
                    <td class="num">${H.esc(it.dateIn || '')}</td>
                    ${codeCells}
                    <td>${H.esc(it.otherSharh || it.otherParentSharh || '')}</td>
                    <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left">${H.fmtSigned(it.meghdar)}</td>
                    <td class="num text-left">
                        ${H.fmt(manAbs)}
                        ${manBadge ? `<span class="badge ${manValue > 0 ? 'badge-warning' : 'badge-info'}"
                            style="margin-right:4px; font-size:10px;">${manBadge}</span>` : ''}
                    </td>
                </tr>`;
        }).join('');

        // ─── صفحه‌بندی ───
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>📊 نتیجه گزارش (${H.fmt(items.length)} ردیف از ${H.fmt(totalCount)})</span>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:60px;">سند</th>
                                <th style="width:90px;">تاریخ</th>
                                ${codeHeaders}
                                <th>شرح</th>
                                <th class="text-left" style="width:110px;">بدهکار</th>
                                <th class="text-left" style="width:110px;">بستانکار</th>
                                <th class="text-left" style="width:80px;">مقدار</th>
                                <th class="text-left" style="width:130px;">مانده</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                        <tfoot>
                            <tr style="background:#EEF2FF; font-weight:700;">
                                <td colspan="${3 + codeColSpan - 2}" class="text-center">جمع این صفحه</td>
                                <td class="num text-left">${H.fmt(data.totalBed)}</td>
                                <td class="num text-left">${H.fmt(data.totalBes)}</td>
                                <td class="num text-left">${H.fmtSigned(items.reduce((s, x) => s + (x.meghdar || 0), 0))}</td>
                                <td class="num text-left"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                ${buildPagination(page, totalPages, totalCount, items.length)}
            </div>`;

        // ⭐ دکمه‌های Excel و چاپ با getFullTable
        const levelTitles = {
            col: 'دفتر کل',
            moein: 'دفتر معین',
            tafzil: 'دفتر تفصیلی 1',
            tafzil2: 'دفتر تفصیلی 2'
        };

        Exporter.attach(document.querySelector('#ledResult .card'), {
            title: levelTitles[level] || 'دفتر حساب',
            subtitle: subtitle(),
            filename: 'Ledger_' + level,
            getFullTable: fetchFullTable
        });

        window.App.enhanceTables(container);
    }

    function buildCodeHeaders(level) {
        let headers = `<th>کد کل</th><th>نام کل</th>`;
        let colSpan = 2;

        if (level === 'moein' || level === 'tafzil' || level === 'tafzil2') {
            headers += `<th>کد معین</th><th>نام معین</th>`;
            colSpan += 2;
        }
        if (level === 'tafzil' || level === 'tafzil2') {
            headers += `<th>کد تفصیلی</th><th>نام تفصیلی</th>`;
            colSpan += 2;
        }
        if (level === 'tafzil2') {
            headers += `<th>کد تفصیلی 2</th><th>نام تفصیلی 2</th>`;
            colSpan += 2;
        }
        return { headers, colSpan };
    }

    function buildCodeCells(it, level) {
        let cells = `
            <td class="num">${it.codeCol ?? ''}</td>
            <td>${H.esc(it.colName || '')}</td>`;

        if (level === 'moein' || level === 'tafzil' || level === 'tafzil2') {
            cells += `<td class="num">${it.codeMoein ?? ''}</td><td>${H.esc(it.moeinName || '')}</td>`;
        }
        if (level === 'tafzil' || level === 'tafzil2') {
            cells += `<td class="num">${it.codeTafzil ?? ''}</td><td>${H.esc(it.tafzilName || '')}</td>`;
        }
        if (level === 'tafzil2') {
            cells += `<td class="num">${it.codeTafzili2 ?? ''}</td><td>${H.esc(it.tafzili2Name || '')}</td>`;
        }
        return cells;
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        if (totalPages <= 1) {
            return `
                <div class="pagination-bar">
                    <div class="pagination-info">مجموع: ${H.fmt(totalCount)} ردیف</div>
                </div>`;
        }

        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.Ledger.run(${p})">${p}</button>`;
        }

        return `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} ردیف
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Ledger.run(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Ledger.run(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Ledger.run(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Ledger.run(${totalPages})">»</button>
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  EXPORT — fetch کل داده
    // ═══════════════════════════════════════════
    async function fetchFullTable() {
        const level = document.querySelector('input[name="ledLevel"]:checked').value;
        const payload = buildPayload(level, 1, 100000);
        const result = await window.App.Http.api('/api/ledger', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return buildTableHtml(result);
    }

    function buildTableHtml(data) {
        const items = data.items || [];
        const level = data.level;
        const { headers: codeHeaders, colSpan: codeColSpan } = buildCodeHeaders(level);

        const rows = items.map(it => {
            const codeCells = buildCodeCells(it, level);
            const manValue = it.mabMan;
            const manBadge = manValue > 0 ? 'بس' : (manValue < 0 ? 'بد' : '');
            const manAbs = Math.abs(manValue);

            return `
                <tr>
                    <td class="num text-center">${H.fmt(it.noSanad)}</td>
                    <td class="num">${H.esc(it.dateIn || '')}</td>
                    ${codeCells}
                    <td>${H.esc(it.otherSharh || it.otherParentSharh || '')}</td>
                    <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left">${H.fmtSigned(it.meghdar)}</td>
                    <td class="num text-left">
                        ${H.fmt(manAbs)}
                        ${manBadge ? `<span class="badge ${manValue > 0 ? 'badge-warning' : 'badge-info'}"
                            style="margin-right:4px; font-size:10px;">${manBadge}</span>` : ''}
                    </td>
                </tr>`;
        }).join('');

        const totalBes = data.totalMan > 0;
        const totalManAbs = Math.abs(data.totalMan);

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th style="width:60px;">سند</th>
                    <th style="width:90px;">تاریخ</th>
                    ${codeHeaders}
                    <th>شرح</th>
                    <th class="text-left" style="width:110px;">بدهکار</th>
                    <th class="text-left" style="width:110px;">بستانکار</th>
                    <th class="text-left" style="width:80px;">مقدار</th>
                    <th class="text-left" style="width:130px;">مانده</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr style="background:#EEF2FF; font-weight:700;">
                    <td colspan="${3 + codeColSpan - 2}" class="text-center">
                        جمع کل (${H.fmt(items.length)} ردیف)
                    </td>
                    <td class="num text-left">${H.fmt(data.totalBed)}</td>
                    <td class="num text-left">${H.fmt(data.totalBes)}</td>
                    <td class="num text-left">${H.fmtSigned(items.reduce((s, x) => s + (x.meghdar || 0), 0))}</td>
                    <td class="num text-left">
                        ${H.fmt(totalManAbs)}
                        ${data.totalMan !== 0 ? `<span class="badge ${totalBes ? 'badge-warning' : 'badge-info'}">${totalBes ? 'بس' : 'بد'}</span>` : ''}
                    </td>
                </tr>
            </tfoot>`;
        return table;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return { render, run };
})();

// ⭐ alias
window.App.renderLedger = window.App.Features.Ledger.render;
window.App.runLedger = window.App.Features.Ledger.run;