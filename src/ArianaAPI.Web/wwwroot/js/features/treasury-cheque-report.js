/* ═══════════════════════════════════════════════════════════════
   Feature / TreasuryChequeReport — گزارش‌های چک (read-only)
   kind: 0 = گزارش چک‌های پرداختی (ChequePay)
         1 = گزارش چک‌های دریافتی (ChequeReceive)
         2 = گزارش خرج چک‌های دریافتی (ChequeExpend)
   ═══════════════════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.TreasuryChequeReport = (function () {
    'use strict';

    const H = window.App.Helpers;
    const S = window.App.State;

    let _kind = 0;
    let _items = [];
    let _page = 1;
    let _sort = { by: 'residNumber', dir: 'desc' };
    let _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
    let _summary = null;

    // ═══ Helpers ═══
    function _isPay() { return _kind === 0; }
    function _isReceive() { return _kind === 1; }
    function _isExpend() { return _kind === 2; }

    function _title() {
        if (_isPay()) return 'گزارش چک‌های پرداختی';
        if (_isReceive()) return 'گزارش چک‌های دریافتی';
        return 'گزارش خرج چک‌های دریافتی';
    }
    function _icon() {
        if (_isPay()) return '📤';
        if (_isReceive()) return '📥';
        return '💸';
    }
    function _pageKey() {
        if (_isPay()) return 'report-cheque-pay';
        if (_isReceive()) return 'report-cheque-receive';
        return 'report-cheque-expend';
    }
    function _apiBase() {
        if (_isPay()) return '/api/chequepay';
        if (_isReceive()) return '/api/chequereceive';
        return '/api/chequeexpend';
    }

    // ═══ CSS (یک‌بار تزریق) ═══
    function _injectCss() {
        if (document.getElementById('tqrStyles')) return;
        const s = document.createElement('style');
        s.id = 'tqrStyles';
        s.textContent = `
.tqr-summary-panel{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px}
.tqr-summary-card{padding:14px 16px;border-radius:10px;border-left:4px solid}
.tqr-summary-success{background:#DCFCE7;border-color:#22C55E;color:#166534}
.tqr-summary-warning{background:#FEF3C7;border-color:#F59E0B;color:#92400E}
.tqr-summary-danger{background:#FEE2E2;border-color:#EF4444;color:#991B1B}
.tqr-summary-info{background:#DBEAFE;border-color:#3B82F6;color:#1E40AF}
.tqr-summary-total{background:#F1F5F9;border-color:#64748B;color:#1E293B}
.tqr-summary-title{font-size:12px;font-weight:600;margin-bottom:6px}
.tqr-summary-count{font-size:16px;font-weight:700}
.tqr-summary-amount{font-size:13px;margin-top:4px}
`;
        document.head.appendChild(s);
    }

    // ═══════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════
    function render(kind) {
        _kind = (kind === 1) ? 1 : (kind === 2) ? 2 : 0;
        window.App.state.currentPage = _pageKey();
        _page = 1;
        _sort = { by: 'residNumber', dir: 'desc' };
        _summary = null;
        _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };

        _injectCss();

        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card tq-filter-card" id="tqrFilterCard">
                <div class="card-title tq-filter-toggle" id="tqrFilterToggle">
                    <span>🔍 فیلترها</span>
                    <span class="tq-filter-icon">▼</span>
                </div>
                <div class="tq-filter-body" id="tqrFilterBody">
                    ${buildFiltersHtml()}
                </div>
            </div>
            <div id="tqrSummaryPanel"></div>
            <div id="tqrListContainer"></div>
        `;

        bindFilterEvents();
        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(c);
        loadSummary();
        loadList();
    }

    function buildFiltersHtml() {
        const statusFilter = _isExpend() ? `
            <div class="form-group">
                <label>وضعیت خرج</label>
                <select id="tqrWasDuring">
                    <option value="">— همه —</option>
                    <option value="0">خرج قطعی</option>
                    <option value="1">در جریان وصول</option>
                </select>
            </div>` : '';

        return `
            <div class="tq-filters-grid">
                <div class="form-group">
                    <label>از تاریخ رسید</label>
                    <input type="text" id="tqrFromDate" placeholder="1404/01/01" dir="ltr">
                </div>
                <div class="form-group">
                    <label>تا تاریخ رسید</label>
                    <input type="text" id="tqrToDate" placeholder="1404/12/29" dir="ltr">
                </div>
                <div class="form-group">
                    <label>از شماره رسید</label>
                    <input type="number" id="tqrFromNo">
                </div>
                <div class="form-group">
                    <label>تا شماره رسید</label>
                    <input type="number" id="tqrToNo">
                </div>
                <div class="form-group">
                    <label>از تاریخ چک</label>
                    <input type="text" id="tqrCheckFromDate" placeholder="1404/01/01" dir="ltr">
                </div>
                <div class="form-group">
                    <label>تا تاریخ چک</label>
                    <input type="text" id="tqrCheckToDate" placeholder="1404/12/29" dir="ltr">
                </div>
                <div class="form-group">
                    <label>از سریال چک</label>
                    <input type="text" id="tqrCheckFromSerial" dir="ltr">
                </div>
                <div class="form-group">
                    <label>تا سریال چک</label>
                    <input type="text" id="tqrCheckToSerial" dir="ltr">
                </div>
                ${statusFilter}
                <div class="form-group tq-col-2">
                    <label>شرح</label>
                    <input type="text" id="tqrDescript" placeholder="جستجو در شرح...">
                </div>
                <div class="form-group tq-col-2">
                    <label>طرف حساب</label>
                    <div class="tq-account-row">
                        <button type="button" class="btn btn-ghost btn-sm" id="tqrPickAccountBtn">🏦 انتخاب</button>
                        <span id="tqrAccountLabel" class="tq-account-label"></span>
                        <button type="button" class="btn btn-ghost btn-sm" id="tqrClearAccountBtn" style="display:none;">✕</button>
                    </div>
                </div>
            </div>
            <div class="tq-filter-actions">
                <button class="btn btn-primary" id="tqrRunBtn">🔍 جستجو</button>
                <button class="btn btn-ghost" id="tqrResetBtn">↻ پاک کردن</button>
            </div>`;
    }

    function bindFilterEvents() {
        document.getElementById('tqrRunBtn')?.addEventListener('click', () => { _page = 1; loadSummary(); loadList(); });
        document.getElementById('tqrResetBtn')?.addEventListener('click', resetFilters);
        document.getElementById('tqrPickAccountBtn')?.addEventListener('click', openAccountPicker);
        document.getElementById('tqrClearAccountBtn')?.addEventListener('click', clearAccountFilter);

        document.getElementById('tqrFilterToggle')?.addEventListener('click', () => {
            document.getElementById('tqrFilterCard').classList.toggle('collapsed');
        });

        ['tqrFromDate', 'tqrToDate', 'tqrFromNo', 'tqrToNo',
            'tqrCheckFromDate', 'tqrCheckToDate', 'tqrCheckFromSerial',
            'tqrCheckToSerial', 'tqrDescript'].forEach(id => {
                document.getElementById(id)?.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { _page = 1; loadSummary(); loadList(); }
                });
            });
    }

    function resetFilters() {
        ['tqrFromDate', 'tqrToDate', 'tqrFromNo', 'tqrToNo',
            'tqrCheckFromDate', 'tqrCheckToDate', 'tqrCheckFromSerial',
            'tqrCheckToSerial', 'tqrDescript', 'tqrWasDuring'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
        updateAccountBar();
        _page = 1;
        loadSummary();
        loadList();
    }

    function openAccountPicker() {
        window.App.UI.HesabPicker.open({ mode: 'moein', title: '🔍 انتخاب حساب برای فیلتر' })
            .then(picked => {
                if (!picked) return;
                _accFilter = {
                    codeCol: picked.codeCol || 0,
                    codeMoein: picked.codeMoein || 0,
                    codeTafzil: 0,
                    label: picked.name || [picked.codeCol, picked.codeMoein].filter(x => x > 0).join(' / ')
                };
                updateAccountBar();
                _page = 1;
                loadSummary();
                loadList();
            })
            .catch(err => window.App.toast('خطا: ' + err.message, 'error'));
    }

    function clearAccountFilter() {
        _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
        updateAccountBar();
        _page = 1;
        loadSummary();
        loadList();
    }

    function updateAccountBar() {
        const label = document.getElementById('tqrAccountLabel');
        const clear = document.getElementById('tqrClearAccountBtn');
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

    function buildFilterPayload() {
        const g = id => document.getElementById(id)?.value?.trim() || null;
        const gi = id => {
            const v = document.getElementById(id)?.value;
            return v === '' || v == null ? null : parseInt(v, 10);
        };
        const p = {
            fromNumber: gi('tqrFromNo'),
            toNumber: gi('tqrToNo'),
            fromDate: g('tqrFromDate'),
            toDate: g('tqrToDate'),
            checkFromDate: g('tqrCheckFromDate'),
            checkToDate: g('tqrCheckToDate'),
            checkFromSerial: g('tqrCheckFromSerial'),
            checkToSerial: g('tqrCheckToSerial'),
            descript: g('tqrDescript'),
            codeCol: _accFilter.codeCol || null,
            codeMoein: _accFilter.codeMoein || null,
            codeTafzil: _accFilter.codeTafzil || null,
            sortBy: _sort.by,
            sortDir: _sort.dir,
            page: _page,
            pageSize: S.getSettings().pageSize || 100
        };
        if (_isExpend()) p.wasDuring = gi('tqrWasDuring');
        return p;
    }

    function buildSummaryPayload() {
        const p = buildFilterPayload();
        delete p.page;
        delete p.pageSize;
        delete p.sortBy;
        delete p.sortDir;
        return p;
    }

    // ═══════════════════════════════════════════════════════════════
    //  SUMMARY
    // ═══════════════════════════════════════════════════════════════
    async function loadSummary() {
        const container = document.getElementById('tqrSummaryPanel');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const result = await window.App.Http.api(_apiBase() + '/report-summary', {
                method: 'POST',
                body: JSON.stringify(buildSummaryPayload()),
                silent: true
            });
            _summary = result;
            renderSummary(result);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function renderSummary(s) {
        const container = document.getElementById('tqrSummaryPanel');
        if (!container || !s) return;

        const totalCard = `
            <div class="tqr-summary-card tqr-summary-total">
                <div class="tqr-summary-title">📊 کل</div>
                <div class="tqr-summary-count">${H.fmt(s.totalCount)} چک</div>
                <div class="tqr-summary-amount">${H.fmt(s.totalAmount)} ریال</div>
            </div>`;

        // ─── رنگ و آیکن بر اساس نوع گزارش ───
        const statusColors = _isExpend()
            ? { 0: 'success', 1: 'warning' }
            : { 0: 'warning', 1: 'success', 2: 'danger' };
        const statusIcons = _isExpend()
            ? { 0: '✓', 1: '⏳' }
            : { 0: '⏳', 1: '✓', 2: '↩' };

        let cards = (s.byStatus || []).map(g => {
            const cls = statusColors[g.status] || 'info';
            const icon = statusIcons[g.status] || '';
            return `
                <div class="tqr-summary-card tqr-summary-${cls}">
                    <div class="tqr-summary-title">${icon} ${H.esc(g.label)}</div>
                    <div class="tqr-summary-count">${H.fmt(g.count)} چک</div>
                    <div class="tqr-summary-amount">${H.fmt(g.amount)} ریال</div>
                </div>`;
        }).join('');

        // ─── byExpended (فقط Receive) ───
        if (s.byExpended && s.byExpended.length > 0) {
            cards += s.byExpended.map(g => {
                const cls = g.status === 0 ? 'info' : g.status === 1 ? 'success' : 'warning';
                const icon = g.status === 0 ? '🔓' : g.status === 1 ? '💸' : '⏳';
                return `
                    <div class="tqr-summary-card tqr-summary-${cls}">
                        <div class="tqr-summary-title">${icon} ${H.esc(g.label)} (خرج)</div>
                        <div class="tqr-summary-count">${H.fmt(g.count)} چک</div>
                        <div class="tqr-summary-amount">${H.fmt(g.amount)} ریال</div>
                    </div>`;
            }).join('');
        }

        container.innerHTML = `<div class="tqr-summary-panel">${totalCard}${cards}</div>`;
    }

    // ═══════════════════════════════════════════════════════════════
    //  LIST
    // ═══════════════════════════════════════════════════════════════
    async function loadList() {
        const container = document.getElementById('tqrListContainer');
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

    function _statusBadge(it) {
        if (_isExpend()) {
            return it.wasDuring === 1
                ? '<span class="tq-badge tq-badge-pending">⏳ در جریان وصول</span>'
                : '<span class="tq-badge tq-badge-ok">✓ خرج قطعی</span>';
        }
        let html = '';
        if (it.chequeOK === 1) html = '<span class="tq-badge tq-badge-ok">✓ وصول</span>';
        else if (it.chequeOK === 2) html = '<span class="tq-badge tq-badge-return">↩ برگشت</span>';
        else html = '<span class="tq-badge tq-badge-pending">⏳ در جریان</span>';

        if (_isReceive() && it.wasExpended > 0) {
            const label = it.wasExpended === 2 ? 'جریان خرج' : 'خرج‌شده';
            const cls = it.wasExpended === 2 ? 'tq-badge-pending' : 'tq-badge-info';
            html += ` <span class="tq-badge ${cls}">${label}</span>`;
        }
        return html;
    }

    function buildTableHeaders() {
        const th = (key, label, style = '') => {
            const active = _sort.by === key;
            const arrow = active ? (_sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
            const cls = active ? 'sortable-th sort-active' : 'sortable-th';
            return `<th class="${cls}" data-sort-key="${key}" style="cursor:pointer;${style}">${label}${arrow}</th>`;
        };

        if (_isPay()) {
            return `
                ${th('residNumber', 'ش.رسید', 'width:70px;')}
                ${th('residDate', 'ت.رسید', 'width:90px;')}
                ${th('checkSeries', 'سریال', 'width:90px;')}
                ${th('checkDate', 'ت.چک', 'width:90px;')}
                ${th('checkPerson', 'در وجه')}
                ${th('checkMab', 'مبلغ', 'width:110px;')}
                ${th('bankName', 'بانک', 'width:100px;')}
                ${th('bankShobe', 'شعبه', 'width:80px;')}
                <th style="width:110px;">وضعیت</th>
                <th>طرف حساب</th>
                <th style="width:70px;">سند</th>
            `;
        }
        if (_isReceive()) {
            return `
                ${th('residNumber', 'ش.رسید', 'width:70px;')}
                ${th('residDate', 'ت.رسید', 'width:90px;')}
                ${th('checkSeries', 'سریال', 'width:90px;')}
                ${th('checkDate', 'ت.چک', 'width:90px;')}
                ${th('checkPerson', 'در وجه')}
                ${th('checkMab', 'مبلغ', 'width:110px;')}
                ${th('bankName', 'بانک', 'width:100px;')}
                ${th('bankBrunch', 'شعبه', 'width:80px;')}
                <th style="width:130px;">وضعیت</th>
                <th>طرف حساب</th>
                <th style="width:70px;">سند</th>
            `;
        }
        // expend
        return `
            ${th('residNumber', 'ش.رسید', 'width:70px;')}
            ${th('residDate', 'ت.رسید', 'width:90px;')}
            ${th('checkSeries', 'سریال', 'width:90px;')}
            ${th('checkDate', 'ت.چک', 'width:90px;')}
            ${th('receiveFrom', 'دریافتی از')}
            ${th('checkMab', 'مبلغ', 'width:110px;')}
            ${th('codeCol', 'حساب خرج‌شده')}
            <th style="width:130px;">وضعیت</th>
            <th style="width:70px;">سند</th>
        `;
    }

    function buildTableRow(it) {
        const noSanad = it.noSanad ? `✅ ${H.fmt(it.noSanad)}` : '🚫';
        const lock = (it.sanadVazeit === 2) ? ' 🔒' : '';
        const hesabLabel = it.hesabName || [it.tafzilName, it.moeinName, it.colName].filter(Boolean).join(' - ') || '-';

        if (_isPay()) {
            return `
                <tr data-id="${it.id}">
                    <td class="num text-center">${H.fmt(it.residNumber)}</td>
                    <td class="num text-center">${H.esc(it.residDate || '-')}</td>
                    <td class="num text-center">${H.esc(it.checkSeries || '-')}</td>
                    <td class="num text-center">${H.esc(it.checkDate || '-')}</td>
                    <td class="tq-person">${H.esc(it.checkPerson || '-')}</td>
                    <td class="num text-left"><strong>${H.fmt(it.checkMab)}</strong></td>
                    <td>${H.esc(it.bankName || '-')}</td>
                    <td class="text-center">${H.esc(it.bankShobe || '-')}</td>
                    <td class="text-center">${_statusBadge(it)}</td>
                    <td>${H.esc(hesabLabel)}</td>
                    <td class="text-center">${noSanad}${lock}</td>
                </tr>`;
        }
        if (_isReceive()) {
            return `
                <tr data-id="${it.id}">
                    <td class="num text-center">${H.fmt(it.residNumber)}</td>
                    <td class="num text-center">${H.esc(it.residDate || '-')}</td>
                    <td class="num text-center">${H.esc(it.checkSeries || '-')}</td>
                    <td class="num text-center">${H.esc(it.checkDate || '-')}</td>
                    <td class="tq-person">${H.esc(it.checkPerson || '-')}</td>
                    <td class="num text-left"><strong>${H.fmt(it.checkMab)}</strong></td>
                    <td>${H.esc(it.bankName || '-')}</td>
                    <td class="text-center">${H.esc(it.bankBrunch || '-')}</td>
                    <td class="text-center">${_statusBadge(it)}</td>
                    <td>${H.esc(hesabLabel)}</td>
                    <td class="text-center">${noSanad}${lock}</td>
                </tr>`;
        }
        // expend
        return `
            <tr data-id="${it.id}">
                <td class="num text-center">${H.fmt(it.residNumber)}</td>
                <td class="num text-center">${H.esc(it.residDate || '-')}</td>
                <td class="num text-center">${H.esc(it.checkSeries || '-')}</td>
                <td class="num text-center">${H.esc(it.checkDate || '-')}</td>
                <td class="tq-person">${H.esc(it.receiveFrom || '-')}</td>
                <td class="num text-left"><strong>${H.fmt(it.checkMab)}</strong></td>
                <td>${H.esc(hesabLabel)}</td>
                <td class="text-center">${_statusBadge(it)}</td>
                <td class="text-center">${noSanad}${lock}</td>
            </tr>`;
    }

    function renderList(result) {
        const container = document.getElementById('tqrListContainer');
        const items = result.items || [];
        const total = result.totalCount || 0;
        const pageSize = result.pageSize || 100;
        const page = result.page || 1;

        let bodyHtml;
        if (items.length === 0) {
            bodyHtml = `
                <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                    <div style="font-size:56px;opacity:0.4;">${_icon()}</div>
                    <p style="margin-top:12px;">گزارشی یافت نشد</p>
                </div>`;
        } else {
            const rows = items.map(buildTableRow).join('');
            bodyHtml = `
                <div class="table-wrapper">
                    <table class="tq-table">
                        <thead><tr>${buildTableHeaders()}</tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div id="tqrPagination"></div>`;
        }

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>${_icon()} ${_title()} (${H.fmt(total)})</span>
                </div>
                ${bodyHtml}
            </div>
        `;

        // Sort handlers
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
        const totalPages = Math.ceil(total / pageSize);
        if (totalPages > 1) {
            const pgEl = document.getElementById('tqrPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(page, totalPages, total, items.length);
        }

        // Export / Print / Excel
        if (items.length > 0 && typeof Exporter !== 'undefined' && Exporter.attach) {
            Exporter.attach(container, {
                title: _title(),
                subtitle: subtitle(),
                filename: _isPay() ? 'ReportChequePay'
                    : _isReceive() ? 'ReportChequeReceive'
                        : 'ReportChequeExpend',
                getFullTable: async () => {
                    const payload = buildFilterPayload();
                    payload.page = 1;
                    payload.pageSize = 100000;
                    const full = await window.App.Http.api(_apiBase() + '/list', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    return buildExportTable(full.items || []);
                }
            });
        }
    }

    function buildExportTable(items) {
        let headers, rowsFn;

        if (_isPay()) {
            headers = ['#', 'ش.رسید', 'ت.رسید', 'سریال', 'ت.چک', 'در وجه', 'مبلغ',
                'بانک', 'شعبه', 'وضعیت', 'طرف حساب', 'شماره سند'];
            rowsFn = (it, idx) => {
                let status = it.chequeOK === 1 ? 'وصول‌شده'
                    : it.chequeOK === 2 ? 'برگشتی' : 'در جریان';
                const hesab = [it.tafzilName, it.moeinName, it.colName].filter(Boolean).join(' - ');
                return [
                    idx + 1, it.residNumber, it.residDate, it.checkSeries, it.checkDate,
                    it.checkPerson, H.fmtT(it.checkMab), it.bankName, it.bankShobe,
                    status, hesab, it.noSanad || '—'
                ];
            };
        } else if (_isReceive()) {
            headers = ['#', 'ش.رسید', 'ت.رسید', 'سریال', 'ت.چک', 'در وجه', 'مبلغ',
                'بانک', 'شعبه', 'وضعیت چک', 'وضعیت خرج', 'طرف حساب', 'شماره سند'];
            rowsFn = (it, idx) => {
                let status = it.chequeOK === 1 ? 'وصول‌شده'
                    : it.chequeOK === 2 ? 'برگشتی' : 'در جریان';
                let expText = it.wasExpended === 1 ? 'خرج‌شده'
                    : it.wasExpended === 2 ? 'در جریان خرج' : 'آزاد';
                const hesab = [it.tafzilName, it.moeinName, it.colName].filter(Boolean).join(' - ');
                return [
                    idx + 1, it.residNumber, it.residDate, it.checkSeries, it.checkDate,
                    it.checkPerson, H.fmtT(it.checkMab), it.bankName, it.bankBrunch,
                    status, expText, hesab, it.noSanad || '—'
                ];
            };
        } else {
            headers = ['#', 'ش.رسید', 'ت.رسید', 'سریال', 'ت.چک', 'دریافتی از', 'مبلغ',
                'حساب خرج‌شده', 'وضعیت', 'شماره سند'];
            rowsFn = (it, idx) => {
                const status = it.wasDuring === 1 ? 'در جریان وصول' : 'خرج قطعی';
                const hesab = it.hesabName
                    || [it.tafzilName, it.moeinName, it.colName].filter(Boolean).join(' - ');
                return [
                    idx + 1, it.residNumber, it.residDate, it.checkSeries, it.checkDate,
                    it.receiveFrom, H.fmtT(it.checkMab), hesab, status, it.noSanad || '—'
                ];
            };
        }

        let rowsHtml = '';
        items.forEach((it, idx) => {
            rowsHtml += '<tr>' + rowsFn(it, idx)
                .map(v => '<td>' + (v === null || v === undefined ? '' : H.esc(String(v))) + '</td>')
                .join('') + '</tr>';
        });

        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
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
                            onclick="App.Features.TreasuryChequeReport.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)}</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeReport.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeReport.goToPage(${page - 1})">‹</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeReport.goToPage(${page + 1})">›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeReport.goToPage(${totalPages})">»</button>
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

    return {
        render,
        loadList,
        loadSummary,
        goToPage,
        renderPay: () => render(0),
        renderReceive: () => render(1),
        renderExpend: () => render(2)
    };
})();