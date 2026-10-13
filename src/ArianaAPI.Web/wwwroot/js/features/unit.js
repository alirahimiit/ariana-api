/* ═══════════════════════════════════════════════════
   Feature / Unit — واحدهای شمارش
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Unit = (function () {
    'use strict';

    const H = window.App.Helpers;

    let _sort = { col: 'code', dir: 'asc' };

    function sortBy(col) {
        if (_sort.col === col) _sort.dir = _sort.dir === 'asc' ? 'desc' : 'asc';
        else { _sort.col = col; _sort.dir = 'asc'; }
        runList(1);
    }
    function sortIcon(col) {
        if (_sort.col !== col) return '<span class="sort-icon-idle">⇅</span>';
        return _sort.dir === 'asc'
            ? '<span class="sort-icon-active">▲</span>'
            : '<span class="sort-icon-active">▼</span>';
    }

    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد واحد</label>
                    <input type="text" id="unCode" dir="ltr">
                </div>
                <div class="form-group">
                    <label>نام واحد</label>
                    <input type="text" id="unName">
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="unBtnRun">🔍 جستجو</button>
                </div>
            </div>
        </div>
        <div id="unResult"><div class="loading"><div class="spinner"></div></div></div>`;

        document.getElementById('unBtnRun').addEventListener('click', () => runList(1));
        ['unCode', 'unName'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') runList(1);
            });
        });

        runList(1);
    }

    async function runList(page = 1) {
        const container = document.getElementById('unResult');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const data = await window.App.Http.api('/api/unit/list', {
                method: 'POST',
                body: JSON.stringify({
                    code: document.getElementById('unCode')?.value || null,
                    name: document.getElementById('unName')?.value || null,
                    sortColumn: _sort.col,
                    sortDir: _sort.dir,
                    page: page,
                    pageSize: window.App.state.settings.pageSize
                })
            });
            renderResult(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function renderResult(data) {
        const container = document.getElementById('unResult');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>واحدی یافت نشد</p></div>`;
            return;
        }

        const rows = items.map(t => `
        <tr>
            <td class="num text-center">${H.fmt(t.code)}</td>
            <td>${H.esc(t.name || '')}</td>
            <td class="num text-center" dir="ltr">${t.tabileUnit != null ? H.fmt(t.tabileUnit) : '—'}</td>
            <td class="num text-center" dir="ltr">${t.taxId != null ? H.fmt(t.taxId) : '—'}</td>
            <td class="num text-center">${H.fmt(t.articleCount)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-ghost"
                        onclick="App.Features.Unit.showDetail(${t.id})" title="مشاهده">👁️</button>
                <button class="btn btn-sm btn-ghost" data-permission="227"
                        onclick="App.Features.UnitForm.openEdit(${t.id})" title="ویرایش">✏️</button>
                <button class="btn btn-sm btn-ghost" data-permission="228"
                        onclick="App.Features.UnitForm.delete(${t.id})"
                        title="حذف" style="color:var(--danger);">🗑️</button>
            </td>
        </tr>`).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>📏 لیست واحدها (${H.fmt(totalCount)})</span>
                    <button class="btn btn-primary btn-sm" data-permission="226"
                            onclick="App.Features.UnitForm.openCreate()">
                        ➕ واحد جدید
                    </button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="sortable-th" data-nosort style="width:80px;" onclick="App.Features.Unit.sortBy('code')">
                                    کد ${sortIcon('code')}
                                </th>
                                <th class="sortable-th" data-nosort onclick="App.Features.Unit.sortBy('name')">
                                    نام ${sortIcon('name')}
                                </th>
                                <th class="sortable-th" data-nosort style="width:110px;" onclick="App.Features.Unit.sortBy('tabileunit')">
                                    ضریب تبدیل ${sortIcon('tabileunit')}
                                </th>
                                <th style="width:120px;">کد مالیاتی</th>
                                <th style="width:100px;">تعداد کالا</th>
                                <th style="width:130px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                ${buildPagination(page, totalPages, totalCount, items.length)}
            </div>`;

        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(container);
        window.App.enhanceTables(container);
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        if (totalPages <= 1) {
            return `<div class="pagination-bar"><div class="pagination-info">مجموع: ${H.fmt(totalCount)} واحد</div></div>`;
        }
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);
        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.Unit.runList(${p})">${p}</button>`;
        }
        return `
            <div class="pagination-bar">
                <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} واحد</div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Unit.runList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Unit.runList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Unit.runList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Unit.runList(${totalPages})">»</button>
                </div>
            </div>`;
    }

    async function showDetail(id) {
        window.App.openModal('جزئیات واحد',
            `<div class="loading"><div class="spinner"></div></div>`);
        try {
            const d = await window.App.Http.api(`/api/unit/${id}`);
            document.getElementById('modalBody').innerHTML = `
                <div class="tf-section">
                    <div class="tf-section-title">📏 مشخصات واحد</div>
                    <table class="factor-info-table">
                        <tr>
                            <td class="label">کد:</td>
                            <td>${H.fmt(d.code)}</td>
                            <td class="label">نام:</td>
                            <td colspan="3">${H.esc(d.name || '-')}</td>
                        </tr>
                        <tr>
                            <td class="label">ضریب تبدیل:</td>
                            <td>${d.tabileUnit != null ? H.fmt(d.tabileUnit) : '—'}</td>
                            <td class="label">کد مالیاتی:</td>
                            <td>${d.taxId != null ? H.fmt(d.taxId) : '—'}</td>
                            <td class="label">تعداد کالا:</td>
                            <td>${H.fmt(d.articleCount)}</td>
                        </tr>
                    </table>
                </div>`;
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    return { render, runList, showDetail, sortBy, sortIcon };
})();

window.App.renderUnitList = window.App.Features.Unit.render;