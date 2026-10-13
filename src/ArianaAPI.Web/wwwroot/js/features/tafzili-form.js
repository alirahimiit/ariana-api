/* ═══════════════════════════════════════════════════
   Feature / TafziliForm — فرم درج/ویرایش تفضیلی
   نسخه 2.2 — با کد قابل ویرایش
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.TafziliForm = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = { isEdit: false, id: null, suggestedCode: null, currentCode: null };
    let _groups = [];
    let _states = [];
    let _cities = [];

    // ═══ LOAD LOOKUPS ═══
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
            const r = await window.App.Http.api('/api/tafzili/next-code');
            return r?.nextCode || 1;
        } catch (e) {
            return 1;
        }
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
        if (window.App.Permissions && !window.App.Permissions.can(193)) {
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

        window.App.openModal('➕ تفضیلی جدید', buildForm({}, nextCode));
        bindEvents();
    }

    // ═══ OPEN EDIT ═══
    async function openEdit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(194)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        try {
            const [detail] = await Promise.all([
                window.App.Http.api('/api/tafzili/' + id),
                loadGroups(),
                loadStates(),
                loadAllCities()
            ]);

            _state = {
                isEdit: true,
                id: id,
                suggestedCode: detail.codeTafzil,
                currentCode: detail.codeTafzil
            };

            window.App.openModal(
                '✏️ ویرایش تفضیلی: ' + (detail.name || ''),
                buildForm(detail, detail.codeTafzil)
            );
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
                `<option value="${g.id}" ${String(d.tafziliGroupId) === String(g.id) ? 'selected' : ''}>${H.esc(g.name || '')}</option>`
            )).join('');

        const kindOpts = [
            { v: 0, t: 'عادی' },
            { v: 1, t: 'حقیقی' },
            { v: 2, t: 'حقوقی شرکت' },
            { v: 3, t: 'حقوقی سازمان' },
            { v: 4, t: 'بازاریاب' }
        ].map(o => `<option value="${o.v}" ${d.kind === o.v ? 'selected' : ''}>${o.t}</option>`).join('');

        // ⭐ کد
        const codeHint = isEdit
            ? '<span class="tf-code-hint">🔒 کد در حالت ویرایش قابل تغییر نیست</span>'
            : `<span class="tf-code-hint">آخرین کد: ${H.fmt(_state.suggestedCode - 1)} — پیشنهاد: ${H.fmt(_state.suggestedCode)}</span>`;

        return `
        <div class="tf-form" data-help="tafzili-form">
            <div class="tf-section">
                <div class="tf-section-title">📋 اطلاعات پایه</div>
                <div class="tf-grid tf-grid-2">

                    <div class="tf-field">
                        <label>کد تفضیلی <span class="req">*</span></label>
                        <input type="text" id="tfCode"
                               value="${codeValue != null ? codeValue : ''}"
                               dir="ltr" inputmode="numeric"
                               ${isEdit ? 'readonly' : ''}
                               style="${isEdit ? 'background:#F3F4F6; cursor:not-allowed;' : ''}">
                        ${codeHint}
                    </div>

                    <div class="tf-field">
                        <label>نام <span class="req">*</span></label>
                        <input type="text" id="tfName" value="${H.esc(d.name || '')}">
                    </div>

                    <div class="tf-field">
                        <label>گروه تفضیلی</label>
                        <select id="tfGroupId">${groupOpts}</select>
                    </div>
                    <div class="tf-field">
                        <label>نوع</label>
                        <select id="tfKind">${kindOpts}</select>
                    </div>
                    <div class="tf-field">
                        <label>ماهیت</label>
                        <select id="tfMahiat">
                            <option value="2" ${d.mahiat === 2 || d.mahiat === undefined ? 'selected' : ''}>بستانکار</option>
                            <option value="1" ${d.mahiat === 1 ? 'selected' : ''}>بدهکار</option>
                        </select>
                    </div>
                    <div class="tf-field">
                        <label>وضعیت</label>
                        <select id="tfVaziat">
                            <option value="1" ${d.vaziat === 1 || d.vaziat === undefined ? 'selected' : ''}>فعال</option>
                            <option value="0" ${d.vaziat === 0 ? 'selected' : ''}>غیرفعال</option>
                        </select>
                    </div>
                    <div class="tf-field">
                        <label>در فروشندگان</label>
                        <select id="tfIsSaleMan">
                            <option value="false" ${!d.isSaleMan ? 'selected' : ''}>خیر</option>
                            <option value="true" ${d.isSaleMan ? 'selected' : ''}>بله</option>
                        </select>
                    </div>
                    <div class="tf-field">
                        <label>انبار</label>
                        <select id="tfIsStock">
                            <option value="false" ${!d.isStock ? 'selected' : ''}>خیر</option>
                            <option value="true" ${d.isStock ? 'selected' : ''}>بله</option>
                        </select>
                    </div>
                    <div class="tf-field tf-field-full">
                        <label>توضیحات</label>
                        <input type="text" id="tfDiscript" value="${H.esc(d.discript || '')}">
                    </div>
                </div>
            </div>

            <div class="tf-section">
                <div class="tf-section-title">📞 اطلاعات تماس</div>
                <div class="tf-grid tf-grid-3">
                    <div class="tf-field">
                        <label>تلفن</label>
                        <input type="text" id="tfPhone" value="${H.esc(d.phone || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>موبایل</label>
                        <input type="text" id="tfMobile" value="${H.esc(d.mobile || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>کد پستی</label>
                        <input type="text" id="tfPostalCode" value="${H.esc(d.postalCode || '')}" dir="ltr">
                    </div>

                    <div class="tf-field">
                        <label>استان</label>
                        <select id="tfStateId">${renderStateOptions(d.stateId)}</select>
                    </div>
                    <div class="tf-field">
                        <label>شهرستان (شهر ۱)</label>
                        <select id="tfCityId">${renderCityOptions(d.cityId, '-- انتخاب شهر --')}</select>
                    </div>
                    <div class="tf-field">
                        <label>شهر (شهر ۲)</label>
                        <select id="tfCityId2">${renderCityOptions(d.cityId2, '-- انتخاب شهر --')}</select>
                    </div>

                    <div class="tf-field tf-field-full">
                        <label>آدرس</label>
                        <input type="text" id="tfAddress" value="${H.esc(d.address || '')}">
                    </div>
                </div>
            </div>

            <div class="tf-section">
                <div class="tf-section-title">💰 اطلاعات مالی و هویتی</div>
                <div class="tf-grid tf-grid-3">
                    <div class="tf-field">
                        <label>کد ملی</label>
                        <input type="text" id="tfMelliCode" value="${H.esc(d.melliCode || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>کد اقتصادی</label>
                        <input type="text" id="tfEconomicCode" value="${H.esc(d.economicCode || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>شناسه ثبت</label>
                        <input type="text" id="tfNationalCode" value="${H.esc(d.nationalCode || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>شماره حساب بانکی</label>
                        <input type="text" id="tfAccountNumber" value="${H.esc(d.accountNumber || '')}" dir="ltr">
                    </div>
                    <div class="tf-field">
                        <label>شغل</label>
                        <input type="text" id="tfJobName" value="${H.esc(d.jobName || '')}">
                    </div>
                </div>
            </div>

            <div class="tf-footer">
                 <button class="btn btn-primary tf-save-btn" id="tfSaveBtn">
                    💾 ${isEdit ? 'ذخیره' : 'ثبت'}
                </button>
                <button class="btn btn-ghost" id="tfCancelBtn">
                    انصراف
                </button>
                <span class="tf-footer-hint">
                    کلیدهای میان‌بر: <kbd>F2</kbd> یا <kbd>Ctrl+Enter</kbd> برای ذخیره — <kbd>Esc</kbd> برای انصراف
                </span>
            </div>
        </div>`;
    }

    let _keyHandler = null;

    function bindEvents() {
        document.getElementById('tfSaveBtn')?.addEventListener('click', save);
        document.getElementById('tfCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        // ⭐ فقط عدد در فیلد کد
        const codeEl = document.getElementById('tfCode');
        codeEl?.addEventListener('input', () => {
            const cleaned = codeEl.value.replace(/[^0-9]/g, '');
            if (cleaned !== codeEl.value) {
                codeEl.value = cleaned;
            }
        });

        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = (e) => {
            // ⭐ F2 — ذخیره
            if (e.key === 'F2') {
                e.preventDefault();
                save();
            }
            // ⭐ Ctrl+Enter (و Cmd+Enter روی مک) — ذخیره
            else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                save();
            }
            // ⭐ Esc — انصراف
            else if (e.key === 'Escape') {
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
        const btn = document.getElementById('tfSaveBtn');
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

        // ⭐ چک کد
        const codeStr = val('tfCode');
        if (!codeStr) {
            window.App.toast('کد تفضیلی الزامی است', 'error');
            document.getElementById('tfCode')?.focus();
            return;
        }
        const codeNum = parseInt(codeStr, 10);
        if (isNaN(codeNum) || codeNum <= 0) {
            window.App.toast('کد تفضیلی باید عددی و بزرگ‌تر از صفر باشد', 'error');
            document.getElementById('tfCode')?.focus();
            return;
        }

        // ⭐ در ویرایش، اگه کاربر کد رو عوض نکرده، نفرست (تا بلااستفاده چک نکنه)
        const codeChanged = _state.isEdit && codeNum !== _state.currentCode;

        const name = val('tfName');
        if (!name) {
            window.App.toast('نام تفضیلی الزامی است', 'error');
            document.getElementById('tfName')?.focus();
            return;
        }

        const payload = {
            name: name,
            tafziliGroupId: intOrNull('tfGroupId'),
            kind: intOrNull('tfKind'),
            mahiat: intOrNull('tfMahiat'),
            vaziat: intOrNull('tfVaziat'),
            discript: val('tfDiscript'),
            phone: val('tfPhone'),
            mobile: val('tfMobile'),
            address: val('tfAddress'),
            postalCode: val('tfPostalCode'),
            melliCode: val('tfMelliCode'),
            economicCode: val('tfEconomicCode'),
            nationalCode: val('tfNationalCode'),
            accountNumber: val('tfAccountNumber'),
            jobName: val('tfJobName'),
            stateId: intOrNull('tfStateId'),
            cityId: intOrNull('tfCityId'),
            cityId2: intOrNull('tfCityId2'),
            isStock: val('tfIsStock') === 'true',
            isSaleMan: val('tfIsSaleMan') === 'true'
        };

        // ⭐ کد فقط در درج یا وقتی کاربر عوضش کرده فرستاده می‌شه
        if (!_state.isEdit || codeChanged) {
            payload.codeTafzil = codeNum;
        }

        try {
            btn.disabled = true;
            btn.textContent = '⏳ در حال ذخیره...';

            if (_state.isEdit) {
                payload.id = _state.id;
                await window.App.Http.api('/api/tafzili/' + _state.id, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.App.toast('تفضیلی به‌روزرسانی شد', 'success');
            } else {
                await window.App.Http.api('/api/tafzili', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.App.toast('تفضیلی جدید ثبت شد', 'success');
            }

            if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
            window.App.closeModal();

            try {
                if (window.App.state.currentPage === 'tafzili') {
                    window.App.Features.Tafzili.runList(1);
                } else if (window.App.state.currentPage === 'hesab') {
                    if (window.App.Features.HesabManage?.reload) {
                        window.App.Features.HesabManage.reload();
                    }
                }
            } catch (e) {
                console.error('[TafziliForm] refresh error:', e);
            }
        } catch (err) {
            // ⭐ خطای کد تکراری از Backend
            window.App.toast(err.message || 'خطا در ذخیره', 'error');
            if ((err.message || '').includes('کد')) {
                document.getElementById('tfCode')?.focus();
            }
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
    }

    // ═══ DELETE ═══
    async function deleteTafzili(id) {
        if (window.App.Permissions && !window.App.Permissions.can(195)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        let usage = null;
        try {
            usage = await window.App.Http.api(`/api/hesab/${id}/usage`);
        } catch (e) {
            console.warn('[deleteTafzili] usage check failed:', e);
        }

        if (usage?.usedInSanad) {
            await window.App.alert.warning(
                `این تفضیلی در ${H.fmt(usage.sanadCount)} سند استفاده شده و قابل حذف نیست.\n\n` +
                `برای حذف، ابتدا باید تمام اسناد مرتبط حذف یا اصلاح شوند.`,
                { title: '🔒 قابل حذف نیست' }
            );
            return;
        }

        if (usage?.hasChildren) {
            await window.App.alert.warning(
                `این تفضیلی دارای ${usage.childrenInfo || 'زیرمجموعه'} است.\n\n` +
                `ابتدا زیرمجموعه‌ها را حذف کنید.`,
                { title: '🔒 دارای زیرمجموعه' }
            );
            return;
        }

        const ok = await window.App.confirm(
            'آیا از حذف این تفضیلی مطمئن هستید؟\n\nاین عملیات قابل بازگشت نیست.',
            {
                title: '🗑️ حذف تفضیلی',
                danger: true,
                okText: 'بله، حذف کن',
                cancelText: 'لغو'
            }
        );
        if (!ok) return;

        try {
            await window.App.Http.api('/api/tafzili/' + id, { method: 'DELETE' });
            window.App.toast('تفضیلی حذف شد', 'success');
            try {
                if (window.App.state.currentPage === 'tafzili') {
                    window.App.Features.Tafzili.runList(1);
                } else if (window.App.state.currentPage === 'hesab') {
                    if (window.App.Features.HesabManage?.reload) {
                        window.App.Features.HesabManage.reload();
                    }
                }
            } catch (e) { console.error(e); }
        } catch (err) {
            await window.App.alert.error(
                err.message || 'خطا در حذف تفضیلی',
                { title: 'خطا در حذف' }
            );
        }
    }

    return {
        openCreate: openCreate,
        openEdit: openEdit,
        delete: deleteTafzili
    };
})();