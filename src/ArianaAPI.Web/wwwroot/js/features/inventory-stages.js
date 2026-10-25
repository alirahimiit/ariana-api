/* ═══════════════════════════════════════════════════
   Feature / InventoryStages — تعریف مراحل انبارگردانی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.InventoryStages = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;
    let _state = { lookups: null, stages: [] };

    // ═══════════════════════════════════════════════════
    //  رندر صفحه اصلی
    // ═══════════════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            // گرفتن اطلاعات پایه (انبارها)
            _state.lookups = await window.App.Http.api('/api/inventory/lookups');

            const stockOpts = _state.lookups.stockTypes.map(s =>
                `<option value="${s.id}">${H.esc(s.name)}</option>`
            ).join('');

                c.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="margin:0; font-size:18px; color:#1E293B;">⚙️ تعریف مراحل انبارگردانی</h2>
                    <button class="btn btn-sm btn-outline-secondary" onclick="App.Features.Inventory.render()">
                        ⬅️ بازگشت به مرکز مدیریت
                    </button>
                </div>
                <div class="card filter-card" id="invStageFilterCard">
            
                <div class="card-title" id="invStageToggleBtn">
                    <span>⚙️ فیلتر مراحل انبارگردانی</span>
                    <span class="ft-icon">▼</span>
                </div>
                <div class="filter-body" id="invStageFilterBody">
                    <div class="filters two-rows">
                        <div class="form-group">
                            <label>انبار</label>
                            <select id="invStageStockType" class="form-select" style="width:100%;">
                                <option value="">همه انبارها</option>
                                ${stockOpts}
                            </select>
                        </div>
                    </div>
                    <div style="margin-top:14px; display:flex; gap:8px;">
                        <button class="btn btn-primary" id="invStageRunBtn">🔍 نمایش</button>
                        <button class="btn btn-success" id="invStageNewBtn">➕ مرحله جدید</button>
                    </div>
                </div>
            </div>
            <div id="invStageResult"></div>`;

            const card = document.getElementById('invStageFilterCard');
            document.getElementById('invStageToggleBtn').addEventListener('click', () => card.classList.toggle('collapsed'));

            document.getElementById('invStageRunBtn').addEventListener('click', loadStages);
            document.getElementById('invStageNewBtn').addEventListener('click', () => openForm(null));

            // لود اولیه
            loadStages();

        } catch (err) {
            c.innerHTML = `<div class="error-box">خطا در بارگذاری اطلاعات: ${H.esc(err.message)}</div>`;
        }
    }

    // ═══════════════════════════════════════════════════
    //  لود لیست مراحل
    // ═══════════════════════════════════════════════════
    async function loadStages() {
        const container = document.getElementById('invStageResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const stockTypeId = document.getElementById('invStageStockType').value;
        const url = `/api/inventory/stages${stockTypeId ? '?stockTypeId=' + stockTypeId : ''}`;

        try {
            const stages = await window.App.Http.api(url);
            _state.stages = stages;
            renderTable(stages);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function renderTable(stages) {
        const c = document.getElementById('invStageResult');

        const rows = stages.map((s, idx) => `
            <tr data-id="${s.id}">
                <td class="text-center">${idx + 1}</td>
                <td class="text-center">${s.stageNo}</td>
                <td>${H.esc(s.stageName)}</td>
                <td class="text-center">${H.esc(s.startDate)}</td>
                <td class="text-center">${s.endDate ? H.esc(s.endDate) : '-'}</td>
                <td class="text-center">
                    <span class="badge ${s.isActive ? 'badge-success' : 'badge-muted'}">
                        ${s.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge ${s.isClosed ? 'badge-danger' : 'badge-warning'}">
                        ${s.isClosed ? 'بسته شده' : 'باز'}
                    </span>
                </td>
                <td class="text-center">
                    <button class="btn-icon" data-action="edit" data-id="${s.id}" title="ویرایش">✏️</button>
                    <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${s.id}" title="حذف">🗑️</button>
                </td>
            </tr>
        `).join('');

        const empty = stages.length === 0
            ? '<tr><td colspan="8" class="text-center" style="padding:30px;color:#94A3B8;">هیچ مرحله‌ای تعریف نشده است</td></tr>'
            : '';

        c.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>📋 لیست مراحل (${stages.length})</span>
                </div>
                <div class="table-wrapper">
                    <table class="data-table inv-table">
                        <thead>
                            <tr>
                                <th style="width:35px;">#</th>
                                <th style="width:80px;">شماره مرحله</th>
                                <th>نام مرحله</th>
                                <th style="width:100px;">تاریخ شروع</th>
                                <th style="width:100px;">تاریخ پایان</th>
                                <th style="width:80px;">وضعیت</th>
                                <th style="width:80px;">بسته شده</th>
                                <th style="width:100px;">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>${rows || empty}</tbody>
                    </table>
                </div>
            </div>`;

        bindActions();
    }

    // ═══════════════════════════════════════════════════
    //  فرم افزودن / ویرایش
    // ═══════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════
    //  فرم افزودن / ویرایش
    // ═══════════════════════════════════════════════════
    function openForm(stage) {
        const isEdit = !!stage;
        const today = _state.lookups.todayDate;

        // ⭐ ساخت آپشن‌های CustomSelect
        const stockSelectOptions = [{ value: '', label: 'انتخاب کنید...' }];
        _state.lookups.stockTypes.forEach(s => {
            stockSelectOptions.push({ value: String(s.id), label: H.esc(s.name) });
        });
        const selectedStockId = isEdit ? String(stage.stockTypeId) : '';

        const formHtml = `
            <div class="form-group" style="margin-bottom:12px;">
                <label>انبار <span class="req">*</span></label>
                ${CS.html('frmStageStockType', stockSelectOptions, selectedStockId)}
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label>شماره مرحله <span class="req">*</span></label>
                <input type="text" id="frmStageNo" class="num-input" dir="ltr" value="${isEdit ? stage.stageNo : ''}" ${isEdit ? 'readonly' : ''}>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label>نام مرحله <span class="req">*</span></label>
                <input type="text" id="frmStageName" value="${isEdit ? H.esc(stage.stageName) : ''}">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label>تاریخ شروع <span class="req">*</span></label>
                <input type="text" id="frmStageStartDate" dir="ltr" value="${isEdit ? stage.startDate : today}">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="frmStageIsActive" ${isEdit ? (stage.isActive ? 'checked' : '') : 'checked'}>
                    <span>فعال باشد</span>
                </label>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
                <button type="button" class="btn btn-secondary" id="frmStageCancel">لغو</button>
                <button type="button" class="btn btn-primary" id="frmStageSave">${isEdit ? '💾 ذخیره تغییرات' : '➕ ثبت مرحله'}</button>
            </div>
        `;

        if (window.App.openModal) {
            window.App.openModal(isEdit ? '✏️ ویرایش مرحله' : '➕ مرحله جدید', formHtml);
        } else {
            window.App.UI.Modal.open(isEdit ? '✏️ ویرایش مرحله' : '➕ مرحله جدید', formHtml);
        }

        // ⭐ بایند کردن CustomSelect به فرم
        CS.bindAll(document.getElementById('modalBody'), {
            frmStageStockType: function () { } // اگر نیاز به رویداد خاصی بود اینجا اضافه می‌شود
        });

        // بایند دکمه‌ها
        document.getElementById('frmStageCancel').addEventListener('click', () => window.App.closeModal());

        document.getElementById('frmStageSave').addEventListener('click', async function () {
            // ⭐ خواندن مقدار انبار از CustomSelect
            const stockTypeId = CS.getValue('frmStageStockType');
            const stageNo = document.getElementById('frmStageNo').value;
            const stageName = document.getElementById('frmStageName').value.trim();
            const startDate = document.getElementById('frmStageStartDate').value.trim();
            const isActive = document.getElementById('frmStageIsActive').checked;

            if (!stockTypeId) return window.App.toast('انبار را انتخاب کنید', 'warning');
            if (!stageNo) return window.App.toast('شماره مرحله را وارد کنید', 'warning');
            if (!stageName) return window.App.toast('نام مرحله را وارد کنید', 'warning');
            if (!startDate) return window.App.toast('تاریخ شروع را وارد کنید', 'warning');

            const payload = {
                stockTypeId: parseInt(stockTypeId, 10),
                stageNo: parseInt(stageNo, 10),
                stageName: stageName,
                startDate: startDate,
                isActive: isActive
            };

            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '⏳ در حال ذخیره...';

            try {
                if (isEdit) {
                    await window.App.Http.api(`/api/inventory/stages/${stage.id}`, {
                        method: 'PUT', body: JSON.stringify(payload), successMsg: 'با موفقیت ویرایش شد'
                    });
                } else {
                    await window.App.Http.api('/api/inventory/stages', {
                        method: 'POST', body: JSON.stringify(payload), successMsg: 'با موفقیت ثبت شد'
                    });
                }
                window.App.closeModal();
                loadStages();
            } catch (e) {
                btn.disabled = false;
                btn.innerHTML = isEdit ? '💾 ذخیره تغییرات' : '➕ ثبت مرحله';
            }
        });
    }
    // ═══════════════════════════════════════════════════
    //  عملیات (ویرایش / حذف)
    // ═══════════════════════════════════════════════════
    function bindActions() {
        document.querySelectorAll('#invStageResult [data-action]').forEach(btn => {
            btn.addEventListener('click', async function () {
                const action = this.dataset.action;
                const id = parseInt(this.dataset.id, 10);
                const stage = _state.stages.find(s => s.id === id);

                if (action === 'edit' && stage) {
                    openForm(stage);
                } else if (action === 'delete') {
                    await handleDelete(id, stage);
                }
            });
        });
    }

    async function handleDelete(id, stage) {
        const ok = await window.App.confirm(
            `آیا از حذف مرحله "${H.esc(stage.stageName)}" مطمئن هستید؟`,
            { danger: true, okText: 'حذف کن' }
        );
        if (!ok) return;

        try {
            await window.App.Http.api(`/api/inventory/stages/${id}`, {
                method: 'DELETE', successMsg: 'مرحله حذف شد'
            });
            loadStages();
        } catch (e) {
            // خطای مربوط به داشتن تگ در Http.api خودکار نمایش داده می‌شود
        }
    }

    return { render };
})();

// اتصال به روتر (Router)
window.App.renderInventoryStages = window.App.Features.InventoryStages.render;