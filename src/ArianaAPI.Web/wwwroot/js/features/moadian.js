/* ═══════════════════════════════════════════════════
   Feature / Moadian — سامانه مودیان
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Moadian = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ⭐ بستن کامل همه modal ها (helper مشترک)
    // ⭐ بستن کامل همه modal ها (helper مشترک)
    // ⭐ بستن کامل همه modal ها (helper مشترک — نسخه‌ی امن)
    // ⭐⭐⭐ بستن کامل modal ها — نسخه‌ی امن
    // ⭐⭐⭐ بستن کامل modal ها — نسخه‌ی امن (فقط مودال‌های مودیان)
    function _closeAllModals() {
        // ۱️⃣ فقط از Modal API استفاده کن — DOM رو دست نزن
        try {
            const M = window.App && window.App.UI && window.App.UI.Modal;
            if (M) {
                if (typeof M.close === 'function') {
                    try { M.close(); } catch (e) { }
                }
                if (typeof M.closeAll === 'function') {
                    try { M.closeAll(); } catch (e) { }
                }
            }
        } catch (e) {
            console.warn('Modal API reset failed:', e);
        }
        // ⭐ لیست ارزها — طبق استاندارد سامانه مودیان (پورت از Functions.cs)
        
        // ۲️⃣ فقط overlay های موقتی خودمون (Picker کالا) رو پاک کن
        document.querySelectorAll('.ap-overlay').forEach(function (el) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });

        // ۳️⃣ پاک کردن کلاس‌های body
        document.body.classList.remove(
            'modal-open', 'no-scroll', 'overflow-hidden',
            'modal-show', 'modal-active'
        );
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    const CURRENCIES = [
        'IRR', 'USD', 'AFN', 'EUR', 'ALL', 'DZD', 'AOA', 'XCD', 'ARS', 'AMD',
        'AWG', 'AUD', 'AZN', 'BSD', 'BHD', 'BDT', 'BBD', 'BYN', 'BZD', 'XOF',
        'BMD', 'INR', 'BTN', 'BOB', 'BOV', 'BAM', 'BWP', 'NOK', 'BRL', 'BND',
        'BGN', 'BIF', 'CVE', 'KHR', 'XAF', 'CAD', 'KYD', 'CLP', 'CLF', 'CNY',
        'COP', 'COU', 'KMF', 'CDF', 'NZD', 'CRC', 'CUP', 'CUC', 'ANG', 'CZK',
        'DKK', 'DJF', 'DOP', 'EGP', 'SVC', 'ERN', 'SZL', 'ETB', 'FKP', 'FJD',
        'XPF', 'GMD', 'GEL', 'GHS', 'GIP', 'GTQ', 'GBP', 'GNF', 'GYD', 'HTG',
        'HNL', 'HKD', 'HUF', 'ISK', 'IDR', 'XDR', 'IQD', 'ILS', 'JMD', 'JPY',
        'JOD', 'KZT', 'KES', 'KPW', 'KRW', 'KWD', 'KGS', 'LAK', 'LBP', 'LSL',
        'ZAR', 'LRD', 'LYD', 'CHF', 'MOP', 'MKD', 'MGA', 'MWK', 'MYR', 'MVR',
        'MRU', 'MUR', 'XUA', 'MXN', 'MXV', 'MDL', 'MNT', 'MAD', 'MZN', 'MMK',
        'NAD', 'NPR', 'NIO', 'NGN', 'OMR', 'PKR', 'PAB', 'PGK', 'PYG', 'PEN',
        'PHP', 'PLN', 'QAR', 'RON', 'RUB', 'RWF', 'WST', 'STN', 'SAR', 'RSD',
        'SCR', 'SLL', 'SLE', 'SGD', 'XSU', 'SBD', 'SOS', 'SSP', 'LKR', 'SDG',
        'SRD', 'SEK', 'CHE', 'CHW', 'SYP', 'TWD', 'TJS', 'THB', 'TOP', 'TTD',
        'TND', 'TRY', 'TMT', 'UGX', 'UAH', 'AED', 'USN', 'UYU', 'UYI', 'UYW',
        'UZS', 'VUV', 'VES', 'VED', 'VND', 'YER', 'ZMW', 'ZWL', 'XBA', 'XBB',
        'XBC', 'XBD', 'XTS', 'XXX', 'XAU', 'XPD', 'XPT', 'XAG'
    ];

    // ⭐ ساخت HTML داینامیک برای Select ارز
    function _currencyOptions(selected) {
        const sel = (selected || 'IRR').toUpperCase();
        return CURRENCIES.map(c =>
            `<option value="${c}" ${c === sel ? 'selected' : ''}>${c}</option>`
        ).join('');
    }
    let _state = {
        activeTab: 'pending',
        pendingFactors: [],
        pendingData: null,
        pendingPage: 1,
        pendingSearch: '',              // ⭐ جدید
        pendingSortBy: 'date',
        pendingSortDir: 'desc',
        headers: [],
        headersData: null,
        headersPage: 1,
        headersSearch: '',              // ⭐ جدید
        headersStatus: '',              // ⭐ جدید
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
        if (!_state.activeTab) _state.activeTab = 'pending';

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

        body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        _state.pendingPage = page || _state.pendingPage || 1;

        const payload = {
            search: _state.pendingSearch || null,     // ⭐ از state
            sortBy: _state.pendingSortBy,
            sortDir: _state.pendingSortDir,
            page: _state.pendingPage,
            pageSize: 20
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
                           value="${H.esc(_state.pendingSearch || '')}">
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
                               onclick="App.Features.Moadian.sortPending('customerCode')">کد مشتری${sortIcon('customerCode')}
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

        body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        _state.headersPage = page || _state.headersPage || 1;

        const payload = {
            search: _state.headersSearch || null,        // ⭐ از state
            status: _state.headersStatus !== '' ? parseInt(_state.headersStatus, 10) : null,   // ⭐ از state
            sortBy: _state.headersSortBy,
            sortDir: _state.headersSortDir,
            page: _state.headersPage,
            pageSize: 20
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
            success: data.countSuccess || 0,
            accepted: data.countAccepted || 0,   
            rejected: data.countRejected || 0    
        };

        // ═══ ردیف‌ها ═══
        let rows = '';
        if (items.length === 0) {
            rows = '<tr><td colspan="11" class="text-center" style="padding:30px;color:#94A3B8;">سندی یافت نشد</td></tr>';
        } else {
            rows = items.map(h => {
                const status = getStatusBadge(h.status);
                const intyBadge = getIntyBadge(h.inty);
                const insBadge = getInsBadge(h.ins);
                const sendable = h.status === 0 || h.status === 2;
                const inquiriable = h.status !== 0 && h.status !== 2;
                const canCorrect = h.status === 3 && (h.ins === 1 || h.ins == null);  
                const canEdit = h.status === 0 || h.status === 2;

                return `
            <tr class="moadian-row status-${h.status}">
                <td class="num text-center">${h.inno || ''}</td>
                <td class="num text-center">${H.esc(h.indatimPersian || '')}</td>
                <td class="num text-center">${H.esc(h.factorNo || '-')}</td>
                <td class="num text-center">${h.customerCode || ''}</td>
                <td>${H.esc(h.customerName || '-')}</td>
                <td class="text-center">${intyBadge}</td>
                <td class="text-center">${insBadge}</td>
                <td class="num text-left">${H.fmt(h.tbill)}</td>
                <td class="text-center">${status}</td>
                <td class="num text-center" style="font-size:11px;direction:ltr;">
                    ${h.refNumber ? H.esc(h.refNumber) : '-'}
                </td>
                  <td class="text-center">
                    ${sendable ? `<button class="btn btn-sm btn-primary"
                            onclick="App.Features.Moadian.sendOne(${h.id})" title="ارسال">📤</button>` : ''}
                    ${canEdit ? `<button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Moadian.openEditForm(${h.id}, 'presend')" 
                            title="ویرایش سند" 
                            style="color:#059669;">✏️</button>` : ''}
                    ${inquiriable ? `<button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Moadian.inquiry(${h.id})" title="استعلام عادی">🔍</button>` : ''}
                    ${inquiriable ? `<button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Moadian.testRefInquiry(${h.id})" 
                            title="🔬 تست استعلام" 
                            style="color:#7C3AED;">🔬</button>` : ''}
                    ${canCorrect ? `<button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Moadian.openCorrectDialog(${h.id})" 
                            title="اصلاحی / ابطالی / برگشت" 
                            style="color:#F59E0B;">✏️</button>` : ''}
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
                <div class="moadian-stat-label">✅ در کارپوشه</div>
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
                    <button class="btn btn-sm btn-ghost" onclick="App.Features.Moadian.inquiryAllInInbox()"
                            title="استعلام مجدد همه‌ی اسناد در کارپوشه">
                        🔄 استعلام گروهی
                    </button>
                </div>
            </div>

            <!-- ⭐ فیلتر -->
            <div class="moadian-filter-bar">
                <div class="form-group">
                    <input type="text" id="moSearch"
                           placeholder="🔍 جستجو: شماره فاکتور، مشتری، سریال..."
                           value="${H.esc(_state.headersSearch || '')}">
                </div>
                <div class="form-group">
                    <select id="moStatusFilter">
                        <option value="">همه وضعیت‌ها</option>
                        <option value="0" ${_state.headersStatus === '0' ? 'selected' : ''}>⏳ ارسال نشده</option>
                        <option value="1" ${_state.headersStatus === '1' ? 'selected' : ''}>📤 ارسال شده</option>
                        <option value="2" ${_state.headersStatus === '2' ? 'selected' : ''}>❌ خطا</option>
                        <option value="3" ${_state.headersStatus === '3' ? 'selected' : ''}>✅ در کارپوشه</option>
                        <option value="4" ${_state.headersStatus === '4' ? 'selected' : ''}>✅✅ تایید خریدار</option>
                        <option value="5" ${_state.headersStatus === '5' ? 'selected' : ''}>❌ رد خریدار</option>
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
                            <th style="width:90px;">نوع</th>
                            <th style="width:110px;">موضوع</th>
                            <th class="sortable-th text-left ${sortClass('amount')}"
                                onclick="App.Features.Moadian.sortHeaders('amount')">
                                مبلغ${sortIcon('amount')}
                            </th>
                            <th class="sortable-th ${sortClass('status')}"
                                onclick="App.Features.Moadian.sortHeaders('status')">
                                وضعیت${sortIcon('status')}
                            </th>
                            <th style="width:130px;">Ref Number</th>
                            <th style="width:220px;">عملیات</th>
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
            3: '<span class="moadian-badge moadian-badge-success">✅ در کارپوشه</span>',  

        };
        return map[status] || '<span class="moadian-badge">-</span>';
    }

    function getIntyBadge(inty) {
        const map = {
            1: '<span class="moadian-badge" style="background:#E0E7FF;color:#3730A3;">نوع اول</span>',
            2: '<span class="moadian-badge" style="background:#FEF3C7;color:#92400E;">نوع دوم</span>',
            3: '<span class="moadian-badge" style="background:#FCE7F3;color:#9F1239;">نوع سوم</span>'
        };
        return map[inty] || '<span class="moadian-badge">-</span>';
    }

    function getInsBadge(ins) {
        const map = {
            1: '<span class="moadian-badge" style="background:#DBEAFE;color:#1E40AF;">اصلی</span>',
            2: '<span class="moadian-badge" style="background:#FEF3C7;color:#92400E;">اصلاحی</span>',
            3: '<span class="moadian-badge" style="background:#FEE2E2;color:#991B1B;">ابطالی</span>',
            4: '<span class="moadian-badge" style="background:#FED7AA;color:#9A3412;">برگشت از فروش</span>'
        };
        return map[ins] || '<span class="moadian-badge">-</span>';
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

    // ⭐ استعلام گروهی — همه‌ی اسناد در کارپوشه (status=3)
    async function inquiryAllInInbox() {
        const inInbox = _state.headers.filter(h => h.status === 3);

        if (inInbox.length === 0) {
            window.App.toast('سندی در کارپوشه برای استعلام وجود نداره', 'error');
            return;
        }

        if (!confirm(`${inInbox.length} سند در کارپوشه رو استعلام مجدد کنم؟\n\n(پاسخ خریدار: تایید/رد)`)) return;

        const btn = event?.target;
        if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال استعلام...'; }

        let ok = 0, fail = 0, accepted = 0, rejected = 0;

        for (const h of inInbox) {
            try {
                const r = await window.App.Http.api('/api/moadian/inquiry', {
                    method: 'POST',
                    body: JSON.stringify({ headerId: h.id })
                });

                if (r.success) {
                    ok++;
                    // ⭐ شمارش تایید/رد خریدار
                    if (r.status === 'SUCCESS' && r.taxResult === 'ACCEPTED') accepted++;
                    if (r.status === 'SUCCESS' && r.taxResult === 'REJECTED') rejected++;
                } else {
                    fail++;
                }
            } catch (err) {
                fail++;
                console.error('Inquiry failed for header ' + h.id, err);
            }
        }

        let msg = `✅ ${ok} استعلام موفق`;
        if (accepted > 0) msg += ` | ✅✅ ${accepted} تایید خریدار`;
        if (rejected > 0) msg += ` | ❌ ${rejected} رد خریدار`;
        if (fail > 0) msg += ` | ❌ ${fail} خطا`;

        window.App.toast(msg, fail > 0 ? 'error' : 'success');
        renderHeaders();
    }
    async function inquiry(headerId) {
        try {
            const resp = await window.App.Http.api('/api/moadian/inquiry', {
                method: 'POST',
                body: JSON.stringify({ headerId })
            });

            if (!resp.success) {
                window.App.toast('خطا: ' + (resp.error || 'نامشخص'), 'error');
                renderHeaders();      // ⭐ تغییر: renderHeaders
                return;
            }

            if (resp.errors && resp.errors.length > 0) {
                const msgs = resp.errors.map(e => e.msg || e.code).join('\n');
                alert('⚠️ خطاها:\n' + msgs);
            } else {
                // ⭐ پیام بهتر بر اساس taxResult
                const taxResult = (resp.taxResult || '').toUpperCase();
                let msg = '✅ در کارپوشه';
                if (taxResult === 'ACCEPTED') msg = '✅✅ خریدار تایید کرد';
                else if (taxResult === 'REJECTED') msg = '❌ خریدار رد کرد';
                else if (taxResult === 'PARTIAL_ACCEPTED') msg = '⚠️ تایید جزئی';
                else msg = '⏳ در انتظار پاسخ خریدار';

                window.App.toast(msg, taxResult === 'REJECTED' ? 'error' : 'success');
            }

            renderHeaders();          // ⭐ تغییر: renderHeaders
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

            // ⭐ بعد از اینکه resp رو گرفتی، خطاها رو هم بگیر
            const errorsResp = await window.App.Http.api('/api/moadian/headers/' + id + '/errors');
            const errors = errorsResp.items || [];
            const errorsHtml = errors.length > 0 ? `
                    <div style="margin:16px 0;padding:12px;background:#FEF3C7;border-right:4px solid #F59E0B;border-radius:8px;max-height:300px;overflow-y:auto;">
                        <div style="font-weight:700;color:#B45309;margin-bottom:8px;">
                            ⚠️ ${errors.length} هشدار از سامانه مودیان
                        </div>
                        <ul style="margin:0;padding-right:20px;font-size:12px;line-height:1.8;color:#78350F;">
                            ${errors.slice(0, 50).map(e => `<li>${H.esc(e)}</li>`).join('')}
                            ${errors.length > 50 ? `<li><em>... و ${errors.length - 50} مورد دیگر</em></li>` : ''}
                        </ul>
                    </div>
                ` : '';
            // ⭐ لینک به پورتال مودیان
            const portalLink = h.taxId ? `
                    <div style="margin:12px 0;padding:12px;background:#EEF2FF;border-right:4px solid #6366F1;border-radius:8px;">
                        <div style="font-weight:700;color:#4338CA;margin-bottom:6px;">
                            🔗 مشاهده وضعیت تایید خریدار در پورتال مودیان
                        </div>
                        <div style="font-size:12px;color:#4F46E5;margin-bottom:8px;">
                            API سامانه مودیان این اطلاعات را برنمی‌گرداند. برای دیدن تایید/رد خریدار از لینک زیر استفاده کنید:
                        </div>
                        <a href="https://tp.tax.gov.ir/invoice/sell/internal/Details/${H.esc(h.taxId)}"
                           target="_blank"
                           style="display:inline-block;padding:6px 12px;background:#6366F1;color:#fff;
                                  border-radius:6px;text-decoration:none;font-size:12px;">
                            🔗 باز کردن در پورتال
                        </a>
                    </div>
                ` : '';

            const html = `
                    ${portalLink}
                    ${errorsHtml}
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
                            <td class="label">جمع ارزش افزوده:</td><td class="num">${H.fmt(h.tvam)}</td>
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
                                <th>ارزش افزوده</th>
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
        // ⭐ چک کن اگه ابطالی/اصلاحی/برگشتیه، هشدار قوی‌تر بده
        const h = _state.headers.find(x => x.id === id);
        let message = 'این سند مالیاتی رو حذف کنم؟';

        if (h && (h.ins === 2 || h.ins === 3 || h.ins === 4)) {
            const insNames = { 2: 'اصلاحی', 3: 'ابطالی', 4: 'برگشت از فروش' };
            message = `⚠️ این سند ${insNames[h.ins]}ه و به فاکتور اصلی لینک داره.\n\nاگه حذفش کنی، فاکتور اصلی دوباره قابل اصلاح میشه.\n\nآیا مطمئنید؟`;
        }

        if (!confirm(message)) return;

        try {
            await window.App.Http.api('/api/moadian/headers/' + id, { method: 'DELETE' });
            window.App.toast('سند حذف شد', 'success');
            renderHeaders();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }
    function searchHeaders() {
        _state.headersSearch = document.getElementById('moSearch')?.value || '';
        _state.headersStatus = document.getElementById('moStatusFilter')?.value || '';
        _state.headersPage = 1;
        renderHeaders(1);
    }

    function resetSearch() {
        _state.headersSearch = '';
        _state.headersStatus = '';
        _state.headersPage = 1;
        renderHeaders(1);
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
        _state.pendingSearch = document.getElementById('moPendingSearch')?.value || '';
        _state.pendingPage = 1;
        renderPending(1);
    }

    function resetPendingSearch() {
        _state.pendingSearch = '';
        _state.pendingPage = 1;
        renderPending(1);
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

    // ⭐⭐ استعلام با Reference Number (تست پاسخ خریدار)
    async function testRefInquiry(headerId) {
        try {
            window.App.toast('⏳ در حال استعلام...', '');

            const resp = await window.App.Http.api('/api/moadian/inquiry-by-ref', {
                method: 'POST',
                body: JSON.stringify({ headerId })
            });

            if (!resp.success) {
                window.App.toast('❌ خطا: ' + (resp.error || 'نامشخص'), 'error');
                console.error('RAW RESPONSE:', resp);
                return;
            }

            // ⭐ نمایش پاسخ خام توی console
            console.log('═══════════════════════════════════');
            console.log('🔍 RAW INQUIRY BY REF RESPONSE:');
            console.log(JSON.stringify(resp.raw, null, 2));
            console.log('═══════════════════════════════════');

            // ⭐ نمایش توی modal
            const rawJson = JSON.stringify(resp.raw, null, 2);
            const html = `
                <div style="padding:12px;">
                    <div style="margin-bottom:12px;padding:8px;background:#EEF2FF;border-radius:6px;">
                        <strong>Ref Number:</strong> 
                        <code style="direction:ltr;font-size:11px;">${H.esc(resp.refNumber || '-')}</code>
                    </div>
                    <pre style="background:#1E293B;color:#E2E8F0;padding:12px;border-radius:8px;
                                font-size:11px;direction:ltr;text-align:left;max-height:500px;
                                overflow:auto;line-height:1.5;">${H.esc(rawJson)}</pre>
                </div>`;

            window.App.openModal('🔍 پاسخ خام استعلام با RefNumber', html);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            console.error(err);
        }
    }
    // ⭐ دکمه‌ی اصلاحی/ابطالی/برگشت — موقت (فاز ۲ کامل میشه)
    // ⭐⭐ دیالوگ انتخاب نوع اصلاح
    async function openCorrectDialog(headerId) {
        try {
  
            // ۱. چک کن قبلاً اصلاحی/ابطالی ساخته شده؟
            const check = await window.App.Http.api('/api/moadian/headers/' + headerId + '/has-correction');
            if (check.has) {
                const c = check.correction;
                const insNames = { 2: 'اصلاحی', 3: 'ابطالی', 4: 'برگشت از فروش' };
                window.App.toast(
                    `⚠️ قبلاً یه سند ${insNames[c.ins] || '؟'} برای این فاکتور ساخته شده (سریال ${c.inno})`,
                    'error'
                );
                return;
            }

            // ۲. نمایش دیالوگ
            const html = `
                <div style="padding:24px;text-align:center;">
                    <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1E293B;">
                        انتخاب نوع عملیات
                    </div>
                    <div style="color:#64748B;font-size:13px;margin-bottom:24px;">
                        برای این فاکتور چه کاری می‌خواهید انجام دهید؟
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                        <button style="padding:16px;background:#FEE2E2;color:#991B1B;
                                border:2px solid #FCA5A5;border-radius:10px;cursor:pointer;
                                transition:transform .15s;"
                                onmouseover="this.style.transform='scale(1.03)'"
                                onmouseout="this.style.transform='scale(1)'"
                                onclick="App.Features.Moadian.doCorrect(${headerId}, 'cancel')">
                            <div style="font-size:28px;margin-bottom:6px;">🔴</div>
                            <div style="font-weight:700;font-size:14px;">ابطالی</div>
                            <div style="font-size:11px;margin-top:6px;opacity:.8;">لغو کامل فاکتور</div>
                        </button>

                        <button style="padding:16px;background:#FED7AA;color:#9A3412;
                                border:2px solid #FDBA74;border-radius:10px;cursor:pointer;
                                transition:transform .15s;"
                                onmouseover="this.style.transform='scale(1.03)'"
                                onmouseout="this.style.transform='scale(1)'"
                                onclick="App.Features.Moadian.doCorrect(${headerId}, 'return')">
                            <div style="font-size:28px;margin-bottom:6px;">🟠</div>
                            <div style="font-weight:700;font-size:14px;">برگشت از فروش</div>
                            <div style="font-size:11px;margin-top:6px;opacity:.8;">مرجوعی کالا</div>
                        </button>

                        <button style="padding:16px;background:#FEF3C7;color:#92400E;
                                border:2px solid #FCD34D;border-radius:10px;cursor:pointer;
                                transition:transform .15s;"
                                onmouseover="this.style.transform='scale(1.03)'"
                                onmouseout="this.style.transform='scale(1)'"
                                onclick="App.Features.Moadian.doCorrect(${headerId}, 'amend')">
                            <div style="font-size:28px;margin-bottom:6px;">🟡</div>
                            <div style="font-weight:700;font-size:14px;">اصلاحی</div>
                            <div style="font-size:11px;margin-top:6px;opacity:.8;">تغییر محتوا</div>
                        </button>
                    </div>

                    <button id="mo-correct-cancel" style="margin-top:20px;width:100%;padding:10px;
                            background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;
                            border-radius:8px;cursor:pointer;font-size:13px;">
                        انصراف
                    </button>
                </div>
            `;
            
            window.App.openModal('✏️ اصلاح سند مالیاتی', html);
            
            // ⭐ Bind دکمه انصراف
            setTimeout(() => {
                document.getElementById('mo-correct-cancel')?.addEventListener('click', () => {
                    _closeAllModals();
                });
            }, 50);

        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }
      // ⭐⭐ اجرای اصلاح
    async function doCorrect(headerId, mode) {
        if (mode === 'cancel') {
            const confirmed = confirm(
                `⚠️ ابطالی فاکتور\n\n` +
                `• یه سند جدید با مبالغ صفر ساخته میشه\n` +
                `• فاکتور اصلی دست‌نخورده می‌مونه\n` +
                `• بعد از ساخت، باید سند جدید رو دستی ارسال کنی\n` +
                `• اگه پشیمون شدی، سند جدید رو می‌تونی حذف کنی\n\n` +
                `آیا مطمئنید؟`
            );
            if (!confirmed) return;

            try {
                const resp = await window.App.Http.api('/api/moadian/headers/' + headerId + '/correct', {
                    method: 'POST',
                    body: JSON.stringify({ mode })
                });
                if (resp.success) {
                    _closeAllModals();
                    window.App.toast(`✅ سند ابطالی با سریال ${resp.inno} ساخته شد (ارسال نشده)`, 'success');
                    setTimeout(() => renderHeaders(), 600);
                } else {
                    window.App.toast('خطا: ' + (resp.error || 'نامشخص'), 'error');
                }
            } catch (err) {
                window.App.toast('خطا: ' + err.message, 'error');
            }
            return;
        }

        // ⭐ برگشت یا اصلاحی → فرم ویرایش
        await openEditForm(headerId, mode);
    }
    // ⭐ HTML یه ردیف اقلام
    function _editBodyRowHtml(b, idx, mode) {
        return `
            <tr data-idx="${idx}" style="border-bottom:1px solid #E2E8F0;">
                <td style="padding:4px;text-align:center;font-size:11px;">${idx + 1}</td>
                <td style="padding:4px;">
                    <button type="button" class="ed-pick-article"
                            style="width:100%;text-align:right;background:#F8FAFC;border:1px solid #CBD5E1;
                                   border-radius:5px;padding:4px 6px;cursor:pointer;font-size:11px;
                                   display:flex;justify-content:space-between;align-items:center;gap:4px;">
                        <span class="ed-art-label">${H.esc(b.sstt || '')}</span>
                        <span style="font-size:9px;color:#94A3B8;direction:ltr;" class="ed-art-code">${H.esc(b.sstid || '')}</span>
                        <span style="color:#6366F1;font-size:10px;">🔍</span>
                    </button>
                </td>
                <td style="padding:4px;"><input type="number" class="ed-am ed-mini" step="0.01" min="0"
                        data-stuff="${b.stuffId || 0}" data-unit="${b.unitId || 0}"
                        data-sstt="${H.esc(b.sstt || '')}" data-sstid="${H.esc(b.sstid || '')}"
                        value="${b.am}"></td>
                <td style="padding:4px;"><input type="number" class="ed-fee ed-mini" value="${b.fee || 0}"></td>
                <td style="padding:4px;"><input type="number" class="ed-dis ed-mini" value="${b.dis || 0}"></td>
                <td style="padding:4px;"><input type="number" class="ed-vra ed-mini" value="${b.vra || 0}" style="width:50px;"></td>
                <td style="padding:4px;"><input type="number" class="ed-vam ed-mini" value="${b.vam || 0}" style="width:75px;background:#FEF9C3;" title="مبلغ مالیات (خودکار محاسبه می‌شه)"></td>
                <td style="padding:4px;">
                    <select class="ed-cut ed-mini" dir="ltr" style="width:80px;padding:3px;font-size:11px;">
                        ${_currencyOptions(b.cut)}
                    </select>
                </td>
                <td style="padding:4px;"><input type="number" class="ed-exr ed-mini" value="${b.exr || 1}" style="width:60px;"></td>
                <td style="padding:4px;"><input type="number" class="ed-ssrv ed-mini" value="${b.ssrv || 0}" style="width:75px;"></td>
                <td style="padding:4px;"><input type="number" class="ed-sscv ed-mini" value="${b.sscv || 0}" style="width:75px;"></td>
                <td style="padding:4px;"><input type="number" class="ed-bros ed-mini" value="${b.bros || 0}" style="width:70px;"></td>
                <td style="padding:4px;text-align:left;font-weight:600;font-size:11px;" class="ed-line-total">0</td>
                <td style="padding:4px;text-align:center;">
                    <button type="button" class="btn-rm-row"
                            style="background:#FEE2E2;color:#DC2626;border:none;border-radius:4px;padding:3px 6px;cursor:pointer;font-size:11px;">🗑️</button>
                </td>
            </tr>
            <style>.ed-mini{padding:4px;border:1px solid #CBD5E1;border-radius:4px;text-align:center;font-size:11px;width:60px;}</style>
        `;
    }
    // ⭐⭐ فرم ویرایش برگشت/اصلاحی
    // ⭐⭐ فرم ویرایش کامل (Tab بندی) — برای presend/amend/return
    async function openEditForm(headerId, mode) {
        try {
            _closeAllModals();

            const resp = await window.App.Http.api('/api/moadian/headers/' + headerId);
            const h = resp.header || {};
            const body = resp.body || [];

            if (body.length === 0 && mode !== 'presend') {
                window.App.toast('فاکتور اصلی ردیف نداره', 'error');
                return;
            }

            const isReturn = mode === 'return';
            const isAmend = mode === 'amend';
            const isPresend = mode === 'presend';

            const formTitle = isPresend
                ? '✏️ ویرایش سند مالیاتی'
                : (isReturn ? '🟠 برگشت از فروش' : '🟡 اصلاحی');

            const insValue = isPresend ? (h.ins || 1) : (isReturn ? 4 : 2);
            const modeLabel = isPresend ? '' : (isReturn ? 'برگشتی' : 'اصلاح‌شده');

            // ═══ ردیف‌ها ═══
            const rowsHtml = body.map((b, idx) => _editBodyRowHtml(b, idx, mode)).join('');

            // ═══ HTML ═══
            const html = `
                <div class="ed-form" style="direction:rtl;">
                    <!-- ═══ Tabs ═══ -->
                    <div class="ed-tabs" style="display:flex;gap:4px;padding:8px 12px 0;border-bottom:2px solid #E2E8F0;background:#F8FAFC;">
                        <button type="button" class="ed-tab active" data-tab="main"
                                style="padding:10px 16px;border:none;background:#fff;border-radius:8px 8px 0 0;cursor:pointer;font-weight:600;color:#4338CA;border-bottom:2px solid #6366F1;margin-bottom:-2px;">
                            📋 هدر اصلی
                        </button>
                        <button type="button" class="ed-tab" data-tab="customs"
                                style="padding:10px 16px;border:none;background:transparent;border-radius:8px 8px 0 0;cursor:pointer;font-weight:600;color:#64748B;">
                            🛃 گمرکی و قرارداد
                        </button>
                        <button type="button" class="ed-tab" data-tab="buyer"
                                style="padding:10px 16px;border:none;background:transparent;border-radius:8px 8px 0 0;cursor:pointer;font-weight:600;color:#64748B;">
                            👤 خریدار
                        </button>
                        <button type="button" class="ed-tab" data-tab="items"
                                style="padding:10px 16px;border:none;background:transparent;border-radius:8px 8px 0 0;cursor:pointer;font-weight:600;color:#64748B;">
                            📦 اقلام (${body.length})
                        </button>
                    </div>

                    <div class="ed-body" style="padding:16px;max-height:60vh;overflow-y:auto;">

                        <!-- ═══ TAB 1: هدر اصلی ═══ -->
                        <div class="ed-pane" data-pane="main">
                            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;">
                                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                                    <div><strong>مشتری:</strong> ${H.esc(h.customerName || '-')}</div>
                                    <div><strong>سریال اصلی:</strong> ${H.esc(h.inno || '-')}</div>
                                    <div><strong>TaxId اصلی:</strong> <span style="direction:ltr;font-size:10px;">${H.esc(h.taxId || '-')}</span></div>
                                </div>
                            </div>

                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                                <div>
                                    <label class="ed-lb">سریال صورتحساب:</label>
                                    <input type="text" id="ed-inno" class="ed-inp" dir="ltr"
                                           value="${H.esc(h.inno || '')}">
                                </div>
                                <div>
                                    <label class="ed-lb">نوع صورتحساب:</label>
                                    <select id="ed-inty" class="ed-inp">
                                        <option value="1" ${h.inty === 1 ? 'selected' : ''}>نوع اول</option>
                                        <option value="2" ${h.inty === 2 ? 'selected' : ''}>نوع دوم</option>
                                        <option value="3" ${h.inty === 3 ? 'selected' : ''}>نوع سوم</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="ed-lb">الگوی صورتحساب:</label>
                                    <select id="ed-inp" class="ed-inp">
                                        <option value="1" ${h.inp === 1 ? 'selected' : ''}>فروش</option>
                                        <option value="2" ${h.inp === 2 ? 'selected' : ''}>فروش ارزی</option>
                                        <option value="3" ${h.inp === 3 ? 'selected' : ''}>طلا و جواهر</option>
                                        <option value="4" ${h.inp === 4 ? 'selected' : ''}>قرارداد پیمانکاری</option>
                                        <option value="5" ${h.inp === 5 ? 'selected' : ''}>قبوض خدماتی</option>
                                        <option value="6" ${h.inp === 6 ? 'selected' : ''}>بلیت هواپیما</option>
                                        <option value="7" ${h.inp === 7 ? 'selected' : ''}>صادرات</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="ed-lb">روش تسویه:</label>
                                    <select id="ed-setm" class="ed-inp">
                                        <option value="1" ${h.setm === 1 ? 'selected' : ''}>نقدی</option>
                                        <option value="2" ${h.setm === 2 ? 'selected' : ''}>نسیه</option>
                                        <option value="3" ${h.setm === 3 ? 'selected' : ''}>نقدی + نسیه</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="ed-lb">تاریخ صدور (شمسی):</label>
                                    <input type="text" id="ed-persian-date" class="ed-inp"
                                           value="${H.esc((h.indatimPersian || '').split(' ')[0])}" dir="ltr">
                                </div>
                                <div>
                                    <label class="ed-lb">تاریخ ایجاد (شمسی):</label>
                                    <input type="text" id="ed-create-date" class="ed-inp"
                                           value="${H.esc((h.Indati2mPersian || h.indatimPersian || '').split(' ')[0])}" dir="ltr">
                                </div>
                            </div>

                            <div style="margin-top:16px;padding:10px;background:#EEF2FF;border-right:4px solid #6366F1;border-radius:6px;font-size:11px;color:#3730A3;">
                                📌 مبالغ هدر به‌صورت خودکار از روی اقلام محاسبه می‌شن
                            </div>
                        </div>

                        <!-- ═══ TAB 2: گمرکی و قرارداد ═══ -->
                        <div class="ed-pane" data-pane="customs" style="display:none;">
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                                <div>
                                    <label class="ed-lb">شماره کوتاژ اظهارنامه گمرکی:</label>
                                    <input type="text" id="ed-cdcn" class="ed-inp" dir="ltr"
                                           value="${H.esc(h.cdcn || '')}" placeholder="مثلاً: 123456">
                                </div>
                                <div>
                                    <label class="ed-lb">تاریخ کوتاژ (Unix timestamp):</label>
                                    <input type="number" id="ed-cdcd" class="ed-inp" dir="ltr"
                                           value="${h.cdcd || ''}" placeholder="۰ (خالی)">
                                </div>
                                <div>
                                    <label class="ed-lb">کد گمرک محل اظهار:</label>
                                    <input type="text" id="ed-scc" class="ed-inp" dir="ltr"
                                           value="${H.esc(h.scc || '')}">
                                </div>
                                <div>
                                    <label class="ed-lb">شماره پروانه گمرکی:</label>
                                    <input type="text" id="ed-scln" class="ed-inp" dir="ltr"
                                           value="${H.esc(h.scln || '')}">
                                </div>
                                <div>
                                    <label class="ed-lb">شناسه یکتای ثبت قرارداد:</label>
                                    <input type="text" id="ed-crn" class="ed-inp" dir="ltr"
                                           value="${H.esc(h.crn || '')}">
                                </div>
                                <div>
                                    <label class="ed-lb">شناسه قبض:</label>
                                    <input type="text" id="ed-billid" class="ed-inp" dir="ltr"
                                           value="${H.esc(h.billid || '')}">
                                </div>
                            </div>
                        </div>

                        <!-- ═══ TAB 3: خریدار ═══ -->
                        <div class="ed-pane" data-pane="buyer" style="display:none;">
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                                <div>
                                    <label class="ed-lb">کد شعبه خریدار:</label>
                                    <input type="text" id="ed-bbc" class="ed-inp" dir="ltr"
                                           value="${H.esc(h.bbc || '')}">
                                </div>
                                <div>
                                    <label class="ed-lb">کد شعبه فروشنده:</label>
                                    <input type="text" id="ed-sbc" class="ed-inp" dir="ltr"
                                           value="${H.esc(h.sbc || '')}">
                                </div>
                                <div>
                                    <label class="ed-lb">نوع پرواز:</label>
                                    <select id="ed-ft" class="ed-inp">
                                        <option value="">—</option>
                                        <option value="1" ${h.ft === 1 ? 'selected' : ''}>داخلی</option>
                                        <option value="2" ${h.ft === 2 ? 'selected' : ''}>خارجی</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- ═══ TAB 4: اقلام ═══ -->
                        <div class="ed-pane" data-pane="items" style="display:none;">
                            <div style="overflow-x:auto;border:1px solid #E2E8F0;border-radius:8px;">
                                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                                    <thead style="background:#F1F5F9;position:sticky;top:0;">
                                        <tr>
                                            <th style="padding:6px;">#</th>
                                            <th style="padding:6px;text-align:right;min-width:220px;">کالا (کلیک = تغییر)</th>
                                            <th style="padding:6px;">تعداد</th>
                                            <th style="padding:6px;">قیمت</th>
                                            <th style="padding:6px;">تخفیف</th>
                                            <th style="padding:6px;">درصد ارزش افزوده</th>
                                            <th style="padding:6px;">مبلغ ارز افزوده</th>
                                            <th style="padding:6px;">ارز</th>
                                            <th style="padding:6px;">نرخ ارز</th>
                                            <th style="padding:6px;">ارزش ریالی</th>
                                            <th style="padding:6px;">ارزش ارزی</th>
                                            <th style="padding:6px;">حق‌العمل</th>
                                            <th style="padding:6px;">جمع خط</th>
                                            <th style="padding:6px;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="ed-items-tbody">${rowsHtml}</tbody>
                                </table>
                            </div>

                            <div style="margin-top:12px;text-align:left;">
                                <button type="button" id="ed-add-row"
                                        style="padding:8px 16px;background:#DBEAFE;color:#1E40AF;
                                               border:1px solid #93C5FD;border-radius:6px;cursor:pointer;
                                               font-size:12px;font-weight:600;">
                                    ➕ افزودن ردیف جدید
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- ═══ جمع‌ها ═══ -->
                    <div style="background:#EEF2FF;border-top:1px solid #C7D2FE;padding:12px 16px;">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:12px;">
                            <div><strong>جمع قبل از تخفیف:</strong> <span id="ed-tprdis">0</span></div>
                            <div><strong>تخفیفات:</strong> <span id="ed-tdis">0</span></div>
                            <div><strong>VAT:</strong> <span id="ed-tvam">0</span></div>
                            <div><strong>جمع کل:</strong> <span id="ed-tbill" style="font-weight:700;color:#4338CA;">0</span></div>
                        </div>
                    </div>

                    <!-- ═══ Footer ═══ -->
                    <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
                        <button type="button" class="ed-cancel"
                                style="padding:10px 20px;background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;border-radius:8px;cursor:pointer;">
                            انصراف
                        </button>
                        <button class="ed-submit"
                                style="padding:10px 24px;background:#6366F1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                            ${isPresend ? 'ذخیره تغییرات' : ('ثبت ' + (isReturn ? 'برگشت' : 'اصلاحی'))}
                        </button>
                    </div>
                </div>

                <style>
                    .ed-lb { display:block; font-size:11px; color:#475569; margin-bottom:4px; font-weight:600; }
                    .ed-inp { width:100%; padding:6px; border:1px solid #CBD5E1; border-radius:6px; font-size:12px; font-family:inherit; }
                    .ed-inp:focus { outline:none; border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
                </style>
            `;

            window.App.openModal(formTitle, html);

            // ═══ Bind tabs ═══
            const container = document.querySelector('.modal-body') || document.querySelector('.modal');
            if (!container) return;

            container.querySelectorAll('.ed-tab').forEach(btn => {
                btn.addEventListener('click', function () {
                    const tab = this.dataset.tab;
                    container.querySelectorAll('.ed-tab').forEach(b => {
                        b.classList.remove('active');
                        b.style.background = 'transparent';
                        b.style.borderBottom = 'none';
                        b.style.marginBottom = '0';
                        b.style.color = '#64748B';
                    });
                    this.classList.add('active');
                    this.style.background = '#fff';
                    this.style.borderBottom = '2px solid #6366F1';
                    this.style.marginBottom = '-2px';
                    this.style.color = '#4338CA';

                    container.querySelectorAll('.ed-pane').forEach(p => {
                        p.style.display = p.dataset.pane === tab ? 'block' : 'none';
                    });
                });
            });

            // ═══ Bind inputs ═══
            container.querySelectorAll('input[type=number]').forEach(inp => {
                inp.addEventListener('input', () => {
                    // ⭐ اگه کاربر vam رو دستی تغییر داد، flag بذار
                    if (inp.classList.contains('ed-vam')) {
                        inp.dataset.vamManual = '1';
                    }
                    // ⭐ اگه vra عوض شد، flag vam رو پاک کن تا auto محاسبه بشه
                    if (inp.classList.contains('ed-vra')) {
                        const tr = inp.closest('tr');
                        const vamEl = tr?.querySelector('.ed-vam');
                        if (vamEl) vamEl.dataset.vamManual = '0';
                    }
                    recalcEdForm(mode);
                });
            });

            // ═══ Picker کالا ═══
            container.querySelectorAll('.ed-pick-article').forEach(btn => {
                btn.addEventListener('click', function () {
                    const tr = this.closest('tr');
                    openArticlePicker(tr, mode);
                });
            });

            // ═══ حذف ردیف ═══
            container.querySelectorAll('.btn-rm-row').forEach(btn => {
                btn.addEventListener('click', function () {
                    this.closest('tr').remove();
                    recalcEdForm(mode);
                });
            });

            // ═══ افزودن ردیف ═══
            container.querySelector('#ed-add-row')?.addEventListener('click', () => {
                addNewEditRow(mode);
            });

            // ═══ انصراف ═══
            container.querySelector('.ed-cancel')?.addEventListener('click', () => {
                _closeAllModals();
            });

            // ═══ ثبت ═══
            container.querySelector('.ed-submit')?.addEventListener('click', () => {
                submitEditForm(headerId, mode);
            });

            setTimeout(() => recalcEdForm(mode), 50);

        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            console.error(err);
        }
    }
    // ⭐⭐ Picker کالا
    // ⭐⭐ Picker کالا — با overlay مستقل (بدون تداخل با modal اصلی)
    async function openArticlePicker(tr, mode) {
        try {
            const overlayId = 'ap-overlay-' + Date.now();

            // ⭐ overlay مستقل روی modal اصلی
            const overlayHtml = `
                <div id="${overlayId}" style="
                    position:fixed;top:0;left:0;right:0;bottom:0;
                    background:rgba(15,23,42,0.6);
                    display:flex;align-items:center;justify-content:center;
                    z-index:9999;padding:20px;direction:rtl;">
                    <div style="
                        background:#fff;border-radius:12px;
                        width:100%;max-width:600px;max-height:80vh;
                        display:flex;flex-direction:column;
                        box-shadow:0 20px 60px rgba(0,0,0,0.3);
                        overflow:hidden;">
                        <div style="
                            padding:14px 16px;background:#6366F1;color:#fff;
                            display:flex;justify-content:space-between;align-items:center;
                            font-weight:600;font-size:14px;">
                            <span>🔍 انتخاب کالا</span>
                            <button type="button" class="ap-close-btn" style="
                                background:transparent;border:none;color:#fff;
                                font-size:20px;cursor:pointer;padding:0 6px;line-height:1;">✕</button>
                        </div>
                        <div style="padding:12px;border-bottom:1px solid #E2E8F0;">
                            <input type="text" class="ap-search" placeholder="🔍 جستجو: نام کالا، شناسه یا کد..."
                                   style="width:100%;padding:10px;border:1px solid #CBD5E1;
                                          border-radius:8px;font-size:14px;" autofocus>
                        </div>
                        <div class="ap-results" style="
                            flex:1;overflow-y:auto;max-height:420px;min-height:200px;">
                            <div style="padding:20px;text-align:center;color:#94A3B8;font-size:13px;">
                                شروع به تایپ کن...
                            </div>
                        </div>
                    </div>
                </div>`;

            document.body.insertAdjacentHTML('beforeend', overlayHtml);

            const overlay = document.getElementById(overlayId);
            const searchInp = overlay.querySelector('.ap-search');
            const results = overlay.querySelector('.ap-results');

            // ⭐ تابع بستن — فقط Picker رو می‌بنده
            function closePicker() {
                overlay.remove();
            }

            // دکمه ✕
            overlay.querySelector('.ap-close-btn').addEventListener('click', closePicker);

            // کلیک روی پس‌زمینه
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closePicker();
            });

            // Escape
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    closePicker();
                    document.removeEventListener('keydown', escHandler);
                }
            });

            // جستجوی زنده
            let timer = null;
            searchInp.addEventListener('input', function () {
                clearTimeout(timer);
                const q = this.value.trim();
                timer = setTimeout(() => searchArticles(q, results, tr, mode, closePicker), 300);
            });

            searchInp.focus();
            searchArticles('', results, tr, mode, closePicker);

        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    async function searchArticles(q, container, tr, mode, closePicker) {
        try {
            container.innerHTML = '<div style="padding:20px;text-align:center;"><div class="spinner"></div></div>';

            const resp = await window.App.Http.api('/api/moadian/articles/search?q=' + encodeURIComponent(q || ''));
            const items = resp.items || [];

            if (items.length === 0) {
                container.innerHTML = '<div style="padding:20px;text-align:center;color:#94A3B8;font-size:13px;">کالایی یافت نشد</div>';
                return;
            }

            container.innerHTML = items.map(a => `
                <div class="ap-item" data-article='${JSON.stringify(a).replace(/'/g, "&#39;")}'
                     style="padding:10px 12px;border-bottom:1px solid #F1F5F9;cursor:pointer;
                            transition:background .15s;"
                     onmouseover="this.style.background='#F8FAFC'"
                     onmouseout="this.style.background=''">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                        <div style="flex:1;">
                            <div style="font-size:13px;font-weight:600;color:#1E293B;">${H.esc(a.name || '')}</div>
                            <div style="font-size:11px;color:#94A3B8;direction:ltr;margin-top:2px;">
                                ${H.esc(a.taxId || '-')} | ${H.esc(a.unitTaxId || '-')}
                            </div>
                        </div>
                        <div style="font-size:11px;color:#6366F1;white-space:nowrap;">
                            ${H.fmt(a.fee)} ریال
                        </div>
                    </div>
                </div>
            `).join('');

            container.querySelectorAll('.ap-item').forEach(el => {
                el.addEventListener('click', function () {
                    const article = JSON.parse(this.dataset.article);
                    applyArticleToRow(tr, article);
                    if (typeof closePicker === 'function') closePicker();   // ⭐ فقط Picker بسته میشه
                    recalcEdForm(mode);
                });
            });
        } catch (err) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#DC2626;font-size:13px;">خطا در جستجو</div>';
        }
    }

    //function applyArticleToRow(tr, article) {
    //    // به‌روز کردن دکمه Picker
    //    const btn = tr.querySelector('.ed-pick-article');
    //    if (btn) {
    //        btn.querySelector('.ed-art-label').textContent = article.name || '';
    //        btn.querySelector('.ed-art-code').textContent = article.taxId || '';
    //    }

    //    // به‌روز کردن input‌ها
    //    const amEl = tr.querySelector('.ed-am');
    //    const feeEl = tr.querySelector('.ed-fee');
    //    const disEl = tr.querySelector('.ed-dis');
    //    const vraEl = tr.querySelector('.ed-vra');

    //    if (amEl) {
    //        amEl.dataset.stuff = article.id || 0;
    //        amEl.dataset.unit = article.unitId || 0;
    //        amEl.dataset.sstt = article.name || '';
    //        amEl.dataset.sstid = article.taxId || '';
    //    }
    //    if (feeEl) feeEl.value = article.fee || 0;
    //    if (disEl) disEl.value = 0;
    //    if (vraEl) vraEl.value = article.vra || 0;
    //}

    function applyArticleToRow(tr, article) {
        const btn = tr.querySelector('.ed-pick-article');
        if (btn) {
            btn.querySelector('.ed-art-label').textContent = article.name || '';
            btn.querySelector('.ed-art-code').textContent = article.taxId || '';
        }

        const amEl = tr.querySelector('.ed-am');
        if (amEl) {
            amEl.dataset.stuff = article.id || 0;
            amEl.dataset.unit = article.unitId || 0;
        }

        const feeEl = tr.querySelector('.ed-fee');
        if (feeEl) feeEl.value = article.fee || 0;

        const disEl = tr.querySelector('.ed-dis');
        if (disEl) disEl.value = 0;

        const vraEl = tr.querySelector('.ed-vra');
        if (vraEl) vraEl.value = article.vra || 0;
    }

    // ⭐ افزودن ردیف جدید

    function addNewEditRow(mode) {
        const tbody = document.getElementById('ed-items-tbody');
        if (!tbody) return;

        const idx = tbody.querySelectorAll('tr').length;
        const emptyBody = {
            stuffId: 0, unitId: 0, am: 1, fee: 0, dis: 0, vra: 0, vam: 0,
            cut: 'IRR', exr: 1, ssrv: 0, sscv: 0, bros: 0,
            sstt: '', sstid: ''
        };

        const tr = document.createElement('tr');
        tr.setAttribute('data-idx', idx);
        tr.innerHTML = _editBodyRowHtml(emptyBody, idx, mode).replace('class="ed-art-label"', 'class="ed-art-label" style="color:#92400E;"');

        // پیام placeholder
        tr.querySelector('.ed-art-label').textContent = '➕ کالا انتخاب کن...';

        tbody.appendChild(tr);

        // Bind
        tr.querySelectorAll('input[type=number]').forEach(inp => {
            inp.addEventListener('input', () => recalcEdForm(mode));
        });
        tr.querySelector('.btn-rm-row').addEventListener('click', function () {
            tr.remove();
            recalcEdForm(mode);
        });
        tr.querySelector('.ed-pick-article').addEventListener('click', function () {
            openArticlePicker(tr, mode);
        });

        recalcEdForm(mode);
    }
    // ⭐ محاسبه‌ی زنده    // ⭐ محاسبه‌ی زنده
    // ⭐ محاسبه‌ی زنده
    function recalcEdForm(mode) {
        const container = document.querySelector('.modal-body') || document.querySelector('.modal');
        if (!container) return;

        let tprdis = 0, tdis = 0, tvam = 0;

        container.querySelectorAll('#ed-items-tbody tr').forEach(tr => {
            const amEl = tr.querySelector('.ed-am');
            const feeEl = tr.querySelector('.ed-fee');
            const disEl = tr.querySelector('.ed-dis');
            const vraEl = tr.querySelector('.ed-vra');
            const vamEl = tr.querySelector('.ed-vam');

            const am = parseFloat(amEl?.value) || 0;
            const fee = parseFloat(feeEl?.value) || 0;
            const dis = parseFloat(disEl?.value) || 0;
            const vra = parseFloat(vraEl?.value) || 0;

            const prdis = Math.round(fee * am);
            const adis = prdis - dis;

            // ⭐ محاسبه‌ی auto VAT: اگه کاربر دست نزده باشه، از vra محاسبه کن
            let vam = parseFloat(vamEl?.value) || 0;
            const manualVam = vamEl?.dataset?.vamManual === '1';

            if (!manualVam) {
                vam = Math.trunc(adis * vra / 100);
                if (vamEl) vamEl.value = vam;
            }

            const line = adis + vam;

            const lt = tr.querySelector('.ed-line-total');
            if (lt) lt.textContent = H.fmt(line);

            tprdis += prdis;
            tdis += dis;
            tvam += vam;
        });

        const tadis = tprdis - tdis;
        const tbill = tadis + tvam;

        const q = (s) => container.querySelector(s);
        if (q('#ed-tprdis')) q('#ed-tprdis').textContent = H.fmt(tprdis);
        if (q('#ed-tdis')) q('#ed-tdis').textContent = H.fmt(tdis);
        if (q('#ed-tvam')) q('#ed-tvam').textContent = H.fmt(tvam);
        if (q('#ed-tbill')) q('#ed-tbill').textContent = H.fmt(tbill);
    }
    // ⭐ ثبت نهایی
    // ⭐ ثبت نهایی
    async function submitEditForm(headerId, mode) {
        const container = document.querySelector('.modal-body') || document.querySelector('.modal');
        if (!container) return;

        const isPresend = mode === 'presend';

        // ═══ جمع‌آوری اقلام ═══
        const items = [];
        container.querySelectorAll('#ed-items-tbody tr').forEach(tr => {
            const amEl = tr.querySelector('.ed-am');
            if (!amEl) return;

            const stuffId = parseInt(amEl.dataset.stuff) || 0;
            const unitId = parseInt(amEl.dataset.unit) || 0;
            if (stuffId === 0) return;

            const am = parseFloat(amEl.value) || 0;
            if (am <= 0) return;

            items.push({
                stuffId: stuffId,
                unitId: unitId,
                am: am,
                fee: parseInt(tr.querySelector('.ed-fee')?.value) || 0,
                dis: parseInt(tr.querySelector('.ed-dis')?.value) || 0,
                vra: parseInt(tr.querySelector('.ed-vra')?.value) || 0,
                vam: parseInt(tr.querySelector('.ed-vam')?.value) || 0,
                cut: tr.querySelector('.ed-cut')?.value || 'IRR',
                exr: parseInt(tr.querySelector('.ed-exr')?.value) || 1,
                ssrv: parseInt(tr.querySelector('.ed-ssrv')?.value) || 0,
                sscv: parseInt(tr.querySelector('.ed-sscv')?.value) || 0,
                bros: parseInt(tr.querySelector('.ed-bros')?.value) || 0
            });
        });

        if (items.length === 0) {
            window.App.toast('حداقل یک ردیف لازمه', 'error');
            return;
        }

        const btn = container.querySelector('.ed-submit');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ ...'; }

        try {
            if (isPresend) {
                // ═══ ویرایش درجا (PUT) ═══
                const payload = {
                    inno: container.querySelector('#ed-inno')?.value?.trim() || null,
                    inty: parseInt(container.querySelector('#ed-inty')?.value) || 1,
                    inp: parseInt(container.querySelector('#ed-inp')?.value) || 1,
                    setm: parseInt(container.querySelector('#ed-setm')?.value) || 1,
                    indatimPersian: container.querySelector('#ed-persian-date')?.value?.trim() || null,
                    Indati2mPersian: container.querySelector('#ed-create-date')?.value?.trim() || null,
                    cdcn: container.querySelector('#ed-cdcn')?.value?.trim() || null,
                    cdcd: parseInt(container.querySelector('#ed-cdcd')?.value) || null,
                    scc: container.querySelector('#ed-scc')?.value?.trim() || null,
                    scln: container.querySelector('#ed-scln')?.value?.trim() || null,
                    crn: container.querySelector('#ed-crn')?.value?.trim() || null,
                    billId: container.querySelector('#ed-billid')?.value?.trim() || null,
                    bbc: container.querySelector('#ed-bbc')?.value?.trim() || null,
                    sbc: container.querySelector('#ed-sbc')?.value?.trim() || null,
                    ft: parseInt(container.querySelector('#ed-ft')?.value) || null,
                    
                    items: items
                };

                const resp = await window.App.Http.api('/api/moadian/headers/' + headerId, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });

                if (resp.success) {
                    _closeAllModals();
                    window.App.toast('✅ سند ویرایش شد', 'success');
                    setTimeout(() => renderHeaders(), 600);
                } else {
                    window.App.toast('خطا: ' + (resp.error || 'نامشخص'), 'error');
                    if (btn) { btn.disabled = false; btn.textContent = 'ذخیره تغییرات'; }
                }
            } else {
                // ═══ اصلاحی/برگشتی (POST) ═══
                const persianDate = container.querySelector('#ed-persian-date')?.value?.trim() || null;
                const setm = parseInt(container.querySelector('#ed-setm')?.value) || null;

                const resp = await window.App.Http.api('/api/moadian/headers/' + headerId + '/correct-with-items', {
                    method: 'POST',
                    body: JSON.stringify({
                        mode: mode,
                        indatimPersian: persianDate,
                        setm: setm,
                        items: items
                    })
                });

                if (resp.success) {
                    _closeAllModals();
                    const label = mode === 'return' ? 'برگشت' : 'اصلاحی';
                    window.App.toast(
                        `✅ سند ${label} با سریال ${resp.inno} ساخته شد (${H.fmt(resp.tbill)} ریال)`,
                        'success'
                    );
                    setTimeout(() => renderHeaders(), 600);
                } else {
                    window.App.toast('خطا: ' + (resp.error || 'نامشخص'), 'error');
                    if (btn) { btn.disabled = false; btn.textContent = 'ثبت ' + (mode === 'return' ? 'برگشت' : 'اصلاحی'); }
                }
            }
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'ثبت'; }
        }
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
        inquiryAllInInbox, 
        testRefInquiry,
        viewHeader,
        deleteHeader,
        openCorrectDialog, 
        doCorrect,
        openEditForm,
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