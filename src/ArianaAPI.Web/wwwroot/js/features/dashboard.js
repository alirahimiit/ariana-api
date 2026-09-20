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

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Dashboard = (function () {
    'use strict';

    const H = window.App.Helpers;

    // chart instance ها — برای destroy
    let _charts = [];

    // رنگ‌های نمودار
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
        c.innerHTML = `<div class="loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>`;

        // پاک‌سازی chart های قبلی
        destroyCharts();

        try {
            const stats = await window.App.Http.api('/api/dashboard/stats');
            const u = window.App.state.user || {};

            c.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon purple">📄</div>
                    <div>
                        <div class="stat-value">${H.fmt(stats.totalSanads)}</div>
                        <div class="stat-label">کل اسناد</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">🧾</div>
                    <div>
                        <div class="stat-value">${H.fmt(stats.totalFactors)}</div>
                        <div class="stat-label">کل فاکتورها</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange">🏦</div>
                    <div>
                        <div class="stat-value">${H.fmt(stats.totalHesabs)}</div>
                        <div class="stat-label">حساب‌های کل</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">👥</div>
                    <div>
                        <div class="stat-value">${H.fmt(stats.totalTafzilis)}</div>
                        <div class="stat-label">حساب‌های تفضیلی</div>
                    </div>
                </div>
            </div>

            <div class="dash-charts">
                <div class="card">
                    <div class="card-title"><span>🧾 فاکتورها</span></div>
                    <div class="chart-wrapper">
                        <canvas id="chartFactors"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-title"><span>📄 اسناد</span></div>
                    <div class="chart-wrapper">
                        <canvas id="chartSanads"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-title"><span>🏦 گروه‌های حساب</span></div>
                    <div class="chart-wrapper">
                        <canvas id="chartGroups"></canvas>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">🔗 اطلاعات اتصال</div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">سازمان</span>
                        <span class="info-value">
                            ${H.esc(u.orgName || '-')}
                            <span class="info-meta">(کد ${u.orgId})</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">دوره مالی</span>
                        <span class="info-value">
                            ${H.esc(u.fyName || '-')}
                            <span class="info-meta">(کد ${u.fyId})</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">دیتابیس</span>
                        <span class="info-value">
                            <code class="db-code">${H.esc(u.dbName || '-')}</code>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">کاربر</span>
                        <span class="info-value">
                            ${H.esc(u.fullName || u.username || '-')}
                            <span class="info-meta">(${H.esc(u.username || '')})</span>
                        </span>
                    </div>
                </div>
            </div>`;

            // ─── رسم نمودارها ───
            renderPieChart('chartFactors', stats.factorsByKind || []);
            renderPieChart('chartSanads', stats.sanadsByVazeit || []);
            renderPieChart('chartGroups', stats.accountsByGroupType || []);

        } catch (err) {
            c.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    // ═══════════════════════════════════════════
    //  PIE CHART
    // ═══════════════════════════════════════════
    function renderPieChart(canvasId, items) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (!items || items.length === 0) {
            const parent = canvas.parentElement;
            parent.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>داده‌ای برای نمایش نیست</p></div>`;
            return;
        }

        const isMoney = items[0].isMoney === true;
        const labels = items.map(x => x.label);
        const values = items.map(x => Number(x.value) || 0);
        const colors = items.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]);

        const formatValue = (v) => {
            const num = Number(v) || 0;
            return H.fmt(isMoney ? Math.round(num) : num);
        };

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
                            font: { family: 'Tahoma, Vazirmatn, sans-serif', size: 10 },
                            padding: 8,
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
                                        text: `${label} — ${formatValue(val)}`,
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
                        titleFont: { family: 'Tahoma, Vazirmatn, sans-serif' },
                        bodyFont: { family: 'Tahoma, Vazirmatn, sans-serif' },
                        callbacks: {
                            label: (ctx) => {
                                const val = Number(ctx.parsed) || 0;
                                return ` ${ctx.label}: ${formatValue(val)}`;
                            }
                        }
                    }
                }
            }
        });

        _charts.push(chart);
    }

    function destroyCharts() {
        _charts.forEach(ch => {
            try { ch.destroy(); } catch (e) { /* ignore */ }
        });
        _charts = [];
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return { render, destroyCharts };
})();

// ⭐ alias
window.App.renderDashboard = window.App.Features.Dashboard.render;