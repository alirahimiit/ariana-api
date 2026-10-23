/* ═══════════════════════════════════════════════════
   Feature / StockForm — فرم رسید/حواله/رسید برگشتی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.StockForm = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;
    const KIND_TITLES = { 0: '📨 رسید انبار', 1: '🔄 حواله انبار', 2: '📩 رسید برگشتی' };

    let _ctx = null;
    let _lookups = null;
    let _state = { items: [], header: {}, isStandalone: true };
    let _sanadListForForm = [];
    let _factorListForForm = [];
    let _keyHandler = null;

    // ═══ لود لیست اسناد و فاکتورها ═══
    async function loadLookupsForForm() {
        try {
            const [sanads, factors] = await Promise.all([
                window.App.Http.api('/api/factor/sanad-list', { silent: true }).catch(() => []),
                window.App.Http.api('/api/stock/factor-list', { silent: true }).catch(() => [])
            ]);
            _sanadListForForm = Array.isArray(sanads) ? sanads : [];
            _factorListForForm = Array.isArray(factors) ? factors : [];
        } catch (err) {
            console.warn('Error loading dropdown lists', err);
        }
    }

    // ═══ باز کردن فرم ═══
    async function open(ctx) {
        _ctx = ctx;
        _state.items = [];

        try {
            _lookups = await window.App.Http.api('/api/stock/lookups');
            await loadLookupsForForm();
        } catch (e) {
            window.App.toast('خطا در بارگذاری اطلاعات پایه', 'error');
            return;
        }

        if (ctx.mode === 'edit') {
            try {
                const detail = await window.App.Http.api('/api/stock/' + ctx.id);
                _state.header = detail;
                _state.items = (detail.items || []).map(it => ({
                    _tmpId: 'tmp_' + Math.random().toString(36).slice(2),
                    articleId: it.articleId, articleCode: it.articleCode,
                    articleName: it.articleName, unitName: it.articleUnit,
                    val: it.val, cost: it.cost
                }));
            } catch (e) {
                window.App.toast('خطا در بارگذاری سند', 'error'); return;
            }
        } else {
            _state.header.code = null;
            _state.header.specialCode = null;
            _state.header.dateIn = _lookups.todayDate;
            _state.header.kind = ctx.kind;
            _state.header.saveSanad = true;
            _state.header.noSanad = 0;
            _state.header.saveFactor = false;
            _state.header.noFactor = 0;
            _state.header.des = '';

            try {
                const nx = await window.App.Http.api(`/api/stock/next-number?kind=${ctx.kind}`);
                _state.header.code = nx.code;
            } catch { }
        }

        render();
    }

    // ═══ رندر اصلی ═══
    function render() {
        document.getElementById('stockFormOverlay')?.remove();
        const kind = _state.header.kind;
        const title = KIND_TITLES[kind] + (_ctx.mode === 'edit' ? ' — ویرایش' : ' — جدید');
        const showFactor = kind === 1;

        const stockTypeOpts = _lookups.stockTypes.map(s => `<option value="${s.id}" ${String(_state.header.stockTypeId) === String(s.id) ? 'selected' : ''}>${H.esc(s.name)}</option>`).join('');
        const descOpts = (_lookups.descriptions || []).map(d => `<option value="${H.esc(d)}">`).join('');

        // ⭐ ساخت گزینه‌های CustomSelect برای سند
        let sanadOpts = [{ value: '0', label: '0 — سند جدید خودکار' }];
        _sanadListForForm.forEach(s => {
            const vazeit = s.vazeit === 0 ? '📝' : s.vazeit === 1 ? '⏳' : '🔒';
            sanadOpts.push({ value: String(s.noSanad), label: `${vazeit} ${s.noSanad} — ${s.dateIn || ''}` });
        });

        // ⭐ ساخت گزینه‌های CustomSelect برای فاکتور
        let factorOpts = [{ value: '0', label: '0 — فاکتور جدید خودکار' }];
        _factorListForForm.forEach(f => {
            factorOpts.push({ value: String(f.noFactor), label: `#${f.noFactor} — ${f.hesabName || ''}` });
        });

        const overlay = document.createElement('div');
        overlay.id = 'stockFormOverlay';
        overlay.className = 'hp-overlay';
        overlay.style.zIndex = '11000';
        overlay.innerHTML = `
        <div class="hp-box stock-form-box" style="width:min(96vw, 1000px);">
            <div class="hp-header">
                <span>${title}</span>
                <button type="button" class="hp-close" id="sfkClose">✕</button>
            </div>
            <div class="sfk-body"> 
                
                <div class="card sfk-header-card">
                    <div class="sfk-header-grid">
                        <div class="form-group">
                            <label>شماره سیستمی</label>
                            <input type="text" id="sfkCode" dir="ltr" value="${_state.header.code || ''}">
                        </div>
                        <div class="form-group">
                            <label>شماره ${kind === 0 ? 'رسید' : kind === 1 ? 'حواله' : 'برگشتی'}</label>
                            <input type="text" id="sfkSpecialCode" dir="ltr" value="${_state.header.specialCode || ''}">
                        </div>
                        <div class="form-group">
                            <label>تاریخ <span class="req">*</span></label>
                            <input type="text" id="sfkDateIn" value="${_state.header.dateIn || ''}">
                        </div>
                        <div class="form-group">
                            <label>انبار <span class="req">*</span></label>
                            <select id="sfkStockType" class="form-select" style="width:100%;"><option value="">انتخاب کنید...</option>${stockTypeOpts}</select>
                        </div>
                        <div class="form-group sfk-col-span2">
                            <label>شرح</label>
                            <input type="text" id="sfkDes" list="sfkDesList" autocomplete="off" value="${H.esc(_state.header.des || '')}" placeholder="شرح را تایپ کنید...">
                            <datalist id="sfkDesList">${descOpts}</datalist>
                        </div>
                    </div>

                    <div class="sfk-checkboxes ${showFactor ? '' : 'single-col'}">
                        <div>
                            <label class="sfk-checkbox" style="margin-bottom:8px;">
                                <input type="checkbox" id="sfkSaveSanad" ${_state.header.saveSanad ? 'checked' : ''}>
                                <span>📄 صدور سند حسابداری</span>
                            </label>
                            ${CS.html('sfkNoSanad', sanadOpts, String(_state.header.noSanad || 0))}
                        </div>
                        ${showFactor ? `
                        <div>
                            <label class="sfk-checkbox" style="margin-bottom:8px;">
                                <input type="checkbox" id="sfkSaveFactor" ${_state.header.saveFactor ? 'checked' : ''}>
                                <span>📋 صدور فاکتور فروش</span>
                            </label>
                            <div id="sfkFactorFields" style="${_state.header.saveFactor ? '' : 'display:none;'}">
                                ${CS.html('sfkNoFactor', factorOpts, String(_state.header.noFactor || 0))}
                                <div class="ff-input-with-btn" style="margin-top:8px;">
                                    <input type="text" id="sfkCodeTafzil" dir="ltr" placeholder="کد مشتری (الزامی)" value="${_state.header.codeCustomer || ''}">
                                    <button type="button" class="ff-pick-btn" id="sfkPickCustomer">🔍</button>
                                </div>
                            </div>
                        </div>` : ''}
                    </div>
                </div>

                <div class="card sfk-items-card">
                    <div class="card-title">
                        <span>📋 ردیف‌های کالا</span>
                        <button type="button" class="btn btn-sm btn-primary" id="sfkAddRow">➕ افزودن کالا</button>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table sfk-items-table">
                            <thead>
                                <tr>
                                    <th style="width:35px;">#</th><th style="width:100px;">کد کالا</th><th>نام کالا</th>
                                    <th style="width:55px;">واحد</th><th class="text-left" style="width:90px;">تعداد</th>
                                    <th class="text-left" style="width:120px;">قیمت واحد</th><th class="text-left" style="width:120px;">مبلغ</th>
                                    <th style="width:70px;" data-nosort>عملیات</th>
                                </tr>
                            </thead>
                            <tbody id="sfkItemsBody"></tbody>
                            <tfoot>
                                <tr class="sfk-total-row">
                                    <td colspan="6" class="text-left"><strong>جمع کل:</strong></td>
                                    <td class="num text-left"><strong id="sfkTotalAmount">0</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>
            <!-- ⭐ فوتر همیشه پایین فرم -->
            <div class="sfk-actions">
                <button type="button" class="btn btn-secondary" id="sfkCancel">انصراف <span class="kbd-hint">Esc</span></button>
                <button type="button" class="btn btn-primary" id="sfkSave">💾 ذخیره <span class="kbd-hint">Ctrl+Enter</span></button>
            </div>
        </div>`;
        document.body.appendChild(overlay);

        // ─── بایند کردن CustomSelect ها ───
        CS.bindAll(overlay, {
            sfkNoSanad: (val) => { _state.header.noSanad = parseInt(val) || 0; },
            sfkNoFactor: (val) => {
                _state.header.noFactor = parseInt(val) || 0;
                const f = _factorListForForm.find(x => String(x.noFactor) === val);
                if (f && f.codeTafzil) document.getElementById('sfkCodeTafzil').value = f.codeTafzil;
            }
        });

        // ─── بقیه بایندها ───
        document.getElementById('sfkClose').addEventListener('click', close);
        document.getElementById('sfkCancel').addEventListener('click', close);
        document.getElementById('sfkAddRow').addEventListener('click', () => openItemDialog(null));
        document.getElementById('sfkSave').addEventListener('click', save);
        document.getElementById('sfkPickCustomer')?.addEventListener('click', pickCustomer);

        document.getElementById('sfkStockType')?.addEventListener('change', async function () {
            if (_ctx.mode === 'edit') return;
            const sid = this.value;
            if (!sid) { document.getElementById('sfkSpecialCode').value = ''; return; }
            try {
                const nx = await window.App.Http.api(`/api/stock/next-number?kind=${_state.header.kind}&stockTypeId=${sid}`);
                document.getElementById('sfkSpecialCode').value = nx.specialCode;
                _state.header.specialCode = nx.specialCode;
            } catch (e) { console.warn(e); }
        });

        document.getElementById('sfkSaveSanad')?.addEventListener('change', function () {
            const wrapper = document.getElementById('sfkNoSanad')?.parentElement;
            if (wrapper) { wrapper.style.opacity = this.checked ? '1' : '0.5'; wrapper.style.pointerEvents = this.checked ? 'auto' : 'none'; }
        });

        document.getElementById('sfkSaveFactor')?.addEventListener('change', function () {
            document.getElementById('sfkFactorFields').style.display = this.checked ? '' : 'none';
        });

        // ⭐ هندلر کیبورد
        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = function (e) {
            if (document.querySelector('.ff-picker-overlay') || document.getElementById('sfkArticlePicker')) return;
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); save(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
        };
        document.addEventListener('keydown', _keyHandler);

        renderItems();
    }

    // ═══ دیالوگ افزودن/ویرایش کالا ═══
    function openItemDialog(itemToEdit) {
        const isEdit = !!itemToEdit;
        const currentIt = itemToEdit || { _tmpId: 'tmp_' + Math.random().toString(36).slice(2), articleId: 0, articleCode: '', articleName: '', unitName: '', val: 1, cost: 0 };
        const overlay = document.createElement('div');
        overlay.className = 'hp-overlay'; overlay.style.zIndex = '12000';

        function renderDialog() {
            overlay.innerHTML = `
            <div class="hp-box" style="width:450px;">
                <div class="hp-header"><span>${isEdit ? '✏️ ویرایش ردیف' : '➕ افزودن ردیف'}</span><button type="button" class="hp-close" id="itemDialogClose">✕</button></div>
                <div style="padding:16px 20px;">
                    <div class="form-group" style="margin-bottom:12px;">
                        <label>کالا <span class="req">*</span></label>
                        <div class="ff-input-with-btn">
                            <input type="text" id="itemArticleName" readonly value="${currentIt.articleId > 0 ? H.esc(currentIt.articleCode) + ' - ' + H.esc(currentIt.articleName) : ''}" placeholder="انتخاب کالا...">
                            <button type="button" class="ff-pick-btn" id="itemPickArticle">🔍</button>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:12px;"><label>تعداد <span class="req">*</span></label><input type="text" id="itemVal" class="num-input" dir="ltr" value="${currentIt.val || 1}"></div>
                    <div class="form-group" style="margin-bottom:12px;"><label>قیمت واحد <span class="req">*</span></label><input type="text" id="itemCost" class="num-input" dir="ltr" value="${currentIt.cost || 0}"></div>
                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
                        <button type="button" class="btn btn-secondary" id="itemCancel">لغو</button>
                        <button type="button" class="btn btn-primary" id="itemSave">${isEdit ? 'تایید ویرایش' : 'افزودن'}</button>
                    </div>
                </div>
            </div>`;

            document.getElementById('itemDialogClose').addEventListener('click', () => overlay.remove());
            document.getElementById('itemCancel').addEventListener('click', () => overlay.remove());

            document.getElementById('itemPickArticle').addEventListener('click', () => {
                openArticlePicker(async (article) => {
                    try {
                        const calc = await window.App.Http.api(`/api/stock/article-calc/${article.id}?kind=${_state.header.kind}`);
                        currentIt.articleId = article.id; currentIt.articleCode = article.code; currentIt.articleName = article.name; currentIt.unitName = calc.unitName;
                        if (calc.lastBuyCost > 0) currentIt.cost = calc.lastBuyCost;
                        renderDialog();
                    } catch (e) { window.App.toast('خطا در محاسبه کالا', 'error'); }
                });
            });

            document.getElementById('itemSave').addEventListener('click', () => {
                if (!currentIt.articleId) return window.App.toast('ابتدا کالا را انتخاب کنید', 'warning');
                currentIt.val = parseNum(document.getElementById('itemVal').value);
                currentIt.cost = parseNum(document.getElementById('itemCost').value);
                if (!isEdit) _state.items.push(currentIt);
                overlay.remove(); renderItems();
            });
        }
        document.body.appendChild(overlay); renderDialog();
    }

    // ═══ رندر جدول ═══
    function renderItems() {
        const tbody = document.getElementById('sfkItemsBody');
        if (!tbody) return;

        if (_state.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px;color:#94A3B8;">ردیفی موجود نیست — «افزودن کالا» را بزنید</td></tr>`;
            updateTotal(); return;
        }

        tbody.innerHTML = _state.items.map((it, idx) => {
            const amt = (it.val || 0) * (it.cost || 0);
            return `<tr data-tmp="${it._tmpId}">
                <td class="text-center">${idx + 1}</td>
                <td class="num text-center">${H.esc(it.articleCode || '-')}</td>
                <td>${H.esc(it.articleName || '')}</td>
                <td class="text-center">${H.esc(it.unitName || '')}</td>
                <td class="num text-left">${H.fmt(it.val || 0)}</td>
                <td class="num text-left">${H.fmt(it.cost || 0)}</td>
                <td class="num text-left sfk-amt">${H.fmt(amt)}</td>
                <td class="text-center" style="white-space:nowrap;">
                    <button type="button" class="btn-icon sfk-edit-row" data-tmp="${it._tmpId}" title="ویرایش">✏️</button>
                    <button type="button" class="btn-icon btn-icon-danger sfk-del-row" data-tmp="${it._tmpId}" title="حذف">🗑️</button>
                </td>
            </tr>`;
        }).join('');

        document.querySelectorAll('.sfk-edit-row').forEach(btn => btn.addEventListener('click', function () {
            const it = _state.items.find(x => x._tmpId === this.dataset.tmp); if (it) openItemDialog(it);
        }));
        document.querySelectorAll('.sfk-del-row').forEach(btn => btn.addEventListener('click', function () {
            _state.items = _state.items.filter(x => x._tmpId !== this.dataset.tmp); renderItems();
        }));
        updateTotal();
    }

    function updateTotal() {
        const total = _state.items.reduce((s, it) => s + (it.val || 0) * (it.cost || 0), 0);
        const el = document.getElementById('sfkTotalAmount'); if (el) el.textContent = H.fmt(total);
    }

    // ═══ Picker کالا ═══
    function openArticlePicker(onPick) {
        document.getElementById('sfkArticlePicker')?.remove();
        const pk = document.createElement('div'); pk.id = 'sfkArticlePicker'; pk.className = 'ffi-article-picker'; pk.style.zIndex = '13000';
        pk.innerHTML = `<div class="ffi-picker-box"><div class="ffi-picker-header"><span>🔍 جستجوی کالا</span><button type="button" class="ffi-picker-close">✕</button></div><div class="ffi-picker-search"><input type="text" id="sfkArticleSearch" placeholder="کد یا نام کالا..."></div><div class="ffi-picker-list" id="sfkArticleList"><div class="ffi-picker-empty">برای جستجو تایپ کنید...</div></div></div>`;
        document.body.appendChild(pk);
        const searchInput = pk.querySelector('#sfkArticleSearch'); const listWrap = pk.querySelector('#sfkArticleList'); let _debounce = null;
        function doSearch(q) {
            const query = (q || '').trim(); if (query.length < 1) { listWrap.innerHTML = '<div class="ffi-picker-empty">برای جستجو تایپ کنید...</div>'; return; }
            listWrap.innerHTML = '<div class="ffi-picker-empty">در حال جستجو...</div>';
            window.App.Http.api('/api/article/list', { method: 'POST', body: JSON.stringify({ code: /^\d/.test(query) ? query : null, name: !/^\d/.test(query) ? query : null, page: 1, pageSize: 50 }) })
                .then(resp => {
                    const items = resp.items || []; if (items.length === 0) { listWrap.innerHTML = '<div class="ffi-picker-empty">یافت نشد</div>'; return; }
                    listWrap.innerHTML = items.map(a => `<div class="ffi-picker-item" data-id="${a.id}" data-code="${H.esc(a.code || '')}" data-name="${H.esc(a.name || '')}"><span class="ffi-picker-code">${H.esc(a.code || '-')}</span><div class="ffi-picker-info"><div class="ffi-picker-name">${H.esc(a.name || '')}</div></div></div>`).join('');
                });
        }
        searchInput.addEventListener('input', function () { clearTimeout(_debounce); _debounce = setTimeout(() => doSearch(this.value), 300); });
        pk.querySelector('.ffi-picker-close').addEventListener('click', () => pk.remove());
        pk.addEventListener('click', e => { if (e.target === pk) { pk.remove(); return; } const item = e.target.closest('.ffi-picker-item'); if (!item) return; onPick({ id: parseInt(item.dataset.id, 10), code: item.dataset.code, name: item.dataset.name }); pk.remove(); });
        searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); pk.remove(); } });
        setTimeout(() => searchInput.focus(), 50);
    }

    // ═══ Picker مشتری ═══
    async function pickCustomer() {
        const mb = document.getElementById('stockFormOverlay');
        const pickerId = 'sfkCustomerPicker';
        document.getElementById(pickerId)?.remove();

        const picker = document.createElement('div');
        picker.id = pickerId;
        picker.className = 'ff-picker-overlay';
        picker.style.zIndex = '12000';
        picker.innerHTML =
            '<div class="ff-picker-box">' +
            '<div class="ff-picker-header"><span>🔍 انتخاب طرف حساب</span><button type="button" class="ff-picker-close">✕</button></div>' +
            '<div class="ff-picker-search"><input type="text" id="sfkPickerSearch" placeholder="جستجو (کد یا نام)..."></div>' +
            '<div class="ff-picker-list" id="sfkPickerList"><div class="ff-picker-empty">در حال بارگذاری...</div></div>' +
            '</div>';
        mb.appendChild(picker);

        const searchInput = picker.querySelector('#sfkPickerSearch');
        const listWrap = picker.querySelector('#sfkPickerList');
        let _allItems = [];

        try {
            const resp = await window.App.Http.api('/api/tafzili/list', {
                method: 'POST',
                body: JSON.stringify({ page: 1, pageSize: 100000, mandehFilter: 'all' })
            });
            _allItems = (resp.items || []).filter(x => x.codeTafzil > 0);
            renderList('');
        } catch (err) {
            listWrap.innerHTML = '<div class="ff-picker-empty">خطا در بارگذاری</div>';
        }

        function renderList(filter) {
            const f = (filter || '').trim().toLowerCase();
            let filtered = _allItems;
            if (f) {
                filtered = _allItems.filter(x => String(x.codeTafzil).indexOf(f) !== -1 || (x.name || '').toLowerCase().indexOf(f) !== -1);
            }
            if (filtered.length === 0) { listWrap.innerHTML = '<div class="ff-picker-empty">موردی یافت نشد</div>'; return; }
            listWrap.innerHTML = filtered.slice(0, 300).map(x => `
                <div class="ff-picker-item" data-code="${x.codeTafzil}">
                    <span class="ff-picker-code">${x.codeTafzil}</span>
                    <div class="ff-picker-name-wrap">
                        <div class="ff-picker-name">${H.esc(x.name || '')}</div>
                        <div class="ff-picker-sub">${H.esc(x.phone || x.mobile || '')}</div>
                    </div>
                </div>`).join('');
        }

        searchInput.addEventListener('input', function () { renderList(this.value); });
        picker.querySelector('.ff-picker-close').addEventListener('click', () => picker.remove());
        picker.addEventListener('click', function (e) {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.ff-picker-item');
            if (!item) return;
            document.getElementById('sfkCodeTafzil').value = item.dataset.code;
            picker.remove();
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); picker.remove(); }
            if (e.key === 'Enter') { const first = listWrap.querySelector('.ff-picker-item'); if (first) first.click(); }
        });
        setTimeout(() => searchInput.focus(), 50);
    }

    // ═══ ذخیره ═══
    async function save() {
        const dateIn = document.getElementById('sfkDateIn').value.trim();
        const stockTypeId = document.getElementById('sfkStockType').value;
        if (!dateIn) return window.App.toast('تاریخ را وارد کنید', 'warning');
        if (!stockTypeId) return window.App.toast('انبار را انتخاب کنید', 'warning');
        if (_state.items.length === 0) return window.App.toast('حداقل یک ردیف کالا لازم است', 'warning');

        const saveSanad = document.getElementById('sfkSaveSanad')?.checked || false;
        const noSanad = saveSanad ? _state.header.noSanad : 0;

        if (saveSanad) {
            const zeroCostItem = _state.items.find(it => !it.cost || it.cost <= 0);
            if (zeroCostItem) return window.App.toast(`ابتدا قیمت‌گذاری کالا را انجام دهید (کالای ${zeroCostItem.articleName} فاقد قیمت است)`, 'warning');
        }

        const saveFactor = document.getElementById('sfkSaveFactor')?.checked || false;
        const noFactor = saveFactor ? _state.header.noFactor : 0;
        const codeTafzil = parseNum(document.getElementById('sfkCodeTafzil')?.value) || 0;
        const totalAmount = _state.items.reduce((s, it) => s + (it.val * it.cost), 0);

        if (saveFactor) {
            if (!codeTafzil) return window.App.toast('کد مشتری وارد نشده است', 'warning');
            if (totalAmount <= 0) return window.App.toast('مبلغ فاکتور باید بیشتر از صفر باشد', 'warning');
        }

        const payload = {
            kind: _state.header.kind, code: parseNum(document.getElementById('sfkCode').value) || null,
            specialCode: parseNum(document.getElementById('sfkSpecialCode').value) || null, dateIn: dateIn,
            des: document.getElementById('sfkDes').value || null, stockTypeId: parseNum(stockTypeId),
            saveSanad: saveSanad, noSanad: noSanad, saveFactor: saveFactor, noFactor: noFactor, codeTafzil: codeTafzil,
            items: _state.items.map(it => ({ articleId: it.articleId, val: it.val, cost: it.cost }))
        };

        const btn = document.getElementById('sfkSave'); const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '⏳ در حال ذخیره...';

        try {
            if (_ctx.mode === 'edit') {
                await window.App.Http.api('/api/stock/' + _ctx.id, { method: 'PUT', body: JSON.stringify(payload), successMsg: 'با موفقیت ذخیره شد' });
            } else {
                await window.App.Http.api('/api/stock', { method: 'POST', body: JSON.stringify(payload), successMsg: 'با موفقیت ثبت شد' });
            }
            close(); _ctx.onSaved && _ctx.onSaved();
        } catch (e) { btn.disabled = false; btn.innerHTML = orig; }
    }

    function close() {
        if (_keyHandler) {
            document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
        }
        document.getElementById('stockFormOverlay')?.remove();
    }

    function parseNum(v) { if (!v) return 0; const latin = H.toLatinDigits ? H.toLatinDigits(String(v)) : String(v); const n = parseFloat(latin.replace(/,/g, '')); return isNaN(n) ? 0 : n; }

    return { open };
})();