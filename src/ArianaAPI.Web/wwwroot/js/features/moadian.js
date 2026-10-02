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
        headers: [],
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
    async function renderPending() {
        const body = document.getElementById('moadianBody');
        body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const resp = await window.App.Http.api('/api/moadian/factors/pending');
            _state.pendingFactors = resp.items || [];
            drawPending();
        } catch (err) {
            body.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function drawPending() {
        const body = document.getElementById('moadianBody');
        const items = _state.pendingFactors;

        if (items.length === 0) {
            body.innerHTML = `
                <div class="card">
                    <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                        <div style="font-size:56px;opacity:0.4;">✅</div>
                        <p style="margin-top:12px;">همه‌ی فاکتورها ارسال شدن</p>
                    </div>
                </div>`;
            return;
        }

        const rows = items.map(f => `
            <tr>
                <td class="num text-center">${f.fldFacNo || ''}</td>
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
                            title="ایجاد سند مالیاتی">
                        ➕ ایجاد سند
                    </button>
                </td>
            </tr>`).join('');

        body.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>📋 فاکتورهای آماده ارسال (${H.fmt(items.length)})</span>
                    <div class="fac-actions">
                        <button class="btn btn-sm btn-ghost" onclick="App.Features.Moadian.refreshPending()">
                            🔄 بازخوانی
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="App.Features.Moadian.createAll()">
                            ⚡ ایجاد همه
                        </button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table class="moadian-table">
                        <thead>
                            <tr>
                                <th style="width:80px;">شماره</th>
                                <th style="width:100px;">تاریخ</th>
                                <th style="width:100px;">کد مشتری</th>
                                <th>نام مشتری</th>
                                <th class="text-left" style="width:140px;">مبلغ</th>
                                <th style="width:100px;">پرداخت</th>
                                <th style="width:120px;">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;

        if (window.App.enhanceTables) window.App.enhanceTables(body);
    }

    // ═══════════════════════════════════════════════════
    //  TAB ۲: اسناد ارسال‌شده
    // ═══════════════════════════════════════════════════
    async function renderHeaders() {
        const body = document.getElementById('moadianBody');
        body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const resp = await window.App.Http.api('/api/moadian/headers');
            _state.headers = resp.items || [];
            drawHeaders();
        } catch (err) {
            body.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function drawHeaders() {
        const body = document.getElementById('moadianBody');
        const items = _state.headers;

        if (items.length === 0) {
            body.innerHTML = `
                <div class="card">
                    <div class="empty" style="padding:60px;text-align:center;color:#94A3B8;">
                        <div style="font-size:56px;opacity:0.4;">📭</div>
                        <p style="margin-top:12px;">هنوز سند مالیاتی ساخته نشده</p>
                    </div>
                </div>`;
            return;
        }

        const rows = items.map(h => {
            const status = getStatusBadge(h.status);
            const sendable = h.status === 0 || h.status === 2;
            const inquiriable = h.status === 1;

            return `
            <tr class="moadian-row status-${h.status}">
                <td class="num text-center">${h.inno || ''}</td>
                <td class="num text-center">${H.esc(h.indatimPersian || '')}</td>
                <td class="num text-center">${h.factorId || ''}</td>
                <td class="num text-center">${h.customerCode || ''}</td>
                <td>${H.esc(h.customerName || '')}</td>
                <td class="num text-left">${H.fmt(h.tbill)}</td>
                <td class="text-center">${status}</td>
                <td class="num text-center" style="font-size:11px;direction:ltr;">
                    ${h.refNumber ? H.esc(h.refNumber) : '-'}
                </td>
                <td class="text-center">
                    ${sendable ? `
                        <button class="btn btn-sm btn-primary"
                                onclick="App.Features.Moadian.sendOne(${h.id})"
                                title="ارسال">📤</button>
                    ` : ''}
                    ${inquiriable ? `
                        <button class="btn btn-sm btn-ghost"
                                onclick="App.Features.Moadian.inquiry(${h.id})"
                                title="استعلام">🔍</button>
                    ` : ''}
                    <button class="btn btn-sm btn-ghost"
                            onclick="App.Features.Moadian.viewHeader(${h.id})"
                            title="مشاهده">👁️</button>
                    ${h.status !== 3 ? `
                        <button class="btn btn-sm btn-ghost"
                                onclick="App.Features.Moadian.deleteHeader(${h.id})"
                                title="حذف" style="color:var(--danger);">🗑️</button>
                    ` : ''}
                </td>
            </tr>`;
        }).join('');

        // Count by status
        const counts = {
            total: items.length,
            pending: items.filter(h => h.status === 0).length,
            sent: items.filter(h => h.status === 1).length,
            error: items.filter(h => h.status === 2).length,
            success: items.filter(h => h.status === 3).length
        };

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
                    <span>📤 اسناد مالیاتی (${H.fmt(items.length)})</span>
                    <div class="fac-actions">
                        <button class="btn btn-sm btn-ghost" onclick="App.Features.Moadian.refreshHeaders()">
                            🔄 بازخوانی
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="App.Features.Moadian.sendAll()">
                            📤 ارسال همه‌ی ارسال‌نشده‌ها
                        </button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table class="moadian-table">
                        <thead>
                            <tr>
                                <th style="width:70px;">سریال</th>
                                <th style="width:100px;">تاریخ</th>
                                <th style="width:70px;">فاکتور</th>
                                <th style="width:80px;">کد مشتری</th>
                                <th>مشتری</th>
                                <th class="text-left" style="width:130px;">مبلغ</th>
                                <th style="width:100px;">وضعیت</th>
                                <th style="width:130px;">Ref Number</th>
                                <th style="width:200px;">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;

        if (window.App.enhanceTables) window.App.enhanceTables(body);
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
        try {
            const resp = await window.App.Http.api('/api/moadian/headers/from-factor', {
                method: 'POST',
                body: JSON.stringify({ factorId })
            });
            window.App.toast('✅ سند مالیاتی با سریال ' + resp.inno + ' ساخته شد', 'success');
            refreshPending();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    async function createAll() {
        if (!confirm('همه‌ی فاکتورهای آماده رو تبدیل به سند مالیاتی کنم؟')) return;

        const items = _state.pendingFactors;
        let ok = 0, fail = 0;

        for (const f of items) {
            try {
                await window.App.Http.api('/api/moadian/headers/from-factor', {
                    method: 'POST',
                    body: JSON.stringify({ factorId: f.id })
                });
                ok++;
            } catch {
                fail++;
            }
        }

        window.App.toast(`✅ ${ok} سند ساخته شد${fail > 0 ? ' | ❌ ' + fail + ' خطا' : ''}`,
            fail > 0 ? 'error' : 'success');
        refreshPending();
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
            refreshHeaders();
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
            refreshHeaders();
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
            refreshHeaders();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════
    //  PUBLIC
    // ═══════════════════════════════════════════════════
    return {
        render,
        refreshPending: renderPending,
        refreshHeaders: renderHeaders,
        createFromFactor,
        createAll,
        sendOne,
        sendAll,
        inquiry,
        viewHeader,
        deleteHeader
    };
})();

window.App.renderMoadian = window.App.Features.Moadian.render;