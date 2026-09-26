/* ═══════════════════════════════════════════════════
   Feature / Taraz (تراز حساب‌ها)
   مسئولیت: تراز با ۴ سطح + drill-down + breadcrumb
             + modal دفتر اسناد حساب
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Taraz = (function () {
    'use strict';

    const H = window.App.Helpers;

    // state drill (محلی)
    let _drill = null;
    let _currentItems = [];

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        _drill = null;
        _currentItems = [];

        // ⭐ چک زیرمجموعه‌های مجاز
        const subToLevel = {
            'Col': 'col',
            'Moein': 'moein',
            'Tafzili': 'tafzil',
            'Tafzili2': 'tafzil2'
        };
        const levelLabels = {
            col: 'کل',
            moein: 'معین',
            tafzil: 'تفصیلی 1',
            tafzil2: 'تفصیلی 2'
        };

        const visibleSubs = window.App.Permissions
            ? window.App.Permissions.getVisibleSubKeys('Taraz')
            : ['Col', 'Moein', 'Tafzili', 'Tafzili2'];

        const visibleLevels = visibleSubs
            .map(s => subToLevel[s])
            .filter(Boolean);

        // اگه هیچ سطحی مجاز نبود
        if (visibleLevels.length === 0) {
            c.innerHTML = `
            <div class="card">
                <div class="empty" style="padding: 60px 20px;">
                    <div class="empty-icon" style="font-size:64px; opacity:0.4;">🚫</div>
                    <h2 style="margin: 16px 0 8px; color: var(--text); font-size: 18px;">
                        دسترسی ندارید
                    </h2>
                    <p class="muted" style="font-size: 14px;">
                        شما به هیچ سطحی از تراز حساب‌ها دسترسی ندارید
                    </p>
                </div>
            </div>`;
            return;
        }

        const defaultLevel = visibleLevels[0];
        const radioHtml = visibleLevels.map(lv => `
        <label class="radio-item">
            <input type="radio" name="tarazLevel" value="${lv}" ${lv === defaultLevel ? 'checked' : ''}>
            <span>${levelLabels[lv]}</span>
        </label>
    `).join('');

        c.innerHTML = `
    <div class="card">
        <div class="card-title">⚖️ تنظیمات تراز</div>

        <div class="form-group">
            <label>سطح گزارش</label>
            <div class="radio-group">
                ${radioHtml}
            </div>
        </div>

        <div class="form-group">
            <label>نمایش سطوح</label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="tarazSetDetail">
                <span>نمایش همه سطوح کدینگ</span>
            </label>
        </div>

        <div class="filters">
            <div class="form-group">
                <label>از تاریخ</label>
                <input type="text" id="tarazFromDate" placeholder="1403/01/01">
            </div>
            <div class="form-group">
                <label>تا تاریخ</label>
                <input type="text" id="tarazToDate" placeholder="1403/12/29">
            </div>
            <div class="form-group">
                <label>از شماره سند</label>
                <input type="number" id="tarazNoFrom">
            </div>
            <div class="form-group">
                <label>تا شماره سند</label>
                <input type="number" id="tarazNoTo">
            </div>
            <div class="form-group">
                <label>وضعیت سند</label>
                <select id="tarazVazeit">
                    <option value="">همه</option>
                    <option value="0">پیش‌نویس</option>
                    <option value="1">رسیدگی</option>
                    <option value="2">قطعی</option>
                </select>
            </div>
            <div class="form-group">
                <label>نوع خروجی</label>
                <select id="tarazFilterOption">
                    <option value="all">کلیه حساب‌ها</option>
                    <option value="noZeroMandeh">حساب‌های با مانده صفر آورده نشود</option>
                    <option value="noZeroGardesh" selected>حساب‌های با گردش صفر آورده نشود</option>
                </select>
            </div>
        </div>

        <div class="filters" id="tarazAccountFilters"></div>

        <button class="btn btn-primary" id="tarazBtnRun" style="margin-top:12px;">
            ⚖️ تهیه تراز
        </button>
    </div>

    <div id="tarazResult">
        <div class="empty">
            <div class="empty-icon">⚖️</div>
            <p>تنظیمات را انتخاب کنید و دکمه «تهیه تراز» را بزنید</p>
        </div>
    </div>`;

        buildAccountFilters(defaultLevel);

        document.querySelectorAll('input[name="tarazLevel"]').forEach(r => {
            r.addEventListener('change', (e) => buildAccountFilters(e.target.value));
        });

        document.getElementById('tarazBtnRun').addEventListener('click', () => {
            _drill = null;
            run(1);
        });
    }

    function buildAccountFilters(level) {
        const box = document.getElementById('tarazAccountFilters');
        let html = `
            <div class="form-group">
                <label>از کد کل</label>
                <input type="number" id="tarazFromCodeCol">
            </div>
            <div class="form-group">
                <label>تا کد کل</label>
                <input type="number" id="tarazToCodeCol">
            </div>`;

        if (level !== 'col') {
            html += `
                <div class="form-group">
                    <label>از کد معین</label>
                    <input type="number" id="tarazFromCodeMoein">
                </div>
                <div class="form-group">
                    <label>تا کد معین</label>
                    <input type="number" id="tarazToCodeMoein">
                </div>`;
        }

        if (level === 'tafzil' || level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>از کد تفصیلی 1</label>
                    <input type="number" id="tarazFromCodeTafzil">
                </div>
                <div class="form-group">
                    <label>تا کد تفصیلی 1</label>
                    <input type="number" id="tarazToCodeTafzil">
                </div>`;
        }

        if (level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>کد تفصیلی 2</label>
                    <input type="number" id="tarazCodeTafzili2">
                </div>`;
        }

        box.innerHTML = html;
    }

    // ═══════════════════════════════════════════
    //  RUN — تهیه تراز
    // ═══════════════════════════════════════════
    async function run(page = 1, drillState = null) {
        // ⭐ گارد دسترسی
        if (window.App.Permissions) {
            const visibleSubs = window.App.Permissions.getVisibleSubKeys('Taraz');
            if (visibleSubs.length === 0) {
                window.App.toast('شما به تراز دسترسی ندارید', 'error');
                return;
            }
        }
        if (drillState) _drill = drillState;

        if (!_drill) {
            const selectedLevel = document.querySelector('input[name="tarazLevel"]:checked')?.value || 'col';
            _drill = {
                level: selectedLevel,
                codeCol: null, codeMoein: null, codeTafzil: null, codeTafzili2: null,
                colName: '', moeinName: '', tafzilName: '', tafzili2Name: '',
                breadcrumb: []
            };
        }

        const btn = document.getElementById('tarazBtnRun');
        if (btn) { btn.disabled = true; btn.textContent = 'در حال تهیه...'; }

        const payload = buildPayload(page);

        try {
            const result = await window.App.Http.api('/api/taraz', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            renderResult(result);
        } catch (err) {
            document.getElementById('tarazResult').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '⚖️ تهیه تراز'; }
        }
    }

    function buildPayload(page, pageSizeOverride = null) {
        const parseI = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const d = _drill;

        return {
            level: d.level,
            page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize,
            setDetail: document.getElementById('tarazSetDetail')?.checked || false,
            filterOption: document.getElementById('tarazFilterOption')?.value || 'noZeroGardesh',
            fromDate: document.getElementById('tarazFromDate')?.value || null,
            toDate: document.getElementById('tarazToDate')?.value || null,
            noFrom: parseI('tarazNoFrom'),
            noTo: parseI('tarazNoTo'),
            vazeit: parseI('tarazVazeit'),
            fromCodeCol: d.codeCol ?? parseI('tarazFromCodeCol'),
            toCodeCol: d.codeCol ?? parseI('tarazToCodeCol'),
            fromCodeMoein: d.codeMoein ?? parseI('tarazFromCodeMoein'),
            toCodeMoein: d.codeMoein ?? parseI('tarazToCodeMoein'),
            fromCodeTafzil: d.codeTafzil ?? parseI('tarazFromCodeTafzil'),
            toCodeTafzil: d.codeTafzil ?? parseI('tarazToCodeTafzil'),
            codeTafzili2: d.codeTafzili2 ?? parseI('tarazCodeTafzili2')
        };
    }

    // ═══════════════════════════════════════════
    //  RENDER RESULT
    // ═══════════════════════════════════════════
    function renderResult(data) {
        const container = document.getElementById('tarazResult');
        const items = data.items || [];
        const level = data.level;
        const d = _drill || { breadcrumb: [] };

        // ─── اگه خالی بود و در حال drill هستیم → fallback به دفتر ───
        if (items.length === 0 && d.breadcrumb && d.breadcrumb.length > 0) {
            const last = d.breadcrumb[d.breadcrumb.length - 1];
            if (last.level === 'moein' || last.level === 'tafzil') {
                showAccountSanadsForState();
                return;
            }
        }

        // ─── Breadcrumb ───
        const bcHtml = d.breadcrumb && d.breadcrumb.length > 0
            ? `
                <div class="taraz-breadcrumb">
                    <button class="btn btn-ghost btn-sm" onclick="App.Features.Taraz.goBack()">
                        ↩️ بازگشت
                    </button>
                    <span class="bc-item">ریشه</span>
                    ${d.breadcrumb.map(item => `
                        <span class="bc-sep">›</span>
                        <span class="bc-item">${H.esc(item.name)} (${item.code})</span>
                    `).join('')}
                </div>`
            : '';

        if (items.length === 0) {
            container.innerHTML = `
                ${bcHtml}
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>موردی یافت نشد</p>
                </div>`;
            return;
        }

        _currentItems = items;

        // ─── ستون‌های کد ───
        const codeHeaders = `
            <th style="width:80px;">تفصیلی 2</th>
            <th style="width:80px;">تفصیلی</th>
            <th style="width:70px;">معین</th>
            <th style="width:70px;">کل</th>`;

        // ─── ردیف‌ها ───
        const rows = items.map((it, idx) => {
            const tafzili2Cell = (level === 'tafzil2' && it.codeTafzili2) ? it.codeTafzili2 : '-';
            const tafzilCell = (level === 'tafzil' || level === 'tafzil2') && it.codeTafzil ? it.codeTafzil : '-';
            const moeinCell = (level !== 'col') && it.codeMoein ? it.codeMoein : '-';
            const colCell = it.codeCol || '-';

            let drillIcon = '📒';
            let drillTitle = 'نمایش دفتر';

            if (level === 'col') {
                drillIcon = '▶';
                drillTitle = 'ورود به معین‌ها';
            } else if (level === 'moein') {
                drillIcon = it.hasTafzili ? '▶' : '📒';
                drillTitle = it.hasTafzili ? 'ورود به تفصیلی‌ها' : 'نمایش دفتر';
            } else if (level === 'tafzil') {
                drillIcon = it.hasTafzili2 ? '▶' : '📒';
                drillTitle = it.hasTafzili2 ? 'ورود به تفصیلی 2' : 'نمایش دفتر';
            }

            return `
                <tr class="taraz-row-drill" data-idx="${idx}" style="cursor: pointer;">
                    <td class="num text-center" style="color:${level === 'tafzil2' && it.codeTafzili2 ? 'inherit' : '#D1D5DB'};">${tafzili2Cell}</td>
                    <td class="num text-center" style="color:${(level === 'tafzil' || level === 'tafzil2') && it.codeTafzil ? 'inherit' : '#D1D5DB'};">${tafzilCell}</td>
                    <td class="num text-center" style="color:${level !== 'col' && it.codeMoein ? 'inherit' : '#D1D5DB'};">${moeinCell}</td>
                    <td class="num text-center" style="font-weight:600; color:var(--primary);">${colCell}</td>
                    <td>${H.esc(it.hesabName || '-')}</td>
                    <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left">${it.mabManBed > 0 ? H.fmt(it.mabManBed) : '-'}</td>
                    <td class="num text-left">${it.mabManBes > 0 ? H.fmt(it.mabManBes) : '-'}</td>
                    <td class="num text-left">${H.fmtSigned(it.meghdar)}</td>
                    <td class="text-center">
                        <span class="drill-icon" title="${drillTitle}">${drillIcon}</span>
                    </td>
                </tr>`;
        }).join('');

        // ─── صفحه‌بندی ───
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        container.innerHTML = `
            ${bcHtml}
            <div class="card">
                <div class="card-title">
                    <span>⚖️ تراز - سطح ${levelName(level)} (${H.fmt(items.length)} از ${H.fmt(totalCount)})</span>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                ${codeHeaders}
                                <th>نام حساب</th>
                                <th class="text-left" style="width:100px;">گردش بدهکار</th>
                                <th class="text-left" style="width:100px;">گردش بستانکار</th>
                                <th class="text-left" style="width:100px;">مانده بدهکار</th>
                                <th class="text-left" style="width:100px;">مانده بستانکار</th>
                                <th class="text-left" style="width:80px;">مقدار</th>
                                <th style="width:40px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                        <tfoot>
                            <tr style="background:#EEF2FF; font-weight:700;">
                                <td colspan="5" class="text-center">جمع کل</td>
                                <td class="num text-left">${H.fmt(data.totalBed)}</td>
                                <td class="num text-left">${H.fmt(data.totalBes)}</td>
                                <td class="num text-left">${H.fmt(data.totalManBed)}</td>
                                <td class="num text-left">${H.fmt(data.totalManBes)}</td>
                                <td class="num text-left">${H.fmtSigned(data.totalMeghdar)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                ${buildPagination(page, totalPages, totalCount, items.length)}
            </div>`;

        // ─── بایند رویداد کلیک ───
        setTimeout(() => {
            container.querySelectorAll('.taraz-row-drill').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    const idx = parseInt(tr.dataset.idx);
                    const row = _currentItems[idx];
                    if (row) drill(row);
                });
            });
        }, 30);

        // ─── دکمه‌های خروجی ───
        const levelTitles = {
            col: 'تراز - کل',
            moein: 'تراز - معین',
            tafzil: 'تراز - تفصیلی 1',
            tafzil2: 'تراز - تفصیلی 2'
        };

        Exporter.attach(container, {
            title: levelTitles[level] || 'تراز',
            subtitle: subtitle(),
            filename: 'Taraz_' + level,
            getFullTable: async () => {
                const payload = buildPayload(1, 100000);
                const full = await window.App.Http.api('/api/taraz', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const temp = document.createElement('div');
                temp.innerHTML = buildExportTableHtml(full, level);
                return temp.querySelector('table');
            }
        });

        window.App.enhanceTables(container);
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
                            onclick="App.Features.Taraz.run(${p})">${p}</button>`;
        }

        return `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} ردیف
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Taraz.run(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Taraz.run(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Taraz.run(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Taraz.run(${totalPages})">»</button>
                </div>
            </div>`;
    }

    function buildExportTableHtml(data, level) {
        let codeHeaders = `<th>کد کل</th>`;
        if (level !== 'col') codeHeaders += `<th>کد معین</th>`;
        if (level === 'tafzil' || level === 'tafzil2') codeHeaders += `<th>کد تفصیلی</th>`;
        if (level === 'tafzil2') codeHeaders += `<th>کد تفصیلی 2</th>`;

        const items = data.items || [];
        const rows = items.map(it => {
            let codeCells = `<td class="num text-center">${it.codeCol ?? ''}</td>`;
            if (level !== 'col') codeCells += `<td class="num text-center">${it.codeMoein || ''}</td>`;
            if (level === 'tafzil' || level === 'tafzil2') codeCells += `<td class="num text-center">${it.codeTafzil || ''}</td>`;
            if (level === 'tafzil2') codeCells += `<td class="num text-center">${it.codeTafzili2 || ''}</td>`;

            return `
                <tr>
                    ${codeCells}
                    <td>${H.esc(it.hesabName || '-')}</td>
                    <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left">${it.mabManBed > 0 ? H.fmt(it.mabManBed) : '-'}</td>
                    <td class="num text-left">${it.mabManBes > 0 ? H.fmt(it.mabManBes) : '-'}</td>
                    <td class="num text-left">${H.fmtSigned(it.meghdar)}</td>
                </tr>`;
        }).join('');

        const codeColCount = 1 + (level !== 'col' ? 1 : 0)
            + (level === 'tafzil' || level === 'tafzil2' ? 1 : 0)
            + (level === 'tafzil2' ? 1 : 0);

        return `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            ${codeHeaders}
                            <th>نام حساب</th>
                            <th class="text-left" style="width:110px;">گردش بدهکار</th>
                            <th class="text-left" style="width:110px;">گردش بستانکار</th>
                            <th class="text-left" style="width:110px;">مانده بدهکار</th>
                            <th class="text-left" style="width:110px;">مانده بستانکار</th>
                            <th class="text-left" style="width:90px;">مقدار</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:700;">
                            <td colspan="${codeColCount + 1}" class="text-center">جمع کل</td>
                            <td class="num text-left">${H.fmt(data.totalBed)}</td>
                            <td class="num text-left">${H.fmt(data.totalBes)}</td>
                            <td class="num text-left">${H.fmt(data.totalManBed)}</td>
                            <td class="num text-left">${H.fmt(data.totalManBes)}</td>
                            <td class="num text-left">${H.fmtSigned(data.totalMeghdar)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  DRILL-DOWN
    // ═══════════════════════════════════════════
    async function drill(row) {
        const d = _drill;
        let nextLevel;
        let codeCol = d.codeCol, codeMoein = d.codeMoein,
            codeTafzil = d.codeTafzil, codeTafzili2 = d.codeTafzili2;
        let colName = d.colName, moeinName = d.moeinName,
            tafzilName = d.tafzilName, tafzili2Name = d.tafzili2Name;
        const breadcrumb = [...(d.breadcrumb || [])];

        switch (d.level) {
            case 'col':
                nextLevel = 'moein';
                codeCol = row.codeCol;
                colName = row.hesabName || `کل ${row.codeCol}`;
                breadcrumb.push({ level: 'col', code: row.codeCol, name: colName });
                break;
            case 'moein':
                nextLevel = 'tafzil';
                codeMoein = row.codeMoein;
                moeinName = row.hesabName || `معین ${row.codeMoein}`;
                breadcrumb.push({ level: 'moein', code: row.codeMoein, name: moeinName });
                break;
            case 'tafzil':
                nextLevel = 'tafzil2';
                codeTafzil = row.codeTafzil;
                tafzilName = row.hesabName || `تفصیلی ${row.codeTafzil}`;
                breadcrumb.push({ level: 'tafzil', code: row.codeTafzil, name: tafzilName });
                break;
            case 'tafzil2':
                await showAccountSanads(row);
                return;
        }

        _drill = {
            level: nextLevel,
            codeCol, codeMoein, codeTafzil, codeTafzili2,
            colName, moeinName, tafzilName, tafzili2Name,
            breadcrumb
        };

        await run(1);
    }

    async function goBack() {
        const d = _drill;
        if (!d) return;

        const bc = [...(d.breadcrumb || [])];
        if (bc.length === 0) return;

        bc.pop();

        let level = 'moein';
        let codeCol = null, codeMoein = null, codeTafzil = null;
        let colName = '', moeinName = '', tafzilName = '';

        bc.forEach(item => {
            if (item.level === 'col') { codeCol = item.code; colName = item.name; }
            if (item.level === 'moein') { codeMoein = item.code; moeinName = item.name; }
            if (item.level === 'tafzil') { codeTafzil = item.code; tafzilName = item.name; }
        });

        if (bc.length === 0) level = 'moein';
        else if (bc[bc.length - 1].level === 'col') level = 'moein';
        else if (bc[bc.length - 1].level === 'moein') level = 'tafzil';
        else if (bc[bc.length - 1].level === 'tafzil') level = 'tafzil2';

        _drill = {
            level,
            codeCol, codeMoein, codeTafzil, codeTafzili2: null,
            colName, moeinName, tafzilName, tafzili2Name: '',
            breadcrumb: bc
        };

        await run(1);
    }

    // ═══════════════════════════════════════════
    //  MODAL — دفتر اسناد حساب
    // ═══════════════════════════════════════════
    async function showAccountSanads(row) {
        const d = _drill;

        const codeCol = row.codeCol ?? d.codeCol;
        const codeMoein = row.codeMoein ?? d.codeMoein;
        const codeTafzil = row.codeTafzil ?? d.codeTafzil;
        const codeTafzili2 = row.codeTafzili2 ?? d.codeTafzili2;

        const codeParts = [];
        if (codeCol) codeParts.push(`کل ${codeCol}`);
        if (codeMoein) codeParts.push(`معین ${codeMoein}`);
        if (codeTafzil) codeParts.push(`تفصیلی ${codeTafzil}`);
        if (codeTafzili2) codeParts.push(`تفصیلی ۲ ${codeTafzili2}`);

        window.App.openModal(`📒 اسناد حساب - ${codeParts.join(' / ')}`,
            `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const payload = {
                codeCol, codeMoein, codeTafzil, codeTafzili2,
                fromDate: document.getElementById('tarazFromDate')?.value || null,
                toDate: document.getElementById('tarazToDate')?.value || null
            };

            const items = await window.App.Http.api('/api/taraz/account-sanads', {
                method: 'POST',
                body: JSON.stringify(payload)
            }) || [];

            if (items.length === 0) {
                document.getElementById('modalBody').innerHTML =
                    `<div class="empty"><div class="empty-icon">📭</div><p>سندی برای این حساب یافت نشد</p></div>`;
                return;
            }

            const first = items[0];
            const totalBed = items.reduce((s, x) => s + (x.mabBed || 0), 0);
            const totalBes = items.reduce((s, x) => s + (x.mabBes || 0), 0);
            const totalMan = totalBed - totalBes;

            items.sort((a, b) => {
                if (a.dateIn !== b.dateIn) return (a.dateIn || '').localeCompare(b.dateIn || '');
                return (a.noSanad || 0) - (b.noSanad || 0);
            });

            document.getElementById('modalBody').innerHTML =
                buildAccountDetailHtml(items, first, totalBed, totalBes, totalMan);

            Exporter.attach(document.getElementById('modalBody'), {
                title: `دفتر حساب - ${codeParts.join(' / ')}`,
                subtitle: subtitle(),
                filename: `Ledger_${codeCol}_${codeMoein || 0}_${codeTafzil || 0}`,
                customHtml: () => buildAccountPrintHtml(items, first, totalBed, totalBes, totalMan)
            });

            window.App.enhanceTables(document.getElementById('modalBody'));
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildAccountDetailHtml(items, first, totalBed, totalBes, totalMan) {
        let running = 0;
        const rows = items.map(it => {
            running += ((it.mabBed || 0) - (it.mabBes || 0));
            const mandehAbs = Math.abs(running);
            const mandehDir = running >= 0 ? 'بد' : 'بس';
            const mandehColor = running >= 0 ? '#059669' : '#DC2626';

            return `
                <tr class="clickable-row"
                    onclick="App.Features.Sanad.showDetail(${it.parentSanadId})"
                    title="کلیک برای مشاهده سند">
                    <td class="num text-center">${H.fmt(it.noSanad)}</td>
                    <td class="num">${H.esc(it.dateIn || '')}</td>
                    <td>${H.esc(it.otherParentSharh || '')}</td>
                    <td>${H.esc(it.otherSharh || '')}</td>
                    <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left" style="color:${mandehColor}; font-weight:600;">
                        ${H.fmt(mandehAbs)} ${mandehDir}
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-ghost"
                                onclick="App.Features.Sanad.showDetail(${it.parentSanadId})">
                            🔍
                        </button>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="stats-grid" style="margin-bottom:16px;">
                <div class="stat-card">
                    <div>
                        <div class="stat-label">حساب</div>
                        <div class="stat-value" style="font-size:14px;">
                            ${H.esc(first.colName || '')}
                            ${first.moeinName ? ' - ' + H.esc(first.moeinName) : ''}
                            ${first.tafzilName ? ' - ' + H.esc(first.tafzilName) : ''}
                            ${first.tafzili2Name ? ' - ' + H.esc(first.tafzili2Name) : ''}
                        </div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">جمع بدهکار</div>
                        <div class="stat-value" style="font-size:15px;">${H.fmt(totalBed)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">جمع بستانکار</div>
                        <div class="stat-value" style="font-size:15px;">${H.fmt(totalBes)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">مانده نهایی</div>
                        <div class="stat-value" style="font-size:15px; color:${totalMan >= 0 ? '#059669' : '#DC2626'};">
                            ${H.fmt(Math.abs(totalMan))} ${totalMan >= 0 ? 'بد' : 'بس'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:70px;">سند</th>
                            <th style="width:90px;">تاریخ</th>
                            <th>شرح سند</th>
                            <th>شرح ردیف</th>
                            <th class="text-left" style="width:120px;">بدهکار</th>
                            <th class="text-left" style="width:120px;">بستانکار</th>
                            <th class="text-left" style="width:130px;">مانده</th>
                            <th style="width:50px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:700;">
                            <td colspan="4" class="text-center">جمع کل</td>
                            <td class="num text-left">${H.fmt(totalBed)}</td>
                            <td class="num text-left">${H.fmt(totalBes)}</td>
                            <td class="num text-left" style="color:${totalMan >= 0 ? '#059669' : '#DC2626'};">
                                ${H.fmt(Math.abs(totalMan))} ${totalMan >= 0 ? 'بد' : 'بس'}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
    }

    function buildAccountPrintHtml(items, first, totalBed, totalBes, totalMan) {
        const sorted = [...items].sort((a, b) => {
            if (a.dateIn !== b.dateIn) return (a.dateIn || '').localeCompare(b.dateIn || '');
            return (a.noSanad || 0) - (b.noSanad || 0);
        });

        let running = 0;
        const rows = sorted.map(it => {
            running += ((it.mabBed || 0) - (it.mabBes || 0));
            const mandehAbs = Math.abs(running);
            const mandehDir = running >= 0 ? 'بد' : 'بس';

            return `
                <tr>
                    <td class="num text-center">${H.fmt(it.noSanad)}</td>
                    <td class="num">${H.esc(it.dateIn || '')}</td>
                    <td>${H.esc(it.otherParentSharh || '')}</td>
                    <td>${H.esc(it.otherSharh || '')}</td>
                    <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left">${H.fmt(mandehAbs)} ${mandehDir}</td>
                </tr>`;
        }).join('');

        return `
            <table class="factor-info-table">
                <tr>
                    <td class="label">حساب:</td>
                    <td colspan="5">
                        ${H.esc(first.colName || '')}
                        ${first.moeinName ? ' - ' + H.esc(first.moeinName) : ''}
                        ${first.tafzilName ? ' - ' + H.esc(first.tafzilName) : ''}
                    </td>
                </tr>
            </table>

            <div class="section-title">📒 دفتر حساب (${H.fmt(sorted.length)} ردیف)</div>
            <table>
                <thead>
                    <tr>
                        <th>سند</th>
                        <th>تاریخ</th>
                        <th>شرح سند</th>
                        <th>شرح ردیف</th>
                        <th class="text-left">بدهکار</th>
                        <th class="text-left">بستانکار</th>
                        <th class="text-left">مانده</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="4" class="text-center">جمع کل</td>
                        <td class="num text-left">${H.fmt(totalBed)}</td>
                        <td class="num text-left">${H.fmt(totalBes)}</td>
                        <td class="num text-left">${H.fmt(Math.abs(totalMan))} ${totalMan >= 0 ? 'بد' : 'بس'}</td>
                    </tr>
                </tfoot>
            </table>`;
    }

    async function showAccountSanadsForState() {
        if (!_drill) return;
        const row = {
            codeCol: _drill.codeCol,
            codeMoein: _drill.codeMoein,
            codeTafzil: _drill.codeTafzil,
            codeTafzili2: _drill.codeTafzili2
        };
        await showAccountSanads(row);
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════
    function levelName(level) {
        return { col: 'کل', moein: 'معین', tafzil: 'تفصیلی 1', tafzil2: 'تفصیلی 2' }[level] || level;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return {
        render,
        run,
        drill,
        goBack,
        showAccountSanads
    };
})();

// ⭐ alias
window.App.renderTaraz = window.App.Features.Taraz.render;
window.App.runTaraz = window.App.Features.Taraz.run;
window.App.drillTaraz = window.App.Features.Taraz.drill;
window.App.tarazGoBack = window.App.Features.Taraz.goBack;
window.App.showTarazAccountSanads = window.App.Features.Taraz.showAccountSanads;