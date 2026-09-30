/* ═══════════════════════════════════════════════════
   Feature / ArticleRotate — گردش کالا (همه کالاها)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.ArticleRotate = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = {
        result: null,
        page: 1
    };

    // ⭐ تبدیل ارقام فارسی/عربی به لاتین
    function toLatin(s) {
        if (!s) return null;
        if (H.toLatinDigits) return H.toLatinDigits(s.trim()) || null;
        return s
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .trim() || null;
    }

    // ═══════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        _state = { result: null, page: 1 };

        c.innerHTML = `
        <div class="card">
            <div class="card-title">🔍 فیلتر گردش کالا</div>
            <div class="filters">
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="arDateFrom" placeholder="1404/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="arDateTo" placeholder="1404/12/29">
                </div>
                <div class="form-group">
                    <label>کد کالا</label>
                    <input type="text" id="arCode" dir="ltr">
                </div>
                <div class="form-group">
                    <label>نام کالا</label>
                    <input type="text" id="arName">
                </div>
                <div class="form-group">
                    <label>وضعیت موجودی</label>
                    <select id="arMandeh">
                        <option value="0">همه کالاها</option>
                        <option value="1">فقط دارای موجودی</option>
                        <option value="2">فقط بدون موجودی</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>مرتب‌سازی</label>
                    <select id="arOrderBy">
                        <option value="name">نام کالا</option>
                        <option value="code">کد کالا</option>
                        <option value="groupCode">کد گروه</option>
                        <option value="groupName">نام گروه</option>
                    </select>
                </div>
            </div>
            <button class="btn btn-primary" id="arRunBtn">📊 نمایش گردش</button>
        </div>
        <div id="arResult">
            <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                <div style="font-size:56px;opacity:0.4;">📈</div>
                <p style="margin-top:12px;">فیلترها را تنظیم و «نمایش گردش» را بزنید</p>
            </div>
        </div>`;

        document.getElementById('arRunBtn').addEventListener('click', function () {
            _state.page = 1;
            runReport();
        });

        ['arDateFrom', 'arDateTo', 'arCode', 'arName'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    _state.page = 1;
                    runReport();
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════
    //  RUN REPORT
    // ═══════════════════════════════════════════════════
    async function runReport() {
        const container = document.getElementById('arResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const payload = buildPayload(_state.page || 1);

        try {
            const result = await window.App.Http.api('/api/reports/article-rotate', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            _state.result = result;
            await renderResult(result);
        } catch (err) {
            container.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function buildPayload(page, pageSizeOverride) {
        return {
            dateFrom: toLatin(document.getElementById('arDateFrom').value),
            dateTo: toLatin(document.getElementById('arDateTo').value),
            articleCode: document.getElementById('arCode').value || null,
            articleName: document.getElementById('arName').value || null,
            mandehFilter: parseInt(document.getElementById('arMandeh').value, 10) || 0,
            orderBy: document.getElementById('arOrderBy').value || 'name',
            page: page || 1,
            pageSize: pageSizeOverride || (window.App.state.settings.pageSize || 50)
        };
    }

    // ═══════════════════════════════════════════════════
    //  RENDER RESULT
    // ═══════════════════════════════════════════════════
    async function renderResult(r) {
        const c = document.getElementById('arResult');
        const items = r.items || [];

        const rows = items.map((it, idx) => {
            const finalCls = it.finalQty < 0 ? 'negative' : (it.finalQty > 0 ? 'positive' : '');
            const rowNum = (r.page - 1) * r.pageSize + idx + 1;
            return `<tr>
                <td class="text-center">${rowNum}</td>
                <td class="num text-center">${H.esc(it.articleCode || '')}</td>
                <td>${H.esc(it.articleName || '')}</td>
                <td>${H.esc(it.stockTypeName || '')}</td>
                <td>${H.esc(it.articleGroupName || '')}</td>
                <td class="text-center">${H.esc(it.articleUnitName || '')}</td>
                <td class="num text-left">${H.fmt(it.amountFirst)}</td>
                <td class="num text-left ar-in">${H.fmt(it.buyQty)}</td>
                <td class="num text-left ar-out">${H.fmt(it.buyBackQty)}</td>
                <td class="num text-left ar-out">${H.fmt(it.sellQty)}</td>
                <td class="num text-left ar-in">${H.fmt(it.sellBackQty)}</td>
                <td class="num text-left ar-out">${H.fmt(it.scrapQty)}</td>
                <td class="num text-left"><strong class="${finalCls}">${H.fmt(it.finalQty)}</strong></td>
                <td class="num text-left">${H.fmt(it.finalVal)}</td>
            </tr>`;
        }).join('');

        const empty = items.length === 0
            ? '<tr><td colspan="14" class="text-center" style="padding:30px;color:#94A3B8;">کالایی یافت نشد</td></tr>'
            : '';

        c.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>📈 گردش کالاها (${H.fmt(r.totalCount)})</span>
                </div>
                <div class="table-wrapper">
                    <table class="ar-table">
                        <thead>
                            <tr>
                                <th style="width:35px;" data-nosort>#</th>
                                <th style="width:80px;">کد کالا</th>
                                <th>نام کالا</th>
                                <th style="width:90px;">انبار</th>
                                <th style="width:110px;">گروه</th>
                                <th style="width:60px;">واحد</th>
                                <th class="text-left" style="width:80px;">موجودی اول</th>
                                <th class="text-left" style="width:70px;">خرید</th>
                                <th class="text-left" style="width:80px;">برگشت خرید</th>
                                <th class="text-left" style="width:70px;">فروش</th>
                                <th class="text-left" style="width:80px;">برگشت فروش</th>
                                <th class="text-left" style="width:70px;">ضایعات</th>
                                <th class="text-left" style="width:90px;">موجودی نهایی</th>
                                <th class="text-left" style="width:110px;">ارزش نهایی (ریال)</th>
                            </tr>
                        </thead>
                        <tbody>${rows || empty}</tbody>
                        <tfoot>
                            <tr class="ar-total-row">
                                <td colspan="6" class="text-center">جمع کل</td>
                                <td class="num text-left">${H.fmt(r.totalAmountFirst)}</td>
                                <td class="num text-left">${H.fmt(r.totalBuyQty)}</td>
                                <td colspan="3"></td>
                                <td class="num text-left">${H.fmt(r.totalSellQty)}</td>
                                <td class="num text-left">${H.fmt(r.totalFinalQty)}</td>
                                <td class="num text-left">${H.fmt(r.totalFinalVal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div id="arPagination"></div>
                <div id="arExportSlot"></div>
            </div>`;

        // ⭐ صفحه‌بندی
        if (r.totalPages > 1) {
            const pgEl = document.getElementById('arPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(r.page, r.totalPages, r.totalCount, items.length);
        }

        // ⭐ داده‌ی کامل برای Export
        let exportData = r;
        if (r.totalPages > 1) {
            try {
                const full = await window.App.Http.api('/api/reports/article-rotate', {
                    method: 'POST',
                    body: JSON.stringify(buildPayload(1, 1000000))
                });
                exportData = full;
            } catch (e) {
                console.warn('خطا در گرفتن داده‌ی کامل برای Export:', e);
            }
        }

        // ⭐ Export
        if (typeof Exporter !== 'undefined' && Exporter.attach && items.length > 0) {
            Exporter.attach(document.getElementById('arResult'), {
                title: 'گزارش گردش کالا',
                subtitle: subtitle(),
                filename: 'ArticleRotate',
                customHtml: function () { return buildPrintHtml(exportData); }
            });
        }

        if (window.App.enhanceTables) {
            window.App.enhanceTables(document.getElementById('arResult'));
        }
    }

    // ═══════════════════════════════════════════════════
    //  صفحه‌بندی
    // ═══════════════════════════════════════════════════
    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn)
            startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.ArticleRotate.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">
                نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} کالا
            </div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.ArticleRotate.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.ArticleRotate.goToPage(${page - 1})">‹ قبلی</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.ArticleRotate.goToPage(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.ArticleRotate.goToPage(${totalPages})">»</button>
            </div>
        </div>`;
    }

    function goToPage(p) {
        _state.page = p;
        runReport();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ═══════════════════════════════════════════════════
    //  PRINT HTML
    // ═══════════════════════════════════════════════════
    function buildPrintHtml(r) {
        const items = r.items || [];
        const rows = items.map((it, idx) => `<tr>
            <td class="text-center">${idx + 1}</td>
            <td class="text-center">${H.esc(it.articleCode || '')}</td>
            <td>${H.esc(it.articleName || '')}</td>
            <td>${H.esc(it.stockTypeName || '')}</td>
            <td>${H.esc(it.articleGroupName || '')}</td>
            <td class="text-center">${H.esc(it.articleUnitName || '')}</td>
            <td class="text-left">${H.fmt(it.amountFirst)}</td>
            <td class="text-left">${H.fmt(it.buyQty)}</td>
            <td class="text-left">${H.fmt(it.buyBackQty)}</td>
            <td class="text-left">${H.fmt(it.sellQty)}</td>
            <td class="text-left">${H.fmt(it.sellBackQty)}</td>
            <td class="text-left">${H.fmt(it.scrapQty)}</td>
            <td class="text-left"><strong>${H.fmt(it.finalQty)}</strong></td>
            <td class="text-left">${H.fmt(it.finalVal)}</td>
        </tr>`).join('');

        return `
            <table>
                <thead><tr>
                    <th>#</th><th>کد</th><th>نام کالا</th><th>انبار</th>
                    <th>گروه</th><th>واحد</th>
                    <th>موجودی اول</th><th>خرید</th><th>برگشت خرید</th>
                    <th>فروش</th><th>برگشت فروش</th><th>ضایعات</th>
                    <th>موجودی نهایی</th><th>ارزش نهایی</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════════════
    return { render, runReport, goToPage };
})();

window.App.renderArticleRotate = window.App.Features.ArticleRotate.render;