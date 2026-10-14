/* ═══════════════════════════════════════════════════
   Feature / BankAcc — مدیریت حساب‌های بانکی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.BankAcc = (function () {
    'use strict';

    const H = window.App.Helpers;

    let _state = {
        items: [],
        banks: [],
        page: 1,
        pageSize: 50,
        totalCount: 0,
        totalPages: 1,
        filterBankId: 0,
        search: ''
    };

    // ═══════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>🏦 حساب‌های بانکی</span>
                    <div class="fac-actions">
                        <button class="btn btn-primary btn-sm" data-permission="235"
                                onclick="App.Features.BankAcc.openCreate()">
                            ➕ حساب بانکی جدید
                        </button>
                    </div>
                </div>
                <div class="bank-acc-filters" style="display:flex; gap:10px; flex-wrap:wrap; padding:10px 14px; background:#F9FAFB; border-bottom:1px solid #E5E7EB;">
                    <div class="form-group" style="margin:0; min-width:200px;">
                        <label style="font-size:11px; color:#6B7280;">بانک</label>
                        <select id="baBankFilter" style="padding:6px 10px; border:1px solid #D1D5DB; border-radius:6px; font-family:inherit;">
                            <option value="0">همه بانک‌ها</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin:0; flex:1; min-width:200px;">
                        <label style="font-size:11px; color:#6B7280;">جستجو (شعبه، شماره حساب، ...)</label>
                        <input type="text" id="baSearch" placeholder="جستجو..." style="padding:6px 10px; border:1px solid #D1D5DB; border-radius:6px; font-family:inherit;">
                    </div>
                    <div style="display:flex; align-items:flex-end; gap:6px;">
                        <button class="btn btn-primary btn-sm" id="baSearchBtn">🔍 جستجو</button>
                        <button class="btn btn-ghost btn-sm" id="baClearBtn">✕ پاک کردن</button>
                    </div>
                </div>
                <div id="baListWrap">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>`;

        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(c);
        }

        // بارگذاری بانک‌ها برای فیلتر
        await loadBanks();

        // Events
        document.getElementById('baSearchBtn').addEventListener('click', () => {
            _state.filterBankId = parseInt(document.getElementById('baBankFilter').value, 10) || 0;
            _state.search = (document.getElementById('baSearch').value || '').trim();
            _state.page = 1;
            loadList();
        });
        document.getElementById('baClearBtn').addEventListener('click', () => {
            document.getElementById('baBankFilter').value = '0';
            document.getElementById('baSearch').value = '';
            _state.filterBankId = 0;
            _state.search = '';
            _state.page = 1;
            loadList();
        });
        document.getElementById('baSearch').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('baSearchBtn').click();
        });

        loadList();
    }

    async function loadBanks() {
        try {
            const items = await window.App.Http.api('/api/bank/list');
            _state.banks = items || [];
            const sel = document.getElementById('baBankFilter');
            if (!sel) return;
            sel.innerHTML = '<option value="0">همه بانک‌ها</option>' +
                _state.banks.map(b =>
                    `<option value="${b.id}">${H.esc(b.name || '')}</option>`
                ).join('');
        } catch { _state.banks = []; }
    }

    // ═══════════════════════════════════════════════════
    //  LOAD LIST
    // ═══════════════════════════════════════════════════
    async function loadList() {
        const wrap = document.getElementById('baListWrap');
        if (!wrap) return;
        wrap.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const resp = await window.App.Http.api('/api/bank/acc/list', {
                method: 'POST',
                body: JSON.stringify({
                    bankId: _state.filterBankId || null,
                    search: _state.search || null,
                    page: _state.page,
                    pageSize: _state.pageSize
                })
            });
            _state.items = resp.items || [];
            _state.totalCount = resp.totalCount || 0;
            _state.totalPages = resp.totalPages || 1;
            _state.page = resp.page || 1;
            renderList();
        } catch (err) {
            wrap.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function renderList() {
        const wrap = document.getElementById('baListWrap');
        const items = _state.items;

        if (items.length === 0) {
            wrap.innerHTML = `
                <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                    <div style="font-size:56px;opacity:0.4;">🏦</div>
                    <p style="margin-top:12px;">حساب بانکی یافت نشد</p>
                </div>`;
            return;
        }

        const rows = items.map(a => {
            const coding = a.codeCol
                ? `<span class="num" style="font-family:Consolas,monospace;font-size:11px;">
                     ${a.codeCol}${a.codeMoein ? '-' + a.codeMoein : ''}${a.codeTafzil ? '-' + a.codeTafzil : ''}
                   </span>`
                : '<span style="color:#94A3B8;">—</span>';

            return `
                <tr>
                    <td class="text-center" style="width:60px;">${a.id}</td>
                    <td>${H.esc(a.bankName || '')}</td>
                    <td>${H.esc(a.shobe || '')}</td>
                    <td class="num" style="font-family:Consolas,monospace;">${H.esc(a.noHesab || '')}</td>
                    <td class="text-center">${coding}</td>
                    <td>${H.esc(a.descript || '')}</td>
                    <td class="num" style="font-family:Consolas,monospace;font-size:12px;">${H.esc(a.phone || '')}</td>
                    <td class="text-center" style="width:120px;">
                        <button class="btn btn-sm btn-ghost" data-permission="236"
                                onclick="App.Features.BankAcc.openEdit(${a.id})" title="ویرایش">✏️</button>
                        <button class="btn btn-sm btn-ghost" data-permission="237"
                                onclick="App.Features.BankAcc.deleteItem(${a.id})"
                                title="حذف" style="color:var(--danger);">🗑️</button>
                    </td>
                </tr>`;
        }).join('');

        wrap.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th style="width:60px;">شناسه</th>
                        <th>بانک</th>
                        <th>شعبه</th>
                        <th>شماره حساب</th>
                        <th style="width:140px;">کدینگ</th>
                        <th>شرح</th>
                        <th style="width:120px;">تلفن</th>
                        <th style="width:120px;">عملیات</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${buildPagination()}`;

        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(wrap);
        }
        if (window.App.enhanceTables) {
            window.App.enhanceTables(wrap);
        }
    }

    function buildPagination() {
        if (_state.totalPages <= 1) {
            return `<div class="pagination-bar">
                <div class="pagination-info">مجموع: ${H.fmt(_state.totalCount)} حساب</div>
            </div>`;
        }
        const page = _state.page;
        const totalPages = _state.totalPages;
        let startPage = Math.max(1, page - 3);
        let endPage = Math.min(totalPages, startPage + 6);
        if (endPage - startPage < 6) startPage = Math.max(1, endPage - 6);

        let btns = '';
        for (let p = startPage; p <= endPage; p++) {
            btns += `<button class="page-btn ${p === page ? 'active' : ''}"
                        onclick="App.Features.BankAcc.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${_state.items.length} از ${H.fmt(_state.totalCount)}</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.BankAcc.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.BankAcc.goToPage(${page - 1})">‹ قبلی</button>
                ${btns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.BankAcc.goToPage(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.BankAcc.goToPage(${totalPages})">»</button>
            </div>
        </div>`;
    }

    function goToPage(p) {
        _state.page = p;
        loadList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ═══════════════════════════════════════════════════
    //  CREATE
    // ═══════════════════════════════════════════════════
    function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(235)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        openForm({
            id: 0, bankId: _state.filterBankId || 0,
            shobe: '', noHesab: '', descript: '', address: '', phone: '',
            codeCol: 0, codeMoein: 0, codeTafzil: 0,
            codingName: ''
        }, 'create');
    }

    async function openEdit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(236)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        try {
            const item = await window.App.Http.api('/api/bank/acc/' + id);
            if (!item) {
                window.App.toast('حساب بانکی یافت نشد', 'error');
                return;
            }
            openForm(item, 'edit');
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════
    //  FORM
    // ═══════════════════════════════════════════════════
    function openForm(data, mode) {
        const isEdit = mode === 'edit';
        const title = isEdit ? '✏️ ویرایش حساب بانکی' : '➕ حساب بانکی جدید';

        const bankOpts = ['<option value="0">— انتخاب بانک —</option>']
            .concat(_state.banks.map(b =>
                `<option value="${b.id}" ${data.bankId == b.id ? 'selected' : ''}>${H.esc(b.name || '')}</option>`
            )).join('');

        // coding نمایش
        const codePart = data.codeCol
            ? `${data.codeCol}${data.codeMoein ? '-' + data.codeMoein : ''}${data.codeTafzil ? '-' + data.codeTafzil : ''}`
            : '';

        // ⭐ اسم کدینگ: از سرور میاد (codeColName / codeMoeinName / codeTafzilName)
        const namePart = [
            data.codeTafzilName || '',
            data.codeMoeinName || '',
            data.codeColName || ''
        ].filter(Boolean).join(' - ');

        const body = `
            <div class="bank-acc-form" data-help="bank-acc-form" style="max-height:70vh; overflow-y:auto; padding:4px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="form-group">
                        <label>بانک <span class="req" style="color:#DC2626;">*</span></label>
                        <select id="baBankId" style="width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px; font-family:inherit;">
                            ${bankOpts}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>شماره حساب <span class="req" style="color:#DC2626;">*</span></label>
                        <input type="text" id="baNoHesab" value="${H.esc(data.noHesab || '')}"
                               maxlength="50" placeholder="مثلاً: 1234567890"
                               style="width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px; font-family:Consolas,monospace; direction:ltr;">
                    </div>
                </div>

                <div class="form-group" style="margin-top:12px;">
                    <label>شعبه</label>
                    <input type="text" id="baShobe" value="${H.esc(data.shobe || '')}"
                           maxlength="50" placeholder="نام شعبه"
                           style="width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px; font-family:inherit;">
                </div>

                <div class="form-group" style="margin-top:12px;">
                    <label>شرح</label>
                    <input type="text" id="baDescript" value="${H.esc(data.descript || '')}"
                           maxlength="255" placeholder="شرح (اختیاری)"
                           style="width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px; font-family:inherit;">
                </div>

                <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-top:12px;">
                    <div class="form-group">
                        <label>آدرس</label>
                        <input type="text" id="baAddress" value="${H.esc(data.address || '')}"
                               maxlength="150" placeholder="آدرس"
                               style="width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px; font-family:inherit;">
                    </div>
                    <div class="form-group">
                        <label>تلفن</label>
                        <input type="text" id="baPhone" value="${H.esc(data.phone || '')}"
                               maxlength="50" placeholder="تلفن"
                               style="width:100%; padding:8px; border:1px solid #D1D5DB; border-radius:6px; font-family:Consolas,monospace; direction:ltr;">
                    </div>
                </div>

                <div style="margin-top:16px; padding:12px; background:#F9FAFB; border:1px dashed #D1D5DB; border-radius:8px;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                        <label style="font-size:12px; color:#374151; font-weight:600;">کدینگ حساب</label>
                        <button type="button" class="btn btn-sm btn-primary" id="baPickCodingBtn"
                                style="padding:4px 10px; font-size:12px;">🏦 انتخاب از حساب‌ها</button>
                        <button type="button" class="btn btn-sm btn-ghost" id="baClearCodingBtn"
                                style="padding:4px 10px; font-size:12px;">✕ پاک کردن</button>
                    </div>
                    <div id="baCodingDisplay" style="font-size:13px; color:#4F46E5; padding:6px 10px; background:#EEF2FF; border-radius:6px; min-height:32px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        ${codePart
                ? `<span style="font-family:Consolas,monospace; font-weight:600;">${codePart}</span>
                               ${namePart
                    ? `<span style="color:#3730A3; font-family:inherit;">— ${H.esc(namePart)}</span>`
                    : ''}`
                : '<span style="color:#94A3B8; font-family:inherit;">انتخاب نشده</span>'}
                    </div>
                </div>

                <div style="display:flex; gap:10px; margin-top:20px; padding-top:16px; border-top:1px solid #E5E7EB;">
                    <button class="btn btn-primary" id="baSaveBtn">💾 ذخیره</button>
                    <button class="btn btn-ghost" id="baCancelBtn">انصراف</button>
                </div>
            </div>`;

        window.App.openModal(title, body);

        // state محلی
        const local = {
            codeCol: data.codeCol || 0,
            codeMoein: data.codeMoein || 0,
            codeTafzil: data.codeTafzil || 0,
            codingName: '',
            codingCode: ''
        };

        function updateCodingDisplay() {
            const el = document.getElementById('baCodingDisplay');

            if (data.codeCol) {
                // از سرور خودش کد و اسم میاد
                local.codingCode = [data.codeCol, data.codeMoein, data.codeTafzil]
                    .filter(Boolean).join('-');
                local.codingName = [data.codeTafzilName, data.codeMoeinName, data.codeColName]
                    .filter(Boolean).join(' - ');
            }

            el.innerHTML = `
                <span style="font-family:Consolas,monospace; font-weight:600; color:#4F46E5;">${H.esc(local.codingCode)}</span>
                ${local.codingName ? `<span style="color:#3730A3; font-family:inherit; margin-right:8px;">— ${H.esc(local.codingName)}</span>` : ''}`;
        }
        // انتخاب کدینگ
        document.getElementById('baPickCodingBtn').addEventListener('click', async () => {
            if (!window.App.UI.HesabPicker) {
                window.App.toast('HesabPicker بارگذاری نشده', 'error');
                return;
            }
            try {
                const r = await window.App.UI.HesabPicker.open({
                    mode: 'full',
                    allowCreate: false,
                    initial: local.codeCol
                        ? { codeCol: local.codeCol, codeMoein: local.codeMoein, codeTafzil: local.codeTafzil }
                        : null
                });
                if (!r) return;
                local.codeCol = r.codeCol || 0;
                local.codeMoein = r.codeMoein || 0;
                local.codeTafzil = r.codeTafzil || 0;
                local.codingName = r.fullName || r.name || '';   // ⭐ اسم کامل
                local.codingCode = r.codeDisplay || ''; 
                updateCodingDisplay();
            } catch (err) {
                console.error(err);
            }
        });

        document.getElementById('baClearCodingBtn').addEventListener('click', () => {
            local.codeCol = 0;
            local.codeMoein = 0;
            local.codeTafzil = 0;
            updateCodingDisplay();
        });

        // ذخیره
        const saveBtn = document.getElementById('baSaveBtn');
        document.getElementById('baCancelBtn').addEventListener('click', () => window.App.closeModal());

        saveBtn.addEventListener('click', async () => {
            const bankId = parseInt(document.getElementById('baBankId').value, 10) || 0;
            const noHesab = (document.getElementById('baNoHesab').value || '').trim();
            const shobe = (document.getElementById('baShobe').value || '').trim();
            const descript = (document.getElementById('baDescript').value || '').trim();
            const address = (document.getElementById('baAddress').value || '').trim();
            const phone = (document.getElementById('baPhone').value || '').trim();

            if (!bankId) {
                window.App.toast('انتخاب بانک الزامی است', 'error');
                return;
            }
            if (!noHesab) {
                window.App.toast('شماره حساب الزامی است', 'error');
                document.getElementById('baNoHesab').focus();
                return;
            }

            const payload = {
                bankId, noHesab, shobe, descript, address, phone,
                codeCol: local.codeCol || null,
                codeMoein: local.codeMoein || null,
                codeTafzil: local.codeTafzil || null
            };

            saveBtn.disabled = true;
            const orig = saveBtn.textContent;
            saveBtn.textContent = '⏳ در حال ذخیره...';

            try {
                if (isEdit) {
                    await window.App.Http.api('/api/bank/acc/' + data.id, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    window.App.toast('حساب بانکی به‌روزرسانی شد', 'success');
                } else {
                    await window.App.Http.api('/api/bank/acc', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    window.App.toast('حساب بانکی جدید ثبت شد', 'success');
                }
                window.App.closeModal();
                loadList();
            } catch (err) {
                saveBtn.disabled = false;
                saveBtn.textContent = orig;
            }
        });

        setTimeout(() => document.getElementById('baBankId')?.focus(), 50);
    }

    // ═══════════════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════════════
    async function deleteItem(id) {
        if (window.App.Permissions && !window.App.Permissions.can(237)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        const item = _state.items.find(x => x.id === id);
        if (!item) return;

        const ok = await window.App.confirm(
            `آیا از حذف حساب «${item.noHesab}» مطمئن هستید؟`,
            { title: 'حذف حساب بانکی', danger: true, okText: 'بله، حذف کن' }
        );
        if (!ok) return;

        try {
            await window.App.Http.api('/api/bank/acc/' + id, { method: 'DELETE' });
            window.App.toast('حساب بانکی حذف شد', 'success');
            loadList();
        } catch { /* خطا خودکار Toast */ }
    }

    return { render, loadList, openCreate, openEdit, deleteItem, goToPage };
})();

window.App.renderBankAcc = window.App.Features.BankAcc.render;