/* ═══════════════════════════════════════════════════
   Feature / Tafzili2Form — فرم درج/ویرایش تفضیلی ۲
   نسخه 1.0
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Tafzili2Form = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = { isEdit: false, id: null, suggestedCode: null, currentCode: null };
    let _groups = [];
    let _states = [];
    let _cities = [];

    // ═══ LOOKUPS ═══
    async function loadGroups() {
        try {
            _groups = await window.App.Http.api('/api/tafzili/groups') || [];
        } catch (e) { _groups = []; }
    }
    async function loadStates() {
        try {
            _states = await window.App.Http.api('/api/location/states') || [];
        } catch (e) { _states = []; }
    }
    async function loadAllCities() {
        try {
            _cities = await window.App.Http.api('/api/location/cities') || [];
        } catch (e) { _cities = []; }
    }
    async function loadNextCode() {
        try {
            const r = await window.App.Http.api('/api/tafzili2/next-code');
            return r?.nextCode || 1;
        } catch (e) { return 1; }
    }

    // ═══ RENDER HELPERS ═══
    function renderStateOptions(selectedId) {
        const sel = selectedId ? String(selectedId) : '';
        return ['<option value="">-- انتخاب استان --</option>']
            .concat(_states.map(s =>
                `<option value="${s.id}" ${String(s.id) === sel ? 'selected' : ''}>${H.esc(s.name || '')}</option>`
            )).join('');
    }

    function renderCityOptions(selectedId, placeholder) {
        const sel = selectedId ? String(selectedId) : '';
        const opts = [`<option value="">${placeholder || '-- انتخاب شهر --'}</option>`];
        _cities.forEach(c => {
            opts.push(`<option value="${c.id}" ${String(c.id) === sel ? 'selected' : ''}>${H.esc(c.name || '')}</option>`);
        });
        return opts.join('');
    }

    // ═══ OPEN CREATE ═══
    async function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(196)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        const [nextCode] = await Promise.all([
            loadNextCode(),
            loadGroups(),
            loadStates(),
            loadAllCities()
        ]);
        _state = {
            isEdit: false,
            id: null,
            suggestedCode: nextCode,
            currentCode: nextCode
        };
        window.App.openModal('➕ تفضیلی ۲ جدید', buildForm({}, nextCode));
        bindEvents();
    }

    // ═══ OPEN EDIT ═══
    async function openEdit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(197)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        try {
            const [detail] = await Promise.all([
                window.App.Http.api('/api/tafzili2/' + id),
                loadGroups(),
                loadStates(),
                loadAllCities()
            ]);
            _state = {
                isEdit: true,
                id: id,
                suggestedCode: detail.code,
                currentCode: detail.code
            };
            window.App.openModal('✏️ ویرایش تفضیلی ۲: ' + (detail.name || ''), buildForm(detail, detail.code));
            bindEvents();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══ BUILD FORM ═══
    function buildForm(d, codeValue) {
        const isEdit = _state.isEdit;

        const groupOpts = ['<option value="">-- بدون گروه --</option>']
            .concat(_groups.map(g =>
                `<option value="${g.id}" ${String(d.tafziliGroupCode) === String(g.id) ? 'selected' : ''}>${H.esc(g.name || '')}</option>`
            )).join('');

        const codeHint = isEdit
            ? '<span class="tf-code-hint">🔒 کد در حالت ویرایش قابل تغییر نیست</span>'
            : `<span class="tf-code-hint">آخرین کد: ${H.fmt(_state.suggestedCode - 1)} — پیشنهاد: ${H.fmt(_state.suggestedCode)}</span>`;

        return `
        <div class="tf-form" data-help="tafzili2-form">
            <div class="tf-section">
                <div class="tf-section-title">📋 اطلاعات پایه</div>
                <div class="tf-grid tf-grid-2">
                    <div class="tf-field">
                        <label>کد تفضیلی ۲ <span class="req">*</span></label>
                        <input type="text" id="t2fCode"
                               value="${codeValue != null ? codeValue : ''}"
                               dir="ltr" inputmode="numeric"
                               ${isEdit ? 'readonly' : ''}
                               style="${isEdit ? 'background:#F3F4F6; cursor:not-allowed;' : ''}">
                        ${codeHint}
                    </div>
                    <div class="tf-field">
                        <label>نام <span class="req">*</span></label>
                        <input type="text" id="t2fName" value="${H.esc(d.name || '')}">
                    </div>
                    <div class="tf-field">
                        <label>گروه تفضیلی</label>
                        <select id="t2fGroupCode">${groupOpts}</select>
                    </div>
                    <div class="tf-field">
                        <label>در فروشندگان</label>
                        <select id="t2fIsSaleMan">
                            <option value="false" ${!d.isSaleMan ? 'selected' : ''}>خیر</option>
                            <option value="true" ${d.isSaleMan ? 'selected' : ''}>بله</option>
                        </select>
                    </div>
                    <div class="tf-field">
                        <label>انبار</label>
                        <select id="t2fIsStock">
                            <option value="false" ${!d.isStock ? 'selected' : ''}>خیر</option>
                            <option value="true" ${d.isStock ? 'selected' : ''}>بله</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="tf-section">
                <div class="tf-section-title">📞 اطلاعات تماس</div>
                <div class="tf-grid tf-grid-3">
                    <div class="tf-field">
                        <label>تلفن</label>
                        <input type="text" id="t2fPhone" value="${H.esc(d.phone || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>موبایل</label>
                        <input type="text" id="t2fMobile" value="${H.esc(d.mobile || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>کد پستی</label>
                        <input type="text" id="t2fPostalCode" value="${H.esc(d.postalCode || '')}" dir="ltr">
                    </div>

                    <div class="tf-field">
                        <label>استان</label>
                        <select id="t2fStateId">${renderStateOptions(d.stateId)}</select>
                    </div>
                    <div class="tf-field">
                        <label>شهرستان (شهر ۱)</label>
                        <select id="t2fCityId">${renderCityOptions(d.cityId, '-- انتخاب شهر --')}</select>
                    </div>
                    <div class="tf-field">
                        <label>شهر (شهر ۲)</label>
                        <select id="t2fCityId2">${renderCityOptions(d.cityId2, '-- انتخاب شهر --')}</select>
                    </div>

                    <div class="tf-field tf-field-full">
                        <label>آدرس</label>
                        <input type="text" id="t2fAddress" value="${H.esc(d.address || '')}">
                    </div>
                </div>
            </div>

            <div class="tf-section">
                <div class="tf-section-title">💰 اطلاعات مالی و هویتی</div>
                <div class="tf-grid tf-grid-3">
                    <div class="tf-field">
                        <label>کد ملی</label>
                        <input type="text" id="t2fMelliCode" value="${H.esc(d.melliCode || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>کد اقتصادی</label>
                        <input type="text" id="t2fEconomicCode" value="${H.esc(d.economicCode || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>شناسه ثبت</label>
                        <input type="text" id="t2fNationalCode" value="${H.esc(d.nationalCode || '')}" dir="ltr">
                    </div>
                </div>
            </div>

            <div class="tf-footer">
                <button class="btn btn-primary tf-save-btn" id="t2fSaveBtn">
                    💾 ${isEdit ? 'ذخیره' : 'ثبت'}
                </button>
                <button class="btn btn-ghost" id="t2fCancelBtn">انصراف</button>
                <span class="tf-footer-hint">
                    کلیدهای میان‌بر: <kbd>F2</kbd> یا <kbd>Ctrl+Enter</kbd> برای ذخیره — <kbd>Esc</kbd> برای انصراف
                </span>
            </div>
        </div>`;
    }

    let _keyHandler = null;

    function bindEvents() {
        document.getElementById('t2fSaveBtn')?.addEventListener('click', save);
        document.getElementById('t2fCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        // فقط عدد در فیلد کد
        const codeEl = document.getElementById('t2fCode');
        codeEl?.addEventListener('input', () => {
            const cleaned = codeEl.value.replace(/[^0-9]/g, '');
            if (cleaned !== codeEl.value) codeEl.value = cleaned;
        });

        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                save();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                save();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                window.App.closeModal();
                document.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        };
        document.addEventListener('keydown', _keyHandler);
    }

    // ═══ SAVE ═══
    async function save() {
        const btn = document.getElementById('t2fSaveBtn');
        const orig = btn.textContent;

        function val(id) {
            const el = document.getElementById(id);
            return el && el.value ? el.value.trim() : null;
        }
        function intOrNull(id) {
            const v = val(id);
            if (!v) return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        }

        // چک کد
        const codeStr = val('t2fCode');
        if (!codeStr) {
            window.App.toast('کد تفضیلی ۲ الزامی است', 'error');
            document.getElementById('t2fCode')?.focus();
            return;
        }
        const codeNum = parseInt(codeStr, 10);
        if (isNaN(codeNum) || codeNum <= 0) {
            window.App.toast('کد باید عددی و بزرگ‌تر از صفر باشد', 'error');
            document.getElementById('t2fCode')?.focus();
            return;
        }

        const codeChanged = _state.isEdit && codeNum !== _state.currentCode;

        const name = val('t2fName');
        if (!name) {
            window.App.toast('نام تفضیلی ۲ الزامی است', 'error');
            document.getElementById('t2fName')?.focus();
            return;
        }

        const payload = {
            name: name,
            tafziliGroupCode: intOrNull('t2fGroupCode'),
            phone: val('t2fPhone'),
            mobile: val('t2fMobile'),
            address: val('t2fAddress'),
            postalCode: val('t2fPostalCode'),
            melliCode: val('t2fMelliCode'),
            economicCode: val('t2fEconomicCode'),
            nationalCode: val('t2fNationalCode'),
            stateId: intOrNull('t2fStateId'),
            cityId: intOrNull('t2fCityId'),
            cityId2: intOrNull('t2fCityId2'),
            isStock: val('t2fIsStock') === 'true',
            isSaleMan: val('t2fIsSaleMan') === 'true'
        };

        if (!_state.isEdit || codeChanged) {
            payload.code = codeNum;
        }

        try {
            btn.disabled = true;
            btn.textContent = '⏳ در حال ذخیره...';

            if (_state.isEdit) {
                payload.id = _state.id;
                await window.App.Http.api('/api/tafzili2/' + _state.id, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.App.toast('تفضیلی ۲ به‌روزرسانی شد', 'success');
            } else {
                await window.App.Http.api('/api/tafzili2', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.App.toast('تفضیلی ۲ جدید ثبت شد', 'success');
            }

            if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
            window.App.closeModal();

            try {
                if (window.App.state.currentPage === 'tafzili2') {
                    window.App.Features.Tafzili2.runList(1);
                }
            } catch (e) {
                console.error('[Tafzili2Form] refresh error:', e);
            }
        } catch (err) {
            window.App.toast(err.message || 'خطا در ذخیره', 'error');
            if ((err.message || '').includes('کد')) {
                document.getElementById('t2fCode')?.focus();
            }
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
    }

    // ═══ DELETE ═══
    async function deleteTafzili2(id) {
        if (window.App.Permissions && !window.App.Permissions.can(198)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        let usage = null;
        try {
            usage = await window.App.Http.api(`/api/tafzili2/${id}/usage`);
        } catch (e) {
            console.warn('[deleteTafzili2] usage check failed:', e);
        }

        if (usage && !usage.canDelete) {
            await window.App.alert.warning(
                usage.reason || 'این تفضیلی ۲ قابل حذف نیست',
                { title: '🔒 قابل حذف نیست' }
            );
            return;
        }

        const ok = await window.App.confirm(
            'آیا از حذف این تفضیلی ۲ مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست.',
            {
                title: '🗑️ حذف تفضیلی ۲',
                danger: true,
                okText: 'بله، حذف کن',
                cancelText: 'لغو'
            }
        );
        if (!ok) return;

        try {
            await window.App.Http.api('/api/tafzili2/' + id, { method: 'DELETE' });
            window.App.toast('تفضیلی ۲ حذف شد', 'success');
            try {
                if (window.App.state.currentPage === 'tafzili2') {
                    window.App.Features.Tafzili2.runList(1);
                }
            } catch (e) { console.error(e); }
        } catch (err) {
            await window.App.alert.error(
                err.message || 'خطا در حذف تفضیلی ۲',
                { title: 'خطا در حذف' }
            );
        }
    }

    return {
        openCreate: openCreate,
        openEdit: openEdit,
        delete: deleteTafzili2
    };
})();