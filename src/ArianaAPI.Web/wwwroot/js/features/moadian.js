/* ═══════════════════════════════════════════════════
   Feature / Moadian — سامانه مودیان
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Moadian = (function () {
    'use strict';

    const H = window.App.Helpers;

    let _state = {
        activeTab: 'pending',
        pendingFactors: [],
        pendingData: null,      
        pendingPage: 1,
        pendingSortBy: 'date',
        pendingSortDir: 'desc',
        headers: [],
        headersData: null,
        headersPage: 1,
        headersSortBy: 'date',
        headersSortDir: 'desc',
        settings: null,
        serverInfo: null,
        fiscalInfo: null
    };

    // ═══════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        _state.activeTab = 'pending';

        c.innerHTML = `
        <div class="moadian-page">
            <div class="moadian-tabs">
                <button class="moadian-tab active" data-tab="pending">
                    📋 فاکتورهای آماده ارسال
                </button>
                <button class="moadian-tab" data-tab="headers">
                    📤 اسناد ارسال‌شده
                </button>
                <button class="moadian-tab" data-tab="settings">
                    ⚙️ تنظیمات
                </button>
            </div>
            <div id="moadianBody"></div>
        </div>`;

        // Bind tabs
        c.querySelectorAll('.moadian-tab').forEach(btn => {
            btn.addEventListener('click', function () {
                c.querySelectorAll('.moadian-tab').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                _state.activeTab = this.dataset.tab;
                renderTab();
            });
        });

        renderTab();
    }

    function renderTab() {
        if (_state.activeTab === 'pending') renderPending();
        if (_state.activeTab === 'headers') renderHeaders();
        if (_state.activeTab === 'settings') renderSettings();
    }

    // ═══════════════════════════════════════════════════
    //  TAB ۱: فاکتورهای آماده ارسال
    // ═══════════════════════════════════════════════════
    async function renderPending(page) {
        const body = document.getElementById('moadianBody');

        // ⭐ اول مقدار search رو بخون (قبل از پاک کردن HTML)
        const search = document.getElementById('moPendingSearch')?.value || '';

        body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        _state.pendingPage = page || _state.pendingPage || 1;

        const payload = {
            search: search || null,
            sortBy: _state.pendingSortBy,
            sortDir: _state.pendingSortDir,
            page: _state.pendingPage,
            pageSize: 20   // ⭐ ثابت ۲۰ برای مودیان (تا صفحه‌بندی داشته باشیم)
        };

        try {
            const resp = await window.App.Http.api('/api/moadian/factors/pending-list', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            _state.pendingData = resp;
            _state.pendingFactors = resp.items || [];
            drawPending();
        } catch (err) {
            body.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function drawPending() {
        const body = document.getElementById('moadianBody');
        const data = _state.pendingData || {};
        const items = data.items || [];
        const totalCount = data.totalCount || 0;

        // ═══ ردیف‌ها ═══
        let rows = '';
        if (items.length === 0) {
            rows = `<tr><td colspan="7" class="text-center" style="padding:30px;color:#94A3B8;">
                    ${totalCount === 0 ? '✅ همه‌ی فاکتورها ارسال شدن' : 'فاکتوری یافت نشد'}
                </td></tr>`;
        } else {
            rows = items.map(f => `
            <tr>
                <td class="num text-center">${H.esc(f.fldFacNo || '')}</td>
                <td class="num text-center">${H.esc(f.fldFacDate || '')}</td>
                <td class="num text-center">${f.customerCode || ''}</td>
                <td>${H.esc(f.fldCustName || '')}</td>
                <td class="num text-left">${H.fmt(f.fldSumKol)}</td>
                <td class="text-center">
                    ${f.isCash === 1 ? '💵 نقدی' : '📝 نسیه'}
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-primary"
                            onclick="App.Features.Moadian.createFromFactor(${f.id})"
                            title="ایجاد سند">
                        ➕ ایجاد
                    </button>
                </td>
            </tr>`).join('');
        }

        // ═══ آیکن سورت ═══
        const sortIcon = (col) => {
            if (_state.pendingSortBy !== col) return ' ⇅';
            return _state.pendingSortDir === 'asc' ? ' ▲' : ' ▼';
        };
        const sortClass = (col) => _state.pendingSortBy === col ? 'sort-active' : '';

        // ═══ صفحه‌بندی ═══
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;

        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.Moadian.goToPendingPage(${p})">${p}</button>`;
            }

            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${H.fmt(items.length)} از ${H.fmt(totalCount)} فاکتور
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                            onclick="App.Features.Moadian.goToPendingPage(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                            onclick="App.Features.Moadian.goToPendingPage(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                            onclick="App.Features.Moadian.goToPendingPage(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                            onclick="App.Features.Moadian.goToPendingPage(${totalPages})">»</button>
                </div>
            </div>`;
        }

        // ═══ HTML نهایی ═══
        body.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>📋 فاکتورهای آماده ارسال (${H.fmt(totalCount)})</span>
                <div class="fac-actions">
                    <button class="btn btn-sm btn-primary"
                            onclick="App.Features.Moadian.createAll()">
                        ⚡ ایجاد همه‌ی این صفحه
                    </button>
                </div>
            </div>
            <!-- ⭐⭐⭐ انتخاب نوع صورتحساب -->
            <div class="moadian-type-selector" style="
                padding:12px 16px;
                margin:0 0 12px 0;
                background:#F8FAFC;
                border:1px solid #E2E8F0;
                border-radius:8px;
                display:flex;
                gap:20px;
                align-items:center;
                flex-wrap:wrap;
            ">
                <strong style="color:#1E293B;">نوع صورتحساب:</strong>
                <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
                    <input type="radio" name="moInty" value="1" checked>
                    <span>نوع اول (عادی)</span>
                </label>
                <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
                    <input type="radio" name="moInty" value="2">
                    <span>نوع دوم (طلا/جواهر)</span>
                </label>
                <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
                    <input type="radio" name="moInty" value="3">
                    <span>نوع سوم (نفت/پتروشیمی)</span>
                </label>
            </div>
            <!-- ⭐ فیلتر -->
            <div class="moadian-filter-bar">
                <div class="form-group">
                    <input type="text" id="moPendingSearch"
                           placeholder="🔍 جستجو: شماره فاکتور، کد یا نام مشتری..."
                           value="${H.esc(document.getElementById('moPendingSearch')?.value || '')}">
                </div>
                <button class="btn btn-primary" onclick="App.Features.Moadian.searchPending()">
                    🔍 جستجو
                </button>
                <button class="btn btn-ghost" onclick="App.Features.Moadian.resetPendingSearch()">
                    ↺ ریست
                </button>
            </div>

            <div class="table-wrapper">
                <table class="moadian-table">
                    <thead>
                        <tr>
                            <th class="sortable-th ${sortClass('no')}"
                                onclick="App.Features.Moadian.sortPending('no')">
                                شماره${sortIcon('no')}
                            </th>
                            <th class="sortable-th ${sortClass('date')}"
                                onclick="App.Features.Moadian.sortPending('date')">
                                تاریخ${sortIcon('date')}
                            </th>
                            <th class="sortable-th ${sortClass('customerCode')}"
                               onclick="App.Features.Moadian.sortHeaders('customerCode')">
                                کد مشتری${sortIcon('customerCode')}
                            </th>
                            <th class="sortable-th ${sortClass('customer')}"
                                onclick="App.Features.Moadian.sortPending('customer')">
                                نام مشتری${sortIcon('customer')}
                            </th>
                            <th class="sortable-th text-left ${sortClass('amount')}"
                                onclick="App.Features.Moadian.sortPending('amount')">
                                مبلغ${sortIcon('amount')}
                            </th>
                            <th style="width:100px;">پرداخت</th>
                            <th style="width:120px;">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>`;

        // ⭐ Enter روی جستجو
        document.getElementById('moPendingSearch')?.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') searchPending();
        });
    } 

  
    // ═══════════════════════════════════════════════════
    //  TAB ۲: اسناد ارسال‌شده
    // ═══════════════════════════════════════════════════
    async function renderHeaders(page) {
        const body = document.getElementById('moadianBody');

        // ⭐ اول مقادیر رو بخون
        const search = document.getElementById('moSearch')?.value || '';
        const status = document.getElementById('moStatusFilter')?.value || '';

        body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        _state.headersPage = page || _state.headersPage || 1;

        const payload = {
            search: search || null,
            status: status !== '' ? parseInt(status, 10) : null,
            sortBy: _state.headersSortBy,
            sortDir: _state.headersSortDir,
            page: _state.headersPage,
            pageSize: 20   // ⭐ ثابت ۲۰
        };

        try {
            const resp = await window.App.Http.api('/api/moadian/headers/list', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            _state.headersData = resp;
            _state.headers = resp.items || [];
            drawHeaders();
        } catch (err) {
            body.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function drawHeaders() {
        const body = document.getElementById('moadianBody');
        const data = _state.headersData || {};
        const items = data.items || [];

        const counts = {
            total: data.countAll || 0,
            pending: data.countPending || 0,
            sent: data.countSent || 0,
            error: data.countError || 0,
            success: data.countSuccess || 0
        };

        // ═══ ردیف‌ها ═══
        let rows = '';
        if (items.length === 0) {
            rows = '<tr><td colspan="10" class="text-center" style="padding:30px;color:#94A3B8;">سندی یافت نشد</td></tr>';
        } else {
            rows = items.map(h => {
                const status = getStatusBadge(h.status);
                const sendable = h.status === 0 || h.status === 2;
                const inquiriable = h.status === 1;

                return `
            <tr class="moadian-row status-${h.status}">
                <td class="num text-center">${h.inno || ''}</td>
                <td class="num text-center">${H.esc(h.indatimPersian || '')}</td>
                <td class="num text-center">${H.esc(h.factorNo || '-')}</td>
                <td class="num text-center">${h.customerCode || ''}</td>
                <td>${H.esc(h.customerName || '-')}</td>
                <td class="num text-left">${H.fmt(h.tbill)}</td>
                <td class="text-center">${status}</td>
                <td class="num text-center" style="font-size:11px;direction:ltr;">
                    ${h.refNumber ? H.esc(h.refNumber) : '-'}
                </td>
                <td class="text-center">
                    ${sendable ? `<button class="btn btn-sm btn-primary"
                            onclick="App.Features.Moadian.sendOne(${h.id})" title="ارسال">📤</button>` : ''}
                    ${inquiriable ? `<button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Moadian.inquiry(${h.id})" title="استعلام">🔍</button>` : ''}
                    <button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Moadian.viewHeader(${h.id})" title="مشاهده">👁️</button>
                    ${h.status !== 3 ? `<button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Moadian.deleteHeader(${h.id})" title="حذف"
                            style="color:var(--danger);">🗑️</button>` : ''}
                </td>
            </tr>`;
            }).join('');
        }

        // ═══ آیکن سورت ═══
        const sortIcon = (col) => {
            if (_state.headersSortBy !== col) return ' ⇅';
            return _state.headersSortDir === 'asc' ? ' ▲' : ' ▼';
        };
        const sortClass = (col) => _state.headersSortBy === col ? 'sort-active' : '';

        // ═══ صفحه‌بندی ═══
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || 0;

        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.Moadian.goToHeadersPage(${p})">${p}</button>`;
            }

            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${H.fmt(items.length)} از ${H.fmt(totalCount)} سند
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                            onclick="App.Features.Moadian.goToHeadersPage(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                            onclick="App.Features.Moadian.goToHeadersPage(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                            onclick="App.Features.Moadian.goToHeadersPage(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                            onclick="App.Features.Moadian.goToHeadersPage(${totalPages})">»</button>
                </div>
            </div>`;
        }

        // ═══ HTML نهایی ═══
        body.innerHTML = `
        <div class="moadian-stats">
            <div class="moadian-stat moadian-stat-total">
                <div class="moadian-stat-label">📊 کل</div>
                <div class="moadian-stat-value">${H.fmt(counts.total)}</div>
            </div>
            <div class="moadian-stat moadian-stat-pending">
                <div class="moadian-stat-label">⏳ ارسال نشده</div>
                <div class="moadian-stat-value">${H.fmt(counts.pending)}</div>
            </div>
            <div class="moadian-stat moadian-stat-sent">
                <div class="moadian-stat-label">📤 ارسال شده</div>
                <div class="moadian-stat-value">${H.fmt(counts.sent)}</div>
            </div>
            <div class="moadian-stat moadian-stat-error">
                <div class="moadian-stat-label">❌ خطا</div>
                <div class="moadian-stat-value">${H.fmt(counts.error)}</div>
            </div>
            <div class="moadian-stat moadian-stat-success">
                <div class="moadian-stat-label">✅ موفق</div>
                <div class="moadian-stat-value">${H.fmt(counts.success)}</div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">
                <span>📤 اسناد مالیاتی (${H.fmt(totalCount)})</span>
                <div class="fac-actions">
                    <button class="btn btn-sm btn-primary" onclick="App.Features.Moadian.sendAll()">
                        📤 ارسال همه‌ی ارسال‌نشده‌ها
                    </button>
                </div>
            </div>

            <!-- ⭐ فیلتر -->
            <div class="moadian-filter-bar">
                <div class="form-group">
                    <input type="text" id="moSearch"
                           placeholder="🔍 جستجو: شماره فاکتور، مشتری، سریال..."
                           value="${H.esc(document.getElementById('moSearch')?.value || '')}">
                </div>
                <div class="form-group">
                    <select id="moStatusFilter">
                        <option value="">همه وضعیت‌ها</option>
                        <option value="0" ${document.getElementById('moStatusFilter')?.value === '0' ? 'selected' : ''}>⏳ ارسال نشده</option>
                        <option value="1" ${document.getElementById('moStatusFilter')?.value === '1' ? 'selected' : ''}>📤 ارسال شده</option>
                        <option value="2" ${document.getElementById('moStatusFilter')?.value === '2' ? 'selected' : ''}>❌ خطا</option>
                        <option value="3" ${document.getElementById('moStatusFilter')?.value === '3' ? 'selected' : ''}>✅ موفق</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="App.Features.Moadian.searchHeaders()">
                    🔍 جستجو
                </button>
                <button class="btn btn-ghost" onclick="App.Features.Moadian.resetSearch()">
                    ↺ ریست
                </button>
            </div>

            <div class="table-wrapper">
                <table class="moadian-table">
                    <thead>
                        <tr>
                            <th class="sortable-th ${sortClass('serial')}"
                                onclick="App.Features.Moadian.sortHeaders('serial')">
                                سریال${sortIcon('serial')}
                            </th>
                            <th class="sortable-th ${sortClass('date')}"
                                onclick="App.Features.Moadian.sortHeaders('date')">
                                تاریخ${sortIcon('date')}
                            </th>
                            <th class="sortable-th ${sortClass('factor')}"
                                onclick="App.Features.Moadian.sortHeaders('factor')">
                                شماره فاکتور${sortIcon('factor')}
                            </th>
                            <th class="sortable-th ${sortClass('customerCode')}"
                               onclick="App.Features.Moadian.sortHeaders('customerCode')">
                                کد مشتری${sortIcon('customerCode')}
                            </th>
                            <th class="sortable-th ${sortClass('customer')}"
                                onclick="App.Features.Moadian.sortHeaders('customer')">
                                مشتری${sortIcon('customer')}
                            </th>
                            <th class="sortable-th text-left ${sortClass('amount')}"
                                onclick="App.Features.Moadian.sortHeaders('amount')">
                                مبلغ${sortIcon('amount')}
                            </th>
                            <th class="sortable-th ${sortClass('status')}"
                                onclick="App.Features.Moadian.sortHeaders('status')">
                                وضعیت${sortIcon('status')}
                            </th>
                            <th style="width:130px;">Ref Number</th>
                            <th style="width:200px;">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>`;

        // ⭐ Enter روی جستجو
        document.getElementById('moSearch')?.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') searchHeaders();
        });
        document.getElementById('moStatusFilter')?.addEventListener('change', function () {
            searchHeaders();
        });
    }

    function getStatusBadge(status) {
        const map = {
            0: '<span class="moadian-badge moadian-badge-pending">⏳ ارسال نشده</span>',
            1: '<span class="moadian-badge moadian-badge-sent">📤 ارسال شده</span>',
            2: '<span class="moadian-badge moadian-badge-error">❌ خطا</span>',
            3: '<span class="moadian-badge moadian-badge-success">✅ موفق</span>'
        };
        return map[status] || '<span class="moadian-badge">-</span>';
    }

    // ═══════════════════════════════════════════════════
    //  TAB ۳: تنظیمات
    // ═══════════════════════════════════════════════════
    async function renderSettings() {
        const body = document.getElementById('moadianBody');
        body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const s = await window.App.Http.api('/api/moadian/settings');
            _state.settings = s;
            drawSettings();
        } catch (err) {
            body.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function drawSettings() {
        const body = document.getElementById('moadianBody');
        const s = _state.settings || {};

        body.innerHTML = `
            <div class="card">
                <div class="card-title">⚙️ تنظیمات اتصال به سامانه مودیان</div>

                <div class="moadian-form">
                    <div class="form-group">
                        <label>شناسه حافظه مالیاتی <span class="req">*</span></label>
                        <input type="text" id="moTaxUser"
                               placeholder="مثلاً: ABC123"
                               value="${H.esc(s.taxUserName || '')}"
                               maxlength="6" dir="ltr">
                        <p class="form-hint">شناسه ۶ حرفی که سازمان مالیاتی به شما داده</p>
                    </div>

                    <div class="form-group">
                        <label>کد اقتصادی <span class="req">*</span></label>
                        <input type="text" id="moEconomicCode"
                               placeholder="مثلاً: 411234567890"
                               value="${H.esc(s.codeEgtesadi || '')}"
                               dir="ltr">
                        <p class="form-hint">شماره اقتصادی مودی (فروشنده)</p>
                    </div>

                    <div class="form-group">
                        <label>کلید خصوصی (PEM) <span class="req">*</span></label>
                        <textarea id="moPrivateKey" rows="10" dir="ltr"
                                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                  style="font-family:Consolas,monospace;font-size:12px;">${H.esc(s.privateKey === '***' ? '***' : (s.privateKey || ''))}</textarea>
                        <p class="form-hint">
                            ${s.privateKey === '***' ? '⚠️ کلید فعلی موجوده. اگه می‌خوای عوض کنی، متن جدید رو کامل پیست کن.' : ''}
                            کلید خصوصی RSA خودتون که از سازمان مالیاتی گرفتید
                        </p>
                    </div>

                    <div class="form-group">
                        <label class="moadian-checkbox-label">
                            <input type="checkbox" id="moIsSandbox" ${s.isSandbox ? 'checked' : ''}>
                            <span>حالت تست (Sandbox)</span>
                        </label>
                        <p class="form-hint">
                            ✅ تیک = اتصال به سرور تست<br>
                            ❌ بدون تیک = اتصال به سرور اصلی (Production)
                        </p>
                    </div>

                    <div class="moadian-actions">
                        <button class="btn btn-primary" id="moSaveBtn">
                            💾 ذخیره
                        </button>
                        <button class="btn btn-ghost" id="moTestBtn">
                            🔌 تست اتصال
                        </button>
                        <button class="btn btn-ghost" id="moFiscalBtn">
                            📋 اطلاعات مودی
                        </button>
                    </div>

                    <div id="moTestResult"></div>
                </div>
            </div>`;

        // Bind buttons
        document.getElementById('moSaveBtn').addEventListener('click', saveSettings);
        document.getElementById('moTestBtn').addEventListener('click', testConnection);
        document.getElementById('moFiscalBtn').addEventListener('click', getFiscalInfo);
    }

    async function saveSettings() {
        const btn = document.getElementById('moSaveBtn');
        btn.disabled = true;
        btn.textContent = '⏳ در حال ذخیره...';

        try {
            await window.App.Http.api('/api/moadian/settings', {
                method: 'PUT',
                body: JSON.stringify({
                    taxUserName: document.getElementById('moTaxUser').value.trim(),
                    codeEgtesadi: document.getElementById('moEconomicCode').value.trim(),
                    privateKey: document.getElementById('moPrivateKey').value.trim(),
                    isSandbox: document.getElementById('moIsSandbox').checked,
                    invoice: true,
                    customer: true,
                    stuff: true
                })
            });
            window.App.toast('تنظیمات ذخیره شد', 'success');
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 ذخیره';
        }
    }

    async function testConnection() {
        const btn = document.getElementById('moTestBtn');
        const result = document.getElementById('moTestResult');
        btn.disabled = true;
        btn.textContent = '⏳ در حال تست...';
        result.innerHTML = '';

        try {
            const resp = await window.App.Http.api('/api/moadian/test-connection');
            if (resp.success) {
                _state.serverInfo = resp;
                result.innerHTML = `
                    <div class="moadian-info-box moadian-info-success">
                        <div class="moadian-info-title">✅ اتصال موفق</div>
                        <div class="moadian-info-row">
                            <span>زمان سرور:</span>
                            <strong>${H.esc(resp.serverTime || '-')}</strong>
                        </div>
                        <div class="moadian-info-row">
                            <span>شناسه کلید:</span>
                            <strong style="direction:ltr;">${H.esc(resp.keyId || '-')}</strong>
                        </div>
                        <div class="moadian-info-row">
                            <span>الگوریتم:</span>
                            <strong style="direction:ltr;">${H.esc(resp.algorithm || '-')}</strong>
                        </div>
                        <div class="moadian-info-row">
                            <span>محیط:</span>
                            <strong>${resp.isSandbox ? '🧪 Sandbox (تست)' : '🚀 Production'}</strong>
                        </div>
                    </div>`;
            } else {
                result.innerHTML = `
                    <div class="moadian-info-box moadian-info-error">
                        <div class="moadian-info-title">❌ خطا در اتصال</div>
                        <div style="margin-top:8px;font-size:12px;">${H.esc(resp.error || '')}</div>
                    </div>`;
            }
        } catch (err) {
            result.innerHTML = `
                <div class="moadian-info-box moadian-info-error">
                    <div class="moadian-info-title">❌ خطا</div>
                    <div style="margin-top:8px;font-size:12px;">${H.esc(err.message)}</div>
                </div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '🔌 تست اتصال';
        }
    }

    async function getFiscalInfo() {
        const btn = document.getElementById('moFiscalBtn');
        const result = document.getElementById('moTestResult');
        btn.disabled = true;
        btn.textContent = '⏳ ...';
        result.innerHTML = '';

        try {
            const resp = await window.App.Http.api('/api/moadian/fiscal-info');
            if (resp.success) {
                result.innerHTML = `
                    <div class="moadian-info-box moadian-info-success">
                        <div class="moadian-info-title">📋 اطلاعات حافظه مالیاتی</div>
                        <div class="moadian-info-row">
                            <span>نام تجاری:</span>
                            <strong>${H.esc(resp.nameTrade || '-')}</strong>
                        </div>
                        <div class="moadian-info-row">
                            <span>کد اقتصادی:</span>
                            <strong style="direction:ltr;">${H.esc(resp.economicCode || '-')}</strong>
                        </div>
                        <div class="moadian-info-row">
                            <span>وضعیت:</span>
                            <strong>${H.esc(resp.fiscalStatus || '-')}</strong>
                        </div>
                        <div class="moadian-info-row">
                            <span>حد فروش:</span>
                            <strong>${resp.saleThreshold ? H.fmt(resp.saleThreshold) : '-'}</strong>
                        </div>
                    </div>`;
            } else {
                result.innerHTML = `
                    <div class="moadian-info-box moadian-info-error">
                        <div class="moadian-info-title">❌ خطا</div>
                        <div style="margin-top:8px;font-size:12px;">${H.esc(resp.error || '')}</div>
                    </div>`;
            }
        } catch (err) {
            result.innerHTML = `
                <div class="moadian-info-box moadian-info-error">
                    <div class="moadian-info-title">❌ خطا</div>
                    <div style="margin-top:8px;font-size:12px;">${H.esc(err.message)}</div>
                </div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '📋 اطلاعات مودی';
        }
    }

    // ═══════════════════════════════════════════════════
    //  ACTIONS
    // ═══════════════════════════════════════════════════

    async function createFromFactor(factorId) {
        const inty = getSelectedInty();
        const intyNames = { 1: 'نوع اول', 2: 'نوع دوم', 3: 'نوع سوم' };

        if (!confirm(`ایجاد سند مالیاتی با ${intyNames[inty]}؟`)) return;

        try {
            const resp = await window.App.Http.api('/api/moadian/headers/from-factor', {
                method: 'POST',
                body: JSON.stringify({ factorId, inty })   // ⭐ inty اضافه شد
            });
            window.App.toast('✅ سند با ' + intyNames[inty] + ' و سریال ' + resp.inno + ' ساخته شد', 'success');
            searchPending();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    async function createAll() {
        const items = _state.pendingFactors;
        if (items.length === 0) {
            window.App.toast('فاکتوری در این صفحه نیست', 'error');
            return;
        }

        const inty = getSelectedInty();
        const intyNames = { 1: 'نوع اول', 2: 'نوع دوم', 3: 'نوع سوم' };

        if (!confirm(`${items.length} فاکتور رو با ${intyNames[inty]} به سند مالیاتی تبدیل کنم؟`)) return;

        let ok = 0, fail = 0;

        for (const f of items) {
            try {
                await window.App.Http.api('/api/moadian/headers/from-factor', {
                    method: 'POST',
                    body: JSON.stringify({ factorId: f.id, inty })   // ⭐ inty اضافه شد
                });
                ok++;
            } catch {
                fail++;
            }
        }

        window.App.toast(`✅ ${ok} سند (${intyNames[inty]}) ساخته شد${fail > 0 ? ' | ❌ ' + fail + ' خطا' : ''}`,
            fail > 0 ? 'error' : 'success');
        searchPending();
    }

    async function sendOne(headerId) {
        if (!confirm('این سند رو به سامانه مودیان ارسال کنم؟')) return;

        const btn = event?.target;
        if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

        try {
            const resp = await window.App.Http.api('/api/moadian/send', {
                method: 'POST',
                body: JSON.stringify({ headerId })
            });

            if (resp.success) {
                window.App.toast('✅ ارسال موفق - شماره رسید: ' + (resp.referenceNumber || '-'), 'success');
            } else {
                window.App.toast('❌ خطا: ' + (resp.error || 'نامشخص'), 'error');
            }
            renderHeaders();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = '📤'; }
        }
    }

    async function sendAll() {
        const sendable = _state.headers.filter(h => h.status === 0 || h.status === 2);
        if (sendable.length === 0) {
            window.App.toast('سند ارسال‌نشده‌ای وجود نداره', 'error');
            return;
        }

        if (!confirm(`${sendable.length} سند ارسال کنم؟`)) return;

        try {
            const resp = await window.App.Http.api('/api/moadian/send-bulk', {
                method: 'POST',
                body: JSON.stringify({ headerIds: sendable.map(h => h.id) })
            });
            window.App.toast(`✅ ${resp.success} موفق | ❌ ${resp.failed} خطا`,
                resp.failed > 0 ? 'error' : 'success');
            renderHeaders();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    async function inquiry(headerId) {
        try {
            const resp = await window.App.Http.api('/api/moadian/inquiry', {
                method: 'POST',
                body: JSON.stringify({ headerId })
            });

            if (!resp.success) {
                window.App.toast('خطا: ' + (resp.error || 'نامشخص'), 'error');
                return;
            }

            if (resp.errors && resp.errors.length > 0) {
                const msgs = resp.errors.map(e => e.msg || e.code).join('\n');
                alert('⚠️ خطاها:\n' + msgs);
            } else {
                window.App.toast('✅ وضعیت: ' + (resp.status || 'OK'), 'success');
            }
            refreshHeaders();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    async function viewHeader(id) {
        try {
            const resp = await window.App.Http.api('/api/moadian/headers/' + id);
            const h = resp.header || {};
            const body = resp.body || [];

            const rows = body.map((b, idx) => `
                <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td class="num text-center">${H.esc(b.sstid || '')}</td>
                    <td>${H.esc(b.sstt || '')}</td>
                    <td class="num text-left">${H.fmt(b.am)}</td>
                    <td class="text-center">${H.esc(b.mu || '')}</td>
                    <td class="num text-left">${H.fmt(b.fee)}</td>
                    <td class="num text-left">${H.fmt(b.dis)}</td>
                    <td class="num text-left">${H.fmt(b.vam)}</td>
                    <td class="num text-left">${H.fmt(b.tsstam)}</td>
                </tr>`).join('');

            const html = `
                <div class="moadian-detail">
                    <table class="factor-info-table">
                        <tr>
                            <td class="label">سریال داخلی:</td><td><strong>${H.esc(h.inno || '')}</strong></td>
                            <td class="label">شماره مالیاتی:</td><td style="direction:ltr;">${H.esc(h.taxId || '-')}</td>
                            <td class="label">وضعیت:</td><td>${getStatusBadge(h.status)}</td>
                        </tr>
                        <tr>
                            <td class="label">تاریخ:</td><td>${H.esc(h.indatimPersian || '')}</td>
                            <td class="label">Ref Number:</td><td style="direction:ltr;">${H.esc(h.refNumber || '-')}</td>
                            <td class="label">UID:</td><td style="direction:ltr;font-size:11px;">${H.esc(h.uid || '-')}</td>
                        </tr>
                        <tr>
                            <td class="label">کد مشتری:</td><td>${h.customerCode || ''}</td>
                            <td class="label">نام:</td><td colspan="3">${H.esc(h.customerName || '')}</td>
                        </tr>
                        <tr>
                            <td class="label">جمع کل:</td><td class="num"><strong>${H.fmt(h.tbill)}</strong></td>
                            <td class="label">جمع VAT:</td><td class="num">${H.fmt(h.tvam)}</td>
                            <td class="label">جمع تخفیف:</td><td class="num">${H.fmt(h.tdis)}</td>
                        </tr>
                    </table>
                </div>

                <h4 style="margin:16px 0 8px;">📋 ردیف‌ها (${body.length})</h4>
                <div class="table-wrapper">
                    <table class="moadian-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>شناسه کالا</th>
                                <th>شرح</th>
                                <th>تعداد</th>
                                <th>واحد</th>
                                <th>قیمت</th>
                                <th>تخفیف</th>
                                <th>VAT</th>
                                <th>جمع</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="9" class="text-center">ردیفی نیست</td></tr>'}</tbody>
                    </table>
                </div>`;

            window.App.openModal('جزئیات سند مالیاتی', html);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    async function deleteHeader(id) {
        if (!confirm('این سند مالیاتی رو حذف کنم؟')) return;

        try {
            await window.App.Http.api('/api/moadian/headers/' + id, { method: 'DELETE' });
            window.App.toast('سند حذف شد', 'success');
            renderHeaders();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }
    function searchHeaders() {
        _state.headersPage = 1;
        renderHeaders(1);
    }

    function resetSearch() {
        const s = document.getElementById('moSearch');
        const st = document.getElementById('moStatusFilter');
        if (s) s.value = '';
        if (st) st.value = '';
        searchHeaders();
    }

    function sortHeaders(col) {
        if (_state.headersSortBy === col) {
            _state.headersSortDir = _state.headersSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            _state.headersSortBy = col;
            _state.headersSortDir = 'asc';
        }
        searchHeaders();
    }

    function goToHeadersPage(page) {
        _state.headersPage = page;
        renderHeaders(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // ⭐ فاکتورهای آماده ارسال
    function searchPending() {
        _state.pendingPage = 1;
        renderPending(1);
    }

    function resetPendingSearch() {
        const s = document.getElementById('moPendingSearch');
        if (s) s.value = '';
        searchPending();
    }

    function sortPending(col) {
        if (_state.pendingSortBy === col) {
            _state.pendingSortDir = _state.pendingSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            _state.pendingSortBy = col;
            _state.pendingSortDir = 'asc';
        }
        searchPending();
    }

    function goToPendingPage(page) {
        _state.pendingPage = page;
        renderPending(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function getSelectedInty() {
        const el = document.querySelector('input[name="moInty"]:checked');
        return el ? parseInt(el.value, 10) : 1;
    }
    // ═══════════════════════════════════════════════════
    //  PUBLIC
    // ═══════════════════════════════════════════════════
    return {
        render,
        refreshPending: searchPending,
        refreshHeaders: renderHeaders,
        createFromFactor,
        createAll,
        sendOne,
        sendAll,
        inquiry,
        viewHeader,
        deleteHeader,
        // ⭐ فاکتورهای آماده
        searchPending,
        resetPendingSearch,
        sortPending,
        goToPendingPage,
        // ⭐ اسناد ارسال‌شده
        searchHeaders,
        resetSearch,
        sortHeaders,
        goToHeadersPage
    };
})();

window.App.renderMoadian = window.App.Features.Moadian.render;