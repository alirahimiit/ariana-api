/* ═══════════════════════════════════════════════════
   Feature / TafziliForm — فرم درج/ویرایش تفضیلی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.TafziliForm = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = { isEdit: false, id: null };
    let _groups = [];

    async function loadGroups() {
        try {
            _groups = await window.App.Http.api('/api/tafzili/groups') || [];
        } catch (e) {
            _groups = [];
        }
    }

    // ═══ OPEN CREATE ═══
    async function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(193)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        await loadGroups();
        _state = { isEdit: false, id: null };
        window.App.openModal('➕ تفضیلی جدید', buildForm({}));
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
                loadGroups()
            ]);
            _state = { isEdit: true, id: id };
            window.App.openModal('✏️ ویرایش تفضیلی: ' + (detail.name || ''), buildForm(detail));
            bindEvents();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    function buildForm(d) {
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

        return `
        <div class="tf-form">
            <div class="tf-section">
                <div class="tf-section-title">📋 اطلاعات پایه</div>
                <div class="tf-grid tf-grid-2">
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
                <button class="btn btn-primary" id="tfSaveBtn">
                    💾 ${isEdit ? 'ذخیره' : 'ثبت'} <span class="kbd-hint">F2</span>
                </button>
                <button class="btn btn-ghost" id="tfCancelBtn">
                    انصراف <span class="kbd-hint">Esc</span>
                </button>
            </div>
        </div>`;
    }

    let _keyHandler = null;

    function bindEvents() {
        document.getElementById('tfSaveBtn')?.addEventListener('click', save);
        document.getElementById('tfCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = (e) => {
            if (e.key === 'F2') { e.preventDefault(); save(); }
            else if (e.key === 'Escape') {
                e.preventDefault();
                window.App.closeModal();
                document.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        };
        document.addEventListener('keydown', _keyHandler);
    }

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

        const name = val('tfName');
        if (!name) {
            window.App.toast('نام تفضیلی الزامی است', 'error');
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
            isSaleMan: val('tfIsSaleMan') === 'true',
            isStock: false
        };

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
            window.App.Features.Tafzili.runList(1);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
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

        if (!confirm('آیا از حذف این تفضیلی مطمئن هستید؟')) return;

        try {
            await window.App.Http.api('/api/tafzili/' + id, { method: 'DELETE' });
            window.App.toast('تفضیلی حذف شد', 'success');
            window.App.Features.Tafzili.runList(1);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    return {
        openCreate: openCreate,
        openEdit: openEdit,
        delete: deleteTafzili
    };
})();