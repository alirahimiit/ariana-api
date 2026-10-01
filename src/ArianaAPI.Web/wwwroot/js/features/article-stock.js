/* ═══════════════════════════════════════════════════
   Feature / ArticleStock — گزارش موجودی کالا
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.ArticleStock = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;
    let _state = { result: null, page: 1, fullData: null };

    function toLatin(s) {
        if (!s) return null;
        if (H.toLatinDigits) return H.toLatinDigits(s.trim()) || null;
        return s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .trim() || null;
    }

    // ═══════════════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        _state = { result: null, page: 1, fullData: null };

        const stockFilterOptions = [
            { value: '0', label: 'همه کالاها' },
            { value: '1', label: '✅ فقط دارای موجودی' },
            { value: '2', label: '⚪ موجودی صفر' },
            { value: '3', label: '⚠️ موجودی منفی' }
        ];

        const orderOptions = [
            { value: 'name', label: 'نام کالا' },
            { value: 'code', label: 'کد کالا' },
            { value: 'stock', label: 'موجودی' },
            { value: 'value', label: 'ارزش موجودی' }
        ];

        c.innerHTML = `
        <div class="card filter-card" id="asFilterCard">
            <div class="card-title" id="asToggleBtn">
                <span>🔍 فیلتر موجودی کالا</span>
                <span class="ft-icon">▼</span>
            </div>
            <div class="filter-body" id="asFilterBody">
                <div class="filters two-rows">
                    <div class="form-group">
                        <label>کد کالا</label>
                        <input type="text" id="asCode" dir="ltr">
                    </div>
                    <div class="form-group">
                        <label>نام کالا</label>
                        <input type="text" id="asName">
                    </div>
                    <div class="form-group">
                        <label>وضعیت موجودی</label>
                        ${CS.html('asStockFilter', stockFilterOptions, '0')}
                    </div>
                    <div class="form-group">
                        <label>مرتب‌سازی</label>
                        ${CS.html('asOrderBy', orderOptions, 'name')}
                    </div>
                </div>
                <div style="margin-top:14px;">
                    <button class="btn btn-primary" id="asRunBtn">📦 نمایش موجودی</button>
                </div>
            </div>
        </div>
        <div id="asResult">
            <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                <div style="font-size:56px;opacity:0.4;">📦</div>
                <p style="margin-top:12px;">فیلترها را تنظیم و «نمایش موجودی» را بزنید</p>
            </div>
        </div>`;

        const filterCard = document.getElementById('asFilterCard');
        const toggleBtn = document.getElementById('asToggleBtn');
        if (filterCard && toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                filterCard.classList.toggle('collapsed');
            });
        }

        CS.bindAll(c, {
            asStockFilter: function (v) { _state.page = 1; runReport(); }
        });

        document.getElementById('asRunBtn').addEventListener('click', function () {
            _state.page = 1;
            runReport();
        });

        ['asCode', 'asName'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') { _state.page = 1; runReport(); }
            });
        });
    }

    // ═══════════════════════════════════════════════════
    async function runReport() {
        const container = document.getElementById('asResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const result = await window.App.Http.api('/api/reports/article-stock', {
                method: 'POST',
                body: JSON.stringify(buildPayload(_state.page || 1))
            });
            _state.result = result;
            await renderResult(result);
        } catch (err) {
            container.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function buildPayload(page, pageSizeOverride) {
        return {
            articleCode: document.getElementById('asCode').value || null,
            articleName: document.getElementById('asName').value || null,
            stockFilter: parseInt(CS.getValue('asStockFilter') || '0', 10),
            orderBy: CS.getValue('asOrderBy') || 'name',
            page: page || 1,
            pageSize: pageSizeOverride || (window.App.state.settings.pageSize || 50)
        };
    }

    // ═══════════════════════════════════════════════════
    async function renderResult(r) {
        const c = document.getElementById('asResult');
        const items = r.items || [];

        const rows = items.map((it, idx) => {
            const rowNum = (r.page - 1) * r.pageSize + idx + 1;
            const qtyCls = it.finalQty < 0 ? 'negative' : (it.finalQty > 0 ? 'positive' : '');
            return `<tr>
                <td class="text-center">${rowNum}</td>
                <td class="num text-center">${H.esc(it.articleCode || '')}</td>
                <td>${H.esc(it.articleName || '')}</td>
                <td>${H.esc(it.stockTypeName || '')}</td>
                <td>${H.esc(it.articleGroupName || '')}</td>
                <td class="text-center">${H.esc(it.articleUnitName || '')}</td>
                <td class="num text-left">${H.fmt(it.amountFirst)}</td>
                <td class="num text-left">${H.fmt(it.totalBuyQty)}</td>
                <td class="num text-left">${H.fmt(it.totalSellQty)}</td>
                <td class="num text-left ${qtyCls}"><strong>${H.fmt(it.finalQty)}</strong></td>
                <td class="num text-left">${H.fmt(it.avgPrice)}</td>
                <td class="num text-left">${H.fmt(it.finalVal)}</td>
            </tr>`;
        }).join('');

        const empty = items.length === 0
            ? '<tr><td colspan="12" class="text-center" style="padding:30px;color:#94A3B8;">کالایی یافت نشد</td></tr>'
            : '';

        c.innerHTML = `
            <div class="as-stats">
                <div class="as-stat as-stat-total">
                    <div class="as-stat-label">📋 تعداد کالا</div>
                    <div class="as-stat-value">${H.fmt(r.totalCount)}</div>
                    <div class="as-stat-sub">${r.withStockCount} دارای موجودی</div>
                </div>
                <div class="as-stat as-stat-qty">
                    <div class="as-stat-label">📦 جمع موجودی</div>
                    <div class="as-stat-value">${H.fmt(r.totalFinalQty)}</div>
                </div>
                <div class="as-stat as-stat-value">
                    <div class="as-stat-label">💰 ارزش موجودی</div>
                    <div class="as-stat-value">${H.fmt(r.totalFinalVal)}</div>
                    <div class="as-stat-sub">ریال</div>
                </div>
                <div class="as-stat as-stat-zero">
                    <div class="as-stat-label">⚪ موجودی صفر</div>
                    <div class="as-stat-value">${H.fmt(r.zeroCount)}</div>
                </div>
                <div class="as-stat as-stat-neg">
                    <div class="as-stat-label">⚠️ موجودی منفی</div>
                    <div class="as-stat-value">${H.fmt(r.negativeCount)}</div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">
                    <span>📦 گزارش موجودی کالا (${H.fmt(r.totalCount)})</span>
                </div>
                <div class="table-wrapper as-table-wrap">
                    <table class="as-table">
                        <thead>
                            <tr>
                                <th style="width:35px;" data-nosort>#</th>
                                <th style="width:80px;">کد کالا</th>
                                <th>نام کالا</th>
                                <th style="width:90px;">انبار</th>
                                <th style="width:110px;">گروه</th>
                                <th style="width:60px;">واحد</th>
                                <th class="text-left" style="width:90px;">موجودی اول</th>
                                <th class="text-left" style="width:80px;">خرید</th>
                                <th class="text-left" style="width:80px;">فروش</th>
                                <th class="text-left" style="width:100px;">موجودی فعلی</th>
                                <th class="text-left" style="width:110px;">میانگین قیمت</th>
                                <th class="text-left" style="width:130px;">ارزش موجودی</th>
                            </tr>
                        </thead>
                        <tbody>${rows || empty}</tbody>
                        <tfoot>
                            <tr class="as-total-row">
                                <td colspan="9" class="text-center">جمع کل</td>
                                <td class="num text-left"><strong>${H.fmt(r.totalFinalQty)}</strong></td>
                                <td></td>
                                <td class="num text-left"><strong>${H.fmt(r.totalFinalVal)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div id="asPagination"></div>
                <div id="asExportSlot"></div>
            </div>`;

        if (r.totalPages > 1) {
            const pgEl = document.getElementById('asPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(r.page, r.totalPages, r.totalCount, items.length);
        }

        let exportData = r;
        if (r.totalPages > 1) {
            try {
                const full = await window.App.Http.api('/api/reports/article-stock', {
                    method: 'POST',
                    body: JSON.stringify(buildPayload(1, 1000000))
                });
                exportData = full;
            } catch (e) { console.warn(e); }
        }
        _state.fullData = exportData;

        document.querySelectorAll('#asResult .export-bar').forEach(el => el.remove());

        if (typeof Exporter !== 'undefined' && Exporter.attach && items.length > 0) {
            Exporter.attach(document.getElementById('asResult'), {
                title: 'گزارش موجودی کالا',
                subtitle: subtitle(),
                filename: 'ArticleStock',
                customHtml: function () { return buildPrintHtml(_state.fullData); }
            });
        }

        if (window.App.enhanceTables) window.App.enhanceTables(document.getElementById('asResult'));
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.ArticleStock.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} کالا</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.ArticleStock.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.ArticleStock.goToPage(${page - 1})">‹ قبلی</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.ArticleStock.goToPage(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.ArticleStock.goToPage(${totalPages})">»</button>
            </div>
        </div>`;
    }

    function goToPage(p) {
        _state.page = p;
        runReport();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function buildPrintHtml(r) {
        if (!r) return '';
        const rows = (r.items || []).map((it, idx) => `<tr>
            <td class="text-center">${idx + 1}</td>
            <td class="text-center">${H.esc(it.articleCode || '')}</td>
            <td>${H.esc(it.articleName || '')}</td>
            <td>${H.esc(it.stockTypeName || '')}</td>
            <td>${H.esc(it.articleGroupName || '')}</td>
            <td class="text-center">${H.esc(it.articleUnitName || '')}</td>
            <td class="text-left">${H.fmt(it.amountFirst)}</td>
            <td class="text-left">${H.fmt(it.totalBuyQty)}</td>
            <td class="text-left">${H.fmt(it.totalSellQty)}</td>
            <td class="text-left"><strong>${H.fmt(it.finalQty)}</strong></td>
            <td class="text-left">${H.fmt(it.avgPrice)}</td>
            <td class="text-left">${H.fmt(it.finalVal)}</td>
        </tr>`).join('');

        return `
            <table class="factor-info-table" style="margin-bottom:10px;">
                <tr>
                    <td class="label">تعداد کالا:</td><td>${H.fmt(r.totalCount)}</td>
                    <td class="label">جمع موجودی:</td><td>${H.fmt(r.totalFinalQty)}</td>
                    <td class="label">ارزش موجودی:</td><td>${H.fmt(r.totalFinalVal)} ریال</td>
                </tr>
            </table>
            <table>
                <thead><tr>
                    <th>#</th><th>کد</th><th>نام کالا</th><th>انبار</th><th>گروه</th><th>واحد</th>
                    <th>موجودی اول</th><th>خرید</th><th>فروش</th>
                    <th>موجودی فعلی</th><th>میانگین قیمت</th><th>ارزش موجودی</th>
                </tr></thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="9" class="text-center">جمع کل</td>
                        <td class="text-left">${H.fmt(r.totalFinalQty)}</td>
                        <td></td>
                        <td class="text-left">${H.fmt(r.totalFinalVal)}</td>
                    </tr>
                </tfoot>
            </table>`;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    return { render, runReport, goToPage };
})();

window.App.renderArticleStock = window.App.Features.ArticleStock.render;