/* ═══════════════════════════════════════════════════
   Feature / FactorProfitLoss — گزارش سود و زیان فاکتوری
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.FactorProfitLoss = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;

    let _state = {
        result: null,
        page: 1,
        codeTafzil: null,
        searchText: ''
    };

    let _customersCache = null;
    let _customersLoading = null;

    function toLatin(s) {
        if (!s) return null;
        if (H.toLatinDigits) return H.toLatinDigits(s.trim()) || null;
        return s
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .trim() || null;
    }

    // ═══════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        _state = { result: null, page: 1, codeTafzil: null, searchText: '' };

        const orderOptions = [
            { value: 'date', label: 'تاریخ فاکتور' },
            { value: 'profit', label: 'سود' },
            { value: 'profitpct', label: 'درصد سود' },
            { value: 'amount', label: 'مبلغ فروش' }
        ];

        const profitFilterOptions = [
            { value: '0', label: 'همه فاکتورها' },
            { value: '1', label: '✅ فقط سود' },
            { value: '2', label: '❌ فقط زیان' }
        ];

        c.innerHTML = `
        <div class="card filter-card" id="fplFilterCard">
            <div class="card-title" id="fplToggleBtn">
                <span>🔍 فیلتر گزارش سود و زیان فاکتوری</span>
                <span class="ft-icon">▼</span>
            </div>
            <div class="filter-body" id="fplFilterBody">
                <div class="filters two-rows">
                    <div class="form-group">
                        <label>از تاریخ</label>
                        <input type="text" id="fplDateFrom" placeholder="1404/01/01">
                    </div>
                    <div class="form-group">
                        <label>تا تاریخ</label>
                        <input type="text" id="fplDateTo" placeholder="1404/12/29">
                    </div>
                    <div class="form-group pf-customer-group">
                         <label>طرف حساب</label>
                        <div class="pf-customer-row">
                            <input type="text" id="fplCustomerInput" class="num-input"
                                   placeholder="کد یا نام (تایپ کنید)..."
                                   autocomplete="off">
                            <button type="button" class="ff-pick-btn"
                                    id="fplClearBtn" title="پاک کردن">✕</button>
                        </div>
                        <div class="pf-suggestions" id="fplSuggestions"></div>
                    </div>
                    <div class="form-group">
                        <label>از شماره</label>
                        <input type="number" id="fplNoFrom">
                    </div>
                    <div class="form-group">
                        <label>تا شماره</label>
                        <input type="number" id="fplNoTo">
                    </div>
                    <div class="form-group">
                        <label>وضعیت سود</label>
                        ${CS.html('fplProfitFilter', profitFilterOptions, '0')}
                    </div>
                    <div class="form-group">
                        <label>مرتب‌سازی</label>
                        ${CS.html('fplOrderBy', orderOptions, 'date')}
                    </div>
                </div>
                <div style="margin-top:14px;">
                    <button class="btn btn-primary" id="fplRunBtn">📊 نمایش گزارش</button>
                </div>
            </div>
        </div>
        <div id="fplResult">
            <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                <div style="font-size:56px;opacity:0.4;">💰</div>
                <p style="margin-top:12px;">فیلترها را تنظیم و «نمایش گزارش» را بزنید</p>
            </div>
        </div>`;

        // ⭐ جمع/باز فیلتر
        const filterCard = document.getElementById('fplFilterCard');
        const toggleBtn = document.getElementById('fplToggleBtn');
        if (filterCard && toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                filterCard.classList.toggle('collapsed');
            });
        }

        CS.bindAll(c, {
            fplProfitFilter: function (v) {
                _state.page = 1;
                runReport();
             }
        });
        bindCustomerSearch();

        document.getElementById('fplClearBtn').addEventListener('click', clearCustomer);

        document.getElementById('fplRunBtn').addEventListener('click', function () {
            _state.page = 1;
            runReport();
        });

        ['fplDateFrom', 'fplDateTo', 'fplNoFrom', 'fplNoTo']
            .forEach(id => {
                document.getElementById(id)?.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        _state.page = 1;
                        runReport();
                    }
                });
            });
    }

    // ═══════════════════════════════════════════════════
    //  Run
    // ═══════════════════════════════════════════════════
    async function runReport() {
        const container = document.getElementById('fplResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const result = await window.App.Http.api('/api/reports/factor-profit-loss', {
                method: 'POST',
                body: JSON.stringify(buildPayload(_state.page || 1))
            });
            _state.result = result;
            await renderResult(result);
        } catch (err) {
            container.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function buildPayload(page, pageSizeOverride) {
        // ⭐ اگه کاربر از لیست انتخاب کرد → codeTafzil
        // ⭐ اگه دستی نوشت → hesabName
        const codeTafzil = _state.codeTafzil;
        const hesabName = !codeTafzil && _state.searchText ? _state.searchText : null;

        return {
            dateFrom: toLatin(document.getElementById('fplDateFrom').value),
            dateTo: toLatin(document.getElementById('fplDateTo').value),
            codeTafzil: codeTafzil,
            hesabName: hesabName,
            noFrom: parseInt(document.getElementById('fplNoFrom').value, 10) || null,
            noTo: parseInt(document.getElementById('fplNoTo').value, 10) || null,
            profitFilter: parseInt(CS.getValue('fplProfitFilter') || '0', 10),
            orderBy: CS.getValue('fplOrderBy') || 'date',
            page: page || 1,
            pageSize: pageSizeOverride || (window.App.state.settings.pageSize || 50)
        };
    }

    // ═══════════════════════════════════════════════════
    //  Render Result
    // ═══════════════════════════════════════════════════
    async function renderResult(r) {
        const c = document.getElementById('fplResult');
        const items = r.items || [];

        const rows = items.map((it, idx) => {
            const rowNum = (r.page - 1) * r.pageSize + idx + 1;
            const profitCls = it.profit > 0 ? 'positive' : (it.profit < 0 ? 'negative' : '');
            const pctCls = it.profitPct > 0 ? 'positive' : (it.profitPct < 0 ? 'negative' : '');

            return `<tr>
                <td class="text-center">${rowNum}</td>
                <td class="num text-center">${it.noFactor || ''}</td>
                <td class="num text-center">${H.esc(it.dateIn || '')}</td>
                <td class="num text-center">${it.codeTafzil || ''}</td>
                <td class="pf-hesab" title="${H.esc(it.hesabName || '')}">${H.esc(it.hesabName || '')}</td>
                <td class="num text-center">${it.itemCount}</td>
                <td class="num text-left">${H.fmt(it.saleAmount)}</td>
                <td class="num text-left">${H.fmt(it.saleDiscount)}</td>
                <td class="num text-left">${H.fmt(it.saleTax)}</td>
                <td class="num text-left">${H.fmt(it.costAmount)}</td>
                <td class="num text-left ${profitCls}"><strong>${H.fmt(it.profit)}</strong></td>
                <td class="num text-center ${pctCls}">${H.fmt(it.profitPct)}%</td>
                <td class="text-center">${it.noSanad ? '✅ ' + it.noSanad : '🚫'}</td>
            </tr>`;
        }).join('');

        const empty = items.length === 0
            ? '<tr><td colspan="13" class="text-center" style="padding:30px;color:#94A3B8;">فاکتوری یافت نشد</td></tr>'
            : '';

        const totalPctCls = r.totalProfitPct > 0 ? 'positive' : (r.totalProfitPct < 0 ? 'negative' : '');

        c.innerHTML = `
            <!-- کارت آمار -->
            <div class="fpl-stats">
                <div class="fpl-stat fpl-stat-sale">
                    <div class="fpl-stat-label">💰 جمع فروش</div>
                    <div class="fpl-stat-value">${H.fmt(r.totalSaleAmount)}</div>
                    <div class="fpl-stat-sub">${H.fmt(r.totalCount)} فاکتور</div>
                </div>
                <div class="fpl-stat fpl-stat-cost">
                    <div class="fpl-stat-label">🏷️ بهای تمام‌شده</div>
                    <div class="fpl-stat-value">${H.fmt(r.totalCostAmount)}</div>
                </div>
                <div class="fpl-stat fpl-stat-profit">
                    <div class="fpl-stat-label">💵 سود کل</div>
                    <div class="fpl-stat-value ${r.totalProfit > 0 ? 'positive' : (r.totalProfit < 0 ? 'negative' : '')}">
                        ${H.fmt(r.totalProfit)}
                    </div>
                </div>
                <div class="fpl-stat fpl-stat-pct">
                    <div class="fpl-stat-label">📊 درصد سود</div>
                    <div class="fpl-stat-value ${totalPctCls}">${H.fmt(r.totalProfitPct)}%</div>
                </div>
                <div class="fpl-stat fpl-stat-count">
                    <div class="fpl-stat-label">📋 تعداد</div>
                    <div class="fpl-stat-value">
                        <span class="positive">${r.profitCount} سود</span>
                        <span class="negative" style="margin-right:8px;">${r.lossCount} زیان</span>
                    </div>
                </div>
            </div>

            <!-- جدول -->
            <div class="card">
                <div class="card-title">
                    <span>💰 گزارش سود و زیان فاکتوری (${H.fmt(r.totalCount)})</span>
                </div>
                <div class="table-wrapper fpl-table-wrap">
                    <table class="fpl-table">
                        <thead>
                            <tr>
                                <th style="width:35px;" data-nosort>#</th>
                                <th style="width:70px;">شماره</th>
                                <th style="width:90px;">تاریخ</th>
                                <th style="width:70px;">کد طرف</th>
                                <th>طرف حساب</th>
                                <th style="width:55px;">اقلام</th>
                                <th class="text-left" style="width:120px;">فروش</th>
                                <th class="text-left" style="width:100px;">تخفیف</th>
                                <th class="text-left" style="width:100px;">مالیات</th>
                                <th class="text-left" style="width:120px;">بهای تمام‌شده</th>
                                <th class="text-left" style="width:120px;">سود</th>
                                <th class="text-center" style="width:80px;">درصد</th>
                                <th style="width:80px;">سند</th>
                            </tr>
                        </thead>
                        <tbody>${rows || empty}</tbody>
                        <tfoot>
                            <tr class="fpl-total-row">
                                <td colspan="6" class="text-center">جمع کل</td>
                                <td class="num text-left">${H.fmt(r.totalSaleAmount)}</td>
                                <td class="num text-left">${H.fmt(r.totalSaleDiscount)}</td>
                                <td class="num text-left">${H.fmt(r.totalSaleTax)}</td>
                                <td class="num text-left">${H.fmt(r.totalCostAmount)}</td>
                                <td class="num text-left ${r.totalProfit > 0 ? 'positive' : (r.totalProfit < 0 ? 'negative' : '')}">
                                    <strong>${H.fmt(r.totalProfit)}</strong>
                                </td>
                                <td class="num text-center ${totalPctCls}"><strong>${H.fmt(r.totalProfitPct)}%</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div id="fplPagination"></div>
                <div id="fplExportSlot"></div>
            </div>`;

        // صفحه‌بندی
        if (r.totalPages > 1) {
            const pgEl = document.getElementById('fplPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(r.page, r.totalPages, r.totalCount, items.length);
        }

        // داده‌ی کامل برای Export
        let exportData = r;
        if (r.totalPages > 1) {
            try {
                const full = await window.App.Http.api('/api/reports/factor-profit-loss', {
                    method: 'POST',
                    body: JSON.stringify(buildPayload(1, 1000000))
                });
                exportData = full;
            } catch (e) { console.warn(e); }
        }

        if (typeof Exporter !== 'undefined' && Exporter.attach && items.length > 0) {
            Exporter.attach(document.getElementById('fplResult'), {
                title: 'گزارش سود و زیان فاکتوری',
                subtitle: subtitle(),
                filename: 'FactorProfitLoss',
                customHtml: function () { return buildPrintHtml(exportData); }
            });
        }

        if (window.App.enhanceTables) window.App.enhanceTables(document.getElementById('fplResult'));
    }

    // ═══════════════════════════════════════════════════
    //  Pagination
    // ═══════════════════════════════════════════════════
    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.FactorProfitLoss.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} فاکتور</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.FactorProfitLoss.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.FactorProfitLoss.goToPage(${page - 1})">‹ قبلی</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.FactorProfitLoss.goToPage(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.FactorProfitLoss.goToPage(${totalPages})">»</button>
            </div>
        </div>`;
    }

    function goToPage(p) {
        _state.page = p;
        runReport();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ═══════════════════════════════════════════════════
    //  Print
    // ═══════════════════════════════════════════════════
    function buildPrintHtml(r) {
        const header = `
        <table class="factor-info-table" style="margin-bottom:10px;">
            <tr>
                <td class="label">تعداد فاکتور:</td><td>${H.fmt(r.totalCount)}</td>
                <td class="label">جمع فروش:</td><td>${H.fmt(r.totalSaleAmount)}</td>
                <td class="label">بهای تمام‌شده:</td><td>${H.fmt(r.totalCostAmount)}</td>
                <td class="label">سود کل:</td><td>${H.fmt(r.totalProfit)}</td>
                <td class="label">درصد:</td><td>${H.fmt(r.totalProfitPct)}%</td>
            </tr>
        </table>`;

        const rows = (r.items || []).map((it, idx) => `<tr>
            <td class="text-center">${idx + 1}</td>
            <td class="text-center">${it.noFactor || ''}</td>
            <td class="text-center">${H.esc(it.dateIn || '')}</td>
            <td>${H.esc(it.hesabName || '')}</td>
            <td class="text-center">${it.itemCount}</td>
            <td class="text-left">${H.fmt(it.saleAmount)}</td>
            <td class="text-left">${H.fmt(it.saleDiscount)}</td>
            <td class="text-left">${H.fmt(it.saleTax)}</td>
            <td class="text-left">${H.fmt(it.costAmount)}</td>
            <td class="text-left"><strong>${H.fmt(it.profit)}</strong></td>
            <td class="text-center">${H.fmt(it.profitPct)}%</td>
        </tr>`).join('');

        return header + `
            <table>
                <thead><tr>
                    <th>#</th><th>شماره</th><th>تاریخ</th><th>طرف حساب</th><th>اقلام</th>
                    <th>فروش</th><th>تخفیف</th><th>مالیات</th>
                    <th>بهای تمام‌شده</th><th>سود</th><th>درصد</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════════════
    //  Combobox جستجوی طرف حساب
    // ═══════════════════════════════════════════════════
    async function ensureCustomersLoaded() {
        if (_customersCache) return _customersCache;
        if (_customersLoading) return _customersLoading;

        _customersLoading = (async function () {
            try {
                const resp = await window.App.Http.api('/api/tafzili/list', {
                    method: 'POST',
                    body: JSON.stringify({ page: 1, pageSize: 100000, mandehFilter: 'all' })
                });
                _customersCache = (resp.items || []).filter(x => x.codeTafzil > 0);
                return _customersCache;
            } catch (err) {
                console.error('خطا در بارگذاری مشتریان:', err);
                _customersCache = [];
                return [];
            } finally {
                _customersLoading = null;
            }
        })();

        return _customersLoading;
    }

    function bindCustomerSearch() {
        const input = document.getElementById('fplCustomerInput');
        const box = document.getElementById('fplSuggestions');
        if (!input || !box) return;

        let _debounce = null;
        let _activeIdx = -1;

        async function doSearch(q) {
            const query = (q || '').trim().toLowerCase();
            if (query.length < 1) {
                box.classList.remove('show');
                box.innerHTML = '';
                return;
            }

            const all = await ensureCustomersLoaded();
            const filtered = all.filter(x =>
                String(x.codeTafzil).indexOf(query) !== -1 ||
                (x.name || '').toLowerCase().indexOf(query) !== -1
            ).slice(0, 50);

            if (filtered.length === 0) {
                box.innerHTML = '<div class="pf-suggestion-empty">موردی یافت نشد — با Enter متن آزاد بفرستید</div>';
                box.classList.add('show');
                return;
            }

            let html = '<div class="pf-suggestion-hint">' + filtered.length + ' نتیجه</div>';
            filtered.forEach((x, idx) => {
                html += `<div class="pf-suggestion" data-idx="${idx}"
                          data-code="${x.codeTafzil}"
                          data-name="${H.esc(x.name || '')}">
                <span class="pf-suggestion-code">${x.codeTafzil}</span>
                <div class="pf-suggestion-body">
                    <div class="pf-suggestion-name">${H.esc(x.name || '')}</div>
                    <div class="pf-suggestion-sub">${H.esc(x.phone || x.mobile || '')}</div>
                </div>
            </div>`;
            });
            box.innerHTML = html;
            box.classList.add('show');
            _activeIdx = -1;

            box.querySelectorAll('.pf-suggestion').forEach(el => {
                el.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    selectSuggestion(this.dataset.code, this.dataset.name);
                });
            });
        }

        input.addEventListener('input', function () {
            _state.codeTafzil = null;
            _state.searchText = this.value;
            clearTimeout(_debounce);
            const q = this.value;
            _debounce = setTimeout(() => doSearch(q), 250);
        });

        input.addEventListener('focus', function () {
            if (this.value.trim().length >= 1) doSearch(this.value);
        });

        input.addEventListener('keydown', function (e) {
            const suggestions = box.querySelectorAll('.pf-suggestion');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (_activeIdx < suggestions.length - 1) _activeIdx++;
                updateActive(suggestions);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (_activeIdx > 0) _activeIdx--;
                updateActive(suggestions);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (_activeIdx >= 0 && suggestions[_activeIdx]) {
                    const el = suggestions[_activeIdx];
                    selectSuggestion(el.dataset.code, el.dataset.name);
                } else if (suggestions.length > 0 && box.classList.contains('show')) {
                    const el = suggestions[0];
                    selectSuggestion(el.dataset.code, el.dataset.name);
                } else {
                    box.classList.remove('show');
                    _state.searchText = this.value.trim();
                    _state.page = 1;
                    runReport();
                }
            } else if (e.key === 'Escape') {
                box.classList.remove('show');
            }
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.pf-customer-group')) {
                box.classList.remove('show');
            }
        });

        function updateActive(suggestions) {
            suggestions.forEach((el, i) => {
                el.classList.toggle('active', i === _activeIdx);
            });
            if (suggestions[_activeIdx]) {
                suggestions[_activeIdx].scrollIntoView({ block: 'nearest' });
            }
        }

        function selectSuggestion(code, name) {
            _state.codeTafzil = parseInt(code, 10);
            _state.searchText = '';
            input.value = `${code} — ${name}`;
            box.classList.remove('show');
        }
    }

    function clearCustomer() {
        _state.codeTafzil = null;
        _state.searchText = '';
        document.getElementById('fplCustomerInput').value = '';
        document.getElementById('fplSuggestions').classList.remove('show');
    }

    return { render, runReport, goToPage };
})();

window.App.renderFactorProfitLoss = window.App.Features.FactorProfitLoss.render;