/* ═══════════════════════════════════════════════════
   Feature / UnitForm — فرم درج/ویرایش واحد
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.UnitForm = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = { isEdit: false, id: null, suggestedCode: null, currentCode: null };

    async function loadNextCode() {
        try {
            const r = await window.App.Http.api('/api/unit/next-code');
            return r?.nextCode || 1;
        } catch { return 1; }
    }

    async function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(226)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        const nextCode = await loadNextCode();
        _state = { isEdit: false, id: null, suggestedCode: nextCode, currentCode: nextCode };
        window.App.openModal('➕ واحد جدید', buildForm({}, nextCode));
        bindEvents();
    }

    async function openEdit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(227)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        try {
            const d = await window.App.Http.api(`/api/unit/${id}`);
            _state = { isEdit: true, id: id, suggestedCode: d.code, currentCode: d.code };
            window.App.openModal('✏️ ویرایش واحد: ' + (d.name || ''), buildForm(d, d.code));
            bindEvents();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    function buildForm(d, codeValue) {
        const isEdit = _state.isEdit;
        const codeHint = isEdit
            ? '<span class="tf-code-hint">🔒 کد در حالت ویرایش قابل تغییر نیست</span>'
            : `<span class="tf-code-hint">آخرین کد: ${H.fmt(_state.suggestedCode - 1)} — پیشنهاد: ${H.fmt(_state.suggestedCode)}</span>`;

        return `
        <div class="tf-form" data-help="unit-form">
            <div class="tf-section">
                <div class="tf-section-title">📏 مشخصات واحد</div>
                <div class="tf-grid tf-grid-2">
                    <div class="tf-field">
                        <label>کد <span class="req">*</span></label>
                        <input type="text" id="unfCode"
                               value="${codeValue != null ? codeValue : ''}"
                               dir="ltr" inputmode="numeric"
                               ${isEdit ? 'readonly' : ''}
                               style="${isEdit ? 'background:#F3F4F6; cursor:not-allowed;' : ''}">
                        ${codeHint}
                    </div>
                    <div class="tf-field">
                        <label>نام واحد <span class="req">*</span></label>
                        <input type="text" id="unfName" value="${H.esc(d.name || '')}"
                               maxlength="50" autofocus>
                    </div>
                    <div class="tf-field">
                        <label>ضریب تبدیل (TabileUnit)</label>
                        <input type="text" id="unfTabileUnit"
                               value="${d.tabileUnit != null ? d.tabileUnit : ''}"
                               dir="ltr" inputmode="decimal"
                               placeholder="مثلاً 12">
                    </div>
                    <div class="tf-field">
                        <label>کد مالیاتی (tax_id)</label>
                        <input type="text" id="unfTaxId"
                               value="${d.taxId != null ? d.taxId : ''}"
                               dir="ltr" inputmode="numeric"
                               placeholder="اختیاری">
                    </div>
                </div>
            </div>

            <div class="tf-footer">
                <button class="btn btn-primary tf-save-btn" id="unfSaveBtn">
                    💾 ${isEdit ? 'ذخیره' : 'ثبت'}
                </button>
                <button class="btn btn-ghost" id="unfCancelBtn">انصراف</button>
                <span class="tf-footer-hint">
                    کلیدها: <kbd>F2</kbd> / <kbd>Ctrl+Enter</kbd> ذخیره — <kbd>Esc</kbd> انصراف
                </span>
            </div>
        </div>`;
    }

    let _keyHandler = null;

    function bindEvents() {
        document.getElementById('unfSaveBtn')?.addEventListener('click', save);
        document.getElementById('unfCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        const codeEl = document.getElementById('unfCode');
        codeEl?.addEventListener('input', () => {
            const cleaned = codeEl.value.replace(/[^0-9]/g, '');
            if (cleaned !== codeEl.value) codeEl.value = cleaned;
        });

        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = (e) => {
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

    async function save() {
        const btn = document.getElementById('unfSaveBtn');
        const orig = btn.textContent;

        const val = id => document.getElementById(id)?.value?.trim() || null;

        const codeStr = val('unfCode');
        if (!codeStr) {
            window.App.toast('کد واحد الزامی است', 'error');
            return;
        }
        const codeNum = parseInt(codeStr, 10);
        if (isNaN(codeNum) || codeNum <= 0) {
            window.App.toast('کد باید عددی و بزرگ‌تر از صفر باشد', 'error');
            return;
        }
        const codeChanged = _state.isEdit && codeNum !== _state.currentCode;

        const name = val('unfName');
        if (!name) {
            window.App.toast('نام واحد الزامی است', 'error');
            document.getElementById('unfName')?.focus();
            return;
        }

        const tabileStr = val('unfTabileUnit');
        let tabileUnit = null;
        if (tabileStr) {
            tabileUnit = parseFloat(tabileStr.replace(/[^\d.-]/g, ''));
            if (isNaN(tabileUnit)) tabileUnit = null;
        }

        const taxStr = val('unfTaxId');
        let taxId = null;
        if (taxStr) {
            taxId = parseInt(taxStr.replace(/[^\d-]/g, ''), 10);
            if (isNaN(taxId)) taxId = null;
        }

        const payload = {
            name: name,
            tabileUnit: tabileUnit,
            taxId: taxId
        };
        if (!_state.isEdit || codeChanged) payload.code = codeNum;

        try {
            btn.disabled = true;
            btn.textContent = '⏳ در حال ذخیره...';

            if (_state.isEdit) {
                payload.id = _state.id;
                await window.App.Http.api('/api/unit/' + _state.id, {
                    method: 'PUT', body: JSON.stringify(payload)
                });
                window.App.toast('واحد به‌روزرسانی شد', 'success');
            } else {
                await window.App.Http.api('/api/unit', {
                    method: 'POST', body: JSON.stringify(payload)
                });
                window.App.toast('واحد جدید ثبت شد', 'success');
            }

            if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
            window.App.closeModal();

            try {
                if (window.App.state.currentPage === 'unit') {
                    window.App.Features.Unit.runList(1);
                }
            } catch (e) { console.error(e); }
        } catch (err) {
            window.App.toast(err.message || 'خطا در ذخیره', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
    }

    async function deleteUnit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(228)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        let usage = null;
        try { usage = await window.App.Http.api(`/api/unit/${id}/usage`); }
        catch (e) { console.warn(e); }

        if (usage && !usage.canDelete) {
            await window.App.alert.warning(usage.reason || 'این واحد قابل حذف نیست',
                { title: '🔒 قابل حذف نیست' });
            return;
        }

        const ok = await window.App.confirm('آیا از حذف این واحد مطمئن هستید؟',
            { title: '🗑️ حذف واحد', danger: true, okText: 'بله، حذف کن', cancelText: 'لغو' });
        if (!ok) return;

        try {
            await window.App.Http.api('/api/unit/' + id, { method: 'DELETE' });
            window.App.toast('واحد حذف شد', 'success');
            try {
                if (window.App.state.currentPage === 'unit') {
                    window.App.Features.Unit.runList(1);
                }
            } catch (e) { console.error(e); }
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا در حذف', { title: 'خطا' });
        }
    }

    return { openCreate, openEdit, delete: deleteUnit };
})();