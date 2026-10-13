/* ═══════════════════════════════════════════════════
   Feature / Tafzili2 — تفضیلی‌های سطح ۲ (مستقل)
   جدول مستقل Tafzili2 — بی‌ربط به Hesab
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Tafzili2 = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;

    let _groupId = '';
    let _groupsCache = [];
    let _sort = { col: 'code', dir: 'asc' };

    // ═══ سورت سرور-محور ═══
    function sortBy(col) {
        if (_sort.col === col) {
            _sort.dir = _sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _sort.col = col;
            _sort.dir = 'asc';
        }
        runList(1);
    }

    function sortIcon(col) {
        if (_sort.col !== col) return '<span class="sort-icon-idle">⇅</span>';
        return _sort.dir === 'asc'
            ? '<span class="sort-icon-active">▲</span>'
            : '<span class="sort-icon-active">▼</span>';
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        let groups = [];
        try {
            groups = await window.App.Http.api('/api/tafzili/groups') || [];
            _groupsCache = groups;
        } catch (err) {
            console.error('Failed to load groups:', err);
        }

        const groupOptions = [{ value: '', label: 'همه گروه‌ها' }];
        (groups || []).forEach(g => {
            groupOptions.push({ value: String(g.id), label: g.name || '' });
        });

        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد تفضیلی ۲</label>
                    <input type="text" id="t2Code">
                </div>
                <div class="form-group">
                    <label>نام</label>
                    <input type="text" id="t2Name">
                </div>
                <div class="form-group">
                    <label>گروه تفضیلی</label>
                    ${CS.html('t2Group', groupOptions, '')}
                </div>
                <div class="form-group">
                    <label>موبایل</label>
                    <input type="text" id="t2Mobile">
                </div>
                <div class="form-group">
                    <label>کد ملی</label>
                    <input type="text" id="t2MelliCode">
                </div>
                <div class="form-group">
                    <label>کد اقتصادی</label>
                    <input type="text" id="t2EconomicCode">
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="t2BtnRun">🔍 جستجو</button>
                </div>
            </div>
        </div>
        <div id="t2Result">
            <div class="loading"><div class="spinner"></div></div>
        </div>`;

        _groupId = '';

        CS.bindAll(c, {
            t2Group: function (v) { _groupId = v; }
        });

        document.getElementById('t2BtnRun').addEventListener('click', () => runList(1));

        ['t2Code', 't2Name', 't2Mobile', 't2MelliCode', 't2EconomicCode'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') runList(1);
            });
        });

        runList(1);
    }

    // ═══════════════════════════════════════════
    //  RUN
    // ═══════════════════════════════════════════
    async function runList(page = 1) {
        const container = document.getElementById('t2Result');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const data = await window.App.Http.api('/api/tafzili2/list', {
                method: 'POST',
                body: JSON.stringify(buildPayload(page))
            });
            renderListResult(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildPayload(page, pageSizeOverride = null) {
        const parseLongOrNull = v => {
            if (!v) return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        };

        return {
            code: document.getElementById('t2Code')?.value || null,
            name: document.getElementById('t2Name')?.value || null,
            tafziliGroupCode: parseLongOrNull(_groupId),
            mobile: document.getElementById('t2Mobile')?.value || null,
            melliCode: document.getElementById('t2MelliCode')?.value || null,
            economicCode: document.getElementById('t2EconomicCode')?.value || null,
            sortColumn: _sort.col,
            sortDir: _sort.dir,
            page: page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize
        };
    }

    function renderListResult(data) {
        const container = document.getElementById('t2Result');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>تفضیلی ۲ای یافت نشد</p>
                </div>`;
            return;
        }

        const rows = items.map(t => `
        <tr>
            <td class="num text-center">${H.fmt(t.code) || ''}</td>
            <td>${H.esc(t.name || '')}</td>
            <td>${H.esc(t.tafziliGroupName || '-')}</td>
            <td class="num text-center">${H.esc(t.mobile || '-')}</td>
            <td class="num text-center">${H.esc(t.melliCode || '-')}</td>
            <td class="num text-center">${H.esc(t.economicCode || '-')}</td>
            <td class="text-center">
                ${t.isSaleMan ? '<span class="badge badge-success">✓</span>' : '<span class="badge badge-gray">—</span>'}
            </td>
            <td class="text-center">
                ${t.isStock ? '<span class="badge badge-warning">✓</span>' : '<span class="badge badge-gray">—</span>'}
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-ghost"
                        onclick="App.Features.Tafzili2.showDetail(${t.id})"
                        title="مشاهده">👁️</button>
                <button class="btn btn-sm btn-ghost"
                        data-permission="197"
                        onclick="App.Features.Tafzili2Form.openEdit(${t.id})"
                        title="ویرایش">✏️</button>
                <button class="btn btn-sm btn-ghost"
                        data-permission="198"
                        onclick="App.Features.Tafzili2Form.delete(${t.id})"
                        title="حذف" style="color:var(--danger);">🗑️</button>
            </td>
        </tr>`).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        container.innerHTML = `
            <div class="card">
              <div class="card-title">
                    <span>👥 لیست تفضیلی ۲ (${H.fmt(totalCount)})</span>
                    <button class="btn btn-primary btn-sm"
                            data-permission="196"
                            onclick="App.Features.Tafzili2Form.openCreate()">
                        ➕ تفضیلی ۲ جدید
                    </button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="sortable-th" data-nosort style="width:80px;" onclick="App.Features.Tafzili2.sortBy('code')">
                                    کد ${sortIcon('code')}
                                </th>
                                <th class="sortable-th" data-nosort onclick="App.Features.Tafzili2.sortBy('name')">
                                    نام ${sortIcon('name')}
                                </th>
                                <th class="sortable-th" data-nosort style="width:130px;" onclick="App.Features.Tafzili2.sortBy('tafziliGroupName')">
                                    گروه تفضیلی ${sortIcon('tafziliGroupName')}
                                </th>
                                <th class="sortable-th" data-nosort style="width:110px;" onclick="App.Features.Tafzili2.sortBy('mobile')">
                                    موبایل ${sortIcon('mobile')}
                                </th>
                                <th class="sortable-th" data-nosort style="width:110px;" onclick="App.Features.Tafzili2.sortBy('melliCode')">
                                    کد ملی ${sortIcon('melliCode')}
                                </th>
                                <th class="sortable-th" data-nosort style="width:120px;" onclick="App.Features.Tafzili2.sortBy('economicCode')">
                                    کد اقتصادی ${sortIcon('economicCode')}
                                </th>
                                <th style="width:70px;">فروشنده</th>
                                <th style="width:70px;">انبار</th>
                                <th style="width:130px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                ${buildPagination(page, totalPages, totalCount, items.length)}
            </div>`;

        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(container);
        }

        window.App.enhanceTables(container);
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        if (totalPages <= 1) {
            return `
                <div class="pagination-bar">
                    <div class="pagination-info">مجموع: ${H.fmt(totalCount)} تفضیلی ۲</div>
                </div>`;
        }

        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.Tafzili2.runList(${p})">${p}</button>`;
        }

        return `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} تفضیلی ۲
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Tafzili2.runList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Tafzili2.runList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Tafzili2.runList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Tafzili2.runList(${totalPages})">»</button>
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  SHOW DETAIL
    // ═══════════════════════════════════════════
    async function showDetail(id) {
        window.App.openModal('جزئیات تفضیلی ۲',
            `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const d = await window.App.Http.api(`/api/tafzili2/${id}`);
            document.getElementById('modalBody').innerHTML = buildDetailHtml(d);
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildDetailHtml(d) {
        return `
            <div class="tf-section">
                <div class="tf-section-title">📋 اطلاعات پایه</div>
                <table class="factor-info-table">
                    <tr>
                        <td class="label">کد:</td>
                        <td>${H.fmt(d.code) || '-'}</td>
                        <td class="label">نام:</td>
                        <td colspan="3">${H.esc(d.name || '-')}</td>
                    </tr>
                    <tr>
                        <td class="label">گروه تفضیلی:</td>
                        <td colspan="5">
                            ${d.tafziliGroupName
                ? `<span class="badge badge-info">${H.esc(d.tafziliGroupName)}</span>`
                : '<span class="badge badge-gray">بدون گروه</span>'}
                        </td>
                    </tr>
                </table>
            </div>

            <div class="tf-section">
                <div class="tf-section-title">📞 اطلاعات تماس</div>
                <table class="factor-info-table">
                    <tr>
                        <td class="label">تلفن:</td>
                        <td>${H.esc(d.phone || '-')}</td>
                        <td class="label">موبایل:</td>
                        <td>${H.esc(d.mobile || '-')}</td>
                        <td class="label">کد پستی:</td>
                        <td>${H.esc(d.postalCode || '-')}</td>
                    </tr>
                    <tr>
                        <td class="label">استان:</td>
                        <td>${H.esc(d.stateName || '-')}</td>
                        <td class="label">شهرستان:</td>
                        <td>${H.esc(d.cityName1 || '-')}</td>
                        <td class="label">شهر:</td>
                        <td>${H.esc(d.cityName2 || '-')}</td>
                    </tr>
                    <tr>
                        <td class="label">آدرس:</td>
                        <td colspan="5">${H.esc(d.address || '-')}</td>
                    </tr>
                </table>
            </div>

            <div class="tf-section">
                <div class="tf-section-title">💰 اطلاعات مالی و هویتی</div>
                <table class="factor-info-table">
                    <tr>
                        <td class="label">کد ملی:</td>
                        <td>${H.esc(d.melliCode || '-')}</td>
                        <td class="label">کد اقتصادی:</td>
                        <td>${H.esc(d.economicCode || '-')}</td>
                        <td class="label">شناسه ثبت:</td>
                        <td>${H.esc(d.nationalCode || '-')}</td>
                    </tr>
                    <tr>
                        <td class="label">فروشنده:</td>
                        <td>${d.isSaleMan ? '✅ بله' : '❌ خیر'}</td>
                        <td class="label">انبار:</td>
                        <td colspan="3">${d.isStock ? '✅ بله' : '❌ خیر'}</td>
                    </tr>
                </table>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return {
        render,
        runList,
        showDetail,
        sortBy,
        sortIcon
    };
})();

window.App.renderTafzili2List = window.App.Features.Tafzili2.render;
window.App.runTafzili2List = window.App.Features.Tafzili2.runList;