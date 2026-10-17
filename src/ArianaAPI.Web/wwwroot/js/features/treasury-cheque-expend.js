/* ═══════════════════════════════════════════════════════════════
   Feature / TreasuryChequeExpend — خرج چک دریافتی
   معادل دلفی: TChequeExpendListForm
   ═══════════════════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.TreasuryChequeExpend = (function () {
    'use strict';

    const H = window.App.Helpers;
    const S = window.App.State;

    // ─── State ───
    let _items = [];
    let _page = 1;
    let _sort = { by: 'residNumber', dir: 'desc' };
    let _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };

    // ─── Cache ───
    let _chequeListCache = null;
    let _hesabTreeCache = null;
    let _hesabNameCache = { col: {}, moein: {}, tafzil: {} };

    let _currentCheque = null;      // چک انتخاب‌شده در فرم
    let _personName = '';
    let _personSig = '';
    let _payableName = '';
    let _payableSig = '';

    const _apiBase = '/api/chequeexpend';

    // ═══════════════════════════════════════════════════════
    //  PAGE RENDER
    // ═══════════════════════════════════════════════════════
    function render() {
        window.App.state.currentPage = 'cheque-expend';
        _page = 1;
        _sort = { by: 'residNumber', dir: 'desc' };

        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card tq-filter-card" id="tqeFilterCard">
                <div class="card-title tq-filter-toggle" id="tqeFilterToggle">
                    <span>🔍 فیلترها</span>
                    <span class="tq-filter-icon">▼</span>
                </div>
                <div class="tq-filter-body" id="tqeFilterBody">
                    <div class="tq-filters-grid">
                        <div class="form-group">
                            <label>از تاریخ رسید</label>
                            <input type="text" id="tqeFromDate" placeholder="1404/01/01" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تا تاریخ رسید</label>
                            <input type="text" id="tqeToDate" placeholder="1404/12/29" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>از شماره رسید</label>
                            <input type="number" id="tqeFromNo">
                        </div>
                        <div class="form-group">
                            <label>تا شماره رسید</label>
                            <input type="number" id="tqeToNo">
                        </div>
                        <div class="form-group">
                            <label>از تاریخ چک</label>
                            <input type="text" id="tqeCheckFromDate" placeholder="1404/01/01" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تا تاریخ چک</label>
                            <input type="text" id="tqeCheckToDate" placeholder="1404/12/29" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>از سریال چک</label>
                            <input type="text" id="tqeCheckFromSerial" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تا سریال چک</label>
                            <input type="text" id="tqeCheckToSerial" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>وضعیت خرج</label>
                            <select id="tqeWasDuring">
                                <option value="">— همه —</option>
                                <option value="0">خرج قطعی</option>
                                <option value="1">در جریان وصول</option>
                            </select>
                        </div>
                        <div class="form-group tq-col-2">
                            <label>شرح</label>
                            <input type="text" id="tqeDescript" placeholder="جستجو در شرح...">
                        </div>
                        <div class="form-group tq-col-2">
                            <label>طرف حساب</label>
                            <div class="tq-account-row">
                                <button type="button" class="btn btn-ghost btn-sm" id="tqePickAccountBtn">🏦 انتخاب</button>
                                <span id="tqeAccountLabel" class="tq-account-label"></span>
                                <button type="button" class="btn btn-ghost btn-sm" id="tqeClearAccountBtn" style="display:none;">✕</button>
                            </div>
                        </div>
                    </div>
                    <div class="tq-filter-actions">
                        <button class="btn btn-primary" id="tqeRunBtn">🔍 جستجو</button>
                        <button class="btn btn-ghost" id="tqeResetBtn">↻ پاک کردن</button>
                    </div>
                </div>
            </div>
            <div id="tqeListContainer"></div>
        `;

        document.getElementById('tqeRunBtn')?.addEventListener('click', () => { _page = 1; loadList(); });
        document.getElementById('tqeResetBtn')?.addEventListener('click', resetFilters);
        document.getElementById('tqePickAccountBtn')?.addEventListener('click', openAccountFilterPicker);
        document.getElementById('tqeClearAccountBtn')?.addEventListener('click', clearAccountFilter);

        document.getElementById('tqeFilterToggle')?.addEventListener('click', () => {
            document.getElementById('tqeFilterCard').classList.toggle('collapsed');
        });

        ['tqeFromDate', 'tqeToDate', 'tqeFromNo', 'tqeToNo', 'tqeCheckFromDate', 'tqeCheckToDate',
            'tqeCheckFromSerial', 'tqeCheckToSerial', 'tqeDescript'].forEach(id => {
                document.getElementById(id)?.addEventListener('keydown', e => {
                    if (e.key === 'Enter') { _page = 1; loadList(); }
                });
            });

        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(c);
        loadList();
    }

    function resetFilters() {
        ['tqeFromDate', 'tqeToDate', 'tqeFromNo', 'tqeToNo', 'tqeCheckFromDate', 'tqeCheckToDate',
            'tqeCheckFromSerial', 'tqeCheckToSerial', 'tqeDescript', 'tqeWasDuring'].forEach(id => {
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
        const label = document.getElementById('tqeAccountLabel');
        const clear = document.getElementById('tqeClearAccountBtn');
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
        const container = document.getElementById('tqeListContainer');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const result = await window.App.Http.api(_apiBase + '/list', {
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
            fromNumber: gi('tqeFromNo'),
            toNumber: gi('tqeToNo'),
            fromDate: g('tqeFromDate'),
            toDate: g('tqeToDate'),
            checkFromDate: g('tqeCheckFromDate'),
            checkToDate: g('tqeCheckToDate'),
            checkFromSerial: g('tqeCheckFromSerial'),
            checkToSerial: g('tqeCheckToSerial'),
            descript: g('tqeDescript'),
            wasDuring: gi('tqeWasDuring'),
            codeCol: _accFilter.codeCol || null,
            codeMoein: _accFilter.codeMoein || null,
            codeTafzil: _accFilter.codeTafzil || null,
            sortBy: _sort.by,
            sortDir: _sort.dir,
            page: _page,
            pageSize: S.getSettings().pageSize || 100
        };
    }

    function buildListCard(result) {
        const items = result?.items || [];
        const total = result?.totalCount || 0;

        let bodyHtml;
        if (items.length === 0) {
            bodyHtml = `
                <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                    <div style="font-size:56px;opacity:0.4;">📤</div>
                    <p style="margin-top:12px;">خرج چکی یافت نشد</p>
                    <p style="margin-top:6px; font-size:12px; color:#94A3B8;">
                        برای شروع، دکمه «خرج چک جدید» را بزنید
                    </p>
                </div>`;
        } else {
            const rows = items.map(it => {
                const noSanad = it.noSanad ? `✅ ${H.fmt(it.noSanad)}` : '🚫';
                const lock = (it.sanadVazeit === 2) ? ' 🔒' : '';
                const canEdit = it.sanadVazeit !== 2;
                const canDelete = it.sanadVazeit !== 2;

                const statusBadge = it.wasDuring === 1
                    ? '<span class="tq-badge tq-badge-pending">⏳ در جریان وصول</span>'
                    : '<span class="tq-badge tq-badge-ok">✓ خرج قطعی</span>';

                return `
                    <tr data-id="${it.id}">
                        <td class="num text-center">${H.fmt(it.residNumber)}</td>
                        <td class="num text-center">${H.esc(it.residDate || '-')}</td>
                        <td class="num text-center">${H.esc(it.checkSeries || '-')}</td>
                        <td class="num text-center">${H.esc(it.checkDate || '-')}</td>
                        <td class="tq-person">${H.esc(it.receiveFrom || '-')}</td>
                        <td class="num text-left"><strong>${H.fmt(it.checkMab)}</strong></td>
                        <td>${H.esc(it.hesabName || '-')}</td>
                        <td class="text-center">${statusBadge}</td>
                        <td class="text-center">${noSanad}${lock}</td>
                        <td class="text-center tq-actions">
                            <button class="btn btn-sm btn-ghost" title="ویرایش"
                                    onclick="event.stopPropagation();App.Features.TreasuryChequeExpend.openForm(${it.id})"
                                    data-permission="150" ${canEdit ? '' : 'disabled'}>✏️</button>
                            <button class="btn btn-sm btn-ghost" title="حذف"
                                    onclick="event.stopPropagation();App.Features.TreasuryChequeExpend.removeItem(${it.id})"
                                    style="color:var(--danger);"
                                    data-permission="151" ${canDelete ? '' : 'disabled'}>🗑️</button>
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
                                ${thSort('receiveFrom', 'دریافتی از')}
                                ${thSort('checkMab', 'مبلغ', 'width:110px;')}
                                ${thSort('codeCol', 'حساب خرج‌شده')}
                                <th style="width:110px;">وضعیت</th>
                                <th style="width:80px;">سند</th>
                                <th style="width:90px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div id="tqePagination"></div>`;
        }

        return `
            <div class="card">
                <div class="card-title">
                    <span>📤 لیست خرج چک‌های دریافتی (${H.fmt(total)})</span>
                    <button class="btn btn-primary btn-sm" data-permission="149" id="tqeNewBtn">
                        ➕ خرج چک جدید
                    </button>
                </div>
                ${bodyHtml}
            </div>
        `;
    }

    function renderList(result) {
        const container = document.getElementById('tqeListContainer');
        container.innerHTML = buildListCard(result);

        document.getElementById('tqeNewBtn')?.addEventListener('click', () => openForm(null));

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
            const pgEl = document.getElementById('tqePagination');
            if (pgEl) pgEl.innerHTML = buildPagination(page, totalPages, total, (result.items || []).length);
        }

        // Export / Print / Excel
        const items = result.items || [];
        if (items.length > 0 && typeof Exporter !== 'undefined' && Exporter.attach) {
            Exporter.attach(container, {
                title: 'لیست خرج چک‌های دریافتی',
                subtitle: subtitle(),
                filename: 'ChequeExpend',
                getFullTable: async () => {
                    const payload = buildFilterPayload();
                    payload.page = 1;
                    payload.pageSize = 100000;
                    const full = await window.App.Http.api(_apiBase + '/list', {
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
            const status = it.wasDuring === 1 ? 'در جریان وصول' : 'خرج قطعی';
            rows += '<tr>' +
                '<td>' + (idx + 1) + '</td>' +
                '<td>' + (it.residNumber || '') + '</td>' +
                '<td>' + (it.residDate || '') + '</td>' +
                '<td>' + (it.checkSeries || '') + '</td>' +
                '<td>' + (it.checkDate || '') + '</td>' +
                '<td>' + H.esc(it.receiveFrom || '') + '</td>' +
                '<td>' + H.fmtT(it.checkMab) + '</td>' +
                '<td>' + H.esc(it.hesabName || '') + '</td>' +
                '<td>' + status + '</td>' +
                '<td>' + (it.noSanad ? it.noSanad : '—') + '</td>' +
                '<td>' + H.esc(it.residDes || '') + '</td>' +
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
                    <th>دریافتی از</th>
                    <th>مبلغ</th>
                    <th>حساب خرج‌شده</th>
                    <th>وضعیت</th>
                    <th>شماره سند</th>
                    <th>شرح</th>
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
                            onclick="App.Features.TreasuryChequeExpend.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)}</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeExpend.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeExpend.goToPage(${page - 1})">‹</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeExpend.goToPage(${page + 1})">›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryChequeExpend.goToPage(${totalPages})">»</button>
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
                data = await window.App.Http.api(`${_apiBase}/${id}`);
                if (!data) { window.App.toast('خرج چک یافت نشد', 'error'); return; }
                if (data.sanadVazeit === 2) {
                    window.App.toast('سند قطعی است و قابل ویرایش نیست', 'warning');
                    return;
                }
            } catch (err) {
                window.App.toast('خطا: ' + err.message, 'error'); return;
            }
        } else {
            try {
                const nr = await window.App.Http.api(`${_apiBase}/next-number`);
                data = {
                    residNumber: nr.residNumber,
                    residDate: H.todayPersian ? H.todayPersian() : '',
                    wasDuring: 0
                };
            } catch (e) {
                data = { residNumber: 0, residDate: '', wasDuring: 0 };
            }
        }

        let sanadList = [];
        try { sanadList = await window.App.Http.api(`${_apiBase}/sanad-list`); }
        catch (e) { sanadList = []; }

        _personName = '';
        _personSig = '';
        _payableName = '';
        _payableSig = '';
        _currentCheque = null;

        // اگه در ویرایش هستیم، چک فعلی رو از detail پر کن
        if (isEdit && data) {
            _currentCheque = {
                id: data.chequeReceiveId,
                checkSeries: data.checkSeries,
                checkMab: data.checkMab,
                checkDate: data.checkDate,
                checkPerson: data.receiveFrom,
                wasExpended: 1
            };
        }

        window.App.openModal(
            `📤 ${isEdit ? 'ویرایش' : 'خرج چک جدید'} — خرج چک دریافتی`,
            buildFormHtml(data, isEdit, sanadList)
        );

        if (isEdit && data) {
            if (data.codeCol || data.codeTafzil) {
                _personName = await resolveHesabName(data.codeCol, data.codeMoein, data.codeTafzil);
                _personSig = `${data.codeCol}_${data.codeMoein}_${data.codeTafzil}`;
            }
            if (data.codeColPay || data.codeTafzilPay) {
                _payableName = await resolveHesabName(data.codeColPay, data.codeMoeinPay, data.codeTafzilPay);
                _payableSig = `${data.codeColPay}_${data.codeMoeinPay}_${data.codeTafzilPay}`;
            }
        }

        bindFormEvents(data, isEdit);
    }

    function buildFormHtml(data, isEdit, sanadList) {
        const sanadOptions = ['<option value="">— بدون سند —</option>']
            .concat((sanadList || []).map(s =>
                `<option value="${s.parentSanadID}" ${s.parentSanadID === data.parentSanadId ? 'selected' : ''}>
                    ${H.fmt(s.noSanad)} — ${H.esc((s.sharh || '').substring(0, 40))}
                </option>`)).join('');

        const hasSanad = (data.parentSanadId || 0) > 0;
        const chequeDisplay = _currentCheque
            ? `${H.esc(_currentCheque.checkSeries || '')} — ${H.fmt(_currentCheque.checkMab || 0)} — ${H.esc(_currentCheque.checkPerson || '')}`
            : '';

        return `
            <div class="tq-form" data-help="cheque-expend-form">

                <div class="tq-form-section">
                    <div class="tq-form-section-title">
                        📋 مشخصات چک
                        <button type="button" class="btn btn-ghost btn-sm tqe-cheque-pick-btn" id="tqeChequePickBtn">🔍 انتخاب چک (F2)</button>
                    </div>

                    <div class="tqe-cheque-display" id="tqeChequeDisplay" style="${_currentCheque ? '' : 'display:none;'}">
                        <div class="tqe-cheque-row">
                            <span class="tqe-ch-lbl">سریال:</span><span id="tqeChequeSerial">${H.esc(_currentCheque?.checkSeries || '')}</span>
                            <span class="tqe-ch-lbl">مبلغ:</span><span id="tqeChequeMab">${_currentCheque ? H.fmt(_currentCheque.checkMab) : ''}</span>
                            <span class="tqe-ch-lbl">تاریخ:</span><span id="tqeChequeDate">${H.esc(_currentCheque?.checkDate || '')}</span>
                        </div>
                        <div class="tqe-cheque-row">
                            <span class="tqe-ch-lbl">دریافتی از:</span><span id="tqeChequePerson">${H.esc(_currentCheque?.checkPerson || '')}</span>
                        </div>
                    </div>
                    <div class="tqe-cheque-empty" id="tqeChequeEmpty" style="${_currentCheque ? 'display:none;' : ''}">
                        <em>هیچ چکی انتخاب نشده — دکمه «انتخاب چک» را بزنید</em>
                    </div>

                    <div class="tq-form-grid" style="margin-top:10px;">
                        <div class="form-group tq-col-2">
                            <label class="tq-checkbox-label">
                                <input type="checkbox" id="tqeWasDuring" ${data.wasDuring === 1 ? 'checked' : ''}>
                                <span>این چک در جریان وصول است</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="tq-form-section">
                    <div class="tq-form-section-title">📄 مشخصات رسید</div>
                    <div class="tq-form-grid">
                        <div class="form-group">
                            <label>شماره رسید <span class="req">*</span></label>
                            <input type="number" id="tqeResidNumber" value="${data.residNumber || ''}" class="num-input" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تاریخ رسید <span class="req">*</span></label>
                            <input type="text" id="tqeResidDate" value="${H.esc(data.residDate || '')}" dir="ltr" placeholder="1404/01/01">
                        </div>
                        <div class="form-group tq-col-2">
                            <label>شرح</label>
                            <input type="text" id="tqeResidDes" value="${H.esc(data.residDes || '')}" maxlength="200">
                        </div>
                    </div>
                </div>

                <div class="tq-form-section">
                    <div class="tq-form-section-title">
                        💼 نام حساب اسناد دریافتنی (بستانکار)
                        <button type="button" class="btn btn-ghost btn-sm tq-def-btn" id="tqePayableDefaultBtn" title="F5">⚙️</button>
                    </div>
                    <div class="tq-hesab-row">
                        ${hesabFieldHtml('Payable', 'col', data.codeColPay)}
                        ${hesabFieldHtml('Payable', 'moein', data.codeMoeinPay)}
                        ${hesabFieldHtml('Payable', 'tafzil', data.codeTafzilPay)}
                    </div>
                    <div class="tq-hesab-preview" id="tqePayableName">—</div>
                </div>

                <div class="tq-form-section">
                    <div class="tq-form-section-title">
                        👤 شماره حساب دریافت‌کننده (بدهکار)
                        <button type="button" class="btn btn-ghost btn-sm tq-def-btn" id="tqePersonDefaultBtn" title="F3">⚙️</button>
                    </div>
                    <div class="tq-hesab-row">
                        ${hesabFieldHtml('Person', 'col', data.codeCol)}
                        ${hesabFieldHtml('Person', 'moein', data.codeMoein)}
                        ${hesabFieldHtml('Person', 'tafzil', data.codeTafzil)}
                    </div>
                    <div class="tq-hesab-preview" id="tqePersonName">—</div>
                </div>

                <div class="tq-form-section">
                    <div class="tq-form-section-title">🧾 سند حسابداری</div>
                    <div class="tq-sanad-row">
                        <label class="tq-checkbox-label">
                            <input type="checkbox" id="tqeSaveSanad" ${hasSanad || !isEdit ? 'checked' : ''}>
                            <span>صدور سند انجام شود</span>
                        </label>
                        <div class="tq-sanad-combo-wrap">
                            <label>شماره سند</label>
                            <select id="tqeParentSanadId" class="tq-select">${sanadOptions}</select>
                        </div>
                    </div>
                    <p class="tq-hint">⚙️ F3 = بستانکاران پیش‌فرض، F5 = اسناد دریافتنی پیش‌فرض</p>
                </div>

                <div class="tq-form-footer">
                    <button class="btn btn-primary" id="tqeSaveBtn">💾 ذخیره (F9)</button>
                    <button class="btn btn-ghost" id="tqeCancelBtn">انصراف (Esc)</button>
                </div>
            </div>
        `;
    }

    function hesabFieldHtml(prefix, level, value) {
        const labels = { col: 'کد کل', moein: 'کد معین', tafzil: 'کد تفصیلی' };
        const ph = { col: 'مثلاً 302', moein: 'مثلاً 5', tafzil: 'مثلاً 1034' };
        const id = `tqe${prefix}${level.charAt(0).toUpperCase() + level.slice(1)}`;
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
        async function refreshPayableName() {
            const c = parseInt(document.getElementById('tqePayableCol')?.value) || 0;
            const m = parseInt(document.getElementById('tqePayableMoein')?.value) || 0;
            const t = parseInt(document.getElementById('tqePayableTafzil')?.value) || 0;
            const el = document.getElementById('tqePayableName');
            if (!el) return;
            if (c <= 0 && t <= 0) { el.textContent = '—'; return; }
            const sig = `${c}_${m}_${t}`;
            if (_payableName && _payableSig === sig) { el.textContent = _payableName; return; }
            const name = await resolveHesabName(c, m, t);
            el.textContent = name || `${c}${m > 0 ? ' / ' + m : ''}${t > 0 ? ' / ' + t : ''}`;
        }

        async function refreshPersonName() {
            const c = parseInt(document.getElementById('tqePersonCol')?.value) || 0;
            const m = parseInt(document.getElementById('tqePersonMoein')?.value) || 0;
            const t = parseInt(document.getElementById('tqePersonTafzil')?.value) || 0;
            const el = document.getElementById('tqePersonName');
            if (!el) return;
            if (c <= 0 && t <= 0) { el.textContent = '—'; return; }
            const sig = `${c}_${m}_${t}`;
            if (_personName && _personSig === sig) { el.textContent = _personName; return; }
            const name = await resolveHesabName(c, m, t);
            el.textContent = name || `${c}${m > 0 ? ' / ' + m : ''}${t > 0 ? ' / ' + t : ''}`;
        }

        ['Payable', 'Person'].forEach(prefix => {
            ['Col', 'Moein', 'Tafzil'].forEach(lvl => {
                document.getElementById(`tqe${prefix}${lvl}`)?.addEventListener('blur', () => {
                    if (prefix === 'Payable') refreshPayableName(); else refreshPersonName();
                });
            });
        });

        if (data.codeCol || data.codeTafzil) refreshPersonName();
        if (data.codeColPay || data.codeTafzilPay) refreshPayableName();

        // ─── Pickerهای سه‌سطحی ───
        document.querySelectorAll('.tq-pick-h').forEach(btn => {
            btn.addEventListener('click', async () => {
                const prefix = btn.dataset.prefix;
                const level = btn.dataset.level;
                try {
                    let result = null;
                    if (level === 'col') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'col', title: '🔍 انتخاب کد کل' });
                        if (!result) return;
                        document.getElementById(`tqe${prefix}Col`).value = result.codeCol || 0;
                    } else if (level === 'moein') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'moein', title: '🔍 انتخاب کد معین' });
                        if (!result) return;
                        document.getElementById(`tqe${prefix}Col`).value = result.codeCol || 0;
                        document.getElementById(`tqe${prefix}Moein`).value = result.codeMoein || 0;
                    } else if (level === 'tafzil') {
                        result = await window.App.UI.HesabPicker.open({ mode: 'tafzil', title: '🔍 انتخاب کد تفصیلی' });
                        if (!result) return;
                        document.getElementById(`tqe${prefix}Tafzil`).value = result.codeTafzil || 0;
                    }

                    const c = parseInt(document.getElementById(`tqe${prefix}Col`)?.value) || 0;
                    const m = parseInt(document.getElementById(`tqe${prefix}Moein`)?.value) || 0;
                    const t = parseInt(document.getElementById(`tqe${prefix}Tafzil`)?.value) || 0;
                    const sig = `${c}_${m}_${t}`;
                    if (prefix === 'Person') { _personName = result.name || ''; _personSig = sig; }
                    else { _payableName = result.name || ''; _payableSig = sig; }

                    if (prefix === 'Person') await refreshPersonName(); else await refreshPayableName();
                } catch (err) {
                    window.App.toast('خطا در انتخاب: ' + err.message, 'error');
                }
            });
        });

        // ─── F3: بستانکاران پیش‌فرض (شخص) ───
        document.getElementById('tqePersonDefaultBtn')?.addEventListener('click', async () => {
            try {
                const ch = await loadConstHesab(19); // chtBes
                if (!ch) {
                    await window.App.alert.warning(
                        'حساب «بستانکاران» در «حساب‌های پیش‌فرض» تعریف نشده است',
                        { title: 'یافت نشد' });
                    return;
                }
                document.getElementById('tqePersonCol').value = ch.codeCol || 0;
                document.getElementById('tqePersonMoein').value = ch.codeMoein || 0;
                document.getElementById('tqePersonTafzil').value = ch.codeTafzil || 0;
                _personName = ch.hesabName || ch.colName || '';
                _personSig = `${ch.codeCol}_${ch.codeMoein}_${ch.codeTafzil}`;
                await refreshPersonName();
            } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
        });

        // ─── F5: اسناد دریافتنی پیش‌فرض ───
        document.getElementById('tqePayableDefaultBtn')?.addEventListener('click', async () => {
            try {
                const ch = await loadConstHesab(13); // chtReceivableDocument
                if (!ch) {
                    await window.App.alert.warning(
                        'حساب «اسناد دریافتنی» در «حساب‌های پیش‌فرض» تعریف نشده است',
                        { title: 'یافت نشد' });
                    return;
                }
                document.getElementById('tqePayableCol').value = ch.codeCol || 0;
                document.getElementById('tqePayableMoein').value = ch.codeMoein || 0;
                document.getElementById('tqePayableTafzil').value = ch.codeTafzil || 0;
                _payableName = ch.hesabName || ch.colName || '';
                _payableSig = `${ch.codeCol}_${ch.codeMoein}_${ch.codeTafzil}`;
                await refreshPayableName();
            } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
        });

        // ─── انتخاب چک ───
        document.getElementById('tqeChequePickBtn')?.addEventListener('click', async () => {
            const currentId = _currentCheque?.id || 0;
            const picked = await openChequePicker(currentId);
            if (!picked) return;
            applyChequeToForm(picked, refreshPayableName);
        });

        // ─── سند ───
        const cb = document.getElementById('tqeSaveSanad');
        const combo = document.getElementById('tqeParentSanadId');
        cb?.addEventListener('change', () => {
            combo.disabled = !cb.checked;
            if (!cb.checked) combo.value = '';
        });
        if (cb && !cb.checked) combo.disabled = true;

        document.getElementById('tqeSaveBtn')?.addEventListener('click', () => saveForm(data, isEdit));
        document.getElementById('tqeCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        // ─── کیبورد ───
        if (_formKeyHandler) document.removeEventListener('keydown', _formKeyHandler);
        _formKeyHandler = (e) => {
            if (document.getElementById('tqeChequePicker')) return;
            if (e.key === 'F9') { e.preventDefault(); saveForm(data, isEdit); }
            else if (e.key === 'Escape') { e.preventDefault(); window.App.closeModal(); }
            else if (e.key === 'F2') { e.preventDefault(); document.getElementById('tqeChequePickBtn')?.click(); }
            else if (e.key === 'F3') { e.preventDefault(); document.getElementById('tqePersonDefaultBtn')?.click(); }
            else if (e.key === 'F5') { e.preventDefault(); document.getElementById('tqePayableDefaultBtn')?.click(); }
        };
        document.addEventListener('keydown', _formKeyHandler);
    }

    function applyChequeToForm(picked, refreshPayableName) {
        _currentCheque = picked;

        // نمایش چک
        document.getElementById('tqeChequeDisplay').style.display = '';
        document.getElementById('tqeChequeEmpty').style.display = 'none';
        document.getElementById('tqeChequeSerial').textContent = picked.checkSeries || '';
        document.getElementById('tqeChequeMab').textContent = H.fmt(picked.checkMab || 0);
        document.getElementById('tqeChequeDate').textContent = picked.checkDate || '';
        document.getElementById('tqeChequePerson').textContent = picked.checkPerson || '';

        // پر کردن خودکار اسناد دریافتنی از چک (طبق دلفی)
        if (picked.codeColPay || picked.codeTafzilPay) {
            document.getElementById('tqePayableCol').value = picked.codeColPay || 0;
            document.getElementById('tqePayableMoein').value = picked.codeMoeinPay || 0;
            document.getElementById('tqePayableTafzil').value = picked.codeTafzilPay || 0;
            _payableSig = `${picked.codeColPay}_${picked.codeMoeinPay}_${picked.codeTafzilPay}`;
            _payableName = '';
            setTimeout(() => refreshPayableName(), 50);
        }
    }

    async function saveForm(oldData, isEdit) {
        const g = id => document.getElementById(id);
        const gi = id => parseInt(g(id)?.value) || 0;
        const gs = id => g(id)?.value?.trim() || '';

        if (!_currentCheque || !_currentCheque.id) {
            window.App.toast('لطفاً یک چک انتخاب کنید', 'error');
            return;
        }

        const residNumber = gi('tqeResidNumber') || null;
        const residDate = gs('tqeResidDate');
        const residDes = gs('tqeResidDes');
        const wasDuring = g('tqeWasDuring')?.checked || false;

        const pCol = gi('tqePersonCol');
        const pMoein = gi('tqePersonMoein');
        const pTafzil = gi('tqePersonTafzil');

        const rCol = gi('tqePayableCol');
        const rMoein = gi('tqePayableMoein');
        const rTafzil = gi('tqePayableTafzil');

        const saveWithSanad = g('tqeSaveSanad')?.checked || false;
        const parentSanadId = saveWithSanad ? (parseInt(g('tqeParentSanadId')?.value) || 0) : 0;

        if (!residDate) { window.App.toast('تاریخ رسید الزامی است', 'error'); g('tqeResidDate')?.focus(); return; }
        if (pCol <= 0) { window.App.toast('کد کل شخص دریافت‌کننده الزامی است', 'error'); return; }

        const normDate = (s) => {
            if (!s) return '';
            const n = s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
            if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(n)) return null;
            return n;
        };
        const nd = normDate(residDate);
        if (!nd) { window.App.toast('فرمت تاریخ رسید صحیح نیست', 'error'); return; }

        const payload = {
            chequeReceiveId: _currentCheque.id,
            residNumber,
            residDate: nd,
            residDes,
            codeCol: pCol,
            codeMoein: pMoein,
            codeTafzil: pTafzil,
            codeColPay: rCol,
            codeMoeinPay: rMoein,
            codeTafzilPay: rTafzil,
            wasDuring,
            saveWithSanad,
            parentSanadId: parentSanadId || null,
            noSanad: null
        };

        const btn = g('tqeSaveBtn');
        const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '⏳ در حال ذخیره...';

        try {
            if (isEdit) {
                payload.id = oldData.id;
                await window.App.Http.api(`${_apiBase}/${oldData.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                    successMsg: 'خرج چک ویرایش شد'
                });
            } else {
                await window.App.Http.api(_apiBase, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    successMsg: 'خرج چک جدید ثبت شد'
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
    //  CHEQUE PICKER (overlay مستقل)
    // ═══════════════════════════════════════════════════════
    function openChequePicker(includeChequeReceiveId) {
        return new Promise(async (resolve) => {
            let cheques = [];
            try {
                const url = includeChequeReceiveId > 0
                    ? `${_apiBase}/available-cheques?includeChequeReceiveId=${includeChequeReceiveId}`
                    : `${_apiBase}/available-cheques`;
                cheques = await window.App.Http.api(url) || [];
            } catch (err) {
                window.App.toast('خطا در دریافت لیست چک‌ها: ' + err.message, 'error');
                resolve(null);
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'tqeChequePicker';
            overlay.className = 'tq-ok-overlay';
            overlay.innerHTML = buildChequePickerHtml(cheques);
            document.body.appendChild(overlay);

            const close = (result) => {
                overlay.remove();
                resolve(result);
            };

            overlay.querySelectorAll('[data-tqe-close]').forEach(b => b.onclick = () => close(null));
            overlay.onclick = (e) => { if (e.target === overlay) close(null); };

            // ─── Render rows ───
            const tbody = overlay.querySelector('#tqeChequePickerTbody');
            const searchInp = overlay.querySelector('#tqeChequePickerSearch');

            function renderRows(filtered) {
                if (filtered.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#94A3B8;">
                        چکی برای انتخاب یافت نشد</td></tr>`;
                    return;
                }
                tbody.innerHTML = filtered.map(c => `
                    <tr class="tqe-chq-row" data-id="${c.id}" style="cursor:pointer;">
                        <td class="text-center num">${H.esc(c.checkSeries || '-')}</td>
                        <td class="text-center num">${H.esc(c.checkDate || '-')}</td>
                        <td class="num text-left"><strong>${H.fmt(c.checkMab)}</strong></td>
                        <td>${H.esc(c.checkPerson || '-')}</td>
                        <td>${H.esc(c.bankName || '-')}</td>
                        <td class="text-center">${H.esc(c.bankBrunch || '-')}</td>
                        <td class="text-center">
                            ${c.wasExpended === 2
                        ? '<span class="tq-badge tq-badge-pending">در جریان</span>'
                        : '<span class="tq-badge tq-badge-ok">آزاد</span>'}
                        </td>
                    </tr>`).join('');

                tbody.querySelectorAll('.tqe-chq-row').forEach(tr => {
                    tr.addEventListener('click', () => {
                        const id = parseInt(tr.dataset.id);
                        const selected = cheques.find(x => x.id === id);
                        close(selected);
                    });
                });
            }

            renderRows(cheques);

            searchInp?.addEventListener('input', () => {
                const q = searchInp.value.trim().toLowerCase();
                if (!q) { renderRows(cheques); return; }
                const filtered = cheques.filter(c =>
                    (c.checkSeries || '').toLowerCase().includes(q) ||
                    (c.checkPerson || '').toLowerCase().includes(q) ||
                    (c.bankName || '').toLowerCase().includes(q) ||
                    (c.noHesabCheck || '').toLowerCase().includes(q)
                );
                renderRows(filtered);
            });

            // Focus search
            setTimeout(() => searchInp?.focus(), 100);

            // Esc
            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault(); e.stopPropagation();
                    document.removeEventListener('keydown', keyHandler, true);
                    close(null);
                }
            };
            document.addEventListener('keydown', keyHandler, true);
        });
    }

    function buildChequePickerHtml(cheques) {
        return `
            <div class="tq-ok-box" style="max-width:900px;">
                <div class="tq-ok-header">
                    <span>🔍 انتخاب چک دریافتی (فقط چک‌های در جریان و آزاد)</span>
                    <button type="button" class="tq-ok-close" data-tqe-close>✕</button>
                </div>
                <div class="tq-ok-body">
                    <div style="margin-bottom:12px;">
                        <input type="text" id="tqeChequePickerSearch" class="tq-select" style="width:100%;"
                               placeholder="🔍 جستجو در سریال / در وجه / بانک / شماره حساب...">
                    </div>
                    <div class="table-wrapper" style="max-height:400px;overflow:auto;">
                        <table class="tq-table">
                            <thead>
                                <tr>
                                    <th style="width:110px;">سریال</th>
                                    <th style="width:100px;">تاریخ چک</th>
                                    <th style="width:120px;">مبلغ</th>
                                    <th>در وجه</th>
                                    <th style="width:120px;">بانک</th>
                                    <th style="width:90px;">شعبه</th>
                                    <th style="width:90px;">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody id="tqeChequePickerTbody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="tq-ok-footer">
                    <button class="btn btn-ghost" data-tqe-close>انصراف (Esc)</button>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════════════════
    async function removeItem(id) {
        const item = _items.find(x => x.id === id);
        const amount = item ? H.fmt(item.checkMab) : '';
        const ok = await window.App.confirm(
            `آیا از حذف خرج چک سریال ${item?.checkSeries || ''} به مبلغ ${amount} مطمئن هستید؟ سند حذف می‌شود و چک به حالت آزاد برمی‌گردد.`,
            { title: '🗑️ حذف خرج چک', danger: true, okText: 'بله، حذف کن' }
        );
        if (!ok) return;
        try {
            await window.App.Http.api(`${_apiBase}/${id}`, {
                method: 'DELETE', successMsg: 'خرج چک حذف شد'
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
        removeItem,
        buildChequeTableHtml
    };
})();

window.App.renderChequeExpend = () => window.App.Features.TreasuryChequeExpend.render();