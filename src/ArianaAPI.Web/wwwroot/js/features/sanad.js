/* ═══════════════════════════════════════════════════
   Feature / Sanad (اسناد حسابداری)
   مسئولیت: لیست، جستجو، جزئیات سند
   ═══════════════════════════════════════════════════
   وابستگی‌ها:
     - window.App.Helpers   (fmt, fmtSigned, esc)
     - window.App.Http      (api)
     - window.App.State
     - window.App.UI.FilterPanel   (بعداً — فعلاً از App.FilterPanel)
     - window.App.UI.Exporter
     - window.App.UI.Modal
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Sanad = (function () {
    'use strict';

    // ─── state محلی این feature ───
    let _filters = {};
    let _sort = { by: 'noSanad', dir: 'desc' };
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

            Exporter.attach(container, {
                table: container.querySelector('table'),
                title: 'لیست اسناد حسابداری',
                subtitle: subtitle(),
                filename: 'SanadList'
            });

           // window.App.enhanceTables(container);

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
        // ⭐ سورت
        if (_sort.by) {
            url += `&sortBy=${_sort.by}&sortDir=${_sort.dir}`;
        }
        return url;
    }

    function buildListHtml(items) {
        const pageSize = S.getSettings().pageSize;
        const page = window.App.state.sanadPage;

        const rows = items.map(s => {
            const bed = s.mabBed || 0;
            const bes = s.mabBes || 0;
            const diff = Math.abs(bed - bes);
            const isUnbalanced = diff > 0.01;

            return `
            <tr class="${isUnbalanced ? 'row-unbalanced' : ''}">
                <td class="num">${H.fmt(s.noSanad)}</td>
                <td class="num">${H.esc(s.dateIn || '-')}</td>
                <td>${H.esc(s.otherParentSharh || '-')}</td>
                <td>${window.App.statusBadge(s.vazeit)}</td>
                <td>${kindSanadText(s.kindSanad)}</td>
                <td class="num text-left">${H.fmt(s.mabBed)}</td>
                <td class="num text-left">${H.fmt(s.mabBes)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Sanad.showDetail(${s.parentSanadID})"
                            title="مشاهده">👁️</button>
                    ${s.vazeit !== 2 ? `
                        <button class="btn btn-sm btn-ghost"
                                onclick="event.stopPropagation(); App.Features.SanadForm.openEdit(${s.parentSanadID})"
                                title="ویرایش">✏️</button>
                        <button class="btn btn-sm btn-ghost"
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

        try {
            const [detail, items] = await Promise.all([
                window.App.Http.api(`/api/sanad/${sanadId}`),
                window.App.Http.api(`/api/sanad/${sanadId}/items`)
            ]);

            document.getElementById('modalBody').innerHTML = buildDetailHtml(detail, items);

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

    function buildDetailHtml(detail, items) {
        const rows = (items || []).map(it => `
            <tr>
                <td class="num text-center">${H.fmt(it.rowNum)}</td>
                <td class="num text-center">${it.code_Col ?? '-'}</td>
                <td>${H.esc(it.colName || '-')}</td>
                <td class="num text-center">${it.code_Moein || '-'}</td>
                <td>${H.esc(it.moeinName || '-')}</td>
                <td class="num text-center">${it.code_Tafzil || '-'}</td>
                <td>${H.esc(it.tafzilName || '-')}</td>
                <td>${H.esc(it.otherSharh || '-')}</td>
                <td class="num text-left">${H.fmt(it.mabBed)}</td>
                <td class="num text-left">${H.fmt(it.mabBes)}</td>
                <td class="num text-left">${H.fmtSigned(it.meghdar)}</td>
            </tr>
        `).join('');

        return `
            <div class="stats-grid" style="margin-bottom:16px;">
                <div class="stat-card">
                    <div>
                        <div class="stat-label">شماره سند</div>
                        <div class="stat-value">${H.fmt(detail?.noSanad)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">تاریخ</div>
                        <div class="stat-value">${detail?.dateIn || '-'}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">وضعیت</div>
                        <div class="stat-value">${window.App.statusBadge(detail?.vazeit)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">نوع سند</div>
                        <div class="stat-value" style="font-size:16px;">
                            ${kindSanadText(detail?.kindSanad)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:40px;">ردیف</th>
                            <th style="width:50px;">کد کل</th>
                            <th>نام کل</th>
                            <th style="width:50px;">معین</th>
                            <th>نام معین</th>
                            <th style="width:60px;">تفصیلی</th>
                            <th>نام تفصیلی</th>
                            <th>شرح</th>
                            <th class="text-left" style="width:100px;">بدهکار</th>
                            <th class="text-left" style="width:100px;">بستانکار</th>
                            <th class="text-left" style="width:80px;">مقدار</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="11" class="text-center">ردیفی وجود ندارد</td></tr>'}
                    </tbody>
                </table>
            </div>`;
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
                    <td>${kindSanadText(detail?.kindSanad)}</td>
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
    //  Helpers (محلی این feature)
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

// ⭐ به آبجکت اصلی وصل کن (تا بشه از HTML صدا زد)
window.App.Features = window.App.Features || {};
window.App.Features.Sanad = window.App.Features.Sanad;

// ⭐ alias در سطح ریشه برای سازگاری با کد فعلی
window.App.showSanadDetail = window.App.Features.Sanad.showDetail;
window.App.gotoSanadPage = window.App.Features.Sanad.gotoPage;
window.App.renderSanadList = window.App.Features.Sanad.render;
window.App.loadSanadList = window.App.Features.Sanad.loadList;