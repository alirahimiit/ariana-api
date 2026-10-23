/* ═══════════════════════════════════════════════════
   Feature / Stock — رسید/حواله/رسید برگشتی انبار
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Stock = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;

    const KIND_TITLES = {
        0: { single: 'رسید انبار', plural: 'رسیدهای انبار', icon: '📨' },
        1: { single: 'حواله انبار', plural: 'حواله‌های انبار', icon: '🔄' },
        2: { single: 'رسید برگشتی', plural: 'رسیدهای برگشتی', icon: '📩' }
    };

    // ⭐ استیت سورت
    let _state = { kind: 0, page: 1, result: null, sortBy: 'Code', sortDir: 'desc' };

    function toLatin(s) {
        if (!s) return null;
        if (H.toLatinDigits) return H.toLatinDigits(s.trim()) || null;
        return s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim() || null;
    }

    // ⭐ آیکون سورت
    function sortIcon(field) {
        if (_state.sortBy !== field) return '<span style="opacity:0.3;font-size:10px;">⇅</span>';
        return _state.sortDir === 'asc'
            ? '<span style="color:#4F46E5;font-size:10px;">▲</span>'
            : '<span style="color:#4F46E5;font-size:10px;">▼</span>';
    }

    function render(kind) {
        _state.kind = (kind === 1 || kind === 2) ? kind : 0;
        _state.page = 1;
        const meta = KIND_TITLES[_state.kind];

        const c = document.getElementById('content');
        c.innerHTML = `
        <div class="card filter-card" id="stkFilterCard">
            <div class="card-title" id="stkToggleBtn">
                <span>${meta.icon} فیلتر ${meta.plural}</span>
                <span class="ft-icon">▼</span>
            </div>
            <div class="filter-body" id="stkFilterBody">
                <div class="filters two-rows">
                    <div class="form-group">
                        <label>از تاریخ</label>
                        <input type="text" id="stkDateFrom" placeholder="1404/01/01">
                    </div>
                    <div class="form-group">
                        <label>تا تاریخ</label>
                        <input type="text" id="stkDateTo" placeholder="1404/12/29">
                    </div>
                    <div class="form-group">
                        <label>شماره سیستمی از</label>
                        <input type="text" id="stkCodeFrom" dir="ltr">
                    </div>
                    <div class="form-group">
                        <label>شماره سیستمی تا</label>
                        <input type="text" id="stkCodeTo" dir="ltr">
                    </div>
                    <div class="form-group">
                        <label>شرح</label>
                        <input type="text" id="stkDes">
                    </div>
                    <div class="form-group">
                        <label>وضعیت سند</label>
                        ${CS.html('stkVazeit', [
            { value: '', label: 'همه' },
            { value: '-1', label: 'بدون سند' },
            { value: '0', label: 'پیش‌نویس' },
            { value: '2', label: 'قطعی' }
        ], '')}
                    </div>
                </div>
                <div style="margin-top:14px; display:flex; gap:8px;">
                    <button class="btn btn-primary" id="stkRunBtn">🔍 نمایش</button>
                    <button class="btn btn-success" id="stkNewBtn">
                        ➕ ${meta.single} جدید
                    </button>
                </div>
            </div>
        </div>
        <div id="stkResult"></div>`;

        const card = document.getElementById('stkFilterCard');
        document.getElementById('stkToggleBtn').addEventListener('click', () => card.classList.toggle('collapsed'));

        CS.bindAll(c, { stkVazeit: () => { _state.page = 1; runReport(); } });

        document.getElementById('stkRunBtn').addEventListener('click', () => { _state.page = 1; runReport(); });
        document.getElementById('stkNewBtn').addEventListener('click', openNewForm);

        ['stkDateFrom', 'stkDateTo', 'stkCodeFrom', 'stkCodeTo', 'stkDes'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') { _state.page = 1; runReport(); } });
        });

        runReport();
    }

    async function runReport() {
        const container = document.getElementById('stkResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const vazeitStr = CS.getValue('stkVazeit');
        const payload = {
            kind: _state.kind,
            dateFrom: toLatin(document.getElementById('stkDateFrom').value),
            dateTo: toLatin(document.getElementById('stkDateTo').value),
            codeFrom: toLatin(document.getElementById('stkCodeFrom').value),
            codeTo: toLatin(document.getElementById('stkCodeTo').value),
            descript: document.getElementById('stkDes').value || null,
            vazeit: vazeitStr === '' ? null : parseInt(vazeitStr, 10),
            page: _state.page,
            pageSize: window.App.state.settings.pageSize || 50,
            sortBy: _state.sortBy,
            sortDir: _state.sortDir
        };

        try {
            const r = await window.App.Http.api('/api/stock/list', { method: 'POST', body: JSON.stringify(payload) });
            _state.result = r;
            renderResult(r);
        } catch (err) {
            container.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function renderResult(r) {
        const meta = KIND_TITLES[_state.kind];
        const items = r.items || [];
        const c = document.getElementById('stkResult');

        const rows = items.map((it, idx) => {
            const rowNum = (r.page - 1) * r.pageSize + idx + 1;
            const vazeitCls = it.vazeit === 2 ? 'badge-success' : it.vazeit === 0 ? 'badge-warning' : 'badge-muted';
            const canEdit = (it.vazeit ?? -1) !== 2 && !it.tolidId;

            return `<tr data-id="${it.id}">
                <td class="text-center">${rowNum}</td>
                <td class="num text-center">${it.specialCode || '-'}</td>
                <td class="num text-center">${it.code || '-'}</td>
                <td class="num text-center">${H.esc(it.dateIn || '')}</td>
                <td>${H.esc(it.stockTypeName || '')}</td>
                <td>${H.esc(it.des || '')}</td>
                <td class="text-center">${it.rowCount}</td>
                <td class="num text-left">${H.fmt(it.totalAmount)}</td>
                <td class="num text-center">${it.noSanad || '-'}</td>
                <td class="num text-center">${it.noFactor || '-'}</td>
                <td class="text-center"><span class="badge ${vazeitCls}">${H.esc(it.vazeitTitle || '')}</span></td>
                <td class="text-center stk-actions">
                    <button class="btn-icon" data-action="edit" data-id="${it.id}" title="ویرایش" ${canEdit ? '' : 'disabled'}>✏️</button>
                    <button class="btn-icon" data-action="delete" data-id="${it.id}" title="حذف" ${canEdit ? '' : 'disabled'}>🗑️</button>
                    <button class="btn-icon" data-action="print" data-id="${it.id}" title="چاپ">🖨️</button>
                </td>
            </tr>`;
        }).join('');

        const empty = items.length === 0
            ? `<tr><td colspan="12" class="text-center" style="padding:30px;color:#94A3B8;">${meta.plural} یافت نشد</td></tr>` : '';

        c.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>📋 لیست ${meta.plural} (${H.fmt(r.totalCount)})</span>
                </div>
                <div class="table-wrapper">
                    <table class="data-table" id="stkTable">
                        <thead>
                            <tr>
                                <th style="width:35px;" data-nosort>#</th>
                                <th style="width:70px;" class="sortable-th" onclick="App.Features.Stock.sortBy('SpecialCode')">شماره ${sortIcon('SpecialCode')}</th>
                                <th style="width:80px;" class="sortable-th" onclick="App.Features.Stock.sortBy('Code')">سیستمی ${sortIcon('Code')}</th>
                                <th style="width:90px;" class="sortable-th" onclick="App.Features.Stock.sortBy('DateIn')">تاریخ ${sortIcon('DateIn')}</th>
                                <th style="width:110px;" class="sortable-th" onclick="App.Features.Stock.sortBy('StockTypeName')">انبار ${sortIcon('StockTypeName')}</th>
                                <th>شرح</th>
                                <th style="width:50px;" data-nosort>ردیف</th>
                                <th class="text-left" style="width:110px;" class="sortable-th" onclick="App.Features.Stock.sortBy('TotalAmount')">مبلغ ${sortIcon('TotalAmount')}</th>
                                <th style="width:70px;" data-nosort>سند</th>
                                <th style="width:70px;" data-nosort>فاکتور</th>
                                <th style="width:80px;" data-nosort>وضعیت</th>
                                <th style="width:100px;" data-nosort>عملیات</th>
                            </tr>
                        </thead>
                        <tbody>${rows || empty}</tbody>
                    </table>
                </div>
                <div id="stkPagination"></div>
                <div id="stkExportSlot"></div>
            </div>`;

        if (r.totalPages > 1) {
            document.getElementById('stkPagination').innerHTML = buildPagination(r.page, r.totalPages, r.totalCount, items.length);
        }

        bindActions();

        if (typeof Exporter !== 'undefined' && Exporter.attach && items.length > 0) {
            Exporter.attach(document.getElementById('stkResult'), {
                title: `لیست ${meta.plural}`,
                subtitle: (window.App.state.user?.orgName || '') + ' - ' + (window.App.state.user?.fyName || ''),
                filename: `Stock_${_state.kind}`,
                customHtml: function () {
                    return `
                    <h3>لیست ${meta.plural}</h3>
                    <table border="1" style="width:100%; border-collapse:collapse; text-align:center;">
                        <thead>
                            <tr style="background:#f0f0f0;">
                                <th>ردیف</th><th>شماره</th><th>سیستمی</th><th>تاریخ</th>
                                <th>انبار</th><th>شرح</th><th>تعداد ردیف</th><th>مبلغ</th>
                                <th>سند</th><th>فاکتور</th><th>وضعیت</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((it, i) => `
                                <tr>
                                    <td>${(r.page - 1) * r.pageSize + i + 1}</td>
                                    <td>${it.specialCode || ''}</td>
                                    <td>${it.code || ''}</td>
                                    <td>${it.dateIn || ''}</td>
                                    <td>${it.stockTypeName || ''}</td>
                                    <td>${it.des || ''}</td>
                                    <td>${it.rowCount}</td>
                                    <td>${H.fmt(it.totalAmount)}</td>
                                    <td>${it.noSanad || ''}</td>
                                    <td>${it.noFactor || ''}</td>
                                    <td>${it.vazeitTitle || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
                }
            });
        }
    }

    function bindActions() {
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async function () {
                const action = this.dataset.action;
                const id = parseInt(this.dataset.id, 10);
                if (action === 'edit') openEditForm(id);
                else if (action === 'delete') await handleDelete(id);
                else if (action === 'print') printStock(id); 
            });
        });
    }

    function openNewForm() {
        if (window.App.Features.StockForm) {
            window.App.Features.StockForm.open({ kind: _state.kind, mode: 'create', onSaved: () => runReport() });
        }
    }

    function openEditForm(id) {
        if (window.App.Features.StockForm) {
            window.App.Features.StockForm.open({ kind: _state.kind, mode: 'edit', id: id, onSaved: () => runReport() });
        }
    }

    async function handleDelete(id) {
        const ok = await window.App.confirm('آیا از حذف این سند مطمئن هستید؟', { danger: true, okText: 'حذف کن' });
        if (!ok) return;
        try {
            await window.App.Http.api(`/api/stock/${id}?kind=${_state.kind}`, { method: 'DELETE', successMsg: 'حذف شد' });
            runReport();
        } catch { }
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let start = Math.max(1, page - Math.floor(maxBtn / 2));
        let end = Math.min(totalPages, start + maxBtn - 1);
        if (end - start + 1 < maxBtn) start = Math.max(1, end - maxBtn + 1);

        let btns = '';
        for (let p = start; p <= end; p++) {
            btns += `<button class="page-btn ${p === page ? 'active' : ''}" onclick="App.Features.Stock.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} ردیف</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Stock.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Stock.goToPage(${page - 1})">‹ قبلی</button>
                ${btns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Stock.goToPage(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Stock.goToPage(${totalPages})">»</button>
            </div>
        </div>`;
    }

    function goToPage(p) {
        _state.page = p;
        runReport();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function sortBy(field) {
        if (_state.sortBy === field) {
            _state.sortDir = _state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            _state.sortBy = field;
            _state.sortDir = 'asc';
        }
        _state.page = 1;
        runReport();
    }

    // ═══════════════════════════════════════════
    //  PRINT SINGLE STOCK
    // ═══════════════════════════════════════════
    // ═══ PRINT SINGLE STOCK (با انتخاب نوع چاپ) ═══
    async function printStock(id) {
        // ⭐ پرسیدن نوع چاپ از کاربر
        const isWarehousePrint = await window.App.confirm(
            'آیا نیاز به چاپ انبارداری (همراه با جای امضاء تحویل‌دهنده و تحویل‌گیرنده) دارید؟',
            {
                title: '🖨️ انتخاب نوع چاپ',
                okText: '📝 چاپ انبارداری (با امضاء)',
                cancelText: '📄 چاپ حسابداری (ساده)'
            }
        );

        try {
            // ۱. گرفتن اطلاعات از سرور
            const detail = await window.App.Http.api('/api/stock/' + id);

            // ۲. ساخت iframe موقت
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;

            // ۳. استایل‌های اختصاصی برای چاپ
            const styles = `
                <style>
                    @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');
                    body { font-family: 'Vazirmatn', Tahoma, sans-serif; direction: rtl; padding: 20px; color: #000; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #000; padding: 6px 8px; font-size: 12px; }
                    th { background-color: #f8f9fa; text-align: center; font-weight: bold; }
                    .no-border-table, .no-border-table td { border: none !important; }
                    .info-table td { padding: 4px; font-size: 13px; }
                    .text-center { text-align: center; }
                    .text-left { text-align: left; }
                    .num { font-family: monospace; direction: ltr; }
                    .print-title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    
                    /* استایل اختصاصی جای امضاء */
                    .signatures { width: 100%; display: flex; justify-content: space-between; margin-top: 50px; page-break-inside: avoid; }
                    .sig-box { width: 22%; text-align: center; }
                    .sig-title { font-weight: bold; font-size: 13px; margin-bottom: 60px; }
                    .sig-line { border-top: 1px dashed #000; padding-top: 5px; font-size: 11px; color: #555; }
                </style>
            `;

            // ۴. ساخت محتوای HTML بر اساس انتخاب کاربر
            const htmlContent = isWarehousePrint
                ? buildWarehousePrintHtml(detail)
                : buildAccountingPrintHtml(detail);

            doc.open();
            doc.write(`
                <!DOCTYPE html>
                <html dir="rtl" lang="fa">
                <head>
                    <meta charset="UTF-8">
                    <title>چاپ ${getKindTitle(detail.kind)}</title>
                    ${styles}
                </head>
                <body>
                    ${htmlContent}
                </body>
                </html>
            `);
            doc.close();

            // ۵. اجرای پرینت
            iframe.contentWindow.focus();
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => { document.body.removeChild(iframe); }, 1000);
            }, 300);

        } catch (err) {
            window.App.toast('خطا در آماده‌سازی چاپ: ' + err.message, 'error');
        }
    }

    // ═══ قالب ۱: چاپ حسابداری (ساده) ═══
    function buildAccountingPrintHtml(detail) {
        const kindTitle = getKindTitle(detail.kind);
        const items = detail.items || [];
        const rows = items.map((it, idx) => `
            <tr>
                <td class="num text-center">${idx + 1}</td>
                <td class="num text-center">${it.articleCode || ''}</td>
                <td>${H.esc(it.articleName || '')}</td>
                <td class="text-center">${H.esc(it.articleUnit || '')}</td>
                <td class="num text-left">${H.fmt(it.val)}</td>
                <td class="num text-left">${H.fmt(it.cost)}</td>
                <td class="num text-left">${H.fmt(it.amount)}</td>
            </tr>
        `).join('');

        const totalAmount = items.reduce((s, x) => s + (x.amount || 0), 0);

        return `
            <div class="print-title">${kindTitle} (حسابداری)</div>
            <table class="no-border-table info-table" style="margin-bottom: 15px;">
                <tr>
                    <td class="label"><b>شماره سند:</b> ${detail.specialCode || '-'}</td>
                    <td class="label"><b>شماره سیستمی:</b> ${detail.code || '-'}</td>
                    <td class="label"><b>تاریخ:</b> ${H.esc(detail.dateIn || '-')}</td>
                    <td class="label"><b>انبار:</b> ${H.esc(detail.stockTypeName || '-')}</td>
                </tr>
                <tr>
                    <td colspan="4" class="label"><b>شرح:</b> ${H.esc(detail.des || '-')}</td>
                </tr>
            </table>
            <table>
                <thead>
                    <tr>
                        <th style="width:30px;">#</th><th style="width:80px;">کد کالا</th><th>نام کالا</th>
                        <th style="width:60px;">واحد</th><th class="text-left" style="width:80px;">تعداد</th>
                        <th class="text-left" style="width:110px;">قیمت واحد</th><th class="text-left" style="width:120px;">مبلغ</th>
                    </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="7" class="text-center">ردیفی وجود ندارد</td></tr>'}</tbody>
                <tfoot>
                    <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="6" class="text-center">جمع کل:</td>
                        <td class="num text-left">${H.fmt(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top: 20px; text-align: right; font-weight: bold;">مبلغ به حروف: ${H.toPersianWords(totalAmount)}</div>
        `;
    }

    // ═══ قالب ۲: چاپ انبارداری (با امضاء) ═══
    function buildWarehousePrintHtml(detail) {
        const kindTitle = getKindTitle(detail.kind);
        const items = detail.items || [];

        // در چاپ انبارداری، معمولاً ستون‌هایی برای وضعیت و محل اضافه می‌شود
        const rows = items.map((it, idx) => `
            <tr>
                <td class="num text-center">${idx + 1}</td>
                <td class="num text-center">${it.articleCode || ''}</td>
                <td>${H.esc(it.articleName || '')}</td>
                <td class="text-center">${H.esc(it.articleUnit || '')}</td>
                <td class="num text-left">${H.fmt(it.val)}</td>
                <td class="text-center" style="width: 80px;"></td> <!-- جای خالی برای محل دپو -->
                <td class="text-center" style="width: 80px;"></td> <!-- جای خالی برای وضعیت کالا -->
            </tr>
        `).join('');

        const totalAmount = items.reduce((s, x) => s + (x.amount || 0), 0);
        const isHavaleh = detail.kind === 1; // آیا حواله است؟

        return `
            <div class="print-title">${kindTitle} (انبارداری)</div>
            <table class="no-border-table info-table" style="margin-bottom: 15px;">
                <tr>
                    <td class="label"><b>شماره:</b> ${detail.specialCode || '-'}</td>
                    <td class="label"><b>تاریخ:</b> ${H.esc(detail.dateIn || '-')}</td>
                    <td class="label"><b>انبار:</b> ${H.esc(detail.stockTypeName || '-')}</td>
                    <td class="label"><b>طرف حساب:</b> ${H.esc(detail.noFactor ? 'فاکتور #' + detail.noFactor : '-')}</td>
                </tr>
                <tr>
                    <td colspan="4" class="label"><b>شرح:</b> ${H.esc(detail.des || '-')}</td>
                </tr>
            </table>
            <table>
                <thead>
                    <tr>
                        <th style="width:30px;">#</th><th style="width:80px;">کد کالا</th><th>نام کالا</th>
                        <th style="width:60px;">واحد</th><th class="text-left" style="width:80px;">تعداد</th>
                        <th style="width: 80px;">محل دپو</th>
                        <th style="width: 80px;">وضعیت</th>
                    </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="7" class="text-center">ردیفی وجود ندارد</td></tr>'}</tbody>
                <tfoot>
                    <tr style="background:#f8f9fa; font-weight:700;">
                        <td colspan="4" class="text-center">جمع تعداد:</td>
                        <td class="num text-left">${H.fmt(items.reduce((s, x) => s + (x.val || 0), 0))}</td>
                        <td colspan="2"></td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- بخش امضاءها -->
            <div class="signatures">
                <div class="sig-box">
                    <div class="sig-title">تحویل دهنده</div>
                    <div class="sig-line">نام و امضاء</div>
                </div>
                <div class="sig-box">
                    <div class="sig-title">${isHavaleh ? 'تحویل گیرنده' : 'دریافت کننده'}</div>
                    <div class="sig-line">نام و امضاء</div>
                </div>
                <div class="sig-box">
                    <div class="sig-title">انباردار</div>
                    <div class="sig-line">نام و امضاء</div>
                </div>
                <div class="sig-box">
                    <div class="sig-title">تایید کننده</div>
                    <div class="sig-line">نام و امضاء</div>
                </div>
            </div>
        `;
    }

    function getKindTitle(kind) {
        if (kind === 0) return 'رسید انبار';
        if (kind === 1) return 'حواله انبار';
        if (kind === 2) return 'رسید برگشتی';
        return 'سند انبار';
    }

    function buildStockPrintHtml(detail) {
        const kindTitle = getKindTitle(detail.kind);
        const items = detail.items || [];

        // ساخت ردیف‌های جدول
        const rows = items.map((it, idx) => `
            <tr>
                <td class="num text-center">${idx + 1}</td>
                <td class="num text-center">${it.articleCode || ''}</td>
                <td>${H.esc(it.articleName || '')}</td>
                <td class="text-center">${H.esc(it.articleUnit || '')}</td>
                <td class="num text-left">${H.fmt(it.val)}</td>
                <td class="num text-left">${H.fmt(it.cost)}</td>
                <td class="num text-left">${H.fmt(it.amount)}</td>
            </tr>
        `).join('');

        const totalAmount = items.reduce((s, x) => s + (x.amount || 0), 0);

        return `
            <div style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                ${kindTitle}
            </div>
            <table class="factor-info-table" style="margin-bottom: 10px;">
                <tr>
                    <td class="label">شماره:</td><td>${detail.specialCode || '-'}</td>
                    <td class="label">شماره سیستمی:</td><td>${detail.code || '-'}</td>
                    <td class="label">تاریخ:</td><td>${H.esc(detail.dateIn || '-')}</td>
                    <td class="label">انبار:</td><td>${H.esc(detail.stockTypeName || '-')}</td>
                </tr>
                <tr>
                    <td class="label">شرح:</td>
                    <td colspan="7">${H.esc(detail.des || '-')}</td>
                </tr>
            </table>
            
            <table>
                <thead>
                    <tr>
                        <th style="width:30px;">#</th>
                        <th style="width:70px;">کد کالا</th>
                        <th>نام کالا</th>
                        <th style="width:60px;">واحد</th>
                        <th class="text-left" style="width:80px;">تعداد</th>
                        <th class="text-left" style="width:110px;">قیمت واحد</th>
                        <th class="text-left" style="width:120px;">مبلغ</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="7" class="text-center">ردیفی وجود ندارد</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="6" class="text-center">جمع کل:</td>
                        <td class="num text-left">${H.fmt(totalAmount)}</td>
                    </tr>
                    <tr>
                        <td colspan="7" style="text-align: right; padding: 10px; font-weight: bold; color: #059669;">
                            مبلغ به حروف: ${H.toPersianWords(totalAmount)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    return { render, runReport, goToPage, sortBy };
})();

window.App.renderStockReceipt = () => window.App.Features.Stock.render(0);
window.App.renderStockTransfer = () => window.App.Features.Stock.render(1);
window.App.renderStockReturnReceipt = () => window.App.Features.Stock.render(2);