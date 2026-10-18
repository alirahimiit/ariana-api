/* ═══════════════════════════════════════════════════════════════
   Feature / TreasuryChequeReturnedReport — جلسه ۵۰
   گزارش چک‌های برگشتی تفصیلی + کاردکس چک (Timeline)
   ═══════════════════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.TreasuryChequeReturnedReport = (function () {
    'use strict';

    const H = window.App.Helpers;
    const S = window.App.State;

    let _items = [];
    let _page = 1;
    let _sort = { by: 'returnDate', dir: 'desc' };
    let _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
    let _summary = null;

    const _API = '/api/cheque-report';
    const _PAGE_KEY = 'report-cheque-returned';

    // ═══ CSS یک‌بار تزریق ═══
    function _injectCss() {
        if (document.getElementById('tcrStyles')) return;
        const s = document.createElement('style');
        s.id = 'tcrStyles';
        s.textContent = `
.tcr-summary-panel{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}
.tcr-summary-card{padding:14px 16px;border-radius:10px;border-left:4px solid}
.tcr-summary-pay{background:#FEF3C7;border-color:#F59E0B;color:#92400E}
.tcr-summary-receive{background:#DBEAFE;border-color:#3B82F6;color:#1E40AF}
.tcr-summary-total{background:#FEE2E2;border-color:#EF4444;color:#991B1B}
.tcr-summary-bank{background:#F1F5F9;border-color:#64748B;color:#1E293B}
.tcr-summary-title{font-size:12px;font-weight:600;margin-bottom:6px}
.tcr-summary-count{font-size:16px;font-weight:700}
.tcr-summary-amount{font-size:13px;margin-top:4px}
.tcr-type-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.tcr-type-pay{background:#FEF3C7;color:#92400E}
.tcr-type-receive{background:#DBEAFE;color:#1E40AF}
.tcr-btn-kardex{padding:4px 10px;font-size:12px;background:#8B5CF6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit}
.tcr-btn-kardex:hover{background:#7C3AED}
.kdx-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:11000;padding:20px}
.kdx-box{background:#fff;border-radius:12px;width:100%;max-width:920px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.kdx-header{padding:14px 20px;border-bottom:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:15px;color:#1E293B}
.kdx-close{background:transparent;border:none;font-size:20px;cursor:pointer;color:#64748B;padding:0 6px}
.kdx-close:hover{color:#EF4444}
.kdx-body{padding:16px 20px;overflow-y:auto;flex:1}
.kdx-info{background:#F8FAFC;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;font-size:13px}
.kdx-info-item{display:flex;flex-direction:column;gap:2px}
.kdx-info-label{color:#64748B;font-size:11px}
.kdx-info-value{color:#1E293B;font-weight:600}
.kdx-timeline{position:relative;padding-right:24px}
.kdx-timeline::before{content:'';position:absolute;right:10px;top:8px;bottom:8px;width:2px;background:#E2E8F0}
.kdx-event{position:relative;padding:10px 0 20px 0}
.kdx-event::before{content:'';position:absolute;right:-19px;top:14px;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #94A3B8}
.kdx-event-create::before{border-color:#3B82F6}
.kdx-event-ok::before{border-color:#22C55E}
.kdx-event-return::before{border-color:#EF4444}
.kdx-event-expend::before{border-color:#8B5CF6}
.kdx-event-head{display:flex;align-items:center;gap:8px;font-weight:700;color:#1E293B;margin-bottom:4px}
.kdx-event-meta{display:flex;gap:14px;font-size:12px;color:#64748B;margin-bottom:8px;flex-wrap:wrap}
.kdx-event-table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden}
.kdx-event-table th{background:#F1F5F9;padding:6px 8px;text-align:right;font-weight:600;font-size:11px;color:#475569}
.kdx-event-table td{padding:6px 8px;border-top:1px solid #F1F5F9}
.kdx-event-table tr:hover td{background:#F8FAFC}
`;
        document.head.appendChild(s);
    }

    // ═══════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════
    function render() {
        window.App.state.currentPage = _PAGE_KEY;
        _page = 1;
        _sort = { by: 'returnDate', dir: 'desc' };
        _summary = null;
        _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };

        _injectCss();

        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card tq-filter-card" id="tcrFilterCard">
                <div class="card-title tq-filter-toggle" id="tcrFilterToggle">
                    <span>🔍 فیلترها</span>
                    <span class="tq-filter-icon">▼</span>
                </div>
                <div class="tq-filter-body" id="tcrFilterBody">
                    ${buildFiltersHtml()}
                </div>
            </div>
            <div id="tcrSummaryPanel"></div>
            <div id="tcrListContainer"></div>
        `;

        bindFilterEvents();
        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(c);
        loadSummary();
        loadList();
    }

    function buildFiltersHtml() {
        return `
            <div class="tq-filters-grid">
                <div class="form-group">
                    <label>نوع چک</label>
                    <select id="tcrChequeType">
                        <option value="">— همه —</option>
                        <option value="0">پرداختی</option>
                        <option value="1">دریافتی</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>از تاریخ رسید</label>
                    <input type="text" id="tcrFromDate" placeholder="1404/01/01" dir="ltr">
                </div>
                <div class="form-group">
                    <label>تا تاریخ رسید</label>
                    <input type="text" id="tcrToDate" placeholder="1404/12/29" dir="ltr">
                </div>
                <div class="form-group">
                    <label>از تاریخ چک</label>
                    <input type="text" id="tcrCheckFromDate" placeholder="1404/01/01" dir="ltr">
                </div>
                <div class="form-group">
                    <label>تا تاریخ چک</label>
                    <input type="text" id="tcrCheckToDate" placeholder="1404/12/29" dir="ltr">
                </div>
                <div class="form-group">
                    <label>از تاریخ برگشت</label>
                    <input type="text" id="tcrReturnFromDate" placeholder="1404/01/01" dir="ltr">
                </div>
                <div class="form-group">
                    <label>تا تاریخ برگشت</label>
                    <input type="text" id="tcrReturnToDate" placeholder="1404/12/29" dir="ltr">
                </div>
                <div class="form-group">
                    <label>از سریال چک</label>
                    <input type="text" id="tcrCheckFromSerial" dir="ltr">
                </div>
                <div class="form-group">
                    <label>تا سریال چک</label>
                    <input type="text" id="tcrCheckToSerial" dir="ltr">
                </div>
                <div class="form-group">
                    <label>از شماره رسید</label>
                    <input type="number" id="tcrFromNo">
                </div>
                <div class="form-group">
                    <label>تا شماره رسید</label>
                    <input type="number" id="tcrToNo">
                </div>
                <div class="form-group">
                    <label>شرح</label>
                    <input type="text" id="tcrDescript" placeholder="جستجو در شرح...">
                </div>
                <div class="form-group tq-col-2">
                    <label>طرف حساب</label>
                    <div class="tq-account-row">
                        <button type="button" class="btn btn-ghost btn-sm" id="tcrPickAccountBtn">🏦 انتخاب</button>
                        <span id="tcrAccountLabel" class="tq-account-label"></span>
                        <button type="button" class="btn btn-ghost btn-sm" id="tcrClearAccountBtn" style="display:none;">✕</button>
                    </div>
                </div>
            </div>
            <div class="tq-filter-actions">
                <button class="btn btn-primary" id="tcrRunBtn">🔍 جستجو</button>
                <button class="btn btn-ghost" id="tcrResetBtn">↻ پاک کردن</button>
            </div>`;
    }

    function bindFilterEvents() {
        document.getElementById('tcrRunBtn')?.addEventListener('click', () => { _page = 1; loadSummary(); loadList(); });
        document.getElementById('tcrResetBtn')?.addEventListener('click', resetFilters);
        document.getElementById('tcrPickAccountBtn')?.addEventListener('click', openAccountPicker);
        document.getElementById('tcrClearAccountBtn')?.addEventListener('click', clearAccountFilter);

        document.getElementById('tcrFilterToggle')?.addEventListener('click', () => {
            document.getElementById('tcrFilterCard').classList.toggle('collapsed');
        });

        ['tcrFromDate', 'tcrToDate', 'tcrCheckFromDate', 'tcrCheckToDate',
            'tcrReturnFromDate', 'tcrReturnToDate', 'tcrCheckFromSerial',
            'tcrCheckToSerial', 'tcrFromNo', 'tcrToNo', 'tcrDescript'].forEach(id => {
                document.getElementById(id)?.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { _page = 1; loadSummary(); loadList(); }
                });
            });
    }

    function resetFilters() {
        ['tcrChequeType', 'tcrFromDate', 'tcrToDate', 'tcrCheckFromDate', 'tcrCheckToDate',
            'tcrReturnFromDate', 'tcrReturnToDate', 'tcrCheckFromSerial', 'tcrCheckToSerial',
            'tcrFromNo', 'tcrToNo', 'tcrDescript'].forEach(id => {
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
        const label = document.getElementById('tcrAccountLabel');
        const clear = document.getElementById('tcrClearAccountBtn');
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
        return {
            chequeType: gi('tcrChequeType'),
            fromDate: g('tcrFromDate'),
            toDate: g('tcrToDate'),
            checkFromDate: g('tcrCheckFromDate'),
            checkToDate: g('tcrCheckToDate'),
            returnFromDate: g('tcrReturnFromDate'),
            returnToDate: g('tcrReturnToDate'),
            checkFromSerial: g('tcrCheckFromSerial'),
            checkToSerial: g('tcrCheckToSerial'),
            fromNumber: gi('tcrFromNo'),
            toNumber: gi('tcrToNo'),
            descript: g('tcrDescript'),
            codeCol: _accFilter.codeCol || null,
            codeMoein: _accFilter.codeMoein || null,
            codeTafzil: _accFilter.codeTafzil || null,
            sortBy: _sort.by,
            sortDir: _sort.dir,
            page: _page,
            pageSize: S.getSettings().pageSize || 100
        };
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
        const container = document.getElementById('tcrSummaryPanel');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const result = await window.App.Http.api(_API + '/returned/summary', {
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
        const container = document.getElementById('tcrSummaryPanel');
        if (!container || !s) return;

        let cards = `
            <div class="tcr-summary-card tcr-summary-total">
                <div class="tcr-summary-title">🔴 کل برگشتی‌ها</div>
                <div class="tcr-summary-count">${H.fmt(s.totalCount)} چک</div>
                <div class="tcr-summary-amount">${H.fmt(s.totalAmount)} ریال</div>
            </div>
            <div class="tcr-summary-card tcr-summary-pay">
                <div class="tcr-summary-title">📤 پرداختی</div>
                <div class="tcr-summary-count">${H.fmt(s.payCount)} چک</div>
                <div class="tcr-summary-amount">${H.fmt(s.payAmount)} ریال</div>
            </div>
            <div class="tcr-summary-card tcr-summary-receive">
                <div class="tcr-summary-title">📥 دریافتی</div>
                <div class="tcr-summary-count">${H.fmt(s.receiveCount)} چک</div>
                <div class="tcr-summary-amount">${H.fmt(s.receiveAmount)} ریال</div>
            </div>`;

        const banks = (s.byBank || []).slice(0, 6);
        for (const b of banks) {
            cards += `
                <div class="tcr-summary-card tcr-summary-bank">
                    <div class="tcr-summary-title">🏦 ${H.esc(b.bankName)}</div>
                    <div class="tcr-summary-count">${H.fmt(b.count)} چک</div>
                    <div class="tcr-summary-amount">${H.fmt(b.amount)} ریال</div>
                </div>`;
        }

        container.innerHTML = `<div class="tcr-summary-panel">${cards}</div>`;
    }

    // ═══════════════════════════════════════════════════════════════
    //  LIST
    // ═══════════════════════════════════════════════════════════════
    async function loadList() {
        const container = document.getElementById('tcrListContainer');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const result = await window.App.Http.api(_API + '/returned/list', {
                method: 'POST',
                body: JSON.stringify(buildFilterPayload())
            });
            _items = result.items || [];
            renderList(result);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildTableHeaders() {
        const th = (key, label, style = '') => {
            const active = _sort.by === key;
            const arrow = active ? (_sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
            const cls = active ? 'sortable-th sort-active' : 'sortable-th';
            return `<th class="${cls}" data-sort-key="${key}" style="cursor:pointer;${style}">${label}${arrow}</th>`;
        };
        return `
            ${th('residNumber', 'ش.رسید', 'width:70px;')}
            ${th('residDate', 'ت.رسید', 'width:90px;')}
            <th style="width:70px;">نوع</th>
            ${th('checkSeries', 'سریال', 'width:90px;')}
            ${th('checkDate', 'ت.چک', 'width:90px;')}
            ${th('checkPerson', 'در وجه')}
            ${th('checkMab', 'مبلغ', 'width:110px;')}
            ${th('bankName', 'بانک', 'width:100px;')}
            ${th('returnDate', 'ت.برگشت', 'width:90px;')}
            <th>طرف حساب</th>
            <th style="width:90px;">سند</th>
            <th style="width:90px;">عملیات</th>`;
    }

    function buildTableRow(it) {
        const typeLabel = it.chequeType === 0 ? 'پرداختی' : 'دریافتی';
        const typeCls = it.chequeType === 0 ? 'tcr-type-pay' : 'tcr-type-receive';
        const noSanad = it.noSanad ? `✅ ${H.fmt(it.noSanad)}` : '🚫';
        const returnSanad = it.returnNoSanad ? `↩️ ${H.fmt(it.returnNoSanad)}` : '';
        const lock = (it.sanadVazeit === 2) ? ' 🔒' : '';
        const hesabLabel = it.hesabName || [it.tafzilName, it.moeinName, it.colName].filter(Boolean).join(' - ') || '-';

        return `
            <tr data-id="${it.id}" data-type="${it.chequeType}">
                <td class="num text-center">${H.fmt(it.residNumber)}</td>
                <td class="num text-center">${H.esc(it.residDate || '-')}</td>
                <td class="text-center"><span class="tcr-type-badge ${typeCls}">${typeLabel}</span></td>
                <td class="num text-center">${H.esc(it.checkSeries || '-')}</td>
                <td class="num text-center">${H.esc(it.checkDate || '-')}</td>
                <td class="tq-person">${H.esc(it.checkPerson || '-')}</td>
                <td class="num text-left"><strong>${H.fmt(it.checkMab)}</strong></td>
                <td>${H.esc(it.bankName || '-')}</td>
                <td class="num text-center"><strong style="color:#EF4444;">${H.esc(it.returnDate || '-')}</strong></td>
                <td>${H.esc(hesabLabel)}</td>
                <td class="text-center">${noSanad}${returnSanad ? ' ' + returnSanad : ''}${lock}</td>
                <td class="text-center">
                    <button class="tcr-btn-kardex" data-kardex-id="${it.id}" data-kardex-type="${it.chequeType}">
                        📋 کاردکس
                    </button>
                </td>
            </tr>`;
    }

    function renderList(result) {
        const container = document.getElementById('tcrListContainer');
        const items = result.items || [];
        const total = result.totalCount || 0;
        const pageSize = result.pageSize || 100;
        const page = result.page || 1;

        let bodyHtml;
        if (items.length === 0) {
            bodyHtml = `
                <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                    <div style="font-size:56px;opacity:0.4;">↩️</div>
                    <p style="margin-top:12px;">چک برگشتی یافت نشد</p>
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
                <div id="tcrPagination"></div>`;
        }

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>↩️ گزارش چک‌های برگشتی (${H.fmt(total)})</span>
                </div>
                ${bodyHtml}
            </div>`;

        container.querySelectorAll('th[data-sort-key]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                const newDir = (_sort.by === key && _sort.dir === 'asc') ? 'desc' : 'asc';
                _sort = { by: key, dir: newDir };
                _page = 1;
                loadList();
            });
        });

        container.querySelectorAll('[data-kardex-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.kardexId, 10);
                const type = parseInt(btn.dataset.kardexType, 10);
                openKardex(type, id);
            });
        });

        const totalPages = Math.ceil(total / pageSize);
        if (totalPages > 1) {
            const pgEl = document.getElementById('tcrPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(page, totalPages, total, items.length);
        }

        if (items.length > 0 && typeof Exporter !== 'undefined' && Exporter.attach) {
            Exporter.attach(container, {
                title: 'گزارش چک‌های برگشتی',
                subtitle: subtitle(),
                filename: 'ReportChequeReturned',
                getFullTable: async () => {
                    const payload = buildFilterPayload();
                    payload.page = 1;
                    payload.pageSize = 100000;
                    const full = await window.App.Http.api(_API + '/returned/list', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    return buildExportTable(full.items || []);
                }
            });
        }
    }

    function buildExportTable(items) {
        const headers = ['#', 'نوع', 'ش.رسید', 'ت.رسید', 'سریال', 'ت.چک', 'در وجه', 'مبلغ',
            'بانک', 'ت.برگشت', 'طرف حساب', 'سند ایجاد', 'سند برگشت'];
        let rowsHtml = '';
        items.forEach((it, idx) => {
            const typeLabel = it.chequeType === 0 ? 'پرداختی' : 'دریافتی';
            const hesab = it.hesabName || [it.tafzilName, it.moeinName, it.colName].filter(Boolean).join(' - ');
            const vals = [
                idx + 1, typeLabel, it.residNumber, it.residDate, it.checkSeries, it.checkDate,
                it.checkPerson, H.fmtT(it.checkMab), it.bankName, it.returnDate, hesab,
                it.noSanad || '—', it.returnNoSanad || '—'
            ];
            rowsHtml += '<tr>' + vals.map(v => '<td>' + H.esc(String(v)) + '</td>').join('') + '</tr>';
        });

        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>`;
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
                            onclick="App.Features.TreasuryChequeReturnedReport.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)}</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeReturnedReport.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeReturnedReport.goToPage(${page - 1})">‹</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeReturnedReport.goToPage(${page + 1})">›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeReturnedReport.goToPage(${totalPages})">»</button>
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

    // ═══════════════════════════════════════════════════════════════
    //  KARDEX — Overlay مستقل (طبق قانون ۲ مودال تودرتو)
    // ═══════════════════════════════════════════════════════════════
    function openKardex(chequeType, chequeId) {
        document.getElementById('kdxOverlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'kdxOverlay';
        overlay.className = 'kdx-overlay';
        overlay.style.zIndex = '11000';
        overlay.innerHTML = `
            <div class="kdx-box" role="dialog" aria-modal="true">
                <div class="kdx-header">
                    <span>📋 کاردکس چک</span>
                    <button class="kdx-close" id="kdxCloseBtn" aria-label="بستن">✕</button>
                </div>
                <div class="kdx-body" id="kdxBody">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        `;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeKardex(); });
        document.body.appendChild(overlay);
        document.getElementById('kdxCloseBtn').addEventListener('click', closeKardex);

        const esc = (e) => {
            if (e.key === 'Escape') {
                closeKardex();
                document.removeEventListener('keydown', esc);
            }
        };
        document.addEventListener('keydown', esc);

        loadKardexData(chequeType, chequeId);
    }

    function closeKardex() {
        document.getElementById('kdxOverlay')?.remove();
    }

    async function loadKardexData(chequeType, chequeId) {
        const body = document.getElementById('kdxBody');
        if (!body) return;

        try {
            const data = await window.App.Http.api(_API + '/kardex', {
                method: 'POST',
                body: JSON.stringify({ chequeType, chequeId })
            });
            body.innerHTML = buildKardexHtml(data);
        } catch (err) {
            body.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildKardexHtml(data) {
        if (!data) return '<p>داده‌ای یافت نشد</p>';

        const statusBadge = data.currentStatus === 1
            ? '<span class="tcr-type-badge" style="background:#DCFCE7;color:#166534;">✅ وصول‌شده</span>'
            : data.currentStatus === 2
                ? '<span class="tcr-type-badge" style="background:#FEE2E2;color:#991B1B;">↩️ برگشتی</span>'
                : '<span class="tcr-type-badge" style="background:#FEF3C7;color:#92400E;">⏳ در جریان</span>';

        const infoHtml = `
            <div class="kdx-info">
                <div class="kdx-info-item">
                    <span class="kdx-info-label">وضعیت فعلی</span>
                    <span class="kdx-info-value">${statusBadge}</span>
                </div>
                <div class="kdx-info-item">
                    <span class="kdx-info-label">سریال</span>
                    <span class="kdx-info-value">${H.esc(data.checkSeries || '-')}</span>
                </div>
                <div class="kdx-info-item">
                    <span class="kdx-info-label">مبلغ</span>
                    <span class="kdx-info-value">${H.fmt(data.checkMab)} ریال</span>
                </div>
                <div class="kdx-info-item">
                    <span class="kdx-info-label">تاریخ چک</span>
                    <span class="kdx-info-value">${H.esc(data.checkDate || '-')}</span>
                </div>
                <div class="kdx-info-item">
                    <span class="kdx-info-label">در وجه</span>
                    <span class="kdx-info-value">${H.esc(data.checkPerson || '-')}</span>
                </div>
                <div class="kdx-info-item">
                    <span class="kdx-info-label">بانک</span>
                    <span class="kdx-info-value">${H.esc(data.bankName || '-')} / ${H.esc(data.bankShobe || '-')}</span>
                </div>
                <div class="kdx-info-item" style="grid-column:1/-1;">
                    <span class="kdx-info-label">طرف حساب</span>
                    <span class="kdx-info-value">${H.esc(data.hesabName || '-')}</span>
                </div>
            </div>`;

        if (!data.events || data.events.length === 0) {
            return infoHtml + '<div class="empty" style="padding:40px;text-align:center;color:#94A3B8;">رویدادی برای این چک ثبت نشده</div>';
        }

        let eventsHtml = '<div class="kdx-timeline">';
        for (const ev of data.events) {
            const rowsHtml = (ev.rows || []).map(r => `
                <tr>
                    <td class="num text-center">${r.rowNum}</td>
                    <td>${H.esc(r.hesabName || '-')}</td>
                    <td>${H.esc(r.sharh || '-')}</td>
                    <td class="num">${r.mabBed > 0 ? H.fmt(r.mabBed) : '—'}</td>
                    <td class="num">${r.mabBes > 0 ? H.fmt(r.mabBes) : '—'}</td>
                </tr>`).join('');

            eventsHtml += `
                <div class="kdx-event kdx-event-${ev.eventType}">
                    <div class="kdx-event-head">
                        <span>${ev.eventIcon} ${H.esc(ev.eventLabel)}</span>
                    </div>
                    <div class="kdx-event-meta">
                        <span>📅 ${H.esc(ev.eventDate || '-')}</span>
                        <span>📄 سند ${H.fmt(ev.noSanad)}</span>
                        ${ev.sanadVazeit === 2 ? '<span>🔒 قطعی</span>' : ''}
                    </div>
                    ${ev.eventSharh ? `<div style="font-size:12px;color:#475569;margin-bottom:8px;">${H.esc(ev.eventSharh)}</div>` : ''}
                    <table class="kdx-event-table">
                        <thead>
                            <tr>
                                <th style="width:50px;">ردیف</th>
                                <th>حساب</th>
                                <th>شرح</th>
                                <th style="width:110px;">بدهکار</th>
                                <th style="width:110px;">بستانکار</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="5" style="text-align:center;color:#94A3B8;">ردیفی ثبت نشده</td></tr>'}
                        </tbody>
                    </table>
                </div>`;
        }
        eventsHtml += '</div>';

        return infoHtml + eventsHtml;
    }

    return {
        render,
        loadList,
        loadSummary,
        goToPage
    };
})();