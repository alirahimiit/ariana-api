/* ═══════════════════════════════════════════════════
  Feature / Sanad (اسناد حسابداری) — نسخه 2.0
  ⭐ جدید: Multi-Select + Bulk Delete + Copy to FY
  ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Sanad = (function () {
    'use strict';

    let _filters = {};
    let _sort = { by: 'noSanad', dir: 'desc' };
    let _accountFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };

    let _detailFilter = { errorType: 'all', highlightRowId: null }; // ⭐ highlightRowId اضافه شد
    let _detailData = { detail: null, items: [] };

    // ⭐ جدید: انتخاب چندتایی
    let _selected = new Set();
    let _currentItems = [];

    const H = window.App.Helpers;
    const S = window.App.State;

    function sortIcon(field) {
        if (_sort.by !== field) return '<span style="opacity:0.3;font-size:10px;">⇅</span>';
        return _sort.dir === 'asc'
            ? '<span style="color:#4F46E5;font-size:10px;">▲</span>'
            : '<span style="color:#4F46E5;font-size:10px;">▼</span>';
    }

    function sortBy(field) {
        if (_sort.by === field) _sort.dir = _sort.dir === 'asc' ? 'desc' : 'asc';
        else { _sort.by = field; _sort.dir = 'asc'; }
        window.App.state.sanadPage = 1;
        loadList();
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="sanad-account-bar">
                <button type="button" class="btn btn-ghost btn-sm" id="openAccountPickerBtn">
                    🏦 انتخاب از حساب‌ها
                </button>
                <span id="selectedAccountLabel" class="selected-account-label"></span>
                <button type="button" class="btn btn-ghost btn-sm" id="clearAccountFilterBtn" style="display:none;">
                    ✕ پاک کردن
                </button>
            </div>
            <div id="sanadFilters"></div>
            <div id="sanadListContainer">
                <div class="loading"><div class="spinner"></div></div>
            </div>`;

        FilterPanel.render(document.getElementById('sanadFilters'), {
            pageKey: 'sanad',
            runButtonText: '🔍 جستجوی اسناد',
            sections: buildFilterSchema(),
            onRun: (values) => {
                _filters = values;
                window.App.state.sanadPage = 1;
                _selected.clear();
                loadList();
            }
        });

        document.getElementById('openAccountPickerBtn')
            ?.addEventListener('click', openAccountPicker);
        document.getElementById('clearAccountFilterBtn')
            ?.addEventListener('click', clearAccountFilter);
        updateAccountBar();

        _filters = FilterPanel.getValues();
        _selected.clear();
        loadList();
        bindListShortcuts();
    }

    function buildFilterSchema() {
        return [
            {
                title: 'بازه تاریخی و شماره', icon: '📅', cols: 4,
                fields: [
                    { name: 'fromDate', label: 'از تاریخ', type: 'date' },
                    { name: 'toDate', label: 'تا تاریخ', type: 'date' },
                    { name: 'noFrom', label: 'از شماره', type: 'number', placeholder: '۱' },
                    { name: 'noTo', label: 'تا شماره', type: 'number' },
                    { name: 'sharh', label: 'شرح سند', type: 'text', placeholder: 'جستجوی بخشی از شرح سند...' },
                    { name: 'rowSharh', label: 'شرح ردیف', type: 'text', placeholder: 'جستجوی بخشی از شرح ردیف...' }
                ]
            },
            {
                title: 'وضعیت و نوع', icon: '🏷️', cols: 4,
                fields: [
                    {
                        name: 'vazeit', label: 'وضعیت سند', type: 'select', placeholder: 'همه',
                        options: [
                            { value: '0', label: 'پیش‌نویس' },
                            { value: '1', label: 'ثبت شده' },
                            { value: '2', label: 'تأیید شده' }
                        ]
                    },
                    {
                        name: 'kindSanad', label: 'نوع سند', type: 'select', placeholder: 'همه',
                        options: [
                            { value: '0', label: 'عادی' },
                            { value: '1', label: 'افتتاحیه' },
                            { value: '2', label: 'اختتامیه' }
                        ]
                    },
                    {
                        name: 'onlyWithErrors', label: 'نمایش', type: 'select', placeholder: 'همه اسناد',
                        options: [{ value: 'true', label: '⚠️ فقط دارای ایراد' }]
                    }
                ]
            }
        ];
    }

    // ═══════════════════════════════════════════
    //  LOAD
    // ═══════════════════════════════════════════
    async function loadList() {
        const container = document.getElementById('sanadListContainer');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const url = buildUrl();
            const data = await window.App.Http.api(url);
            _currentItems = data || [];
            // پاک‌سازی انتخاب‌هایی که دیگه در لیست نیستن
            const ids = new Set(_currentItems.map(x => x.parentSanadID));
            [..._selected].forEach(id => { if (!ids.has(id)) _selected.delete(id); });

            // ⭐ همیشه لیست را با هدر (دکمه‌ها) رندر کن
            container.innerHTML = buildListHtml(_currentItems);

            if (window.App.UI.PermissionGuard) {
                window.App.UI.PermissionGuard.apply(container);
            }

            Exporter.attach(container, {
                table: container.querySelector('table'),
                title: 'لیست اسناد حسابداری',
                subtitle: subtitle(),
                filename: 'SanadList'
            });

            bindCheckboxes();
            updateBulkToolbar();

        } catch (err) {
            container.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    }

    function buildUrl() {
        const f = _filters || {};
        const pageSize = S.getSettings().pageSize;
        const page = window.App.state.sanadPage;

        let url = `/api/sanad?page=${page}&pageSize=${pageSize}`;
        if (f.fromDate) url += `&fromDate=${encodeURIComponent(f.fromDate)}`;
        if (f.toDate) url += `&toDate=${encodeURIComponent(f.toDate)}`;
        if (f.noFrom != null && f.noFrom !== '') url += `&noFrom=${parseInt(f.noFrom)}`;
        if (f.noTo != null && f.noTo !== '') url += `&noTo=${parseInt(f.noTo)}`;
        if (f.vazeit != null && f.vazeit !== '') url += `&vazeit=${parseInt(f.vazeit)}`;
        if (f.kindSanad != null && f.kindSanad !== '') url += `&kindSanad=${parseInt(f.kindSanad)}`;
        if (f.sharh) url += `&sharh=${encodeURIComponent(f.sharh.trim())}`;
        if (f.rowSharh) url += `&rowSharh=${encodeURIComponent(f.rowSharh.trim())}`;
        if (_sort.by) url += `&sortBy=${_sort.by}&sortDir=${_sort.dir}`;
        if (f.onlyWithErrors === 'true') url += `&onlyWithErrors=true`;
        // ⭐ فیلتر کدینگ
        if (_accountFilter.codeCol > 0)
            url += `&codeCol=${_accountFilter.codeCol}`;
        if (_accountFilter.codeMoein > 0)
            url += `&codeMoein=${_accountFilter.codeMoein}`;
        if (_accountFilter.codeTafzil > 0)
            url += `&codeTafzil=${_accountFilter.codeTafzil}`;
        return url;
    }

    function buildListHtml(items) {
        const pageSize = S.getSettings().pageSize;
        const page = window.App.state.sanadPage;
        const allSelected = items.length > 0 && items.every(x => _selected.has(x.parentSanadID));

        const P = window.App.Permissions;

        const rows = items.map(s => {
            const bed = s.mabBed || 0;
            const bes = s.mabBes || 0;
            const isUnbalanced = Math.abs(bed - bes) > 0.01;
            const hasErrors = (s.totalErrorCount || 0) > 0;
            const hasNoItems = (s.itemCount === 0); // ⭐ سند بدون ردیف
            const rowClass = hasNoItems ? 'row-has-errors' : (hasErrors ? 'row-has-errors' : (isUnbalanced ? 'row-unbalanced' : ''));
            const isSel = _selected.has(s.parentSanadID);

            // ⭐ محاسبه دکمه‌های عملیات قبل از return
            let actionBtns = '';

            if (P) {
                const canEdit =
                    (s.vazeit === 0 && P.can(102)) ||
                    (s.vazeit === 1 && (P.can(104) || P.can(105))) ||
                    (s.vazeit === 2 && P.can(103));

                // ⭐⭐ فقط پیش‌نویس قابل حذف — رسیدگی و قطعی نه
                const canDel = P.can(108) && s.vazeit === 0;

                const editTitle = s.vazeit === 2 ? 'ویرایش/برگشت (نیاز به دسترسی ۱۰۳)'
                    : s.vazeit === 1 ? 'ویرایش/برگشت (نیاز به دسترسی ۱۰۴)'
                        : 'ویرایش';

                if (canEdit) {
                    actionBtns += `<button class="btn btn-sm btn-ghost"
                        onclick="event.stopPropagation(); App.Features.SanadForm.openEdit(${s.parentSanadID})"
                        title="${editTitle}">✏️</button>`;
                }
                if (canDel) {
                    actionBtns += `<button class="btn btn-sm btn-ghost"
                        onclick="event.stopPropagation(); App.Features.SanadForm.delete(${s.parentSanadID})"
                        title="حذف" style="color:var(--danger);">🗑️</button>`;
                } else if (P.can(108) && s.vazeit !== 0) {
                    // ⭐ کاربر permission داره ولی سند قفل شده
                    const lockReason = s.vazeit === 1
                        ? 'سند رسیدگی — اول به پیش‌نویس برگردانید'
                        : 'سند قطعی — اول به پیش‌نویس برگردانید';
                    actionBtns += `<button class="btn btn-sm btn-ghost" disabled
                        title="${lockReason}" style="opacity:0.35; cursor:not-allowed;">🔒</button>`;
                }
            } else {
                // fallback اگه Permissions لود نشده
                if (s.vazeit !== 2) {
                    actionBtns += `<button class="btn btn-sm btn-ghost"
                        onclick="event.stopPropagation(); App.Features.SanadForm.openEdit(${s.parentSanadID})"
                        title="ویرایش">✏️</button>`;
                }
                actionBtns += `<button class="btn btn-sm btn-ghost"
                    onclick="event.stopPropagation(); App.Features.SanadForm.delete(${s.parentSanadID})"
                    title="حذف" style="color:var(--danger);">🗑️</button>`;
            }

            return `
            <tr class="${rowClass} ${isSel ? 'row-selected' : ''}" data-id="${s.parentSanadID}">
                <td class="sd-col-check">
                    <input type="checkbox" class="sanad-cb" data-id="${s.parentSanadID}" ${isSel ? 'checked' : ''}>
                </td>
                <td class="num">${H.fmt(s.noSanad)}</td>
                <td class="num">${H.esc(s.dateIn || '-')}</td>
                <td>${H.esc(s.otherParentSharh || '-')}</td>
                <td>${window.App.statusBadge(s.vazeit)}</td>
                <td>${kindSanadText(s.kindSanad)}</td>
                <td class="text-center">${renderErrorBadge(s)}</td>
                <td class="num text-left">${H.fmt(s.mabBed)}</td>
                <td class="num text-left">${H.fmt(s.mabBes)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Sanad.showDetail(${s.parentSanadID})"
                            title="مشاهده">👁️</button>
                    ${actionBtns}
                </td>
            </tr>`;
        }).join('');

        return `
                <div class="card-title">
                    <span>📄 اسناد حسابداری</span>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <!-- ⭐ دکمه‌های اینجا را دست نزنید، همان‌هایی که الان دارید بگذارید -->
                        <button class="btn btn-ghost btn-sm" id="importCsvBtn" title="ورود اسناد از فایل CSV">📥 ورود از فایل</button>
                        <button class="btn btn-ghost btn-sm" id="downloadTemplateBtn" title="دانلود الگوی CSV">📋 الگو</button>
                        <button class="btn btn-info btn-sm" id="sanadOpeningBtn" data-permission="101">📂 افتتاحیه</button>
                        <button class="btn btn-secondary btn-sm" id="sanadMovaghatBtn" data-permission="101">📝 سند موقت</button>
                        <button class="btn btn-warning btn-sm" id="sanadClosingBtn" data-permission="101">🔒 اختتامیه سال</button>
                        <button class="btn btn-primary btn-sm" data-permission="101" onclick="App.Features.SanadForm.openCreate()">➕ سند جدید</button>
                    </div>
                </div>
				<!-- ⭐ Toolbar انتخاب گروهی -->
                <div id="sanadBulkToolbar" class="sanad-bulk-toolbar" style="display:none;">
                    <span class="bulk-count"><strong id="bulkCount">0</strong> سند انتخاب شده</span>
                    <div class="bulk-actions">
                        <button class="btn btn-sm btn-ghost" id="bulkExportBtn">📤 خروجی CSV</button>
                        <button class="btn btn-sm btn-primary" id="bulkChangeVazeitBtn">🔄 تغییر وضعیت</button>
                        <button class="btn btn-sm btn-danger" id="bulkDeleteBtn">🗑️ حذف گروهی</button>
                        <button class="btn btn-sm btn-ghost" id="bulkClearBtn">✕ لغو انتخاب</button>
                    </div>
                </div>

                <!-- ⭐ این بخش شرطی شد: اگر لیست خالی بود پیام بده، وگرنه جدول -->
                ${items.length === 0 ? `
                    <div class="empty" style="padding: 60px 20px; text-align: center;">
                        <div class="empty-icon" style="font-size: 40px; margin-bottom: 15px;">📭</div>
                        <p style="color: #64748B; font-size: 16px;">سندی با این فیلترها یافت نشد.</p>
                        <button class="btn btn-primary" style="margin-top: 15px;" onclick="App.Features.SanadForm.openCreate()">➕ ثبت اولین سند</button>
                    </div>
                ` : `
                    <div class="table-wrapper">
                        <table>
                          <thead>
                                <tr>
                                    <th style="width:36px;">
                                        <input type="checkbox" id="sanadSelectAll" ${allSelected ? 'checked' : ''}>
                                    </th>
                                    <th class="sortable-th" onclick="App.Features.Sanad.sortBy('noSanad')">شماره ${sortIcon('noSanad')}</th>
                                    <th class="sortable-th" onclick="App.Features.Sanad.sortBy('dateIn')">تاریخ ${sortIcon('dateIn')}</th>
                                    <th class="sortable-th" onclick="App.Features.Sanad.sortBy('sharh')">شرح ${sortIcon('sharh')}</th>
                                    <th class="sortable-th" onclick="App.Features.Sanad.sortBy('vazeit')">وضعیت ${sortIcon('vazeit')}</th>
                                    <th class="sortable-th" onclick="App.Features.Sanad.sortBy('kindSanad')">نوع ${sortIcon('kindSanad')}</th>
                                    <th style="width:80px;">ایراد</th>
                                    <th class="sortable-th text-left" onclick="App.Features.Sanad.sortBy('mabBed')">بدهکار ${sortIcon('mabBed')}</th>
                                    <th class="sortable-th text-left" onclick="App.Features.Sanad.sortBy('mabBes')">بستانکار ${sortIcon('mabBes')}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `}
                <div class="pagination">
                    <button ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Sanad.gotoPage(${page - 1})">قبلی</button>
                    <span>صفحه ${page}</span>
                    <button ${items.length < pageSize ? 'disabled' : ''} onclick="App.Features.Sanad.gotoPage(${page + 1})">بعدی</button>
                </div>`;
    }

    // ═══════════════════════════════════════════
    //  BULK SELECT
    // ═══════════════════════════════════════════
    function bindCheckboxes() {
        const container = document.getElementById('sanadListContainer');

        // ═══ انتخاب همه ═══
        document.getElementById('sanadSelectAll')?.addEventListener('change', function () {
            if (this.checked) {
                _currentItems.forEach(x => _selected.add(x.parentSanadID));
            } else {
                _currentItems.forEach(x => _selected.delete(x.parentSanadID));
            }
            container.querySelectorAll('.sanad-cb').forEach(cb => { cb.checked = this.checked; });
            container.querySelectorAll('tr[data-id]').forEach(tr => {
                tr.classList.toggle('row-selected', this.checked);
            });
            updateBulkToolbar();
        });

        // ═══ چک‌باکس هر ردیف ═══
        container.querySelectorAll('.sanad-cb').forEach(cb => {
            cb.addEventListener('change', function () {
                const id = parseInt(this.dataset.id);
                if (this.checked) _selected.add(id); else _selected.delete(id);
                this.closest('tr').classList.toggle('row-selected', this.checked);
                updateBulkToolbar();

                const all = document.getElementById('sanadSelectAll');
                if (all) {
                    all.checked = _currentItems.length > 0 &&
                        _currentItems.every(x => _selected.has(x.parentSanadID));
                }
            });
        });

        // ═══ دکمه‌های toolbar انتخاب گروهی ═══
        document.getElementById('bulkExportBtn')?.addEventListener('click', exportCsv);
        document.getElementById('bulkChangeVazeitBtn')?.addEventListener('click', openBulkChangeVazeitDialog);
        document.getElementById('bulkDeleteBtn')?.addEventListener('click', bulkDelete);

        document.getElementById('bulkClearBtn')?.addEventListener('click', () => {
            _selected.clear();
            container.querySelectorAll('.sanad-cb').forEach(cb => { cb.checked = false; });
            container.querySelectorAll('tr[data-id]').forEach(tr => tr.classList.remove('row-selected'));
            const all = document.getElementById('sanadSelectAll');
            if (all) all.checked = false;
            updateBulkToolbar();
        });

        // ═══ دکمه‌های ورود/الگو ═══
        document.getElementById('importCsvBtn')?.addEventListener('click', openImportDialog);
        document.getElementById('downloadTemplateBtn')?.addEventListener('click', downloadTemplate);
        document.getElementById('sanadClosingBtn')?.addEventListener('click', openClosingDialog);
        document.getElementById('sanadOpeningBtn')?.addEventListener('click', openOpeningDialog);
        document.getElementById('sanadMovaghatBtn')?.addEventListener('click', () => window.App.Features.SanadMovaghat.openDialog());
    }

    function updateBulkToolbar() {
        const tb = document.getElementById('sanadBulkToolbar');
        const cnt = document.getElementById('bulkCount');
        if (!tb) return;
        const n = _selected.size;
        tb.style.display = n > 0 ? 'flex' : 'none';
        if (cnt) cnt.textContent = n;
    }

    // ═══════════════════════════════════════════
    //  EXPORT CSV
    // ═══════════════════════════════════════════
    async function exportCsv() {
        if (_selected.size === 0) { window.App.toast('ابتدا سند انتخاب کنید', 'warn'); return; }

        try {
            const headers = { 'Content-Type': 'application/json' };

            const apiKey = window.App.state.apiKey
                || localStorage.getItem('ariana_api_key')
                || (window.App.config && window.App.config.apiKey);
            if (apiKey) headers['X-Api-Key'] = apiKey;

            const token = window.App.state.token
                || localStorage.getItem('ariana_token')
                || localStorage.getItem('token');
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const response = await fetch('/api/sanad/export-csv', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ sanadIds: [..._selected] })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'خطای ناشناخته' }));
                throw new Error(err.error || response.statusText);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Sanad_Export_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            window.App.toast(`✅ ${_selected.size} سند خروجی گرفته شد`, 'success');
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا در خروجی CSV', {
                title: 'خطا در خروجی'
            });
        }
    }

    // ═══════════════════════════════════════════
    //  DOWNLOAD TEMPLATE
    // ═══════════════════════════════════════════
    function downloadTemplate() {
        const header = 'sep=;\nشماره سند;تاريخ سند;شرح سند;شرح رديف;بدهکار;بستانکار;رديف;کد کل;کد معين;کد تفصيلي;کد تفصيلي2;شناسه تفضيلي2;مقدار\n';

        const sample = '1001;1404/01/01;نمونه شرح سند;شرح ردیف 1;="1000000";="0";1;1101;1;0;0;0;="0"\n' +
            '1001;1404/01/01;نمونه شرح سند;شرح ردیف 2;="0";="1000000";2;1102;1;0;0;0;="0"\n';

        const blob = new Blob(['\uFEFF' + header + sample], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Sanad_Template.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // ═══════════════════════════════════════════
    //  IMPORT CSV
    // ═══════════════════════════════════════════
    function openImportDialog() {
        const body = `
            <div class="import-dialog">
                <div class="import-info">
                    📥 فایل CSV اسناد را انتخاب کنید. ابتدا اعتبارسنجی انجام می‌شود و پیش‌نمایش نشان داده خواهد شد.
                </div>
                <div class="form-group">
                    <label>فایل CSV <span class="req">*</span></label>
                    <input type="file" id="importFileInput" accept=".csv,text/csv" class="form-control">
                </div>
                <div class="form-group">
                    <label class="cb-line">
                        <input type="checkbox" id="importForceNew">
                        همه اسناد با شماره جدید ثبت شوند (حتی اگر شماره در CSV باشد)
                    </label>
                </div>
                <div class="import-warning">
                    ⚠️ این عملیات فقط سند جدید اضافه می‌کند و به اسناد موجود دست نمی‌زند.
                    در صورت هر خطایی، کل عملیات لغو می‌شود.
                </div>
                <div id="importStatus" class="import-status" style="display:none;"></div>
                <div class="copy-footer">
                    <button class="btn btn-primary" id="importValidateBtn">🔍 بررسی فایل</button>
                    <button class="btn btn-ghost" onclick="App.closeModal()">انصراف</button>
                </div>
            </div>`;

        window.App.openModal('📥 ورود اسناد از فایل CSV', body);

        document.getElementById('importValidateBtn')?.addEventListener('click', doImportValidate);
    }

    async function doImportValidate() {
        const fileInput = document.getElementById('importFileInput');
        const status = document.getElementById('importStatus');
        const btn = document.getElementById('importValidateBtn');
        const forceNew = document.getElementById('importForceNew').checked;

        if (!fileInput.files || !fileInput.files[0]) {
            await window.App.alert.warning('ابتدا فایل را انتخاب کنید', {
                title: 'فایلی انتخاب نشده'
            });
            return;
        }

        const file = fileInput.files[0];

        try {
            btn.disabled = true; btn.textContent = '⏳ در حال بررسی...';
            status.style.display = 'block';
            status.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

            const buffer = await file.arrayBuffer();
            let content = '';
            try {
                content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            } catch (e) {
                content = new TextDecoder('windows-1256').decode(buffer);
            }

            const preview = await window.App.Http.api('/api/sanad/import-preview', {
                method: 'POST',
                body: JSON.stringify({
                    csvContent: content,
                    forceNewNumbers: forceNew
                })
            });

            if (!preview.isValid) {
                renderPreviewErrors(status, preview);
                btn.disabled = false; btn.textContent = '🔍 بررسی مجدد';
                return;
            }

            renderPreviewSuccess(status, preview, content, forceNew);
            btn.disabled = false; btn.textContent = '🔍 بررسی مجدد';

        } catch (err) {
            status.innerHTML = `<div class="import-error-box">❌ ${H.esc(err.message)}</div>`;
            btn.disabled = false; btn.textContent = '🔍 بررسی فایل';
        }
    }

    function renderPreviewErrors(container, preview) {
        const errors = (preview.errors || []).slice(0, 20);
        container.innerHTML = `
            <div class="import-error-box">
                <div class="import-error-title">❌ ${preview.errors.length} خطا یافت شد</div>
                <ul class="import-error-list">
                    ${errors.map(e => `<li>خط ${e.lineNumber}: ${H.esc(e.message)}</li>`).join('')}
                </ul>
                ${preview.errors.length > 20 ? '<div class="import-error-more">... و موارد بیشتر</div>' : ''}
            </div>`;
    }

    async function renderPreviewSuccess(container, preview, csvContent, forceNew) {
        const warnings = (preview.warnings || []).slice(0, 10);

        container.innerHTML = `
            <div class="import-success-box">
                <div class="import-success-title">✅ فایل معتبر است</div>
                <div class="import-stats">
                    <div class="import-stat">
                        <div class="import-stat-label">تعداد اسناد</div>
                        <div class="import-stat-value">${H.fmt(preview.sanadCount)}</div>
                    </div>
                    <div class="import-stat">
                        <div class="import-stat-label">تعداد ردیف‌ها</div>
                        <div class="import-stat-value">${H.fmt(preview.itemCount)}</div>
                    </div>
                    <div class="import-stat">
                        <div class="import-stat-label">جمع بدهکار</div>
                        <div class="import-stat-value">${H.fmt(preview.totalBed)}</div>
                    </div>
                    <div class="import-stat">
                        <div class="import-stat-label">جمع بستانکار</div>
                        <div class="import-stat-value">${H.fmt(preview.totalBes)}</div>
                    </div>
                </div>
                ${warnings.length > 0 ? `
                    <div class="import-warn-title">⚠️ هشدارها:</div>
                    <ul class="import-warn-list">
                        ${warnings.map(w => `<li>خط ${w.lineNumber}: ${H.esc(w.message)}</li>`).join('')}
                    </ul>
                ` : ''}
                <div class="import-preview-table-wrap">
                    <table class="import-preview-table">
                        <thead>
                            <tr>
                                <th>شماره اصلی</th>
                                <th>شماره جدید</th>
                                <th>تاریخ</th>
                                <th>شرح</th>
                                <th>ردیف</th>
                                <th>بدهکار</th>
                                <th>بستانکار</th>
                                <th>تراز</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${preview.preview.slice(0, 50).map(p => `
                                <tr>
                                    <td>${H.fmt(p.sourceNoSanad)}</td>
                                    <td><strong>${H.fmt(p.newNoSanad)}</strong></td>
                                    <td>${H.esc(p.dateIn || '-')}</td>
                                    <td>${H.esc((p.sharh || '').substring(0, 40))}</td>
                                    <td>${H.fmt(p.itemCount)}</td>
                                    <td class="num">${H.fmt(p.totalBed)}</td>
                                    <td class="num">${H.fmt(p.totalBes)}</td>
                                    <td class="text-center">${p.isBalanced ? '✅' : '⚠️'}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                    ${preview.preview.length > 50 ? `<div class="import-more">... و ${preview.preview.length - 50} سند دیگر</div>` : ''}
                </div>
                <button class="btn btn-primary" id="importCommitBtn" style="margin-top:14px;">✅ ثبت نهایی</button>
            </div>`;

        document.getElementById('importCommitBtn')?.addEventListener('click', async (e) => {

            const ok = await window.App.confirm(
                `آیا از ثبت ${preview.sanadCount} سند (${preview.itemCount} ردیف) مطمئن هستید؟`,
                {
                    title: 'ثبت نهایی',
                    type: 'warning',
                    okText: 'بله، ثبت کن',
                    cancelText: 'لغو'
                }
            );
            if (!ok) return;

            e.target.disabled = true;
            e.target.textContent = '⏳ در حال ثبت...';

            try {
                const result = await window.App.Http.api('/api/sanad/import-commit', {
                    method: 'POST',
                    body: JSON.stringify({
                        csvContent: csvContent,
                        forceNewNumbers: forceNew
                    })
                });

                await window.App.alert.success(
                    `✅ ${result.createdSanads} سند با ${result.createdItems} ردیف ثبت شد`,
                    { title: 'انجام شد' });
                window.App.closeModal();
                loadList();
            } catch (err) {
                window.App.toast('خطا: ' + err.message, 'خطا');
                e.target.disabled = false;
                e.target.textContent = '✅ ثبت نهایی';
            }
        });
    }

    //══════════════════
    //  BULK DELETE
    // ═══════════════════════════════════════════
    async function bulkDelete() {
        if (_selected.size === 0) return;

        if (window.App.Permissions && !window.App.Permissions.can(108)) {
            await window.App.alert.warning('شما برای این عمل سطح دسترسی لازم را ندارید', {
                title: 'عدم دسترسی'
            });
            return;
        }

        const lockedItems = _currentItems.filter(x =>
            _selected.has(x.parentSanadID) && x.vazeit !== 0
        );

        if (lockedItems.length > 0) {
            const draftCount = _selected.size - lockedItems.length;
            await window.App.alert.warning(
                `از ${_selected.size} سند انتخاب‌شده، ${lockedItems.length} سند در وضعیت ` +
                `«رسیدگی» یا «قطعی» قرار دارند و قابل حذف نیستند.\n\n` +
                (draftCount > 0
                    ? `فقط ${draftCount} سند پیش‌نویس قابل حذف هست.`
                    : `هیچ سند پیش‌نویسی در انتخاب شما نیست.`),
                { title: '🔒 برخی اسناد قفل شده‌اند' }
            );
            return;
        }

        const ok = await window.App.confirm(
            `آیا از حذف ${_selected.size} سند مطمئن هستید؟\n\n` +
            `⚠️ توجه: سند قطعی قابل حذف نیست.`,
            {
                title: '🗑️ حذف گروهی',
                danger: true,
                okText: `حذف ${_selected.size} سند`,
                cancelText: 'لغو'
            }
        );
        if (!ok) return;


        try {
            const result = await window.App.Http.api('/api/sanad/bulk-delete', {
                method: 'POST',
                body: JSON.stringify({ sanadIds: [..._selected] })
            });
            window.App.toast(`✅ ${result.deleted} سند حذف شد`, 'success', { title: 'عملیات موفق' });
            _selected.clear();
            loadList();
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا در حذف گروهی', {
                title: 'خطای حذف'
            });
        }
    }


    // ═══════════════════════════════════════════
    //  BULK CHANGE VAZEIT — تغییر وضعیت گروهی
    // ═══════════════════════════════════════════
    async function openBulkChangeVazeitDialog() {
        if (_selected.size === 0) return;

        const selectedItems = _currentItems.filter(x => _selected.has(x.parentSanadID));
        const vazeitCounts = { 0: 0, 1: 0, 2: 0 };
        selectedItems.forEach(x => {
            if (vazeitCounts[x.vazeit] !== undefined) vazeitCounts[x.vazeit]++;
        });

        const P = window.App.Permissions;
        const perms = {
            can_102: P ? P.can(102) : true,
            can_103: P ? P.can(103) : true,
            can_104: P ? P.can(104) : true,
            can_105: P ? P.can(105) : true
        };

        const canChangeFrom0 = perms.can_102;
        const canChangeFrom1 = perms.can_104 || perms.can_105;
        const canChangeFrom2 = perms.can_103;

        const body = `
            <div class="bulk-vazeit-dialog">
                <div class="bvd-info">
                    <span class="bvd-count">${_selected.size} سند</span> انتخاب شده — 
                    <span class="bvd-breakdown">
                        ${vazeitCounts[0] > 0 ? `📝 ${vazeitCounts[0]} پیش‌نویس` : ''}
                        ${vazeitCounts[1] > 0 ? ` • ⏳ ${vazeitCounts[1]} رسیدگی` : ''}
                        ${vazeitCounts[2] > 0 ? ` • ✅ ${vazeitCounts[2]} قطعی` : ''}
                    </span>
                </div>

                <div class="bvd-targets">
                    <label class="bvd-radio ${!canChangeFrom0 && !canChangeFrom1 && !canChangeFrom2 ? 'disabled' : ''}">
                        <input type="radio" name="bvdTarget" value="0">
                        <div class="bvd-radio-content">
                            <div class="bvd-radio-title">📝 پیش‌نویس</div>
                            <div class="bvd-radio-desc">
                                ${vazeitCounts[1] > 0 && !canChangeFrom1 ? `<span class="bvd-lock">🔒 رسیدگی نیاز به ۱۰۴</span><br>` : ''}
                                ${vazeitCounts[2] > 0 && !canChangeFrom2 ? `<span class="bvd-lock">🔒 قطعی نیاز به ۱۰۳</span><br>` : ''}
                                برگشت به حالت آزاد (قابل ویرایش)
                            </div>
                        </div>
                    </label>

                    <label class="bvd-radio ${!canChangeFrom0 && !canChangeFrom2 ? 'disabled' : ''}">
                        <input type="radio" name="bvdTarget" value="1">
                        <div class="bvd-radio-content">
                            <div class="bvd-radio-title">⏳ رسیدگی</div>
                            <div class="bvd-radio-desc">
                                ${vazeitCounts[0] > 0 && !canChangeFrom0 ? `<span class="bvd-lock">🔒 پیش‌نویس نیاز به ۱۰۲</span><br>` : ''}
                                ${vazeitCounts[2] > 0 && !canChangeFrom2 ? `<span class="bvd-lock">🔒 قطعی نیاز به ۱۰۳</span><br>` : ''}
                                تأیید موقت (بدون تأیید نهایی)
                            </div>
                        </div>
                    </label>

                    <label class="bvd-radio ${!canChangeFrom0 && !canChangeFrom1 ? 'disabled' : ''}">
                        <input type="radio" name="bvdTarget" value="2">
                        <div class="bvd-radio-content">
                            <div class="bvd-radio-title">✅ قطعی</div>
                            <div class="bvd-radio-desc">
                                ${vazeitCounts[0] > 0 && !canChangeFrom0 ? `<span class="bvd-lock">🔒 پیش‌نویس نیاز به ۱۰۲</span><br>` : ''}
                                ${vazeitCounts[1] > 0 && !canChangeFrom1 ? `<span class="bvd-lock">🔒 رسیدگی نیاز به ۱۰۴</span><br>` : ''}
                                تأیید نهایی — نیاز به تراز بودن سند
                            </div>
                        </div>
                    </label>
                </div>

                <div class="bvd-warning">
                    ⚠️ اسناد نامعتبر (ناتراز یا کدینگ ناقص) رد می‌شوند و تغییر وضعیت آن‌ها انجام نمی‌شود.
                </div>

                <div class="copy-footer">
                    <button class="btn btn-primary" id="bvdConfirmBtn">🔄 اعمال تغییر</button>
                    <button class="btn btn-ghost" onclick="App.closeModal()">انصراف</button>
                </div>
            </div>`;

        window.App.openModal('🔄 تغییر وضعیت گروهی', body);

        const modalBody = document.getElementById('modalBody');
        modalBody.querySelectorAll('.bvd-radio').forEach(radio => {
            const input = radio.querySelector('input');
            const targetV = parseInt(input.value);

            let canChange = true;
            if (vazeitCounts[0] > 0 && !canChangeFrom0 && targetV !== 0) canChange = false;
            if (vazeitCounts[1] > 0 && !canChangeFrom1 && targetV !== 1) canChange = false;
            if (vazeitCounts[2] > 0 && !canChangeFrom2 && targetV !== 2) canChange = false;

            if (!canChange) {
                input.disabled = true;
                radio.classList.add('disabled');
            }
        });

        modalBody.querySelector('#bvdConfirmBtn')?.addEventListener('click', doBulkChangeVazeit);
    }

    async function doBulkChangeVazeit() {
        const selected = document.querySelector('input[name="bvdTarget"]:checked');
        if (!selected) {
            await window.App.alert.warning('وضعیت مقصد را انتخاب کنید');
            return;
        }

        const targetVazeit = parseInt(selected.value);
        const targetLabels = { 0: 'پیش‌نویس', 1: 'رسیدگی', 2: 'قطعی' };

        const ok = await window.App.confirm(
            `آیا از تغییر وضعیت ${_selected.size} سند به «${targetLabels[targetVazeit]}» مطمئن هستید؟`,
            {
                title: '🔄 تغییر وضعیت گروهی',
                type: targetVazeit === 2 ? 'warning' : 'question',
                okText: 'بله، اعمال کن'
            }
        );
        if (!ok) return;

        const btn = document.getElementById('bvdConfirmBtn');
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ در حال اعمال...';

        try {
            const result = await window.App.Http.api('/api/sanad/bulk-change-vazeit', {
                method: 'POST',
                body: JSON.stringify({
                    sanadIds: [..._selected],
                    targetVazeit: targetVazeit
                })
            });

            let msg = `✅ ${result.updatedCount} سند با موفقیت تغییر یافت.`;
            if (result.skippedCount > 0) {
                msg += `\n\n⚠️ ${result.skippedCount} سند رد شد:`;
                if (result.errors && result.errors.length > 0) {
                    msg += '\n' + result.errors.slice(0, 5).join('\n');
                    if (result.errors.length > 5) {
                        msg += `\n... و ${result.errors.length - 5} مورد دیگر`;
                    }
                }
            }

            if (result.updatedCount > 0) {
                window.App.toast(`✅ ${result.updatedCount} سند تغییر یافت`, 'success');
            }
            if (result.skippedCount > 0 && result.errors.length > 0) {
                await window.App.alert.warning(msg, { title: 'نتیجه‌ی تغییر وضعیت' });
            }

            window.App.closeModal();
            _selected.clear();
            loadList();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = orig;
            await window.App.alert.error(err.message || 'خطا در تغییر وضعیت', {
                title: 'خطا'
            });
        }
    }

    // ═══════════════════════════════════════════
    //  KEYBOARD SHORTCUTS
    // ═══════════════════════════════════════════
    let _listKeyHandler = null;
    function bindListShortcuts() {
        if (_listKeyHandler) document.removeEventListener('keydown', _listKeyHandler);
        _listKeyHandler = function (e) {
            if (document.querySelector('.modal-overlay, .modal-box')) return;

            if (e.key === 'F9') { e.preventDefault(); gotoPage(1); }
            else if (e.key === 'F12') { e.preventDefault(); gotoPage(window.App.state.sanadPage + 1); }
            else if (e.key === 'F10') { e.preventDefault(); gotoPage(Math.max(1, window.App.state.sanadPage - 1)); }
            else if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault(); window.App.Features.SanadForm.openCreate();
            }
            else if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault(); loadList();
            }
        };
        document.addEventListener('keydown', _listKeyHandler);
    }

    function gotoPage(page) {
        if (page < 1) return;
        window.App.state.sanadPage = page;
        _selected.clear();
        loadList();
    }

    // ═══════════════════════════════════════════
    //  SHOW DETAIL
    // ═══════════════════════════════════════════
    async function showDetail(sanadId, options = {}) {
        if (!sanadId) return;

        const isFromExternal = options.fromExternal === true
            || window.App.state.currentPage !== 'sanad';

        window.App.openModal('جزئیات سند',
            `<div class="loading"><div class="spinner"></div></div>`);

        // ⭐ ست کردن هایلایت
        _detailFilter.errorType = 'all';
        _detailFilter.highlightRowId = options.highlightRowId || null;

        try {
            const [detail, items] = await Promise.all([
                window.App.Http.api(`/api/sanad/${sanadId}`),
                window.App.Http.api(`/api/sanad/${sanadId}/items`)
            ]);
            _detailData = { detail, items: items || [] };
            document.getElementById('modalBody').innerHTML =
                buildDetailHtml(detail, items, { isFromExternal });
            bindDetailFilter({ isFromExternal });
            Exporter.attach(document.getElementById('modalBody'), {
                title: 'سند حسابداری - شماره ' + (detail?.noSanad || ''),
                subtitle: subtitle(),
                filename: 'Sanad_' + (detail?.noSanad || 'detail'),
                customHtml: () => buildDetailPrintHtml(detail, items)
            });

            // ⭐ اسکرول خودکار به ردیف هایلایت شده
            if (_detailFilter.highlightRowId) {
                setTimeout(() => {
                    const row = document.querySelector('.sd-row-highlight');
                    if (row) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 150);
            }

        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
    }

    function buildDetailHtml(detail, items, opts = {}) {
        items = items || [];
        const errorCounts = {
            all: 0, missingCoding: 0, missingMoein: 0,
            noMeghdar: 0, noAmount: 0, noDescr: 0
        };

        const itemsWithErrors = items.map(it => {
            const errs = detectRowErrors(it);
            errs.forEach(e => { if (errorCounts[e.code] !== undefined) errorCounts[e.code]++; });
            if (errs.length > 0) errorCounts.all++;
            return Object.assign({}, it, { _errors: errs });
        });

        const f = _detailFilter.errorType;
        const visibleItems = (f === 'all')
            ? itemsWithErrors
            : itemsWithErrors.filter(x => x._errors.some(e => e.code === f));

        const canEdit = !window.App.Permissions || window.App.Permissions.can(102);
        const isConfirmed = (detail?.vazeit || 0) === 2;
        const showEditBtn = opts.isFromExternal && canEdit && !isConfirmed;

        const editHeader = showEditBtn ? `
            <div class="sd-edit-header">
                <div class="sd-edit-hint">
                    📄 این سند از یک گزارش باز شده — حالت نمایش
                </div>
                <button class="btn btn-primary btn-sm" id="sdEditBtn">
                    ✏️ ویرایش سند
                </button>
            </div>` : '';

        const infoGrid = `
            <div class="sd-info-grid">
                <div class="sd-info-card">
                    <div class="sd-info-label">شماره سند</div>
                    <div class="sd-info-value">${H.fmt(detail?.noSanad) || '-'}</div>
                </div>
                <div class="sd-info-card">
                    <div class="sd-info-label">تاریخ</div>
                    <div class="sd-info-value">${H.esc(detail?.dateIn || '-')}</div>
                </div>
                <div class="sd-info-card">
                    <div class="sd-info-label">وضعیت</div>
                    <div class="sd-info-value">${window.App.statusBadge(detail?.vazeit)}</div>
                </div>
                <div class="sd-info-card">
                    <div class="sd-info-label">نوع سند</div>
                    <div class="sd-info-value" style="font-size:15px;">
                        ${kindSanadText(detail?.kindSanad ?? 0)}
                    </div>
                </div>
                <div class="sd-info-card sd-info-wide">
                    <div class="sd-info-label">شرح سند</div>
                    <div class="sd-info-value" style="font-size:13px; font-weight:500;">
                        ${H.esc(detail?.otherParentSharh || '-')}
                    </div>
                </div>
            </div>`;
        const emptyWarning = (items.length === 0) ? `
            <div style="background:#FEF2F2; border:1px solid #FECACA; color:#991B1B; padding:12px; border-radius:8px; margin-bottom:16px; font-weight:600; text-align:center;">
                ⛔ این سند هیچ ردیفی ندارد و فاقد اعتبار است. لطفاً آن را ویرایش کرده و ردیف اضافه کنید.
            </div>
        ` : '';

        const toolbar = `
            <div class="sd-toolbar">
                <select class="sd-error-filter" id="sanadErrFilter">
                    <option value="all" ${f === 'all' ? 'selected' : ''}>📋 همه ردیف‌ها (${H.fmt(itemsWithErrors.length)})</option>
                    <option value="missingCoding" ${f === 'missingCoding' ? 'selected' : ''}>⛔ کدینگ ناقص (${H.fmt(errorCounts.missingCoding)})</option>
                    <option value="missingMoein" ${f === 'missingMoein' ? 'selected' : ''}>⚠️ بدون معین (${H.fmt(errorCounts.missingMoein)})</option>
                    <option value="noMeghdar" ${f === 'noMeghdar' ? 'selected' : ''}>⛔ مقدار خالی (${H.fmt(errorCounts.noMeghdar)})</option>
                    <option value="noAmount" ${f === 'noAmount' ? 'selected' : ''}>⚠️ مبلغ صفر (${H.fmt(errorCounts.noAmount)})</option>
                    <option value="noDescr" ${f === 'noDescr' ? 'selected' : ''}>ℹ️ بدون شرح (${H.fmt(errorCounts.noDescr)})</option>
                </select>
                ${errorCounts.all > 0
                ? `<span class="sd-badge sd-badge-err">⚠️ ${H.fmt(errorCounts.all)} ردیف دارای ایراد</span>`
                : `<span class="sd-badge sd-badge-ok">✅ همه ردیف‌ها سالم</span>`}
                <div class="sd-legend">
                    <span><span class="sd-err-icon sd-err-error">⛔</span> جدی</span>
                    <span><span class="sd-err-icon sd-err-warn">⚠️</span> هشدار</span>
                    <span><span class="sd-err-icon sd-err-info">ℹ️</span> اطلاع</span>
                </div>
            </div>`;

        const rows = visibleItems.map(it => {
            const errBadges = (it._errors || []).map(e =>
                `<span class="sd-err-icon sd-err-${e.severity}" title="${H.esc(e.label)}">
                    ${e.severity === 'error' ? '⛔' : (e.severity === 'warn' ? '⚠️' : 'ℹ️')}
                </span>`).join('');
            const hasError = (it._errors || []).some(e => e.severity === 'error');
            const hasWarn = (it._errors || []).some(e => e.severity === 'warn');

            // ⭐ تشخیص ردیف هایلایت شده
            // ⭐ تشخیص ردیف هایلایت شده (با تبدیل به رشته برای جلوگیری از خطا)
            const rowIdStr = String(it.sanadID || it.sanadId || '');
            const targetIdStr = String(_detailFilter.highlightRowId || '');
            const isHighlighted = rowIdStr !== '' && targetIdStr !== '' && rowIdStr === targetIdStr;

            let rowClass = hasError ? 'sd-row-err' : (hasWarn ? 'sd-row-warn' : '');
            if (isHighlighted) rowClass += ' sd-row-highlight'; 

            return `
                <tr class="${rowClass}">
                    <td class="sd-col-idx">
                        ${H.fmt(it.rowNum)}
                        ${errBadges ? `<div style="margin-top:3px;">${errBadges}</div>` : ''}
                    </td>
                    <td class="num">${it.code_Col ?? '-'}</td>
                    <td class="sd-col-name">${H.esc(it.colName || '-')}</td>
                    <td class="num">${it.code_Moein || '-'}</td>
                    <td class="sd-col-name">${H.esc(it.moeinName || '-')}</td>
                    <td class="num">${it.code_Tafzil || '-'}</td>
                    <td class="sd-col-name">${H.esc(it.tafzilName || '-')}</td>
                    <td class="sd-col-sharh">${H.esc(it.otherSharh || '-')}</td>
                    <td class="num">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num">${it.meghdar ? H.fmtSigned(it.meghdar) : '-'}</td>
                </tr>`;
        }).join('');

        const totalBed = visibleItems.reduce((s, x) => s + (Number(x.mabBed) || 0), 0);
        const totalBes = visibleItems.reduce((s, x) => s + (Number(x.mabBes) || 0), 0);
        const totalMegh = visibleItems.reduce((s, x) => s + (Number(x.meghdar) || 0), 0);

        const tableBlock = `
            <div class="sd-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th class="sd-col-idx">#</th>
                            <th class="num">کد کل</th>
                            <th class="sd-col-name">نام کل</th>
                            <th class="num">کد معین</th>
                            <th class="sd-col-name">نام معین</th>
                            <th class="num">کد تفصیلی</th>
                            <th class="sd-col-name">نام تفصیلی</th>
                            <th class="sd-col-sharh">شرح</th>
                            <th class="num">بدهکار</th>
                            <th class="num">بستانکار</th>
                            <th class="num">مقدار</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="11" style="text-align:center; padding:40px; color:#9CA3AF;">ردیفی برای نمایش نیست</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="8" style="text-align:right; padding-right:16px;">
                                جمع کل (${H.fmt(visibleItems.length)} ردیف)
                            </td>
                            <td class="num">${H.fmt(totalBed)}</td>
                            <td class="num">${H.fmt(totalBes)}</td>
                            <td class="num">${H.fmtSigned(totalMegh)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;

        return `<div class="sanad-detail-modal">
                ${editHeader}
                ${emptyWarning}
                ${infoGrid}
                ${toolbar}
                ${tableBlock}
            </div>`;
    }

    function detectRowErrors(it) {
        const errors = [];
        const hasBed = (it.mabBed || 0) > 0;
        const hasBes = (it.mabBes || 0) > 0;
        const hasAmount = hasBed || hasBes;

        if (!it.code_Col || it.code_Col === 0)
            errors.push({ code: 'missingCoding', label: 'کد کل ندارد', severity: 'error' });
        if (it.code_Col > 0 && (!it.code_Moein || it.code_Moein === 0) && hasAmount)
            errors.push({ code: 'missingMoein', label: 'کد معین ندارد', severity: 'warn' });
        if (it.isStock && hasAmount && (!it.meghdar || Math.abs(it.meghdar) === 0))
            errors.push({ code: 'noMeghdar', label: 'مقدار انباری ندارد', severity: 'error' });
        if (!hasAmount)
            errors.push({ code: 'noAmount', label: 'مبلغ صفر است', severity: 'warn' });
        if (!it.otherSharh || !String(it.otherSharh).trim())
            errors.push({ code: 'noDescr', label: 'شرح خالی است', severity: 'info' });

        return errors;
    }

    function bindDetailFilter(opts = {}) {
        const sel = document.getElementById('sanadErrFilter');
        if (sel) {
            sel.addEventListener('change', function () {
                _detailFilter.errorType = this.value;
                const { detail, items } = _detailData;
                document.getElementById('modalBody').innerHTML =
                    buildDetailHtml(detail, items, opts);
                bindDetailFilter(opts);
            });
        }

        // در فایل sanad.js، تابع bindDetailFilter را پیدا کنید و فقط بخش دکمه ویرایش را آپدیت کنید:

        document.getElementById('sdEditBtn')?.addEventListener('click', () => {
            const id = _detailData.detail?.parentSanadID;
            if (!id) return;

            // ⭐ شناسه ردیف را قبل از بستن مودال ذخیره می‌کنیم
            const highlightId = _detailFilter.highlightRowId;

            window.App.closeModal();
            setTimeout(() => {
                // ⭐ شناسه ردیف را به فرم ویرایش پاس می‌دهیم
                window.App.Features.SanadForm.openEdit(id, { highlightRowId: highlightId });
            }, 100);
        });
    }

    function buildDetailPrintHtml(detail, items) {
        const headerBlock = `
            <table class="factor-info-table">
                <tr>
                    <td class="label">شماره سند:</td>
                    <td>${detail?.noSanad || '-'}</td>
                    <td class="label">تاریخ سند:</td>
                    <td>${H.esc(detail?.dateIn || '-')}</td>
                    <td class="label">وضعیت:</td>
                    <td>${statusText(detail?.vazeit)}</td>
                    <td class="label">نوع سند:</td>
                    <td>${kindSanadText(detail?.kindSanad ?? 0)}</td>
                </tr>
                <tr>
                    <td class="label">شرح سند:</td>
                    <td colspan="7">${H.esc(detail?.otherParentSharh || '-')}</td>
                </tr>
            </table>`;

        const itemsRows = (items || []).map((it, idx) => `
            <tr>
                <td class="num text-center">${idx + 1}</td>
                <td class="num text-center">${it.code_Col ?? '-'}</td>
                <td>${H.esc(it.colName || '')}</td>
                <td class="num text-center">${it.code_Moein || '-'}</td>
                <td>${H.esc(it.moeinName || '')}</td>
                <td class="num text-center">${it.code_Tafzil || '-'}</td>
                <td>${H.esc(it.tafzilName || '')}</td>
                <td>${H.esc(it.otherSharh || '')}</td>
                <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                <td class="num text-left">${H.fmtSigned(it.meghdar)}</td>
            </tr>
        `).join('');

        const totalBed = (items || []).reduce((s, x) => s + (x.mabBed || 0), 0);
        const totalBes = (items || []).reduce((s, x) => s + (x.mabBes || 0), 0);
        const totalMegh = (items || []).reduce((s, x) => s + (x.meghdar || 0), 0);

        return headerBlock + `
            <div class="section-title">📋 ردیف‌های سند (${(items || []).length})</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:30px;">#</th>
                        <th style="width:50px;">کد کل</th>
                        <th>نام کل</th>
                        <th style="width:50px;">معین</th>
                        <th>نام معین</th>
                        <th style="width:60px;">تفصیلی</th>
                        <th>نام تفصیلی</th>
                        <th>شرح</th>
                        <th class="text-left" style="width:110px;">بدهکار</th>
                        <th class="text-left" style="width:110px;">بستانکار</th>
                        <th class="text-left" style="width:80px;">مقدار</th>
                    </tr>
                </thead>
                <tbody>${itemsRows}</tbody>
                <tfoot>
                    <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="8" class="text-center">جمع کل</td>
                        <td class="num text-left">${H.fmt(totalBed)}</td>
                        <td class="num text-left">${H.fmt(totalBes)}</td>
                        <td class="num text-left">${H.fmtSigned(totalMegh)}</td>
                    </tr>
                </tfoot>
            </table>`;
    }

    function statusText(v) {
        const map = { 0: 'پیش‌نویس', 1: 'ثبت شده', 2: 'تأیید شده', 3: 'برگشتی' };
        return map[v] ?? '-';
    }

    function kindSanadText(v) {
        const map = {
            0: 'عادی', 1: 'افتتاحیه', 2: 'اختتامیه', 3: 'انبار',
            4: 'حقوق', 5: 'اموال', 6: 'فروش', 7: 'انتقالی', 8: 'خاص'
        };
        return map[v] ?? '-';
    }

    function renderErrorBadge(s) {
        if (s.itemCount === 0) {
            return '<span class="sanad-list-err" title="این سند هیچ ردیفی ندارد (خالی است)">⛔ خالی</span>';
        }

        const total = s.totalErrorCount || 0;
        if (total === 0) return '<span class="sanad-list-ok" title="بدون ایراد">✅</span>';
        const coding = s.codingErrorCount || 0;
        const moein = s.moeinErrorCount || 0;
        const parts = [];
        if (coding > 0) parts.push(coding + ' کدینگ ناقص');
        if (moein > 0) parts.push(moein + ' بدون معین');
        const title = 'ایرادها: ' + parts.join('، ');
        return `<span class="sanad-list-err" title="${H.esc(title)}">⚠️ ${H.fmt(total)}</span>`;
    }
    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  ACCOUNT FILTER — Picker
    // ═══════════════════════════════════════════
    let _hesabCache = null;

    async function loadHesabTree() {
        if (_hesabCache) return _hesabCache;
        const tree = await window.App.Http.api('/api/hesab/tree');
        _hesabCache = tree || [];
        return _hesabCache;
    }

    async function openAccountPicker() {
        let tree;
        try {
            tree = await loadHesabTree();
        } catch (err) {
            window.App.toast('خطا در بارگذاری حساب‌ها: ' + err.message, 'error');
            return;
        }

        const cols = tree.filter(x => x.level === 'col').sort((a, b) => a.codeCol - b.codeCol);
        const moeins = tree.filter(x => x.level === 'moein');

        const body = `
            <div class="acc-picker">
                <div class="acc-picker-search">
                    <input type="text" id="accSearchInput" placeholder="🔍 جستجوی کد یا نام حساب..." autofocus>
                </div>
                <div class="acc-picker-list" id="accPickerList"></div>
            </div>`;

        window.App.openModal('🏦 انتخاب حساب', body);

        const input = document.getElementById('accSearchInput');
        const list = document.getElementById('accPickerList');

        function render(filter = '') {
            const f = filter.trim().toLowerCase();
            let html = '';

            const filteredCols = !f ? cols : cols.filter(c =>
                String(c.codeCol).includes(f) ||
                (c.name || '').toLowerCase().includes(f));

            const filteredMoeins = !f ? moeins.slice(0, 200) : moeins.filter(m =>
                String(m.codeMoein).includes(f) ||
                (m.name || '').toLowerCase().includes(f) ||
                String(m.codeCol).includes(f)).slice(0, 200);

            if (filteredCols.length > 0) {
                html += `<div class="acc-group-title">🔷 حساب‌های کل</div>`;
                html += filteredCols.map(c => `
                    <div class="acc-item acc-col" data-col="${c.codeCol}" data-moein="0">
                        <span class="acc-code">${c.codeCol}</span>
                        <span class="acc-name">${H.esc(c.name || '')}</span>
                    </div>`).join('');
            }

            if (filteredMoeins.length > 0) {
                html += `<div class="acc-group-title">🔶 حساب‌های معین</div>`;
                html += filteredMoeins.map(m => `
                    <div class="acc-item acc-moein" data-col="${m.codeCol}" data-moein="${m.codeMoein}">
                        <span class="acc-code">${m.codeCol} / ${m.codeMoein}</span>
                        <span class="acc-name">${H.esc(m.name || '')}</span>
                        ${m.hasTafzili ? '<span class="acc-badge">تفصیلی</span>' : ''}
                    </div>`).join('');
            }

            if (!html) html = '<div class="acc-empty">موردی یافت نشد</div>';
            list.innerHTML = html;
        }

        render();
        input.addEventListener('input', () => render(input.value));

        list.addEventListener('click', async (e) => {
            const item = e.target.closest('.acc-item');
            if (!item) return;

            const codeCol = parseInt(item.dataset.col);
            const codeMoein = parseInt(item.dataset.moein);

            if (codeMoein > 0) {
                const moeinObj = moeins.find(x => x.codeCol === codeCol && x.codeMoein === codeMoein);
                if (moeinObj && moeinObj.hasTafzili) {
                    const t = await askTafzil(codeCol, codeMoein);
                    if (t === null) return;
                    applyAccountFilter(codeCol, codeMoein, t);
                    return;
                }
            }

            applyAccountFilter(codeCol, codeMoein, 0);
        });
    }

    async function askTafzil(codeCol, codeMoein) {
        return new Promise((resolve) => {
            const body = `
                <div class="acc-picker">
                    <div style="padding:10px;font-size:13px;color:#374151;">
                        آیا تفصیلی خاصی مد نظر است؟ (کد تفصیلی را وارد کنید یا خالی بگذارید)
                    </div>
                    <div style="padding:10px;">
                        <input type="number" id="tafzilInput" placeholder="کد تفصیلی (خالی = همه)"
                               style="width:100%;padding:8px;border:1px solid #D1D5DB;border-radius:6px;font-family:inherit;"
                               autofocus>
                    </div>
                    <div style="display:flex;gap:8px;padding:10px;justify-content:flex-start;">
                        <button class="btn btn-primary btn-sm" id="tafzilOk">تأیید</button>
                        <button class="btn btn-ghost btn-sm" onclick="App.closeModal()">انصراف</button>
                    </div>
                </div>`;

            window.App.openModal('🔍 انتخاب تفصیلی', body);

            const cleanup = (v) => {
                window.App.closeModal();
                resolve(v);
            };

            document.getElementById('tafzilOk')?.addEventListener('click', () => {
                const v = parseInt(document.getElementById('tafzilInput').value) || 0;
                cleanup(v);
            });

            document.getElementById('tafzilInput')?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = parseInt(e.target.value) || 0;
                    cleanup(v);
                }
                if (e.key === 'Escape') cleanup(null);
            });
        });
    }

    function applyAccountFilter(codeCol, codeMoein, codeTafzil) {
        _accountFilter.codeCol = codeCol;
        _accountFilter.codeMoein = codeMoein;
        _accountFilter.codeTafzil = codeTafzil;

        const parts = [];
        if (codeCol > 0) parts.push('کل: ' + codeCol);
        if (codeMoein > 0) parts.push('معین: ' + codeMoein);
        if (codeTafzil > 0) parts.push('تفصیلی: ' + codeTafzil);
        _accountFilter.label = parts.join(' / ');

        updateAccountBar();
        window.App.closeModal();

        window.App.state.sanadPage = 1;
        _selected.clear();
        loadList();
    }

    function clearAccountFilter() {
        _accountFilter = { codeCol: 0, codeMoein: 0, codeTafzil: 0, label: '' };
        updateAccountBar();
        window.App.state.sanadPage = 1;
        _selected.clear();
        loadList();
    }

    function updateAccountBar() {
        const label = document.getElementById('selectedAccountLabel');
        const clear = document.getElementById('clearAccountFilterBtn');
        if (!label || !clear) return;

        if (_accountFilter.codeCol > 0) {
            label.textContent = '🎯 ' + _accountFilter.label;
            label.style.display = 'inline-block';
            clear.style.display = 'inline-block';
        } else {
            label.textContent = '';
            label.style.display = 'none';
            clear.style.display = 'none';
        }
    }

    // ═══════════════════════════════════════════
    //  CLOSING SANAD — سند اختتامیه
    // ═══════════════════════════════════════════
    async function openClosingDialog() {
        const u = window.App.state.user || {};
        const orgId = u.orgId;
        const fyId = u.fyId;

        if (!orgId || !fyId) {
            window.App.toast('اطلاعات سازمان/دوره در دسترس نیست', 'error');
            return;
        }

        try {
            const val = await window.App.Http.api('/api/sanad/closing/validate', {
                method: 'POST',
                body: JSON.stringify({ orgId, fyId })
            });

            if (val.alreadyClosed) {
                await window.App.alert.warning(
                    `سند اختتامیه قبلاً صادر شده است (شماره ${val.endSanadNum}).\n\n` +
                    `اگر مایل به صدور مجدد هستید، ابتدا سند اختتامیه را از لیست اسناد حذف کنید و سپس دوباره این دکمه را بزنید.`,
                    { title: '🔒 سند اختتامیه موجود است' }
                );
                return;
            }

            if (!val.ok) {
                const issues = (val.issues || []).join('\n• ');
                const unconfirmed = (val.unconfirmedList || []).slice(0, 10)
                    .map(x => `#${x.noSanad} (${x.vazeit === 1 ? 'رسیدگی' : 'پیش‌نویس'})`)
                    .join('، ');
                await window.App.alert.warning(
                    `امکان صدور سند اختتامیه نیست:\n\n• ${issues}` +
                    (unconfirmed ? `\n\nاسناد نامشخص: ${unconfirmed}` : ''),
                    { title: '⛔ پیش‌نیازها برقرار نیست' }
                );
                return;
            }

            const pickerRes = await window.App.UI.HesabPicker.open({ mode: 'moein' });
            if (!pickerRes) {
                window.App.toast('برای صدور سند اختتامیه، باید حساب اختتامیه را انتخاب کنید.', 'warning');
                return;
            }

            const ok = await window.App.confirm(
                `آیا از صدور سند اختتامیه مطمئن هستید؟\n\n` +
                `📊 مجموع اسناد: ${val.totalSanads}\n` +
                `✅ همه قطعی (Vazeit=2)\n` +
                `🏦 حساب اختتامیه: ${pickerRes.codeCol} / ${pickerRes.codeMoein}\n\n` +
                `⚠️ پس از این عملیات، شماره سند اختتامیه در جدول دوره مالی ثبت می‌شود و امکان صدور مجدد از طریق UI وجود ندارد.`,
                {
                    title: '🔒 صدور سند اختتامیه',
                    type: 'warning',
                    okText: 'بله، صادر کن',
                    cancelText: 'لغو'
                }
            );
            if (!ok) return;

            const result = await window.App.Http.api('/api/sanad/closing/create', {
                method: 'POST',
                body: JSON.stringify({
                    orgId,
                    fyId,
                    closingCodeCol: pickerRes.codeCol,
                    closingCodeMoein: pickerRes.codeMoein,
                    closingCodeTafzil: pickerRes.codeTafzil || 0
                }),
                successMsg: 'در حال صدور سند اختتامیه...'
            });

            if (result.success) {
                await window.App.alert.success(
                    `✅ سند اختتامیه شماره ${result.noSanad} با ${result.rowsCreated} ردیف صادر شد.\n\n` +
                    `جمع بدهکار: ${window.App.Helpers.fmt(result.totalBed)}\n` +
                    `جمع بستانکار: ${window.App.Helpers.fmt(result.totalBes)}`,
                    { title: 'انجام شد' }
                );
                loadList();
            } else {
                await window.App.alert.error(
                    'خطا در صدور سند اختتامیه:\n\n' + (result.message || 'خطای نامشخص'),
                    { title: '⛔ خطا' }
                );
            }
        } catch (err) {
            await window.App.alert.error(err.message || 'خطا در ارتباط با سرور', {
                title: 'خطا'
            });
        }
    }

    // ═══════════════════════════════════════════
    //  OPENING SANAD — سند افتتاحیه
    // ═══════════════════════════════════════════
    async function openOpeningDialog() {
        const u = window.App.state.user || {};
        const orgId = u.orgId;
        const fyId = u.fyId;
        if (!orgId || !fyId) {
            window.App.toast('اطلاعات سازمان/دوره در دسترس نیست', 'error');
            return;
        }

        const ok = await window.App.confirm(
            'آیا از صدور سند افتتاحیه برای این دوره مطمئن هستید؟\n\n' +
            '⚠️ این عملیات فقط یک بار برای هر دوره امکان‌پذیر است و از سال قبل کپی می‌شود.',
            { title: '📂 سند افتتاحیه', type: 'warning', okText: 'بله، صادر کن' }
        );
        if (!ok) return;

        try {
            const res = await window.App.Http.api('/api/setup/opening-sanad', {
                method: 'POST',
                body: JSON.stringify({ orgId, fyId }),
                silent: true
            });
            if (res.success) {
                await window.App.alert.success(
                    `✅ سند افتتاحیه (شماره ${res.noSanad}) با ${res.rowsCopied} ردیف صادر شد.`,
                    { title: 'انجام شد' }
                );
                loadList();
            } else {
                await window.App.alert.error(res.message, { title: 'خطا در صدور افتتاحیه' });
            }
        } catch (err) {
            await window.App.alert.error(err.message, { title: 'خطا' });
        }
    }


    return { render, loadList, gotoPage, showDetail, buildUrl, sortBy, openBulkChangeVazeitDialog, openClosingDialog, openOpeningDialog };

})();

window.App.Features = window.App.Features || {};
window.App.Features.Sanad = window.App.Features.Sanad;
window.App.showSanadDetail = window.App.Features.Sanad.showDetail;
window.App.gotoSanadPage = window.App.Features.Sanad.gotoPage;
window.App.renderSanadList = window.App.Features.Sanad.render;
window.App.loadSanadList = window.App.Features.Sanad.loadList;