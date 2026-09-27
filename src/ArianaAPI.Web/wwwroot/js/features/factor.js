/* ═══════════════════════════════════════════════════
   Feature / Factor — لیست + جدید + ویرایش + حذف
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Factor = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════
    //  RENDER — صفحه فیلتر + نتیجه
    //  پارامتر اختیاری: defaultKind (0..9)
    // ═══════════════════════════════════════════
    function render(defaultKind) {
        const sel = (defaultKind != null && !isNaN(defaultKind))
            ? parseInt(defaultKind, 10)
            : null;

        const c = document.getElementById('content');

        const optAll = sel === null ? 'selected' : '';
        const opt0 = sel === 0 ? 'selected' : '';
        const opt1 = sel === 1 ? 'selected' : '';
        const opt2 = sel === 2 ? 'selected' : '';
        const opt3 = sel === 3 ? 'selected' : '';
        const opt4 = sel === 4 ? 'selected' : '';
        const opt9 = sel === 9 ? 'selected' : '';

        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>نوع فاکتور</label>
                    <select id="facKind">
                        <option value="" ${optAll}>همه</option>
                        <option value="0" ${opt0}>خرید</option>
                        <option value="1" ${opt1}>فروش</option>
                        <option value="2" ${opt2}>برگشت از خرید</option>
                        <option value="3" ${opt3}>برگشت از فروش</option>
                        <option value="4" ${opt4}>پیش فاکتور</option>
                        <option value="9" ${opt9}>ضایعات</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>از شماره</label>
                    <input type="number" id="facNoFrom">
                </div>
                <div class="form-group">
                    <label>تا شماره</label>
                    <input type="number" id="facNoTo">
                </div>
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="facDateFrom" placeholder="1404/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="facDateTo" placeholder="1404/12/29">
                </div>
                <div class="form-group">
                    <label>از مبلغ</label>
                    <input type="number" id="facCostFrom">
                </div>
                <div class="form-group">
                    <label>تا مبلغ</label>
                    <input type="number" id="facCostTo">
                </div>
                <div class="form-group">
                    <label>کد طرف حساب</label>
                    <input type="number" id="facCodeTafzil">
                </div>
                <div class="form-group">
                    <label>نام طرف حساب</label>
                    <input type="text" id="facHesabName">
                </div>
                <div class="form-group">
                    <label>شرح</label>
                    <input type="text" id="facDescript">
                </div>
                <div class="form-group">
                    <label>کد کالا</label>
                    <input type="text" id="facArticleCode">
                </div>
                <div class="form-group">
                    <label>نام کالا</label>
                    <input type="text" id="facArticleName">
                </div>
            </div>
            <button class="btn btn-primary" id="facBtnRun">🔍 جستجو</button>
        </div>
        <div id="facResult">
            <div class="loading"><div class="spinner"></div></div>
        </div>`;

        document.getElementById('facBtnRun').addEventListener('click', function () { runList(1); });

        ['facKind', 'facNoFrom', 'facNoTo', 'facDateFrom', 'facDateTo',
            'facCostFrom', 'facCostTo', 'facCodeTafzil', 'facHesabName',
            'facDescript', 'facArticleCode', 'facArticleName'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') runList(1);
                });
            });

        runList(1);
    }

    // ═══════════════════════════════════════════
    //  RUN
    // ═══════════════════════════════════════════
    async function runList(page) {
        page = page || 1;
        const container = document.getElementById('facResult');
        if (!container) return;
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const payload = buildPayload(page);

        try {
            const result = await window.App.Http.api('/api/factor/list', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            renderListResult(result);
        } catch (err) {
            container.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function buildPayload(page, pageSizeOverride) {
        const parseI = function (id) {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };
        const parseD = function (id) {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseFloat(el.value);
        };

        return {
            factorKind: parseI('facKind'),
            noFrom: parseI('facNoFrom'),
            noTo: parseI('facNoTo'),
            dateFrom: document.getElementById('facDateFrom').value || null,
            dateTo: document.getElementById('facDateTo').value || null,
            costFrom: parseD('facCostFrom'),
            costTo: parseD('facCostTo'),
            codeTafzil: parseI('facCodeTafzil'),
            hesabName: document.getElementById('facHesabName').value || null,
            descript: document.getElementById('facDescript').value || null,
            articleCode: document.getElementById('facArticleCode').value || null,
            articleName: document.getElementById('facArticleName').value || null,
            page: page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize
        };
    }

    // ═══════════════════════════════════════════
    //  RENDER RESULT
    // ═══════════════════════════════════════════
    function renderListResult(data) {
        const container = document.getElementById('facResult');
        const items = data.items || [];
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || 0;

        let tableContent;
        if (items.length === 0) {
            tableContent =
                '<div class="empty" style="padding: 60px 20px;">' +
                '<div class="empty-icon" style="font-size: 56px; opacity: 0.4;">📭</div>' +
                '<p style="margin-top: 12px; color: var(--text-muted);">فاکتوری یافت نشد</p>' +
                '<p style="margin-top: 6px; font-size: 12px; color: var(--text-muted);">' +
                'برای شروع یکی از دکمه‌های بالا را بزنید' +
                '</p>' +
                '</div>';
        } else {
            const rows = items.map(function (f) {
                // ⭐ badge سند
                let sanadBadge;
                if (f.noSanad) {
                    sanadBadge = '<span class="sanad-badge sanad-ok" title="سند ثبت شده">' +
                        '✅ ' + f.noSanad + '</span>';
                } else {
                    sanadBadge = '<span class="sanad-badge sanad-none" title="بدون سند">🚫</span>';
                }

                return '' +
                    '<tr>' +
                    '<td class="num text-center">' + (f.noFactor || '') + '</td>' +
                    '<td class="num">' + H.esc(f.dateIn || '') + '</td>' +
                    '<td>' + H.esc(f.factorKindTitle || '') + '</td>' +
                    '<td class="num">' + (f.codeTafzil || '') + '</td>' +
                    '<td>' + H.esc(f.hesabName || '') + '</td>' +
                    '<td>' + H.esc(f.isCashName || '') + '</td>' +
                    '<td class="num text-left">' + H.fmt(f.cost) + '</td>' +
                    '<td>' + H.esc(f.markerName || '') + '</td>' +
                    '<td class="text-center">' + sanadBadge + '</td>' +
                    '<td>' + H.esc(f.dateSanad || '') + '</td>' +
                    '<td class="text-center">' +
                    '<button class="btn btn-sm btn-ghost" ' +
                    'onclick="App.Features.Factor.showDetail(' + f.id + ')" ' +
                    'title="مشاهده">🔍</button>' +
                    '<button class="btn btn-sm btn-ghost" ' +
                    'data-permission="201" ' +
                    'onclick="event.stopPropagation();App.Features.FactorForm.openEdit(' + f.id + ',' + f.factorKind + ')" ' +
                    'title="ویرایش">✏️</button>' +
                    '<button class="btn btn-sm btn-ghost" ' +
                    'data-permission="202" ' +
                    'onclick="event.stopPropagation();App.Features.FactorForm.delete(' + f.id + ')" ' +
                    'title="حذف" style="color:var(--danger);">🗑️</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');

            tableContent =
                '<div class="table-wrapper">' +
                '<table>' +
                '<thead><tr>' +
                '<th style="width:70px;">شماره</th>' +
                '<th style="width:90px;">تاریخ</th>' +
                '<th style="width:110px;">نوع</th>' +
                '<th style="width:70px;">کد طرف</th>' +
                '<th>طرف حساب</th>' +
                '<th style="width:70px;">پرداخت</th>' +
                '<th class="text-left" style="width:130px;">مبلغ</th>' +
                '<th style="width:130px;">بازاریاب</th>' +
                '<th style="width:80px;">سند</th>' +
                '<th style="width:90px;">تاریخ سند</th>' +
                '<th style="width:120px;"></th>' +
                '</tr></thead>' +
                '<tbody>' + rows + '</tbody>' +
                '</table>' +
                '</div>' +
                buildPagination(page, totalPages, totalCount, items.length);
        }

        container.innerHTML =
            '<div class="card">' +
            '<div class="card-title">' +
            '<span>🧾 لیست فاکتورها (' + H.fmt(totalCount) + ')</span>' +
            '<div class="fac-actions">' +
            buildBulkSanadButton() +
            buildNewFactorButton() +
            '</div>' +
            '</div>' +
            tableContent +
            '</div>';

        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(container);
        }

        if (items.length > 0) {
            Exporter.attach(container, {
                title: 'لیست فاکتورها',
                subtitle: subtitle(),
                filename: 'FactorList',
                getFullTable: fetchFullTable
            });
            window.App.enhanceTables(container);
        }
    }
    // ═══════════════════════════════════════════
    //  دکمه فاکتور جدید
    // ═══════════════════════════════════════════
    function buildNewFactorButton() {
        const kindEl = document.getElementById('facKind');
        const sel = kindEl && kindEl.value !== ''
            ? parseInt(kindEl.value, 10)
            : null;

        // اگه نوع فیلتر انتخاب شده → دکمه ساده
        if (sel !== null && !isNaN(sel)) {
            return '<button class="btn btn-primary btn-sm" ' +
                'data-permission="200" ' +
                'onclick="App.Features.Factor.createNew(' + sel + ')">' +
                '➕ ' + H.esc(getKindShortName(sel)) + ' جدید' +
                '</button>';
        }

        // dropdown
        return '' +
            '<div class="fac-new-dropdown" id="facNewDropdown">' +
            '<button class="btn btn-primary btn-sm" data-permission="200" ' +
            'onclick="App.Features.Factor.toggleNewDropdown(event)">' +
            '➕ فاکتور جدید <span style="font-size:10px;">▼</span>' +
            '</button>' +
            '<div class="fac-new-menu" id="facNewMenu">' +
            '<div class="fac-new-item" onclick="App.Features.Factor.createNew(0)"><span>📥</span> فاکتور خرید</div>' +
            '<div class="fac-new-item" onclick="App.Features.Factor.createNew(1)"><span>📤</span> فاکتور فروش</div>' +
            '<div class="fac-new-item" onclick="App.Features.Factor.createNew(2)"><span>↩️</span> برگشت از خرید</div>' +
            '<div class="fac-new-item" onclick="App.Features.Factor.createNew(3)"><span>↪️</span> برگشت از فروش</div>' +
            '<div class="fac-new-item" onclick="App.Features.Factor.createNew(4)"><span>📋</span> پیش‌فاکتور</div>' +
            '<div class="fac-new-item" onclick="App.Features.Factor.createNew(9)"><span>🗑️</span> فروش ضایعات</div>' +
            '</div>' +
            '</div>';
    }

    function getKindShortName(kind) {
        const map = {
            0: 'فاکتور خرید',
            1: 'فاکتور فروش',
            2: 'برگشت از خرید',
            3: 'برگشت از فروش',
            4: 'پیش‌فاکتور',
            9: 'فروش ضایعات'
        };
        return map[kind] || 'فاکتور';
    }
    function buildBulkSanadButton() {
        return '<button class="btn btn-ghost btn-sm" ' +
            'data-permission="200" ' +
            'onclick="App.Features.Factor.openBulkSanadDialog()" ' +
            'title="ثبت سند برای فاکتورهای بدون سند">' +
            '📄 ثبت سند گروهی' +
            '</button>';
    }
    function openBulkSanadDialog() {
        if (window.App.Permissions && !window.App.Permissions.can(200)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        const body =
            '<div class="bulk-sanad-form">' +

            '<div class="bulk-sanad-info">' +
            '<p>برای فاکتورهای <b>بدون سند</b>، سند حسابداری صادر می‌شود.</p>' +
            '<p class="muted">فیلترهای زیر اعمال می‌شوند (اختیاری):</p>' +
            '</div>' +

            '<div class="form-group">' +
            '<label>نوع فاکتور</label>' +
            '<select id="bsFactorKind">' +
            '<option value="">همه (خرید، فروش، برگشت‌ها)</option>' +
            '<option value="0">فقط خرید</option>' +
            '<option value="1">فقط فروش</option>' +
            '<option value="2">فقط برگشت از خرید</option>' +
            '<option value="3">فقط برگشت از فروش</option>' +
            '</select>' +
            '</div>' +

            '<div class="form-row">' +
            '<div class="form-group">' +
            '<label>از شماره</label>' +
            '<input type="number" id="bsNoFrom">' +
            '</div>' +
            '<div class="form-group">' +
            '<label>تا شماره</label>' +
            '<input type="number" id="bsNoTo">' +
            '</div>' +
            '</div>' +

            '<div class="form-group">' +
            '<label>حالت ثبت</label>' +
            '<div class="radio-group">' +
            '<label class="radio-item">' +
            '<input type="radio" name="bsMode" value="1" checked>' +
            ' یک سند برای هر فاکتور' +
            '</label>' +
            '<label class="radio-item">' +
            '<input type="radio" name="bsMode" value="0">' +
            ' همه در یک سند کلی' +
            '</label>' +
            '</div>' +
            '</div>' +

            '<div id="bsError" class="error-box hidden"></div>' +
            '<div id="bsProgress" class="hidden" style="padding:12px; background:#F9FAFB; border-radius:8px; margin-top:10px; text-align:center;">' +
            '<div class="spinner" style="display:inline-block;"></div>' +
            '<p style="margin-top:8px;">در حال ثبت سند...</p>' +
            '</div>' +
            '<div id="bsResult" class="hidden"></div>' +

            '<div style="display:flex; gap:10px; margin-top:16px;">' +
            '<button class="btn btn-primary" id="bsRunBtn">📄 شروع ثبت سند</button>' +
            '<button class="btn btn-ghost" data-close>انصراف</button>' +
            '</div>' +

            '</div>';

        window.App.openModal('📄 ثبت سند گروهی', body);

        const mb = document.getElementById('modalBody');
        mb.querySelector('#bsRunBtn').addEventListener('click', runBulkSanad);

        mb.querySelectorAll('[data-close]').forEach(function (el) {
            el.addEventListener('click', function () { window.App.closeModal(); });
        });
    }

    async function runBulkSanad() {
        const mb = document.getElementById('modalBody');
        const errEl = mb.querySelector('#bsError');
        const progEl = mb.querySelector('#bsProgress');
        const resEl = mb.querySelector('#bsResult');
        const btn = mb.querySelector('#bsRunBtn');

        errEl.classList.add('hidden');
        progEl.classList.remove('hidden');
        resEl.classList.add('hidden');
        btn.disabled = true;

        const payload = {
            mode: parseInt(mb.querySelector('input[name="bsMode"]:checked').value, 10),
            filter: {
                factorKind: mb.querySelector('#bsFactorKind').value
                    ? parseInt(mb.querySelector('#bsFactorKind').value, 10)
                    : null,
                noFrom: parseInt(mb.querySelector('#bsNoFrom').value, 10) || null,
                noTo: parseInt(mb.querySelector('#bsNoTo').value, 10) || null
            }
        };

        try {
            const result = await window.App.Http.api('/api/factor/bulk-sanad', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            progEl.classList.add('hidden');

            // ─── نمایش نتیجه ───
            const successCount = result.successCount || 0;
            const failCount = result.failCount || 0;
            const totalCount = result.totalCount || 0;

            let html = '<div class="bulk-sanad-result">';
            html += '<h4>✅ نتیجه</h4>';
            html += '<div class="bulk-sanad-stats">';
            html += '<span>مجموع: <b>' + H.fmt(totalCount) + '</b></span>';
            html += '<span class="success">موفق: <b>' + H.fmt(successCount) + '</b></span>';
            if (failCount > 0) {
                html += '<span class="fail">ناموفق: <b>' + H.fmt(failCount) + '</b></span>';
            }
            html += '</div>';

            // اگه خطا داشتن، لیست کن
            if (failCount > 0) {
                const failed = (result.results || []).filter(function (r) { return !r.success; });
                if (failed.length > 0) {
                    html += '<details style="margin-top:10px;">';
                    html += '<summary style="cursor:pointer; color:var(--danger); font-size:13px;">' +
                        'نمایش ' + failed.length + ' خطا</summary>';
                    html += '<ul style="margin-top:8px; font-size:12px; color:var(--danger); padding-right:20px;">';
                    failed.slice(0, 50).forEach(function (f) {
                        html += '<li>فاکتور ' + f.noFactor + ': ' + H.esc(f.error || 'نامشخص') + '</li>';
                    });
                    if (failed.length > 50) {
                        html += '<li>... و ' + (failed.length - 50) + ' مورد دیگر</li>';
                    }
                    html += '</ul>';
                    html += '</details>';
                }
            }

            html += '<button class="btn btn-primary btn-sm" id="bsCloseBtn" ' +
                'style="margin-top:16px;">بستن و رفرش</button>';
            html += '</div>';

            resEl.innerHTML = html;
            resEl.classList.remove('hidden');
            btn.disabled = false;
            btn.classList.add('hidden');

            mb.querySelector('#bsCloseBtn').addEventListener('click', function () {
                window.App.closeModal();
                runList(1);
            });

        } catch (err) {
            progEl.classList.add('hidden');
            errEl.textContent = 'خطا: ' + err.message;
            errEl.classList.remove('hidden');
            btn.disabled = false;
        }
    }
    function toggleNewDropdown(e) {
        if (e) e.stopPropagation();
        const el = document.getElementById('facNewDropdown');
        if (el) el.classList.toggle('open');
    }

    function createNew(kind) {
        const el = document.getElementById('facNewDropdown');
        if (el) el.classList.remove('open');

        if (window.App.Permissions && !window.App.Permissions.can(200)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        if (window.App.Features.FactorForm) {
            window.App.Features.FactorForm.openCreate(kind);
        } else {
            window.App.toast('فرم فاکتور بارگذاری نشده', 'error');
        }
    }

    // ─── بستن dropdown با کلیک بیرون ───
    document.addEventListener('click', function (e) {
        const dd = document.getElementById('facNewDropdown');
        if (dd && !e.target.closest('.fac-new-dropdown')) {
            dd.classList.remove('open');
        }
    });

    // ═══════════════════════════════════════════
    //  Pagination
    // ═══════════════════════════════════════════
    function buildPagination(page, totalPages, totalCount, itemCount) {
        if (totalPages <= 1) {
            return '<div class="pagination-bar">' +
                '<div class="pagination-info">مجموع: ' + H.fmt(totalCount) + ' فاکتور</div>' +
                '</div>';
        }

        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += '<button class="page-btn ' + (p === page ? 'active' : '') + '" ' +
                'onclick="App.Features.Factor.runList(' + p + ')">' + p + '</button>';
        }

        return '' +
            '<div class="pagination-bar">' +
            '<div class="pagination-info">نمایش ' + H.fmt(itemCount) + ' از ' + H.fmt(totalCount) + ' فاکتور</div>' +
            '<div class="pagination-controls">' +
            '<button class="page-btn" ' + (page <= 1 ? 'disabled' : '') + ' onclick="App.Features.Factor.runList(1)">«</button>' +
            '<button class="page-btn" ' + (page <= 1 ? 'disabled' : '') + ' onclick="App.Features.Factor.runList(' + (page - 1) + ')">‹ قبلی</button>' +
            pageBtns +
            '<button class="page-btn" ' + (page >= totalPages ? 'disabled' : '') + ' onclick="App.Features.Factor.runList(' + (page + 1) + ')">بعدی ›</button>' +
            '<button class="page-btn" ' + (page >= totalPages ? 'disabled' : '') + ' onclick="App.Features.Factor.runList(' + totalPages + ')">»</button>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════════
    //  Export
    // ═══════════════════════════════════════════
    async function fetchFullTable() {
        const payload = buildPayload(1, 100000);
        const full = await window.App.Http.api('/api/factor/list', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return buildTableHtml(full.items || []);
    }

    function buildTableHtml(items) {
        let html = '<table><thead><tr>' +
            '<th>شماره</th><th>تاریخ</th><th>نوع</th><th>کد طرف</th>' +
            '<th>طرف حساب</th><th>پرداخت</th><th class="text-left">مبلغ</th>' +
            '<th>بازاریاب</th><th>سند</th><th>تاریخ سند</th>' +
            '</tr></thead><tbody>';

        items.forEach(function (f) {
            html += '<tr>' +
                '<td class="num text-center">' + (f.noFactor || '') + '</td>' +
                '<td class="num">' + H.esc(f.dateIn || '') + '</td>' +
                '<td>' + H.esc(f.factorKindTitle || '') + '</td>' +
                '<td class="num">' + (f.codeTafzil || '') + '</td>' +
                '<td>' + H.esc(f.hesabName || '') + '</td>' +
                '<td>' + H.esc(f.isCashName || '') + '</td>' +
                '<td class="num text-left">' + H.fmt(f.cost) + '</td>' +
                '<td>' + H.esc(f.markerName || '') + '</td>' +
                '<td class="num text-center">' + (f.noSanad || '') + '</td>' +
                '<td>' + H.esc(f.dateSanad || '') + '</td>' +
                '</tr>';
        });
        html += '</tbody></table>';

        const table = document.createElement('table');
        table.innerHTML = html;
        return table;
    }

    // ═══════════════════════════════════════════
    //  Show Detail (modal)
    // ═══════════════════════════════════════════
    async function showDetail(factorId) {
        window.App.openModal('جزئیات فاکتور',
            '<div class="loading"><div class="spinner"></div></div>');

        try {
            const detail = await window.App.Http.api('/api/factor/' + factorId);
            const h = detail.header || {};
            const items = detail.items || [];

            document.getElementById('modalBody').innerHTML = buildDetailHtml(h, items, detail);

            Exporter.attach(document.getElementById('modalBody'), {
                title: (h.factorKindTitle || 'فاکتور') + ' - شماره ' + (h.noFactor || ''),
                subtitle: subtitle(),
                filename: 'Factor_' + (h.noFactor || factorId),
                customHtml: function () { return buildPrintHtml(h, items, detail); }
            });

            window.App.enhanceTables(document.getElementById('modalBody'));
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function buildDetailHtml(h, items, detail) {
        const rows = items.map(function (it, idx) {
            return '<tr>' +
                '<td class="num text-center">' + (idx + 1) + '</td>' +
                '<td class="num">' + (it.articleCode || '') + '</td>' +
                '<td>' + H.esc(it.articleName || '') + '</td>' +
                '<td>' + H.esc(it.articleUnitName || '') + '</td>' +
                '<td class="num text-left">' + H.fmt(it.articleCount) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.cost) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.costItem) + '</td>' +
                '<td class="num text-center">' + (it.perDiscount > 0 ? H.fmt(it.perDiscount) + '%' : '-') + '</td>' +
                '<td class="num text-left">' + H.fmt(it.discount) + '</td>' +
                '<td class="num text-center">' + (it.taxFi > 0 ? H.fmt(it.taxFi) + '%' : '-') + '</td>' +
                '<td class="num text-left">' + H.fmt(it.tax) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.transCost) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.finallCost) + '</td>' +
                '</tr>';
        }).join('');

        return '' +
            // ═══ Header ═══
            '<div class="factor-header">' +
            '<div class="factor-header-col">' +
            '<div class="factor-field">' +
            '<span class="factor-label">شماره فاکتور:</span>' +
            '<span class="factor-value">' + (h.noFactor || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">تاریخ:</span>' +
            '<span class="factor-value">' + H.esc(h.dateIn || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">نوع:</span>' +
            '<span class="factor-value">' + H.esc(h.factorKindTitle || '-') + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="factor-header-col">' +
            '<div class="factor-field">' +
            '<span class="factor-label">شماره سند:</span>' +
            '<span class="factor-value">' + (h.noSanad || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">تاریخ سند:</span>' +
            '<span class="factor-value">' + H.esc(h.dateSanad || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">وضعیت:</span>' +
            '<span class="factor-value">' +

            (h.parentSanadId ?
                '<div class="factor-sanad-section">' +
                '<div class="factor-sanad-info">' +
                '<span class="factor-label">📄 سند حسابداری:</span> ' +
                '<span class="factor-value">شماره ' + (h.noSanad || '—') + '</span>' +
                '<span class="factor-value">تاریخ ' + (h.dateSanad || '—') + '</span>' +
                '</div>' +
                '<button type="button" class="btn btn-ghost btn-sm factor-sanad-delete" ' +
                'data-permission="201" ' +
                'onclick="App.Features.Factor.deleteSanad(' + h.id + ')">' +
                '🗑️ حذف سند' +
                '</button>' +
                '</div>'
                : '') +
            '</div>' +
            '</div>' +
            '<div class="factor-header-col">' +
            '<div class="factor-field">' +
            '<span class="factor-label">بازاریاب:</span>' +
            '<span class="factor-value">' + H.esc(h.markerName || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">موبایل بازاریاب:</span>' +
            '<span class="factor-value">' + H.esc(h.markerMobile || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">شماره ماشین:</span>' +
            '<span class="factor-value">' + H.esc(h.carInfo || '-') + '</span>' +
            '</div>' +
            '</div>' +
            '</div>' +

            // ═══ مشتری ═══
            '<div class="factor-party">' +
            '<h4>👤 اطلاعات طرف حساب</h4>' +
            '<div class="factor-party-grid">' +
            '<div class="factor-field">' +
            '<span class="factor-label">نام:</span>' +
            '<span class="factor-value">' + H.esc(h.hesabName || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">کد تفصیلی:</span>' +
            '<span class="factor-value">' + (h.codeTafzil || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">تلفن:</span>' +
            '<span class="factor-value">' + H.esc(h.phone || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">موبایل:</span>' +
            '<span class="factor-value">' + H.esc(h.mobile || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">کد اقتصادی:</span>' +
            '<span class="factor-value">' + H.esc(h.economicCode || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">کد ملی:</span>' +
            '<span class="factor-value">' + H.esc(h.nationalCode || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">کد پستی:</span>' +
            '<span class="factor-value">' + H.esc(h.postalCode || '-') + '</span>' +
            '</div>' +
            '<div class="factor-field">' +
            '<span class="factor-label">استان/شهر:</span>' +
            '<span class="factor-value">' + H.esc(h.stateName || '') + ' - ' + H.esc(h.cityName1 || '') + '</span>' +
            '</div>' +
            '<div class="factor-field factor-field-wide">' +
            '<span class="factor-label">آدرس:</span>' +
            '<span class="factor-value">' + H.esc(h.address || '-') + '</span>' +
            '</div>' +
            '</div>' +
            '</div>' +

            // ═══ شرح ═══
            (h.descript ?
                '<div class="factor-descript">' +
                '<span class="factor-label">شرح:</span> ' +
                '<span>' + H.esc(h.descript) + '</span>' +
                '</div>'
                : '') +

            // ═══ Grid اقلام ═══
            '<h4 style="margin:16px 0 8px;">📋 ردیف‌های کالا (' + items.length + ')</h4>' +
            '<div class="table-wrapper">' +
            '<table>' +
            '<thead><tr>' +
            '<th style="width:35px;">#</th>' +
            '<th style="width:70px;">کد کالا</th>' +
            '<th>نام کالا</th>' +
            '<th style="width:55px;">واحد</th>' +
            '<th class="text-left" style="width:70px;">تعداد</th>' +
            '<th class="text-left" style="width:100px;">قیمت واحد</th>' +
            '<th class="text-left" style="width:110px;">مبلغ کل</th>' +
            '<th class="text-center" style="width:60px;">تخفیف %</th>' +
            '<th class="text-left" style="width:90px;">مبلغ تخفیف</th>' +
            '<th class="text-center" style="width:60px;">ارزش افزوده %</th>' +
            '<th class="text-left" style="width:90px;">مبلغ مالیات</th>' +
            '<th class="text-left" style="width:80px;">حمل</th>' +
            '<th class="text-left" style="width:110px;">جمع نهایی</th>' +
            '</tr></thead>' +
            '<tbody>' +
            (rows || '<tr><td colspan="13" class="text-center">ردیفی وجود ندارد</td></tr>') +
            '</tbody>' +
            '<tfoot>' +
            '<tr style="background:#EEF2FF; font-weight:700;">' +
            '<td colspan="4" class="text-center">جمع کل</td>' +
            '<td class="num text-left">' + H.fmt(detail.totalRows) + ' ردیف</td>' +
            '<td colspan="3" class="num text-left">تخفیف: ' + H.fmt(detail.totalDiscount) + '</td>' +
            '<td colspan="2" class="num text-left">مالیات: ' + H.fmt(detail.totalTax) + '</td>' +
            '<td class="num text-left">حمل: ' + H.fmt(detail.totalTransCost) + '</td>' +
            '<td class="num text-left">' + H.fmt(detail.totalFinall) + '</td>' +
            '</tr>' +
            '</tfoot>' +
            '</table>' +
            '</div>' +

            // ═══ جمع‌های نهایی ═══
            '<div class="factor-totals">' +
            '<div class="factor-total-item">' +
            '<span class="factor-label">مبلغ کالاها:</span>' +
            '<span class="factor-value">' + H.fmt(detail.totalCostItem) + '</span>' +
            '</div>' +
            '<div class="factor-total-item">' +
            '<span class="factor-label">جمع تخفیف:</span>' +
            '<span class="factor-value">' + H.fmt(detail.totalDiscount) + '</span>' +
            '</div>' +
            '<div class="factor-total-item">' +
            '<span class="factor-label">جمع مالیات و عوارض:</span>' +
            '<span class="factor-value">' + H.fmt(detail.totalTax) + '</span>' +
            '</div>' +
            '<div class="factor-total-item">' +
            '<span class="factor-label">جمع حمل:</span>' +
            '<span class="factor-value">' + H.fmt(detail.totalTransCost) + '</span>' +
            '</div>' +
            '<div class="factor-total-item factor-total-final">' +
            '<span class="factor-label">مبلغ نهایی:</span>' +
            '<span class="factor-value">' + H.fmt(detail.totalFinall) + '</span>' +
            '</div>' +
            '</div>';
    }
    async function deleteSanad(factorId) {
        if (window.App.Permissions && !window.App.Permissions.can(201)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        if (!confirm('آیا از حذف سند مرتبط با این فاکتور مطمئن هستید؟\n' +
            '(سند فقط در صورت غیرقطعی بودن حذف می‌شود)')) return;

        try {
            await window.App.Http.api('/api/factor/' + factorId + '/sanad', {
                method: 'DELETE'
            });
            window.App.toast('سند با موفقیت حذف شد', 'success');
            window.App.closeModal();
            runList(1);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }
    function buildPrintHtml(h, items, detail) {
        // ═══ Header ═══
        const headerRows =
            '<table class="factor-info-table">' +
            '<tr>' +
            '<td class="label">شماره فاکتور:</td><td>' + (h.noFactor || '-') + '</td>' +
            '<td class="label">تاریخ:</td><td>' + H.esc(h.dateIn || '-') + '</td>' +
            '<td class="label">نوع:</td><td>' + H.esc(h.factorKindTitle || '-') + '</td>' +
            '<td class="label">شماره سند:</td><td>' + (h.noSanad || '-') + '</td>' +
            '<td class="label">تاریخ سند:</td><td>' + H.esc(h.dateSanad || '-') + '</td>' +
            '</tr>' +
            '</table>';

        // ═══ مشتری ═══
        const partyRows =
            '<div class="section-title">👤 اطلاعات طرف حساب</div>' +
            '<table class="factor-info-table">' +
            '<tr>' +
            '<td class="label">نام:</td><td>' + H.esc(h.hesabName || '-') + '</td>' +
            '<td class="label">کد تفصیلی:</td><td>' + (h.codeTafzil || '-') + '</td>' +
            '<td class="label">تلفن:</td><td>' + H.esc(h.phone || '-') + '</td>' +
            '<td class="label">موبایل:</td><td>' + H.esc(h.mobile || '-') + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td class="label">کد اقتصادی:</td><td>' + H.esc(h.economicCode || '-') + '</td>' +
            '<td class="label">کد ملی:</td><td>' + H.esc(h.nationalCode || '-') + '</td>' +
            '<td class="label">کد پستی:</td><td>' + H.esc(h.postalCode || '-') + '</td>' +
            '<td class="label">استان/شهر:</td><td>' +
            H.esc(h.stateName || '') + ' / ' + H.esc(h.cityName1 || '') +
            '</td>' +
            '</tr>' +
            '<tr>' +
            '<td class="label">آدرس:</td>' +
            '<td colspan="7">' + H.esc(h.address || '-') + '</td>' +
            '</tr>' +
            (h.markerName ?
                '<tr>' +
                '<td class="label">بازاریاب:</td><td>' + H.esc(h.markerName) + '</td>' +
                '<td class="label">موبایل بازاریاب:</td><td>' + H.esc(h.markerMobile || '-') + '</td>' +
                '<td class="label">شماره ماشین:</td><td colspan="3">' + H.esc(h.carInfo || '-') + '</td>' +
                '</tr>'
                : '') +
            '</table>';

        // ═══ شرح ═══
        const descriptBlock = h.descript ?
            '<div class="section-title">📝 شرح</div>' +
            '<table class="factor-info-table">' +
            '<tr><td>' + H.esc(h.descript) + '</td></tr>' +
            '</table>'
            : '';

        // ═══ ردیف‌های کالا ═══
        const itemsRows = items.map(function (it, idx) {
            return '<tr>' +
                '<td class="num text-center">' + (idx + 1) + '</td>' +
                '<td class="num text-center">' + (it.articleCode || '') + '</td>' +
                '<td>' + H.esc(it.articleName || '') + '</td>' +
                '<td class="text-center">' + H.esc(it.articleUnitName || '') + '</td>' +
                '<td class="num text-left">' + H.fmt(it.articleCount) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.cost) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.costItem) + '</td>' +
                '<td class="num text-center">' + (it.perDiscount > 0 ? H.fmt(it.perDiscount) + '%' : '-') + '</td>' +
                '<td class="num text-left">' + H.fmt(it.discount) + '</td>' +
                '<td class="num text-center">' + (it.taxFi > 0 ? H.fmt(it.taxFi) + '%' : '-') + '</td>' +
                '<td class="num text-left">' + H.fmt(it.tax) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.transCost) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.finallCost) + '</td>' +
                '</tr>';
        }).join('');

        const itemsBlock =
            '<div class="section-title">📋 ردیف‌های کالا (' + items.length + ')</div>' +
            '<table>' +
            '<thead>' +
            '<tr>' +
            '<th style="width:30px;">#</th>' +
            '<th style="width:70px;">کد کالا</th>' +
            '<th>نام کالا</th>' +
            '<th style="width:55px;">واحد</th>' +
            '<th style="width:70px;">تعداد</th>' +
            '<th style="width:100px;">قیمت واحد</th>' +
            '<th style="width:110px;">مبلغ کل</th>' +
            '<th style="width:60px;">تخفیف %</th>' +
            '<th style="width:90px;">مبلغ تخفیف</th>' +
            '<th style="width:60px;">ارزش افزوده %</th>' +
            '<th style="width:90px;">مبلغ مالیات</th>' +
            '<th style="width:70px;">حمل</th>' +
            '<th style="width:110px;">جمع نهایی</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>' +
            (itemsRows || '<tr><td colspan="13" class="text-center">ردیفی وجود ندارد</td></tr>') +
            '</tbody>' +
            '</table>';

        // ═══ جمع‌ها ═══
        const totalsBlock =
            '<table class="totals-table">' +
            '<tr>' +
            '<td class="label" style="width:150px;">تعداد ردیف:</td>' +
            '<td class="num text-left">' + detail.totalRows + '</td>' +
            '<td class="label" style="width:150px;">مبلغ کالاها:</td>' +
            '<td class="num text-left">' + H.fmt(detail.totalCostItem) + '</td>' +
            '<td class="label" style="width:130px;">جمع تخفیف:</td>' +
            '<td class="num text-left">' + H.fmt(detail.totalDiscount) + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td class="label">جمع مالیات و عوارض:</td>' +
            '<td class="num text-left">' + H.fmt(detail.totalTax) + '</td>' +
            '<td class="label">جمع حمل:</td>' +
            '<td class="num text-left">' + H.fmt(detail.totalTransCost) + '</td>' +
            '<td class="label">مبلغ نهایی:</td>' +
            '<td class="num text-left" style="font-weight:bold; color:#4F46E5; font-size:13px;">' +
            H.fmt(detail.totalFinall) +
            '</td>' +
            '</tr>' +
            '</table>';

        return headerRows + partyRows + descriptBlock + itemsBlock + totalsBlock;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return {
        render: render,
        runList: runList,
        showDetail: showDetail,
        toggleNewDropdown: toggleNewDropdown,
        createNew: createNew,
        openBulkSanadDialog: openBulkSanadDialog,
        deleteSanad: deleteSanad
    };
})();

// alias
window.App.renderFactorList = window.App.Features.Factor.render;
window.App.runFactorList = window.App.Features.Factor.runList;
window.App.showFactorDetail = window.App.Features.Factor.showDetail;