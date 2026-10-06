/* ═══════════════════════════════════════════════════
  Feature / Sanad (اسناد حسابداری)
  مسئولیت: لیست، جستجو، جزئیات سند + فیلتر خطاها
  ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Sanad = (function () {
    'use strict';

    // ─── state محلی این feature ───
    let _filters = {};
    let _sort = { by: 'noSanad', dir: 'desc' };

    // ⭐ state فیلتر خطاها در modal جزئیات
    let _detailFilter = { errorType: 'all' };
    let _detailData = { detail: null, items: [] };

    // ─── shortcut ها ───
    const H = window.App.Helpers;
    const S = window.App.State;

    function sortIcon(field) {
        if (_sort.by !== field) return '<span style="opacity:0.3;font-size:10px;">⇅</span>';
        return _sort.dir === 'asc'
            ? '<span style="color:#4F46E5;font-size:10px;">▲</span>'
            : '<span style="color:#4F46E5;font-size:10px;">▼</span>';
    }

    function sortBy(field) {
        if (_sort.by === field) {
            _sort.dir = _sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _sort.by = field;
            _sort.dir = 'asc';
        }
        window.App.state.sanadPage = 1;
        loadList();
    }

    // ═══════════════════════════════════════════
    //  RENDER — صفحه لیست
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        c.innerHTML = `
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
                loadList();
            }
        });

        _filters = FilterPanel.getValues();
        loadList();
    }

    function buildFilterSchema() {
        return [
            {
                title: 'بازه تاریخی و شماره',
                icon: '📅',
                cols: 4,
                fields: [
                    { name: 'fromDate', label: 'از تاریخ', type: 'date' },
                    { name: 'toDate', label: 'تا تاریخ', type: 'date' },
                    { name: 'noFrom', label: 'از شماره', type: 'number', placeholder: '۱' },
                    { name: 'noTo', label: 'تا شماره', type: 'number' }
                ]
            },
            {
                title: 'وضعیت و نوع',
                icon: '🏷️',
                cols: 4,
                fields: [
                    {
                        name: 'vazeit', label: 'وضعیت سند', type: 'select',
                        placeholder: 'همه',
                        options: [
                            { value: '0', label: 'پیش‌نویس' },
                            { value: '1', label: 'ثبت شده' },
                            { value: '2', label: 'تأیید شده' }
                        ]
                    },
                    {
                        name: 'kindSanad', label: 'نوع سند', type: 'select',
                        placeholder: 'همه',
                        options: [
                            { value: '0', label: 'عادی' },
                            { value: '1', label: 'افتتاحیه' },
                            { value: '2', label: 'اختتامیه' }
                        ]
                    },
                    {
                        name: 'onlyWithErrors', label: 'نمایش', type: 'select',
                        placeholder: 'همه اسناد',
                        options: [
                            { value: 'true', label: '⚠️ فقط دارای ایراد' }
                        ]
                    }
                ]
            }
        ];
    }

    // ═══════════════════════════════════════════
    //  LOAD — لیست اسناد
    // ═══════════════════════════════════════════
    async function loadList() {
        const container = document.getElementById('sanadListContainer');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const url = buildUrl();
            const data = await window.App.Http.api(url);
            const items = data || [];

            if (items.length === 0) {
                container.innerHTML = `
                    <div class="empty">
                        <div class="empty-icon">📭</div>
                        <p>سندی یافت نشد</p>
                    </div>`;
                return;
            }

            container.innerHTML = buildListHtml(items);

            if (window.App.UI.PermissionGuard) {
                window.App.UI.PermissionGuard.apply(container);
            }

            Exporter.attach(container, {
                table: container.querySelector('table'),
                title: 'لیست اسناد حسابداری',
                subtitle: subtitle(),
                filename: 'SanadList'
            });

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
        if (_sort.by) {
            url += `&sortBy=${_sort.by}&sortDir=${_sort.dir}`;
        }
        if (f.onlyWithErrors === 'true') {
            url += `&onlyWithErrors=true`;
        }

        return url;
    }

    function buildListHtml(items) {
        const pageSize = S.getSettings().pageSize;
        const page = window.App.state.sanadPage;

        const rows = items.map(s => {
            const bed = s.mabBed || 0;
            const bes = s.mabBes || 0;
            const isUnbalanced = Math.abs(bed - bes) > 0.01;
            const hasErrors = (s.totalErrorCount || 0) > 0;
            const rowClass = hasErrors ? 'row-has-errors'
                : (isUnbalanced ? 'row-unbalanced' : '');

            return `
            <tr class="${rowClass}">
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
                        ${s.vazeit !== 2 ? `
                            <button class="btn btn-sm btn-ghost"
                                    data-permission="102"
                                    onclick="event.stopPropagation(); App.Features.SanadForm.openEdit(${s.parentSanadID})"
                                    title="ویرایش">✏️</button>
                            <button class="btn btn-sm btn-ghost"
                                    data-permission="108"
                                    onclick="event.stopPropagation(); App.Features.SanadForm.delete(${s.parentSanadID})"
                                    title="حذف" style="color:var(--danger);">🗑️</button>
                        ` : ''}
                </td>
            </tr>`;
        }).join('');

        return `
            <div class="card">
                <div class="card-title">
                    <span>📄 اسناد حسابداری</span>
                    <button class="btn btn-primary btn-sm"
                        data-permission="101"
                        onclick="App.Features.SanadForm.openCreate()">
                          ➕ سند جدید
                    </button>
                </div>
                <div class="table-wrapper">
                    <table>
                      <thead>
                            <tr>
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
            </div>
            <div class="pagination">
                <button ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.Sanad.gotoPage(${page - 1})">قبلی</button>
                <span>صفحه ${page}</span>
                <button ${items.length < pageSize ? 'disabled' : ''}
                        onclick="App.Features.Sanad.gotoPage(${page + 1})">بعدی</button>
            </div>`;
    }

    function gotoPage(page) {
        if (page < 1) return;
        window.App.state.sanadPage = page;
        loadList();
    }

    // ═══════════════════════════════════════════
    //  SHOW DETAIL — modal سند
    // ═══════════════════════════════════════════
    async function showDetail(sanadId) {
        if (!sanadId) return;
        window.App.openModal('جزئیات سند',
            `<div class="loading"><div class="spinner"></div></div>`);

        _detailFilter.errorType = 'all';

        try {
            const [detail, items] = await Promise.all([
                window.App.Http.api(`/api/sanad/${sanadId}`),
                window.App.Http.api(`/api/sanad/${sanadId}/items`)
            ]);

            _detailData = { detail, items: items || [] };

            document.getElementById('modalBody').innerHTML = buildDetailHtml(detail, items);

            bindDetailFilter();

            Exporter.attach(document.getElementById('modalBody'), {
                title: 'سند حسابداری - شماره ' + (detail?.noSanad || ''),
                subtitle: subtitle(),
                filename: 'Sanad_' + (detail?.noSanad || 'detail'),
                customHtml: () => buildDetailPrintHtml(detail, items)
            });
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
    }

    // ═══════════════════════════════════════════
    //  ⭐ BUILD DETAIL HTML — ساختار جدید + جمع چسبان
    // ═══════════════════════════════════════════
    function buildDetailHtml(detail, items) {
        items = items || [];

        // ─── شمارش خطاها ───
        const errorCounts = {
            all: 0,
            missingCoding: 0,
            missingMoein: 0,
            noMeghdar: 0,
            noAmount: 0,
            noDescr: 0
        };

        const itemsWithErrors = items.map(it => {
            const errs = detectRowErrors(it);
            errs.forEach(e => {
                if (errorCounts[e.code] !== undefined) errorCounts[e.code]++;
            });
            if (errs.length > 0) errorCounts.all++;
            return Object.assign({}, it, { _errors: errs });
        });

        // ─── فیلتر ───
        const f = _detailFilter.errorType;
        const visibleItems = (f === 'all')
            ? itemsWithErrors
            : itemsWithErrors.filter(x => x._errors.some(e => e.code === f));

        // ─── کارت‌های اطلاعات بالای مدال ───
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

        // ─── نوار ابزار (فیلتر خطا + badge + راهنما) ───
        const toolbar = `
            <div class="sd-toolbar">
                <select class="sd-error-filter" id="sanadErrFilter">
                    <option value="all" ${f === 'all' ? 'selected' : ''}>
                        📋 همه ردیف‌ها (${H.fmt(itemsWithErrors.length)})
                    </option>
                    <option value="missingCoding" ${f === 'missingCoding' ? 'selected' : ''}>
                        ⛔ کدینگ ناقص (${H.fmt(errorCounts.missingCoding)})
                    </option>
                    <option value="missingMoein" ${f === 'missingMoein' ? 'selected' : ''}>
                        ⚠️ بدون معین (${H.fmt(errorCounts.missingMoein)})
                    </option>
                    <option value="noMeghdar" ${f === 'noMeghdar' ? 'selected' : ''}>
                        ⛔ مقدار خالی (${H.fmt(errorCounts.noMeghdar)})
                    </option>
                    <option value="noAmount" ${f === 'noAmount' ? 'selected' : ''}>
                        ⚠️ مبلغ صفر (${H.fmt(errorCounts.noAmount)})
                    </option>
                    <option value="noDescr" ${f === 'noDescr' ? 'selected' : ''}>
                        ℹ️ بدون شرح (${H.fmt(errorCounts.noDescr)})
                    </option>
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

        // ─── ردیف‌های جدول ───
        const rows = visibleItems.map(it => {
            const errBadges = (it._errors || []).map(e =>
                `<span class="sd-err-icon sd-err-${e.severity}" title="${H.esc(e.label)}">
                    ${e.severity === 'error' ? '⛔' : (e.severity === 'warn' ? '⚠️' : 'ℹ️')}
                </span>`
            ).join('');

            const hasError = (it._errors || []).some(e => e.severity === 'error');
            const hasWarn = (it._errors || []).some(e => e.severity === 'warn');
            const rowClass = hasError ? 'sd-row-err' : (hasWarn ? 'sd-row-warn' : '');

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

        // ⭐ جمع‌ها (روی ردیف‌های visible)
        const totalBed = visibleItems.reduce((s, x) => s + (Number(x.mabBed) || 0), 0);
        const totalBes = visibleItems.reduce((s, x) => s + (Number(x.mabBes) || 0), 0);
        const totalMegh = visibleItems.reduce((s, x) => s + (Number(x.meghdar) || 0), 0);

        // ─── جدول با tfoot چسبان ───
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
            ${infoGrid}
            ${toolbar}
            ${tableBlock}
        </div>`;
    }

    // ═══════════════════════════════════════════
    //  تشخیص خطاهای ردیف
    // ═══════════════════════════════════════════
    function detectRowErrors(it) {
        const errors = [];
        const hasBed = (it.mabBed || 0) > 0;
        const hasBes = (it.mabBes || 0) > 0;
        const hasAmount = hasBed || hasBes;

        if (!it.code_Col || it.code_Col === 0) {
            errors.push({ code: 'missingCoding', label: 'کد کل ندارد — نیاز به کدینگ', severity: 'error' });
        }

        if (it.code_Col > 0 && (!it.code_Moein || it.code_Moein === 0) && hasAmount) {
            errors.push({ code: 'missingMoein', label: 'کد معین ندارد', severity: 'warn' });
        }

        if (it.isStock && hasAmount && (!it.meghdar || Math.abs(it.meghdar) === 0)) {
            errors.push({ code: 'noMeghdar', label: 'مقدار انباری ندارد', severity: 'error' });
        }

        if (!hasAmount) {
            errors.push({ code: 'noAmount', label: 'مبلغ بدهکار و بستانکار صفر است', severity: 'warn' });
        }

        if (!it.otherSharh || !String(it.otherSharh).trim()) {
            errors.push({ code: 'noDescr', label: 'شرح ردیف خالی است', severity: 'info' });
        }

        return errors;
    }

    function bindDetailFilter() {
        const sel = document.getElementById('sanadErrFilter');
        if (!sel) return;
        sel.addEventListener('change', function () {
            _detailFilter.errorType = this.value;
            const { detail, items } = _detailData;
            document.getElementById('modalBody').innerHTML = buildDetailHtml(detail, items);
            bindDetailFilter();
        });
    }

    // ═══════════════════════════════════════════
    //  PRINT (خروجی چاپ و Excel)
    // ═══════════════════════════════════════════
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
                ${(detail?.creator || detail?.confirmer || detail?.date_Op || detail?.time_Op) ? `
                <tr>
                    <td class="label">ایجادکننده:</td>
                    <td>${detail?.creator || '-'}</td>
                    <td class="label">تأییدکننده:</td>
                    <td>${detail?.confirmer || '-'}</td>
                    <td class="label">تاریخ/ساعت ثبت:</td>
                    <td colspan="3">${H.esc(detail?.date_Op || '')} ${H.esc(detail?.time_Op || '')}</td>
                </tr>` : ''}
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

        const itemsBlock = `
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
                <tbody>
                    ${itemsRows || '<tr><td colspan="12" class="text-center">ردیفی وجود ندارد</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="8" class="text-center">جمع کل</td>
                        <td class="num text-left">${H.fmt(totalBed)}</td>
                        <td class="num text-left">${H.fmt(totalBes)}</td>
                        <td class="num text-left">${H.fmtSigned(totalMegh)}</td>
                    </tr>
                </tfoot>
            </table>`;

        return headerBlock + itemsBlock;
    }

    // ═══════════════════════════════════════════
    //  Helpers (محلی)
    // ═══════════════════════════════════════════
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
        const total = s.totalErrorCount || 0;
        if (total === 0) {
            return '<span class="sanad-list-ok" title="بدون ایراد">✅</span>';
        }

        const coding = s.codingErrorCount || 0;
        const moein = s.moeinErrorCount || 0;

        const parts = [];
        if (coding > 0) parts.push(coding + ' کدینگ ناقص');
        if (moein > 0) parts.push(moein + ' بدون معین');

        const title = 'ایرادها: ' + parts.join('، ');

        return `<span class="sanad-list-err" title="${H.esc(title)}">
                    ⚠️ ${H.fmt(total)}
                </span>`;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return {
        render,
        loadList,
        gotoPage,
        showDetail,
        buildUrl,
        sortBy
    };
})();

// ⭐ alias
window.App.Features = window.App.Features || {};
window.App.Features.Sanad = window.App.Features.Sanad;
window.App.showSanadDetail = window.App.Features.Sanad.showDetail;
window.App.gotoSanadPage = window.App.Features.Sanad.gotoPage;
window.App.renderSanadList = window.App.Features.Sanad.render;
window.App.loadSanadList = window.App.Features.Sanad.loadList;