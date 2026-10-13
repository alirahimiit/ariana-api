/* ═══════════════════════════════════════════════════
   Feature / StockType — انبارها / اموال
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.StockType = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;

    let _kind = '';
    let _forEst = '';
    let _sort = { col: 'code', dir: 'asc' };

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

    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد انبار</label>
                    <input type="text" id="stCode">
                </div>
                <div class="form-group">
                    <label>نام انبار</label>
                    <input type="text" id="stName">
                </div>
                <div class="form-group">
                    <label>ماهیت</label>
                    ${CS.html('stKind', [
            { value: '', label: 'همه' },
            { value: '0', label: 'کالا' },
            { value: '1', label: 'محصول' }
        ], '')}
                </div>
                <div class="form-group">
                    <label>استهلاک</label>
                    ${CS.html('stForEst', [
            { value: '', label: 'همه' },
            { value: 'true', label: 'دارد' },
            { value: 'false', label: 'ندارد' }
        ], '')}
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="stBtnRun">🔍 جستجو</button>
                </div>
            </div>
        </div>
        <div id="stResult"><div class="loading"><div class="spinner"></div></div></div>`;

        _kind = '';
        _forEst = '';

        CS.bindAll(c, {
            stKind: v => { _kind = v; },
            stForEst: v => { _forEst = v; }
        });

        document.getElementById('stBtnRun').addEventListener('click', () => runList(1));
        ['stCode', 'stName'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') runList(1);
            });
        });

        runList(1);
    }

    async function runList(page = 1) {
        const container = document.getElementById('stResult');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const data = await window.App.Http.api('/api/stock-type/list', {
                method: 'POST',
                body: JSON.stringify(buildPayload(page))
            });
            renderListResult(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildPayload(page, pageSizeOverride = null) {
        return {
            code: document.getElementById('stCode')?.value || null,
            name: document.getElementById('stName')?.value || null,
            kind: _kind === '' ? null : parseInt(_kind),
            forEst: _forEst === '' ? null : (_forEst === 'true'),
            sortColumn: _sort.col,
            sortDir: _sort.dir,
            page: page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize
        };
    }

    function renderListResult(data) {
        const container = document.getElementById('stResult');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>انباری یافت نشد</p></div>`;
            return;
        }

        const rows = items.map(t => {
            const coding = t.codeCol > 0
                ? `${t.codeCol}-${t.codeMoein || 0}-${t.codeTafzil || 0}`
                : '-';

            return `
            <tr>
                <td class="num text-center">${H.fmt(t.code)}</td>
                <td>${H.esc(t.name || '')}</td>
                <td class="text-center">
                    <span class="badge ${t.kind === 1 ? 'badge-info' : 'badge-gray'}">
                        ${H.esc(t.kindName || '-')}
                    </span>
                </td>
                <td class="num text-center" dir="ltr">${H.esc(coding)}</td>
                <td class="text-center">${t.forEst ? '✅' : '—'}</td>
                <td class="num text-center">${H.fmt(t.articleGroupCount)}</td>
                <td class="num text-center">${H.fmt(t.articleCount)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-ghost"
                            onclick="App.Features.StockType.showDetail(${t.id})"
                            title="مشاهده">👁️</button>
                    <button class="btn btn-sm btn-ghost"
                            data-permission="221"
                            onclick="App.Features.StockTypeForm.openEdit(${t.id})"
                            title="ویرایش">✏️</button>
                    <button class="btn btn-sm btn-ghost"
                            data-permission="222"
                            onclick="App.Features.StockTypeForm.delete(${t.id})"
                            title="حذف" style="color:var(--danger);">🗑️</button>
                </td>
            </tr>`;
        }).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>📦 لیست انبارها (${H.fmt(totalCount)})</span>
                    <button class="btn btn-primary btn-sm"
                            data-permission="220"
                            onclick="App.Features.StockTypeForm.openCreate()">
                        ➕ انبار جدید
                    </button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="sortable-th" data-nosort style="width:80px;" onclick="App.Features.StockType.sortBy('code')">
                                    کد ${sortIcon('code')}
                                </th>
                                <th class="sortable-th" data-nosort onclick="App.Features.StockType.sortBy('name')">
                                    نام ${sortIcon('name')}
                                </th>
                                <th class="sortable-th" data-nosort style="width:100px;" onclick="App.Features.StockType.sortBy('kind')">
                                    ماهیت ${sortIcon('kind')}
                                </th>
                                <th style="width:110px;">کدینگ</th>
                                <th style="width:80px;">استهلاک</th>
                                <th style="width:90px;">تعداد گروه</th>
                                <th style="width:90px;">تعداد کالا</th>
                                <th style="width:100px;"></th>
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
            return `<div class="pagination-bar"><div class="pagination-info">مجموع: ${H.fmt(totalCount)} انبار</div></div>`;
        }

        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.StockType.runList(${p})">${p}</button>`;
        }

        return `
            <div class="pagination-bar">
                <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} انبار</div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.StockType.runList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.StockType.runList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.StockType.runList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.StockType.runList(${totalPages})">»</button>
                </div>
            </div>`;
    }

    // ═══ DETAIL ═══
    async function showDetail(id) {
        window.App.openModal('جزئیات انبار',
            `<div class="loading"><div class="spinner"></div></div>`);
        try {
            const d = await window.App.Http.api(`/api/stock-type/${id}`);
            document.getElementById('modalBody').innerHTML = buildDetailHtml(d);
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildDetailHtml(d) {
        const coding = d.codeCol > 0
            ? `${d.codeCol} / ${d.codeMoein || 0} / ${d.codeTafzil || 0} / ${d.codeTafzil2 || 0}`
            : '-';

        return `
        <div class="tf-section">
            <div class="tf-section-title">📋 مشخصات انبار</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">کد:</td>
                    <td>${H.fmt(d.code) || '-'}</td>
                    <td class="label">نام:</td>
                    <td colspan="3">${H.esc(d.name || '-')}</td>
                </tr>
                <tr>
                    <td class="label">ماهیت:</td>
                    <td colspan="5">
                        <span class="badge ${d.kind === 1 ? 'badge-info' : 'badge-gray'}">
                            ${d.kind === 1 ? 'محصول' : 'کالا'}
                        </span>
                    </td>
                </tr>
                <tr>
                    <td class="label">در محاسبه استهلاک:</td>
                    <td colspan="5">${d.forEst ? '✅ بله' : '❌ خیر'}</td>
                </tr>
                <tr>
                    <td class="label">کدینگ پیش‌فرض:</td>
                    <td colspan="5" dir="ltr" style="text-align:right;">${H.esc(coding)}</td>
                </tr>
            </table>
        </div>

        <div class="tf-section">
            <div class="tf-section-title">⚙️ تنظیمات پیشرفته</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">عدم ثبت ورود بیش از سفارش:</td>
                    <td>${d.isRegMinOrderToIn ? '✅' : '❌'}</td>
                    <td class="label">عدم ثبت خروج کمتر از سفارش:</td>
                    <td>${d.isRegMaxOrderToOut ? '✅' : '❌'}</td>
                </tr>
                <tr>
                    <td class="label">امکان منفی شدن موجودی:</td>
                    <td>${d.isRegNegativKala ? '✅' : '❌'}</td>
                    <td class="label">عدم محاسبه درصد تخفیف:</td>
                    <td>${d.notCalcPerDiscount ? '✅' : '❌'}</td>
                </tr>
                <tr>
                    <td class="label">عدم محاسبه ارزش افزوده:</td>
                    <td>${d.notCalcArezeshafzode ? '✅' : '❌'}</td>
                    <td class="label">محاسبه واحد دوم:</td>
                    <td>${d.isCalcUnit2 ? '✅' : '❌'}</td>
                </tr>
                <tr>
                    <td class="label">محاسبه واحد سوم:</td>
                    <td colspan="3">${d.isCalcUnit3 ? '✅' : '❌'}</td>
                </tr>
            </table>
        </div>`;
    }

    return { render, runList, showDetail, sortBy, sortIcon };
})();

window.App.renderStockTypeList = window.App.Features.StockType.render;