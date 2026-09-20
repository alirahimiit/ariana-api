/* ═══════════════════════════════════════════════════
   Feature / Article (کالاها)
   مسئولیت: لیست کالاها، فیلتر، جزئیات، خروجی
   ═══════════════════════════════════════════════════
   وابستگی‌ها:
     - window.App.Helpers  (fmt, esc)
     - window.App.Http     (api)
     - window.App.state    (user، settings، currentPage)
     - window.App.openModal / toast / enhanceTables
     - Exporter
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Article = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _stockFilter = 'all';

    // ═══════════════════════════════════════════
    //  RENDER — صفحه فیلتر + نتیجه
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد کالا</label>
                    <input type="text" id="artCode">
                </div>
                <div class="form-group">
                    <label>نام کالا</label>
                    <input type="text" id="artName">
                </div>
                <div class="form-group">
                    <label>شناسه مالیاتی</label>
                    <input type="text" id="artTaxId">
                </div>
                <div class="form-group">
                    <label>گروه کالا</label>
                    <input type="number" id="artGroupId">
                </div>
                <div class="form-group">
                    <label>انبار</label>
                    <input type="number" id="artStockTypeId">
                </div>
                <div class="form-group">
                    <label>واحد</label>
                    <input type="number" id="artUnitId">
                </div>
                <div class="form-group">
                    <label>وضعیت موجودی</label>
                    <div class="custom-select" id="artStockFilterWrap">
                        <button type="button" class="custom-select-trigger" id="artStockFilterTrigger">
                            <span class="custom-select-value">همه کالاها</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="artStockFilterMenu">
                            <div class="custom-select-option selected" data-value="all">همه کالاها</div>
                            <div class="custom-select-option" data-value="hasStock">فقط دارای موجودی</div>
                            <div class="custom-select-option" data-value="noStock">فقط موجودی صفر</div>
                            <div class="custom-select-option" data-value="negativeStock">فقط موجودی منفی</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="artBtnRun">🔍 جستجو</button>
                </div>
            </div>
        </div>
        <div id="artResult">
            <div class="loading"><div class="spinner"></div></div>
        </div>`;

        _stockFilter = 'all';
        setupCustomSelect();

        document.getElementById('artBtnRun').addEventListener('click', () => runList(1));

        // Enter key روی هر فیلد
        ['artCode', 'artName', 'artTaxId', 'artGroupId', 'artStockTypeId', 'artUnitId'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') runList(1);
            });
        });

        runList(1);
    }

    function setupCustomSelect() {
        const wrap = document.getElementById('artStockFilterWrap');
        const trigger = document.getElementById('artStockFilterTrigger');
        const menu = document.getElementById('artStockFilterMenu');
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(el => {
                if (el !== wrap) el.classList.remove('open');
            });
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                _stockFilter = opt.dataset.value;
                valueEl.textContent = opt.textContent.trim();
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
            });
        });
    }

    // ═══════════════════════════════════════════
    //  RUN — لیست کالاها
    // ═══════════════════════════════════════════
    async function runList(page = 1) {
        const container = document.getElementById('artResult');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        const payload = buildPayload(page);

        try {
            const data = await window.App.Http.api('/api/article/list', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            renderListResult(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildPayload(page, pageSizeOverride = null) {
        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        return {
            code: document.getElementById('artCode')?.value || null,
            name: document.getElementById('artName')?.value || null,
            taxId: document.getElementById('artTaxId')?.value || null,
            groupId: parseIntOrNull('artGroupId'),
            stockTypeId: parseIntOrNull('artStockTypeId'),
            unitId: parseIntOrNull('artUnitId'),
            stockFilter: _stockFilter || 'all',
            page: page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize
        };
    }

    // ═══════════════════════════════════════════
    //  RENDER RESULT — لیست کالاها
    // ═══════════════════════════════════════════
    function renderListResult(data) {
        const container = document.getElementById('artResult');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>کالایی یافت نشد</p>
                </div>`;
            return;
        }

        const rows = items.map(a => {
            const stock = a.finallExistence ?? 0;
            const stockClass = stock > 0
                ? 'color:#059669; font-weight:600;'
                : (stock < 0 ? 'color:#DC2626; font-weight:600;' : 'color:#6B7280;');

            return `
                <tr>
                    <td class="num text-center">${a.code || ''}</td>
                    <td>${H.esc(a.name || '')}</td>
                    <td class="num text-center">${a.taxId || '-'}</td>
                    <td>${H.esc(a.articleGroupName || '')}</td>
                    <td>${H.esc(a.stockTypeName || '')}</td>
                    <td>${H.esc(a.articleUnitName || '')}</td>
                    <td class="num text-left" style="${stockClass}">${H.fmt(stock)}</td>
                    <td class="num text-left">${H.fmt(a.amountSale)}</td>
                    <td class="text-center">${H.esc(a.statusName || '')}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-ghost"
                                onclick="App.Features.Article.showDetail(${a.id})">
                            🔍 مشاهده
                        </button>
                    </td>
                </tr>`;
        }).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>🏷️ لیست کالاها (${H.fmt(totalCount)})</span>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:90px;">کد</th>
                                <th>نام کالا</th>
                                <th style="width:100px;">شناسه مالیاتی</th>
                                <th style="width:110px;">گروه</th>
                                <th style="width:120px;">انبار</th>
                                <th style="width:80px;">واحد</th>
                                <th class="text-left" style="width:100px;">موجودی</th>
                                <th class="text-left" style="width:110px;">قیمت فروش</th>
                                <th style="width:80px;">وضعیت</th>
                                <th style="width:90px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                ${buildPagination(page, totalPages, totalCount, items.length)}
            </div>`;

        Exporter.attach(container, {
            title: 'لیست کالاها',
            subtitle: subtitle(),
            filename: 'ArticleList',
            getFullTable: fetchFullTable
        });

        window.App.enhanceTables(container);
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        if (totalPages <= 1) {
            return `
                <div class="pagination-bar">
                    <div class="pagination-info">مجموع: ${H.fmt(totalCount)} کالا</div>
                </div>`;
        }

        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.Article.runList(${p})">${p}</button>`;
        }

        return `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} کالا
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Article.runList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Article.runList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Article.runList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Article.runList(${totalPages})">»</button>
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  EXPORT — fetch کل داده
    // ═══════════════════════════════════════════
    async function fetchFullTable() {
        const payload = buildPayload(1, 100000);
        const full = await window.App.Http.api('/api/article/list', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return buildTableHtml(full.items || []);
    }

    function buildTableHtml(items) {
        const rows = items.map(a => `
            <tr>
                <td class="num text-center">${a.code || ''}</td>
                <td>${H.esc(a.name || '')}</td>
                <td class="num text-center">${a.taxId || '-'}</td>
                <td>${H.esc(a.articleGroupName || '')}</td>
                <td>${H.esc(a.stockTypeName || '')}</td>
                <td>${H.esc(a.articleUnitName || '')}</td>
                <td class="num text-left">${H.fmt(a.finallExistence)}</td>
                <td class="num text-left">${H.fmt(a.amountSale)}</td>
                <td class="text-center">${H.esc(a.statusName || '')}</td>
            </tr>
        `).join('');

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>کد</th>
                    <th>نام کالا</th>
                    <th>شناسه مالیاتی</th>
                    <th>گروه</th>
                    <th>انبار</th>
                    <th>واحد</th>
                    <th class="text-left">موجودی</th>
                    <th class="text-left">قیمت فروش</th>
                    <th>وضعیت</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>`;
        return table;
    }

    // ═══════════════════════════════════════════
    //  SHOW DETAIL — modal
    // ═══════════════════════════════════════════
    async function showDetail(articleId) {
        window.App.openModal('جزئیات کالا',
            `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const d = await window.App.Http.api(`/api/article/${articleId}`);
            document.getElementById('modalBody').innerHTML = buildDetailHtml(d);

            Exporter.attach(document.getElementById('modalBody'), {
                title: `کالا: ${d.name || ''} (${d.code || ''})`,
                subtitle: subtitle(),
                filename: `Article_${d.code || articleId}`,
                customHtml: () => buildPrintHtml(d)
            });

            window.App.enhanceTables(document.getElementById('modalBody'));
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildDetailHtml(d) {
        return `
            <div class="section-title">📋 اطلاعات پایه</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">کد کالا:</td>
                    <td>${d.code || '-'}</td>
                    <td class="label">نام کالا:</td>
                    <td colspan="3">${H.esc(d.name || '-')}</td>
                </tr>
                <tr>
                    <td class="label">گروه:</td>
                    <td>${H.esc(d.articleGroupName || '-')} (${d.articleGroupCode || ''})</td>
                    <td class="label">انبار:</td>
                    <td>${H.esc(d.stockTypeName || '-')} (${d.stockTypeCode || ''})</td>
                    <td class="label">وضعیت:</td>
                    <td>${H.esc(d.statusName || '-')}</td>
                </tr>
                ${d.articleCoding ? `
                <tr>
                    <td class="label">کدینگ کالا:</td>
                    <td colspan="5">${H.esc(d.articleCoding)}</td>
                </tr>` : ''}
            </table>

            <div class="section-title">📏 واحدها</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">واحد اصلی:</td>
                    <td>${H.esc(d.articleUnitName || '-')}</td>
                    <td class="label">واحد دوم:</td>
                    <td>${H.esc(d.articleUnitName2 || '-')} ${d.tabdil2 ? '(تبدیل: ' + d.tabdil2 + ')' : ''}</td>
                    <td class="label">واحد سوم:</td>
                    <td>${H.esc(d.articleUnitName3 || '-')} ${d.tabdil3 ? '(تبدیل: ' + d.tabdil3 + ')' : ''}</td>
                </tr>
            </table>

            <div class="section-title">📦 موجودی</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">موجودی اول دوره:</td>
                    <td class="num">${H.fmt(d.firstExistence)}</td>
                    <td class="label">ورودی:</td>
                    <td class="num">${H.fmt(d.inputed)}</td>
                    <td class="label">خروجی:</td>
                    <td class="num">${H.fmt(d.outPuted)}</td>
                </tr>
                <tr>
                    <td class="label">ضایعات ۱:</td>
                    <td class="num">${H.fmt(d.loss1)}</td>
                    <td class="label">ضایعات ۲:</td>
                    <td class="num">${H.fmt(d.loss2)}</td>
                    <td class="label">موجودی فعلی:</td>
                    <td class="num" style="font-weight:bold; color:#4F46E5;">${H.fmt(d.finallExistence)}</td>
                </tr>
            </table>

            <div class="section-title">💰 قیمت‌ها</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">موجودی اولیه (مقدار):</td>
                    <td class="num">${H.fmt(d.amountFirst)}</td>
                    <td class="label">بهای اولیه:</td>
                    <td class="num">${H.fmt(d.costFirst)}</td>
                    <td class="label">قیمت فروش:</td>
                    <td class="num" style="font-weight:bold;">${H.fmt(d.amountSale)}</td>
                </tr>
            </table>

            <div class="section-title">🔢 کدینگ حسابداری</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">پیش‌فرض (کل-معین-تفصیل):</td>
                    <td colspan="5">${d.codeCol || 0} - ${d.codeMoein || 0} - ${d.codeTafzil || 0}</td>
                </tr>
                <tr>
                    <td class="label">خرید:</td>
                    <td>${d.codeColBuy || 0} - ${d.codeMoeinBuy || 0} - ${d.codeTafzilBuy || 0}</td>
                    <td class="label">برگشت از خرید:</td>
                    <td>${d.codeColReBuy || 0} - ${d.codeMoeinReBuy || 0} - ${d.codeTafzilReBuy || 0}</td>
                    <td class="label">برگشت از فروش:</td>
                    <td>${d.codeColReSale || 0} - ${d.codeMoeinReSale || 0} - ${d.codeTafzilReSale || 0}</td>
                </tr>
            </table>

            <div class="section-title">⚙️ تنظیمات</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">درصد بازاریاب:</td>
                    <td class="num">${d.marketerPercent ? d.marketerPercent + '%' : '-'}</td>
                    <td class="label">حد سفارش (ورود):</td>
                    <td class="num">${H.fmt(d.maxCostOrderBy)}</td>
                    <td class="label">حد سفارش (خروج):</td>
                    <td class="num">${H.fmt(d.minCostOrderBy)}</td>
                </tr>
                <tr>
                    <td class="label">استهلاک:</td>
                    <td>${H.esc(d.depreciationTypeName || '-')} (${d.depreciation || 0})</td>
                    <td class="label">کنترل موجودی منفی:</td>
                    <td>${d.xIsRegNegativKala ? '✅ فعال' : '❌ غیرفعال'}</td>
                    <td class="label">محاسبه ارزش افزوده:</td>
                    <td>${d.xNotCalcArezeshafzode ? '❌ غیرفعال' : '✅ فعال'}</td>
                </tr>
            </table>`;
    }

    function buildPrintHtml(d) {
        return `
            <table class="factor-info-table">
                <tr>
                    <td class="label">کد کالا:</td>
                    <td>${d.code || '-'}</td>
                    <td class="label">نام کالا:</td>
                    <td colspan="3">${H.esc(d.name || '-')}</td>
                </tr>
                <tr>
                    <td class="label">گروه:</td>
                    <td>${H.esc(d.articleGroupName || '-')} (${d.articleGroupCode || ''})</td>
                    <td class="label">انبار:</td>
                    <td>${H.esc(d.stockTypeName || '-')} (${d.stockTypeCode || ''})</td>
                    <td class="label">وضعیت:</td>
                    <td>${H.esc(d.statusName || '-')}</td>
                </tr>
            </table>

            <div class="section-title">📏 واحدها</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">واحد اصلی:</td>
                    <td>${H.esc(d.articleUnitName || '-')}</td>
                    <td class="label">واحد دوم:</td>
                    <td>${H.esc(d.articleUnitName2 || '-')}</td>
                    <td class="label">تبدیل دوم:</td>
                    <td>${d.tabdil2 ?? '-'}</td>
                </tr>
                <tr>
                    <td class="label">واحد سوم:</td>
                    <td>${H.esc(d.articleUnitName3 || '-')}</td>
                    <td class="label">تبدیل سوم:</td>
                    <td>${d.tabdil3 ?? '-'}</td>
                    <td></td><td></td>
                </tr>
            </table>

            <div class="section-title">📦 موجودی</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">موجودی اول دوره:</td>
                    <td class="num text-left">${H.fmt(d.firstExistence)}</td>
                    <td class="label">ورودی:</td>
                    <td class="num text-left">${H.fmt(d.inputed)}</td>
                    <td class="label">خروجی:</td>
                    <td class="num text-left">${H.fmt(d.outPuted)}</td>
                </tr>
                <tr>
                    <td class="label">ضایعات ۱:</td>
                    <td class="num text-left">${H.fmt(d.loss1)}</td>
                    <td class="label">ضایعات ۲:</td>
                    <td class="num text-left">${H.fmt(d.loss2)}</td>
                    <td class="label">موجودی فعلی:</td>
                    <td class="num text-left" style="font-weight:bold; color:#4F46E5;">${H.fmt(d.finallExistence)}</td>
                </tr>
            </table>

            <div class="section-title">💰 قیمت‌ها</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">موجودی اولیه:</td>
                    <td class="num text-left">${H.fmt(d.amountFirst)}</td>
                    <td class="label">بهای اولیه:</td>
                    <td class="num text-left">${H.fmt(d.costFirst)}</td>
                    <td class="label">قیمت فروش:</td>
                    <td class="num text-left" style="font-weight:bold;">${H.fmt(d.amountSale)}</td>
                </tr>
            </table>

            <div class="section-title">🔢 کدینگ حسابداری</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">پیش‌فرض:</td>
                    <td colspan="5">${d.codeCol || 0} - ${d.codeMoein || 0} - ${d.codeTafzil || 0}</td>
                </tr>
                <tr>
                    <td class="label">خرید:</td>
                    <td>${d.codeColBuy || 0} - ${d.codeMoeinBuy || 0} - ${d.codeTafzilBuy || 0}</td>
                    <td class="label">برگشت خرید:</td>
                    <td>${d.codeColReBuy || 0} - ${d.codeMoeinReBuy || 0} - ${d.codeTafzilReBuy || 0}</td>
                    <td class="label">برگشت فروش:</td>
                    <td>${d.codeColReSale || 0} - ${d.codeMoeinReSale || 0} - ${d.codeTafzilReSale || 0}</td>
                </tr>
            </table>

            <div class="section-title">⚙️ تنظیمات</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">درصد بازاریاب:</td>
                    <td class="num text-left">${d.marketerPercent ? d.marketerPercent + '%' : '-'}</td>
                    <td class="label">حد سفارش (ورود):</td>
                    <td class="num text-left">${H.fmt(d.maxCostOrderBy)}</td>
                    <td class="label">حد سفارش (خروج):</td>
                    <td class="num text-left">${H.fmt(d.minCostOrderBy)}</td>
                </tr>
                <tr>
                    <td class="label">استهلاک:</td>
                    <td>${H.esc(d.depreciationTypeName || '-')}</td>
                    <td class="label">کنترل موجودی منفی:</td>
                    <td>${d.xIsRegNegativKala ? '✅ فعال' : '❌ غیرفعال'}</td>
                    <td class="label">محاسبه ارزش افزوده:</td>
                    <td>${d.xNotCalcArezeshafzode ? '❌ غیرفعال' : '✅ فعال'}</td>
                </tr>
            </table>`;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return { render, runList, showDetail };
})();

// ⭐ alias برای سازگاری با کد فعلی
window.App.renderArticleList = window.App.Features.Article.render;
window.App.runArticleList = window.App.Features.Article.runList;
window.App.showArticleDetail = window.App.Features.Article.showDetail;