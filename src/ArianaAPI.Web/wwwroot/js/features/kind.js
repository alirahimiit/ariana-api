/* ═══════════════════════════════════════════════════
   Feature / Kind (انواع سند)
   مسئولیت: نمایش لیست انواع سند
   ═══════════════════════════════════════════════════
   وابستگی‌ها:
     - window.App.Helpers  (esc, fmt)
     - window.App.Http     (api)
     - window.App.State
     - Exporter
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Kind = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const list = await window.App.Http.api('/api/kindsanad') || [];

            const rows = list.map(k => `
                <tr>
                    <td class="num" style="width:100px;">${k.code ?? '-'}</td>
                    <td>${H.esc(k.name || '')}</td>
                </tr>
            `).join('') || '<tr><td colspan="2" class="text-center">موردی نیست</td></tr>';

            c.innerHTML = `
                <div class="card">
                    <div class="card-title">انواع سند (${H.fmt(list.length)})</div>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:100px;">کد</th>
                                    <th>نام</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            `;

            Exporter.attach(c, {
                table: c.querySelector('table'),
                title: 'انواع سند',
                subtitle: subtitle(),
                filename: 'KindSanad'
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
window.App.renderKindSanad = window.App.Features.Kind.render;