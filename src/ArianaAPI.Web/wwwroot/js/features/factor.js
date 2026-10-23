/* ═══════════════════════════════════════════════════
   Feature / Factor — لیست + جدید + ویرایش + حذف
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Factor = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _sort = { by: 'nofactor', dir: 'desc' };

    function sortIcon(field) {
        if (_sort.by !== field) return '<span style="opacity:0.3;font-size:10px;">⇅</span>';
        return _sort.dir === 'asc'
            ? '<span style="color:#4F46E5;font-size:10px;">▲</span>'
            : '<span style="color:#4F46E5;font-size:10px;">▼</span>';
    }

    function sortBy(field) {
        if (_sort.by === field) _sort.dir = _sort.dir === 'asc' ? 'desc' : 'asc';
        else { _sort.by = field; _sort.dir = 'asc'; }
        runList(1);
    }

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
            pageSize: pageSizeOverride || window.App.state.settings.pageSize,
            sortBy: _sort.by,   
            sortDir: _sort.dir  
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
                // ⭐ badge «از پیش‌فاکتور» — حالا داخل map و با f (نه t)
                const fromPishBadge = (f.noFactorPer && f.noFactorPer > 0)
                    ? '<span class="badge badge-info" title="از پیش‌فاکتور شماره ' + f.noFactorPer + '" ' +
                    'style="display:inline-block;margin-top:4px;font-size:10px;background:#DBEAFE;color:#1E40AF;padding:2px 6px;border-radius:4px;">' +
                    '📋 از پیش‌فاکتور #' + f.noFactorPer +
                    '</span>'
                    : '';

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
                    '<td class="num text-center">' + (f.noFactor || '') + fromPishBadge + '</td>' +
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
                    '<button class="btn btn-sm btn-ghost" onclick="App.Features.Factor.printFactor(' + f.id + ')" title="چاپ">🖨️</button>' + 
                    '</td>' +
                    '</tr>';
            }).join('');

            tableContent =
                '<div class="table-wrapper"><table><thead><tr>' +
                '<th class="sortable-th" style="width:90px;" onclick="App.Features.Factor.sortBy(\'nofactor\')">شماره ' + sortIcon('nofactor') + '</th>' +
                '<th class="sortable-th" style="width:90px;" onclick="App.Features.Factor.sortBy(\'datein\')">تاریخ ' + sortIcon('datein') + '</th>' +
                '<th class="sortable-th" style="width:110px;" onclick="App.Features.Factor.sortBy(\'factorkind\')">نوع ' + sortIcon('factorkind') + '</th>' +
                '<th class="sortable-th" style="width:70px;" onclick="App.Features.Factor.sortBy(\'codetafzil\')">کد طرف ' + sortIcon('codetafzil') + '</th>' +
                '<th class="sortable-th" onclick="App.Features.Factor.sortBy(\'hesabname\')">طرف حساب ' + sortIcon('hesabname') + '</th>' +
                '<th style="width:70px;">پرداخت</th>' +
                '<th class="sortable-th text-left" style="width:130px;" onclick="App.Features.Factor.sortBy(\'cost\')">مبلغ ' + sortIcon('cost') + '</th>' +
                '<th style="width:130px;">بازاریاب</th>' +
                '<th class="sortable-th" style="width:80px;" onclick="App.Features.Factor.sortBy(\'nosanad\')">سند ' + sortIcon('nosanad') + '</th>' +
                '<th class="sortable-th" style="width:90px;" onclick="App.Features.Factor.sortBy(\'datesanad\')">تاریخ سند ' + sortIcon('datesanad') + '</th>' +
                '<th style="width:120px;"></th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
                buildPagination(page, totalPages, totalCount, items.length);
        }

        container.innerHTML =
            '<div class="card"><div class="card-title"><span>🧾 لیست فاکتورها (' + H.fmt(totalCount) + ')</span>' +
            '<div class="fac-actions">' +
            '<button class="btn btn-ghost btn-sm" onclick="App.Features.Factor.printAllFactorsModal()" title="چاپ گروهی فاکتورهای لیست">🖨️ چاپ همه فاکتورها</button>' + 
            buildBulkSanadButton() +
            buildNewFactorButton() +
            '</div></div>' +
            tableContent + '</div>';

        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(container);
        }

        if (items.length > 0) {
            // ⭐ استفاده از اکسل اکسپورتر برای دکمه اکسل (بدون دکمه چاپ پیش‌فرض)
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
        const payload = buildPayload(1, 2000);
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
            '<div class="factor-total-item factor-total-final" style="flex-direction: column; align-items: flex-start;">' +
            '<div style="display:flex; justify-content:space-between; width:100%;">' +
            '<span class="factor-label">مبلغ نهایی:</span>' +
            '<span class="factor-value">' + H.fmt(detail.totalFinall) + '</span>' +
            '</div>' +
            // ⭐ نمایش حروف در مودال جزئیات
            '<div style="font-size: 13px; color: #059669; margin-top: 8px; font-weight: bold; width:100%; text-align:center;">' +
            H.toPersianWords(detail.totalFinall) +
            '</div>' +
            '</div>' +
            '</div>';
    }
    async function deleteSanad(factorId) {
        if (window.App.Permissions && !window.App.Permissions.can(201)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        const ok = await window.App.confirm(
            'آیا از حذف سند مرتبط با این فاکتور مطمئن هستید؟\n\n' +
            '(سند فقط در صورت غیرقطعی بودن حذف می‌شود)',
            {
                title: 'حذف سند حسابداری',
                danger: true,
                okText: 'بله، حذف کن',
                cancelText: 'لغو'
            }
        );
        if (!ok) return;


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
            // ⭐ ردیف جدید برای مبلغ به حروف در چاپ
            '<tr>' +
            '<td class="label" style="border-top: 1px solid #ccc; padding-top: 8px;">مبلغ به حروف:</td>' +
            '<td colspan="5" class="text-right" style="border-top: 1px solid #ccc; padding-top: 8px; font-weight:bold; color:#059669;">' +
            H.toPersianWords(detail.totalFinall) +
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
    //  PRINT FACTOR (با گزینه چاپ وب استاندارد)
    // ═══════════════════════════════════════════
    async function printFactor(factorId) {
        let detail;
        try {
            detail = await window.App.Http.api('/api/factor/' + factorId);
        } catch (err) {
            window.App.toast('خطا در دریافت اطلاعات فاکتور', 'error');
            return;
        }

        const safeDetail = JSON.stringify(detail).replace(/"/g, '&quot;');

        const modalBody = `
            <div class="print-options-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; padding:10px; max-height: 70vh; overflow-y: auto;">
                <div class="print-option-card" style="border: 2px solid #4F46E5; background:#F8FAFC;" onclick="App.Features.Factor.doPrint(${factorId}, 'web-standard', ${safeDetail})">
                    <div class="print-icon">🖥️</div><div class="print-title" style="color:#4F46E5;">چاپ وب (استاندارد)</div><div class="print-desc">دقیقاً مشابه نمای وب برنامه</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrint(${factorId}, 'official-standard', ${safeDetail})">
                    <div class="print-icon">📑</div><div class="print-title">رسمی (استاندارد)</div><div class="print-desc">فرمت دقیق با مشخصات کامل</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrint(${factorId}, 'normal-horizontal-2', ${safeDetail})">
                    <div class="print-icon">↔️</div><div class="print-title">رسمی افقی ۲</div><div class="print-desc">با لوگو و ۴ جای امضاء</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrint(${factorId}, 'normal-horizontal-1', ${safeDetail})">
                    <div class="print-icon">↔️</div><div class="print-title">رسمی افقی ۱</div><div class="print-desc">با جدول ۹ ردیفی</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrint(${factorId}, 'normal-a4', ${safeDetail})">
                    <div class="print-icon">📃</div><div class="print-title">معمولی - A4</div><div class="print-desc">قالب ساده و استاندارد</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrint(${factorId}, 'normal-compact', ${safeDetail})">
                    <div class="print-icon">📑</div><div class="print-title">معمولی - جمع‌وجور</div><div class="print-desc">مناسب کاغذ A5</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrint(${factorId}, 'normal-modern', ${safeDetail})">
                    <div class="print-icon">✨</div><div class="print-title">معمولی - مدرن</div><div class="print-desc">با هدر رنگی و طراحی کارتی</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrint(${factorId}, 'thermal-receipt', ${safeDetail})">
                    <div class="print-icon">🧾</div><div class="print-title">حرارتی - فروشگاهی</div><div class="print-desc">فاکتور لیستی با جزئیات</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrint(${factorId}, 'thermal-minimal', ${safeDetail})">
                    <div class="print-icon">📝</div><div class="print-title">حرارتی - مینیمال</div><div class="print-desc">فقط نام کالا و مبلغ</div>
                </div>
            </div>
        `;
        window.App.openModal('🖨️ انتخاب نوع چاپ فاکتور', modalBody);
    }
    async function doPrint(factorId, type, detail) {
        if (type === 'web-standard') {
            const htmlContent = buildWebPrintHtml(detail.header || {}, detail.items || [], detail);
            Exporter.printHtml({
                content: htmlContent,
                title: `فاکتور ${detail.header?.factorKindTitle || ''} - شماره ${detail.header?.noFactor}`,
                subtitle: (window.App.state.user?.orgName || '') + ' - ' + (window.App.state.user?.fyName || '')
            });
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;

        const pageStyle = getPageStyle(type);
        const baseStyles = getBaseStyles(pageStyle);
        const contentHtml = buildFactorHtml(type, detail);

        doc.open();
        doc.write(`<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8">${baseStyles}</head><body>${contentHtml}</body></html>`);
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => { document.body.removeChild(iframe); }, 1000); }, 300);
    }

    // ═══════════════════════════════════════════
    //  PRINT ALL FACTORS (چاپ گروهی لیست)
    // ═══════════════════════════════════════════
    function printAllFactorsModal() {
        const modalBody = `
            <div class="print-options-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; padding:10px; max-height: 70vh; overflow-y: auto;">
                <div class="print-option-card" style="border: 2px solid #4F46E5; background:#F8FAFC;" onclick="App.Features.Factor.doPrintAllFactors('web-standard')">
                    <div class="print-icon">🖥️</div><div class="print-title" style="color:#4F46E5;">چاپ وب (استاندارد)</div><div class="print-desc">دقیقاً مشابه نمای وب برنامه</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrintAllFactors('official-standard')">
                    <div class="print-icon">📑</div><div class="print-title">رسمی (استاندارد)</div><div class="print-desc">فرمت دقیق با مشخصات کامل</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrintAllFactors('normal-horizontal-1')">
                    <div class="print-icon">↔️</div><div class="print-title">رسمی افقی ۱</div><div class="print-desc">با جدول ۹ ردیفی</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrintAllFactors('normal-horizontal-2')">
                    <div class="print-icon">↔️</div><div class="print-title">رسمی افقی ۲</div><div class="print-desc">با لوگو و ۴ جای امضاء</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrintAllFactors('normal-a4')">
                    <div class="print-icon">📃</div><div class="print-title">معمولی - A4</div><div class="print-desc">قالب ساده و استاندارد</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrintAllFactors('normal-compact')">
                    <div class="print-icon">📑</div><div class="print-title">معمولی - جمع‌وجور</div><div class="print-desc">مناسب کاغذ A5</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrintAllFactors('normal-modern')">
                    <div class="print-icon">✨</div><div class="print-title">معمولی - مدرن</div><div class="print-desc">با هدر رنگی و طراحی کارتی</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrintAllFactors('thermal-receipt')">
                    <div class="print-icon">🧾</div><div class="print-title">حرارتی - فروشگاهی</div><div class="print-desc">فاکتور لیستی با جزئیات</div>
                </div>
                <div class="print-option-card" onclick="App.Features.Factor.doPrintAllFactors('thermal-minimal')">
                    <div class="print-icon">📝</div><div class="print-title">حرارتی - مینیمال</div><div class="print-desc">فقط نام کالا و مبلغ</div>
                </div>
            </div>
        `;
        window.App.openModal('🖨️ چاپ گروهی فاکتورها', modalBody);
    }

    async function doPrintAllFactors(type) {
        window.App.closeModal();

        const loadingId = 'printAllLoading';
        document.getElementById(loadingId)?.remove();
        const loadingEl = document.createElement('div');
        loadingEl.id = loadingId;
        loadingEl.innerHTML = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;justify-content:center;align-items:center;flex-direction:column;color:white;"><div class="spinner" style="width:40px;height:40px;border:4px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div><div style="margin-top:15px;font-size:18px;">در حال آماده‌سازی چاپ...</div></div>`;
        document.body.appendChild(loadingEl);

        try {
            const payload = buildPayload(1, 1000);
            const listRes = await window.App.Http.api('/api/factor/list', { method: 'POST', body: JSON.stringify(payload) });
            const items = listRes.items || [];

            if (items.length === 0) { window.App.toast('فاکتوری برای چاپ نیست', 'warning'); return; }

            let allHtml = '';
            for (let i = 0; i < items.length; i++) {
                loadingEl.querySelector('div:last-child').textContent = `در حال آماده‌سازی فاکتور ${i + 1} از ${items.length}...`;
                try {
                    const detail = await window.App.Http.api('/api/factor/' + items[i].id, { silent: true });

                    if (type === 'web-standard') {
                        allHtml += buildWebPrintHtml(detail.header || {}, detail.items || [], detail);
                    } else {
                        allHtml += buildFactorHtml(type, detail);
                    }

                    if (i < items.length - 1) {
                        allHtml += '<div style="page-break-after: always; height: 0;"></div>';
                    }
                } catch (e) { console.warn('Error fetching factor', items[i].id, e); }
            }

            if (type === 'web-standard') {
                Exporter.printHtml({
                    content: allHtml,
                    title: 'لیست فاکتورها',
                    subtitle: (window.App.state.user?.orgName || '') + ' - ' + (window.App.state.user?.fyName || '')
                });
            } else {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
                document.body.appendChild(iframe);
                const doc = iframe.contentWindow.document;
                const pageStyle = getPageStyle(type);
                const baseStyles = getBaseStyles(pageStyle);
                doc.open();
                doc.write(`<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8">${baseStyles}</head><body>${allHtml}</body></html>`);
                doc.close();
                iframe.contentWindow.focus();
                setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => { document.body.removeChild(iframe); }, 1000); }, 500);
            }
        } catch (err) {
            window.App.toast('خطا در چاپ گروهی: ' + err.message, 'error');
        } finally {
            document.getElementById(loadingId)?.remove();
        }
    }


    // ⭐ توابع کمکی برای استایل‌ها
    function getPageStyle(type) {
        const isLandscape = type.includes('horizontal') || type === 'official-standard';
        if (type.includes('thermal')) return '@page { size: 80mm auto; margin: 2mm; } body { width: 76mm; font-size: 12px; }';
        if (isLandscape) return '@page { size: A4 landscape; margin: 5mm; } body { padding: 0; margin: 0; }';
        return '@page { size: A4 portrait; margin: 8mm; } body { padding: 0; margin: 0; }';
    }
 
    function getBaseStyles(pageStyle) {
        return `<style>
            body { font-family: 'Tahoma', sans-serif; direction: rtl; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { width: 100%; border-collapse: collapse; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .num { font-family: monospace; direction: ltr; }
            .bold { font-weight: bold; }
            ${pageStyle}
            .print-table th, .print-table td { border: 1px solid #000; padding: 3px 2px; font-size: 11px; }
            .print-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
        </style>`;
    }
    // ⭐ تابع ساخت HTML (همه کدهای قالب‌ها منتقل شدند به اینجا)
    function buildFactorHtml(type, detail) {
        const h = detail.header || {};
        const items = detail.items || [];
        const totalFinal = detail.totalFinall || 0;

        const cashVal = Number(h.isCash);
        const isCash = (cashVal === 1 || isNaN(cashVal));
        const isNonCash = (cashVal === 2);

        let contentHtml = '';

        if (type === 'official-standard') {
            const minRows = 9;
            const tableRows = items.map((it, i) => `
                <tr>
                    <td class="text-center">${i + 1}</td><td class="num text-center">${it.articleCode || ''}</td><td class="text-right">${it.articleName || ''}</td>
                    <td class="num text-center">${H.fmt(it.articleCount)}</td><td class="text-center">${it.articleUnitName || ''}</td><td class="num text-center">${H.fmt(it.cost)}</td>
                    <td class="num text-center">${H.fmt(it.costItem)}</td><td class="num text-center">${H.fmt(it.discount)}</td>
                    <td class="num text-center">${H.fmt(it.tax)}</td><td class="num text-center">${H.fmt(it.finallCost)}</td>
                </tr>
            `);
            for (let i = items.length; i < minRows; i++) {
                tableRows.push(`<tr style="height: 24px;"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`);
            }

            contentHtml = `
                <div style="border: 2px solid #000; width: 100%; box-sizing: border-box; background: #fff;">
                    <div style="text-align: center; font-size: 16px; font-weight: bold; padding: 4px; border-bottom: 1px solid #000;">صورت‌حساب فروش کالا</div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 10px; font-size: 12px; font-weight: bold; border-bottom: 1px solid #000;">
                        <div>شماره: ${h.noFactor || '-'}</div><div>تاریخ: ${h.dateIn || '-'}</div>
                    </div>
                    <div style="text-align: center; font-size: 12px; font-weight: bold; background: #e5e7eb; padding: 2px; border-bottom: 1px solid #000;">مشخصات فروشنده</div>
                    <table style="border-bottom: 1px solid #000;">
                        <tr>
                            <td style="width: 20%; font-size: 11px; padding: 3px 5px;">نام شخص حقیقی/حقوقی:</td><td style="width: 30%; font-size: 11px; font-weight: bold; padding: 3px 5px;">گروه نرم افزاری آریانا</td>
                            <td style="width: 20%; font-size: 11px; padding: 3px 5px;">شماره اقتصادی:</td><td style="width: 30%; font-size: 11px; padding: 3px 5px;">-</td>
                        </tr>
                        <tr>
                            <td style="font-size: 11px; padding: 3px 5px;">شماره ثبت/شماره ملی:</td><td style="font-size: 11px; padding: 3px 5px;">-</td>
                            <td style="font-size: 11px; padding: 3px 5px;">کدپستی:</td><td style="font-size: 11px; padding: 3px 5px;">-</td>
                        </tr>
                        <tr>
                            <td style="font-size: 11px; padding: 3px 5px;">استان:</td><td style="font-size: 11px; padding: 3px 5px;">تهران</td>
                            <td style="font-size: 11px; padding: 3px 5px;">شهر:</td><td style="font-size: 11px; padding: 3px 5px;">تهران</td>
                        </tr>
                        <tr>
                            <td style="font-size: 11px; padding: 3px 5px;">شماره تلفن/نمابر:</td><td colspan="3" style="font-size: 11px; padding: 3px 5px;">-</td>
                        </tr>
                    </table>
                    <div style="text-align: center; font-size: 12px; font-weight: bold; background: #e5e7eb; padding: 2px; border-bottom: 1px solid #000;">مشخصات خریدار</div>
                    <table style="border-bottom: 1px solid #000;">
                        <tr>
                            <td style="width: 20%; font-size: 11px; padding: 3px 5px;">نام شخص حقیقی/حقوقی:</td><td style="width: 30%; font-size: 11px; font-weight: bold; padding: 3px 5px;">${h.hesabName || '-'}</td>
                            <td style="width: 20%; font-size: 11px; padding: 3px 5px;">شماره اقتصادی:</td><td style="width: 30%; font-size: 11px; padding: 3px 5px;">${h.economicCode || '-'}</td>
                        </tr>
                        <tr>
                            <td style="font-size: 11px; padding: 3px 5px;">شماره ثبت/شماره ملی:</td><td style="font-size: 11px; padding: 3px 5px;">${h.nationalCode || '-'}</td>
                            <td style="font-size: 11px; padding: 3px 5px;">کدپستی:</td><td style="font-size: 11px; padding: 3px 5px;">${h.postalCode || '-'}</td>
                        </tr>
                        <tr>
                            <td style="font-size: 11px; padding: 3px 5px;">استان:</td><td style="font-size: 11px; padding: 3px 5px;">${h.stateName || '-'}</td>
                            <td style="font-size: 11px; padding: 3px 5px;">شهر:</td><td style="font-size: 11px; padding: 3px 5px;">${h.cityName1 || '-'}</td>
                        </tr>
                        <tr>
                            <td style="font-size: 11px; padding: 3px 5px;">شماره تلفن/نمابر:</td><td colspan="3" style="font-size: 11px; padding: 3px 5px;">${h.phone || h.mobile || '-'}</td>
                        </tr>
                    </table>
                    <table class="print-table" style="border: none;">
                        <thead>
                            <tr>
                                <th style="width: 3%;">ردیف</th><th style="width: 8%;">کد کالا</th><th style="width: 27%;">شرح کالا</th><th style="width: 6%;">مقدار</th><th style="width: 7%;">واحد اندازه‌گیری</th>
                                <th style="width: 10%;">قیمت واحد (ریال)</th><th style="width: 10%;">مبلغ کل (ریال)</th><th style="width: 8%;">مبلغ تخفیف</th><th style="width: 10%;">جمع مالیات و عوارض</th><th style="width: 11%;">جمع مبلغ کل (ریال)</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows.join('')}</tbody>
                        <tfoot>
                            <tr style="font-weight:bold; background:#f0f0f0; height: 25px;">
                                <td colspan="6" class="text-left" style="padding-right:10px;">جمع کل:</td><td class="num text-center">${H.fmt(detail.totalCostItem)}</td>
                                <td class="num text-center">${H.fmt(detail.totalDiscount)}</td><td class="num text-center">${H.fmt(detail.totalTax)}</td><td class="num text-center">${H.fmt(totalFinal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <table style="border-top: 1px solid #000; border-bottom: 1px solid #000;">
                        <tr>
                            <td style="width: 15%; font-size: 11px; font-weight: bold; padding: 3px 5px;">جمع کل به حروف:</td><td colspan="3" style="text-align: right; font-size: 11px; font-weight: bold; padding: 3px 5px;">${H.toPersianWords(totalFinal)}</td>
                        </tr>
                        <tr>
                            <td style="font-size: 11px; padding: 3px 5px;">شرایط و نحوه فروش:</td>
                            <td style="font-size: 11px; padding: 3px 5px;" colspan="3">
                                نقدی <span style="display:inline-flex; width:14px; height:14px; border:1px solid #000; vertical-align:middle; align-items:center; justify-content:center; margin: 0 5px; font-weight:bold; font-size:14px; line-height:1;">${isCash ? '✓' : ''}</span>
                                &nbsp;&nbsp;&nbsp;
                                غیرنقدی <span style="display:inline-flex; width:14px; height:14px; border:1px solid #000; vertical-align:middle; align-items:center; justify-content:center; margin: 0 5px; font-weight:bold; font-size:14px; line-height:1;">${isNonCash ? '✓' : ''}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="font-size: 11px; padding: 3px 5px;">توضیحات:</td><td colspan="3" style="font-size: 11px; padding: 3px 5px;">${h.descript || '-'}</td>
                        </tr>
                    </table>
                    <div style="display: flex; height: 70px;">
                        <div style="width: 50%; border-left: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">مهر و امضاء فروشنده</div>
                        <div style="width: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">مهر و امضاء خریدار</div>
                    </div>
                </div>
                <div style="text-align: left; font-size: 10px; margin-top: 5px;">نسخه اول (خریدار) - نسخه دوم (حسابداری) - نسخه سوم (انبارداری)</div>
            `;
        }
        else if (type === 'normal-horizontal-2') {
            const minRows = 7;
            const tableRows = items.map((it, i) => `
                <tr>
                    <td class="text-center">${i + 1}</td><td class="num text-center">${it.articleCode || ''}</td><td class="text-right">${it.articleName || ''}</td>
                    <td class="num text-center">${H.fmt(it.articleCount)}</td><td class="num text-center">${H.fmt(it.cost)}</td><td class="num text-center">${H.fmt(it.costItem)}</td>
                    <td class="num text-center">${H.fmt(it.discount)}</td><td class="num text-center">${it.perDiscount || 0}%</td><td class="num text-center">${H.fmt(it.finallCost)}</td>
                </tr>
            `);
            for (let i = items.length; i < minRows; i++) {
                tableRows.push(`<tr style="height: 25px;"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`);
            }

            contentHtml = `
                <div style="border: 2px solid #000; padding: 10px; background:#fff;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">
                        <div style="text-align: left;"><div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">شماره فاکتور: ${h.noFactor || '-'}</div><div style="font-size: 14px; font-weight: bold;">تاریخ: ${h.dateIn || '-'}</div></div>
                        <div style="text-align: center; display:flex; align-items:center; gap: 15px;">
                            <div style="width:60px; height:60px; background:#e2e8f0; border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:24px; font-weight:bold;">آ</div>
                            <div><div style="font-size: 18px; font-weight: bold;">گروه نرم افزاری آریانا</div><div style="font-size: 16px; font-weight: bold; color: #333;">صورت حساب فروش</div></div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
                        <div><b>جای نام آقای / شرکت:</b> ${h.hesabName || '-'}</div><div><b>تلفن:</b> ${h.phone || h.mobile || '-'}</div>
                    </div>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th style="width: 5%;">#</th><th style="width: 10%;">کد کالا</th><th style="width: 30%;">شرح کالا</th><th style="width: 8%;">مقدار</th>
                                <th style="width: 12%;">قیمت واحد (ریال)</th><th style="width: 12%;">مبلغ کل (ریال)</th><th style="width: 8%;">تخفیف</th><th style="width: 8%;">درصد تخفیف</th><th style="width: 12%;">قیمت کل (ریال)</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows.join('')}</tbody>
                        <tfoot>
                            <tr style="font-weight:bold; background:#f0f0f0;">
                                <td colspan="5" class="text-left" style="padding-right:10px;">جمع کل:</td><td class="num text-center">${H.fmt(detail.totalCostItem)}</td>
                                <td class="num text-center">${H.fmt(detail.totalDiscount)}</td><td></td><td class="num text-center">${H.fmt(totalFinal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div style="display: flex; border: 1px solid #000; border-top: none; margin-top: -1px;">
                        <div style="width: 50%; border-left: 1px solid #000; padding: 8px;">
                            <div style="font-size: 12px; font-weight: bold; margin-bottom: 10px;">مبلغ به حروف:</div><div style="font-size: 12px; margin-bottom: 10px;">${H.toPersianWords(totalFinal)}</div>
                            <div style="font-size: 12px; display:flex; align-items:center; gap:10px;">
                                <span>شرایط و نحوه فروش:</span><span>نقدی</span>
                                <span style="display:inline-flex; width:16px; height:16px; border:1px solid #000; align-items:center; justify-content:center; font-weight:bold;">${isCash ? '✓' : ''}</span>
                                <span>غیرنقدی</span>
                                <span style="display:inline-flex; width:16px; height:16px; border:1px solid #000; align-items:center; justify-content:center; font-weight:bold;">${isNonCash ? '✓' : ''}</span>
                            </div>
                        </div>
                        <div style="width: 50%; padding: 8px;">
                            <div style="font-size: 12px; font-weight: bold; margin-bottom: 10px;">جمع کل به حروف:</div><div style="font-size: 12px; margin-bottom: 10px;">${H.toPersianWords(totalFinal)}</div>
                            <div style="font-size: 13px; font-weight: bold;">جمع کل: ${H.fmt(totalFinal)} ریال</div>
                        </div>
                    </div>
                    <div style="display: flex; margin-top: 15px;">
                        <div style="width: 50%; height: 80px; border: 1px solid #000; margin-left: 10px; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; font-size: 12px; font-weight: bold;">مهر و امضاء فروشنده</div>
                        <div style="width: 50%; height: 80px; border: 1px solid #000; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; font-size: 12px; font-weight: bold;">مهر و امضاء خریدار</div>
                    </div>
                </div>
            `;
        }
        else if (type === 'normal-horizontal-1') {
            const minRows = 9;
            const tableRows = items.map((it, i) => `
                <tr>
                    <td class="text-center">${i + 1}</td><td>${it.articleName}</td><td class="num text-center">${H.fmt(it.articleCount)}</td><td class="text-center">${it.articleUnitName}</td>
                    <td class="num text-center">${it.articleCode}</td><td class="num text-left">${H.fmt(it.cost)}</td><td class="num text-left">${H.fmt(it.costItem)}</td>
                    <td class="num text-left">${H.fmt(it.discount)}</td><td class="num text-center">${it.perDiscount || 0}%</td><td class="num text-left">${H.fmt(it.finallCost)}</td>
                </tr>
            `);
            for (let i = items.length; i < minRows; i++) {
                tableRows.push(`<tr style="height: 24px;"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`);
            }
            contentHtml = `
                <div style="border: 2px solid #000; padding: 10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">
                        <div style="font-size: 20px; font-weight: bold;">صورتحساب فروش کالا</div>
                        <div><div><b>شماره فاکتور:</b> ${h.noFactor}</div><div><b>تاریخ:</b> ${h.dateIn}</div></div>
                    </div>
                    <table style="border: 1px solid #000; margin-bottom: 10px;">
                        <tr><td style="width:15%; background:#f0f0f0; font-weight:bold; border-left:1px solid #000; padding:5px;">مشخصات فروشنده</td><td style="padding:5px;"><b>نام حقیقی/حقوقی:</b> گروه نرم افزاری آریانا &nbsp;&nbsp;|&nbsp;&nbsp; <b>شماره اقتصادی:</b> - &nbsp;&nbsp;|&nbsp;&nbsp; <b>شماره ثبت/ملی:</b> -</td></tr>
                        <tr><td style="background:#f0f0f0; font-weight:bold; border-left:1px solid #000; border-top:1px solid #000; padding:5px;">مشخصات خریدار</td><td style="padding:5px; border-top:1px solid #000;"><b>نام حقیقی/حقوقی:</b> ${h.hesabName || '-'} &nbsp;&nbsp;|&nbsp;&nbsp; <b>شماره اقتصادی:</b> ${h.economicCode || '-'} &nbsp;&nbsp;|&nbsp;&nbsp; <b>شماره ثبت/ملی:</b> ${h.nationalCode || '-'}</td></tr>
                    </table>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th style="width:3%;">ردیف</th><th style="width:25%;">شرح کالا و خدمات</th><th style="width:6%;">مقدار</th><th style="width:6%;">واحد</th><th style="width:8%;">کد کالا</th>
                                <th style="width:10%;">قیمت واحد (ریال)</th><th style="width:10%;">مبلغ کل (ریال)</th><th style="width:8%;">تخفیف</th><th style="width:6%;">درصد تخفیف</th><th style="width:10%;">قیمت کل (ریال)</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows.join('')}</tbody>
                        <tfoot><tr style="font-weight:bold;"><td colspan="6" class="text-center">جمع کل:</td><td class="num text-left">${H.fmt(detail.totalCostItem)}</td><td class="num text-left">${H.fmt(detail.totalDiscount)}</td><td></td><td class="num text-left">${H.fmt(totalFinal)}</td></tr></tfoot>
                    </table>
                    <div style="border: 1px solid #000; padding: 8px; margin-top: -1px; font-weight: bold;">مبلغ به حروف: ${H.toPersianWords(totalFinal)}</div>
                    <div style="margin-top: 10px; font-size: 12px;">شرایط و نحوه فروش: نقدی <span style="display:inline-flex; width:14px; height:14px; border:1px solid #000; vertical-align:middle; align-items:center; justify-content:center; margin: 0 5px; font-weight:bold; font-size:14px; line-height:1;">${isCash ? '✓' : ''}</span> غیرنقدی <span style="display:inline-flex; width:14px; height:14px; border:1px solid #000; vertical-align:middle; align-items:center; justify-content:center; margin: 0 5px; font-weight:bold; font-size:14px; line-height:1;">${isNonCash ? '✓' : ''}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-top: 20px; text-align: center;"><div style="width: 30%;"><b>مهر و امضاء فروشنده</b><br><br><br></div><div style="width: 30%;"><b>مهر و امضاء خریدار</b><br><br><br></div></div>
                </div>
            `;
        }
        else if (type === 'normal-modern') {
            contentHtml = `
                <div style="background:#f1f5f9; border-radius: 15px 15px 0 0; padding: 20px; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-size: 22px; font-weight: bold; color: #1e293b;">فاکتور فروش کالا</div><div style="color: #64748b; margin-top: 5px;">شماره: ${h.noFactor}</div></div><div class="text-left"><div style="font-size: 16px; font-weight: bold; color: #1e293b;">گروه نرم افزاری آریانا</div><div style="color: #64748b; margin-top: 5px;">تاریخ: ${h.dateIn}</div></div></div>
                <div style="padding: 15px 0; border-bottom: 2px solid #f1f5f9;"><table style="width:100%;"><tr><td style="width: 15%; color:#64748b;">خریدار:</td><td style="font-weight:bold;">${h.hesabName}</td><td style="width: 15%; color:#64748b;">تلفن:</td><td>${h.phone || h.mobile || '-'}</td></tr></table></div>
                <table style="margin-top: 15px;"><thead><tr style="border-bottom: 2px solid #1e293b;"><th class="text-center" style="padding:8px; width:5%;">#</th><th class="text-right" style="padding:8px;">شرح</th><th class="text-center" style="padding:8px; width:10%;">مقدار</th><th class="text-left" style="padding:8px; width:15%;">قیمت واحد</th><th class="text-left" style="padding:8px; width:15%;">مبلغ</th></tr></thead><tbody>${items.map((it, i) => `<tr style="border-bottom: 1px solid #e2e8f0;"><td class="text-center" style="padding:8px;">${i + 1}</td><td style="padding:8px;">${it.articleName}</td><td class="text-center" style="padding:8px;">${H.fmt(it.articleCount)}</td><td class="num text-left" style="padding:8px;">${H.fmt(it.cost)}</td><td class="num text-left" style="padding:8px;">${H.fmt(it.finallCost)}</td></tr>`).join('')}</tbody></table>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 20px; border-top: 2px solid #1e293b; padding-top: 10px;"><div style="font-size: 14px; font-weight: bold; color: #1e293b;">مبلغ نهایی: ${H.fmt(totalFinal)} ریال</div><div style="font-size: 12px; color: #64748b;">${H.toPersianWords(totalFinal)}</div></div>
                <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px;">با تشکر از خرید شما</div>
            `;
        }
        else if (type === 'thermal-receipt') {
            contentHtml = `
                <div class="text-center bold" style="font-size: 16px; margin-bottom: 5px;">${h.factorKindTitle}</div>
                <div class="text-center" style="border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;">شماره: ${h.noFactor} | تاریخ: ${h.dateIn}</div>
                <div style="margin-bottom: 5px;">خریدار: ${h.hesabName}</div>
                <table style="width: 100%; font-size: 11px; margin-bottom: 5px;"><tr style="border-bottom: 1px dashed #000;"><th class="text-right">شرح</th><th class="text-center">تعداد</th><th class="text-left">مبلغ</th></tr>${items.map(it => `<tr><td>${it.articleName}</td><td class="text-center">${it.articleCount}</td><td class="num text-left">${H.fmt(it.finallCost)}</td></tr>`).join('')}</table>
                <div style="border-top: 1px dashed #000; padding-top: 5px;"><div class="bold text-left">جمع کل: ${H.fmt(totalFinal)} ریال</div><div class="text-center" style="margin-top: 10px; font-size: 10px;">با تشکر از خرید شما</div></div>
            `;
        }
        else if (type === 'thermal-minimal') {
            contentHtml = `
                <div class="text-center bold">${h.factorKindTitle}</div><div class="text-center">تاریخ: ${h.dateIn}</div><hr style="border-top: 1px dashed #000;">
                ${items.map(it => `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;"><span>${it.articleName}</span><span class="num">${H.fmt(it.finallCost)}</span></div>`).join('')}
                <hr style="border-top: 1px dashed #000;"><div class="bold" style="font-size: 14px; display:flex; justify-content:space-between;"><span>جمع کل:</span><span class="num">${H.fmt(totalFinal)}</span></div>
            `;
        }
        else if (type === 'normal-a4') {
            contentHtml = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;"><div><h1 style="margin: 0; font-size: 24px;">${h.factorKindTitle}</h1><div>شماره: ${h.noFactor}</div></div><div class="text-left"><div>تاریخ: ${h.dateIn}</div><div>طرف حساب: <b>${h.hesabName}</b></div></div></div>
                <table class="print-table"><thead><tr><th>#</th><th>شرح کالا</th><th>تعداد</th><th>قیمت واحد</th><th>مبلغ کل</th></tr></thead><tbody>${items.map((it, i) => `<tr><td class="text-center">${i + 1}</td><td>${it.articleName}</td><td class="text-center">${H.fmt(it.articleCount)}</td><td class="num text-left">${H.fmt(it.cost)}</td><td class="num text-left">${H.fmt(it.finallCost)}</td></tr>`).join('')}</tbody></table>
                <div style="margin-top: 20px; text-align: left;"><div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">مبلغ کل: ${H.fmt(totalFinal)} ریال</div><div style="font-size: 12px; color: #555;">${H.toPersianWords(totalFinal)}</div></div>
            `;
        }
        else if (type === 'normal-compact') {
            contentHtml = `
                <div style="font-size: 14px; border: 1px solid #000; padding: 10px;">
                    <div class="text-center bold" style="margin-bottom: 10px;">${h.factorKindTitle} | شماره: ${h.noFactor} | تاریخ: ${h.dateIn}</div>
                    <div style="margin-bottom: 5px;">طرف حساب: ${h.hesabName}</div>
                    <table class="print-table" style="font-size: 11px;"><thead><tr><th>شرح</th><th>تعداد</th><th>مبلغ</th></tr></thead><tbody>${items.map(it => `<tr><td>${it.articleName}</td><td class="text-center">${H.fmt(it.articleCount)}</td><td class="num text-left">${H.fmt(it.finallCost)}</td></tr>`).join('')}</tbody></table>
                    <div class="bold text-left" style="margin-top: 10px;">جمع: ${H.fmt(totalFinal)} ریال</div>
                </div>
            `;
        }

        return contentHtml;
    }

 
  
    // ═══════════════════════════════════════════
    //  ساخت HTML برای چاپ وب (استفاده از Exporter)
    // ═══════════════════════════════════════════
    function buildWebPrintHtml(h, items, detail) {
        const rows = items.map((it, idx) => `
            <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="num">${it.articleCode || ''}</td>
                <td>${H.esc(it.articleName || '')}</td>
                <td>${H.esc(it.articleUnitName || '')}</td>
                <td class="num text-left">${H.fmt(it.articleCount)}</td>
                <td class="num text-left">${H.fmt(it.cost)}</td>
                <td class="num text-left">${H.fmt(it.costItem)}</td>
                <td class="num text-center">${it.perDiscount > 0 ? H.fmt(it.perDiscount) + '%' : '-'}</td>
                <td class="num text-left">${H.fmt(it.discount)}</td>
                <td class="num text-center">${it.taxFi > 0 ? H.fmt(it.taxFi) + '%' : '-'}</td>
                <td class="num text-left">${H.fmt(it.tax)}</td>
                <td class="num text-left">${H.fmt(it.transCost)}</td>
                <td class="num text-left">${H.fmt(it.finallCost)}</td>
            </tr>
        `).join('');

        // ⭐ تشخیص کاملاً ضد خطا (پشتیبانی از عدد 1، رشته "1" و حتی مقدار خالی)
        const isCash = (h.isCash == 1 || h.isCash === '1' || h.isCash === null || h.isCash === undefined);
        const isNonCash = (h.isCash == 2 || h.isCash === '2');

        return `
            <table class="factor-info-table" style="margin-bottom:10px; width:100%; border-collapse:collapse; border:1px solid #ccc;">
                <tr>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc; width:12%;">شماره فاکتور:</td><td style="padding:6px; border:1px solid #ccc; width:13%;">${h.noFactor || '-'}</td>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc; width:12%;">تاریخ:</td><td style="padding:6px; border:1px solid #ccc; width:13%;">${H.esc(h.dateIn || '-')}</td>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc; width:12%;">نوع:</td><td style="padding:6px; border:1px solid #ccc; width:13%;">${H.esc(h.factorKindTitle || '-')}</td>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc; width:12%;">شماره سند:</td><td style="padding:6px; border:1px solid #ccc; width:13%;">${h.noSanad || '-'}</td>
                </tr>
            </table>
            <table class="factor-info-table" style="margin-bottom:10px; width:100%; border-collapse:collapse; border:1px solid #ccc;">
                <tr>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc; width:12%;">نام:</td><td style="padding:6px; border:1px solid #ccc; width:38%;">${H.esc(h.hesabName || '-')}</td>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc; width:12%;">کد تفصیلی:</td><td style="padding:6px; border:1px solid #ccc; width:13%;">${h.codeTafzil || '-'}</td>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc; width:12%;">تلفن:</td><td style="padding:6px; border:1px solid #ccc; width:13%;">${H.esc(h.phone || '-')}</td>
                </tr>
                <tr>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc;">کد اقتصادی:</td><td style="padding:6px; border:1px solid #ccc;">${H.esc(h.economicCode || '-')}</td>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc;">کد ملی:</td><td style="padding:6px; border:1px solid #ccc;">${H.esc(h.nationalCode || '-')}</td>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc;">کد پستی:</td><td style="padding:6px; border:1px solid #ccc;">${H.esc(h.postalCode || '-')}</td>
                </tr>
                <tr>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc;">آدرس:</td><td colspan="5" style="padding:6px; border:1px solid #ccc;">${H.esc(h.address || '-')}</td>
                </tr>
                <tr>
                    <td class="label" style="padding:6px; background:#f9f9f9; border:1px solid #ccc;">نحوه فروش:</td>
                    <td colspan="5" style="padding:6px; border:1px solid #ccc;">
                        نقدی <span style="display:inline-flex; width:14px; height:14px; border:1px solid #000; vertical-align:middle; align-items:center; justify-content:center; margin: 0 5px; font-weight:bold;">${isCash ? '✓' : ''}</span>
                        &nbsp;&nbsp;&nbsp;
                        غیرنقدی <span style="display:inline-flex; width:14px; height:14px; border:1px solid #000; vertical-align:middle; align-items:center; justify-content:center; margin: 0 5px; font-weight:bold;">${isNonCash ? '✓' : ''}</span>
                    </td>
                </tr>
            </table>
            <div class="table-wrapper">
                <table style="width:100%; border-collapse:collapse; text-align:center; font-size: 12px;">
                    <thead>
                        <tr>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">#</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">کد کالا</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">نام کالا</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">واحد</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">تعداد</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">قیمت واحد</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">مبلغ کل</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">تخفیف %</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">مبلغ تخفیف</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">ارزش افزوده %</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">مبلغ مالیات</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">حمل</th>
                            <th style="background:#4F46E5 !important; color:white !important; padding:8px; border:1px solid #333;">جمع نهایی</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:bold;">
                            <td colspan="4" style="padding:8px; border:1px solid #333; text-align:center;">جمع کل</td>
                            <td style="padding:8px; border:1px solid #333; text-align:center;">${H.fmt(detail.totalRows)} ردیف</td>
                            <td colspan="3" style="padding:8px; border:1px solid #333; text-align:left;">تخفیف: ${H.fmt(detail.totalDiscount)}</td>
                            <td colspan="2" style="padding:8px; border:1px solid #333; text-align:left;">مالیات: ${H.fmt(detail.totalTax)}</td>
                            <td style="padding:8px; border:1px solid #333; text-align:left;">حمل:</td>
                            <td class="num" style="padding:8px; border:1px solid #333; text-align:left;">${H.fmt(detail.totalTransCost)}</td>
                            <td class="num" style="padding:8px; border:1px solid #333; text-align:left;">${H.fmt(detail.totalFinall)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div class="factor-totals" style="margin-top:15px; display:flex; justify-content:space-between; background:#F9FAFB; padding:12px; border:1px solid #ddd; border-radius:8px;">
                <div><strong>مبلغ کالاها:</strong> ${H.fmt(detail.totalCostItem)}</div>
                <div><strong>جمع تخفیف:</strong> ${H.fmt(detail.totalDiscount)}</div>
                <div><strong>جمع مالیات و عوارض:</strong> ${H.fmt(detail.totalTax)}</div>
                <div><strong>جمع حمل:</strong> ${H.fmt(detail.totalTransCost)}</div>
                <div style="color:#4F46E5;"><strong>مبلغ نهایی:</strong> ${H.fmt(detail.totalFinall)}</div>
            </div>
            <div style="text-align:center; margin-top:15px; font-weight:bold; color:#059669; font-size:14px;">
                ${H.toPersianWords(detail.totalFinall)}
            </div>
        `;
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return {
        render: render,
        runList: runList,
        sortBy: sortBy,
        showDetail: showDetail,
        toggleNewDropdown: toggleNewDropdown,
        createNew: createNew,
        openBulkSanadDialog: openBulkSanadDialog,
        deleteSanad: deleteSanad,
        printFactor: printFactor, 
        doPrint: doPrint ,
        printAllFactorsModal: printAllFactorsModal,
        doPrintAllFactors: doPrintAllFactors 
    };
})();

// alias
window.App.renderFactorList = window.App.Features.Factor.render;
window.App.runFactorList = window.App.Features.Factor.runList;
window.App.showFactorDetail = window.App.Features.Factor.showDetail;