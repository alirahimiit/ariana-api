/* ═══════════════════════════════════════════════════
   Feature / ArticleGroup — گروه‌های کالا
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.ArticleGroup = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;

    let _stockTypeId = '';
    let _stockTypes = [];
    let _sort = { col: 'stocktype', dir: 'asc' };

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

        // لود انبارها
        try {
            _stockTypes = await window.App.Http.api('/api/stock-type/lookup') || [];
        } catch { _stockTypes = []; }

        const stockOptions = [{ value: '', label: 'همه انبارها' }];
        (_stockTypes || []).forEach(s => {
            stockOptions.push({ value: String(s.id), label: s.name || '' });
        });

        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد گروه</label>
                    <input type="text" id="agCode">
                </div>
                <div class="form-group">
                    <label>نام گروه</label>
                    <input type="text" id="agName">
                </div>
                <div class="form-group">
                    <label>انبار</label>
                    ${CS.html('agStock', stockOptions, '')}
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="agBtnRun">🔍 جستجو</button>
                </div>
            </div>
        </div>
        <div id="agResult"><div class="loading"><div class="spinner"></div></div></div>`;

        _stockTypeId = '';

        CS.bindAll(c, {
            agStock: v => { _stockTypeId = v; }
        });

        document.getElementById('agBtnRun').addEventListener('click', () => runList(1));
        ['agCode', 'agName'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') runList(1);
            });
        });

        runList(1);
    }

    async function runList(page = 1) {
        const container = document.getElementById('agResult');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const data = await window.App.Http.api('/api/article-group/list', {
                method: 'POST',
                body: JSON.stringify(buildPayload(page))
            });
            renderListResult(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildPayload(page, pageSizeOverride = null) {
        const sid = _stockTypeId ? parseInt(_stockTypeId) : null;
        return {
            code: document.getElementById('agCode')?.value || null,
            name: document.getElementById('agName')?.value || null,
            stockTypeId: isNaN(sid) ? null : sid,
            sortColumn: _sort.col,
            sortDir: _sort.dir,
            page: page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize
        };
    }

    function renderListResult(data) {
        const container = document.getElementById('agResult');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>گروهی یافت نشد</p></div>`;
            return;
        }

        const rows = items.map(t => `
        <tr>
            <td class="num text-center">${H.esc(t.stockTypeCode || '')}</td>
            <td>${H.esc(t.stockTypeName || '')}</td>
            <td class="num text-center">${H.fmt(t.code)}</td>
            <td>${H.esc(t.name || '')}</td>
            <td class="num text-center">${t.degree != null ? H.fmt(t.degree) : '—'}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-ghost"
                        onclick="App.Features.ArticleGroup.showDetail(${t.id})" title="مشاهده">👁️</button>
                <button class="btn btn-sm btn-ghost"
                        data-permission="224"
                        onclick="App.Features.ArticleGroupForm.openEdit(${t.id})" title="ویرایش">✏️</button>
                <button class="btn btn-sm btn-ghost"
                        data-permission="225"
                        onclick="App.Features.ArticleGroupForm.delete(${t.id})"
                        title="حذف" style="color:var(--danger);">🗑️</button>
            </td>
        </tr>`).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>🏷️ لیست گروه‌های کالا (${H.fmt(totalCount)})</span>
                    <button class="btn btn-primary btn-sm"
                            data-permission="223"
                            onclick="App.Features.ArticleGroupForm.openCreate()">
                        ➕ گروه جدید
                    </button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="sortable-th" data-nosort style="width:80px;" onclick="App.Features.ArticleGroup.sortBy('stocktype')">
                                    کد انبار ${sortIcon('stocktype')}
                                </th>
                                <th style="width:150px;">نام انبار</th>
                                <th class="sortable-th" data-nosort style="width:80px;" onclick="App.Features.ArticleGroup.sortBy('code')">
                                    کد گروه ${sortIcon('code')}
                                </th>
                                <th class="sortable-th" data-nosort onclick="App.Features.ArticleGroup.sortBy('name')">
                                    نام گروه ${sortIcon('name')}
                                </th>
                                <th class="sortable-th" data-nosort style="width:100px;" onclick="App.Features.ArticleGroup.sortBy('degree')">
                                    مقیاس ${sortIcon('degree')}
                                </th>
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
            return `<div class="pagination-bar"><div class="pagination-info">مجموع: ${H.fmt(totalCount)} گروه</div></div>`;
        }

        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.ArticleGroup.runList(${p})">${p}</button>`;
        }

        return `
            <div class="pagination-bar">
                <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} گروه</div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.ArticleGroup.runList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.ArticleGroup.runList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.ArticleGroup.runList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.ArticleGroup.runList(${totalPages})">»</button>
                </div>
            </div>`;
    }

    async function showDetail(id) {
        window.App.openModal('جزئیات گروه کالا',
            `<div class="loading"><div class="spinner"></div></div>`);
        try {
            const d = await window.App.Http.api(`/api/article-group/${id}`);
            document.getElementById('modalBody').innerHTML = `
                <div class="tf-section">
                    <div class="tf-section-title">🏷️ مشخصات گروه کالا</div>
                    <table class="factor-info-table">
                        <tr>
                            <td class="label">انبار:</td>
                            <td colspan="3">${H.esc(d.stockTypeName || '-')}</td>
                        </tr>
                        <tr>
                            <td class="label">کد گروه:</td>
                            <td>${H.fmt(d.code)}</td>
                            <td class="label">نام گروه:</td>
                            <td>${H.esc(d.name || '-')}</td>
                        </tr>
                        <tr>
                            <td class="label">مقیاس:</td>
                            <td>${d.degree != null ? H.fmt(d.degree) : '—'}</td>
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

window.App.renderArticleGroupList = window.App.Features.ArticleGroup.render;