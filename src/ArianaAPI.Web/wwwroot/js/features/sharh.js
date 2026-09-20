/* ═══════════════════════════════════════════════════
   Feature / Sharh (شرح‌های اسناد)
   مسئولیت: نمایش لیست شرح‌ها
   ═══════════════════════════════════════════════════
   وابستگی‌ها:
     - window.App.Helpers  (esc)
     - window.App.Http     (api)
     - window.App.State
     - Exporter
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Sharh = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const list = await window.App.Http.api('/api/sharh') || [];

            const rows = list.map(s => `
                <tr>
                    <td class="num">${s.sharhID ?? s.sharhId ?? '-'}</td>
                    <td>${H.esc(s.sharhText || s.sharh || '')}</td>
                </tr>
            `).join('') || '<tr><td colspan="2" class="text-center">موردی نیست</td></tr>';

            c.innerHTML = `
                <div class="card">
                    <div class="card-title">شرح‌ها (${H.fmt(list.length)})</div>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:100px;">کد</th>
                                    <th>شرح</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            `;

            Exporter.attach(c, {
                table: c.querySelector('table'),
                title: 'شرح‌های اسناد',
                subtitle: subtitle(),
                filename: 'SharhList'
            });

            window.App.enhanceTables(c);
        } catch (err) {
            c.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return { render };
})();

// ⭐ alias برای سازگاری با کد فعلی
window.App.renderSharh = window.App.Features.Sharh.render;