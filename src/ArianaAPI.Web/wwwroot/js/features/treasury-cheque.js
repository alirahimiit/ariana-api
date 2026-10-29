/* ═══════════════════════════════════════════════════════════════
   Feature / TreasuryCheque — چک پرداختی / دریافتی
   kind: 0 = پرداختی (ChequePay)   1 = دریافتی (ChequeReceive)
   ═══════════════════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.TreasuryCheque = (function () {
    'use strict';

    const H = window.App.Helpers;
    const S = window.App.State;

    // ─── State ───
    let _kind = 0;
    let _items = [];
    let _page = 1;
    let _sort = { by: 'residNumber', dir: 'desc' };
    let _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };

    // ─── Cache ───
    let _bankListCache = null;
    let _bankAccListCache = null;
    let _brunchListCache = null;
    let _noHesabListCache = null;
    let _personListCache = null;
    let _hesabTreeCache = null;
    let _hesabNameCache = { col: {}, moein: {}, tafzil: {} };

    let _payeeName = '';
    let _payableName = '';
    let _payeeSig = '';
    let _payableSig = '';

    // ─── Helpers ───
    function _isPay() { return _kind === 0; }
    function _title() { return _isPay() ? 'چک پرداختی' : 'چک دریافتی'; }
    function _icon() { return _isPay() ? '📤' : '📥'; }
    function _apiBase() { return _isPay() ? '/api/chequepay' : '/api/chequereceive'; }
    function _payeeChtType() { return _isPay() ? 19 : 18; }
    function _payableChtType() { return _isPay() ? 14 : 13; }

    // ═══════════════════════════════════════════════════════
    //  PAGE RENDER
    // ═══════════════════════════════════════════════════════
    function render(kind) {
        _kind = (kind === 1) ? 1 : 0;
        window.App.state.currentPage = _isPay() ? 'pay-cheque' : 'receive-cheque';
        _page = 1;
        _sort = { by: 'residNumber', dir: 'desc' };

        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card tq-filter-card" id="tqFilterCard">
                <div class="card-title tq-filter-toggle" id="tqFilterToggle">
                    <span>🔍 فیلترها</span>
                    <span class="tq-filter-icon">▼</span>
                </div>
                <div class="tq-filter-body" id="tqFilterBody">
                    <div class="tq-filters-grid">
                        <div class="form-group">
                            <label>از تاریخ رسید</label>
                            <input type="text" id="tqFromDate" placeholder="1404/01/01" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تا تاریخ رسید</label>
                            <input type="text" id="tqToDate" placeholder="1404/12/29" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>از شماره رسید</label>
                            <input type="number" id="tqFromNo">
                        </div>
                        <div class="form-group">
                            <label>تا شماره رسید</label>
                            <input type="number" id="tqToNo">
                        </div>
                        <div class="form-group">
                            <label>از تاریخ چک</label>
                            <input type="text" id="tqCheckFromDate" placeholder="1404/01/01" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تا تاریخ چک</label>
                            <input type="text" id="tqCheckToDate" placeholder="1404/12/29" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>از سریال چک</label>
                            <input type="text" id="tqCheckFromSerial" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تا سریال چک</label>
                            <input type="text" id="tqCheckToSerial" dir="ltr">
                        </div>
                        <div class="form-group tq-col-2">
                            <label>شرح</label>
                            <input type="text" id="tqDescript" placeholder="جستجو در شرح...">
                        </div>
                        <div class="form-group tq-col-2">
                            <label>طرف حساب</label>
                            <div class="tq-account-row">
                                <button type="button" class="btn btn-ghost btn-sm" id="tqPickAccountBtn">🏦 انتخاب</button>
                                <span id="tqAccountLabel" class="tq-account-label"></span>
                                <button type="button" class="btn btn-ghost btn-sm" id="tqClearAccountBtn" style="display:none;">✕</button>
                            </div>
                        </div>
                    </div>
                    <div class="tq-filter-actions">
                        <button class="btn btn-primary" id="tqRunBtn">🔍 جستجو</button>
                        <button class="btn btn-ghost" id="tqResetBtn">↻ پاک کردن</button>
                    </div>
                </div>
            </div>
            <div id="tqListContainer"></div>
        `;

        document.getElementById('tqRunBtn')?.addEventListener('click', () => { _page = 1; loadList(); });
        document.getElementById('tqResetBtn')?.addEventListener('click', resetFilters);
        document.getElementById('tqPickAccountBtn')?.addEventListener('click', openAccountFilterPicker);
        document.getElementById('tqClearAccountBtn')?.addEventListener('click', clearAccountFilter);

        document.getElementById('tqFilterToggle')?.addEventListener('click', () => {
            document.getElementById('tqFilterCard').classList.toggle('collapsed');
        });

        ['tqFromDate', 'tqToDate', 'tqFromNo', 'tqToNo', 'tqCheckFromDate', 'tqCheckToDate',
            'tqCheckFromSerial', 'tqCheckToSerial', 'tqDescript'].forEach(id => {
                document.getElementById(id)?.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { _page = 1; loadList(); }
                });
            });

        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(c);
        loadList();
    }

    function resetFilters() {
        ['tqFromDate', 'tqToDate', 'tqFromNo', 'tqToNo', 'tqCheckFromDate', 'tqCheckToDate',
            'tqCheckFromSerial', 'tqCheckToSerial', 'tqDescript'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
        updateAccountBar();
        _page = 1;
        loadList();
    }

    function openAccountFilterPicker() {
        window.App.UI.HesabPicker.open({
            mode: 'moein',
            title: '🔍 انتخاب حساب برای فیلتر'
        }).then(picked => {
            if (!picked) return;
            _accFilter = {
                codeCol: picked.codeCol || 0,
                codeMoein: picked.codeMoein || 0,
                codeTafzil: 0,
                label: picked.name || [picked.codeCol, picked.codeMoein].filter(x => x > 0).join(' / ')
            };
            updateAccountBar();
            _page = 1;
            loadList();
        }).catch(err => window.App.toast('خطا: ' + err.message, 'error'));
    }

    function clearAccountFilter() {
        _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
        updateAccountBar();
        _page = 1;
        loadList();
    }

    function updateAccountBar() {
        const label = document.getElementById('tqAccountLabel');
        const clear = document.getElementById('tqClearAccountBtn');
        if (!label || !clear) return;
        if (_accFilter.codeCol > 0 || _accFilter.codeTafzil > 0) {
            label.textContent = '🎯 ' + _accFilter.label;
            label.style.display = 'inline-block';
            clear.style.display = 'inline-block';
        } else {
            label.textContent = '';
            label.style.display = 'none';
            clear.style.display = 'none';
        }
    }

    // ═══════════════════════════════════════════════════════
    //  LIST
    // ═══════════════════════════════════════════════════════
    async function loadList() {
        const container = document.getElementById('tqListContainer');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const result = await window.App.Http.api(_apiBase() + '/list', {
                method: 'POST',
                body: JSON.stringify(buildFilterPayload())
            });
            _items = result.items || [];
            renderList(result);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildFilterPayload() {
        const g = id => document.getElementById(id)?.value?.trim() || null;
        const gi = id => {
            const v = document.getElementById(id)?.value;
            return v === '' || v == null ? null : parseInt(v, 10);
        };
        return {
            fromNumber: gi('tqFromNo'),
            toNumber: gi('tqToNo'),
            fromDate: g('tqFromDate'),
            toDate: g('tqToDate'),
            checkFromDate: g('tqCheckFromDate'),
            checkToDate: g('tqCheckToDate'),
            checkFromSerial: g('tqCheckFromSerial'),
            checkToSerial: g('tqCheckToSerial'),
            descript: g('tqDescript'),
            codeCol: _accFilter.codeCol || null,
            codeMoein: _accFilter.codeMoein || null,
            codeTafzil: _accFilter.codeTafzil || null,
            sortBy: _sort.by,
            sortDir: _sort.dir,
            page: _page,
            pageSize: S.getSettings().pageSize || 100
        };
    }

    function _statusBadge(it) {
        let html = '';
        if (it.chequeOK === 1) html = '<span class="tq-badge tq-badge-ok">✓ وصول</span>';
        else if (it.chequeOK === 2) html = '<span class="tq-badge tq-badge-return">↩ برگشت</span>';
        else html = '<span class="tq-badge tq-badge-pending">⏳ در جریان</span>';

        // ⭐ فقط برای دریافت: نمایش خرج‌شده
        if (!_isPay() && it.wasExpended > 0) {
            const label = it.wasExpended === 2 ? 'جریان خرج' : 'خرج‌شده';
            const cls = it.wasExpended === 2 ? 'tq-badge-pending' : 'tq-badge-info';
            html += ` <span class="tq-badge ${cls}">${label}</span>`;
        }
        return html;
    }

    function buildListCard(result) {
        const items = result?.items || [];
        const total = result?.totalCount || 0;

        let bodyHtml;
        if (items.length === 0) {
            bodyHtml = `
                <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                    <div style="font-size:56px;opacity:0.4;">${_icon()}</div>
                    <p style="margin-top:12px;">چکی یافت نشد</p>
                    <p style="margin-top:6px; font-size:12px; color:#94A3B8;">
                        برای شروع، دکمه «چک جدید» را بزنید
                    </p>
                </div>`;
        } else {
            const rows = items.map(it => {
                const noSanad = it.noSanad ? `✅ ${H.fmt(it.noSanad)}` : '🚫';
                const lock = (it.sanadVazeit === 2) ? ' 🔒' : '';
                const canEdit = it.chequeOK !== 1 && it.wasExpended === 0;
                const canDelete = it.chequeOK !== 1 && it.wasExpended === 0;
                const canOk = it.chequeOK !== 1;
                const canUnOk = it.chequeOK === 1;
                const canReturn = it.chequeOK !== 2;

                return `
                    <tr data-id="${it.id}">
                        <td class="num text-center">${H.fmt(it.residNumber)}</td>
                        <td class="num text-center">${H.esc(it.residDate || '-')}</td>
                        <td class="num text-center">${H.esc(it.checkSeries || '-')}</td>
                        <td class="num text-center">${H.esc(it.checkDate || '-')}</td>
                        <td class="tq-person">${H.esc(it.checkPerson || '-')}</td>
                        <td class="num text-left"><strong>${H.fmt(it.checkMab)}</strong></td>
                        <td>${H.esc(it.bankName || '-')}</td>
                        <td class="text-center">${H.esc(_isPay() ? (it.bankShobe || '-') : (it.bankBrunch || '-'))}</td>
                        <td class="text-center">${_statusBadge(it)}</td>
                        <td class="text-center">${noSanad}${lock}</td>
                        <td class="text-center tq-actions">
                            <button class="btn btn-sm btn-ghost" title="ویرایش"
                                    onclick="event.stopPropagation();App.Features.TreasuryCheque.openForm(${it.id})"
                                    data-permission="${_isPay() ? 138 : 141}" ${canEdit ? '' : 'disabled'}>✏️</button>
                            <button class="btn btn-sm btn-ghost" title="اعلام"
                                    onclick="event.stopPropagation();App.Features.TreasuryCheque.openOkModal(${it.id})"
                                    data-permission="${_isPay() ? 127 : 129}" ${canOk ? '' : 'disabled'}>✓</button>
                            <button class="btn btn-sm btn-ghost" title="لغو اعلام"
                                    onclick="event.stopPropagation();App.Features.TreasuryCheque.doUnOk(${it.id})"
                                    data-permission="${_isPay() ? 128 : 130}" ${canUnOk ? '' : 'disabled'}>↺</button>
                            <button class="btn btn-sm btn-ghost" title="برگشت"
                                    onclick="event.stopPropagation();App.Features.TreasuryCheque.doReturn(${it.id})"
                                    data-permission="${_isPay() ? 133 : 132}" ${canReturn ? '' : 'disabled'}>↩</button>
                            <button class="btn btn-sm btn-ghost" title="حذف"
                                    onclick="event.stopPropagation();App.Features.TreasuryCheque.removeItem(${it.id})"
                                    style="color:var(--danger);"
                                    data-permission="${_isPay() ? 139 : 142}" ${canDelete ? '' : 'disabled'}>🗑️</button>
                        </td>
                    </tr>`;
            }).join('');

            const thSort = (key, label, extraStyle = '') => {
                const active = _sort.by === key;
                const arrow = active ? (_sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
                const cls = active ? 'sortable-th sort-active' : 'sortable-th';
                return `<th class="${cls}" data-sort-key="${key}" style="cursor:pointer;${extraStyle}">${label}${arrow}</th>`;
            };

            bodyHtml = `
                <div class="table-wrapper">
                    <table class="tq-table">
                        <thead>
                            <tr>
                                ${thSort('residNumber', 'ش.رسید', 'width:70px;')}
                                ${thSort('residDate', 'ت.رسید', 'width:90px;')}
                                ${thSort('checkSeries', 'سریال چک', 'width:90px;')}
                                ${thSort('checkDate', 'ت.چک', 'width:90px;')}
                                ${thSort('checkPerson', 'در وجه')}
                                ${thSort('checkMab', 'مبلغ', 'width:110px;')}
                                ${thSort('bankName', 'بانک', 'width:100px;')}
                                ${thSort(_isPay() ? 'bankShobe' : 'bankBrunch', 'شعبه', 'width:80px;')}
                                <th style="width:90px;">وضعیت</th>
                                <th style="width:80px;">سند</th>
                                <th style="width:170px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div id="tqPagination"></div>`;
        }

        return `
            <div class="card">
                <div class="card-title">
                    <span>${_icon()} لیست ${_title()} (${H.fmt(total)})</span>
                    <button class="btn btn-primary btn-sm" data-permission="${_isPay() ? 137 : 140}" id="tqNewBtn">
                        ➕ چک جدید
                    </button>
                </div>
                ${bodyHtml}
            </div>
        `;
    }

    function renderList(result) {
        const container = document.getElementById('tqListContainer');
        container.innerHTML = buildListCard(result);

        document.getElementById('tqNewBtn')?.addEventListener('click', () => openForm(null));

        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(container);

        // Sort handler
        container.querySelectorAll('th[data-sort-key]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                const newDir = (_sort.by === key && _sort.dir === 'asc') ? 'desc' : 'asc';
                _sort = { by: key, dir: newDir };
                _page = 1;
                loadList();
            });
        });

        // Pagination
        const total = result.totalCount || 0;
        const pageSize = result.pageSize || 100;
        const page = result.page || 1;
        const totalPages = Math.ceil(total / pageSize);
        if (totalPages > 1) {
            const pgEl = document.getElementById('tqPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(page, totalPages, total, (result.items || []).length);
        }

        // Export / Print / Excel
        const items = result.items || [];
        if (items.length > 0 && typeof Exporter !== 'undefined' && Exporter.attach) {
            Exporter.attach(container, {
                title: `لیست ${_title()}`,
                subtitle: subtitle(),
                filename: _isPay() ? 'ChequePay' : 'ChequeReceive',
                getFullTable: async () => {
                    const payload = buildFilterPayload();
                    payload.page = 1;
                    payload.pageSize = 100000;
                    const full = await window.App.Http.api(_apiBase() + '/list', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    return buildChequeTableHtml(full.items || []);
                }
            });
        }
    }

    function buildChequeTableHtml(items) {
        let rows = '';
        items.forEach((it, idx) => {
            let status = 'در جریان';
            if (it.chequeOK === 1) status = 'وصول‌شده';
            else if (it.chequeOK === 2) status = 'برگشتی';

            let expText = '—';
            if (!_isPay()) {
                if (it.wasExpended === 1) expText = 'خرج‌شده';
                else if (it.wasExpended === 2) expText = 'در جریان خرج';
                else expText = 'خرج نشده';
            }

            rows += '<tr>' +
                '<td>' + (idx + 1) + '</td>' +
                '<td>' + (it.residNumber || '') + '</td>' +
                '<td>' + (it.residDate || '') + '</td>' +
                '<td>' + (it.checkSeries || '') + '</td>' +
                '<td>' + (it.checkDate || '') + '</td>' +
                '<td>' + H.esc(it.checkPerson || '') + '</td>' +
                '<td>' + H.fmtT(it.checkMab) + '</td>' +
                '<td>' + H.esc(it.bankName || '') + '</td>' +
                '<td>' + H.esc(_isPay() ? (it.bankShobe || '') : (it.bankBrunch || '')) + '</td>' +
                (!_isPay() ? '<td>' + H.esc(it.noHesabCheck || '') + '</td>' : '') +
                '<td>' + status + '</td>' +
                (!_isPay() ? '<td>' + expText + '</td>' : '') +
                '<td>' + (it.noSanad ? it.noSanad : '—') + '</td>' +
                '<td>' + H.esc(it.colName || '') + '</td>' +
                '<td>' + H.esc(it.moeinName || '') + '</td>' +
                '<td>' + H.esc(it.tafzilName || '') + '</td>' +
                '</tr>';
        });

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>شماره رسید</th>
                    <th>تاریخ رسید</th>
                    <th>سریال چک</th>
                    <th>تاریخ چک</th>
                    <th>در وجه</th>
                    <th>مبلغ</th>
                    <th>بانک</th>
                    <th>شعبه</th>
                    ${!_isPay() ? '<th>شماره حساب</th>' : ''}
                    <th>وضعیت</th>
                    ${!_isPay() ? '<th>خرج چک</th>' : ''}
                    <th>شماره سند</th>
                    <th>نام کل</th>
                    <th>نام معین</th>
                    <th>نام تفصیلی</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        `;
        return table;
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.TreasuryCheque.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)}</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryCheque.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryCheque.goToPage(${page - 1})">‹</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryCheque.goToPage(${page + 1})">›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryCheque.goToPage(${totalPages})">»</button>
            </div>
        </div>`;
    }

    function goToPage(p) {
        _page = p;
        loadList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════════════════
    //  DATA LOADERS
    // ═══════════════════════════════════════════════════════
    async function loadBankAccList() {
        if (_bankAccListCache) return _bankAccListCache;
        try {
            const res = await window.App.Http.api('/api/bank/acc/list', {   // ⭐ اصلاح شد
                method: 'POST',
                body: JSON.stringify({ bankId: null, search: null, page: 1, pageSize: 1000 })
            });
            _bankAccListCache = res?.items || [];
        } catch (e) { _bankAccListCache = []; }
        return _bankAccListCache;
    }

    async function loadBankList() {
        if (_bankListCache) return _bankListCache;
        try {
            _bankListCache = await window.App.Http.api('/api/bank/list') || [];
        } catch (e) { _bankListCache = []; }
        return _bankListCache;
    }

    async function loadBrunchList() {
        if (_brunchListCache) return _brunchListCache;
        try {
            _brunchListCache = await window.App.Http.api(`${_apiBase()}/brunch-list`) || [];
        } catch (e) { _brunchListCache = []; }
        return _brunchListCache;
    }

    async function loadNoHesabList() {
        if (_noHesabListCache) return _noHesabListCache;
        try {
            _noHesabListCache = await window.App.Http.api(`${_apiBase()}/nohesab-list`) || [];
        } catch (e) { _noHesabListCache = []; }
        return _noHesabListCache;
    }

    async function loadPersonList() {
        if (_personListCache) return _personListCache;
        try {
            _personListCache = await window.App.Http.api(`${_apiBase()}/persons`) || [];
        } catch (e) { _personListCache = []; }
        return _personListCache;
    }

    async function loadHesabTree() {
        if (_hesabTreeCache) return _hesabTreeCache;
        try { _hesabTreeCache = await window.App.Http.api('/api/hesab/tree') || []; }
        catch (e) { _hesabTreeCache = []; }
        return _hesabTreeCache;
    }

    async function resolveHesabName(c, m, t) {
        const tree = await loadHesabTree();
        const parts = [];
        if (c > 0) {
            if (_hesabNameCache.col[c] === undefined) {
                const item = tree.find(x => x.level === 'col' && x.codeCol === c);
                _hesabNameCache.col[c] = item?.name || '';
            }
            if (_hesabNameCache.col[c]) parts.push(_hesabNameCache.col[c]);
        }
        if (c > 0 && m > 0) {
            const key = `${c}_${m}`;
            if (_hesabNameCache.moein[key] === undefined) {
                const item = tree.find(x => x.level === 'moein' && x.codeCol === c && x.codeMoein === m);
                _hesabNameCache.moein[key] = item?.name || '';
            }
            if (_hesabNameCache.moein[key]) parts.push(_hesabNameCache.moein[key]);
        }
        if (t > 0) {
            if (_hesabNameCache.tafzil[t] === undefined) {
                const item = tree.find(x =>
                    (x.level === 'tafzil' || x.level === 'tafzili') &&
                    (x.codeTafzil === t || x.codeTafzili === t));
                _hesabNameCache.tafzil[t] = item?.name || '';
            }
            if (_hesabNameCache.tafzil[t]) parts.push(_hesabNameCache.tafzil[t]);
        }
        return parts.length > 0 ? parts.join(' - ') : '';
    }

    async function loadConstHesab(type) {
        try {
            const list = await window.App.Http.api('/api/const-hesab/list');
            return list.find(x => x.type === type && x.isSet);
        } catch (e) { return null; }
    }

    // ═══════════════════════════════════════════════════════
    //  FORM — Create / Edit
    // ═══════════════════════════════════════════════════════
    async function openForm(id) {
        let data = null;
        let isEdit = false;

        if (id) {
            isEdit = true;
            try {
                data = await window.App.Http.api(`${_apiBase()}/${id}`);
                if (!data) { window.App.toast('چک یافت نشد', 'error'); return; }
                if (data.sanadVazeit === 2) {
                    window.App.toast('سند قطعی است و قابل ویرایش نیست', 'warning');
                    return;
                }
            } catch (err) {
                window.App.toast('خطا: ' + err.message, 'error'); return;
            }
        } else {
            try {
                const nr = await window.App.Http.api(`${_apiBase()}/next-number`);
                data = { residNumber: nr.residNumber, residDate: H.todayPersian ? H.todayPersian() : '' };
            } catch (e) {
                data = { residNumber: 0, residDate: '' };
            }
        }

        let sanadList = [];
        try { sanadList = await window.App.Http.api(`${_apiBase()}/sanad-list`); }
        catch (e) { sanadList = []; }

        const bankAccList = _isPay() ? await loadBankAccList() : [];
        const bankList = _isPay() ? [] : await loadBankList();
        const brunchList = _isPay() ? [] : await loadBrunchList();
        const noHesabList = _isPay() ? [] : await loadNoHesabList();
        const personList = await loadPersonList();

        _payeeName = '';
        _payableName = '';
        _payeeSig = '';
        _payableSig = '';

        window.App.openModal(
            `${_icon()} ${isEdit ? 'ویرایش' : 'چک جدید'} — ${_title()}`,
            buildFormHtml(data, isEdit, sanadList, bankAccList, bankList, brunchList, noHesabList, personList)
        );

        if (isEdit && data) {
            if (data.codeCol || data.codeTafzil) {
                _payeeName = await resolveHesabName(data.codeCol, data.codeMoein, data.codeTafzil);
                _payeeSig = `${data.codeCol}_${data.codeMoein}_${data.codeTafzil}`;
            }
            if (data.codeColPay || data.codeTafzilPay) {
                _payableName = await resolveHesabName(data.codeColPay, data.codeMoeinPay, data.codeTafzilPay);
                _payableSig = `${data.codeColPay}_${data.codeMoeinPay}_${data.codeTafzilPay}`;
            }
        }

        bindFormEvents(data, isEdit);
    }

    function buildFormHtml(data, isEdit, sanadList, bankAccList, bankList, brunchList, noHesabList, personList) {
        // ─── بانک: Pay → BankAcc, Receive → Bank + متن آزاد ───
        let bankSectionHtml;
        if (_isPay()) {
            const bankAccOptions = ['<option value="">— انتخاب حساب بانکی —</option>']
                .concat((bankAccList || []).map(b =>
                    `<option value="${b.id}" ${b.id === data.bankAccId ? 'selected' : ''}>
                        ${H.esc((b.bankName || '') + ' / ' + (b.shobe || '') + ' / ' + (b.noHesab || ''))}
                    </option>`)).join('');
            bankSectionHtml = `
                <div class="form-group tq-col-2">
                    <label>شماره حساب بانکی <span class="req">*</span></label>
                    <select id="tqfBankAccId" class="tq-select">${bankAccOptions}</select>
                </div>`;
        } else {
            const bankOptions = ['<option value="">— انتخاب بانک —</option>']
                .concat((bankList || []).map(b =>
                    `<option value="${b.id}" ${b.id === data.bankId ? 'selected' : ''}>
                        ${H.esc(b.name || '')}
                    </option>`)).join('');
            const brunchOpts = (brunchList || []).map(x => `<option value="${H.esc(x)}"></option>`).join('');
            const noHesabOpts = (noHesabList || []).map(x => `<option value="${H.esc(x)}"></option>`).join('');
            bankSectionHtml = `
                <div class="form-group">
                    <label>بانک <span class="req">*</span></label>
                    <select id="tqfBankId" class="tq-select">${bankOptions}</select>
                </div>
                <div class="form-group">
                    <label>شعبه</label>
                    <input type="text" id="tqfBankBrunch" value="${H.esc(data.bankBrunch || '')}" list="tqfBrunchList" maxlength="50">
                    <datalist id="tqfBrunchList">${brunchOpts}</datalist>
                </div>
                <div class="form-group tq-col-2">
                    <label>شماره حساب بانکی</label>
                    <input type="text" id="tqfNoHesabCheck" value="${H.esc(data.noHesabCheck || '')}" list="tqfNoHesabList" maxlength="50" dir="ltr">
                    <datalist id="tqfNoHesabList">${noHesabOpts}</datalist>
                </div>`;
        }

        const personDatalist = (personList || []).map(p => `<option value="${H.esc(p)}"></option>`).join('');

        const sanadOptions = ['<option value="">— بدون سند —</option>']
            .concat((sanadList || []).map(s =>
                `<option value="${s.parentSanadID}" ${s.parentSanadID === data.parentSanadId ? 'selected' : ''}>
                   ${H.fmt(s.noSanad)} — ${H.esc(s.dateIn || '')} — ${H.esc((s.sharh || '').substring(0, 30))}
                </option>`)).join('');

        const hasSanad = (data.parentSanadId || 0) > 0;
        const mabStr = (parseFloat(data.checkMab) > 0)
            ? parseFloat(data.checkMab).toLocaleString('en-US') : '';

        const payeeTitle = _isPay() ? 'شماره حساب دریافت‌کننده (بدهکار)' : 'شماره حساب پرداخت‌کننده (بستانکار)';
        const payableTitle = _isPay() ? 'نام حساب اسناد پرداختنی (بستانکار)' : 'نام حساب اسناد دریافتنی (بدهکار)';

        return `
            <div class="tq-form" data-help="treasury-cheque-form">
                <div class="tq-form-section">
                    <div class="tq-form-section-title">📋 مشخصات چک</div>
                    <div class="tq-form-grid">
                        ${bankSectionHtml}
                        <div class="form-group">
                            <label>شماره سریال چک</label>
                            <input type="text" id="tqfCheckSeries" value="${H.esc(data.checkSeries || '')}" dir="ltr" maxlength="50">
                        </div>
                        <div class="form-group">
                            <label>تاریخ چک <span class="req">*</span></label>
                            <input type="text" id="tqfCheckDate" value="${H.esc(data.checkDate || '')}" dir="ltr" placeholder="1404/01/01">
                        </div>
                        <div class="form-group">
                            <label>در وجه</label>
                            <input type="text" id="tqfCheckPerson" value="${H.esc(data.checkPerson || '')}" list="tqfPersonList" maxlength="50">
                            <datalist id="tqfPersonList">${personDatalist}</datalist>
                        </div>
                        <div class="form-group">
                            <label>مبلغ <span class="req">*</span></label>
                            <input type="text" id="tqfCheckMab" value="${mabStr}" class="num-input tq-amount-input" dir="ltr">
                            <div class="tq-amount-words" id="tqfAmountWords"></div>
                        </div>
                    </div>
                </div>

                <div class="tq-form-section">
                    <div class="tq-form-section-title">📄 مشخصات رسید</div>
                    <div class="tq-form-grid">
                        <div class="form-group">
                            <label>شماره رسید <span class="req">*</span></label>
                            <input type="number" id="tqfResidNumber" value="${data.residNumber || ''}" class="num-input" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تاریخ رسید <span class="req">*</span></label>
                            <input type="text" id="tqfResidDate" value="${H.esc(data.residDate || '')}" dir="ltr" placeholder="1404/01/01">
                        </div>
                        <div class="form-group tq-col-2">
                            <label>شرح</label>
                            <input type="text" id="tqfResidDes" value="${H.esc(data.residDes || '')}" maxlength="200">
                        </div>
                    </div>
                </div>

                <div class="tq-form-section">
                    <div class="tq-form-section-title">
                        👤 ${payeeTitle}
                        <button type="button" class="btn btn-ghost btn-sm tq-def-btn" id="tqfPayeeDefaultBtn" title="F3">⚙️</button>
                    </div>
                    <div class="tq-hesab-row">
                        ${hesabFieldHtml('Payee', 'col', data.codeCol)}
                        ${hesabFieldHtml('Payee', 'moein', data.codeMoein)}
                        ${hesabFieldHtml('Payee', 'tafzil', data.codeTafzil)}
                    </div>
                    <div class="tq-hesab-preview" id="tqfPayeeName">—</div>
                </div>

                <div class="tq-form-section">
                    <div class="tq-form-section-title">
                        💼 ${payableTitle}
                        <button type="button" class="btn btn-ghost btn-sm tq-def-btn" id="tqfPayableDefaultBtn" title="F5">⚙️</button>
                    </div>
                    <div class="tq-hesab-row">
                        ${hesabFieldHtml('Payable', 'col', data.codeColPay)}
                        ${hesabFieldHtml('Payable', 'moein', data.codeMoeinPay)}
                        ${hesabFieldHtml('Payable', 'tafzil', data.codeTafzilPay)}
                    </div>
                    <div class="tq-hesab-preview" id="tqfPayableName">—</div>
                </div>

                <div class="tq-form-section">
                    <div class="tq-form-section-title">🧾 سند حسابداری</div>
                    <div class="tq-sanad-row">
                        <label class="tq-checkbox-label">
                            <input type="checkbox" id="tqfSaveSanad" ${hasSanad || !isEdit ? 'checked' : ''}>
                            <span>صدور سند انجام شود</span>
                        </label>
                        <div class="tq-sanad-combo-wrap">
                            <label>شماره سند</label>
                            <select id="tqfParentSanadId" class="tq-select">${sanadOptions}</select>
                        </div>
                    </div>
                    <p class="tq-hint">⚙️ حساب‌های پیش‌فرض از «حساب‌های پیش‌فرض» خوانده می‌شوند.</p>
                </div>

                <div class="tq-form-footer">
                    <button class="btn btn-primary" id="tqfSaveBtn">💾 ذخیره (F2)</button>
                    <button class="btn btn-ghost" id="tqfCancelBtn">انصراف (Esc)</button>
                </div>
            </div>
        `;
    }

    function hesabFieldHtml(prefix, level, value) {
        const labels = { col: 'کد کل', moein: 'کد معین', tafzil: 'کد تفصیلی' };
        const ph = { col: 'مثلاً 302', moein: 'مثلاً 5', tafzil: 'مثلاً 1034' };
        const id = `tqf${prefix}${level.charAt(0).toUpperCase() + level.slice(1)}`;
        return `
            <div class="tq-hesab-field">
                <label>${labels[level]}</label>
                <div class="tq-hesab-input">
                    <input type="number" id="${id}" value="${value || ''}" class="num-input" dir="ltr" placeholder="${ph[level]}">
                    <button type="button" class="btn btn-ghost btn-sm tq-pick-h"
                            data-prefix="${prefix}" data-level="${level}" title="انتخاب">🏦</button>
                </div>
            </div>`;
    }

    let _formKeyHandler = null;

    function bindFormEvents(data, isEdit) {
        // مبلغ
        const costInput = document.getElementById('tqfCheckMab');
        costInput?.addEventListener('input', function () {
            const digits = this.value.replace(/[^\d]/g, '');
            const numVal = digits ? parseInt(digits, 10) : 0;
            const formatted = numVal > 0 ? numVal.toLocaleString('en-US') : '';
            this.value = formatted;
            try { this.setSelectionRange(formatted.length, formatted.length); } catch { }
            const el = document.getElementById('tqfAmountWords');
            if (el) el.textContent = numVal > 0 ? H.toPersianWords(numVal) : '';
        });
        if (costInput && costInput.value.trim()) costInput.dispatchEvent(new Event('input'));

        async function refreshPayeeName() {
            const c = parseInt(document.getElementById('tqfPayeeCol')?.value) || 0;
            const m = parseInt(document.getElementById('tqfPayeeMoein')?.value) || 0;
            const t = parseInt(document.getElementById('tqfPayeeTafzil')?.value) || 0;
            const el = document.getElementById('tqfPayeeName');
            if (!el) return;
            if (c <= 0 && t <= 0) { el.textContent = '—'; return; }
            const sig = `${c}_${m}_${t}`;
            if (_payeeName && _payeeSig === sig) { el.textContent = _payeeName; return; }
            const name = await resolveHesabName(c, m, t);
            el.textContent = name || `${c}${m > 0 ? ' / ' + m : ''}${t > 0 ? ' / ' + t : ''}`;
        }

        async function refreshPayableName() {
            const c = parseInt(document.getElementById('tqfPayableCol')?.value) || 0;
            const m = parseInt(document.getElementById('tqfPayableMoein')?.value) || 0;
            const t = parseInt(document.getElementById('tqfPayableTafzil')?.value) || 0;
            const el = document.getElementById('tqfPayableName');
            if (!el) return;
            if (c <= 0 && t <= 0) { el.textContent = '—'; return; }
            const sig = `${c}_${m}_${t}`;
            if (_payableName && _payableSig === sig) { el.textContent = _payableName; return; }
            const name = await resolveHesabName(c, m, t);
            el.textContent = name || `${c}${m > 0 ? ' / ' + m : ''}${t > 0 ? ' / ' + t : ''}`;
        }

        ['Payee', 'Payable'].forEach(prefix => {
            ['Col', 'Moein', 'Tafzil'].forEach(lvl => {
                document.getElementById(`tqf${prefix}${lvl}`)?.addEventListener('blur', () => {
                    if (prefix === 'Payee') refreshPayeeName(); else refreshPayableName();
                });
            });
        });

        if (data.codeCol || data.codeTafzil) refreshPayeeName();
        if (data.codeColPay || data.codeTafzilPay) refreshPayableName();

        // Picker
        document.querySelectorAll('.tq-pick-h').forEach(btn => {
            btn.addEventListener('click', async () => {
                const prefix = btn.dataset.prefix;
                const level = btn.dataset.level;
                try {
                    let result = null;
                    if (level === 'col') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'col', title: '🔍 انتخاب کد کل' });
                        if (!result) return;
                        document.getElementById(`tqf${prefix}Col`).value = result.codeCol || 0;
                    } else if (level === 'moein') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'moein', title: '🔍 انتخاب کد معین' });
                        if (!result) return;
                        document.getElementById(`tqf${prefix}Col`).value = result.codeCol || 0;
                        document.getElementById(`tqf${prefix}Moein`).value = result.codeMoein || 0;
                    } else if (level === 'tafzil') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'tafzil', title: '🔍 انتخاب کد تفصیلی' });
                        if (!result) return;
                        document.getElementById(`tqf${prefix}Tafzil`).value = result.codeTafzil || 0;
                    }

                    const c = parseInt(document.getElementById(`tqf${prefix}Col`)?.value) || 0;
                    const m = parseInt(document.getElementById(`tqf${prefix}Moein`)?.value) || 0;
                    const t = parseInt(document.getElementById(`tqf${prefix}Tafzil`)?.value) || 0;
                    const sig = `${c}_${m}_${t}`;
                    if (prefix === 'Payee') { _payeeName = result.name || ''; _payeeSig = sig; }
                    else { _payableName = result.name || ''; _payableSig = sig; }

                    if (prefix === 'Payee') await refreshPayeeName(); else await refreshPayableName();
                } catch (err) {
                    window.App.toast('خطا در انتخاب: ' + err.message, 'error');
                }
            });
        });

        // F3 / F5 پیش‌فرض
        document.getElementById('tqfPayeeDefaultBtn')?.addEventListener('click', async () => {
            try {
                const ch = await loadConstHesab(_payeeChtType());
                if (!ch) {
                    await window.App.alert.warning(
                        `حساب «${_isPay() ? 'بستانکاران' : 'بدهکاران'}» در «حساب‌های پیش‌فرض» تعریف نشده است`,
                        { title: 'یافت نشد' });
                    return;
                }
                document.getElementById('tqfPayeeCol').value = ch.codeCol || 0;
                document.getElementById('tqfPayeeMoein').value = ch.codeMoein || 0;
                document.getElementById('tqfPayeeTafzil').value = ch.codeTafzil || 0;
                _payeeName = ch.hesabName || ch.colName || '';
                _payeeSig = `${ch.codeCol}_${ch.codeMoein}_${ch.codeTafzil}`;
                await refreshPayeeName();
            } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
        });

        document.getElementById('tqfPayableDefaultBtn')?.addEventListener('click', async () => {
            try {
                const ch = await loadConstHesab(_payableChtType());
                if (!ch) {
                    await window.App.alert.warning(
                        `حساب «${_isPay() ? 'اسناد پرداختنی' : 'اسناد دریافتنی'}» در «حساب‌های پیش‌فرض» تعریف نشده است`,
                        { title: 'یافت نشد' });
                    return;
                }
                document.getElementById('tqfPayableCol').value = ch.codeCol || 0;
                document.getElementById('tqfPayableMoein').value = ch.codeMoein || 0;
                document.getElementById('tqfPayableTafzil').value = ch.codeTafzil || 0;
                _payableName = ch.hesabName || ch.colName || '';
                _payableSig = `${ch.codeCol}_${ch.codeMoein}_${ch.codeTafzil}`;
                await refreshPayableName();
            } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
        });

        // سند
        const cb = document.getElementById('tqfSaveSanad');
        const combo = document.getElementById('tqfParentSanadId');
        cb?.addEventListener('change', () => {
            combo.disabled = !cb.checked;
            if (!cb.checked) combo.value = '';
        });
        if (cb && !cb.checked) combo.disabled = true;

        document.getElementById('tqfSaveBtn')?.addEventListener('click', () => saveForm(data, isEdit));
        document.getElementById('tqfCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        if (_formKeyHandler) document.removeEventListener('keydown', _formKeyHandler);
        _formKeyHandler = (e) => {
            if (document.getElementById('tqOkOverlay')) return;
            if (e.key === 'F2') { e.preventDefault(); saveForm(data, isEdit); }
            else if (e.key === 'Escape') { e.preventDefault(); window.App.closeModal(); }
            else if (e.key === 'F3') { e.preventDefault(); document.getElementById('tqfPayeeDefaultBtn')?.click(); }
            else if (e.key === 'F5') { e.preventDefault(); document.getElementById('tqfPayableDefaultBtn')?.click(); }
        };
        document.addEventListener('keydown', _formKeyHandler);
    }

    async function saveForm(oldData, isEdit) {
        const g = id => document.getElementById(id);
        const gi = id => parseInt(g(id)?.value) || 0;
        const gs = id => g(id)?.value?.trim() || '';

        const checkSeries = gs('tqfCheckSeries');
        const checkDate = gs('tqfCheckDate');
        const checkPerson = gs('tqfCheckPerson');
        const checkMab = H.parseNumber(g('tqfCheckMab')?.value) || 0;
        const residNumber = gi('tqfResidNumber') || null;
        const residDate = gs('tqfResidDate');
        const residDes = gs('tqfResidDes');

        const pCol = gi('tqfPayeeCol');
        const pMoein = gi('tqfPayeeMoein');
        const pTafzil = gi('tqfPayeeTafzil');

        const saveWithSanad = g('tqfSaveSanad')?.checked || false;
        const parentSanadId = saveWithSanad ? (parseInt(g('tqfParentSanadId')?.value) || 0) : 0;

        // ─── Payload شرطی ───
        const payload = {
            checkSeries, checkPerson, checkMab,
            residNumber, residDate, residDes,
            codeCol: pCol, codeMoein: pMoein, codeTafzil: pTafzil,
            saveWithSanad,
            parentSanadId: parentSanadId || null,
            noSanad: null
        };

        if (_isPay()) {
            payload.bankAccId = parseInt(g('tqfBankAccId')?.value) || 0;
            if (payload.bankAccId <= 0) { window.App.toast('حساب بانکی الزامی است', 'error'); return; }
        } else {
            payload.bankId = parseInt(g('tqfBankId')?.value) || 0;
            payload.bankBrunch = gs('tqfBankBrunch');
            payload.noHesabCheck = gs('tqfNoHesabCheck');
            if (payload.bankId <= 0) { window.App.toast('بانک الزامی است', 'error'); return; }
        }

        // اعتبارسنجی
        if (!checkDate) { window.App.toast('تاریخ چک الزامی است', 'error'); g('tqfCheckDate')?.focus(); return; }
        if (checkMab <= 0) { window.App.toast('مبلغ چک الزامی است', 'error'); return; }
        if (pCol <= 0) { window.App.toast('کد کل طرف حساب الزامی است', 'error'); return; }
        if (!residDate) { window.App.toast('تاریخ رسید الزامی است', 'error'); g('tqfResidDate')?.focus(); return; }

        const normDate = (s) => {
            if (!s) return '';
            const n = s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
            if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(n)) return null;
            return n;
        };
        const nd1 = normDate(checkDate); if (!nd1) { window.App.toast('فرمت تاریخ چک صحیح نیست', 'error'); return; }
        const nd2 = normDate(residDate); if (!nd2) { window.App.toast('فرمت تاریخ رسید صحیح نیست', 'error'); return; }
        payload.checkDate = nd1;
        payload.residDate = nd2;

        const btn = g('tqfSaveBtn');
        const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '⏳ در حال ذخیره...';

        try {
            if (isEdit) {
                payload.id = oldData.id;
                await window.App.Http.api(`${_apiBase()}/${oldData.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                    successMsg: 'چک ویرایش شد'
                });
            } else {
                await window.App.Http.api(_apiBase(), {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    successMsg: 'چک جدید ثبت شد'
                });
            }

            if (_formKeyHandler) { document.removeEventListener('keydown', _formKeyHandler); _formKeyHandler = null; }
            window.App.closeModal();
            loadList();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            btn.disabled = false; btn.innerHTML = orig;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  OK MODAL
    // ═══════════════════════════════════════════════════════
    async function openOkModal(id) {
        let data;
        try {
            data = await window.App.Http.api(`${_apiBase()}/${id}`);
            if (!data) { window.App.toast('چک یافت نشد', 'error'); return; }
            if (data.chequeOK === 1) { window.App.toast('این چک قبلاً اعلام وصول شده', 'warning'); return; }
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error'); return;
        }

        let sanadList = [];
        try { sanadList = await window.App.Http.api(`${_apiBase()}/sanad-list`); }
        catch (e) { sanadList = []; }

        const bankAccList = await loadBankAccList();

        _payeeName = '';
        _payableName = '';
        _payeeSig = '';
        _payableSig = '';

        const overlay = document.createElement('div');
        overlay.id = 'tqOkOverlay';
        overlay.className = 'tq-ok-overlay';
        overlay.innerHTML = buildOkModalHtml(data, sanadList, bankAccList);
        document.body.appendChild(overlay);

        bindOkModalEvents(data);
    }

    function buildOkModalHtml(data, sanadList, bankAccList) {
        const bankAccOptions = ['<option value="">— انتخاب حساب —</option>']
            .concat((bankAccList || []).map(b =>
                `<option value="${b.id}" ${b.id === data.bankAccId ? 'selected' : ''}>
                    ${H.esc((b.bankName || '') + ' / ' + (b.shobe || '') + ' / ' + (b.noHesab || ''))}
                </option>`)).join('');

        const sanadOptions = ['<option value="">— بدون سند —</option>']
            .concat((sanadList || []).map(s =>
                `<option value="${s.parentSanadID}" ${s.parentSanadID === data.parentSanadOkId ? 'selected' : ''}>
                    ${H.fmt(s.noSanad)} — ${H.esc(s.dateIn || '')} — ${H.esc((s.sharh || '').substring(0, 30))}
                </option>`)).join('');

        const hasSanad = (data.parentSanadOkId || 0) > 0;

        const payeeTitle = _isPay() ? '🏦 حساب بانک مربوطه (F3)' : '💵 حساب صندوق (F3)';
        const payableTitle = _isPay() ? '💼 حساب اسناد پرداختنی (F5)' : '💼 حساب اسناد دریافتنی (F5)';

        return `
            <div class="tq-ok-box">
                <div class="tq-ok-header">
                    <span>✓ اعلام ${_isPay() ? 'پرداخت' : 'وصول'} — ${_title()}</span>
                    <button type="button" class="tq-ok-close" data-ok-close>✕</button>
                </div>
                <div class="tq-ok-body">
                    <div class="tq-form-section">
                        <div class="tq-form-grid">
                            <div class="form-group">
                                <label>تاریخ وصول <span class="req">*</span></label>
                                <input type="text" id="tqoOkDate" value="${H.esc(data.okDate || (H.todayPersian ? H.todayPersian() : ''))}" dir="ltr" placeholder="1404/01/01">
                            </div>
                            <div class="form-group">
                                <label>شماره رسید</label>
                                <input type="text" value="${H.fmt(data.residNumber || '')}" disabled>
                            </div>
                            <div class="form-group tq-col-2">
                                <label>مبلغ</label>
                                <input type="text" value="${H.fmt(data.checkMab || 0)}" disabled>
                            </div>
                        </div>
                    </div>

                    ${_isPay() ? `
                        <div class="tq-form-section">
                            <div class="tq-form-section-title">${payeeTitle}
                                <button type="button" class="btn btn-ghost btn-sm tq-def-btn" id="tqoBankAccBtn">⚙️</button>
                            </div>
                            <div class="tq-form-grid">
                                <div class="form-group tq-col-2">
                                    <label>شماره حساب بانکی</label>
                                    <select id="tqoBankAccId" class="tq-select">${bankAccOptions}</select>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="tq-form-section">
                        <div class="tq-form-section-title">
                            ${payableTitle}
                            <button type="button" class="btn btn-ghost btn-sm tq-def-btn" id="tqoPayableDefaultBtn">⚙️</button>
                        </div>
                        <div class="tq-hesab-row">
                            ${hesabFieldHtml('OkPayable', 'col', data.codeColPayOk)}
                            ${hesabFieldHtml('OkPayable', 'moein', data.codeMoeinPayOk)}
                            ${hesabFieldHtml('OkPayable', 'tafzil', data.codeTafzilPayOk)}
                        </div>
                        <div class="tq-hesab-preview" id="tqoPayableName">—</div>
                    </div>

                    <div class="tq-form-section">
                        <div class="tq-form-section-title">🧾 سند اعلام</div>
                        <div class="tq-sanad-row">
                            <label class="tq-checkbox-label">
                                <input type="checkbox" id="tqoSaveSanad" ${hasSanad || !data.parentSanadOkId ? 'checked' : ''}>
                                <span>صدور سند انجام شود</span>
                            </label>
                            <div class="tq-sanad-combo-wrap">
                                <label>شماره سند</label>
                                <select id="tqoParentSanadOkId" class="tq-select">${sanadOptions}</select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tq-ok-footer">
                    <button class="btn btn-primary" id="tqoSaveBtn">✓ تأیید اعلام (F2)</button>
                    <button class="btn btn-ghost" data-ok-close>انصراف (Esc)</button>
                </div>
            </div>
        `;
    }

    let _okKeyHandler = null;

    function bindOkModalEvents(data) {
        const overlay = document.getElementById('tqOkOverlay');
        if (!overlay) return;

        const close = () => {
            document.removeEventListener('keydown', _okKeyHandler, true);
            overlay.remove();
            loadList();
        };

        overlay.querySelectorAll('[data-ok-close]').forEach(b => b.onclick = close);
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        // Pickerهای داخل مودال OK
        overlay.querySelectorAll('.tq-pick-h').forEach(btn => {
            btn.addEventListener('click', async () => {
                const prefix = btn.dataset.prefix;
                const level = btn.dataset.level;
                try {
                    let result;
                    if (level === 'col') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'col' });
                        if (!result) return;
                        document.getElementById(`tqf${prefix}Col`).value = result.codeCol || 0;
                    } else if (level === 'moein') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'moein' });
                        if (!result) return;
                        document.getElementById(`tqf${prefix}Col`).value = result.codeCol || 0;
                        document.getElementById(`tqf${prefix}Moein`).value = result.codeMoein || 0;
                    } else if (level === 'tafzil') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'tafzil' });
                        if (!result) return;
                        document.getElementById(`tqf${prefix}Tafzil`).value = result.codeTafzil || 0;
                    }
                    await refreshOkPayableName(result?.name || '');
                } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
            });
        });

        async function refreshOkPayableName(hintName) {
            const c = parseInt(document.getElementById('tqfOkPayableCol')?.value) || 0;
            const m = parseInt(document.getElementById('tqfOkPayableMoein')?.value) || 0;
            const t = parseInt(document.getElementById('tqfOkPayableTafzil')?.value) || 0;
            const el = document.getElementById('tqoPayableName');
            if (!el) return;
            if (hintName) { el.textContent = hintName; return; }
            if (c <= 0 && t <= 0) { el.textContent = '—'; return; }
            const name = await resolveHesabName(c, m, t);
            el.textContent = name || `${c}${m > 0 ? ' / ' + m : ''}${t > 0 ? ' / ' + t : ''}`;
        }

        ['Col', 'Moein', 'Tafzil'].forEach(lvl => {
            document.getElementById(`tqfOkPayable${lvl}`)?.addEventListener('blur', () => refreshOkPayableName());
        });

        document.getElementById('tqoPayableDefaultBtn')?.addEventListener('click', async () => {
            try {
                const ch = await loadConstHesab(_payableChtType());
                if (!ch) {
                    await window.App.alert.warning('حساب اسناد پیش‌فرض تعریف نشده', { title: 'یافت نشد' });
                    return;
                }
                document.getElementById('tqfOkPayableCol').value = ch.codeCol || 0;
                document.getElementById('tqfOkPayableMoein').value = ch.codeMoein || 0;
                document.getElementById('tqfOkPayableTafzil').value = ch.codeTafzil || 0;
                await refreshOkPayableName(ch.hesabName || ch.colName || '');
            } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
        });

        // F3 → انتخاب BankAcc (برای Pay) یا صندوق (برای Receive)
        document.getElementById('tqoBankAccBtn')?.addEventListener('click', async () => {
            if (_isPay()) {
                if (data.bankAccId) {
                    document.getElementById('tqoBankAccId').value = data.bankAccId;
                    window.App.toast('حساب بانکی چک انتخاب شد', 'success');
                }
            } else {
                // Receive → صندوق پیش‌فرض
                try {
                    const ch = await loadConstHesab(0); // 0 = Cash
                    if (!ch) { window.App.toast('حساب صندوق تعریف نشده', 'warning'); return; }
                    window.App.toast('حساب صندوق: ' + (ch.hesabName || ch.colName || ''), 'info');
                } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
            }
        });

        // Checkbox سند
        const cb = document.getElementById('tqoSaveSanad');
        const combo = document.getElementById('tqoParentSanadOkId');
        cb?.addEventListener('change', () => {
            combo.disabled = !cb.checked;
            if (!cb.checked) combo.value = '';
        });
        if (cb && !cb.checked) combo.disabled = true;

        document.getElementById('tqoSaveBtn')?.addEventListener('click', () => saveOkForm(data, close));

        if (_okKeyHandler) document.removeEventListener('keydown', _okKeyHandler, true);
        _okKeyHandler = (e) => {
            if (!document.getElementById('tqOkOverlay')) return;
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
            else if (e.key === 'F2') { e.preventDefault(); e.stopPropagation(); saveOkForm(data, close); }
            else if (e.key === 'F5') { e.preventDefault(); document.getElementById('tqoPayableDefaultBtn')?.click(); }
        };
        document.addEventListener('keydown', _okKeyHandler, true);
    }

    async function saveOkForm(data, close) {
        const g = id => document.getElementById(id);
        const gi = id => parseInt(g(id)?.value) || 0;
        const gs = id => g(id)?.value?.trim() || '';

        const okDate = gs('tqoOkDate');
        if (!okDate) { window.App.toast('تاریخ وصول الزامی است', 'error'); return; }
        const norm = okDate.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(norm)) {
            window.App.toast('فرمت تاریخ وصول صحیح نیست', 'error'); return;
        }

        const saveWithSanad = g('tqoSaveSanad')?.checked || false;
        const parentSanadOkId = saveWithSanad ? (parseInt(g('tqoParentSanadOkId')?.value) || 0) : 0;

        // ─── Code_Col_OK: برای Pay از BankAcc، برای Receive از کدینگ خود چک ───
        let cOk = data.codeCol || 0, mOk = data.codeMoein || 0, tOk = data.codeTafzil || 0;
        if (_isPay()) {
            const bankAccId = parseInt(g('tqoBankAccId')?.value) || data.bankAccId || 0;
            const bankAccList = await loadBankAccList();
            const bankAcc = bankAccList.find(x => x.id === bankAccId);
            if (bankAcc) {
                cOk = bankAcc.codeCol || 0;
                mOk = bankAcc.codeMoein || 0;
                tOk = bankAcc.codeTafzil || 0;
            }
        }

        const qCol = parseInt(gi('tqfOkPayableCol')) || 0;
        const qMoein = parseInt(gi('tqfOkPayableMoein')) || 0;
        const qTafzil = parseInt(gi('tqfOkPayableTafzil')) || 0;

        const payload = {
            id: data.id,
            okDate: norm,
            codeColOk: cOk, codeMoeinOk: mOk, codeTafzilOk: tOk,
            codeColPayOk: qCol, codeMoeinPayOk: qMoein, codeTafzilPayOk: qTafzil,
            saveWithSanad,
            parentSanadOkId: parentSanadOkId || null,
            noSanad: null
        };

        const btn = g('tqoSaveBtn');
        const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '⏳...';

        try {
            await window.App.Http.api(`${_apiBase()}/${data.id}/ok`, {
                method: 'POST',
                body: JSON.stringify(payload),
                successMsg: _isPay() ? 'چک اعلام پرداخت شد' : 'چک اعلام وصول شد'
            });
            close();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            btn.disabled = false; btn.innerHTML = orig;
        }
    }

    // ═══════════════════════════════════════════════════════
    //  UnOK / Return
    // ═══════════════════════════════════════════════════════
    async function doUnOk(id) {
        const ok = await window.App.confirm(
            'آیا از لغو اعلام این چک مطمئن هستید؟ سند اعلام حذف می‌شود.',
            { title: '↺ لغو اعلام', okText: 'بله، لغو کن' }
        );
        if (!ok) return;
        try {
            await window.App.Http.api(`${_apiBase()}/${id}/unok`, {
                method: 'POST', successMsg: 'اعلام لغو شد'
            });
            loadList();
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا', { title: 'خطا' });
        }
    }

    async function doReturn(id) {
        const ok = await window.App.confirm(
            'آیا از برگشت این چک مطمئن هستید؟ سند برگشت صادر می‌شود.',
            { title: '↩ اعلام برگشت', danger: true, okText: 'بله، برگشت بزن' }
        );
        if (!ok) return;
        try {
            await window.App.Http.api(`${_apiBase()}/${id}/return`, {
                method: 'POST', successMsg: 'برگشت ثبت شد'
            });
            loadList();
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا', { title: 'خطا' });
        }
    }

    async function removeItem(id) {
        const item = _items.find(x => x.id === id);
        const amount = item ? H.fmt(item.checkMab) : '';
        const ok = await window.App.confirm(
            `آیا از حذف چک سریال ${item?.checkSeries || ''} به مبلغ ${amount} مطمئن هستید؟`,
            { title: '🗑️ حذف چک', danger: true, okText: 'بله، حذف کن' }
        );
        if (!ok) return;
        try {
            await window.App.Http.api(`${_apiBase()}/${id}`, {
                method: 'DELETE', successMsg: 'چک حذف شد'
            });
            loadList();
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا در حذف', { title: 'خطا' });
        }
    }

 

    return {
        render,
        loadList,
        goToPage,
        openForm,
        openOkModal,
        doUnOk,
        doReturn,
        removeItem,
        buildChequeTableHtml,
        renderPay: () => render(0),
        renderReceive: () => render(1)
    };
})();

window.App.renderPayCheque = () => window.App.Features.TreasuryCheque.render(0);
window.App.renderReceiveCheque = () => window.App.Features.TreasuryCheque.render(1);