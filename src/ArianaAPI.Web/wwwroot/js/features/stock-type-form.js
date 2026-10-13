/* ═══════════════════════════════════════════════════
   Feature / StockTypeForm — فرم درج/ویرایش انبار
   نسخه 2.0 — با Picker کدینگ
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.StockTypeForm = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = { isEdit: false, id: null, suggestedCode: null };
    let _codes = { col: 0, moein: 0, tafzil: 0, tafzil2: 0 };
    let _names = { col: '', moein: '', tafzil: '', tafzil2: '' };
    let _tafzili2Cache = null;

    // ═══ LOOKUP HELPERS ═══
    async function loadNextCode() {
        try {
            const r = await window.App.Http.api('/api/stock-type/next-code');
            return r?.nextCode || 1;
        } catch { return 1; }
    }

    async function ensureTafzili2Cache() {
        if (_tafzili2Cache) return _tafzili2Cache;
        try {
            const r = await window.App.Http.api('/api/tafzili2/list', {
                method: 'POST',
                body: JSON.stringify({ page: 1, pageSize: 100000 })
            });
            _tafzili2Cache = (r?.items || []).map(x => ({
                code: parseInt(x.code || 0),
                name: x.name || ''
            }));
        } catch {
            _tafzili2Cache = [];
        }
        return _tafzili2Cache;
    }

    // ═══ OPEN ═══
    async function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(220)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        const nextCode = await loadNextCode();
        _state = { isEdit: false, id: null, suggestedCode: nextCode };
        _codes = { col: 0, moein: 0, tafzil: 0, tafzil2: 0 };
        _names = { col: '', moein: '', tafzil: '', tafzil2: '' };
        window.App.openModal('➕ انبار جدید', buildForm({}, nextCode));
        bindEvents();
    }

    async function openEdit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(221)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        try {
            const d = await window.App.Http.api(`/api/stock-type/${id}`);
            _state = { isEdit: true, id: id, suggestedCode: d.code };
            _codes = {
                col: d.codeCol || 0,
                moein: d.codeMoein || 0,
                tafzil: d.codeTafzil || 0,
                tafzil2: d.codeTafzil2 || 0
            };
            _names = { col: '', moein: '', tafzil: '', tafzil2: '' };

            // پر کردن اسم‌ها
            if (_codes.col > 0) {
                try {
                    const tree = await window.App.Http.api('/api/hesab/tree');
                    const col = (tree || []).find(x => x.level === 'col' && x.codeCol === _codes.col);
                    if (col) _names.col = col.name || '';

                    if (_codes.moein > 0) {
                        const moein = (tree || []).find(x => x.level === 'moein'
                            && x.codeCol === _codes.col && x.codeMoein === _codes.moein);
                        if (moein) _names.moein = moein.name || '';
                    }
                } catch { }
            }
            if (_codes.tafzil > 0) {
                try {
                    const r = await window.App.Http.api('/api/tafzili/list', {
                        method: 'POST',
                        body: JSON.stringify({ page: 1, pageSize: 5 })
                    });
                    // روش سریع‌تر: از tafzili list استفاده کن
                    const t = (r?.items || []).find(x => parseInt(x.codeTafzil) === _codes.tafzil);
                    if (t) _names.tafzil = t.name || '';
                } catch { }
            }
            if (_codes.tafzil2 > 0) {
                await ensureTafzili2Cache();
                const t = _tafzili2Cache.find(x => x.code === _codes.tafzil2);
                if (t) _names.tafzil2 = t.name || '';
            }

            window.App.openModal('✏️ ویرایش انبار: ' + (d.name || ''), buildForm(d, d.code));
            bindEvents();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══ BUILD FORM ═══
    function buildForm(d, codeValue) {
        const isEdit = _state.isEdit;
        const codeHint = isEdit
            ? '<span class="tf-code-hint">🔒 کد در حالت ویرایش قابل تغییر نیست</span>'
            : `<span class="tf-code-hint">آخرین کد: ${H.fmt(_state.suggestedCode - 1)} — پیشنهاد: ${H.fmt(_state.suggestedCode)}</span>`;

        // نمایش کدینگ‌ها
        const colDisplay = _codes.col > 0
            ? `${_codes.col}${_names.col ? ' - ' + _names.col : ''}`
            : '';
        const moeinDisplay = _codes.moein > 0
            ? `${_codes.col} / ${_codes.moein}${_names.moein ? ' - ' + _names.moein : ''}`
            : '';
        const tafzilDisplay = _codes.tafzil > 0
            ? `${_codes.tafzil}${_names.tafzil ? ' - ' + _names.tafzil : ''}`
            : '';
        const tafzil2Display = _codes.tafzil2 > 0
            ? `${_codes.tafzil2}${_names.tafzil2 ? ' - ' + _names.tafzil2 : ''}`
            : '';

        return `
        <div class="tf-form" data-help="stock-type-form">
            <div class="tf-section">
                <div class="tf-section-title">📋 مشخصات انبار</div>
                <div class="tf-grid tf-grid-3">
                    <div class="tf-field">
                        <label>کد انبار <span class="req">*</span></label>
                        <input type="text" id="stfCode"
                               value="${codeValue != null ? codeValue : ''}"
                               dir="ltr" inputmode="numeric"
                               ${isEdit ? 'readonly' : ''}
                               style="${isEdit ? 'background:#F3F4F6; cursor:not-allowed;' : ''}">
                        ${codeHint}
                    </div>
                    <div class="tf-field tf-field-full">
                        <label>نام انبار <span class="req">*</span></label>
                        <input type="text" id="stfName" value="${H.esc(d.name || '')}">
                    </div>
                    <div class="tf-field">
                        <label>ماهیت <span class="req">*</span></label>
                        <select id="stfKind">
                            <option value="0" ${d.kind !== 1 ? 'selected' : ''}>کالا</option>
                            <option value="1" ${d.kind === 1 ? 'selected' : ''}>محصول</option>
                        </select>
                    </div>
                    <div class="tf-field">
                        <label>در محاسبه استهلاک</label>
                        <select id="stfForEst">
                            <option value="false" ${!d.forEst ? 'selected' : ''}>لحاظ نشود</option>
                            <option value="true" ${d.forEst ? 'selected' : ''}>لحاظ شود</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="tf-section">
                <div class="tf-section-title">🏦 کدینگ پیش‌فرض حساب‌ها</div>
                <div class="tf-grid tf-grid-4">

                    <div class="tf-field">
                        <label>کد کل</label>
                        <div class="stf-pick-row">
                            <input type="text" id="stfColDisplay" value="${H.esc(colDisplay)}"
                                   readonly placeholder="🔍 انتخاب" style="cursor:pointer;background:#F9FAFB;">
                            <button type="button" class="stf-pick-btn" id="stfColBtn" title="انتخاب کد کل">🔍</button>
                            <button type="button" class="stf-clear-btn" id="stfColClear" title="پاک کردن" ${!_codes.col ? 'style="display:none;"' : ''}>✕</button>
                        </div>
                    </div>

                    <div class="tf-field">
                        <label>کد معین</label>
                        <div class="stf-pick-row">
                            <input type="text" id="stfMoeinDisplay" value="${H.esc(moeinDisplay)}"
                                   readonly placeholder="🔍 انتخاب" style="cursor:pointer;background:#F9FAFB;"
                                   ${!_codes.col ? 'disabled' : ''}>
                            <button type="button" class="stf-pick-btn" id="stfMoeinBtn" title="انتخاب کد معین"
                                    ${!_codes.col ? 'disabled' : ''}>🔍</button>
                            <button type="button" class="stf-clear-btn" id="stfMoeinClear" title="پاک کردن" ${!_codes.moein ? 'style="display:none;"' : ''}>✕</button>
                        </div>
                    </div>

                    <div class="tf-field">
                        <label>تفصیلی ۱</label>
                        <div class="stf-pick-row">
                            <input type="text" id="stfTafzilDisplay" value="${H.esc(tafzilDisplay)}"
                                   readonly placeholder="🔍 انتخاب" style="cursor:pointer;background:#F9FAFB;">
                            <button type="button" class="stf-pick-btn" id="stfTafzilBtn" title="انتخاب تفضیلی ۱">🔍</button>
                            <button type="button" class="stf-clear-btn" id="stfTafzilClear" title="پاک کردن" ${!_codes.tafzil ? 'style="display:none;"' : ''}>✕</button>
                        </div>
                    </div>

                    <div class="tf-field">
                        <label>تفصیلی ۲</label>
                        <div class="stf-pick-row">
                            <input type="text" id="stfTafzil2Display" value="${H.esc(tafzil2Display)}"
                                   readonly placeholder="🔍 انتخاب" style="cursor:pointer;background:#F9FAFB;">
                            <button type="button" class="stf-pick-btn" id="stfTafzil2Btn" title="انتخاب تفضیلی ۲">🔍</button>
                            <button type="button" class="stf-clear-btn" id="stfTafzil2Clear" title="پاک کردن" ${!_codes.tafzil2 ? 'style="display:none;"' : ''}>✕</button>
                        </div>
                    </div>

                </div>
            </div>

            <div class="tf-section">
                <div class="tf-section-title">⚙️ تنظیمات پیشرفته</div>
                <div class="tf-grid tf-grid-2">
                    <label class="stf-check">
                        <input type="checkbox" id="stfIsRegMinOrderToIn" ${d.isRegMinOrderToIn ? 'checked' : ''}>
                        <span>عدم ثبت ورود کالا بیشتر از میزان سفارش</span>
                    </label>
                    <label class="stf-check">
                        <input type="checkbox" id="stfIsRegMaxOrderToOut" ${d.isRegMaxOrderToOut ? 'checked' : ''}>
                        <span>عدم ثبت خروج کالا کمتر از نقطه سفارش</span>
                    </label>
                    <label class="stf-check">
                        <input type="checkbox" id="stfIsRegNegativKala" ${d.isRegNegativKala ? 'checked' : ''}>
                        <span>امکان منفی شدن موجودی نباشد</span>
                    </label>
                    <label class="stf-check">
                        <input type="checkbox" id="stfNotCalcPerDiscount" ${d.notCalcPerDiscount ? 'checked' : ''}>
                        <span>عدم اعمال محاسبه درصد تخفیف</span>
                    </label>
                    <label class="stf-check">
                        <input type="checkbox" id="stfNotCalcArezeshafzode" ${d.notCalcArezeshafzode ? 'checked' : ''}>
                        <span>عدم محاسبه ارزش افزوده</span>
                    </label>
                    <label class="stf-check">
                        <input type="checkbox" id="stfIsCalcUnit2" ${d.isCalcUnit2 ? 'checked' : ''}>
                        <span>محاسبه واحد دوم کالا</span>
                    </label>
                    <label class="stf-check">
                        <input type="checkbox" id="stfIsCalcUnit3" ${d.isCalcUnit3 ? 'checked' : ''}>
                        <span>محاسبه واحد سوم کالا</span>
                    </label>
                </div>
            </div>

            <div class="tf-footer">
                <button class="btn btn-primary tf-save-btn" id="stfSaveBtn">
                    💾 ${isEdit ? 'ذخیره' : 'ثبت'}
                </button>
                <button class="btn btn-ghost" id="stfCancelBtn">انصراف</button>
                <span class="tf-footer-hint">
                    کلیدها: <kbd>F2</kbd> / <kbd>Ctrl+Enter</kbd> ذخیره — <kbd>Esc</kbd> انصراف
                </span>
            </div>
        </div>`;
    }

    let _keyHandler = null;

    function bindEvents() {
        document.getElementById('stfSaveBtn')?.addEventListener('click', save);
        document.getElementById('stfCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        const codeEl = document.getElementById('stfCode');
        codeEl?.addEventListener('input', () => {
            const cleaned = codeEl.value.replace(/[^0-9]/g, '');
            if (cleaned !== codeEl.value) codeEl.value = cleaned;
        });

        // ⭐ Picker buttons
        document.getElementById('stfColBtn')?.addEventListener('click', openColPicker);
        document.getElementById('stfMoeinBtn')?.addEventListener('click', openMoeinPicker);
        document.getElementById('stfTafzilBtn')?.addEventListener('click', openTafzilPicker);
        document.getElementById('stfTafzil2Btn')?.addEventListener('click', openTafzil2Picker);

        // ⭐ Clear buttons
        document.getElementById('stfColClear')?.addEventListener('click', () => {
            _codes.col = 0; _codes.moein = 0; _names.col = ''; _names.moein = '';
            refreshCodingUI();
        });
        document.getElementById('stfMoeinClear')?.addEventListener('click', () => {
            _codes.moein = 0; _names.moein = '';
            refreshCodingUI();
        });
        document.getElementById('stfTafzilClear')?.addEventListener('click', () => {
            _codes.tafzil = 0; _names.tafzil = '';
            refreshCodingUI();
        });
        document.getElementById('stfTafzil2Clear')?.addEventListener('click', () => {
            _codes.tafzil2 = 0; _names.tafzil2 = '';
            refreshCodingUI();
        });

        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = (e) => {
            // ⭐ اگه HesabPicker بازه، دست نزن
            if (document.querySelector('.hp-overlay')) return;

            if (e.key === 'F2') { e.preventDefault(); save(); }
            else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
            else if (e.key === 'Escape') {
                e.preventDefault();
                window.App.closeModal();
                document.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        };
        document.addEventListener('keydown', _keyHandler);
    }

    // ═══ REFRESH UI ═══
    function refreshCodingUI() {
        const colDisplay = _codes.col > 0
            ? `${_codes.col}${_names.col ? ' - ' + _names.col : ''}` : '';
        const moeinDisplay = _codes.moein > 0
            ? `${_codes.col} / ${_codes.moein}${_names.moein ? ' - ' + _names.moein : ''}` : '';
        const tafzilDisplay = _codes.tafzil > 0
            ? `${_codes.tafzil}${_names.tafzil ? ' - ' + _names.tafzil : ''}` : '';
        const tafzil2Display = _codes.tafzil2 > 0
            ? `${_codes.tafzil2}${_names.tafzil2 ? ' - ' + _names.tafzil2 : ''}` : '';

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        set('stfColDisplay', colDisplay);
        set('stfMoeinDisplay', moeinDisplay);
        set('stfTafzilDisplay', tafzilDisplay);
        set('stfTafzil2Display', tafzil2Display);

        // نمایش/مخفی ✕
        const show = (id, cond) => {
            const el = document.getElementById(id);
            if (el) el.style.display = cond ? 'inline-flex' : 'none';
        };
        show('stfColClear', _codes.col > 0);
        show('stfMoeinClear', _codes.moein > 0);
        show('stfTafzilClear', _codes.tafzil > 0);
        show('stfTafzil2Clear', _codes.tafzil2 > 0);

        // Enable/disable معین بر اساس کد کل
        const moeinEl = document.getElementById('stfMoeinDisplay');
        const moeinBtn = document.getElementById('stfMoeinBtn');
        if (moeinEl && moeinBtn) {
            if (_codes.col > 0) {
                moeinEl.disabled = false;
                moeinBtn.disabled = false;
            } else {
                moeinEl.disabled = true;
                moeinBtn.disabled = true;
            }
        }
    }

    // ═══ PICKERS ═══
    async function openColPicker() {
        const r = await window.App.UI.HesabPicker.open({
            mode: 'col',
            allowCreate: false,
            title: '🏦 انتخاب حساب کل'
        });
        if (!r) return;
        if (r.level === 'col') {
            _codes.col = r.codeCol;
            _names.col = r.name || '';
            // اگه معین قبلی مربوط به کد کل دیگه‌ای بود، پاکش کن
            if (_codes.moein && !_names.moein) { _codes.moein = 0; }
            refreshCodingUI();
        }
    }

    async function openMoeinPicker() {
        if (!_codes.col) {
            window.App.toast('ابتدا کد کل را انتخاب کنید', 'warn');
            return;
        }
        const r = await window.App.UI.HesabPicker.open({
            mode: 'moein',
            codeCol: _codes.col,
            allowCreate: false,
            title: '🏦 انتخاب حساب معین'
        });
        if (!r) return;
        if (r.level === 'moein') {
            _codes.col = r.codeCol;
            _codes.moein = r.codeMoein;
            _names.moein = r.name || '';
            // اسم کل رو هم آپدیت کن
            if (!_names.col) {
                try {
                    const tree = await window.App.Http.api('/api/hesab/tree');
                    const col = (tree || []).find(x => x.level === 'col' && x.codeCol === r.codeCol);
                    if (col) _names.col = col.name || '';
                } catch { }
            }
            refreshCodingUI();
        }
    }

    async function openTafzilPicker() {
        const r = await window.App.UI.HesabPicker.open({
            mode: 'tafzil',
            allowCreate: false,
            title: '👤 انتخاب تفضیلی ۱'
        });
        if (!r) return;
        if (r.level === 'tafzil') {
            _codes.tafzil = r.codeTafzil;
            _names.tafzil = r.name || '';
            refreshCodingUI();
        }
    }

    async function openTafzil2Picker() {
        await ensureTafzili2Cache();
        if (!_tafzili2Cache || _tafzili2Cache.length === 0) {
            window.App.toast('تفضیلی ۲ ثبت نشده است', 'warn');
            return;
        }

        // مودال انتخاب
        const overlay = document.createElement('div');
        overlay.className = 'hp-overlay';
        overlay.innerHTML = `
            <div class="hp-box">
                <div class="hp-header">
                    <div class="hp-title">👤 انتخاب تفضیلی ۲</div>
                    <button type="button" class="hp-close">✕</button>
                </div>
                <div class="hp-search">
                    <input type="text" class="hp-search-input" placeholder="جستجو..." autocomplete="off">
                </div>
                <div class="hp-list" id="stfT2List"></div>
            </div>`;
        document.body.appendChild(overlay);

        const search = overlay.querySelector('.hp-search-input');
        const list = overlay.querySelector('#stfT2List');

        function render(filter = '') {
            const f = filter.trim().toLowerCase();
            const items = !f ? _tafzili2Cache : _tafzili2Cache.filter(x =>
                String(x.code).includes(f) || (x.name || '').toLowerCase().includes(f));

            if (items.length === 0) {
                list.innerHTML = '<div class="hp-empty"><div class="hp-empty-text">یافت نشد</div></div>';
                return;
            }
            list.innerHTML = items.slice(0, 300).map(x => `
                <div class="hp-row" data-code="${x.code}" data-name="${H.esc(x.name || '')}">
                    <span class="hp-code">${x.code}</span>
                    <div class="hp-name">${H.esc(x.name || '')}</div>
                </div>`).join('');

            list.querySelectorAll('.hp-row').forEach(row => {
                row.addEventListener('click', () => {
                    _codes.tafzil2 = parseInt(row.dataset.code);
                    _names.tafzil2 = row.dataset.name || '';
                    overlay.remove();
                    refreshCodingUI();
                });
            });
        }
        render();
        search.addEventListener('input', () => render(search.value));
        overlay.querySelector('.hp-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        setTimeout(() => search.focus(), 50);
    }

    // ═══ SAVE ═══
    async function save() {
        const btn = document.getElementById('stfSaveBtn');
        const orig = btn.textContent;

        const val = id => document.getElementById(id)?.value?.trim() || null;

        const codeStr = val('stfCode');
        if (!codeStr) {
            window.App.toast('کد انبار الزامی است', 'error');
            return;
        }
        const codeNum = parseInt(codeStr, 10);
        if (isNaN(codeNum) || codeNum <= 0) {
            window.App.toast('کد باید عددی و بزرگ‌تر از صفر باشد', 'error');
            return;
        }

        const name = val('stfName');
        if (!name) {
            window.App.toast('نام انبار الزامی است', 'error');
            return;
        }

        const payload = {
            code: codeNum,
            name: name,
            kind: parseInt(val('stfKind') || '0'),
            forEst: val('stfForEst') === 'true',
            codeCol: _codes.col || 0,
            codeMoein: _codes.moein || 0,
            codeTafzil: _codes.tafzil || 0,
            codeTafzil2: _codes.tafzil2 || 0,
            isRegMinOrderToIn: document.getElementById('stfIsRegMinOrderToIn')?.checked || false,
            isRegMaxOrderToOut: document.getElementById('stfIsRegMaxOrderToOut')?.checked || false,
            isRegNegativKala: document.getElementById('stfIsRegNegativKala')?.checked || false,
            notCalcPerDiscount: document.getElementById('stfNotCalcPerDiscount')?.checked || false,
            notCalcArezeshafzode: document.getElementById('stfNotCalcArezeshafzode')?.checked || false,
            isCalcUnit2: document.getElementById('stfIsCalcUnit2')?.checked || false,
            isCalcUnit3: document.getElementById('stfIsCalcUnit3')?.checked || false
        };

        try {
            btn.disabled = true;
            btn.textContent = '⏳ در حال ذخیره...';

            if (_state.isEdit) {
                payload.id = _state.id;
                await window.App.Http.api('/api/stock-type/' + _state.id, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.App.toast('انبار به‌روزرسانی شد', 'success');
            } else {
                await window.App.Http.api('/api/stock-type', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.App.toast('انبار جدید ثبت شد', 'success');
            }

            if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
            window.App.closeModal();

            try {
                if (window.App.state.currentPage === 'stock-type') {
                    window.App.Features.StockType.runList(1);
                }
            } catch (e) { console.error(e); }
        } catch (err) {
            window.App.toast(err.message || 'خطا در ذخیره', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
    }

    async function deleteStockType(id) {
        if (window.App.Permissions && !window.App.Permissions.can(222)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        let usage = null;
        try {
            usage = await window.App.Http.api(`/api/stock-type/${id}/usage`);
        } catch (e) { console.warn(e); }

        if (usage && !usage.canDelete) {
            await window.App.alert.warning(
                usage.reason || 'این انبار قابل حذف نیست',
                { title: '🔒 قابل حذف نیست' }
            );
            return;
        }

        const ok = await window.App.confirm(
            'آیا از حذف این انبار مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست.',
            { title: '🗑️ حذف انبار', danger: true, okText: 'بله، حذف کن', cancelText: 'لغو' }
        );
        if (!ok) return;

        try {
            await window.App.Http.api('/api/stock-type/' + id, { method: 'DELETE' });
            window.App.toast('انبار حذف شد', 'success');
            try {
                if (window.App.state.currentPage === 'stock-type') {
                    window.App.Features.StockType.runList(1);
                }
            } catch (e) { console.error(e); }
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا در حذف', { title: 'خطا' });
        }
    }

    return { openCreate, openEdit, delete: deleteStockType };
})();