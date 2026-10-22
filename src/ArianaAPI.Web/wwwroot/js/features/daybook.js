/* ═══════════════════════════════════════════════════
   Feature / DayBook (دفتر روزنامه)
   مسئولیت: گزارش دفتر روزنامه با ۴ حالت مختلف
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.DayBook = (function () {
    'use strict';

    const H = window.App.Helpers;

    let _level = 'col';
    let _mode = 'aggregated';

    // ═══════════════════════════════════════════
    //  RENDER — صفحه تنظیمات
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');

        // ⭐ مپینگ subKey → تنظیمات
        const subToConfig = {
            'Col': { level: 'col', mode: 'aggregated', label: 'سطح کل (تجمیعی)' },
            'ColPerSanad': { level: 'col', mode: 'perSanad', label: 'سطح کل (بصورت سند)' },
            'MoeinTafzil': { level: 'tafzil', mode: 'aggregated', label: 'سطح معین/تفضیل (تجمیعی)' },
            'MoeinTafzil2': { level: 'tafzil2', mode: 'aggregated', label: 'سطح تفضیلی ۲ (تجمیعی)' }
        };

        const visibleSubs = window.App.Permissions
            ? window.App.Permissions.getVisibleSubKeys('DayBook')
            : ['Col', 'ColPerSanad', 'MoeinTafzil', 'MoeinTafzil2'];

        const visibleConfigs = visibleSubs
            .map(s => ({ sub: s, ...subToConfig[s] }))
            .filter(x => x.level);

        if (visibleConfigs.length === 0) {
            c.innerHTML = `
            <div class="card">
                <div class="empty" style="padding: 60px 20px;">
                    <div class="empty-icon" style="font-size:64px; opacity:0.4;">🚫</div>
                    <h2 style="margin: 16px 0 8px; color: var(--text); font-size: 18px;">
                        دسترسی ندارید
                    </h2>
                    <p class="muted" style="font-size: 14px;">
                        شما به هیچ نوعی از دفتر روزنامه دسترسی ندارید
                    </p>
                </div>
            </div>`;
            return;
        }

        // ⭐ مقدار پیش‌فرض = اولین گزینه مجاز
        _level = visibleConfigs[0].level;
        _mode = visibleConfigs[0].mode;

        // ⭐ ساخت گزینه‌های dropdown
        const optionsHtml = visibleConfigs.map((cfg, i) => `
        <div class="custom-select-option ${i === 0 ? 'selected' : ''}"
             data-level="${cfg.level}" data-mode="${cfg.mode}">
            ${cfg.label}
        </div>
    `).join('');

        c.innerHTML = `
    <div class="card">
        <div class="card-title">📘 تنظیمات دفتر روزنامه</div>

        <div class="form-group">
            <label>نوع گزارش</label>
            <div class="custom-select" id="dbModeWrap">
                <button type="button" class="custom-select-trigger" id="dbModeTrigger">
                    <span class="custom-select-value">${visibleConfigs[0].label}</span>
                    <span class="custom-select-arrow">▼</span>
                </button>
                <div class="custom-select-menu" id="dbModeMenu">
                    ${optionsHtml}
                </div>
            </div>
        </div>

        <div class="filters">
            <div class="form-group">
                <label>از تاریخ سند</label>
                <input type="text" id="dbFromDate" placeholder="1404/01/01">
            </div>
            <div class="form-group">
                <label>تا تاریخ سند</label>
                <input type="text" id="dbToDate" placeholder="1404/12/29">
            </div>
            <div class="form-group">
                <label>از شماره سند</label>
                <input type="number" id="dbNoFrom">
            </div>
            <div class="form-group">
                <label>تا شماره سند</label>
                <input type="number" id="dbNoTo">
            </div>
            <div class="form-group">
                <label>وضعیت سند</label>
                <select id="dbVazeit">
                    <option value="">همه</option>
                    <option value="0">پیش‌نویس</option>
                    <option value="1">رسیدگی</option>
                    <option value="2">قطعی</option>
                </select>
            </div>
            <div class="form-group">
                <label>نوع حساب‌ها</label>
                <select id="dbHesabOption">
                    <option value="all">کلیه حساب‌ها</option>
                    <option value="noZeroMandeh">حساب‌های با مانده صفر آورده نشود</option>
                    <option value="noZeroGardesh">حساب‌های با گردش صفر آورده نشود</option>
                </select>
            </div>
            <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn btn-primary btn-block" id="dbBtnRun">
                    📊 تهیه گزارش
                </button>
            </div>
        </div>
    </div>

    <div id="dbResult">
        <div class="empty">
            <div class="empty-icon">📘</div>
            <p>تنظیمات را انتخاب کنید و دکمه «تهیه گزارش» را بزنید</p>
        </div>
    </div>`;

        setupModeSelect();

        document.getElementById('dbBtnRun').addEventListener('click', () => run(1));

        ['dbFromDate', 'dbToDate', 'dbNoFrom', 'dbNoTo'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') run(1);
            });
        });
    }

    function setupModeSelect() {
        const wrap = document.getElementById('dbModeWrap');
        const trigger = document.getElementById('dbModeTrigger');
        const menu = document.getElementById('dbModeMenu');
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                _level = opt.dataset.level;
                _mode = opt.dataset.mode;
                valueEl.textContent = opt.textContent.trim();
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
            });
        });
    }

    // ═══════════════════════════════════════════
    //  RUN
    // ═══════════════════════════════════════════
    async function run(page = 1) {
        // ⭐ گارد دسترسی
        if (window.App.Permissions) {
            const visibleSubs = window.App.Permissions.getVisibleSubKeys('DayBook');
            if (visibleSubs.length === 0) {
                window.App.toast('شما به دفتر روزنامه دسترسی ندارید', 'error');
                return;
            }
        }
        const btn = document.getElementById('dbBtnRun');
        const container = document.getElementById('dbResult');
        if (!container) return;

        btn.disabled = true;
        btn.textContent = 'در حال تهیه...';
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const u = window.App.state.user;
        const payload = {
            level: _level,
            mode: _mode,
            fromDate: document.getElementById('dbFromDate').value || null,
            toDate: document.getElementById('dbToDate').value || null,
            noFrom: parseIntOrNull('dbNoFrom'),
            noTo: parseIntOrNull('dbNoTo'),
            vazeit: parseIntOrNull('dbVazeit'),
            hesabOption: document.getElementById('dbHesabOption').value || 'all',
            page: page,
            pageSize: window.App.state.settings.pageSize
        };

        try {
            const url = `/api/orgs/${u.orgId}/fy/${u.fyId}/reports/daybook`;
            const result = await window.App.Http.api(url, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            renderResult(result);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '📊 تهیه گزارش';
        }
    }

    // ═══════════════════════════════════════════
    //  RENDER RESULT
    // ═══════════════════════════════════════════
    function renderResult(data) {
        const container = document.getElementById('dbResult');
        const items = data.items || [];
        const mode = (data.mode || 'aggregated').toLowerCase();
        const level = (data.level || 'col').toLowerCase();

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>موردی یافت نشد</p>
                </div>`;
            return;
        }

        let tableHtml = '';
        let tableClass = 'daybook-table';

        if (mode === 'persanad') {
            // حالت بصورت سند
            const rows = items.map(it => `
                <tr>
                    <td class="code-col">${it.codeCol}</td>
                    <td class="code-col">${H.esc(it.dateIn || '-')}</td>
                    <td class="code-col">${H.esc(it.noSanad || '-')}</td>
                    <td>${H.esc(it.hesabName || '')}</td>
                    <td style="font-size:11.5px; color:#6B7280;">${H.esc(it.otherParentSharh || '')}</td>
                    <td class="num-col">${it.mabBed > 0 ? H.fmt(it.mabBed) : '—'}</td>
                    <td class="num-col">${it.mabBes > 0 ? H.fmt(it.mabBes) : '—'}</td>
                </tr>
            `).join('');

            tableHtml = `
                <table class="${tableClass}">
                    <thead>
                        <tr>
                            <th class="code-col" style="width:60px;">کل</th>
                            <th class="code-col" style="width:110px;">تاریخ سند</th>
                            <th class="code-col" style="width:80px;">سند</th>
                            <th>نام حساب</th>
                            <th style="width:240px;">شرح سند</th>
                            <th class="num-col" style="width:150px;">بدهکار</th>
                            <th class="num-col" style="width:150px;">بستانکار</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:700;">
                            <td colspan="5" class="text-center">جمع کل</td>
                            <td class="num-col">${H.fmt(data.totalBed)}</td>
                            <td class="num-col">${H.fmt(data.totalBes)}</td>
                        </tr>
                    </tfoot>
                </table>`;
        } else {
            // حالت تجمیعی
            const rows = items.map(it => `
                <tr>
                    <td class="code-col">${it.codeTafzili2 || '—'}</td>
                    <td class="code-col">${it.codeTafzil || '—'}</td>
                    <td class="code-col">${it.codeMoein || '—'}</td>
                    <td class="code-col" style="font-weight:600; color:var(--primary);">${it.codeCol}</td>
                    <td>${H.esc(it.hesabName || '')}</td>
                    <td class="num-col">${it.mabBed > 0 ? H.fmt(it.mabBed) : '—'}</td>
                    <td class="num-col">${it.mabBes > 0 ? H.fmt(it.mabBes) : '—'}</td>
                </tr>
            `).join('');

            tableHtml = `
                <table class="${tableClass}">
                    <thead>
                        <tr>
                            <th class="code-col" style="width:80px;">تفضیلی ۲</th>
                            <th class="code-col" style="width:80px;">تفضیلی</th>
                            <th class="code-col" style="width:70px;">معین</th>
                            <th class="code-col" style="width:70px;">کل</th>
                            <th>نام حساب</th>
                            <th class="num-col" style="width:150px;">بدهکار</th>
                            <th class="num-col" style="width:150px;">بستانکار</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:700;">
                            <td colspan="5" class="text-center">جمع کل</td>
                            <td class="num-col">${H.fmt(data.totalBed)}</td>
                            <td class="num-col">${H.fmt(data.totalBes)}</td>
                        </tr>
                    </tfoot>
                </table>`;
        }

        // ─── صفحه‌بندی ───
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                                onclick="App.Features.DayBook.run(${p})">${p}</button>`;
            }

            paginationHtml = `
                <div class="pagination-bar">
                    <div class="pagination-info">
                        نمایش ${H.fmt(items.length)} از ${H.fmt(totalCount)} ردیف
                    </div>
                    <div class="pagination-controls">
                        <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.DayBook.run(1)">«</button>
                        <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.DayBook.run(${page - 1})">‹ قبلی</button>
                        ${pageBtns}
                        <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.DayBook.run(${page + 1})">بعدی ›</button>
                        <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.DayBook.run(${totalPages})">»</button>
                    </div>
                </div>`;
        } else {
            paginationHtml = `
                <div class="pagination-bar">
                    <div class="pagination-info">مجموع: ${H.fmt(totalCount)} ردیف</div>
                </div>`;
        }

        const modeTitles = {
            'col-aggregated': 'سطح کل (تجمیعی)',
            'col-persanad': 'سطح کل (بصورت سند)',
            'tafzil-aggregated': 'سطح معین/تفضیل (تجمیعی)',
            'tafzil2-aggregated': 'سطح تفضیلی ۲ (تجمیعی)'
        };
        const title = modeTitles[`${level}-${mode}`] || 'دفتر روزنامه';

  
        container.innerHTML = `
            <div class="card">
                <div class="card-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <span>📘 ${H.esc(title)} (${H.fmt(totalCount)} ردیف)</span>
                    <!-- ⭐ دکمه خروجی دفاتر تجاری را اینجا قرار دهید -->
                    <button class="btn btn-warning btn-sm" onclick="App.Features.DayBook.openDafaterModal()">
                        📥 خروجی دفاتر تجاری
                    </button>
                </div>
                <div class="table-wrapper">
                    ${tableHtml}
                </div>
                ${paginationHtml}
            </div>`;

        const renderedTable = container.querySelector('.table-wrapper table');

        Exporter.attach(container, {
            title: 'دفتر روزنامه - ' + title,
            subtitle: subtitle(),
            filename: `DayBook_${level}_${mode}`,
            table: renderedTable
        });

        window.App.enhanceTables(container);
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }
    // ═══════════════════════════════════════════
    //  ⭐ EXPORT DAFATER TEJARI (از دفتر روزنامه)
    // ═══════════════════════════════════════════
    function openDafaterModal() {
        const body = `
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:8px; margin-bottom:16px; font-size:12px; line-height:1.6;">
                <strong>راهنمای سامانه دفاتر تجاری:</strong><br>
                • سند افتتاحیه در ردیف ۱ با تاریخ ابتدای سال مالی ثبت می‌شود.<br>
                • گردش دوره به صورت ماهانه و به ترتیب ردیف‌ها ثبت می‌شود.<br>
                • در هر سطر فقط یکی از ستون‌های بدهکار یا بستانکار مقدار خواهد داشت.
            </div>
            
            <div class="form-group" style="margin-bottom:16px;">
                <label class="cb-line" style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:normal;">
                    <input type="checkbox" id="dtIncludeOpening" checked style="width:18px; height:18px;">
                    <span>ثبت سند افتتاحیه (ردیف ۱)</span>
                </label>
                <small class="text-muted" style="display:block; margin-top:4px; font-size:11px;">در صورت نیاز به خروجی بدون مانده اول، این تیک را بردارید.</small>
            </div>

            <div class="form-group" style="margin-bottom:20px;">
                <label>شرح ثابت (برای تمام ردیف‌ها)</label>
                <input type="text" id="dtSharh" class="form-control" value="گردش حساب" placeholder="مثلا: گردش حساب">
            </div>
            
            <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button class="btn btn-primary" id="dtExportBtn">📥 دریافت فایل اکسل</button>
                <button class="btn btn-ghost" onclick="App.closeModal()">انصراف</button>
            </div>
        `;
        window.App.openModal('📥 خروجی استاندارد دفاتر تجاری', body);
        document.getElementById('dtExportBtn').addEventListener('click', doExportDafater);
    }

    async function doExportDafater() {
        const sharhDefault = document.getElementById('dtSharh').value.trim() || 'گردش حساب';
        const includeOpening = document.getElementById('dtIncludeOpening').checked;

        const fromDateInput = document.getElementById('dbFromDate').value.trim();
        const toDateInput = document.getElementById('dbToDate').value.trim();

        const u = window.App.state.user;
        let fyYear = '1405';
        if (u.fyName) {
            const match = String(u.fyName).match(/\d{4}/);
            if (match) fyYear = match[0];
        }

        const fyStartDate = fyYear + '/01/01';
        const startDate = fromDateInput || fyStartDate;
        const mainDate = toDateInput || fyYear + '/12/29';

        const btn = document.getElementById('dtExportBtn');
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'در حال استخراج داده‌ها...';

        try {
            // ۱. دریافت کل گردش دوره (این API سند افتتاحیه را کاملاً نادیده می‌گیرد)
            const tarazPayload = {
                level: _level,
                fromDate: startDate,
                toDate: mainDate,
                filterOption: 'all'
            };
            const tarazData = await window.App.Http.api('/api/taraz-shesh-sotooni/report', {
                method: 'POST',
                body: JSON.stringify(tarazPayload),
                silent: true
            });

            // ۲. دریافت گردش ماهانه از دفتر حساب
            const ledgerPayload = {
                level: _level,
                page: 1,
                pageSize: 100000,
                fromDate: startDate,
                toDate: mainDate,
                monthlyMode: true, // ⭐ حالت ماهانه
                includeMandehBefore: false,
                filterOption: 'all'
            };
            const ledgerData = await window.App.Http.api('/api/ledger', {
                method: 'POST',
                body: JSON.stringify(ledgerPayload),
                silent: true
            });

            const tarazItems = tarazData.items || [];
            const ledgerItems = ledgerData.items || [];

            const headers = [
                'ردیف', 'تاریخ', 'کد حساب کل', 'عنوان حساب کل',
                'کد حساب معین', 'عنوان حساب معین', 'شرح',
                'مبلغ بدهکار (ریال)', 'مبلغ بستانکار (ریال)'
            ];
            const aoa = [headers];
            const isColLevel = (_level === 'col');

            const monthlyData = {}; // { '1405/01': { codeKey: { bed, bes, ... } } }

            // جمع‌آوری داده‌های ماهانه از دفتر حساب
            ledgerItems.forEach(it => {
                const month = it.dateIn; // مثل 1405/01
                if (!month) return;
                if (!monthlyData[month]) monthlyData[month] = {};

                const codeKey = `${it.codeCol}_${it.codeMoein}_${it.codeTafzil}_${it.codeTafzili2}`;
                if (!monthlyData[month][codeKey]) {
                    monthlyData[month][codeKey] = {
                        bed: 0, bes: 0,
                        codeCol: it.codeCol, codeMoein: it.codeMoein,
                        colName: it.colName || '', moeinName: it.moeinName || ''
                    };
                }
                monthlyData[month][codeKey].bed += (it.mabBed || 0);
                monthlyData[month][codeKey].bes += (it.mabBes || 0);
            });

            // ⭐ ۳. اصلاح فرمول ماه اول (حذف سند افتتاحیه از گردش ماه اول)
            const firstMonthStr = startDate.substring(0, 7);
            if (firstMonthStr === fyYear + '/01') {
                const month1Data = {};

                // مقدار اولیه = کل گردش دوره (از تراز ۶ ستونی)
                tarazItems.forEach(it => {
                    const codeKey = `${it.codeCol}_${it.codeMoein}_${it.codeTafzil}_${it.codeTafzili2}`;
                    month1Data[codeKey] = {
                        bed: it.turnoverDebit || 0,
                        bes: it.turnoverCredit || 0,
                        codeCol: it.codeCol, codeMoein: it.codeMoein,
                        colName: it.colName || '', moeinName: it.moeinName || ''
                    };
                });

                // کم کردن گردش ماه‌های ۲ به بعد
                Object.keys(monthlyData).forEach(month => {
                    if (month > firstMonthStr) {
                        const mData = monthlyData[month];
                        Object.keys(mData).forEach(key => {
                            if (month1Data[key]) {
                                month1Data[key].bed -= mData[key].bed;
                                month1Data[key].bes -= mData[key].bes;
                            } else {
                                month1Data[key] = {
                                    bed: -mData[key].bed,
                                    bes: -mData[key].bes,
                                    codeCol: mData[key].codeCol, codeMoein: mData[key].codeMoein,
                                    colName: mData[key].colName, moeinName: mData[key].moeinName
                                };
                            }
                        });
                    }
                });

                monthlyData[firstMonthStr] = month1Data;
            }

            // ۴. ساخت ردیف‌های اکسل
            let currentRowNum = 1;
            let hasOpening = false;

            // ردیف افتتاحیه (اگر تیک زده باشد)
            if (includeOpening) {
                tarazItems.forEach(it => {
                    if (it.openingDebit > 0) {
                        aoa.push([
                            currentRowNum, fyStartDate, it.codeCol, it.colName || '',
                            isColLevel ? '' : (it.codeMoein || ''),
                            isColLevel ? '' : (it.moeinName || ''),
                            sharhDefault, String(it.openingDebit), 0
                        ]);
                        hasOpening = true;
                    }
                });
                tarazItems.forEach(it => {
                    if (it.openingCredit > 0) {
                        aoa.push([
                            currentRowNum, fyStartDate, it.codeCol, it.colName || '',
                            isColLevel ? '' : (it.codeMoein || ''),
                            isColLevel ? '' : (it.moeinName || ''),
                            sharhDefault, 0, String(it.openingCredit)
                        ]);
                        hasOpening = true;
                    }
                });

                if (hasOpening) currentRowNum++;
            }

            // ردیف‌های گردش ماهانه
            const sortedMonths = Object.keys(monthlyData).sort();

            sortedMonths.forEach(monthStr => {
                const monthNum = parseInt(monthStr.substring(5, 7));
                let endDay = '31';
                if (monthNum >= 7 && monthNum <= 11) endDay = '30';
                if (monthNum === 12) endDay = '29';
                const fullMonthDate = monthStr + '/' + endDay;

                const accountsInMonth = monthlyData[monthStr];

                const sortedKeys = Object.keys(accountsInMonth).sort((a, b) => {
                    const accA = accountsInMonth[a];
                    const accB = accountsInMonth[b];
                    if (accA.codeCol !== accB.codeCol) return accA.codeCol - accB.codeCol;
                    return accA.codeMoein - accB.codeMoein;
                });

                // اول بدهکارها
                sortedKeys.forEach(key => {
                    const data = accountsInMonth[key];
                    if (data.bed > 0) {
                        aoa.push([
                            currentRowNum, fullMonthDate, data.codeCol, data.colName,
                            isColLevel ? '' : (data.codeMoein || ''),
                            isColLevel ? '' : (data.moeinName || ''),
                            sharhDefault, String(data.bed), 0
                        ]);
                    }
                });

                // بعد بستانکارها
                sortedKeys.forEach(key => {
                    const data = accountsInMonth[key];
                    if (data.bes > 0) {
                        aoa.push([
                            currentRowNum, fullMonthDate, data.codeCol, data.colName,
                            isColLevel ? '' : (data.codeMoein || ''),
                            isColLevel ? '' : (data.moeinName || ''),
                            sharhDefault, 0, String(data.bes)
                        ]);
                    }
                });

                currentRowNum++;
            });

            if (aoa.length === 1) {
                window.App.toast('هیچ داده‌ای برای خروجی یافت نشد', 'warning');
                btn.disabled = false;
                btn.innerHTML = orig;
                return;
            }

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = [
                { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 35 },
                { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 18 }
            ];

            for (let R = 1; R < aoa.length; ++R) {
                const cellH = XLSX.utils.encode_cell({ r: R, c: 7 });
                const cellI = XLSX.utils.encode_cell({ r: R, c: 8 });
                if (ws[cellH]) ws[cellH].z = '@';
                if (ws[cellI]) ws[cellI].z = '@';
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'دفاتر تجاری');

            const fileName = `Dafater_Tejari_${fyYear}.xlsx`;
            XLSX.writeFile(wb, fileName);

            window.App.toast('فایل اکسل استاندارد دانلود شد', 'success');
            window.App.closeModal();
        } catch (err) {
            console.error(err);
            window.App.toast(err.message || 'خطا در تهیه فایل', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return { render, run,openDafaterModal };
})();

// ⭐ alias
window.App.renderDayBook = window.App.Features.DayBook.render;
window.App.runDayBook = window.App.Features.DayBook.run;