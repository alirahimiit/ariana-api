/* ═══════════════════════════════════════════════════
   Feature / Article (کالاها)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Article = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════
    //  RENDER — صفحه فیلتر + نتیجه
    // ═══════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>`;

        let lookups = { groups: [], stockTypes: [] };
        try {
            lookups = await window.App.Http.api('/api/article/lookups') || lookups;
        } catch (err) {
            console.error('lookup load failed:', err);
        }

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

        document.getElementById('artBtnRun').addEventListener('click', () => runList(1));
        document.getElementById('artBtnFixCoding').addEventListener('click', fixCoding);

        ['artCode', 'artName', 'artTaxId'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keydown', e => {
                if (e.key === 'Enter') runList(1);
            });
        });

        runList(1);
    }

    // ⭐ اصلاح کدینگ‌ها با SP
    async function fixCoding() {
        if (!await window.App.confirm(
            'آیا از اصلاح کدینگ همه کالاها مطمئن هستید؟\n(ممکن است کمی طول بکشد)',
            { title: 'اصلاح کدینگ', okText: 'بله، اصلاح کن' }
        )) return;

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
        const _sort = window.App.Features.Article._sort || { by: 'code', dir: 'asc' };
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
            stockFilter: 'all',
            page: page,
            sortBy: _sort.by,
            sortDir: _sort.dir,
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

        const rows = items.map((a, idx) => `
            <tr>
                <td class="text-center" style="font-size:11px;">${(data.page - 1) * data.pageSize + idx + 1}</td>
                <td class="num text-center" style="font-weight:600;">${a.code || ''}</td>
                <td class="num text-center" style="font-size:11px;">${a.taxId || '-'}</td>
                <td>${H.esc(a.name || '')}</td>
                <td class="text-center">${H.esc(a.articleUnitName || '-')}</td>
                <td class="text-center">${H.esc(a.articleUnitName2 || '-')}</td>
                <td class="text-center">${H.esc(a.articleUnitName3 || '-')}</td>
                <td class="num text-center">${a.articleGroupCode || '-'}</td>
                <td>${H.esc(a.articleGroupName || '-')}</td>
                <td class="num text-center">${a.stockTypeCode || '-'}</td>
                <td>${H.esc(a.stockTypeName || '-')}</td>
                <td class="text-center">${H.esc(a.statusName || '-')}</td>
                <td class="num text-left">${H.fmtT(a.amountFirst)}</td>
                <td class="num text-left">${H.fmtT(a.costFirst)}</td>
                <td class="text-center" style="font-size:11px;">${H.esc(a.depreciationTypeName || '-')}</td>
                <td class="num text-left">${a.depreciation ?? '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeCol || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeMoein || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeTafzil || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeColBuy || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeMoeinBuy || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeTafzilBuy || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeColReBuy || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeMoeinReBuy || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeTafzilReBuy || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeColReSale || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeMoeinReSale || '-'}</td>
                <td class="num text-center" style="font-family:Consolas,monospace;">${a.codeTafzilReSale || '-'}</td>
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
        `).join('');

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
                        <tr style="background:#EEF2FF;">
                            <th rowspan="2" style="background:#EEF2FF; color:#4338CA; text-align:center; vertical-align:middle;">#</th>
                            <th rowspan="2" data-sort-key="code" style="background:#EEF2FF; color:#4338CA; text-align:center; vertical-align:middle;">کد</th>
                            <th rowspan="2" style="background:#EEF2FF; color:#4338CA; text-align:center; vertical-align:middle;">شناسه مالیاتی</th>
                            <th colspan="1" style="background:#EEF2FF; color:#4338CA; text-align:center;">مشخصات کالا</th>
                            <th colspan="3" style="background:#EEF2FF; color:#4338CA; text-align:center;">واحد شمارش کالا</th>
                            <th colspan="5" style="background:#EEF2FF; color:#4338CA; text-align:center;">اطلاعات انبار</th>
                            <th colspan="2" style="background:#EEF2FF; color:#4338CA; text-align:center;">موجودی اولیه</th>
                            <th colspan="2" style="background:#EEF2FF; color:#4338CA; text-align:center;">استهلاک</th>
                            <th colspan="3" style="background:#EEF2FF; color:#4338CA; text-align:center;">فروش</th>
                            <th colspan="3" style="background:#EEF2FF; color:#4338CA; text-align:center;">خرید</th>
                            <th colspan="3" style="background:#EEF2FF; color:#4338CA; text-align:center;">برگشت خرید</th>
                            <th colspan="3" style="background:#EEF2FF; color:#4338CA; text-align:center;">برگشت فروش</th>
                            <th rowspan="2" style="background:#EEF2FF; color:#4338CA; text-align:center; vertical-align:middle;">عملیات</th>
                        </tr>
                        <tr style="background:#F9FAFB;">
                            <th data-sort-key="name">عنوان کالا</th>
                            <th data-sort-key="unitname">اول</th>
                            <th>دوم</th>
                            <th>سوم</th>
                            <th data-sort-key="groupcode">کد گروه</th>
                            <th>عنوان گروه</th>
                            <th data-sort-key="stocktypecode">کد انبار</th>
                            <th>عنوان انبار</th>
                            <th data-sort-key="statusname">وضعیت</th>
                            <th data-sort-key="amountfirst">مقدار</th>
                            <th data-sort-key="costfirst">ریالی</th>
                            <th>نوع</th>
                            <th>درصد</th>
                            <th>کل</th><th>معین</th><th>تفصیل</th>
                            <th>کل</th><th>معین</th><th>تفصیل</th>
                            <th>کل</th><th>معین</th><th>تفصیل</th>
                            <th>کل</th><th>معین</th><th>تفصیل</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>`;

        // ⭐ سورت روی هدرها (با data-sort-key)
        const _sort = window.App.Features.Article._sort || { by: 'code', dir: 'asc' };
        container.querySelectorAll('th[data-sort-key]').forEach(th => {
            const key = th.dataset.sortKey;
            th.classList.add('sortable-th');
            th.style.cursor = 'pointer';

            if (_sort.by === key) {
                th.textContent = th.textContent.replace(/[▲▼]/g, '').trim() + (_sort.dir === 'asc' ? ' ▲' : ' ▼');
            }

            th.addEventListener('click', () => {
                const newDir = (_sort.by === key && _sort.dir === 'asc') ? 'desc' : 'asc';
                window.App.Features.Article._sort = { by: key, dir: newDir };
                runList(1);
            });
        });

        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(container);
        }

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
        items.forEach((a, idx) => {
            rows += '<tr>' +
                '<td>' + (idx + 1) + '</td>' +
                '<td>' + (a.code || '') + '</td>' +
                '<td>' + (a.taxId || '-') + '</td>' +
                '<td>' + H.esc(a.name || '') + '</td>' +
                '<td>' + H.esc(a.articleUnitName || '-') + '</td>' +
                '<td>' + H.esc(a.articleUnitName2 || '-') + '</td>' +
                '<td>' + H.esc(a.articleUnitName3 || '-') + '</td>' +
                '<td>' + (a.articleGroupCode || '-') + '</td>' +
                '<td>' + H.esc(a.articleGroupName || '-') + '</td>' +
                '<td>' + (a.stockTypeCode || '-') + '</td>' +
                '<td>' + H.esc(a.stockTypeName || '-') + '</td>' +
                '<td>' + H.esc(a.statusName || '-') + '</td>' +
                '<td>' + H.fmtT(a.amountFirst) + '</td>' +
                '<td>' + H.fmtT(a.costFirst) + '</td>' +
                '<td>' + H.esc(a.depreciationTypeName || '-') + '</td>' +
                '<td>' + (a.depreciation ?? '-') + '</td>' +
                '<td>' + (a.codeCol || '-') + '</td>' +
                '<td>' + (a.codeMoein || '-') + '</td>' +
                '<td>' + (a.codeTafzil || '-') + '</td>' +
                '<td>' + (a.codeColBuy || '-') + '</td>' +
                '<td>' + (a.codeMoeinBuy || '-') + '</td>' +
                '<td>' + (a.codeTafzilBuy || '-') + '</td>' +
                '<td>' + (a.codeColReBuy || '-') + '</td>' +
                '<td>' + (a.codeMoeinReBuy || '-') + '</td>' +
                '<td>' + (a.codeTafzilReBuy || '-') + '</td>' +
                '<td>' + (a.codeColReSale || '-') + '</td>' +
                '<td>' + (a.codeMoeinReSale || '-') + '</td>' +
                '<td>' + (a.codeTafzilReSale || '-') + '</td>' +
                '</tr>';
        });

        const table = document.createElement('table');
        table.innerHTML =
            '<thead>' +
            '<tr>' +
            '<th rowspan="2">#</th>' +
            '<th rowspan="2">کد</th>' +
            '<th rowspan="2">شناسه مالیاتی</th>' +
            '<th>مشخصات کالا</th>' +
            '<th colspan="3">واحد شمارش</th>' +
            '<th colspan="5">اطلاعات انبار</th>' +
            '<th colspan="2">موجودی اولیه</th>' +
            '<th colspan="2">استهلاک</th>' +
            '<th colspan="3">فروش</th>' +
            '<th colspan="3">خرید</th>' +
            '<th colspan="3">برگشت خرید</th>' +
            '<th colspan="3">برگشت فروش</th>' +
            '</tr>' +
            '<tr>' +
            '<th>عنوان کالا</th>' +
            '<th>اول</th><th>دوم</th><th>سوم</th>' +
            '<th>کد گروه</th><th>عنوان گروه</th>' +
            '<th>کد انبار</th><th>عنوان انبار</th><th>وضعیت</th>' +
            '<th>مقدار</th><th>ریالی</th>' +
            '<th>نوع</th><th>درصد</th>' +
            '<th>کل</th><th>معین</th><th>تفصیل</th>' +
            '<th>کل</th><th>معین</th><th>تفصیل</th>' +
            '<th>کل</th><th>معین</th><th>تفصیل</th>' +
            '<th>کل</th><th>معین</th><th>تفصیل</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>';
        return table;
    }


    function buildPagination(page, totalPages, totalCount, itemCount) {
        if (totalPages <= 1) {
            return `
                <div class="pagination-bar">
                    <div class="pagination-info">مجموع: ${H.fmtT(totalCount)} کالا</div>
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
                    نمایش ${H.fmtT(itemCount)} از ${H.fmtT(totalCount)} کالا
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
    //  SHOW DETAIL — modal
    // ═══════════════════════════════════════════
    async function showDetail(articleId) {
        window.App.openModal('جزئیات کالا',
            `<div class="loading"><div class="spinner"></div></div>`);

        try {
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
                    <div class="art-row"><span>موجودی اول دوره</span><span class="art-num">${H.fmtT(d.firstExistence)}</span></div>
                    <div class="art-row"><span>ورودی</span><span class="art-num art-green">${H.fmtT(d.inputed)}</span></div>
                    <div class="art-row"><span>خروجی</span><span class="art-num art-red">${H.fmtT(d.outPuted)}</span></div>
                    <div class="art-row art-row-hl"><span>موجودی فعلی</span><span class="art-num">${H.fmtT(d.finallExistence)}</span></div>
                </div>

                <div class="art-card">
                    <div class="art-card-title">💰 قیمت‌ها</div>
                    <div class="art-row"><span>موجودی اولیه</span><span class="art-num">${H.fmtT(d.amountFirst)}</span></div>
                    <div class="art-row"><span>بهای اولیه</span><span class="art-num">${H.fmtT(d.costFirst)}</span></div>
                    <div class="art-row art-row-hl"><span>قیمت فروش</span><span class="art-num">${H.fmtT(d.amountSale)}</span></div>
                </div>

                <div class="art-card">
                    <div class="art-card-title">⚙️ تنظیمات</div>
                    <div class="art-row"><span>درصد بازاریاب</span><span class="art-num">${d.marketerPercent ? d.marketerPercent + '%' : '-'}</span></div>
                    <div class="art-row"><span>حد سفارش (ورود)</span><span class="art-num">${H.fmtT(d.maxCostOrderBy)}</span></div>
                    <div class="art-row"><span>حد سفارش (خروج)</span><span class="art-num">${H.fmtT(d.minCostOrderBy)}</span></div>
                </div>
            </div>

            <div class="art-card art-card-full art-stats-card">
                <div class="art-card-title">📊 آمار و موجودی</div>
                <div class="art-stats-grid">
                    <div class="art-stat-item">
                        <div class="art-stat-label">📥 موجودی اولیه</div>
                        <div class="art-stat-value">
                            ${H.fmtT(d.amountFirst)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span>
                        </div>
                    </div>
                    <div class="art-stat-item">
                        <div class="art-stat-label">💰 ارزش اولیه</div>
                        <div class="art-stat-value art-num">${H.fmtT(d.costFirst)} <span class="art-stat-unit">ریال</span></div>
                    </div>

                    <div class="art-stat-item art-stat-buy">
                        <div class="art-stat-label">📦 خرید</div>
                        <div class="art-stat-value">${H.fmtT(d.inVal1)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span></div>
                        <div class="art-stat-sub art-num">${H.fmtT(d.inAmount1)} ریال</div>
                    </div>
                    <div class="art-stat-item art-stat-sell">
                        <div class="art-stat-label">💸 فروش</div>
                        <div class="art-stat-value">${H.fmtT(d.outVal1)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span></div>
                        <div class="art-stat-sub art-num">${H.fmtT(d.outAmount1)} ریال</div>
                    </div>
                    <div class="art-stat-item art-stat-return">
                        <div class="art-stat-label">↩️ برگشت</div>
                        <div class="art-stat-value">${H.fmtT(d.backVal1)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span></div>
                        <div class="art-stat-sub art-num">${H.fmtT(d.backAmount1)} ریال</div>
                    </div>
                    <div class="art-stat-item art-stat-final">
                        <div class="art-stat-label">📊 موجودی فعلی</div>
                        <div class="art-stat-value" style="color:${(d.finallExistence || 0) > 0 ? '#059669' : ((d.finallExistence || 0) < 0 ? '#DC2626' : '#6B7280')};">
                            ${H.fmtT(d.finallExistence)} <span class="art-stat-unit">${H.esc(d.articleUnitName || '')}</span>
                        </div>
                    </div>
                </div>
            </div>

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
                    <td class="num text-left">${H.fmtT(d.firstExistence)}</td>
                    <td class="label">ورودی:</td>
                    <td class="num text-left">${H.fmtT(d.inputed)}</td>
                    <td class="label">خروجی:</td>
                    <td class="num text-left">${H.fmtT(d.outPuted)}</td>
                </tr>
                <tr>
                    <td class="label">ضایعات ۱:</td>
                    <td class="num text-left">${H.fmtT(d.loss1)}</td>
                    <td class="label">ضایعات ۲:</td>
                    <td class="num text-left">${H.fmtT(d.loss2)}</td>
                    <td class="label">موجودی فعلی:</td>
                    <td class="num text-left" style="font-weight:bold; color:#4F46E5;">${H.fmtT(d.finallExistence)}</td>
                </tr>
            </table>

            <div class="section-title">💰 قیمت‌ها</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">موجودی اولیه:</td>
                    <td class="num text-left">${H.fmtT(d.amountFirst)}</td>
                    <td class="label">بهای اولیه:</td>
                    <td class="num text-left">${H.fmtT(d.costFirst)}</td>
                    <td class="label">قیمت فروش:</td>
                    <td class="num text-left" style="font-weight:bold;">${H.fmtT(d.amountSale)}</td>
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
                    <td class="num text-left">${H.fmtT(d.maxCostOrderBy)}</td>
                    <td class="label">حد سفارش (خروج):</td>
                    <td class="num text-left">${H.fmtT(d.minCostOrderBy)}</td>
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

    return {
        render: render,
        runList: runList,
        showDetail: showDetail,
        buildArticleTableHtml: buildArticleTableHtml
    };

})();

window.App.renderArticleList = window.App.Features.Article.render;
window.App.runArticleList = window.App.Features.Article.runList;
window.App.showArticleDetail = window.App.Features.Article.showDetail;