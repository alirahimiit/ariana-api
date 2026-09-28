/* ═══════════════════════════════════════════════════
   Feature / Dashboard (داشبورد)
   مسئولیت: آمار کلی + ۳ نمودار دایره‌ای + اطلاعات اتصال
   ═══════════════════════════════════════════════════
   وابستگی‌ها:
     - window.App.Helpers  (fmt, esc)
     - window.App.Http     (api)
     - window.App.state
     - Chart.js (global)
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   Feature / Dashboard — نسخه‌ی مدرن و فشرده
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Dashboard = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _charts = [];
    let _iconCache = {};

    // ═══════════════════════════════════════════
    //  ICON LOADER
    // ═══════════════════════════════════════════
    async function loadIcon(name) {
        if (_iconCache[name]) return _iconCache[name];
        try {
            const res = await fetch('/assets/icons/' + name + '.svg');
            if (!res.ok) throw new Error();
            const svg = await res.text();
            _iconCache[name] = svg.replace('<svg ', '<svg class="ico ico-' + name + '" ');
            return _iconCache[name];
        } catch (e) {
            // fallback به ایموجی
            const fallback = {
                sanad: '📄', factor: '🧾', hesab: '🏦', tafzili: '👥',
                income: '📈', expense: '📉', wallet: '💰', trending: '📊'
            }[name] || '▪';
            _iconCache[name] = '<span class="ico-fallback">' + fallback + '</span>';
            return _iconCache[name];
        }
    }

    async function preloadIcons() {
        await Promise.all(['sanad', 'factor', 'hesab', 'tafzili', 'income', 'expense', 'wallet', 'trending']
            .map(loadIcon));
    }

    // ═══════════════════════════════════════════
    //  COLORS
    // ═══════════════════════════════════════════
    const CHART_COLORS = [
        '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
        '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
        '#EAB308', '#6366F1', '#F97316', '#06B6D4'
    ];

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
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
        } catch (err) {
            c.innerHTML = '<div class="error-box">' + H.esc(err.message) + '</div>';
        }
    }

    // ═══════════════════════════════════════════
    //  HTML
    // ═══════════════════════════════════════════
    function buildHtml(stats) {
        return `
            <div class="dash">
                ${buildGreeting()}
                ${buildKpiStrip(stats)}
                ${buildIncomeExpense(stats)}
                ${buildMiniCharts(stats)}
                ${buildConnection()}
            </div>`;
    }

    // ─── Greeting ───
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

    // ─── KPI Row ───
    // ─── KPI Strip فشرده (تک خط افقی) ───
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

    // ─── درآمد / هزینه ───
    // ─── درآمد / هزینه / خالص ───
    function buildIncomeExpense(stats) {
        const income = stats.totalIncome || 0;
        const expense = stats.totalExpense || 0;
        const net = income - expense;
        const netCls = net >= 0 ? 'positive' : 'negative';

        return `
            <div class="dash-ie">
                <div class="dash-ie-box">
                    <div class="dash-ie-icon-wrap dash-ie-icon-income">${_iconCache.income}</div>
                    <div class="dash-ie-donut"><canvas id="chartIncome"></canvas></div>
                    <div class="dash-ie-meta">
                        <div class="dash-ie-label">درآمد</div>
                        <div class="dash-ie-value">${H.fmt(income)} <small>ریال</small></div>
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

                <div class="dash-ie-box">
                    <div class="dash-ie-icon-wrap dash-ie-icon-expense">${_iconCache.expense}</div>
                    <div class="dash-ie-donut"><canvas id="chartExpense"></canvas></div>
                    <div class="dash-ie-meta">
                        <div class="dash-ie-label">هزینه</div>
                        <div class="dash-ie-value">${H.fmt(expense)} <small>ریال</small></div>
                    </div>
                </div>
            </div>`;
    }

    // ─── ۳ چارت موجود (فشرده) ───
    function buildMiniCharts(stats) {
        return `
            <div class="dash-charts">
                <div class="dash-chart">
                    <div class="dash-chart-head">
                        <span class="dash-chart-ico">${_iconCache.factor}</span>
                        <span>فاکتورها بر اساس نوع</span>
                    </div>
                    <div class="dash-chart-body"><canvas id="chartFactors"></canvas></div>
                </div>
                <div class="dash-chart">
                    <div class="dash-chart-head">
                        <span class="dash-chart-ico">${_iconCache.sanad}</span>
                        <span>اسناد بر اساس وضعیت</span>
                    </div>
                    <div class="dash-chart-body"><canvas id="chartSanads"></canvas></div>
                </div>
                <div class="dash-chart">
                    <div class="dash-chart-head">
                        <span class="dash-chart-ico">${_iconCache.hesab}</span>
                        <span>گردش حساب‌ها بر اساس گروه</span>
                    </div>
                    <div class="dash-chart-body"><canvas id="chartGroups"></canvas></div>
                </div>
            </div>`;
    }

    // ─── Shortcuts ───
    function buildShortcuts() {
        const items = [
            { page: 'sanad', label: 'اسناد', icon: 'sanad', perm: 'Sanad' },
            { page: 'factor', label: 'فاکتورها', icon: 'factor', perm: 'Factor' },
            { page: 'article', label: 'کالاها', icon: 'tafzili', perm: 'Article' },
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
                            <div class="dash-shortcut-icon">${_iconCache[it.icon]}</div>
                            <div class="dash-shortcut-label">${it.label}</div>
                        </div>`).join('')}
                </div>
            </div>`;
    }

    // ─── Connection ───
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
                    <div class="dash-conn-item">
                        <span class="dash-conn-label">کاربر:</span>
                        <span class="dash-conn-value">${H.esc(u.fullName || u.username || '-')}</span>
                    </div>
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════
    function bindEvents() {
        document.querySelectorAll('.dash-shortcut').forEach(el => {
            el.addEventListener('click', () => window.App.navigate(el.dataset.goto));
        });
    }

    // ═══════════════════════════════════════════
    //  CHARTS
    // ═══════════════════════════════════════════
    function renderCharts(stats) {
        if (!window.Chart) return;

        const income = stats.totalIncome || 0;
        const expense = stats.totalExpense || 0;
        const total = income + expense;

        // ─── درآمد ───
        renderDonut('chartIncome', income, total - income, '#10B981', '#D1FAE5');
        // ─── هزینه ───
        renderDonut('chartExpense', expense, total - expense, '#EF4444', '#FEE2E2');

        // ─── ۳ چارت موجود ───
        renderPieChart('chartFactors', stats.factorsByKind || [], false);
        renderPieChart('chartSanads', stats.sanadsByVazeit || [], false);
        renderPieChart('chartGroups', stats.accountsByGroupType || [], true);
    }

    // ─── Donut بزرگ (درآمد/هزینه) ───
    function renderDonut(canvasId, value, other, color, lightColor) {
        const el = document.getElementById(canvasId);
        if (!el) return;

        const total = value + other;
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;

        const chart = new Chart(el, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [value, other || 1],
                    backgroundColor: [color, lightColor],
                    borderWidth: 0,
                    cutout: '78%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            },
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

    // ─── Pie Chart (۳ چارت موجود) ───
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
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true,
                        textDirection: 'rtl',
                        labels: {
                            font: { family: 'Vazirmatn, Tahoma, sans-serif', size: 10 },
                            padding: 6,
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            generateLabels: (chart) => {
                                const data = chart.data;
                                if (!data.labels || !data.labels.length) return [];
                                return data.labels.map((label, i) => {
                                    const val = Number(data.datasets[0].data[i]) || 0;
                                    return {
                                        text: `${label} — ${fmtVal(val)}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].backgroundColor[i],
                                        lineWidth: 0,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        rtl: true,
                        textDirection: 'rtl',
                        titleFont: { family: 'Vazirmatn, Tahoma, sans-serif' },
                        bodyFont: { family: 'Vazirmatn, Tahoma, sans-serif' },
                        callbacks: {
                            label: (ctx) => ' ' + ctx.label + ': ' + fmtVal(Number(ctx.parsed) || 0)
                        }
                    }
                }
            }
        });
        _charts.push(chart);
    }

    function destroyCharts() {
        _charts.forEach(ch => { try { ch.destroy(); } catch (e) { } });
        _charts = [];
    }

    return { render, destroyCharts };
})();

window.App.renderDashboard = window.App.Features.Dashboard.render;