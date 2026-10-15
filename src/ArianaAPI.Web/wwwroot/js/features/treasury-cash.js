/* ═══════════════════════════════════════════════════
   Feature / TreasuryCash — دریافت/پرداخت نقدی
   CheckKind: 0=پرداخت، 1=دریافت
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.TreasuryCash = (function () {
    'use strict';

    const H = window.App.Helpers;
    const S = window.App.State;

    // ═══ STATE ═══
    let _kind = 0;
    let _items = [];
    let _page = 1;
    let _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
    let _hesabTreeCache = null;

    // ⭐ نام آخرین انتخاب از picker (برای نمایش بدون API)
    let _lastPickedName = '';
    let _lastPickedCodeCol = 0;
    let _lastPickedCodeMoein = 0;
    let _lastPickedCodeTafzil = 0;

    function _isPay() { return _kind === 0; }
    function _title() { return _isPay() ? 'پرداخت نقدی' : 'دریافت نقدی'; }
    function _icon() { return _isPay() ? '💸' : '💵'; }
    function _partyLabel() { return _isPay() ? 'دریافت‌کننده' : 'پرداخت‌کننده'; }
    function _partyChtType() { return _isPay() ? 19 : 18; }

    // ═══════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════
    function render(kind) {
        _kind = (kind === 1) ? 1 : 0;
        window.App.state.currentPage = _isPay() ? 'pay-cash' : 'receive-cash';
        _page = 1;

        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="tc-page-header">
                <h2>${_icon()} ${_title()}</h2>
                <button class="btn btn-primary btn-sm" data-permission="146" id="tcNewBtn">
                    ➕ رسید جدید
                </button>
            </div>

            <div class="card tc-filter-card" id="tcFilterCard">
                <div class="card-title tc-filter-toggle" id="tcFilterToggle">
                    <span>🔍 فیلترها</span>
                    <span class="tc-filter-icon">▼</span>
                </div>
                <div class="tc-filter-body" id="tcFilterBody">
                    <div class="tc-filters-grid">
                        <div class="form-group">
                            <label>از تاریخ</label>
                            <input type="text" id="tcFromDate" placeholder="1404/01/01" class="num-input" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تا تاریخ</label>
                            <input type="text" id="tcToDate" placeholder="1404/12/29" class="num-input" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>از شماره</label>
                            <input type="number" id="tcFromNo">
                        </div>
                        <div class="form-group">
                            <label>تا شماره</label>
                            <input type="number" id="tcToNo">
                        </div>
                        <div class="form-group tc-col-2">
                            <label>شرح</label>
                            <input type="text" id="tcDescript" placeholder="جستجو در شرح...">
                        </div>
                        <div class="form-group tc-col-2">
                            <label>طرف حساب (${_partyLabel()})</label>
                            <div class="tc-account-row">
                                <button type="button" class="btn btn-ghost btn-sm" id="tcPickAccountBtn">
                                    🏦 انتخاب
                                </button>
                                <span id="tcAccountLabel" class="tc-account-label"></span>
                                <button type="button" class="btn btn-ghost btn-sm" id="tcClearAccountBtn" style="display:none;">
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="tc-filter-actions">
                        <button class="btn btn-primary" id="tcRunBtn">🔍 جستجو</button>
                        <button class="btn btn-ghost" id="tcResetBtn">↻ پاک کردن</button>
                    </div>
                </div>
            </div>

            <div id="tcListContainer"></div>
        `;

        document.getElementById('tcNewBtn')?.addEventListener('click', () => openForm(null));
        document.getElementById('tcRunBtn')?.addEventListener('click', () => { _page = 1; loadList(); });
        document.getElementById('tcResetBtn')?.addEventListener('click', resetFilters);
        document.getElementById('tcPickAccountBtn')?.addEventListener('click', openAccountFilterPicker);
        document.getElementById('tcClearAccountBtn')?.addEventListener('click', clearAccountFilter);

        document.getElementById('tcFilterToggle')?.addEventListener('click', () => {
            document.getElementById('tcFilterCard').classList.toggle('collapsed');
        });

        ['tcFromDate', 'tcToDate', 'tcFromNo', 'tcToNo', 'tcDescript'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') { _page = 1; loadList(); }
            });
        });

        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(c);
        loadList();
    }

    function resetFilters() {
        ['tcFromDate', 'tcToDate', 'tcFromNo', 'tcToNo', 'tcDescript']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
        updateAccountBar();
        _page = 1;
        loadList();
    }

    // ═══════════════════════════════════════════════════
    //  LIST
    // ═══════════════════════════════════════════════════
    async function loadList() {
        const container = document.getElementById('tcListContainer');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const result = await window.App.Http.api('/api/resid/list', {
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
            checkKind: _kind,
            fromDate: g('tcFromDate'),
            toDate: g('tcToDate'),
            fromNumber: gi('tcFromNo'),
            toNumber: gi('tcToNo'),
            descript: g('tcDescript'),
            codeCol: _accFilter.codeCol || null,
            codeMoein: _accFilter.codeMoein || null,
            codeTafzili: _accFilter.codeTafzil || null,
            sortBy: 'residNumber',
            sortDir: 'desc',
            page: _page,
            pageSize: S.getSettings().pageSize || 100
        };
    }

    function renderList(r) {
        const container = document.getElementById('tcListContainer');
        const items = r.items || [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                        <div style="font-size:56px;opacity:0.4;">${_icon()}</div>
                        <p style="margin-top:12px;">رسیدی یافت نشد</p>
                    </div>
                </div>`;
            return;
        }

        const rows = items.map(it => {
            const noSanad = it.noSanad ? `✅ ${H.fmt(it.noSanad)}` : '🚫';
            const lock = (it.sanadVazeit === 2) ? ' 🔒' : '';
            return `
                <tr data-id="${it.id}">
                    <td class="num text-center">${H.fmt(it.residNumber)}</td>
                    <td class="num text-center">${H.esc(it.dateIn || '-')}</td>
                    <td class="num text-center">${it.codeCol || '-'}</td>
                    <td class="num text-center">${it.codeMoein || '-'}</td>
                    <td class="num text-center">${it.codeTafzili || '-'}</td>
                    <td class="tc-hesab-name">${H.esc(it.hesabNameCalc || '-')}</td>
                    <td class="tc-descript">${H.esc(it.descript || '-')}</td>
                    <td class="num text-left"><strong>${H.fmt(it.cashCost)}</strong></td>
                    <td class="text-center">${noSanad}${lock}</td>
                    <td class="text-center tc-actions">
                        <button class="btn btn-sm btn-ghost" title="ویرایش"
                                onclick="event.stopPropagation();App.Features.TreasuryCash.openForm(${it.id})"
                                data-permission="147">✏️</button>
                        <button class="btn btn-sm btn-ghost" title="حذف"
                                onclick="event.stopPropagation();App.Features.TreasuryCash.removeItem(${it.id})"
                                style="color:var(--danger);" data-permission="148">🗑️</button>
                    </td>
                </tr>`;
        }).join('');

        const page = r.page || 1;
        const pageSize = r.pageSize || 100;
        const total = r.totalCount || 0;

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>${_icon()} لیست ${_title()} (${H.fmt(total)})</span>
                </div>
                <div class="table-wrapper">
                    <table class="tc-table">
                        <thead>
                            <tr>
                                <th style="width:70px;">شماره</th>
                                <th style="width:95px;">تاریخ</th>
                                <th style="width:60px;">کل</th>
                                <th style="width:70px;">معین</th>
                                <th style="width:80px;">تفضیلی</th>
                                <th>طرف حساب</th>
                                <th>شرح</th>
                                <th class="text-left" style="width:120px;">مبلغ</th>
                                <th style="width:75px;">سند</th>
                                <th style="width:100px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div id="tcPagination"></div>
            </div>
        `;

        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(container);

        const totalPages = Math.ceil(total / pageSize);
        if (totalPages > 1) {
            const pgEl = document.getElementById('tcPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(page, totalPages, total, items.length);
        }

        if (typeof Exporter !== 'undefined' && Exporter.attach) {
            Exporter.attach(container, {
                title: `لیست ${_title()}`,
                subtitle: subtitle(),
                filename: _isPay() ? 'PayCash' : 'ReceiveCash'
            });
        }
        if (window.App.enhanceTables) window.App.enhanceTables(container);
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.TreasuryCash.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)}</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryCash.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.TreasuryCash.goToPage(${page - 1})">‹</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryCash.goToPage(${page + 1})">›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.TreasuryCash.goToPage(${totalPages})">»</button>
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

    // ═══════════════════════════════════════════════════
    //  FORM
    // ═══════════════════════════════════════════════════
    async function openForm(id) {
        let data = null;
        let isEdit = false;

        if (id) {
            isEdit = true;
            try {
                data = await window.App.Http.api(`/api/resid/${id}`);
                if (!data) { window.App.toast('رسید یافت نشد', 'error'); return; }
                if (data.sanadVazeit === 2) {
                    window.App.toast('سند قطعی است و قابل ویرایش نیست', 'warning');
                    return;
                }
            } catch (err) {
                window.App.toast('خطا: ' + err.message, 'error');
                return;
            }
        } else {
            try {
                const nr = await window.App.Http.api(`/api/resid/next-number?checkKind=${_kind}`);
                data = { residNumber: nr.residNumber };
            } catch (e) { data = { residNumber: 0 }; }
        }

        let sanadList = [];
        try { sanadList = await window.App.Http.api('/api/resid/sanad-list'); }
        catch (e) { sanadList = []; }

        // ⭐ ریست نام پیک
        _lastPickedName = '';
        _lastPickedCodeCol = 0;
        _lastPickedCodeMoein = 0;
        _lastPickedCodeTafzil = 0;

        window.App.openModal(
            `${_icon()} ${isEdit ? 'ویرایش' : 'رسید جدید'} — ${_title()}`,
            buildFormHtml(data, isEdit, sanadList)
        );

        bindFormEvents(data, isEdit);
    }

    function buildFormHtml(data, isEdit, sanadList) {
        const today = H.todayPersian ? H.todayPersian() : '';
        const dateIn = data.dateIn || today;
        const cost = data.cashCost || 0;
        const hasSanad = (data.parentSanadID || 0) > 0;

        const sanadOptions = ['<option value="">— بدون سند —</option>']
            .concat((sanadList || []).map(s =>
                `<option value="${s.parentSanadID}" ${s.parentSanadID === data.parentSanadID ? 'selected' : ''}>
                    ${H.fmt(s.noSanad)} — ${H.esc((s.sharh || '').substring(0, 40))}
                 </option>`
            )).join('');

        return `
            <div class="tc-form" data-help="treasury-cash-form">
                <div class="tc-form-grid">
                    <div class="form-group">
                        <label>شماره رسید <span class="req">*</span></label>
                        <input type="number" id="tcfResidNumber" value="${data.residNumber || ''}" class="num-input" dir="ltr">
                    </div>
                    <div class="form-group">
                        <label>تاریخ <span class="req">*</span></label>
                        <input type="text" id="tcfDateIn" value="${H.esc(dateIn)}" class="num-input" dir="ltr" placeholder="1404/01/01">
                    </div>
                    <div class="form-group">
                        <label>مبلغ <span class="req">*</span></label>
                        <input type="text" id="tcfCashCost" value="${H.fmt(cost)}" class="num-input tc-amount-input" dir="ltr">
                        <div class="tc-amount-words" id="tcfAmountWords"></div>
                    </div>
                </div>

                <div class="tc-form-section">
                    <div class="tc-form-section-title">💼 حساب ${_partyLabel()}</div>
                    <div class="tc-hesab-row">
                        <input type="number" id="tcfCodeCol" value="${data.codeCol || ''}" placeholder="کد کل" class="num-input" dir="ltr">
                        <input type="number" id="tcfCodeMoein" value="${data.codeMoein || ''}" placeholder="کد معین" class="num-input" dir="ltr">
                        <input type="number" id="tcfCodeTafzili" value="${data.codeTafzili || ''}" placeholder="کد تفصیلی" class="num-input" dir="ltr">
                        <button type="button" class="btn btn-ghost btn-sm" id="tcfPickPersonBtn">🏦 انتخاب</button>
                        <button type="button" class="btn btn-ghost btn-sm" id="tcfDefaultPersonBtn" title="حساب پیش‌فرض">⚙️</button>
                    </div>
                    <div class="tc-hesab-preview" id="tcfPersonName">—</div>
                </div>

                <div class="tc-form-section">
                    <div class="form-group">
                        <label>شرح</label>
                        <input type="text" id="tcfDescript" value="${H.esc(data.descript || '')}" maxlength="200" placeholder="توضیحات...">
                    </div>
                </div>

                <div class="tc-form-section tc-form-sanad">
                    <div class="tc-form-section-title">📄 سند حسابداری</div>
                    <div class="tc-sanad-row">
                        <label class="tc-checkbox-label">
                            <input type="checkbox" id="tcfSaveSanad" ${hasSanad ? 'checked' : (!isEdit ? 'checked' : '')}>
                            <span>صدور سند خودکار</span>
                        </label>
                        <div class="tc-sanad-combo-wrap">
                            <label>سند موجود</label>
                            <select id="tcfParentSanadID" class="tc-select" ${hasSanad ? '' : 'disabled'}>
                                ${sanadOptions}
                            </select>
                        </div>
                    </div>
                    <p class="tc-hint">⚙️ حساب صندوق از «حساب‌های پیش‌فرض» خوانده می‌شود.</p>
                </div>

                <div class="tc-form-footer">
                    <button class="btn btn-primary" id="tcfSaveBtn">💾 ذخیره (F2)</button>
                    <button class="btn btn-ghost" id="tcfCancelBtn">انصراف (Esc)</button>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════
    //  BIND FORM
    // ═══════════════════════════════════════════════════
    let _formKeyHandler = null;

    function bindFormEvents(data, isEdit) {
        const costInput = document.getElementById('tcfCashCost');
        costInput?.addEventListener('input', () => {
            const val = H.parseNumber(costInput.value) || 0;
            const el = document.getElementById('tcfAmountWords');
            if (el) el.textContent = val > 0 ? toPersianWords(val) : '';
        });
        costInput?.addEventListener('blur', () => {
            const val = H.parseNumber(costInput.value) || 0;
            costInput.value = H.fmt(val);
        });
        costInput?.dispatchEvent(new Event('input'));

        function refreshPersonName() {
            const c = parseInt(document.getElementById('tcfCodeCol').value) || 0;
            const m = parseInt(document.getElementById('tcfCodeMoein').value) || 0;
            const t = parseInt(document.getElementById('tcfCodeTafzili').value) || 0;
            const el = document.getElementById('tcfPersonName');
            if (!el) return;
            if (c <= 0) { el.textContent = '—'; return; }

            if (_lastPickedName
                && _lastPickedCodeCol === c
                && _lastPickedCodeMoein === m
                && _lastPickedCodeTafzil === t) {
                el.textContent = _lastPickedName;
                return;
            }
            el.textContent = `${c}${m > 0 ? ' / ' + m : ''}${t > 0 ? ' / ' + t : ''}`;
        }

        ['tcfCodeCol', 'tcfCodeMoein', 'tcfCodeTafzili'].forEach(id => {
            document.getElementById(id)?.addEventListener('blur', refreshPersonName);
        });
        if (data.codeCol) refreshPersonName();

        // ─── Picker ───
        document.getElementById('tcfPickPersonBtn')?.addEventListener('click', async () => {
            const picked = await pickHesabStandalone();
            if (!picked) return;
            document.getElementById('tcfCodeCol').value = picked.codeCol || 0;
            document.getElementById('tcfCodeMoein').value = picked.codeMoein || 0;
            document.getElementById('tcfCodeTafzili').value = picked.codeTafzil || 0;
            _lastPickedCodeCol = picked.codeCol;
            _lastPickedCodeMoein = picked.codeMoein;
            _lastPickedCodeTafzil = picked.codeTafzil;
            _lastPickedName = picked.name || '';
            refreshPersonName();
        });

        // ─── حساب پیش‌فرض ───
        document.getElementById('tcfDefaultPersonBtn')?.addEventListener('click', async () => {
            try {
                const list = await window.App.Http.api('/api/const-hesab/list');
                const target = list.find(x => x.type === _partyChtType());
                if (!target || !target.isSet) {
                    await window.App.alert.warning(
                        `حساب «${_isPay() ? 'بستانکاران' : 'بدهکاران'}» در «حساب‌های پیش‌فرض» تعریف نشده است`,
                        { title: 'یافت نشد' });
                    return;
                }
                document.getElementById('tcfCodeCol').value = target.codeCol || 0;
                document.getElementById('tcfCodeMoein').value = target.codeMoein || 0;
                document.getElementById('tcfCodeTafzili').value = target.codeTafzil || 0;
                _lastPickedName = target.hesabName || target.colName || '';
                _lastPickedCodeCol = target.codeCol;
                _lastPickedCodeMoein = target.codeMoein;
                _lastPickedCodeTafzil = target.codeTafzil;
                refreshPersonName();
            } catch (err) {
                window.App.toast('خطا: ' + err.message, 'error');
            }
        });

        const cb = document.getElementById('tcfSaveSanad');
        const combo = document.getElementById('tcfParentSanadID');
        cb?.addEventListener('change', () => {
            combo.disabled = !cb.checked;
            if (!cb.checked) combo.value = '';
        });

        document.getElementById('tcfSaveBtn')?.addEventListener('click', () => saveForm(data, isEdit));
        document.getElementById('tcfCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        // ⭐ F2 / Esc — با چک overlay picker
        if (_formKeyHandler) document.removeEventListener('keydown', _formKeyHandler);
        _formKeyHandler = (e) => {
            // اگه picker باز باشه، به مودال پدر کاری نداشته باش
            if (document.getElementById('tcHpStandalone')) return;

            if (e.key === 'F2') { e.preventDefault(); saveForm(data, isEdit); }
            else if (e.key === 'Escape') {
                e.preventDefault();
                window.App.closeModal();
            }
        };
        document.addEventListener('keydown', _formKeyHandler);
    }

    // ═══════════════════════════════════════════════════
    //  SAVE
    // ═══════════════════════════════════════════════════
    async function saveForm(oldData, isEdit) {
        const g = id => document.getElementById(id);
        const gi = id => parseInt(g(id)?.value) || 0;
        const gs = id => g(id)?.value?.trim() || '';

        let residNumber = gi('tcfResidNumber');
        const dateIn = gs('tcfDateIn');
        const cashCost = H.parseNumber(g('tcfCashCost').value) || 0;
        const codeCol = gi('tcfCodeCol');
        const codeMoein = gi('tcfCodeMoein');
        const codeTafzili = gi('tcfCodeTafzili');
        const descript = gs('tcfDescript');

        const saveWithSanad = g('tcfSaveSanad').checked;
        const parentSanadID = saveWithSanad ? (parseInt(g('tcfParentSanadID').value) || 0) : 0;

        // ⭐ اگه شماره صفره، از سرور بگیر
        if (residNumber <= 0) {
            try {
                const nr = await window.App.Http.api(`/api/resid/next-number?checkKind=${_kind}`);
                residNumber = nr.residNumber;
            } catch (e) {
                window.App.toast('خطا در دریافت شماره رسید', 'error');
                return;
            }
        }

        if (!dateIn) { window.App.toast('تاریخ الزامی است', 'error'); return; }
        if (cashCost <= 0) { window.App.toast('مبلغ باید بزرگ‌تر از صفر باشد', 'error'); return; }
        if (codeCol <= 0) { window.App.toast('کد کل طرف حساب الزامی است', 'error'); return; }

        // ⭐ NoSanad: اگه سند خودکار می‌خوایم و شماره خاصی نداده، null بفرست
        const payload = {
            checkKind: _kind,
            residNumber,
            dateIn,
            cashCost,
            descript,
            codeCol,
            codeMoein,
            codeTafzili,
            saveWithSanad,
            noSanad: (saveWithSanad && parentSanadID === 0) ? null : 0,
            parentSanadID: parentSanadID || null
        };

        const btn = g('tcfSaveBtn');
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ در حال ذخیره...';

        try {
            if (isEdit) {
                payload.id = oldData.id;
                await window.App.Http.api('/api/resid/' + oldData.id, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                    successMsg: 'رسید ویرایش شد'
                });
            } else {
                await window.App.Http.api('/api/resid', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    successMsg: 'رسید جدید ثبت شد'
                });
            }

            if (_formKeyHandler) { document.removeEventListener('keydown', _formKeyHandler); _formKeyHandler = null; }
            window.App.closeModal();
            loadList();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    // ═══════════════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════════════
    async function removeItem(id) {
        const item = _items.find(x => x.id === id);
        const amount = item ? H.fmt(item.cashCost) : '';

        const ok = await window.App.confirm(
            `آیا از حذف رسید شماره ${item?.residNumber || ''} به مبلغ ${amount} مطمئن هستید؟`,
            { title: '🗑️ حذف رسید', danger: true, okText: 'بله، حذف کن', cancelText: 'لغو' }
        );
        if (!ok) return;

        try {
            await window.App.Http.api('/api/resid/' + id, {
                method: 'DELETE',
                successMsg: 'رسید حذف شد'
            });
            loadList();
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا در حذف', { title: 'خطا' });
        }
    }

    // ═══════════════════════════════════════════════════
    //  HESAB TREE
    // ═══════════════════════════════════════════════════
    async function loadHesabTree() {
        if (_hesabTreeCache) return _hesabTreeCache;
        const tree = await window.App.Http.api('/api/hesab/tree');
        _hesabTreeCache = tree || [];
        return _hesabTreeCache;
    }

    // ═══════════════════════════════════════════════════
    //  ⭐ STANDALONE PICKER — overlay مستقل (قانون طلایی)
    //  مودال پدر رو نمی‌بنده — z-index بالاتر
    // ═══════════════════════════════════════════════════
    function pickHesabStandalone() {
        return new Promise((resolve) => {

            document.getElementById('tcHpStandalone')?.remove();

            const overlay = document.createElement('div');
            overlay.id = 'tcHpStandalone';
            overlay.className = 'tc-hp-overlay';
            overlay.style.zIndex = '11000';        // ⭐ بالاتر از مودال پدر
            overlay.innerHTML = `
                <div class="tc-hp-box">
                    <div class="tc-hp-header">
                        <span>🏦 انتخاب حساب</span>
                        <button type="button" class="tc-hp-close" id="tcHpClose">✕</button>
                    </div>
                    <div class="tc-hp-search-wrap">
                        <input type="text" id="tcHpSearch"
                               placeholder="🔍 جستجو در کد یا نام..."
                               autocomplete="off">
                    </div>
                    <div class="tc-hp-body" id="tcHpList">
                        <div class="tc-hp-empty">در حال بارگذاری...</div>
                    </div>
                    <div class="tc-hp-footer">
                        <span class="tc-hp-hint">
                            💡 برای انتخاب تفضیلی، مستقیم روی ردیف تفضیلی کلیک کنید
                        </span>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const closeOverlay = (result) => {
                document.removeEventListener('keydown', escHandler, true);
                overlay.remove();
                resolve(result);
            };

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    closeOverlay(null);
                }
            };
            document.addEventListener('keydown', escHandler, true);

            // کلیک روی backdrop → بستن
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeOverlay(null);
            });

            overlay.querySelector('#tcHpClose')?.addEventListener('click', () => closeOverlay(null));

            // ─── بارگذاری درخت ───
            (async () => {
                let tree;
                try {
                    tree = await loadHesabTree();
                } catch (err) {
                    document.getElementById('tcHpList').innerHTML =
                        `<div class="tc-hp-empty">خطا: ${H.esc(err.message)}</div>`;
                    return;
                }

                const cols = (tree || []).filter(x => x.level === 'col');
                const moeins = (tree || []).filter(x => x.level === 'moein');
                const tafzils = (tree || []).filter(x =>
                    x.level === 'tafzil' || x.level === 'tafzili' || x.level === 'tafzili1');

                const list = document.getElementById('tcHpList');
                const search = document.getElementById('tcHpSearch');

                function render(filter = '') {
                    const f = filter.trim().toLowerCase();
                    let html = '';

                    const fCols = !f ? cols.slice(0, 100) : cols.filter(x =>
                        String(x.codeCol).includes(f) ||
                        (x.name || '').toLowerCase().includes(f)
                    ).slice(0, 100);

                    const fMoeins = !f ? moeins.slice(0, 200) : moeins.filter(x =>
                        String(x.codeMoein).includes(f) ||
                        String(x.codeCol).includes(f) ||
                        (x.name || '').toLowerCase().includes(f)
                    ).slice(0, 200);

                    const fTafzils = !f ? tafzils.slice(0, 200) : tafzils.filter(x =>
                        String(x.codeTafzil || 0).includes(f) ||
                        String(x.codeCol || 0).includes(f) ||
                        String(x.codeMoein || 0).includes(f) ||
                        (x.name || '').toLowerCase().includes(f)
                    ).slice(0, 200);

                    if (fCols.length > 0) {
                        html += '<div class="tc-hp-group-title">🔷 حساب‌های کل</div>';
                        html += fCols.map(c => `
                            <div class="tc-hp-item"
                                 data-col="${c.codeCol}" data-moein="0" data-tafzil="0"
                                 data-name="${H.esc(c.name || '')}">
                                <span class="tc-hp-badge">${c.codeCol}</span>
                                <span class="tc-hp-name">${H.esc(c.name || '')}</span>
                            </div>`).join('');
                    }

                    if (fMoeins.length > 0) {
                        html += '<div class="tc-hp-group-title">🔶 حساب‌های معین</div>';
                        html += fMoeins.map(m => `
                            <div class="tc-hp-item"
                                 data-col="${m.codeCol}" data-moein="${m.codeMoein}" data-tafzil="0"
                                 data-name="${H.esc(m.name || '')}">
                                <span class="tc-hp-badge">${m.codeCol} / ${m.codeMoein}</span>
                                <span class="tc-hp-name">${H.esc(m.name || '')}</span>
                                ${m.hasTafzili ? '<span class="tc-hp-tag">تفضیلی دارد</span>' : ''}
                            </div>`).join('');
                    }

                    if (fTafzils.length > 0) {
                        html += '<div class="tc-hp-group-title">👤 تفضیلی‌ها</div>';
                        html += fTafzils.map(t => {
                            const code = t.codeTafzil || t.codeTafzili || 0;
                            return `
                                <div class="tc-hp-item"
                                     data-col="${t.codeCol || -1}"
                                     data-moein="${t.codeMoein || 0}"
                                     data-tafzil="${code}"
                                     data-name="${H.esc(t.name || '')}">
                                    <span class="tc-hp-badge">${code}</span>
                                    <span class="tc-hp-name">${H.esc(t.name || '')}</span>
                                </div>`;
                        }).join('');
                    }

                    if (!html) html = '<div class="tc-hp-empty">موردی یافت نشد</div>';
                    list.innerHTML = html;
                }

                render();
                search.addEventListener('input', () => render(search.value));

                list.addEventListener('click', (e) => {
                    const item = e.target.closest('.tc-hp-item');
                    if (!item) return;

                    const c = parseInt(item.dataset.col) || 0;
                    const m = parseInt(item.dataset.moein) || 0;
                    const t = parseInt(item.dataset.tafzil) || 0;
                    const name = item.dataset.name || '';

                    // اگه کد کل -1 باشه (تفضیلی)، روی معین 0 می‌ذاریم
                    const finalCol = (c === -1) ? 0 : c;

                    closeOverlay({
                        codeCol: finalCol,
                        codeMoein: m,
                        codeTafzil: t,
                        name: name
                    });
                });

                search.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const first = list.querySelector('.tc-hp-item');
                        if (first) first.click();
                    }
                });

                setTimeout(() => search.focus(), 50);
            })();
        });
    }

    // ═══════════════════════════════════════════════════
    //  ACCOUNT FILTER (بالای صفحه)
    // ═══════════════════════════════════════════════════
    async function openAccountFilterPicker() {
        const picked = await pickHesabStandalone();
        if (!picked) return;
        _accFilter = {
            codeCol: picked.codeCol,
            codeMoein: picked.codeMoein,
            codeTafzil: picked.codeTafzil,
            label: picked.name ||
                [picked.codeCol, picked.codeMoein, picked.codeTafzil]
                    .filter(x => x > 0).join(' / ')
        };
        updateAccountBar();
        _page = 1;
        loadList();
    }

    function clearAccountFilter() {
        _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
        updateAccountBar();
        _page = 1;
        loadList();
    }

    function updateAccountBar() {
        const label = document.getElementById('tcAccountLabel');
        const clear = document.getElementById('tcClearAccountBtn');
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

    // ═══════════════════════════════════════════════════
    //  مبلغ به حروف
    // ═══════════════════════════════════════════════════
    function toPersianWords(n) {
        if (!n) return '';
        const yekan = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
        const dahgan = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
        const dah = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
        const sadgan = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];

        function three(x) {
            const s = Math.floor(x / 100);
            const d = Math.floor((x % 100) / 10);
            const y = x % 10;
            let out = [];
            if (s > 0) out.push(sadgan[s]);
            if (d === 1) out.push(dah[y]);
            else {
                if (d > 1) out.push(dahgan[d]);
                if (y > 0) out.push(yekan[y]);
            }
            return out.join(' و ');
        }

        n = Math.floor(Math.abs(n));
        if (n === 0) return 'صفر';

        const parts = [];
        const million = Math.floor(n / 1000000);
        const thousand = Math.floor((n % 1000000) / 1000);
        const rest = n % 1000;

        if (million > 0) parts.push(three(million) + ' میلیون');
        if (thousand > 0) parts.push(three(thousand) + ' هزار');
        if (rest > 0) parts.push(three(rest));

        return parts.join(' و ') + ' ریال';
    }

    // ═══════════════════════════════════════════════════
    //  EXPOSE
    // ═══════════════════════════════════════════════════
    return {
        render,
        loadList,
        goToPage,
        openForm,
        removeItem,
        renderPay: () => render(0),
        renderReceive: () => render(1)
    };
})();

window.App.renderPayCash = () => window.App.Features.TreasuryCash.render(0);
window.App.renderReceiveCash = () => window.App.Features.TreasuryCash.render(1);