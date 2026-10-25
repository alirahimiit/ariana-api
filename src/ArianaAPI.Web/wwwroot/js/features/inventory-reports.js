window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.InventoryReports = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _lookups = null;
    let _currentTab = 'diff'; // diff | history

    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            _lookups = await window.App.Http.api('/api/inventory/lookups');
            const stockOpts = _lookups.stockTypes.map(s => `<option value="${s.id}">${H.esc(s.name)}</option>`).join('');

            c.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="margin:0; font-size:18px; color:#1E293B;">📊 گزارشات انبارگردانی</h2>
                    <button class="btn btn-sm btn-outline-secondary" onclick="App.Features.Inventory.render()">
                        ⬅️ بازگشت به مرکز مدیریت
                    </button>
                </div>
                <div class="card filter-card" id="invRepFilterCard">
                 <div class="card-title" id="invRepToggleBtn">
                    <span>🔍 فیلتر گزارشات انبارگردانی</span>
                    <span class="ft-icon">▼</span>
                </div>
                <div class="filter-body" id="invRepFilterBody">
                    <div class="filters two-rows">
                        <div class="form-group">
                            <label>انبار</label>
                            <select id="invRepStock" class="form-select" style="width:100%;">
                                <option value="">همه انبارها</option>${stockOpts}
                            </select>
                        </div>
                    </div>
                    <div style="margin-top:14px; display:flex; gap:8px;">
                        <button class="btn btn-primary" id="invRepRunBtn">🔍 نمایش گزارش</button>
                        <button class="btn btn-secondary" id="invRepPrintLabelsBtn">🖨️ چاپ برچسب‌های این فیلتر</button>

                    </div>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button class="btn btn-outline-primary active" id="tabDiffBtn" onclick="App.Features.InventoryReports.switchTab('diff')">📊 گزارش اختلافات</button>
                <button class="btn btn-outline-secondary" id="tabHistBtn" onclick="App.Features.InventoryReports.switchTab('history')">📜 تاریخچه عملیات</button>
            </div>

            <div id="invRepResult"></div>`;

            const card = document.getElementById('invRepFilterCard');
            document.getElementById('invRepToggleBtn').addEventListener('click', () => card.classList.toggle('collapsed'));

            document.getElementById('invRepRunBtn').addEventListener('click', loadReport);

            loadReport();

            document.getElementById('invRepPrintLabelsBtn').addEventListener('click', async function () {
                const stockId = document.getElementById('invRepStock').value;
                if (!stockId) return window.App.toast('برای چاپ برچسب، ابتدا یک انبار را انتخاب کنید', 'warning');

                const btn = this;
                btn.disabled = true;
                btn.innerHTML = '⏳ در حال آماده‌سازی...';

                try {
                    // ۱. گرفتن همه تگ‌های این انبار (با ظرفیت بالا برای اینکه همه را بیاورد)
                    const payload = { stockTypeId: parseInt(stockId), page: 1, pageSize: 5000 };
                    const res = await window.App.Http.api('/api/inventory/tags/list', { method: 'POST', body: JSON.stringify(payload) });
                    const tags = res.items || [];

                    if (tags.length === 0) {
                        btn.disabled = false;
                        btn.innerHTML = '🖨️ چاپ برچسب‌های این فیلتر';
                        return window.App.toast('هیچ تگی برای این انبار یافت نشد', 'warning');
                    }

                    // ۲. ارسال لیست شناسه تگ‌ها به تابع چاپ
                    await window.App.Features.InventoryTags.printLabels(tags.map(t => t.id));

                } catch (e) {
                    window.App.toast('خطا در دریافت لیست تگ‌ها', 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '🖨️ چاپ برچسب‌های این فیلتر';
                }
            });


        } catch (err) {
            c.innerHTML = `<div class="error-box">خطا در بارگذاری: ${H.esc(err.message)}</div>`;
        }
    }

    function switchTab(tab) {
        _currentTab = tab;
        document.getElementById('tabDiffBtn').className = tab === 'diff' ? 'btn btn-outline-primary active' : 'btn btn-outline-secondary';
        document.getElementById('tabHistBtn').className = tab === 'history' ? 'btn btn-outline-primary active' : 'btn btn-outline-secondary';
        loadReport();
    }

    async function loadReport() {
        const container = document.getElementById('invRepResult');
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const stockId = document.getElementById('invRepStock').value;
        const url = _currentTab === 'diff'
            ? `/api/inventory/reports/diff?stockTypeId=${stockId || ''}`
            : `/api/inventory/reports/history?stockTypeId=${stockId || ''}`;

        try {
            const data = await window.App.Http.api(url);
            if (_currentTab === 'diff') renderDiffTable(data);
            else renderHistoryTable(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function renderDiffTable(data) {
        const c = document.getElementById('invRepResult');
        if (data.length === 0) {
            c.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">هیچ اختلافی یافت نشد</div>';
            return;
        }

        const rows = data.map((it, idx) => `
            <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="num text-center">${H.esc(it.tagNo)}</td>
                <td>${H.esc(it.stockName)}</td>
                <td class="num text-center">${H.esc(it.articleCode)}</td>
                <td>${H.esc(it.articleName)}</td>
                <td class="text-center">${H.esc(it.unitName)}</td>
                <td class="num text-left">${H.fmt(it.systemQty)}</td>
                <td class="num text-left">${H.fmt(it.countedQty || 0)}</td>
                <td class="num text-left ${it.diffQty > 0 ? 'inv-diff-positive' : it.diffQty < 0 ? 'inv-diff-negative' : ''}">${H.fmt(it.diffQty || 0)}</td>
                <td class="num text-left">${H.fmt(it.scrapQty || 0)}</td>
                <td class="num text-left">${H.fmt(it.absDiffQty)}</td>
            </tr>`).join('');

        c.innerHTML = `
            <div class="card">
                <div class="card-title"><span>📊 گزارش اختلافات (${data.length})</span></div>
                <div class="table-wrapper">
                    <table class="data-table inv-table">
                        <thead>
                            <tr>
                                <th style="width:35px;">#</th><th>شماره تگ</th><th>انبار</th><th>کد کالا</th><th>نام کالا</th><th>واحد</th>
                                <th class="text-left">موجودی سیستم</th><th class="text-left">شمارش شده</th><th class="text-left">اختلاف</th><th class="text-left">ضایعات</th><th class="text-left">مقدار اختلاف</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;

        if (typeof Exporter !== 'undefined' && Exporter.attach && data.length > 0) {
            Exporter.attach(document.getElementById('invRepResult'), {
                title: 'گزارش اختلافات انبارگردانی',
                subtitle: (window.App.state.user?.orgName || ''),
                filename: 'InventoryDiffReport'
            });
        }
    }

    function renderHistoryTable(data) {
        const c = document.getElementById('invRepResult');
        if (data.length === 0) {
            c.innerHTML = '<div class="empty" style="padding:40px;text-align:center;">تاریخچه‌ای یافت نشد</div>';
            return;
        }

        const rows = data.map((it, idx) => `
            <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="num text-center">${H.esc(it.tagNo)}</td>
                <td>${H.esc(it.stockName)}</td>
                <td class="text-center"><span class="badge badge-info">${H.esc(it.operationType)}</span></td>
                <td>${H.esc(it.userName || 'سیستم')}</td>
                <td class="text-center">${H.esc(it.operationDate || '-')}</td>
                <td>${H.esc(it.description || '')}</td>
            </tr>`).join('');

        c.innerHTML = `
            <div class="card">
                <div class="card-title"><span>📜 تاریخچه عملیات (${data.length})</span></div>
                <div class="table-wrapper">
                    <table class="data-table inv-table">
                        <thead>
                            <tr>
                                <th style="width:35px;">#</th><th>شماره تگ</th><th>انبار</th><th>نوع عملیات</th><th>کاربر</th><th>تاریخ</th><th>توضیحات</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;

        if (typeof Exporter !== 'undefined' && Exporter.attach && data.length > 0) {
            Exporter.attach(document.getElementById('invRepResult'), {
                title: 'تاریخچه عملیات انبارگردانی',
                subtitle: (window.App.state.user?.orgName || ''),
                filename: 'InventoryHistoryReport'
            });
        }
    }

    return { render, switchTab };
})();