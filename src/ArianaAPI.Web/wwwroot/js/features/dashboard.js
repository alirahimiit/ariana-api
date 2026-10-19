/* ═══════════════════════════════════════════════════
   Feature / Dashboard (داشبورد) - نسخه اصلاح شده نهایی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Dashboard = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _charts = [];
    let _iconCache = {};
    let _dueDateItems = [];

    async function loadIcon(name) {
        if (_iconCache[name]) return _iconCache[name];
        try {
            const res = await fetch('/assets/icons/' + name + '.svg');
            if (!res.ok) throw new Error();
            const svg = await res.text();
            _iconCache[name] = svg.replace('<svg ', '<svg class="ico ico-' + name + '" ');
            return _iconCache[name];
        } catch (e) {
            const fallback = {
                sanad: '📄', factor: '🧾', hesab: '🏦', tafzili: '👥',
                income: '📈', expense: '📉', wallet: '💰', trending: '📊',
                cheque: '💳', alert: '⚠️', article: '📦' 
            }[name] || '▪';
            _iconCache[name] = '<span class="ico-fallback">' + fallback + '</span>';
            return _iconCache[name];
        }
    }

    async function preloadIcons() {
        await Promise.all(['sanad', 'factor', 'hesab', 'tafzili', 'income', 'expense', 'wallet', 'trending', 'cheque', 'alert', 'article']
            .map(loadIcon));
    }

    const CHART_COLORS = [
        '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
        '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'
    ];

    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = '<div class="dash-loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>';

        destroyCharts();
        await preloadIcons();

        try {
            const stats = await window.App.Http.api('/api/dashboard/stats');
            c.innerHTML = buildHtml(stats);
            bindEvents();
            renderCharts(stats);
            loadDueDateSection();
        } catch (err) {
            c.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    function buildHtml(stats) {
        return `
            <div class="dash">
                ${buildGreeting()}
                ${buildKpiStrip(stats)}
                
                <!-- 👇 دسترسی سریع به زیر نوار بالا منتقل شد -->
                ${buildShortcuts()} 
                
                ${buildIncomeExpense(stats)}
                ${buildMiniCharts(stats)}
                
                <!-- بخش‌های سررسید -->
                ${buildDueDateKpiStrip()}
                ${buildDueDateChartsHtml()}
                ${buildDueDateSectionHtml()}
                
                ${buildConnection()}
            </div>`;
    }

    function buildGreeting() {
        const u = window.App.state.user || {};
        const name = u.fullName || u.username || 'کاربر';
        const hour = new Date().getHours();
        let greet = 'صبح بخیر';
        if (hour >= 12 && hour < 17) greet = 'وقت بخیر';
        else if (hour >= 17 || hour < 6) greet = 'شب بخیر';

        return `
            <div class="dash-greeting">
                <div>
                    <h2>${greet}، <strong>${H.esc(name)}</strong> 👋</h2>
                    <p class="muted">${H.esc(u.orgName || '')} — ${H.esc(u.fyName || '')}</p>
                </div>
                <div class="dash-date">${H.todayPersian ? H.todayPersian() : ''}</div>
            </div>`;
    }

    function buildKpiStrip(stats) {
        const items = [
            { key: 'sanad', label: 'اسناد', count: stats.totalSanads || 0, cls: 'primary' },
            { key: 'factor', label: 'فاکتورها', count: stats.totalFactors || 0, cls: 'success' },
            { key: 'hesab', label: 'حساب‌ها', count: stats.totalHesabs || 0, cls: 'warning' },
            { key: 'tafzili', label: 'تفضیلی‌ها', count: stats.totalTafzilis || 0, cls: 'info' }
        ];

        return `
            <div class="dash-strip">
                ${items.map(it => `
                    <div class="dash-strip-item">
                        <span class="dash-strip-icon dash-strip-${it.cls}">${_iconCache[it.key]}</span>
                        <span class="dash-strip-value">${H.fmt(it.count)}</span>
                        <span class="dash-strip-label">${it.label}</span>
                    </div>`).join('<span class="dash-strip-sep"></span>')}
            </div>`;
    }

    function buildIncomeExpense(stats) {
        const income = stats.totalIncome || 0;
        const expense = stats.totalExpense || 0;
        const net = income - expense;
        const netCls = net >= 0 ? 'positive' : 'negative';

        return `
            <div class="dash-ie">
                <div class="dash-ie-box dash-collapsible">
                    <button type="button" class="dash-collapse-btn" onclick="App.Features.Dashboard.toggleCard(this)">
                        <span class="dash-collapse-icon">▼</span>
                    </button>
                    <div class="dash-ie-icon-wrap dash-ie-icon-income">${_iconCache.income}</div>
                    <div class="dash-ie-summary">
                        <div class="dash-ie-label">درآمد</div>
                        <div class="dash-ie-value-small">${H.fmt(income)} <small>ریال</small></div>
                    </div>
                    <div class="dash-collapse-body">
                        <div class="dash-ie-donut"><canvas id="chartIncome"></canvas></div>
                        <div class="dash-ie-meta">
                            <div class="dash-ie-value">${H.fmt(income)} <small>ریال</small></div>
                        </div>
                    </div>
                </div>
                <div class="dash-ie-box dash-ie-box-net">
                    <div class="dash-ie-net-icon">${_iconCache.wallet}</div>
                    <div class="dash-ie-net-label">خالص دوره</div>
                    <div class="dash-ie-net-value dash-${netCls}">${H.fmt(Math.abs(net))}</div>
                    <div class="dash-ie-net-badge dash-ie-net-${netCls}">
                        ${net >= 0 ? 'سود' : 'زیان'}
                    </div>
                </div>
                <div class="dash-ie-box dash-collapsible">
                    <button type="button" class="dash-collapse-btn" onclick="App.Features.Dashboard.toggleCard(this)">
                        <span class="dash-collapse-icon">▼</span>
                    </button>
                    <div class="dash-ie-icon-wrap dash-ie-icon-expense">${_iconCache.expense}</div>
                    <div class="dash-ie-summary">
                        <div class="dash-ie-label">هزینه</div>
                        <div class="dash-ie-value-small">${H.fmt(expense)} <small>ریال</small></div>
                    </div>
                    <div class="dash-collapse-body">
                        <div class="dash-ie-donut"><canvas id="chartExpense"></canvas></div>
                        <div class="dash-ie-meta">
                            <div class="dash-ie-value">${H.fmt(expense)} <small>ریال</small></div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function buildMiniCharts(stats) {
        const charts = [
            { id: 'chartFactors', title: 'فاکتورها بر اساس نوع', icon: 'factor' },
            { id: 'chartSanads', title: 'اسناد بر اساس وضعیت', icon: 'sanad' },
            { id: 'chartGroups', title: 'گردش حساب‌ها بر اساس گروه', icon: 'hesab' }
        ];

        return `
            <div class="dash-charts">
                ${charts.map(c => `
                    <div class="dash-chart dash-collapsible">
                        <button type="button" class="dash-collapse-btn" onclick="App.Features.Dashboard.toggleCard(this)">
                            <span class="dash-collapse-icon">▼</span>
                        </button>
                        <div class="dash-chart-head">
                            <span class="dash-chart-ico">${_iconCache[c.icon]}</span>
                            <span>${c.title}</span>
                        </div>
                        <div class="dash-collapse-body">
                            <div class="dash-chart-body"><canvas id="${c.id}"></canvas></div>
                        </div>
                    </div>`).join('')}
            </div>`;
    }

    function toggleCard(btn) {
        const card = btn.closest('.dash-collapsible');
        if (!card) return;
        const isOpen = card.classList.toggle('open');
        const icon = btn.querySelector('.dash-collapse-icon');
        if (icon) icon.textContent = isOpen ? '▲' : '▼';
    }

    function buildShortcuts() {
        const items = [
            { page: 'sanad', label: 'اسناد', icon: 'sanad', perm: 'Sanad' },
            { page: 'factor', label: 'فاکتورها', icon: 'factor', perm: 'Factor' },
            { page: 'article', label: 'کالاها', icon: 'article', perm: 'Article' },
            { page: 'tafzili', label: 'تفضیلی‌ها', icon: 'tafzili', perm: 'Tafzili' },
            { page: 'hesab', label: 'حساب‌ها', icon: 'hesab', perm: 'Hesab' },
            { page: 'profitloss', label: 'سود و زیان', icon: 'income', perm: 'ProfitLoss' }
        ];

        const visible = items.filter(it => {
            if (window.App.Permissions && window.App.Permissions.hasMenu) {
                return window.App.Permissions.hasMenu(it.perm);
            }
            return true;
        });

        if (visible.length === 0) return '';

        return `
            <div class="dash-section">
                <div class="dash-section-title">⚡ دسترسی سریع</div>
                <div class="dash-shortcuts">
                    ${visible.map(it => `
                        <div class="dash-shortcut" data-goto="${it.page}">
                            <div class="dash-shortcut-icon">${_iconCache[it.icon] || '▪'}</div>
                            <div class="dash-shortcut-label">${it.label}</div>
                        </div>`).join('')}
                </div>
            </div>`;
    }

    function buildConnection() {
        const u = window.App.state.user || {};
        const orgId = u.orgId || 0;
        const fyId = u.fyId || 0;
        const dbName = u.dbName || ('Acounting_' + orgId + '_' + fyId);

        return `
            <div class="dash-section dash-section-compact">
                <div class="dash-section-title">🔗 اطلاعات اتصال</div>
                <div class="dash-conn-row">
                    <div class="dash-conn-item">
                        <span class="dash-conn-label">سازمان:</span>
                        <span class="dash-conn-value">${H.esc(u.orgName || '-')} (${orgId})</span>
                    </div>
                    <div class="dash-conn-item">
                        <span class="dash-conn-label">دوره:</span>
                        <span class="dash-conn-value">${H.esc(u.fyName || '-')} (${fyId})</span>
                    </div>
                    <div class="dash-conn-item">
                        <span class="dash-conn-label">دیتابیس:</span>
                        <span class="dash-conn-value db-code">${H.esc(dbName)}</span>
                    </div>
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  بخش‌های جدید سررسید
    // ═══════════════════════════════════════════

    function buildDueDateKpiStrip() {
        return `
            <div class="dash-strip due-date-kpi-strip">
                <div class="dash-strip-item" title="چک‌های دریافتی با تاریخ امروز">
                    <span class="dash-strip-icon dash-strip-primary">${_iconCache.cheque}</span>
                    <span class="dash-strip-value" id="kpiRecvToday">-</span>
                    <span class="dash-strip-label">دریافتی امروز</span>
                </div>
                <div class="dash-strip-sep"></div>
                <div class="dash-strip-item" title="چک‌های دریافتی تا تاریخ امروز">
                    <span class="dash-strip-icon dash-strip-info">${_iconCache.cheque}</span>
                    <span class="dash-strip-value" id="kpiRecvToToday">-</span>
                    <span class="dash-strip-label">دریافتی تا امروز</span>
                </div>
                <div class="dash-strip-sep"></div>
                <div class="dash-strip-item" title="چک‌های دریافتی سررسید ۳ روز آینده">
                    <span class="dash-strip-icon dash-strip-warning">${_iconCache.alert}</span>
                    <span class="dash-strip-value" id="kpiRecvFollow">-</span>
                    <span class="dash-strip-label">دریافتی جهت پیگیری</span>
                </div>
                <div class="dash-strip-sep"></div>
                <div class="dash-strip-item" title="اسناد با سررسید امروز">
                    <span class="dash-strip-icon dash-strip-success">${_iconCache.sanad}</span>
                    <span class="dash-strip-value" id="kpiSanadToday">-</span>
                    <span class="dash-strip-label">دیون پرداختی امروز</span>
                </div>
                <div class="dash-strip-sep"></div>
                <div class="dash-strip-item" title="اسناد با سررسید تا امروز">
                    <span class="dash-strip-icon dash-strip-info">${_iconCache.sanad}</span>
                    <span class="dash-strip-value" id="kpiSanadToToday">-</span>
                    <span class="dash-strip-label">دیون پرداختی تا امروز</span>
                </div>
                <div class="dash-strip-sep"></div>
                <div class="dash-strip-item" title="اسناد سررسید ۳ روز آینده">
                    <span class="dash-strip-icon dash-strip-warning">${_iconCache.alert}</span>
                    <span class="dash-strip-value" id="kpiSanadReview">-</span>
                    <span class="dash-strip-label">دیون جهت رسیدگی</span>
                </div>
            </div>`;
    }

    function buildDueDateChartsHtml() {
        return `
            <div class="dash-charts" style="grid-template-columns: 1fr 1fr;">
                <div class="dash-chart">
                    <div class="dash-chart-head">
                        <span class="dash-chart-ico">${_iconCache.trending}</span>
                        <span>پراکندگی سررسیدها (۱۲ ماه آینده)</span>
                    </div>
                    <div class="dash-chart-body"><canvas id="chartDueDateBar"></canvas></div>
                </div>
                <div class="dash-chart">
                    <div class="dash-chart-head">
                        <span class="dash-chart-ico">${_iconCache.cheque}</span>
                        <span>وضعیت چک‌ها (سررسید)</span>
                    </div>
                    <div class="dash-chart-body"><canvas id="chartDueDatePie"></canvas></div>
                </div>
            </div>`;
    }

    function buildDueDateSectionHtml() {
        return `
            <div class="dash-section due-date-section" id="dueDateMainSection">
                <div class="dash-section-title" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;" onclick="this.parentElement.classList.toggle('open')">
                    <span>📅 گزارش لیست سررسیدها (<span id="dueDateMainCount">...</span> مورد)</span>
                    <span style="font-size:12px; color:#64748b; transition:transform 0.2s;" class="master-icon">▼</span>
                </div>
                <div id="dueDateAccordion" style="display:none; margin-top:12px;">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>`;
    }

    async function loadDueDateSection() {
        try {
            // دریافت تمامی سررسیدها بدون محدودیت تاریخ تا همه چک‌ها بیایند
            const res = await window.App.Http.api('/api/cheque-report/due-date/list', {
                method: 'POST',
                body: JSON.stringify({ includePayCheques: true, includeReceiveCheques: true, includeSanads: true }),
                silent: true
            });

            _dueDateItems = res || [];
            renderDueDateAccordion(_dueDateItems);
            updateDueDateKpis(_dueDateItems);
            renderDueDateCharts();
        } catch (err) {
            const el = document.getElementById('dueDateAccordion');
            if (el) el.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function updateDueDateKpis(items) {
        let recvToday = 0, recvToToday = 0, recvFollow = 0;
        let sanadToday = 0, sanadToToday = 0, sanadReview = 0;
        const today = H.todayPersian ? H.todayPersian() : '';

        items.forEach(it => {
            if (it.itemType === 1) {
                if (it.dueDate === today) recvToday++;
                if (it.dueDate <= today) recvToToday++;
                if (it.daysRemaining <= 3 && it.daysRemaining >= 0) recvFollow++;
            } else if (it.itemType === 2) {
                if (it.dueDate === today) sanadToday++;
                if (it.dueDate <= today) sanadToToday++;
                if (it.daysRemaining <= 3 && it.daysRemaining >= 0) sanadReview++;
            }
        });

        const elRecvToday = document.getElementById('kpiRecvToday');
        if (elRecvToday) {
            elRecvToday.textContent = H.fmt(recvToday);
            document.getElementById('kpiRecvToToday').textContent = H.fmt(recvToToday);
            document.getElementById('kpiRecvFollow').textContent = H.fmt(recvFollow);
            document.getElementById('kpiSanadToday').textContent = H.fmt(sanadToday);
            document.getElementById('kpiSanadToToday').textContent = H.fmt(sanadToToday);
            document.getElementById('kpiSanadReview').textContent = H.fmt(sanadReview);
        }
    }

    function renderDueDateAccordion(items) {
        const container = document.getElementById('dueDateAccordion');
        if (!container) return;

        // 👇 نمایش تعداد کل در هدر بسته
        const countEl = document.getElementById('dueDateMainCount');
        if (countEl) countEl.textContent = H.fmt(items.length);

        if (items.length === 0) {
            container.innerHTML = '<div class="empty-mini" style="padding:20px;text-align:center;">📭 سررسیدی در این بازه یافت نشد</div>';
            return;
        }

        const groups = {};
        items.forEach(it => {
            const month = it.dueDate.substring(0, 7);
            if (!groups[month]) groups[month] = [];
            groups[month].push(it);
        });

        let html = '';
        Object.keys(groups).sort().forEach(month => {
            const monthItems = groups[month];
            const totalAmount = monthItems.reduce((sum, it) => sum + it.amount, 0);

            html += `
                <div class="acc-group">
                    <div class="acc-header" onclick="this.parentElement.classList.toggle('open')">
                        <span class="acc-title">📅 ماه ${month} (${H.fmt(monthItems.length)} مورد)</span>
                        <span class="acc-sum">${H.fmt(totalAmount)} ریال</span>
                        <span class="acc-icon">▼</span>
                    </div>
                    <div class="acc-body">
                        <table class="due-table">
                            <thead>
                                <tr>
                                    <th>نوع</th>
                                    <th>تاریخ سررسید</th>
                                    <th>سریال/شماره</th>
                                    <th>طرف حساب</th>
                                    <th>بانک</th>
                                    <th>مبلغ (ریال)</th>
                                    <th>روز مانده</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthItems.map(it => buildDueRow(it)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    }

    function buildDueRow(it) {
        const days = (it.daysRemaining !== null && it.daysRemaining !== undefined) ? it.daysRemaining : 0;
        const remainColor = days < 0 ? '#EF4444' : (days <= 3 ? '#F59E0B' : '#10B981');

        let bg = '#FEF3C7', color = '#92400E';
        if (it.itemType === 1) { bg = '#DBEAFE'; color = '#1E40AF'; }
        if (it.itemType === 2) { bg = '#DCFCE7'; color = '#166534'; }

        const rowClick = it.itemType !== 2
            ? `onclick="App.Features.Dashboard.openKardexOverlay(${it.itemType}, ${it.id})" style="cursor:pointer;"`
            : '';

        return `
            <tr ${rowClick} class="hover-row">
                <td style="text-align:right;"><span style="padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; background:${bg}; color:${color};">${it.typeLabel}</span></td>
                <td style="text-align:center;">${it.dueDate}</td>
                <td style="text-align:center;">${H.esc(it.serial || '-')}</td>
                <td style="text-align:right;">${H.esc(it.partyName || '-')}</td>
                <td style="text-align:right;">${H.esc(it.bankName || '-')}</td>
                <td style="text-align:left;"><strong>${H.fmt(it.amount)}</strong></td>
                <td style="text-align:center; color:${remainColor}; font-weight:700;">${days} روز</td>
                <td style="text-align:center;">
                    <!-- 👇 استفاده از event.stopPropagation برای جلوگیری از باز شدن کاردکس هنگام کلیک روی دکمه -->
                    <button onclick="event.stopPropagation(); App.Features.Dashboard.handleConfirm(${it.itemType}, ${it.id})" style="padding:4px 12px; font-size:11px; background:#10B981; color:#fff; border:none; border-radius:6px; cursor:pointer;">✅ تأیید</button>
                </td>
            </tr>`;
    }
    async function handleConfirm(itemType, id) {
        const item = _dueDateItems.find(x => x.id === id && x.itemType === itemType);
        if (!item) return;

        if (itemType === 2) {
            // سند حسابداری
            if (!await App.confirm(`تأیید سررسید سند شماره ${item.serial}؟`)) return;
            try {
                await App.Http.api('/api/cheque-report/confirm-sanad-due', {
                    method: 'POST', body: JSON.stringify({ sanadId: item.id }), successMsg: 'سند تأیید شد'
                });
                loadDueDateSection();
            } catch (e) { }
        } else {
            // چک‌ها (پرداختی یا دریافتی)
            openChequeActionModal(item);
        }
    }

    // 👇👇 اینجا آدرس‌های متد چک‌ها را بررسی کنید 👇👇
    async function doChequeAction(type, id, action) {
        document.getElementById('chequeActionOverlay')?.remove();
        const isOk = action === 'ok';
        const ok = await App.confirm(`آیا از ${isOk ? 'اعلام وصول' : 'اعلام برگشت'} این چک اطمینان دارید؟`, { danger: !isOk });
        if (!ok) return;

        try {
            const baseUrl = type === 0 ? '/api/ChequePay' : '/api/ChequeReceive';

            // اگر عملیات برگشت بود، نیاز به کدهای حساب ندارد
            if (action === 'return') {
                await App.Http.api(`${baseUrl}/${id}/return`, { method: 'POST', successMsg: 'چک برگشت خورد' });
                loadDueDateSection();
                return;
            }

            // ۱. دریافت اطلاعات چک
            const cheque = await App.Http.api(`${baseUrl}/${id}`);
            if (!cheque) return;

            // 👇👇 این بخش بسیار مهم است (تبدیل اعداد فارسی به انگلیسی دقیقاً مثل treasury-cheque.js)
            let okDate = H.todayPersian();
            // تبدیل اعداد فارسی به انگلیسی
            okDate = okDate.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

            const parts = okDate.split('/');
            if (parts.length === 3) {
                // اطمینان از دو رقمی بودن ماه و روز
                okDate = `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
            }

            // ۳. پیدا کردن کدهای حساب بانک (Code_Col_OK)
            let cOk = 0, mOk = 0, tOk = 0;
            if (type === 0) {
                const bankAccList = await App.Http.api('/api/bank/acc/list', { method: 'POST', body: JSON.stringify({ page: 1, pageSize: 1000 }) });
                const acc = bankAccList.items.find(x => x.id === cheque.bankAccId);
                if (acc) { cOk = acc.codeCol; mOk = acc.codeMoein; tOk = acc.codeTafzil; }
            } else {
                cOk = cheque.codeCol; mOk = cheque.codeMoein; tOk = cheque.codeTafzil;
            }

            // ۴. پیدا کردن کدهای حساب اسناد (Code_Col_Pay_OK) از حساب‌های پیش‌فرض
            let qCol = 0, qMoein = 0, qTafzil = 0;
            const constHesabList = await App.Http.api('/api/const-hesab/list');
            const payableType = type === 0 ? 14 : 13; // 14=اسناد پرداختنی، 13=اسناد دریافتنی
            const ch = constHesabList.find(x => x.type === payableType && x.isSet);
            if (ch) { qCol = ch.codeCol; qMoein = ch.codeMoein; qTafzil = ch.codeTafzil; }

            // ۵. ارسال اطلاعات کامل
            const payload = {
                id: id,
                okDate: okDate, // تاریخ با اعداد انگلیسی
                codeColOk: cOk, codeMoeinOk: mOk, codeTafzilOk: tOk,
                codeColPayOk: qCol, codeMoeinPayOk: qMoein, codeTafzilPayOk: qTafzil,
                saveWithSanad: true,
                parentSanadOkId: null,
                noSanad: null
            };

            await App.Http.api(`${baseUrl}/${id}/ok`, {
                method: 'POST',
                body: JSON.stringify(payload),
                successMsg: 'چک با موفقیت وصول شد'
            });

            loadDueDateSection();
        } catch (e) {
            console.error("خطا در عملیات چک:", e);
            App.toast(e.message || 'خطا در ارتباط با سرور', 'error');
        }
    }
    function openChequeActionModal(item) {
        document.getElementById('chequeActionOverlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'chequeActionOverlay';
        // 👇 تغییر z-index به بالاترین مقدار و ساخت استایل مستقل
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index:99999; padding:20px;';

        overlay.innerHTML = `
            <div style="background:#fff; border-radius:12px; width:100%; max-width:400px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="padding:14px 20px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; font-weight:700;">
                    <span>عملیات چک</span>
                    <button onclick="document.getElementById('chequeActionOverlay').remove()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
                </div>
                <div style="padding:20px; text-align:center;">
                    <p style="margin-bottom:20px; font-weight:bold;">${H.esc(item.typeLabel)} - سریال: ${H.esc(item.serial)}</p>
                    <button onclick="App.Features.Dashboard.doChequeAction(${item.itemType}, ${item.id}, 'ok')" style="width:100%; margin-bottom:10px; padding:10px; background:#10B981; color:#fff; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-weight:600;">✅ اعلام وصول</button>
                    <button onclick="App.Features.Dashboard.doChequeAction(${item.itemType}, ${item.id}, 'return')" style="width:100%; padding:10px; background:#EF4444; color:#fff; border:none; border-radius:8px; cursor:pointer; font-family:inherit; font-weight:600;">↩️ اعلام برگشت</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
 
    function bindEvents() {
        document.querySelectorAll('.dash-shortcut').forEach(el => {
            el.addEventListener('click', () => {
                const page = el.getAttribute('data-goto');
                if (window.App.navigate) {
                    window.App.navigate(page);
                } else {
                    console.error('App.navigate تعریف نشده است.');
                }
            });
        });
    }

    function renderCharts(stats) {
        if (!window.Chart) return;

        const income = stats.totalIncome || 0;
        const expense = stats.totalExpense || 0;
        const total = income + expense;

        renderDonut('chartIncome', income, total - income, '#10B981', '#D1FAE5');
        renderDonut('chartExpense', expense, total - expense, '#EF4444', '#FEE2E2');
        renderPieChart('chartFactors', stats.factorsByKind || [], false);
        renderPieChart('chartSanads', stats.sanadsByVazeit || [], false);
        renderPieChart('chartGroups', stats.accountsByGroupType || [], true);
    }

    function renderDueDateCharts() {
        if (!window.Chart) return;
        if (Chart.getChart('chartDueDateBar')) Chart.getChart('chartDueDateBar').destroy();
        if (Chart.getChart('chartDueDatePie')) Chart.getChart('chartDueDatePie').destroy();

        const labels = [];
        const values = [];
        const monthMap = {};
        _dueDateItems.forEach(it => {
            const m = it.dueDate.substring(0, 7);
            monthMap[m] = (monthMap[m] || 0) + 1;
        });

        const sortedMonths = Object.keys(monthMap).sort();
        sortedMonths.forEach(m => {
            labels.push(m);
            values.push(monthMap[m]);
        });

        const canvasBar = document.getElementById('chartDueDateBar');
        if (canvasBar) {
            new Chart(canvasBar, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ label: 'تعداد', data: values, backgroundColor: '#4F46E5', borderRadius: 4 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });
        }

        const recvCount = _dueDateItems.filter(x => x.itemType === 1).length;
        const payCount = _dueDateItems.filter(x => x.itemType === 0).length;

        const canvasPie = document.getElementById('chartDueDatePie');
        if (canvasPie) {
            new Chart(canvasPie, {
                type: 'doughnut',
                data: {
                    labels: ['چک پرداختی', 'چک دریافتی'],
                    datasets: [{ data: [payCount, recvCount], backgroundColor: ['#F59E0B', '#3B82F6'] }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }

    function renderDonut(canvasId, value, other, color, lightColor) {
        const el = document.getElementById(canvasId);
        if (!el) return;

        const total = value + other;
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;

        const chart = new Chart(el, {
            type: 'doughnut',
            data: { datasets: [{ data: [value, other || 1], backgroundColor: [color, lightColor], borderWidth: 0, cutout: '78%' }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
            plugins: [{
                id: 'centerText_' + canvasId,
                afterDraw: (chart) => {
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return;
                    const cx = (chartArea.left + chartArea.right) / 2;
                    const cy = (chartArea.top + chartArea.bottom) / 2;
                    ctx.save();
                    ctx.font = 'bold 20px Vazirmatn, Tahoma, sans-serif';
                    ctx.fillStyle = color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(percent + '%', cx, cy);
                    ctx.restore();
                }
            }]
        });
        _charts.push(chart);
    }

    function renderPieChart(canvasId, items, isMoney) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (!items || items.length === 0) {
            canvas.parentElement.innerHTML = '<div class="empty-mini">📭 داده‌ای نیست</div>';
            return;
        }

        const labels = items.map(x => x.label);
        const values = items.map(x => Number(x.value) || 0);
        const colors = items.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]);
        const fmtVal = v => isMoney ? H.fmt(Math.round(v)) : H.fmt(v);

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom', rtl: true, textDirection: 'rtl',
                        labels: {
                            font: { family: 'Vazirmatn, Tahoma, sans-serif', size: 10 }, padding: 6, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle',
                            generateLabels: (chart) => {
                                const data = chart.data;
                                if (!data.labels || !data.labels.length) return [];
                                return data.labels.map((label, i) => {
                                    const val = Number(data.datasets[0].data[i]) || 0;
                                    return { text: `${label} — ${fmtVal(val)}`, fillStyle: data.datasets[0].backgroundColor[i], strokeStyle: data.datasets[0].backgroundColor[i], lineWidth: 0, hidden: false, index: i };
                                });
                            }
                        }
                    },
                    tooltip: { rtl: true, textDirection: 'rtl', titleFont: { family: 'Vazirmatn, Tahoma, sans-serif' }, bodyFont: { family: 'Vazirmatn, Tahoma, sans-serif' }, callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + fmtVal(Number(ctx.parsed) || 0) } }
                }
            }
        });
        _charts.push(chart);
    }

    function destroyCharts() {
        _charts.forEach(ch => { try { ch.destroy(); } catch (e) { } });
        _charts = [];
    }

    function toggleAllAccordions(btn) {
        const groups = document.querySelectorAll('.acc-group');
        const allOpen = Array.from(groups).every(g => g.classList.contains('open'));

        groups.forEach(g => {
            if (allOpen) {
                g.classList.remove('open');
            } else {
                g.classList.add('open');
            }
        });
        btn.querySelector('span').textContent = allOpen ? '▼' : '▲';
    }

    // تابع کمکی برای تبدیل تاریخ شمسی به عدد جهت محاسبه دقیق روز
    function parsePersianDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function updateDueDateKpis(items) {
        let recvToday = 0, recvToToday = 0, recvFollow = 0;
        let sanadToday = 0, sanadToToday = 0, sanadReview = 0;

        // گرفتن تاریخ امروز به شمسی
        const todayStr = H.todayPersian ? H.todayPersian() : '';
        const todayDate = parsePersianDate(todayStr);

        items.forEach(it => {
            const itemDate = parsePersianDate(it.dueDate);
            if (!itemDate || !todayDate) return;

            // محاسبه اختلاف روزها
            const diffTime = itemDate - todayDate;
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            it.daysRemaining = days; // ذخیره برای استفاده در جدول

            if (it.itemType === 1) { // دریافتی
                if (days === 0) recvToday++;
                if (days <= 0) recvToToday++;
                if (days <= 3 && days >= 0) recvFollow++;
            } else if (it.itemType === 2) { // سند
                if (days === 0) sanadToday++;
                if (days <= 0) sanadToToday++;
                if (days <= 3 && days >= 0) sanadReview++;
            }
        });

        const el = document.getElementById('kpiRecvToday');
        if (el) {
            el.textContent = H.fmt(recvToday);
            document.getElementById('kpiRecvToToday').textContent = H.fmt(recvToToday);
            document.getElementById('kpiRecvFollow').textContent = H.fmt(recvFollow);
            document.getElementById('kpiSanadToday').textContent = H.fmt(sanadToday);
            document.getElementById('kpiSanadToToday').textContent = H.fmt(sanadToToday);
            document.getElementById('kpiSanadReview').textContent = H.fmt(sanadReview);
        }
    }
    function openKardexOverlay(chequeType, chequeId) {
        // تزریق استایل‌های کاردکس اگر وجود نداشته باشد
        if (!document.getElementById('kdxStyles')) {
            const s = document.createElement('style');
            s.id = 'kdxStyles';
            s.textContent = `
                .kdx-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:11000;padding:20px}
                .kdx-box{background:#fff;border-radius:12px;width:100%;max-width:920px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
                .kdx-header{padding:14px 20px;border-bottom:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:15px;color:#1E293B}
                .kdx-close{background:transparent;border:none;font-size:20px;cursor:pointer;color:#64748B;padding:0 6px}
                .kdx-close:hover{color:#EF4444}
                .kdx-body{padding:16px 20px;overflow-y:auto;flex:1}
                .kdx-info{background:#F8FAFC;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;font-size:13px}
                .kdx-info-item{display:flex;flex-direction:column;gap:2px}
                .kdx-info-label{color:#64748B;font-size:11px}
                .kdx-info-value{color:#1E293B;font-weight:600}
                .kdx-timeline{position:relative;padding-right:24px}
                .kdx-timeline::before{content:'';position:absolute;right:10px;top:8px;bottom:8px;width:2px;background:#E2E8F0}
                .kdx-event{position:relative;padding:10px 0 20px 0}
                .kdx-event::before{content:'';position:absolute;right:-19px;top:14px;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #94A3B8}
                .kdx-event-create::before{border-color:#3B82F6}
                .kdx-event-ok::before{border-color:#22C55E}
                .kdx-event-return::before{border-color:#EF4444}
                .kdx-event-expend::before{border-color:#8B5CF6}
                .kdx-event-head{display:flex;align-items:center;gap:8px;font-weight:700;color:#1E293B;margin-bottom:4px}
                .kdx-event-meta{display:flex;gap:14px;font-size:12px;color:#64748B;margin-bottom:8px;flex-wrap:wrap}
                .kdx-event-table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden}
                .kdx-event-table th{background:#F1F5F9;padding:6px 8px;text-align:right;font-weight:600;font-size:11px;color:#475569}
                .kdx-event-table td{padding:6px 8px;border-top:1px solid #F1F5F9}
                .kdx-event-table tr:hover td{background:#F8FAFC}
            `;
            document.head.appendChild(s);
        }

        document.getElementById('kdxOverlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'kdxOverlay';
        overlay.className = 'kdx-overlay';
        overlay.innerHTML = `
            <div class="kdx-box" role="dialog" aria-modal="true">
                <div class="kdx-header">
                    <span>📋 کاردکس چک</span>
                    <button class="kdx-close" id="kdxCloseBtn" aria-label="بستن">✕</button>
                </div>
                <div class="kdx-body" id="kdxBody">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        `;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) document.getElementById('kdxOverlay')?.remove(); });
        document.body.appendChild(overlay);
        document.getElementById('kdxCloseBtn').addEventListener('click', () => document.getElementById('kdxOverlay')?.remove());

        // دریافت اطلاعات از بک‌اند (کد دقیق جلسه ۵۰)
        const fetchKardex = async () => {
            const body = document.getElementById('kdxBody');
            try {
                const data = await window.App.Http.api('/api/cheque-report/kardex', {
                    method: 'POST',
                    body: JSON.stringify({ chequeType, chequeId })
                });
                body.innerHTML = buildKardexHtml(data);
            } catch (err) {
                body.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
            }
        };

        fetchKardex();
    }

    // تابع ساخت HTML کاردکس (کپی شده از جلسه ۵۰ برای استقلال کامل)
    function buildKardexHtml(data) {
        if (!data) return '<p>داده‌ای یافت نشد</p>';

        const statusBadge = data.currentStatus === 1
            ? '<span class="badge-type" style="background:#DCFCE7;color:#166534;">✅ وصول‌شده</span>'
            : data.currentStatus === 2
                ? '<span class="badge-type" style="background:#FEE2E2;color:#991B1B;">↩️ برگشتی</span>'
                : '<span class="badge-type" style="background:#FEF3C7;color:#92400E;">⏳ در جریان</span>';

        const infoHtml = `
            <div class="kdx-info">
                <div class="kdx-info-item"><span class="kdx-info-label">وضعیت فعلی</span><span class="kdx-info-value">${statusBadge}</span></div>
                <div class="kdx-info-item"><span class="kdx-info-label">سریال</span><span class="kdx-info-value">${H.esc(data.checkSeries || '-')}</span></div>
                <div class="kdx-info-item"><span class="kdx-info-label">مبلغ</span><span class="kdx-info-value">${H.fmt(data.checkMab)} ریال</span></div>
                <div class="kdx-info-item"><span class="kdx-info-label">تاریخ چک</span><span class="kdx-info-value">${H.esc(data.checkDate || '-')}</span></div>
                <div class="kdx-info-item"><span class="kdx-info-label">در وجه</span><span class="kdx-info-value">${H.esc(data.checkPerson || '-')}</span></div>
                <div class="kdx-info-item" style="grid-column:1/-1;"><span class="kdx-info-label">طرف حساب</span><span class="kdx-info-value">${H.esc(data.hesabName || '-')}</span></div>
            </div>`;

        if (!data.events || data.events.length === 0) {
            return infoHtml + '<div class="empty" style="padding:40px;text-align:center;color:#94A3B8;">رویدادی ثبت نشده</div>';
        }

        let eventsHtml = '<div class="kdx-timeline">';
        for (const ev of data.events) {
            const rowsHtml = (ev.rows || []).map(r => `
                <tr>
                    <td class="num text-center">${r.rowNum}</td>
                    <td>${H.esc(r.hesabName || '-')}</td>
                    <td>${H.esc(r.sharh || '-')}</td>
                    <td class="num">${r.mabBed > 0 ? H.fmt(r.mabBed) : '—'}</td>
                    <td class="num">${r.mabBes > 0 ? H.fmt(r.mabBes) : '—'}</td>
                </tr>`).join('');

            eventsHtml += `
                <div class="kdx-event kdx-event-${ev.eventType}">
                    <div class="kdx-event-head"><span>${ev.eventIcon} ${H.esc(ev.eventLabel)}</span></div>
                    <div class="kdx-event-meta">
                        <span>📅 ${H.esc(ev.eventDate || '-')}</span>
                        <span>📄 سند ${H.fmt(ev.noSanad)}</span>
                    </div>
                    ${ev.eventSharh ? `<div style="font-size:12px;color:#475569;margin-bottom:8px;">${H.esc(ev.eventSharh)}</div>` : ''}
                    <table class="kdx-event-table">
                        <thead><tr><th style="width:50px;">ردیف</th><th>حساب</th><th>شرح</th><th style="width:110px;">بدهکار</th><th style="width:110px;">بستانکار</th></tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>`;
        }
        eventsHtml += '</div>';
        return infoHtml + eventsHtml;
    }
    return { render, destroyCharts, toggleCard, handleConfirm, doChequeAction, toggleAllAccordions, openKardexOverlay };

})();

window.App.renderDashboard = window.App.Features.Dashboard.render;