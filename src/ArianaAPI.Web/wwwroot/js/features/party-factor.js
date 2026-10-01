/* ═══════════════════════════════════════════════════
   Feature / PartyFactor — فاکتورهای طرف حساب
   با Search Combobox + سه حالت نمایش
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.PartyFactor = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;

    let _state = {
        codeTafzil: null,
        hesabName: null,
        searchText: '',
        result: null,
        page: 1,
        viewMode: 'flat'
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

    // ═══════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        _state = {
            codeTafzil: null, hesabName: null, searchText: '',
            result: null, page: 1, viewMode: 'flat'
        };

        const factorKindOptions = [
            { value: '', label: 'همه' },
            { value: '0', label: 'خرید' },
            { value: '1', label: 'فروش' },
            { value: '2', label: 'برگشت از خرید' },
            { value: '3', label: 'برگشت از فروش' }
        ];

        const onlyWithoutSanadOptions = [
            { value: '', label: 'همه' },
            { value: '1', label: 'بدون سند' }
        ];

        const viewModeOptions = [
            { value: 'flat', label: '📋 لیست فاکتورها' },
            { value: 'grouped-by-party', label: '👥 گروه‌بندی بر اساس طرف حساب' },
            { value: 'grouped-by-article', label: '📦 گروه‌بندی بر اساس کالا' }
        ];

        const orderByOptions = [
            { value: 'date', label: 'تاریخ' },
            { value: 'no', label: 'شماره فاکتور' },
            { value: 'amount', label: 'مبلغ' },
            { value: 'name', label: 'طرف حساب' }
        ];

        c.innerHTML = `
        <div class="card filter-card" id="pfFilterCard">
            <div class="card-title">
                <span>🔍 فیلتر فاکتورهای طرف حساب</span>
                <button type="button" class="filter-toggle-btn" id="pfToggleBtn" title="جمع/باز کردن">
                    <span class="ft-icon">▼</span>
                </button>
            </div>
            <div class="filter-body" id="pfFilterBody">
                <div class="filters two-rows">
                    <div class="form-group">
                        <label>نوع فاکتور</label>
                        ${CS.html('pfFactorKind', factorKindOptions, '')}
                    </div>
                    <div class="form-group pf-customer-group">
                        <label>طرف حساب</label>
                        <div class="pf-customer-row">
                            <input type="text" id="pfCustomerInput" class="num-input"
                                   placeholder="کد یا نام (تایپ کنید)..."
                                   autocomplete="off">
                            <button type="button" class="ff-pick-btn"
                                    id="pfClearBtn" title="پاک کردن">✕</button>
                        </div>
                        <div class="pf-suggestions" id="pfSuggestions"></div>
                    </div>
                    <div class="form-group">
                        <label>از تاریخ</label>
                        <input type="text" id="pfDateFrom" placeholder="1404/01/01">
                    </div>
                    <div class="form-group">
                        <label>تا تاریخ</label>
                        <input type="text" id="pfDateTo" placeholder="1404/12/29">
                    </div>
                    <div class="form-group">
                        <label>از شماره</label>
                        <input type="number" id="pfNoFrom">
                    </div>
                    <div class="form-group">
                        <label>تا شماره</label>
                        <input type="number" id="pfNoTo">
                    </div>
                    <div class="form-group">
                        <label>شرح</label>
                        <input type="text" id="pfDescript">
                    </div>
                    <div class="form-group">
                        <label>فقط بدون سند</label>
                        ${CS.html('pfOnlyWithoutSanad', onlyWithoutSanadOptions, '')}
                    </div>
                    <div class="form-group">
                        <label>حالت نمایش</label>
                        ${CS.html('pfViewMode', viewModeOptions, 'flat')}
                    </div>
                    <div class="form-group">
                        <label>مرتب‌سازی</label>
                        ${CS.html('pfOrderBy', orderByOptions, 'date')}
                    </div>
                </div>
                <div style="margin-top:14px;">
                    <button class="btn btn-primary" id="pfRunBtn">📊 نمایش</button>
                </div>
            </div>
        </div>
        <div id="pfResult">
            <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                <div style="font-size:56px;opacity:0.4;">🧾</div>
                <p style="margin-top:12px;">فیلترها را تنظیم و «نمایش» را بزنید</p>
            </div>
        </div>`;

        // ⭐ جمع/باز کردن فیلتر
        const filterCard = document.getElementById('pfFilterCard');
        const toggleBtn = document.getElementById('pfToggleBtn');
        toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            filterCard.classList.toggle('collapsed');
        });
        // کلیک روی عنوان هم toggle کنه
        filterCard.querySelector('.card-title').addEventListener('click', function (e) {
            if (e.target.closest('.filter-toggle-btn')) return;
            toggleBtn.click();
        });

        // فعال‌سازی Custom Select ها
        CS.bindAll(c, {
            pfViewMode: function (v) {
                _state.viewMode = v;
                _state.page = 1;
                runReport();
            }
        });

        // Search Combobox
        bindCustomerSearch();

        document.getElementById('pfClearBtn').addEventListener('click', clearCustomer);
        document.getElementById('pfRunBtn').addEventListener('click', function () {
            _state.page = 1;
            runReport();
        });

        ['pfDateFrom', 'pfDateTo', 'pfNoFrom', 'pfNoTo', 'pfDescript'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    _state.page = 1;
                    runReport();
                }
            });
        });

        ensureCustomersLoaded();
    }

    // ═══════════════════════════════════════════════════
    //  Combobox Search
    // ═══════════════════════════════════════════════════
    function bindCustomerSearch() {
        const input = document.getElementById('pfCustomerInput');
        const box = document.getElementById('pfSuggestions');
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
                box.innerHTML = '<div class="pf-suggestion-empty">موردی یافت نشد — با Enter می‌تونید متن آزاد بفرستید</div>';
                box.classList.add('show');
                return;
            }

            let html = '<div class="pf-suggestion-hint">' + filtered.length + ' نتیجه — کلیک کنید یا Enter بزنید</div>';
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
            _state.hesabName = null;
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
            _state.hesabName = name;
            _state.searchText = '';
            input.value = `${code} — ${name}`;
            box.classList.remove('show');
        }
    }

    function clearCustomer() {
        _state.codeTafzil = null;
        _state.hesabName = null;
        _state.searchText = '';
        document.getElementById('pfCustomerInput').value = '';
        document.getElementById('pfSuggestions').classList.remove('show');
    }

    // ═══════════════════════════════════════════════════
    //  Run Report
    // ═══════════════════════════════════════════════════
    async function runReport() {
        if (CS && CS.closeAll) CS.closeAll();
        const container = document.getElementById('pfResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const mode = CS.getValue('pfViewMode') || 'flat';
        _state.viewMode = mode;

        const payload = buildPayload(_state.page || 1);

        try {
            const result = await window.App.Http.api('/api/reports/party-factor', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            _state.result = result;

            if (mode === 'grouped-by-party' || mode === 'grouped-by-article') {
                await renderGrouped(result, mode);
            } else {
                await renderFlat(result);
            }
        } catch (err) {
            container.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function buildPayload(page, pageSizeOverride) {
        const mode = CS.getValue('pfViewMode') || 'flat';
        const isGrouped = mode !== 'flat';

        const codeTafzil = _state.codeTafzil;
        const hesabName = !codeTafzil && _state.searchText ? _state.searchText : null;

        const fkValue = CS.getValue('pfFactorKind');
        const sanadValue = CS.getValue('pfOnlyWithoutSanad');

        return {
            codeTafzil: codeTafzil,
            hesabName: hesabName,
            factorKind: fkValue !== '' ? parseInt(fkValue, 10) : null,
            dateFrom: toLatin(document.getElementById('pfDateFrom').value),
            dateTo: toLatin(document.getElementById('pfDateTo').value),
            noFrom: parseInt(document.getElementById('pfNoFrom').value, 10) || null,
            noTo: parseInt(document.getElementById('pfNoTo').value, 10) || null,
            descript: document.getElementById('pfDescript').value || null,
            onlyWithoutSanad: sanadValue === '1' ? true : null,
            orderBy: CS.getValue('pfOrderBy') || 'date',
            viewMode: isGrouped ? 'grouped' : 'flat',
            groupBy: mode === 'grouped-by-article' ? 'article' : 'party',
            page: page || 1,
            pageSize: isGrouped ? 100000 : (pageSizeOverride || (window.App.state.settings.pageSize || 50))
        };
    }

    // ═══════════════════════════════════════════════════
    //  Flat Render
    // ═══════════════════════════════════════════════════
    async function renderFlat(r) {
        const c = document.getElementById('pfResult');
        const items = r.items || [];
        const hasCustomer = !!r.codeTafzil;

        const rows = items.map((it, idx) => {
            const kindCls = it.factorKind === 0 ? 'pf-buy' :
                it.factorKind === 1 ? 'pf-sell' :
                    it.factorKind === 2 ? 'pf-backbuy' : 'pf-backsell';
            const sanadCell = it.noSanad
                ? `<span class="sanad-badge sanad-ok">✅ ${it.noSanad}</span>`
                : `<span class="sanad-badge sanad-none">🚫</span>`;
            const rowNum = (r.page - 1) * r.pageSize + idx + 1;
            const customerCell = !hasCustomer
                ? `<td class="pf-hesab" title="${H.esc(it.hesabName || '')}">${H.esc(it.hesabName || '')}</td>`
                : '';

            return `<tr>
                <td class="text-center">${rowNum}</td>
                <td class="num text-center">${it.noFactor || ''}</td>
                <td class="num text-center">${H.esc(it.dateIn || '')}</td>
                <td class="text-center ${kindCls}">${H.esc(it.factorKindTitle || '')}</td>
                ${customerCell}
                <td class="pf-descript" title="${H.esc(it.descript || '')}">${H.esc(it.descript || '')}</td>
                <td class="num text-center">${it.itemCount}</td>
                <td class="num text-left">${H.fmt(it.totalCostItem)}</td>
                <td class="num text-left">${H.fmt(it.totalDiscount)}</td>
                <td class="num text-left">${H.fmt(it.totalTax)}</td>
                <td class="num text-left"><strong>${H.fmt(it.finalAmount)}</strong></td>
                <td class="text-center">${sanadCell}</td>
                <td class="text-center">${H.esc(it.isCashName || '')}</td>
            </tr>`;
        }).join('');

        const totalCols = hasCustomer ? 13 : 14;
        const empty = items.length === 0
            ? `<tr><td colspan="${totalCols}" class="text-center" style="padding:30px;color:#94A3B8;">فاکتوری یافت نشد</td></tr>`
            : '';

        c.innerHTML = `
            ${renderStats(r)}
            <div class="card">
                <div class="card-title">
                    <span>🧾 ${hasCustomer ? 'فاکتورهای ' + H.esc(r.hesabName || '') : 'همه‌ی فاکتورها'} (${H.fmt(r.totalCount)})</span>
                </div>
                <div class="table-wrapper pf-table-wrap">
                    <table class="pf-table">
                        <thead>
                            <tr>
                                <th style="width:35px;" data-nosort>#</th>
                                <th style="width:70px;">شماره</th>
                                <th style="width:90px;">تاریخ</th>
                                <th style="width:110px;">نوع</th>
                                ${!hasCustomer ? '<th>طرف حساب</th>' : ''}
                                <th>شرح</th>
                                <th style="width:60px;">اقلام</th>
                                <th class="text-left" style="width:110px;">جمع کالاها</th>
                                <th class="text-left" style="width:90px;">تخفیف</th>
                                <th class="text-left" style="width:90px;">مالیات</th>
                                <th class="text-left" style="width:120px;">مبلغ نهایی</th>
                                <th style="width:80px;">سند</th>
                                <th style="width:70px;">پرداخت</th>
                            </tr>
                        </thead>
                        <tbody>${rows || empty}</tbody>
                    </table>
                </div>
                <div id="pfPagination"></div>
                <div id="pfExportSlot"></div>
            </div>`;

        if (r.totalPages > 1) {
            const pgEl = document.getElementById('pfPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(r.page, r.totalPages, r.totalCount, items.length);
        }

        let exportData = r;
        if (r.totalPages > 1) {
            try {
                const full = await window.App.Http.api('/api/reports/party-factor', {
                    method: 'POST',
                    body: JSON.stringify(buildPayload(1, 1000000))
                });
                exportData = full;
            } catch (e) { console.warn(e); }
        }

        if (typeof Exporter !== 'undefined' && Exporter.attach && items.length > 0) {
            Exporter.attach(document.getElementById('pfResult'), {
                title: hasCustomer ? 'فاکتورهای ' + (r.hesabName || '') : 'گزارش فاکتورها',
                subtitle: subtitle(r),
                filename: 'PartyFactor_' + (r.codeTafzil || 'All'),
                customHtml: function () { return buildPrintFlat(exportData); }
            });
        }

        if (window.App.enhanceTables) window.App.enhanceTables(document.getElementById('pfResult'));
    }

    // ═══════════════════════════════════════════════════
    //  Grouped Render
    // ═══════════════════════════════════════════════════
    async function renderGrouped(r, mode) {
        const c = document.getElementById('pfResult');
        const items = r.articleItems || [];
        const byParty = mode === 'grouped-by-party';

        if (items.length === 0) {
            c.innerHTML = '<div class="card"><div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">' +
                '<div style="font-size:56px;opacity:0.4;">📭</div>' +
                '<p style="margin-top:12px;">موردی یافت نشد</p></div></div>';
            return;
        }

        const groups = {};
        items.forEach(it => {
            const key = byParty ? (it.codeTafzil || 0) : (it.articleId || 0);
            if (!groups[key]) {
                groups[key] = {
                    codeTafzil: it.codeTafzil,
                    hesabName: it.hesabName || '(بدون نام)',
                    articleId: it.articleId,
                    articleCode: it.articleCode,
                    articleName: it.articleName || '(بدون نام)',
                    articleUnitName: it.articleUnitName,
                    rows: []
                };
            }
            groups[key].rows.push(it);
        });

        let html = renderStats(r);

        Object.values(groups).forEach(g => {
            let sumBuyQty = 0, sumBuyVal = 0, sumSellQty = 0, sumSellVal = 0;
            let sumBackBuyQty = 0, sumBackBuyVal = 0, sumBackSellQty = 0, sumBackSellVal = 0;

            const rowsHtml = g.rows.map(it => {
                sumBuyQty += it.buyQty; sumBuyVal += it.buyAmount;
                sumSellQty += it.sellQty; sumSellVal += it.sellAmount;
                sumBackBuyQty += it.backBuyQty; sumBackBuyVal += it.backBuyAmount;
                sumBackSellQty += it.backSellQty; sumBackSellVal += it.backSellAmount;

                const buyCell = it.buyQty ? `<span class="pf-buy">${H.fmt(it.buyQty)}</span> <small>(${H.fmt(it.buyAmount)})</small>` : '—';
                const sellCell = it.sellQty ? `<span class="pf-sell">${H.fmt(it.sellQty)}</span> <small>(${H.fmt(it.sellAmount)})</small>` : '—';
                const bbCell = it.backBuyQty ? `<span class="pf-backbuy">${H.fmt(it.backBuyQty)}</span>` : '—';
                const bsCell = it.backSellQty ? `<span class="pf-backsell">${H.fmt(it.backSellQty)}</span>` : '—';

                const firstCell = byParty
                    ? `<td><strong>${H.esc(it.articleName || '')}</strong> <small class="num">(${H.esc(it.articleCode || '')})</small></td>`
                    : `<td>${H.esc(it.hesabName || '')} <small class="num">(${it.codeTafzil || ''})</small></td>`;

                return `<tr>
                    ${firstCell}
                    <td class="text-center">${H.esc(it.articleUnitName || '')}</td>
                    <td class="num text-left">${buyCell}</td>
                    <td class="num text-left">${sellCell}</td>
                    <td class="num text-left">${bbCell}</td>
                    <td class="num text-left">${bsCell}</td>
                    <td class="num text-left"><strong>${H.fmt(it.netQty)}</strong></td>
                    <td class="num text-left">${H.fmt(it.netAmount)}</td>
                </tr>`;
            }).join('');

            const netQty = sumBuyQty - sumSellQty - sumBackBuyQty + sumBackSellQty;
            const netVal = sumBuyVal - sumSellVal - sumBackBuyVal + sumBackSellVal;

            const groupTitle = byParty
                ? `👤 ${H.esc(g.hesabName)} <small class="num">(کد ${g.codeTafzil || '-'})</small>`
                : `📦 ${H.esc(g.articleName)} <small class="num">(${H.esc(g.articleCode || '')})</small>`;

            html += `
            <div class="card pf-group-card">
                <div class="card-title">
                    <span>${groupTitle}</span>
                    <span class="pf-group-count">${g.rows.length} قلم</span>
                </div>
                <div class="table-wrapper pf-table-wrap">
                    <table class="pf-table">
                        <thead>
                            <tr>
                                <th>${byParty ? 'کالا' : 'طرف حساب'}</th>
                                <th style="width:60px;">واحد</th>
                                <th class="text-left" style="width:140px;">خرید (مقدار/ریال)</th>
                                <th class="text-left" style="width:140px;">فروش (مقدار/ریال)</th>
                                <th class="text-left" style="width:100px;">برگشت خرید</th>
                                <th class="text-left" style="width:100px;">برگشت فروش</th>
                                <th class="text-left" style="width:90px;">مانده مقدار</th>
                                <th class="text-left" style="width:120px;">مانده ارزش</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                        <tfoot>
                            <tr class="pf-total-row">
                                <td colspan="2" class="text-center">جمع</td>
                                <td class="num text-left">${H.fmt(sumBuyQty)} <small>(${H.fmt(sumBuyVal)})</small></td>
                                <td class="num text-left">${H.fmt(sumSellQty)} <small>(${H.fmt(sumSellVal)})</small></td>
                                <td class="num text-left">${H.fmt(sumBackBuyQty)}</td>
                                <td class="num text-left">${H.fmt(sumBackSellQty)}</td>
                                <td class="num text-left"><strong>${H.fmt(netQty)}</strong></td>
                                <td class="num text-left">${H.fmt(netVal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>`;
        });

        c.innerHTML = html;

        if (typeof Exporter !== 'undefined' && Exporter.attach) {
            Exporter.attach(document.getElementById('pfResult'), {
                title: byParty ? 'گروه‌بندی بر اساس طرف حساب' : 'گروه‌بندی بر اساس کالا',
                subtitle: subtitle(r),
                filename: 'PartyFactor_Grouped',
                customHtml: function () { return buildPrintGrouped(items, byParty); }
            });
        }
    }

    function renderStats(r) {
        return `
        <div class="pf-stats">
            <div class="pf-stat pf-stat-buy">
                <div class="pf-stat-label">📥 خرید</div>
                <div class="pf-stat-value">${H.fmt(r.totalBuyAmount)}</div>
                <div class="pf-stat-sub">${H.fmt(r.buyCount)} فاکتور</div>
            </div>
            <div class="pf-stat pf-stat-sell">
                <div class="pf-stat-label">📤 فروش</div>
                <div class="pf-stat-value">${H.fmt(r.totalSellAmount)}</div>
                <div class="pf-stat-sub">${H.fmt(r.sellCount)} فاکتور</div>
            </div>
            <div class="pf-stat pf-stat-backbuy">
                <div class="pf-stat-label">↩️ برگشت خرید</div>
                <div class="pf-stat-value">${H.fmt(r.totalBackBuyAmount)}</div>
                <div class="pf-stat-sub">${H.fmt(r.backBuyCount)} فاکتور</div>
            </div>
            <div class="pf-stat pf-stat-backsell">
                <div class="pf-stat-label">↪️ برگشت فروش</div>
                <div class="pf-stat-value">${H.fmt(r.totalBackSellAmount)}</div>
                <div class="pf-stat-sub">${H.fmt(r.backSellCount)} فاکتور</div>
            </div>
            <div class="pf-stat pf-stat-final">
                <div class="pf-stat-label">💰 مبلغ نهایی</div>
                <div class="pf-stat-value">${H.fmt(r.totalFinalAmount)}</div>
                <div class="pf-stat-sub">${H.fmt(r.totalCount)} فاکتور</div>
            </div>
        </div>`;
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.PartyFactor.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} فاکتور</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.PartyFactor.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.PartyFactor.goToPage(${page - 1})">‹ قبلی</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.PartyFactor.goToPage(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.PartyFactor.goToPage(${totalPages})">»</button>
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
    function buildPrintFlat(r) {
        const hasCustomer = !!r.codeTafzil;
        const header = `<table class="factor-info-table" style="margin-bottom:10px;">
            <tr>
                <td class="label">${hasCustomer ? 'طرف حساب:' : 'گزارش:'}</td>
                <td>${hasCustomer ? H.esc(r.hesabName || '-') : 'همه‌ی طرف حساب‌ها'}</td>
                ${hasCustomer ? `<td class="label">کد:</td><td>${r.codeTafzil || '-'}</td>` : ''}
                <td class="label">تعداد:</td><td>${H.fmt(r.totalCount)} فاکتور</td>
                <td class="label">مبلغ نهایی:</td><td>${H.fmt(r.totalFinalAmount)}</td>
            </tr>
        </table>`;

        const rows = (r.items || []).map((it, idx) => `<tr>
            <td class="text-center">${idx + 1}</td>
            <td class="text-center">${it.noFactor || ''}</td>
            <td class="text-center">${H.esc(it.dateIn || '')}</td>
            <td class="text-center">${H.esc(it.factorKindTitle || '')}</td>
            ${!hasCustomer ? `<td>${H.esc(it.hesabName || '')}</td>` : ''}
            <td>${H.esc(it.descript || '')}</td>
            <td class="text-center">${it.itemCount}</td>
            <td class="text-left">${H.fmt(it.totalCostItem)}</td>
            <td class="text-left">${H.fmt(it.totalDiscount)}</td>
            <td class="text-left">${H.fmt(it.totalTax)}</td>
            <td class="text-left"><strong>${H.fmt(it.finalAmount)}</strong></td>
            <td class="text-center">${it.noSanad || '-'}</td>
            <td class="text-center">${H.esc(it.isCashName || '')}</td>
        </tr>`).join('');

        return header + `<table>
            <thead><tr>
                <th>#</th><th>شماره</th><th>تاریخ</th><th>نوع</th>
                ${!hasCustomer ? '<th>طرف حساب</th>' : ''}
                <th>شرح</th><th>اقلام</th>
                <th>جمع کالاها</th><th>تخفیف</th><th>مالیات</th>
                <th>مبلغ نهایی</th><th>سند</th><th>پرداخت</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    function buildPrintGrouped(items, byParty) {
        const rows = items.map((it, idx) => `<tr>
            <td class="text-center">${idx + 1}</td>
            ${byParty
                ? `<td>${H.esc(it.articleName || '')} (${H.esc(it.articleCode || '')})</td>`
                : `<td>${H.esc(it.hesabName || '')}</td>`}
            <td class="text-center">${H.esc(it.articleUnitName || '')}</td>
            <td class="text-left">${H.fmt(it.buyQty)}</td>
            <td class="text-left">${H.fmt(it.buyAmount)}</td>
            <td class="text-left">${H.fmt(it.sellQty)}</td>
            <td class="text-left">${H.fmt(it.sellAmount)}</td>
            <td class="text-left">${H.fmt(it.netQty)}</td>
            <td class="text-left">${H.fmt(it.netAmount)}</td>
        </tr>`).join('');

        return `<table>
            <thead><tr>
                <th>#</th>
                <th>${byParty ? 'کالا' : 'طرف حساب'}</th>
                <th>واحد</th>
                <th>خرید مقدار</th><th>خرید ریال</th>
                <th>فروش مقدار</th><th>فروش ریال</th>
                <th>مانده مقدار</th><th>مانده ریال</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    function subtitle(r) {
        const u = window.App.state.user || {};
        const base = (u.orgName || '') + ' - ' + (u.fyName || '');
        return base + (r.codeTafzil ? ' | ' + (r.hesabName || '') : ' | همه‌ی طرف حساب‌ها');
    }

    return { render, runReport, goToPage };
})();

window.App.renderPartyFactor = window.App.Features.PartyFactor.render;