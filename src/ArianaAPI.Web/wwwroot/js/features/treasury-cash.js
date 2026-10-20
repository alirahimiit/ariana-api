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

    let _kind = 0;
    let _items = [];
    let _page = 1;
    let _accFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
    let _hesabTreeCache = null;
    let _lastPickedName = '';
    let _lastPickedCodeCol = 0;
    let _lastPickedCodeMoein = 0;
    let _lastPickedCodeTafzil = 0;
    // ⭐ جدید: کش نام‌ها از tree
    let _hesabNameCache = {
        col: {},       // { 103: 'حساب‌های دریافتنی تجاری' }
        moein: {},     // { '103_4': 'حساب‌های دریافتنی تجاری' }
        tafzil: {}     // { 2116: 'علی رضا حاجیان فر' }
    };

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
            <div class="card tc-filter-card" id="tcFilterCard">
                <div class="card-title tc-filter-toggle" id="tcFilterToggle">
                    <span>🔍 فیلترها</span>
                    <span class="tc-filter-icon">▼</span>
                </div>
                <div class="tc-filter-body" id="tcFilterBody">
                    <div class="tc-filters-grid">
                        <div class="form-group">
                            <label>از تاریخ</label>
                            <input type="text" id="tcFromDate" placeholder="1404/01/01" dir="ltr">
                        </div>
                        <div class="form-group">
                            <label>تا تاریخ</label>
                            <input type="text" id="tcToDate" placeholder="1404/12/29" dir="ltr">
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

    // ⭐ تابع مستقل برای رندر کارت + دکمه
    function buildListCard(result) {
        const items = result?.items || [];
        const page = result?.page || 1;
        const pageSize = result?.pageSize || 100;
        const total = result?.totalCount || 0;

        // ─── بدنه (جدول یا خالی) ───
        let bodyHtml;
        if (items.length === 0) {
            bodyHtml = `
                <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                    <div style="font-size:56px;opacity:0.4;">${_icon()}</div>
                    <p style="margin-top:12px;">رسیدی یافت نشد</p>
                    <p style="margin-top:6px; font-size:12px; color:#94A3B8;">
                        برای شروع، دکمه «رسید جدید» را بزنید
                    </p>
                </div>`;
        } else {
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

            bodyHtml = `
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
                <div id="tcPagination"></div>`;
        }

        // ⭐ کارت کامل با دکمه در card-title
        return `
            <div class="card">
                <div class="card-title">
                    <span>${_icon()} لیست ${_title()} (${H.fmt(total)})</span>
                    <button class="btn btn-primary btn-sm" data-permission="146" id="tcNewBtn">
                        ➕ رسید جدید
                    </button>
                </div>
                ${bodyHtml}
            </div>
        `;
    }

    function renderList(result) {
        const container = document.getElementById('tcListContainer');
        container.innerHTML = buildListCard(result);

        // بایند دکمه جدید
        document.getElementById('tcNewBtn')?.addEventListener('click', () => openForm(null));

        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(container);

        const items = result.items || [];
        const total = result.totalCount || 0;
        const pageSize = result.pageSize || 100;
        const page = result.page || 1;

        const totalPages = Math.ceil(total / pageSize);
        if (totalPages > 1) {
            const pgEl = document.getElementById('tcPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(page, totalPages, total, items.length);
        }

        if (items.length > 0 && typeof Exporter !== 'undefined' && Exporter.attach) {
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
        const costRaw = parseFloat(data.cashCost);
        const costVal = !isNaN(costRaw) && costRaw > 0 ? costRaw : 0;
        const costStr = costVal > 0 ? costVal.toLocaleString('en-US') : '';
        const hasSanad = (data.parentSanadID || 0) > 0;

        const sanadOptions = ['<option value="">— بدون سند —</option>']
            .concat((sanadList || []).map(s =>
                `<option value="${s.parentSanadID}" ${s.parentSanadID === data.parentSanadID ? 'selected' : ''}>
                    ${H.fmt(s.noSanad)} — ${H.esc(s.dateIn || '')} — ${H.esc((s.sharh || '').substring(0, 40))}
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
                        <input type="text" id="tcfDateIn" value="${H.esc(dateIn)}" dir="ltr" placeholder="1404/01/01">
                    </div>
                    <div class="form-group">
                        <label>مبلغ <span class="req">*</span></label>
                        <input type="text" id="tcfCashCost" value="${costStr}" class="num-input tc-amount-input" dir="ltr">
                        <div class="tc-amount-words" id="tcfAmountWords"></div>
                    </div>
                </div>

                    <div class="tc-form-section">
                        <div class="tc-form-section-title">💼 حساب ${_partyLabel()}</div>
                        <div class="tc-hesab-row">
                            <div class="tc-hesab-field">
                                <label>کد کل</label>
                                <div class="tc-hesab-input">
                                    <input type="number" id="tcfCodeCol" value="${data.codeCol || ''}" class="num-input" dir="ltr" placeholder="مثلاً 103">
                                    <button type="button" class="btn btn-ghost btn-sm tc-pick-h" data-level="col" title="انتخاب کل">🏦</button>
                                </div>
                            </div>
                            <div class="tc-hesab-field">
                                <label>کد معین</label>
                                <div class="tc-hesab-input">
                                    <input type="number" id="tcfCodeMoein" value="${data.codeMoein || ''}" class="num-input" dir="ltr" placeholder="مثلاً 4">
                                    <button type="button" class="btn btn-ghost btn-sm tc-pick-h" data-level="moein" title="انتخاب معین">🏦</button>
                                </div>
                            </div>
                            <div class="tc-hesab-field">
                                <label>کد تفصیلی (مستقل)</label>
                                <div class="tc-hesab-input">
                                    <input type="number" id="tcfCodeTafzili" value="${data.codeTafzili || ''}" class="num-input" dir="ltr" placeholder="مثلاً 2116">
                                    <button type="button" class="btn btn-ghost btn-sm tc-pick-h" data-level="tafzil" title="انتخاب تفصیلی">🏦</button>
                                </div>
                            </div>
                            <div class="tc-hesab-field">
                                <label>&nbsp;</label>
                                <button type="button" class="btn btn-ghost btn-sm" id="tcfDefaultPersonBtn" title="حساب پیش‌فرض">⚙️</button>
                            </div>
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

    let _formKeyHandler = null;

    function bindFormEvents(data, isEdit) {
        const costInput = document.getElementById('tcfCashCost');
        costInput?.addEventListener('input', function () {
            // ⭐ فقط ارقام رو نگه‌دار
            const digitsOnly = this.value.replace(/[^\d]/g, '');
            const numVal = digitsOnly ? parseInt(digitsOnly, 10) : 0;

            // ⭐ فرمت زنده — با حفظ cursor
            const formatted = numVal > 0 ? numVal.toLocaleString('en-US') : '';
            this.value = formatted;

            // cursor آخرین جا
            try { this.setSelectionRange(formatted.length, formatted.length); } catch { }

            // ⭐ مبلغ به حروف
            const el = document.getElementById('tcfAmountWords');
            if (el) el.textContent = numVal > 0 ? H.toPersianWords(numVal) : '';
        });
        // ⭐ فقط اگه مقدار داره، input event بزن
        if (costInput && costInput.value.trim()) {
            costInput.dispatchEvent(new Event('input'));
        }

        async function refreshPersonName() {
            const cEl = document.getElementById('tcfCodeCol');
            const mEl = document.getElementById('tcfCodeMoein');
            const tEl = document.getElementById('tcfCodeTafzili');
            const el = document.getElementById('tcfPersonName');
            if (!el) return;

            const c = parseInt(cEl?.value) || 0;
            const m = parseInt(mEl?.value) || 0;
            const t = parseInt(tEl?.value) || 0;

            if (c <= 0 && t <= 0) {
                el.textContent = '—';
                return;
            }

            // ⭐ اگه همین حالا از Picker انتخاب شده، مستقیم نام رو نشون بده
            if (_lastPickedName
                && _lastPickedCodeCol === c
                && _lastPickedCodeMoein === m
                && _lastPickedCodeTafzil === t) {
                el.textContent = _lastPickedName;
                return;
            }

            // ⭐ در غیر این صورت، از tree نام رو پیدا کن
            const name = await resolveHesabName(c, m, t);
            if (name) {
                el.textContent = name;
            } else {
                // fallback: اگه پیدا نشد، کد نشون بده
                el.textContent = `${c}${m > 0 ? ' / ' + m : ''}${t > 0 ? ' / ' + t : ''}`;
            }
        }

        // ⭐ تابع کمکی: پیدا کردن نام از tree با کش
        // منطق: هر سطحی که پرشده رو با " - " به هم بچسبون
        async function resolveHesabName(codeCol, codeMoein, codeTafzil) {
            let tree;
            try { tree = await loadHesabTree(); }
            catch { return null; }

            const parts = [];

            // ─── ۱. کل ───
            if (codeCol > 0) {
                const cKey = codeCol;
                if (_hesabNameCache.col[cKey] === undefined) {
                    const c = (tree || []).find(x =>
                        x.level === 'col' && x.codeCol === codeCol
                    );
                    _hesabNameCache.col[cKey] = c ? (c.name || '') : '';
                }
                if (_hesabNameCache.col[cKey]) parts.push(_hesabNameCache.col[cKey]);
            }

            // ─── ۲. معین ───
            if (codeCol > 0 && codeMoein > 0) {
                const mKey = `${codeCol}_${codeMoein}`;
                if (_hesabNameCache.moein[mKey] === undefined) {
                    const m = (tree || []).find(x =>
                        x.level === 'moein' &&
                        x.codeCol === codeCol &&
                        x.codeMoein === codeMoein
                    );
                    _hesabNameCache.moein[mKey] = m ? (m.name || '') : '';
                }
                if (_hesabNameCache.moein[mKey]) parts.push(_hesabNameCache.moein[mKey]);
            }

            // ─── ۳. تفضیلی ───
            if (codeTafzil > 0) {
                const tKey = codeTafzil;
                if (_hesabNameCache.tafzil[tKey] === undefined) {
                    const t = (tree || []).find(x =>
                        (x.level === 'tafzil' || x.level === 'tafzili') &&
                        (x.codeTafzil === codeTafzil || x.codeTafzili === codeTafzil)
                    );
                    _hesabNameCache.tafzil[tKey] = t ? (t.name || '') : '';
                }
                if (_hesabNameCache.tafzil[tKey]) parts.push(_hesabNameCache.tafzil[tKey]);
            }

            return parts.length > 0 ? parts.join(' - ') : null;
        }
        ['tcfCodeCol', 'tcfCodeMoein', 'tcfCodeTafzili'].forEach(id => {
            document.getElementById(id)?.addEventListener('blur', async () => {   // ⭐ async
                await refreshPersonName();
            });
        });
        if (data.codeCol || data.codeTafzili) refreshPersonName();

        // ⭐ سه دکمه مستقل: کل / معین / تفصیلی
        // از HesabPicker مشترک پروژه استفاده می‌کنیم (مثل article-form.js)
        document.querySelectorAll('.tc-pick-h').forEach(btn => {
            btn.addEventListener('click', async () => {
                const level = btn.dataset.level;
                let result = null;

                try {
                    if (level === 'col') {
                        result = await window.App.UI.HesabPicker.open({
                            mode: 'col',
                            title: '🔍 انتخاب کد کل'
                        });
                        if (!result) return;
                        document.getElementById('tcfCodeCol').value = result.codeCol || 0;
                        // ⚠️ معین و تفصیلی رو پاک نکن — کاربر ممکنه قبلاً انتخاب کرده باشه
                        _lastPickedCodeCol = result.codeCol || 0;
                        _lastPickedName = result.name || '';

                    } else if (level === 'moein') {
                        result = await window.App.UI.HesabPicker.open({
                            mode: 'moein',
                            title: '🔍 انتخاب کد معین'
                        });
                        if (!result) return;
                        document.getElementById('tcfCodeCol').value = result.codeCol || 0;
                        document.getElementById('tcfCodeMoein').value = result.codeMoein || 0;
                        // ⚠️ تفصیلی مستقل هست — پاکش نکن
                        _lastPickedCodeCol = result.codeCol || 0;
                        _lastPickedCodeMoein = result.codeMoein || 0;
                        _lastPickedName = result.name || '';

                    } else if (level === 'tafzil') {
                        result = await window.App.UI.HesabPicker.open({
                            mode: 'tafzil',
                            title: '🔍 انتخاب کد تفصیلی'
                        });
                        if (!result) return;
                        document.getElementById('tcfCodeTafzili').value = result.codeTafzil || 0;
                        _lastPickedCodeTafzil = result.codeTafzil || 0;
                        _lastPickedName = result.name || '';
                    }

                    await refreshPersonName();    // ⭐ await اضافه شد
                } catch (err) {
                    window.App.toast('خطا در انتخاب: ' + err.message, 'error');
                }
            });
        });
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
                await refreshPersonName();    // ⭐ await اضافه شد
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

        if (_formKeyHandler) document.removeEventListener('keydown', _formKeyHandler);
        _formKeyHandler = (e) => {
            if (document.getElementById('tcHpStandalone')) return;

            if (e.key === 'F2') { e.preventDefault(); saveForm(data, isEdit); }
            else if (e.key === 'Escape') {
                e.preventDefault();
                window.App.closeModal();
            }
        };
        document.addEventListener('keydown', _formKeyHandler);
    }

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

        if (residNumber <= 0) {
            try {
                const nr = await window.App.Http.api(`/api/resid/next-number?checkKind=${_kind}`);
                residNumber = nr.residNumber;
            } catch (e) {
                window.App.toast('خطا در دریافت شماره رسید', 'error');
                return;
            }
        }

        // ⭐ اعتبارسنجی سختگیرانه‌ی تاریخ
        if (!dateIn) {
            window.App.toast('تاریخ الزامی است', 'error');
            g('tcfDateIn')?.focus();
            return;
        }
        if (dateIn.includes('?') || dateIn.includes('_')) {
            window.App.toast('تاریخ وارد شده معتبر نیست', 'error');
            g('tcfDateIn')?.focus();
            return;
        }
        // ⭐ چک فرمت ۱۴۰۵/۰۷/۲۳ (با ارقام لاتین یا فارسی)
        const normalized = dateIn
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(normalized)) {
            window.App.toast('فرمت تاریخ باید 1404/01/01 باشد', 'error');
            g('tcfDateIn')?.focus();
            return;
        }

        if (cashCost <= 0) { window.App.toast('مبلغ باید بزرگ‌تر از صفر باشد', 'error'); return; }
        if (codeCol <= 0) { window.App.toast('کد کل طرف حساب الزامی است', 'error'); return; }

        const payload = {
            checkKind: _kind,
            residNumber,
            dateIn: normalized,     // ⭐ ارسال با ارقام لاتین
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

    async function loadHesabTree() {
        if (_hesabTreeCache) return _hesabTreeCache;
        const tree = await window.App.Http.api('/api/hesab/tree');
        _hesabTreeCache = tree || [];
        return _hesabTreeCache;
    }

    // ═══════════════════════════════════════════════════
    //  PICKER — استفاده از HesabPicker مشترک پروژه
    //  قانون: سرچ + دستی + همه‌ی سطوح (کل/معین/تفضیلی/تفضیلی۲)
    // ═══════════════════════════════════════════════════
    async function openAccountFilterPicker() {
        const picked = await window.App.UI.HesabPicker.open({
            mode: 'moein',
            title: '🔍 انتخاب حساب برای فیلتر'
        });
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
    }
    // ═══════════════════════════════════════════════════
    //  FALLBACK — اگه HesabPicker مشترک لود نشده بود
    // ═══════════════════════════════════════════════════

    async function openAccountFilterPicker() {
        const picked = await pickHesabStandalone();
        if (!picked) return;
        _accFilter = {
            codeCol: picked.codeCol,
            codeMoein: picked.codeMoein,
            codeTafzil: picked.codeTafzil,
            label: picked.name ||
                [picked.codeCol, picked.codeMoein, picked.codeTafzil].filter(x => x > 0).join(' / ')
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