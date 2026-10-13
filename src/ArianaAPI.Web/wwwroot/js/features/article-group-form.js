/* ═══════════════════════════════════════════════════
   Feature / ArticleGroupForm — فرم درج/ویرایش گروه کالا
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.ArticleGroupForm = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = { isEdit: false, id: null, suggestedCode: null };
    let _stockTypes = [];

    async function loadStockTypes() {
        try {
            _stockTypes = await window.App.Http.api('/api/stock-type/lookup') || [];
        } catch { _stockTypes = []; }
    }

    async function loadNextCode(stockTypeId) {
        try {
            const r = await window.App.Http.api(`/api/article-group/next-code?stockTypeId=${stockTypeId}`);
            return r?.nextCode || 1;
        } catch { return 1; }
    }

    async function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(223)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        await loadStockTypes();
        if (_stockTypes.length === 0) {
            window.App.toast('ابتدا یک انبار تعریف کنید', 'warn');
            return;
        }

        const defaultStock = _stockTypes[0].id;
        const nextCode = await loadNextCode(defaultStock);
        _state = { isEdit: false, id: null, suggestedCode: nextCode };
        window.App.openModal('➕ گروه کالا جدید', buildForm({}, defaultStock, nextCode));
        bindEvents();
    }

    async function openEdit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(224)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        try {
            await loadStockTypes();
            const d = await window.App.Http.api(`/api/article-group/${id}`);
            _state = { isEdit: true, id: id, suggestedCode: d.code };
            window.App.openModal('✏️ ویرایش گروه کالا: ' + (d.name || ''),
                buildForm(d, d.stockTypeId, d.code));
            bindEvents();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    function buildForm(d, stockTypeId, codeValue) {
        const isEdit = _state.isEdit;

        const stockOpts = (_stockTypes || []).map(s =>
            `<option value="${s.id}" ${String(s.id) === String(stockTypeId) ? 'selected' : ''}>${H.esc(s.name || '')}</option>`
        ).join('');

        const codeHint = isEdit
            ? '<span class="tf-code-hint">🔒 کد در ویرایش قابل تغییر نیست</span>'
            : `<span class="tf-code-hint">کد بعدی در این انبار: ${H.fmt(_state.suggestedCode)}</span>`;

        return `
        <div class="tf-form" data-help="article-group-form">
            <div class="tf-section">
                <div class="tf-section-title">🏷️ مشخصات گروه کالا</div>
                <div class="tf-grid tf-grid-2">
                    <div class="tf-field">
                        <label>انبار <span class="req">*</span></label>
                        <select id="agfStockType" ${isEdit ? 'disabled' : ''}>${stockOpts}</select>
                    </div>
                    <div class="tf-field">
                        <label>کد گروه <span class="req">*</span></label>
                        <input type="text" id="agfCode"
                               value="${codeValue != null ? codeValue : ''}"
                               dir="ltr" inputmode="numeric" maxlength="3"
                               ${isEdit ? 'readonly' : ''}
                               style="${isEdit ? 'background:#F3F4F6; cursor:not-allowed;' : ''}">
                        ${codeHint}
                    </div>
                    <div class="tf-field">
                        <label>نام گروه <span class="req">*</span></label>
                        <input type="text" id="agfName" value="${H.esc(d.name || '')}" maxlength="50">
                    </div>
                    <div class="tf-field">
                        <label>مقیاس (Degree)</label>
                        <input type="text" id="agfDegree"
                               value="${d.degree != null ? d.degree : ''}"
                               dir="ltr" inputmode="decimal"
                               placeholder="مثلاً 1 یا 0.5">
                    </div>
                </div>
            </div>

            <div class="tf-footer">
                <button class="btn btn-primary tf-save-btn" id="agfSaveBtn">
                    💾 ${isEdit ? 'ذخیره' : 'ثبت'}
                </button>
                <button class="btn btn-ghost" id="agfCancelBtn">انصراف</button>
                <span class="tf-footer-hint">
                    کلیدها: <kbd>F2</kbd> / <kbd>Ctrl+Enter</kbd> ذخیره — <kbd>Esc</kbd> انصراف
                </span>
            </div>
        </div>`;
    }

    let _keyHandler = null;

    function bindEvents() {
        document.getElementById('agfSaveBtn')?.addEventListener('click', save);
        document.getElementById('agfCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        const codeEl = document.getElementById('agfCode');
        codeEl?.addEventListener('input', () => {
            const cleaned = codeEl.value.replace(/[^0-9]/g, '').slice(0, 3);
            if (cleaned !== codeEl.value) codeEl.value = cleaned;
        });

        // ⭐ تغییر انبار در state (فقط create)
        document.getElementById('agfStockType')?.addEventListener('change', async (e) => {
            const sid = parseInt(e.target.value);
            if (!isNaN(sid)) {
                _state.suggestedCode = await loadNextCode(sid);
                const hint = document.querySelector('.tf-code-hint');
                if (hint) hint.textContent = `کد بعدی در این انبار: ${H.fmt(_state.suggestedCode)}`;
                const codeInp = document.getElementById('agfCode');
                if (codeInp && !_state.isEdit) codeInp.value = _state.suggestedCode;
            }
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
        const btn = document.getElementById('agfSaveBtn');
        const orig = btn.textContent;

        const val = id => document.getElementById(id)?.value?.trim() || null;

        const stockTypeId = parseInt(val('agfStockType'));
        if (!stockTypeId || stockTypeId <= 0) {
            window.App.toast('انتخاب انبار الزامی است', 'error');
            return;
        }

        const codeStr = val('agfCode');
        if (!codeStr) {
            window.App.toast('کد گروه الزامی است', 'error');
            return;
        }
        const codeNum = parseInt(codeStr, 10);
        if (isNaN(codeNum) || codeNum <= 0) {
            window.App.toast('کد باید عددی و بزرگ‌تر از صفر باشد', 'error');
            return;
        }
        if (codeNum > 999) {
            window.App.toast('کد گروه حداکثر ۳ رقم (۹۹۹)', 'error');
            return;
        }

        const name = val('agfName');
        if (!name) {
            window.App.toast('نام گروه الزامی است', 'error');
            return;
        }

        const degreeStr = val('agfDegree');
        let degree = null;
        if (degreeStr) {
            degree = parseFloat(degreeStr.replace(/[^\d.-]/g, ''));
            if (isNaN(degree)) degree = null;
        }

        const payload = {
            stockTypeId: stockTypeId,
            code: codeNum,
            name: name,
            degree: degree
        };

        try {
            btn.disabled = true;
            btn.textContent = '⏳ در حال ذخیره...';

            if (_state.isEdit) {
                payload.id = _state.id;
                await window.App.Http.api('/api/article-group/' + _state.id, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.App.toast('گروه کالا به‌روزرسانی شد', 'success');
            } else {
                await window.App.Http.api('/api/article-group', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.App.toast('گروه کالا جدید ثبت شد', 'success');
            }

            if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
            window.App.closeModal();

            try {
                if (window.App.state.currentPage === 'article-group') {
                    window.App.Features.ArticleGroup.runList(1);
                }
            } catch (e) { console.error(e); }
        } catch (err) {
            window.App.toast(err.message || 'خطا در ذخیره', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
    }

    async function deleteArticleGroup(id) {
        if (window.App.Permissions && !window.App.Permissions.can(225)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        let usage = null;
        try {
            usage = await window.App.Http.api(`/api/article-group/${id}/usage`);
        } catch (e) { console.warn(e); }

        if (usage && !usage.canDelete) {
            await window.App.alert.warning(
                usage.reason || 'این گروه قابل حذف نیست',
                { title: '🔒 قابل حذف نیست' }
            );
            return;
        }

        const ok = await window.App.confirm(
            'آیا از حذف این گروه کالا مطمئن هستید؟',
            { title: '🗑️ حذف گروه کالا', danger: true, okText: 'بله، حذف کن', cancelText: 'لغو' }
        );
        if (!ok) return;

        try {
            await window.App.Http.api('/api/article-group/' + id, { method: 'DELETE' });
            window.App.toast('گروه حذف شد', 'success');
            try {
                if (window.App.state.currentPage === 'article-group') {
                    window.App.Features.ArticleGroup.runList(1);
                }
            } catch (e) { console.error(e); }
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا در حذف', { title: 'خطا' });
        }
    }

    return { openCreate, openEdit, delete: deleteArticleGroup };
})();