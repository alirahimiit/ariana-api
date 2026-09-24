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
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>`;

        // ⭐ لود lookup ها برای dropdown
        let lookups = { groups: [], stockTypes: [] };
        try {
            lookups = await window.App.Http.api('/api/article/lookups') || lookups;
        } catch (err) {
            console.error('lookup load failed:', err);
        }

        // ⭐ ساخت dropdown انبار
        let stockOpts = '<option value="">همه انبارها</option>';
        (lookups.stockTypes || []).forEach(s => {
            stockOpts += `<option value="${s.id}">${H.esc(s.name || '')}</option>`;
        });

        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد کالا</label>
                    <input type="text" id="artCode" dir="ltr">
                </div>
                <div class="form-group">
                    <label>نام کالا</label>
                    <input type="text" id="artName">
                </div>
                <div class="form-group">
                    <label>شناسه مالیاتی</label>
                    <input type="text" id="artTaxId" dir="ltr">
                </div>
                <div class="form-group">
                    <label>انبار</label>
                    <select id="artStockTypeId">${stockOpts}</select>
                </div>
                <div class="form-group">
                    <label>گروه کالا</label>
                    <select id="artGroupId">
                        <option value="">همه گروه‌ها</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="artBtnRun">🔍 جستجو</button>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-ghost btn-block" id="artBtnFixCoding"
                            title="اصلاح کدینگ‌های کالاها">
                        🔧 اصلاح کدینگ‌ها
                    </button>
                </div>
            </div>
        </div>
        <div id="artResult">
            <div class="loading"><div class="spinner"></div></div>
        </div>`;

        // ⭐ Cascade: انبار → گروه کالا
        const stockSel = document.getElementById('artStockTypeId');
        const groupSel = document.getElementById('artGroupId');

        function rebuildGroupOptions() {
            const stockId = stockSel.value;
            let groups = lookups.groups || [];
            if (stockId) {
                groups = groups.filter(g => String(g.stockTypeId) === String(stockId));
            }

            let html = '<option value="">همه گروه‌ها</option>';
            groups.forEach(g => {
                html += `<option value="${g.id}">${H.esc(g.name || '')}</option>`;
            });
            groupSel.innerHTML = html;
        }

        stockSel.addEventListener('change', rebuildGroupOptions);
        rebuildGroupOptions();

        // ⭐ رویداد دکمه‌ها
        document.getElementById('artBtnRun').addEventListener('click', () => runList(1));
        document.getElementById('artBtnFixCoding').addEventListener('click', fixCoding);

        // Enter → جستجو
        ['artCode', 'artName', 'artTaxId'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keydown', e => {
                if (e.key === 'Enter') runList(1);
            });
        });

        // ⭐ اجرای اولیه
        runList(1);
    }

    // ⭐ اصلاح کدینگ‌ها با SP
    async function fixCoding() {
        if (!confirm('آیا از اصلاح کدینگ همه کالاها مطمئن هستید؟\n(ممکن است کمی طول بکشد)')) return;
        const btn = document.getElementById('artBtnFixCoding');
        const orig = btn.textContent;
        try {
            btn.disabled = true;
            btn.textContent = '⏳ در حال اصلاح...';
            await window.App.Http.api('/api/article/fix-coding', { method: 'POST' });
            window.App.toast('کدینگ‌ها با موفقیت اصلاح شدند', 'success');
            runList(1);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
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
            const v = el.value;
            if (v === '' || v == null) return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        };

        return {
            code: document.getElementById('artCode')?.value || null,
            name: document.getElementById('artName')?.value || null,
            taxId: document.getElementById('artTaxId')?.value || null,
            stockTypeId: parseIntOrNull('artStockTypeId'),
            groupId: parseIntOrNull('artGroupId'),
            // unitId و stockFilter حذف شدن
            stockFilter: 'all',   // برای سازگاری با Backend
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
                <td class="num text-center">${a.stockTypeCode || '-'}</td>
                <td class="num text-center">${a.articleGroupCode || '-'}</td>
                <td class="num text-center" style="font-weight:600;">${a.code || ''}</td>
                <td>${H.esc(a.name || '')}</td>
                <td class="text-center">${H.esc(a.articleUnitName || '')}</td>
                <td class="num text-left">${H.fmt(a.amountFirst)}</td>
                <td class="num text-left">${H.fmt(a.costFirst)}</td>
                <td class="num text-left" style="color:#DC2626;">${H.fmt(a.outAmount1)}</td>
                <td class="num text-left" style="color:#DC2626;">${H.fmt(a.outVal1)}</td>
                <td class="num text-left" style="color:#059669;">${H.fmt(a.inAmount1)}</td>
                <td class="num text-left" style="color:#059669;">${H.fmt(a.inVal1)}</td>
                <td class="num text-left">${H.fmt(a.backAmount1)}</td>
                <td class="num text-left">${H.fmt(a.backVal1)}</td>
                <td class="num text-left" style="${stockClass}">${H.fmt(stock)}</td>
                <td class="num text-left">${H.fmt(a.amountSale)}</td>
                <td class="text-center">${H.esc(a.statusName || '')}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Article.showDetail(${a.id})"
                            title="مشاهده">👁️</button>
                    <button class="btn btn-sm btn-ghost"
                            data-permission="191"
                            onclick="event.stopPropagation(); App.Features.ArticleForm.openEdit(${a.id})"
                            title="ویرایش">✏️</button>
                    <button class="btn btn-sm btn-ghost"
                            data-permission="192"
                            onclick="event.stopPropagation(); App.Features.ArticleForm.delete(${a.id})"
                            title="حذف" style="color:var(--danger);">🗑️</button>
                </td>
            </tr>
        `;
        }).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        const paginationHtml = buildPagination(page, totalPages, totalCount, items.length);

        container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>🏷️ لیست کالاها (${totalCount.toLocaleString('fa-IR')})</span>
                <button class="btn btn-primary btn-sm"
                        data-permission="190"
                        onclick="App.Features.ArticleForm.openCreate()">
                    ➕ کالای جدید
                </button>
            </div>
            <div class="table-wrapper" style="overflow-x:auto;">
                <table class="article-list-table">
                    <thead>
                        <tr>
                            <th style="width:60px;">انبار</th>
                            <th style="width:60px;">گروه</th>
                            <th style="width:90px;">کد کالا</th>
                            <th style="min-width:200px;">نام کالا</th>
                            <th style="width:70px;">واحد</th>
                            <th class="text-left" style="width:80px;">موج اولیه</th>
                            <th class="text-left" style="width:100px;">ارزش اولیه</th>
                            <th class="text-left" style="width:80px;">فروش (تعداد)</th>
                            <th class="text-left" style="width:100px;">فروش (ریالی)</th>
                            <th class="text-left" style="width:80px;">خرید (تعداد)</th>
                            <th class="text-left" style="width:100px;">خرید (ریالی)</th>
                            <th class="text-left" style="width:80px;">برگشت (تعداد)</th>
                            <th class="text-left" style="width:100px;">برگشت (ریالی)</th>
                            <th class="text-left" style="width:100px;">موجودی فعلی</th>
                            <th class="text-left" style="width:110px;">قیمت فروش</th>
                            <th style="width:80px;">وضعیت</th>
                            <th style="width:90px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>`;
        // ⭐ اعمال permission
        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(container);
        }

        // ⭐ Export
        // ⭐ Export
       
        Exporter.attach(container, {
            title: 'لیست کالاها',
            subtitle: (window.App.state.user?.orgName || '') + ' - ' + (window.App.state.user?.fyName || ''),
            filename: 'ArticleList',
            getFullTable: async () => {
                const payload = buildPayload(1, 100000);
                const full = await window.App.Http.api('/api/article/list', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                return buildArticleTableHtml(full.items || []);
            }
        });
    }
    function buildArticleTableHtml(items) {
        let rows = '';
        items.forEach(a => {
            const stock = a.finallExistence ?? 0;
            const stockClass = stock > 0
                ? 'color:#059669; font-weight:600;'
                : (stock < 0 ? 'color:#DC2626; font-weight:600;' : 'color:#6B7280;');

            rows += '<tr>' +
                '<td class="num text-center">' + (a.stockTypeCode || '-') + '</td>' +
                '<td class="num text-center">' + (a.articleGroupCode || '-') + '</td>' +
                '<td class="num text-center">' + (a.code || '') + '</td>' +
                '<td>' + H.esc(a.name || '') + '</td>' +
                '<td class="text-center">' + H.esc(a.articleUnitName || '') + '</td>' +
                '<td class="num text-left">' + H.fmt(a.amountFirst) + '</td>' +
                '<td class="num text-left">' + H.fmt(a.costFirst) + '</td>' +
                '<td class="num text-left">' + H.fmt(a.outAmount1) + '</td>' +
                '<td class="num text-left">' + H.fmt(a.outVal1) + '</td>' +
                '<td class="num text-left">' + H.fmt(a.inAmount1) + '</td>' +
                '<td class="num text-left">' + H.fmt(a.inVal1) + '</td>' +
                '<td class="num text-left">' + H.fmt(a.backAmount1) + '</td>' +
                '<td class="num text-left">' + H.fmt(a.backVal1) + '</td>' +
                '<td class="num text-left" style="' + stockClass + '">' + H.fmt(stock) + '</td>' +
                '<td class="num text-left">' + H.fmt(a.amountSale) + '</td>' +
                '<td class="text-center">' + H.esc(a.statusName || '') + '</td>' +
                '</tr>';
        });

        const table = document.createElement('table');
        table.innerHTML =
            '<thead><tr>' +
            '<th>انبار</th>' +
            '<th>گروه</th>' +
            '<th>کد کالا</th>' +
            '<th>نام کالا</th>' +
            '<th>واحد</th>' +
            '<th class="text-left">موج اولیه</th>' +
            '<th class="text-left">ارزش اولیه</th>' +
            '<th class="text-left">فروش (تعداد)</th>' +
            '<th class="text-left">فروش (ریالی)</th>' +
            '<th class="text-left">خرید (تعداد)</th>' +
            '<th class="text-left">خرید (ریالی)</th>' +
            '<th class="text-left">برگشت (تعداد)</th>' +
            '<th class="text-left">برگشت (ریالی)</th>' +
            '<th class="text-left">موجودی فعلی</th>' +
            '<th class="text-left">قیمت فروش</th>' +
            '<th>وضعیت</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>';
        return table;
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
            // ⭐ لود کردن lookup ها (گروه، معین، تفصیلی)
            let lookups = { cols: [], moeins: [], tafzils: [] };
            try {
                lookups = await window.App.Features.ArticleForm.getLookups();
            } catch (e) {
                console.warn('Lookups load failed:', e);
            }

            const d = await window.App.Http.api(`/api/article/${articleId}`);

            document.getElementById('modalBody').innerHTML = buildDetailHtml(d, lookups);

            Exporter.attach(document.getElementById('modalBody'), {
                title: `کالا: ${d.name || ''} (${d.code || ''})`,
                subtitle: subtitle(),
                filename: `Article_${d.code || articleId}`,
                customHtml: () => buildPrintHtml(d)
            });
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildDetailHtml(d, lookups) {
        lookups = lookups || { cols: [], moeins: [], tafzils: [] };
        const statusInfo = getStatusInfo(d.status);

        return `
        <div class="art-view">
            <!-- ═══ Header ═══ -->
            <div class="art-view-header">
                <div class="art-view-title">
                    <div class="art-view-icon">🏷️</div>
                    <div>
                        <h3>${H.esc(d.name || '(بی‌نام)')}</h3>
                        <div class="art-view-code">کد کالا: <strong>${d.code || '-'}</strong></div>
                    </div>
                </div>
                <div class="art-view-badges">
                    <span class="art-badge ${statusInfo.cls}">${statusInfo.text}</span>
                    ${d.articleGroupName ? `<span class="art-badge art-badge-info">${H.esc(d.articleGroupName)}</span>` : ''}
                    ${d.stockTypeName ? `<span class="art-badge art-badge-gray">${H.esc(d.stockTypeName)}</span>` : ''}
                </div>
            </div>

            <!-- ═══ Cards ═══ -->
            <div class="art-view-grid">
                <div class="art-card">
                    <div class="art-card-title">📋 اطلاعات پایه</div>
                    <div class="art-row"><span>شناسه مالیاتی</span><span class="art-num">${d.taxId || '-'}</span></div>
                    <div class="art-row"><span>کدینگ کالا</span><span class="art-num">${d.articleCoding || '-'}</span></div>
                    <div class="art-row"><span>کدینگ انبار</span><span class="art-num">${d.codingStore || '-'}</span></div>
                    <div class="art-row"><span>کدینگ گروه انبار</span><span class="art-num">${d.codingGroupStore || '-'}</span></div>
                </div>

                <div class="art-card">
                    <div class="art-card-title">📁 گروه و انبار</div>
                    <div class="art-row"><span>گروه کالا</span><span>${H.esc(d.articleGroupName || '-')}</span></div>
                    <div class="art-row"><span>کد گروه</span><span class="art-num">${d.articleGroupCode || '-'}</span></div>
                    <div class="art-row"><span>انبار</span><span>${H.esc(d.stockTypeName || '-')}</span></div>
                    <div class="art-row"><span>کد انبار</span><span class="art-num">${d.stockTypeCode || '-'}</span></div>
                </div>

                <div class="art-card">
                    <div class="art-card-title">📏 واحدها</div>
                    <div class="art-row"><span>واحد اصلی</span><span>${H.esc(d.articleUnitName || '-')}</span></div>
                    <div class="art-row"><span>واحد دوم</span><span>${H.esc(d.articleUnitName2 || '-')}</span></div>
                    <div class="art-row"><span>واحد سوم</span><span>${H.esc(d.articleUnitName3 || '-')}</span></div>
                </div>

                <div class="art-card">
                    <div class="art-card-title">📦 موجودی</div>
                    <div class="art-row"><span>موجودی اول دوره</span><span class="art-num">${H.fmt(d.firstExistence)}</span></div>
                    <div class="art-row"><span>ورودی</span><span class="art-num art-green">${H.fmt(d.inputed)}</span></div>
                    <div class="art-row"><span>خروجی</span><span class="art-num art-red">${H.fmt(d.outPuted)}</span></div>
                    <div class="art-row art-row-hl"><span>موجودی فعلی</span><span class="art-num">${H.fmt(d.finallExistence)}</span></div>
                </div>

                <div class="art-card">
                    <div class="art-card-title">💰 قیمت‌ها</div>
                    <div class="art-row"><span>موجودی اولیه</span><span class="art-num">${H.fmt(d.amountFirst)}</span></div>
                    <div class="art-row"><span>بهای اولیه</span><span class="art-num">${H.fmt(d.costFirst)}</span></div>
                    <div class="art-row art-row-hl"><span>قیمت فروش</span><span class="art-num">${H.fmt(d.amountSale)}</span></div>
                </div>

                <div class="art-card">
                    <div class="art-card-title">⚙️ تنظیمات</div>
                    <div class="art-row"><span>درصد بازاریاب</span><span class="art-num">${d.marketerPercent ? d.marketerPercent + '%' : '-'}</span></div>
                    <div class="art-row"><span>حد سفارش (ورود)</span><span class="art-num">${H.fmt(d.maxCostOrderBy)}</span></div>
                    <div class="art-row"><span>حد سفارش (خروج)</span><span class="art-num">${H.fmt(d.minCostOrderBy)}</span></div>
                </div>
            </div>

            <!-- ═══ آمار حرکات ═══ -->
            <div class="art-card art-card-full art-stats-card">
                <div class="art-card-title">📊 آمار و موجودی</div>
                <div class="art-stats-grid">
                    <div class="art-stat-item">
                        <div class="art-stat-label">📥 موجودی اولیه</div>
                        <div class="art-stat-value">
                            ${H.fmt(d.amountFirst)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span>
                        </div>
                    </div>
                    <div class="art-stat-item">
                        <div class="art-stat-label">💰 ارزش اولیه</div>
                        <div class="art-stat-value art-num">${H.fmt(d.costFirst)} <span class="art-stat-unit">ریال</span></div>
                    </div>

                    <div class="art-stat-item art-stat-buy">
                        <div class="art-stat-label">📦 خرید</div>
                        <div class="art-stat-value">${H.fmt(d.inAmount1)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span></div>
                        <div class="art-stat-sub art-num">${H.fmt(d.inVal1)} ریال</div>
                    </div>
                    <div class="art-stat-item art-stat-sell">
                        <div class="art-stat-label">💸 فروش</div>
                        <div class="art-stat-value">${H.fmt(d.outAmount1)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span></div>
                        <div class="art-stat-sub art-num">${H.fmt(d.outVal1)} ریال</div>
                    </div>

                    <div class="art-stat-item art-stat-return">
                        <div class="art-stat-label">↩️ برگشت</div>
                        <div class="art-stat-value">${H.fmt(d.backAmount1)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span></div>
                        <div class="art-stat-sub art-num">${H.fmt(d.backVal1)} ریال</div>
                    </div>
                    <div class="art-stat-item art-stat-final">
                        <div class="art-stat-label">📊 موجودی فعلی</div>
                        <div class="art-stat-value" style="color:${(d.finallExistence || 0) > 0 ? '#059669' : ((d.finallExistence || 0) < 0 ? '#DC2626' : '#6B7280')};">
                            ${H.fmt(d.finallExistence)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ═══ کدینگ حسابداری ═══ -->
            <div class="art-card art-card-full">
                <div class="art-card-title">🔢 کدینگ حسابداری</div>
                <table class="art-coding-table">
                    <thead>
                        <tr>
                            <th style="width:130px;">عملیات</th>
                            <th style="width:70px;">کد کل</th>
                            <th>نام کل</th>
                            <th style="width:70px;">کد معین</th>
                            <th>نام معین</th>
                            <th style="width:70px;">کد تفصیلی</th>
                            <th>نام تفصیلی</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${codingRow('💵 فروش', d.codeCol, d.codeMoein, d.codeTafzil, lookups)}
                        ${codingRow('🛒 خرید', d.codeColBuy, d.codeMoeinBuy, d.codeTafzilBuy, lookups)}
                        ${codingRow('↩️ برگشت خرید', d.codeColReBuy, d.codeMoeinReBuy, d.codeTafzilReBuy, lookups)}
                        ${codingRow('↪️ برگشت فروش', d.codeColReSale, d.codeMoeinReSale, d.codeTafzilReSale, lookups)}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    // ⭐ یک ردیف کدینگ
    function codingRow(label, col, moein, tafzil, lookups) {
        const colName = findColName(col, lookups);
        const moeinName = findMoeinName(col, moein, lookups);
        const tafzilName = findTafzilName(tafzil, lookups);

        return `
            <tr>
                <td><strong>${label}</strong></td>
                <td class="num">${col || '-'}</td>
                <td class="art-muted">${H.esc(colName) || '-'}</td>
                <td class="num">${moein || '-'}</td>
                <td class="art-muted">${H.esc(moeinName) || '-'}</td>
                <td class="num">${tafzil || '-'}</td>
                <td class="art-muted">${H.esc(tafzilName) || '-'}</td>
            </tr>`;
    }

    function findColName(code, lookups) {
        if (!code || !lookups || !lookups.cols) return '';
        const c = lookups.cols.find(x => x.codeCol === parseInt(code));
        return c ? c.name : '';
    }

    function findMoeinName(colCode, moeinCode, lookups) {
        if (!colCode || !moeinCode || !lookups || !lookups.moeins) return '';
        const m = lookups.moeins.find(x =>
            x.codeCol === parseInt(colCode) && x.codeMoein === parseInt(moeinCode));
        return m ? m.name : '';
    }

    function findTafzilName(code, lookups) {
        if (!code || !lookups || !lookups.tafzils) return '';
        const t = lookups.tafzils.find(x => x.code === parseInt(code));
        return t ? t.name : '';
    }   

    function getStatusInfo(status) {
        const map = {
            0: { text: 'غیرفعال', cls: 'art-badge-gray' },
            1: { text: 'فعال', cls: 'art-badge-success' },
            2: { text: 'انباری', cls: 'art-badge-info' },
            3: { text: 'اموالی', cls: 'art-badge-warning' }
        };
        return map[status] || { text: 'نامشخص', cls: 'art-badge-gray' };
    }

    function getStatusInfo(status) {
        const map = {
            0: { text: 'غیرفعال', cls: 'art-badge-gray' },
            1: { text: 'فعال', cls: 'art-badge-success' },
            2: { text: 'انباری', cls: 'art-badge-info' },
            3: { text: 'اموالی', cls: 'art-badge-warning' }
        };
        return map[status] || { text: 'نامشخص', cls: 'art-badge-gray' };
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
    return {
        render: render,
        runList: runList,
        showDetail: showDetail,
        buildArticleTableHtml: buildArticleTableHtml
    };

})();

// ⭐ alias برای سازگاری با کد فعلی
window.App.renderArticleList = window.App.Features.Article.render;
window.App.runArticleList = window.App.Features.Article.runList;
window.App.showArticleDetail = window.App.Features.Article.showDetail;