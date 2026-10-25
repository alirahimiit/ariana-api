/* ═══════════════════════════════════════════════════
   Feature / InventoryTags — لیست تگ‌های انبارگردانی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.InventoryTags = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;
    let _state = { lookups: null, page: 1, result: null };

    // ⭐ انتقال statusMap به بالای فایل تا در Exporter هم در دسترس باشد
    const statusMap = {
        0: { text: 'چاپ شده', cls: 'inv-badge-0' },
        1: { text: 'در حال شمارش', cls: 'inv-badge-1' },
        2: { text: 'تکمیل شده', cls: 'inv-badge-2' },
        3: { text: 'سند صادر شده', cls: 'inv-badge-3' }
    };

    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            _state.lookups = await window.App.Http.api('/api/inventory/lookups');

            const stockOpts = _state.lookups.stockTypes.map(s => `<option value="${s.id}">${H.esc(s.name)}</option>`).join('');
            const stageOpts = _state.lookups.stages.map(s => `<option value="${s.stageNo}">${s.stageNo} - ${H.esc(s.stageName)}</option>`).join('');

            c.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 style="margin:0; font-size:18px; color:#1E293B;">📋 لیست تگ‌های شمارش</h2>
                <button class="btn btn-sm btn-outline-secondary" onclick="App.Features.Inventory.render()">
                    ⬅️ بازگشت به مرکز مدیریت
                </button>
            </div>
            <div class="card filter-card" id="invTagsFilterCard">
                <div class="card-title" id="invTagsToggleBtn">
                    <span>🔍 فیلتر تگ‌های انبارگردانی</span>
                    <span class="ft-icon">▼</span>
                </div>
                <div class="filter-body" id="invTagsFilterBody">
                    <div class="filters two-rows">
                        <div class="form-group">
                            <label>انبار</label>
                            <select id="invTagsStock" class="form-select" style="width:100%;"><option value="">همه</option>${stockOpts}</select>
                        </div>
                        <div class="form-group">
                            <label>مرحله</label>
                            <select id="invTagsStage" class="form-select" style="width:100%;"><option value="">همه</option>${stageOpts}</select>
                        </div>
                        <div class="form-group">
                            <label>وضعیت</label>
                            ${CS.html('invTagsStatus', [
                { value: '', label: 'همه' },
                { value: '0', label: 'چاپ شده (نیاز به شمارش)' },
                { value: '1', label: 'در حال شمارش' },
                { value: '2', label: 'تکمیل شده' },
                { value: '3', label: 'سند صادر شده' }
            ], '')}
                        </div>
                    </div>
                    <div style="margin-top:14px; display:flex; gap:8px;">
                        <button class="btn btn-primary" id="invTagsRunBtn">🔍 نمایش</button>
                        <button class="btn btn-success" id="invTagsNewBtn">➕ ثبت تگ جدید</button>
                    </div>
                </div>
            </div>
            <div id="invTagsResult"></div>`;

            const card = document.getElementById('invTagsFilterCard');
            document.getElementById('invTagsToggleBtn').addEventListener('click', () => card.classList.toggle('collapsed'));

            CS.bindAll(c, {
                invTagsStatus: () => { _state.page = 1; loadTags(); }
            });

            document.getElementById('invTagsRunBtn').addEventListener('click', () => { _state.page = 1; loadTags(); });
            document.getElementById('invTagsNewBtn').addEventListener('click', () => window.App.Features.InventoryTagCreate.render('tags'));

            loadTags();

        } catch (err) {
            c.innerHTML = `<div class="error-box">خطا در بارگذاری: ${H.esc(err.message)}</div>`;
        }
    }

    async function loadTags() {
        const container = document.getElementById('invTagsResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const payload = {
            stockTypeId: document.getElementById('invTagsStock').value || null,
            stageNo: document.getElementById('invTagsStage').value || null,
            tagStatus: CS.getValue('invTagsStatus') !== '' ? parseInt(CS.getValue('invTagsStatus')) : null,
            page: _state.page,
            pageSize: 50
        };

        try {
            const r = await window.App.Http.api('/api/inventory/tags/list', { method: 'POST', body: JSON.stringify(payload) });
            _state.result = r;
            renderTable(r);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function renderTable(r) {
        const c = document.getElementById('invTagsResult');
        const items = r.items || [];

        const rows = items.map((it, idx) => {
            const rowNum = (r.page - 1) * r.pageSize + idx + 1;
            const st = statusMap[it.tagStatus] || { text: 'نامشخص', cls: '' };

            const canCreateSanad = it.tagStatus === 2;

            
                // ... (کدهای قبلی statusMap و rowNum)

            return `<tr data-id="${it.id}">
                <td class="text-center">${rowNum}</td>
                <td class="num text-center">${H.esc(it.tagNo)}</td>
                <td>${H.esc(it.stockName)}</td>
                <td class="text-center">${it.stageNo}</td>
                <td class="text-center">${H.esc(it.tagDate)}</td>
                <td class="text-center"><span class="inv-badge ${st.cls}">${st.text}</span></td>
                <td class="num text-center" style="color:#4F46E5; font-weight:bold;">${H.esc(it.sanadFullInfo || '-')}</td> <!-- ⭐ ستون جدید سند -->
                <td class="text-center">${it.totalItems}</td>
                <td class="text-center">${it.countedItems}</td>
                <td class="text-center">${it.progressPercent}%</td>
                <td class="num text-left">${H.fmt(it.totalDifference)}</td>
                <td class="text-center" style="white-space:nowrap;">
                    <button class="btn-icon" data-action="view" data-id="${it.id}" title="مشاهده / شمارش">📝</button>
                    <button class="btn-icon" data-action="print" data-id="${it.id}" title="چاپ برچسب">🖨️</button>
                    ${canCreateSanad ? `<button class="btn-icon" data-action="sanad" data-id="${it.id}" title="صدور سند">📄</button>` : ''}
                    <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${it.id}" title="حذف">🗑️</button>
                </td>
            </tr>`;
            }).join('');

        const empty = items.length === 0
            ? '<tr><td colspan="11" class="text-center" style="padding:30px;color:#94A3B8;">هیچ تگی یافت نشد</td></tr>' : '';

            c.innerHTML = `
            <div class="card">
                <div class="card-title"><span>📋 لیست تگ‌ها (${H.fmt(r.totalCount)})</span></div>
                <div class="table-wrapper">
                    <table class="data-table inv-table">
                        <thead>
                            <tr>
                                <th style="width:35px;">#</th>
                                <th style="width:120px;">شماره تگ</th>
                                <th>انبار</th>
                                <th style="width:60px;">مرحله</th>
                                <th style="width:90px;">تاریخ</th>
                                <th style="width:100px;">وضعیت</th>
                                <th style="width:80px;">شماره سند</th> <!-- ⭐ ستون جدید -->
                                <th style="width:60px;">اقلام</th>
                                <th style="width:60px;">شمارش</th>
                                <th style="width:60px;">پیشرفت</th>
                                <th class="text-left" style="width:90px;">اختلاف</th>
                                <th style="width:150px;">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>${rows || empty}</tbody>
                    </table>
                </div>
                <div id="invTagsPagination"></div>
                <div id="invTagsExportSlot"></div>
            </div>`;


        if (r.totalPages > 1) {
            document.getElementById('invTagsPagination').innerHTML = buildPagination(r.page, r.totalPages, r.totalCount, items.length);
        }

        if (typeof Exporter !== 'undefined' && Exporter.attach && items.length > 0) {
            Exporter.attach(document.getElementById('invTagsResult'), {
                title: 'لیست تگ‌های انبارگردانی',
                subtitle: (window.App.state.user?.orgName || '') + ' - ' + (window.App.state.user?.fyName || ''),
                filename: 'InventoryTags',
                customHtml: function () {
                    return `
                    <h3>لیست تگ‌های انبارگردانی</h3>
                    <table border="1" style="width:100%; border-collapse:collapse; text-align:center;">
                        <thead><tr><th>#</th><th>شماره تگ</th><th>انبار</th><th>مرحله</th><th>تاریخ</th><th>وضعیت</th><th>اقلام</th><th>شمارش</th><th>اختلاف</th></tr></thead>
                        <tbody>
                            ${items.map((it, i) => `<tr>
                                <td>${i + 1}</td><td>${it.tagNo}</td><td>${it.stockName}</td><td>${it.stageNo}</td><td>${it.tagDate}</td>
                                <td>${statusMap[it.tagStatus]?.text || ''}</td><td>${it.totalItems}</td><td>${it.countedItems}</td><td>${H.fmt(it.totalDifference)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`;
                }
            });
        }

        bindActions();
    }

    function bindActions() {
        document.querySelectorAll('#invTagsResult [data-action]').forEach(btn => {
            btn.addEventListener('click', async function () {
                const action = this.dataset.action;
                const id = parseInt(this.dataset.id, 10);
                const item = _state.result.items.find(x => x.id === id);

                if (action === 'view') {
                    window.App.Features.InventoryCountForm.open(id);
                } else if (action === 'print') {
                    if (item) printLabels([item.id]);
                } else if (action === 'sanad') {
                    const ok = await window.App.confirm('آیا از صدور سند حسابداری برای این تگ مطمئن هستید؟', { okText: 'بله، صادر کن' });
                    if (!ok) return;
                    try {
                        await window.App.Http.api(`/api/inventory/tags/${id}/create-sanad`, { method: 'POST', successMsg: 'سند با موفقیت صادر شد' });
                        loadTags();
                    } catch (e) { }
                } else if (action === 'delete') {
                    const ok = await window.App.confirm('آیا از حذف این تگ و تمام اسناد مرتبط با آن مطمئن هستید؟', { danger: true, okText: 'حذف کن' });
                    if (!ok) return;
                    try {
                        await window.App.Http.api(`/api/inventory/tags/${id}`, { method: 'DELETE', successMsg: 'تگ با موفقیت حذف شد' });
                        loadTags();
                    } catch (e) { }
                }
            });
        });
    }

    // ⭐ پیاده‌سازی کامل صفحه‌بندی
    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}" onclick="App.Features.InventoryTags.goToPage(${p})">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} تگ</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.InventoryTags.goToPage(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.InventoryTags.goToPage(${page - 1})">‹ قبلی</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.InventoryTags.goToPage(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.InventoryTags.goToPage(${totalPages})">»</button>
            </div>
        </div>`;
    }

    function goToPage(p) {
        _state.page = p;
        loadTags();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ⭐ تولید بارکد به صورت داخلی (بدون نیاز به اینترنت یا کتابخانه خارجی)
    function generateBarcodeSVG(code) {
        const code39 = {
            '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101', '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011', '8': '110100101101', '9': '101100101101',
            'A': '110101001011', 'B': '101101001011', 'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101', 'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
            'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011', 'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001', 'S': '101101011001', 'T': '101011011001',
            'U': '110010101011', 'V': '100110101011', 'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
            '-': '100101011011', '.': '110010101101', ' ': '100110101101', '$': '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001', '*': '100101101101'
        };

        let str = String(code).toUpperCase().replace(/[^0-9A-Z\-\.\ \$\/\+\%]/g, '');
        let fullCode = '*' + str + '*';
        let binary = '';

        for (let i = 0; i < fullCode.length; i++) {
            binary += (code39[fullCode[i]] || code39[' ']) + '0';
        }

        let rects = '';
        let x = 0;
        for (let i = 0; i < binary.length; i++) {
            if (binary[i] === '1') {
                rects += `<rect x="${x}" y="0" width="1.5" height="35" fill="black" />`;
            }
            x += 1.5;
        }

        return `<svg width="${x}" height="35" viewBox="0 0 ${x} 35">${rects}</svg><div style="font-size:11px; margin-top:2px; font-family:monospace; direction:ltr;">${str}</div>`;
    }

    // ⭐ تغییر نام به printLabels و پذیرش آرایه‌ای از شناسه تگ‌ها برای چاپ گروهی
    async function printLabels(tagIds) {
        if (!Array.isArray(tagIds)) tagIds = [tagIds];
        if (tagIds.length === 0) return window.App.toast('تگی برای چاپ یافت نشد', 'warning');

        try {
            // دریافت اطلاعات همه تگ‌ها به صورت موازی
            const promises = tagIds.map(id => window.App.Http.api(`/api/inventory/tags/${id}`).catch(() => null));
            const tagDetails = (await Promise.all(promises)).filter(x => x !== null && x.items && x.items.length > 0);

            if (tagDetails.length === 0) {
                return window.App.toast('هیچ کالایی در تگ‌های انتخابی برای چاپ وجود ندارد', 'warning');
            }

            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;

            // تولید همه برچسب‌ها از همه تگ‌ها
            let allLabelsHtml = '';
            tagDetails.forEach(detail => {
                allLabelsHtml += detail.items.map(it => `
                    <div class="label-box">
                        <div class="label-title">برگه شمارش انبارگردانی</div>
                        
                        <div class="label-row">
                            <span>شماره تگ: <b>${detail.tagNo}</b></span>
                        </div>
                        <div class="label-row">
                            <span>انبار: ${H.esc(detail.stockName)}</span>
                            <span>مرحله: ${detail.stageNo}</span>
                        </div>
                        <div class="label-row">
                            <span>تاریخ: ${H.esc(detail.tagDate)}</span>
                            <span>کد مکان: ${H.esc(detail.locationCode || '-')}</span>
                        </div>
                        
                        <div class="label-row" style="margin-top:5px;">
                            <span>کد کالا: <b>${H.esc(it.articleCode)}</b></span>
                        </div>
                        <div class="label-row">
                            <span>نام کالا: ${H.esc(it.articleName)}</span>
                        </div>
                        
                        <div class="label-row" style="margin-top:5px;">
                            <span>موجودی سیستم: ${H.fmt(it.systemQty)}</span>
                            <span>مقدار شمارش: <span class="count-box"></span></span>
                        </div>
                        
                        <div class="label-barcode">
                            ${generateBarcodeSVG(it.articleCode)}
                        </div>
                    </div>
                `).join('');
            });

            doc.open();
            doc.write(`
                <!DOCTYPE html>
                <html dir="rtl" lang="fa">
                <head>
                    <meta charset="UTF-8">
                    <title>چاپ برچسب‌های انبارگردانی</title>
                    <style>
                        @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Vazirmatn', Tahoma, sans-serif; background: #fff; margin: 0; padding: 0; }
                        .labels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
                        .label-box { border: 1px solid #000; padding: 8px; font-size: 11px; page-break-inside: avoid; display: flex; flex-direction: column; }
                        .label-title { text-align: center; font-weight: bold; font-size: 13px; border-bottom: 1px solid #000; margin-bottom: 5px; padding-bottom: 3px; }
                        .label-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                        .count-box { display: inline-block; width: 50px; height: 15px; border: 1px solid #000; margin-right: 5px; }
                        .label-barcode { text-align: center; margin-top: auto; padding-top: 5px; display: flex; flex-direction: column; align-items: center; }
                    </style>
                </head>
                <body>
                    <div class="labels-grid">${allLabelsHtml}</div>
                </body>
                </html>
            `);
            doc.close();

            iframe.contentWindow.focus();
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => { document.body.removeChild(iframe); }, 1000);
            }, 300);

        } catch (err) {
            window.App.toast('خطا در آماده‌سازی چاپ', 'error');
            console.error(err);
        }
    }

    return { render, printLabels, goToPage };
})();