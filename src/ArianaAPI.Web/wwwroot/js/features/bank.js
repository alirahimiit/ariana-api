/* ═══════════════════════════════════════════════════
   Feature / Bank — مدیریت بانک‌ها
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Bank = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = { items: [], loading: false };

    // ═══════════════════════════════════════════════════
    //  RENDER — صفحه اصلی
    // ═══════════════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>🏦 لیست بانک‌ها</span>
                    <div class="fac-actions">
                        <button class="btn btn-primary btn-sm" data-permission="232"
                                onclick="App.Features.Bank.openCreate()">
                            ➕ بانک جدید
                        </button>
                    </div>
                </div>
                <div id="bankListWrap">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>`;

        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(c);
        }

        loadList();
    }

    // ═══════════════════════════════════════════════════
    //  LOAD LIST
    // ═══════════════════════════════════════════════════
    async function loadList() {
        const wrap = document.getElementById('bankListWrap');
        if (!wrap) return;
        wrap.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const items = await window.App.Http.api('/api/bank/list');
            _state.items = items || [];
            renderList();
        } catch (err) {
            wrap.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function renderList() {
        const wrap = document.getElementById('bankListWrap');
        const items = _state.items;

        if (items.length === 0) {
            wrap.innerHTML = `
                <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                    <div style="font-size:56px;opacity:0.4;">🏦</div>
                    <p style="margin-top:12px;">هیچ بانکی ثبت نشده است</p>
                </div>`;
            return;
        }

        const rows = items.map(b => `
            <tr>
                <td class="num text-center" style="width:70px;">${b.id}</td>
                <td>${H.esc(b.name || '')}</td>
                <td class="num" style="width:120px;">${H.esc(b.code || '')}</td>
                <td class="text-center" style="width:120px;">
                    <button class="btn btn-sm btn-ghost" data-permission="233"
                            onclick="App.Features.Bank.openEdit(${b.id})" title="ویرایش">✏️</button>
                    <button class="btn btn-sm btn-ghost" data-permission="234"
                            onclick="App.Features.Bank.deleteItem(${b.id})"
                            title="حذف" style="color:var(--danger);">🗑️</button>
                </td>
            </tr>`).join('');

        wrap.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th style="width:70px;">شناسه</th>
                        <th>نام بانک</th>
                        <th style="width:120px;">کد</th>
                        <th style="width:120px;">عملیات</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(wrap);
        }
        if (window.App.enhanceTables) {
            window.App.enhanceTables(wrap);
        }
    }

    // ═══════════════════════════════════════════════════
    //  CREATE
    // ═══════════════════════════════════════════════════
    function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(232)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        openForm({ id: 0, name: '', code: '' }, 'create');
    }

    // ═══════════════════════════════════════════════════
    //  EDIT
    // ═══════════════════════════════════════════════════
    function openEdit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(233)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        const item = _state.items.find(x => x.id === id);
        if (!item) {
            window.App.toast('بانک یافت نشد', 'error');
            return;
        }
        openForm(item, 'edit');
    }

    // ═══════════════════════════════════════════════════
    //  FORM (create/edit)
    // ═══════════════════════════════════════════════════
    function openForm(data, mode) {
        const isEdit = mode === 'edit';
        const title = isEdit ? '✏️ ویرایش بانک' : '➕ بانک جدید';

        const body = `
            <div class="bank-form" data-help="bank-form">
                <div class="form-group" style="margin-bottom:12px;">
                    <label>نام بانک <span class="req" style="color:#DC2626;">*</span></label>
                    <input type="text" id="bkName" value="${H.esc(data.name || '')}"
                           maxlength="50" placeholder="مثلاً: بانک ملی ایران" autofocus>
                </div>
                <div class="form-group" style="margin-bottom:16px;">
                    <label>کد (اختیاری)</label>
                    <input type="text" id="bkCode" value="${H.esc(data.code || '')}"
                           maxlength="50" placeholder="مثلاً: 001">
                </div>
                <div style="display:flex; gap:10px; margin-top:18px;">
                    <button class="btn btn-primary" id="bkSaveBtn">💾 ذخیره</button>
                    <button class="btn btn-ghost" id="bkCancelBtn">انصراف</button>
                </div>
            </div>`;

        window.App.openModal(title, body);

        const saveBtn = document.getElementById('bkSaveBtn');
        const cancelBtn = document.getElementById('bkCancelBtn');
        const nameInput = document.getElementById('bkName');
        const codeInput = document.getElementById('bkCode');

        const closeModal = () => window.App.closeModal();

        cancelBtn.addEventListener('click', closeModal);

        saveBtn.addEventListener('click', async () => {
            const name = (nameInput.value || '').trim();
            const code = (codeInput.value || '').trim();

            if (!name) {
                window.App.toast('نام بانک الزامی است', 'error');
                nameInput.focus();
                return;
            }

            saveBtn.disabled = true;
            const orig = saveBtn.textContent;
            saveBtn.textContent = '⏳ در حال ذخیره...';

            try {
                const payload = { name, code };
                if (isEdit) {
                    await window.App.Http.api('/api/bank/' + data.id, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    window.App.toast('بانک به‌روزرسانی شد', 'success');
                } else {
                    await window.App.Http.api('/api/bank', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    window.App.toast('بانک جدید ثبت شد', 'success');
                }
                closeModal();
                loadList();
            } catch (err) {
                saveBtn.disabled = false;
                saveBtn.textContent = orig;
            }
        });

        // Enter → ذخیره
        nameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') codeInput.focus();
        });
        codeInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') saveBtn.click();
        });
    }

    // ═══════════════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════════════
    async function deleteItem(id) {
        if (window.App.Permissions && !window.App.Permissions.can(234)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        const item = _state.items.find(x => x.id === id);
        if (!item) return;

        const ok = await window.App.confirm(
            `آیا از حذف بانک «${item.name}» مطمئن هستید؟`,
            { title: 'حذف بانک', danger: true, okText: 'بله، حذف کن' }
        );
        if (!ok) return;

        try {
            await window.App.Http.api('/api/bank/' + id, { method: 'DELETE' });
            window.App.toast('بانک حذف شد', 'success');
            loadList();
        } catch (err) {
            // خطای Business (مثل «حساب بانکی دارد») از Http.api خودکار Toast می‌شه
        }
    }

    // ═══════════════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════════════
    return {
        render,
        loadList,
        openCreate,
        openEdit,
        deleteItem
    };
})();

window.App.renderBank = window.App.Features.Bank.render;