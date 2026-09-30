/* ═══════════════════════════════════════════════════
   Feature / Kardex — کاردکس کالا
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Kardex = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = {
        articleId: null,
        articleInfo: null,
        result: null,
        page: 1
    };

    // ⭐ تبدیل ارقام فارسی به لاتین
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
        _state = { articleId: null, articleInfo: null, result: null, page: 1 };

        c.innerHTML = `
            <div class="card">
                <div class="card-title">🔍 فیلتر کاردکس</div>
                <div class="filters kardex-filters">
                    <div class="form-group kardex-article">
                        <label>کالا</label>
                        <div class="ff-input-with-btn">
                            <input type="text" id="kxArticleCode" class="num-input"
                                   dir="ltr" placeholder="کد کالا (اختیاری)...">
                            <button type="button" class="ff-pick-btn"
                                    id="kxPickArticleBtn" title="انتخاب کالا">🔍</button>
                        </div>
                        <div class="kx-article-name" id="kxArticleName">—</div>
                    </div>
                    <div class="form-group">
                        <label>از تاریخ</label>
                        <input type="text" id="kxDateFrom" placeholder="1404/01/01">
                    </div>
                    <div class="form-group">
                        <label>تا تاریخ</label>
                        <input type="text" id="kxDateTo" placeholder="1404/12/29">
                    </div>
                </div>
                <button class="btn btn-primary" id="kxRunBtn">📊 نمایش کاردکس</button>
            </div>
            <div id="kxResult">
                <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                    <div style="font-size:56px;opacity:0.4;">📋</div>
                    <p style="margin-top:12px;">فیلترها را تنظیم و «نمایش کاردکس» را بزنید</p>
                </div>
            </div>`;

        document.getElementById('kxPickArticleBtn').addEventListener('click', pickArticle);
        document.getElementById('kxRunBtn').addEventListener('click', function () {
            _state.page = 1;
            runReport();
        });

        const codeEl = document.getElementById('kxArticleCode');
        codeEl.addEventListener('keydown', async function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const code = (this.value || '').trim();
                if (!code) { pickArticle(); return; }
                await loadArticleByCode(code);
            }
        });

        ['kxDateFrom', 'kxDateTo'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    _state.page = 1;
                    runReport();
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════
    //  انتخاب کالا
    // ═══════════════════════════════════════════════════
    function pickArticle() {
        const existing = document.getElementById('kxArticlePicker');
        if (existing) existing.remove();

        const picker = document.createElement('div');
        picker.id = 'kxArticlePicker';
        picker.className = 'ffi-article-picker';
        picker.innerHTML = `
            <div class="ffi-picker-box">
                <div class="ffi-picker-header">
                    <span>🔍 جستجوی کالا</span>
                    <button type="button" class="ffi-picker-close">✕</button>
                </div>
                <div class="ffi-picker-search">
                    <input type="text" id="kxArticleSearch" placeholder="کد یا نام کالا...">
                </div>
                <div class="ffi-picker-list" id="kxArticleList">
                    <div class="ffi-picker-empty">برای جستجو تایپ کنید...</div>
                </div>
            </div>`;
        document.body.appendChild(picker);

        const searchInput = picker.querySelector('#kxArticleSearch');
        const listWrap = picker.querySelector('#kxArticleList');
        let _debounce = null;

        function doSearch(q) {
            const query = (q || '').trim();
            if (query.length < 1) {
                listWrap.innerHTML = '<div class="ffi-picker-empty">برای جستجو تایپ کنید...</div>';
                return;
            }
            listWrap.innerHTML = '<div class="ffi-picker-empty">در حال جستجو...</div>';

            window.App.Http.api('/api/article/list', {
                method: 'POST',
                body: JSON.stringify({
                    code: /^\d/.test(query) ? query : null,
                    name: !/^\d/.test(query) ? query : null,
                    page: 1, pageSize: 50, stockFilter: 'all'
                })
            }).then(resp => {
                renderList(resp.items || []);
            }).catch(err => {
                listWrap.innerHTML = '<div class="ffi-picker-empty">خطا: ' +
                    H.esc(err.message) + '</div>';
            });
        }

        function renderList(items) {
            if (items.length === 0) {
                listWrap.innerHTML = '<div class="ffi-picker-empty">کالایی یافت نشد</div>';
                return;
            }
            let html = '';
            items.forEach(a => {
                const stock = a.finallExistence ?? 0;
                const cls = stock > 0 ? 'positive' : (stock < 0 ? 'negative' : 'zero');
                html += `<div class="ffi-picker-item" data-id="${a.id}"
                              data-code="${a.code || ''}"
                              data-name="${H.esc(a.name || '')}"
                              data-unit="${H.esc(a.articleUnitName || '')}">
                    <span class="ffi-picker-code">${a.code || '-'}</span>
                    <div class="ffi-picker-info">
                        <div class="ffi-picker-name">${H.esc(a.name || '')}</div>
                        <div class="ffi-picker-sub">
                            واحد: ${H.esc(a.articleUnitName || '-')} •
                            موجودی: <span class="${cls}">${H.fmt(stock)}</span>
                        </div>
                    </div>
                </div>`;
            });
            listWrap.innerHTML = html;
        }

        searchInput.addEventListener('input', function () {
            clearTimeout(_debounce);
            const q = this.value;
            _debounce = setTimeout(() => doSearch(q), 300);
        });

        picker.querySelector('.ffi-picker-close').addEventListener('click', () => picker.remove());

        picker.addEventListener('click', e => {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.ffi-picker-item');
            if (!item) return;

            _state.articleId = parseInt(item.dataset.id, 10);
            _state.articleInfo = {
                code: item.dataset.code,
                name: item.dataset.name,
                unit: item.dataset.unit
            };
            document.getElementById('kxArticleCode').value = item.dataset.code || _state.articleId;
            document.getElementById('kxArticleName').textContent =
                `${item.dataset.code} — ${item.dataset.name}`;
            picker.remove();
        });

        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Escape') picker.remove();
            if (e.key === 'Enter') {
                const first = listWrap.querySelector('.ffi-picker-item');
                if (first) first.click();
            }
        });

        setTimeout(() => searchInput.focus(), 50);
    }

    async function loadArticleByCode(code) {
        try {
            const resp = await window.App.Http.api('/api/article/list', {
                method: 'POST',
                body: JSON.stringify({
                    code, page: 1, pageSize: 5, stockFilter: 'all'
                })
            });
            const exact = (resp.items || []).find(x => String(x.code) === String(code));
            const target = exact || (resp.items || [])[0];
            if (!target) {
                window.App.toast('کالایی با این کد یافت نشد', 'error');
                return;
            }
            _state.articleId = target.id;
            _state.articleInfo = {
                code: target.code, name: target.name,
                unit: target.articleUnitName
            };
            document.getElementById('kxArticleName').textContent =
                `${target.code} — ${target.name}`;
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════
    //  اجرای گزارش
    // ═══════════════════════════════════════════════════
    async function runReport() {
        const container = document.getElementById('kxResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const payload = {
            articleId: _state.articleId,
            dateFrom: toLatin(document.getElementById('kxDateFrom').value),
            dateTo: toLatin(document.getElementById('kxDateTo').value),
            page: _state.page || 1,
            pageSize: window.App.state.settings.pageSize || 50
        };

        try {
            const result = await window.App.Http.api('/api/reports/kardex', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            _state.result = result;
            await renderResult(result);
        } catch (err) {
            container.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    // ═══════════════════════════════════════════════════
    //  رندر نتیجه
    // ═══════════════════════════════════════════════════
    async function renderResult(r) {
        const c = document.getElementById('kxResult');
        const hasArticleFilter = !!r.articleId;
        const showArticleCol = !hasArticleFilter;

        const rowsHtml = (r.items || []).map(it => {
            const inCls = it.inQty > 0 ? 'kx-in' : '';
            const outCls = it.outQty > 0 ? 'kx-out' : '';
            const balCls = it.balance < 0 ? 'negative' : '';
            const isOpening = it.docType === 'موجودی اولیه';
            const rowCls = isOpening ? 'kx-opening-row' : '';

            const articleCell = showArticleCol
                ? `<td class="kx-article-cell" title="${H.esc(it.articleName || '')}">
                       <div>${H.esc(it.articleName || '')}</div>
                       <small class="num">${H.esc(it.articleCode || '')}</small>
                   </td>`
                : '';

            return `<tr class="${rowCls}">
                <td class="text-center">${it.rowNum}</td>
                ${articleCell}
                <td class="num text-center">${H.esc(it.date || '')}</td>
                <td class="text-center">${H.esc(it.docType || '')}</td>
                <td class="num text-center">${it.docNo ? it.docNo : '-'}</td>
                <td class="kx-descript" title="${H.esc(it.descript || '')}">${H.esc(it.descript || '')}</td>
                <td class="kx-hesab" title="${H.esc(it.hesabName || '')}">${H.esc(it.hesabName || '')}</td>
                <td class="num text-left ${inCls}">${it.inQty ? H.fmt(it.inQty) : ''}</td>
                <td class="num text-left ${outCls}">${it.outQty ? H.fmt(it.outQty) : ''}</td>
                <td class="num text-left"><strong class="${balCls}">${H.fmt(it.balance)}</strong></td>
                <td class="num text-left">${it.unitCost ? H.fmt(it.unitCost) : ''}</td>
                <td class="num text-left">${it.inValue ? H.fmt(it.inValue) : ''}</td>
                <td class="num text-left">${it.outValue ? H.fmt(it.outValue) : ''}</td>
                <td class="num text-left">${H.fmt(it.balanceValue)}</td>
            </tr>`;
        }).join('');

        const totalCols = showArticleCol ? 14 : 13;
        const emptyRows = !r.items || r.items.length === 0
            ? `<tr><td colspan="${totalCols}" class="text-center" style="padding:30px;color:#94A3B8;">حرکتی یافت نشد</td></tr>`
            : '';

        const articleTh = showArticleCol
            ? '<th style="width:160px;">کالا</th>'
            : '';

        c.innerHTML = `
            ${hasArticleFilter ? `
            <div class="card kx-info-card">
                <div class="kx-info-grid">
                    <div class="kx-info-item"><span class="kx-info-label">کالا:</span><strong>${H.esc(r.articleName || '-')}</strong></div>
                    <div class="kx-info-item"><span class="kx-info-label">کد:</span><strong class="num">${H.esc(r.articleCode || '-')}</strong></div>
                    <div class="kx-info-item"><span class="kx-info-label">انبار:</span><strong>${H.esc(r.stockTypeName || '-')}</strong></div>
                    <div class="kx-info-item"><span class="kx-info-label">گروه:</span><strong>${H.esc(r.articleGroupName || '-')}</strong></div>
                    <div class="kx-info-item"><span class="kx-info-label">واحد:</span><strong>${H.esc(r.articleUnitName || '-')}</strong></div>
                </div>
            </div>` : ''}

            <div class="kx-stats">
                <div class="kx-stat kx-stat-first">
                    <div class="kx-stat-label">📥 موجودی اولیه</div>
                    <div class="kx-stat-value">${H.fmt(r.amountFirst)} <span class="unit">${H.esc(r.articleUnitName || '')}</span></div>
                    <div class="kx-stat-sub">${H.fmt(r.costFirst)} ریال</div>
                </div>
                <div class="kx-stat kx-stat-in">
                    <div class="kx-stat-label">⬆️ جمع ورودی</div>
                    <div class="kx-stat-value">${H.fmt(r.totalInQty)} <span class="unit">${H.esc(r.articleUnitName || '')}</span></div>
                </div>
                <div class="kx-stat kx-stat-out">
                    <div class="kx-stat-label">⬇️ جمع خروجی</div>
                    <div class="kx-stat-value">${H.fmt(r.totalOutQty)} <span class="unit">${H.esc(r.articleUnitName || '')}</span></div>
                </div>
                <div class="kx-stat kx-stat-final">
                    <div class="kx-stat-label">📊 موجودی نهایی</div>
                    <div class="kx-stat-value">${H.fmt(r.finalQty)} <span class="unit">${H.esc(r.articleUnitName || '')}</span></div>
                    <div class="kx-stat-sub">${H.fmt(r.finalValue)} ریال</div>
                </div>
                <div class="kx-stat kx-stat-avg">
                    <div class="kx-stat-label">💵 میانگین قیمت</div>
                    <div class="kx-stat-value">${H.fmt(r.avgUnitCost)} <span class="unit">ریال</span></div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">
                    <span>📋 ${hasArticleFilter ? 'کاردکس کالا' : 'کاردکس همه‌ی کالاها'} (${H.fmt(r.totalCount || (r.items || []).length)})</span>
                </div>
                <div class="table-wrapper kx-table-wrap">
                    <table class="kx-table">
                        <thead>
                            <tr>
                                <th style="width:40px;" data-nosort>#</th>
                                ${articleTh}
                                <th style="width:90px;">تاریخ</th>
                                <th style="width:110px;">نوع سند</th>
                                <th style="width:70px;">شماره</th>
                                <th>شرح</th>
                                <th>طرف حساب</th>
                                <th class="text-left" style="width:80px;">ورود</th>
                                <th class="text-left" style="width:80px;">خروج</th>
                                <th class="text-left" style="width:90px;">مانده</th>
                                <th class="text-left" style="width:90px;">قیمت واحد</th>
                                <th class="text-left" style="width:100px;">ارزش ورود</th>
                                <th class="text-left" style="width:100px;">ارزش خروج</th>
                                <th class="text-left" style="width:110px;">ارزش مانده</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml || emptyRows}</tbody>
                    </table>
                </div>
                <div id="kxPagination"></div>
                <div id="kxExportSlot"></div>
            </div>
        `;

        // ⭐ صفحه‌بندی
        if (r.totalPages > 1) {
            const pgEl = document.getElementById('kxPagination');
            if (pgEl) pgEl.innerHTML = buildPagination(r.page, r.totalPages, r.totalCount, (r.items || []).length);
        }

        // ⭐ گرفتن داده‌ی کامل برای Export
        let exportData = r;
        if (r.totalPages > 1) {
            try {
                const full = await window.App.Http.api('/api/reports/kardex', {
                    method: 'POST',
                    body: JSON.stringify({
                        articleId: _state.articleId,
                        dateFrom: toLatin(document.getElementById('kxDateFrom').value),
                        dateTo: toLatin(document.getElementById('kxDateTo').value),
                        page: 1,
                        pageSize: 1000000
                    })
                });
                exportData = full;
            } catch (e) {
                console.warn('خطا در گرفتن داده‌ی کامل برای Export:', e);
            }
        }

        // ⭐ Export/Print
        if (typeof Exporter !== 'undefined' && Exporter.attach) {
            Exporter.attach(document.getElementById('kxResult'), {
                title: hasArticleFilter
                    ? 'کاردکس کالا — ' + (r.articleName || '')
                    : 'کاردکس همه‌ی کالاها',
                subtitle: subtitle(r),
                filename: 'Kardex_' + (r.articleCode || 'All'),
                customHtml: function () { return buildKardexPrintHtml(exportData); }
            });
        }

        if (window.App.enhanceTables) {
            window.App.enhanceTables(document.getElementById('kxResult'));
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
                            onclick="App.Features.Kardex.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">
                نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} ردیف
            </div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.Kardex.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                        onclick="App.Features.Kardex.goToPage(${page - 1})">‹ قبلی</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.Kardex.goToPage(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                        onclick="App.Features.Kardex.goToPage(${totalPages})">»</button>
            </div>
        </div>`;
    }

    function goToPage(p) {
        _state.page = p;
        runReport();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ═══════════════════════════════════════════════════
    //  Print HTML
    // ═══════════════════════════════════════════════════
    function buildKardexPrintHtml(r) {
        const hasArticleFilter = !!r.articleId;
        const showArticleCol = !hasArticleFilter;

        const header = `
        <table class="factor-info-table" style="margin-bottom:10px;">
            <tr>
                <td class="label">${hasArticleFilter ? 'کالا:' : 'گزارش:'}</td>
                <td>${hasArticleFilter ? H.esc(r.articleName || '-') : 'کاردکس همه‌ی کالاها'}</td>
                ${hasArticleFilter ? `
                    <td class="label">کد:</td><td>${H.esc(r.articleCode || '-')}</td>
                    <td class="label">انبار:</td><td>${H.esc(r.stockTypeName || '-')}</td>
                    <td class="label">واحد:</td><td>${H.esc(r.articleUnitName || '-')}</td>` : ''}
            </tr>
            <tr>
                <td class="label">موجودی اولیه:</td><td>${H.fmt(r.amountFirst)}</td>
                <td class="label">جمع ورودی:</td><td>${H.fmt(r.totalInQty)}</td>
                <td class="label">جمع خروجی:</td><td>${H.fmt(r.totalOutQty)}</td>
                <td class="label">موجودی نهایی:</td><td>${H.fmt(r.finalQty)}</td>
            </tr>
        </table>`;

        const rows = (r.items || []).map(it => `
        <tr>
            <td class="text-center">${it.rowNum}</td>
            ${showArticleCol
                ? `<td>${H.esc(it.articleName || '')} <small>(${H.esc(it.articleCode || '')})</small></td>`
                : ''}
            <td class="text-center">${H.esc(it.date || '')}</td>
            <td class="text-center">${H.esc(it.docType || '')}</td>
            <td class="text-center">${it.docNo || '-'}</td>
            <td>${H.esc(it.descript || '')}</td>
            <td>${H.esc(it.hesabName || '')}</td>
            <td class="text-left">${it.inQty ? H.fmt(it.inQty) : ''}</td>
            <td class="text-left">${it.outQty ? H.fmt(it.outQty) : ''}</td>
            <td class="text-left"><strong>${H.fmt(it.balance)}</strong></td>
            <td class="text-left">${it.unitCost ? H.fmt(it.unitCost) : ''}</td>
            <td class="text-left">${it.inValue ? H.fmt(it.inValue) : ''}</td>
            <td class="text-left">${it.outValue ? H.fmt(it.outValue) : ''}</td>
            <td class="text-left">${H.fmt(it.balanceValue)}</td>
        </tr>`).join('');

        const table = `
        <table>
            <thead><tr>
                <th style="width:30px;">#</th>
                ${showArticleCol ? '<th style="width:130px;">کالا</th>' : ''}
                <th style="width:80px;">تاریخ</th>
                <th style="width:100px;">نوع سند</th>
                <th style="width:60px;">شماره</th>
                <th>شرح</th>
                <th>طرف حساب</th>
                <th style="width:70px;">ورود</th>
                <th style="width:70px;">خروج</th>
                <th style="width:80px;">مانده</th>
                <th style="width:80px;">قیمت واحد</th>
                <th style="width:90px;">ارزش ورود</th>
                <th style="width:90px;">ارزش خروج</th>
                <th style="width:90px;">ارزش مانده</th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="14" class="text-center">ردیفی نیست</td></tr>'}</tbody>
        </table>`;

        return header + table;
    }

    function subtitle(r) {
        const u = window.App.state.user || {};
        const base = (u.orgName || '') + ' - ' + (u.fyName || '');
        return base + (r.articleId ? ' | کالا: ' + (r.articleName || '') : ' | همه‌ی کالاها');
    }

    // ═══════════════════════════════════════════════════
    return { render, runReport, goToPage };
})();

window.App.renderKardex = window.App.Features.Kardex.render;