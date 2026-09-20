/* ═══════════════════════════════════════════════════
   Feature / Bilan (ترازنامه)
   مسئولیت: صفحه تنظیمات + اجرای گزارش + نمایش نتیجه + خروجی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Bilan = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _includeZero = false;

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        c.innerHTML = `
        <div class="card">
            <div class="card-title">⚙️ تنظیمات ترازنامه</div>
            <div class="filters">
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="blFromDate" placeholder="1404/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="blToDate" placeholder="1404/12/29">
                </div>
                <div class="form-group">
                    <label>نمایش</label>
                    <div class="custom-select" id="blZeroWrap">
                        <button type="button" class="custom-select-trigger" id="blZeroTrigger">
                            <span class="custom-select-value">فقط دارای گردش</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="blZeroMenu">
                            <div class="custom-select-option selected" data-value="false">فقط دارای گردش</div>
                            <div class="custom-select-option" data-value="true">نمایش همه (حتی صفر)</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="blBtnRun">⚖️ تهیه ترازنامه</button>
                </div>
            </div>
        </div>
        <div id="blResult">
            <div class="empty">
                <div class="empty-icon">⚖️</div>
                <p>بازه تاریخ را وارد کنید و روی «تهیه ترازنامه» بزنید</p>
            </div>
        </div>`;

        _includeZero = false;
        setupCustomSelect('blZeroWrap', 'blZeroTrigger', 'blZeroMenu', (v) => {
            _includeZero = v === 'true';
        });

        document.getElementById('blBtnRun').addEventListener('click', run);
    }

    // ═══════════════════════════════════════════
    //  RUN
    // ═══════════════════════════════════════════
    async function run() {
        const btn = document.getElementById('blBtnRun');
        btn.disabled = true;
        btn.textContent = 'در حال تهیه...';

        const fromDate = document.getElementById('blFromDate').value || null;
        const toDate = document.getElementById('blToDate').value || null;
        const u = window.App.state.user;

        try {
            let url = `/api/orgs/${u.orgId}/fy/${u.fyId}/reports/bilan`;
            const params = [];
            if (fromDate) params.push('fromDate=' + encodeURIComponent(fromDate));
            if (toDate) params.push('toDate=' + encodeURIComponent(toDate));
            if (_includeZero) params.push('includeZeroBalance=true');
            if (params.length) url += '?' + params.join('&');

            const result = await window.App.Http.api(url);
            renderResult(result);
        } catch (err) {
            document.getElementById('blResult').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '⚖️ تهیه ترازنامه';
        }
    }

    // ═══════════════════════════════════════════
    //  RENDER RESULT
    // ═══════════════════════════════════════════
    function renderResult(data) {
        const container = document.getElementById('blResult');

        if ((!data.assets || data.assets.length === 0) &&
            (!data.liabilities || data.liabilities.length === 0)) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>داده‌ای برای این بازه یافت نشد</p>
                </div>`;
            return;
        }

        const renderGroup = (g) => {
            const isAsset = g.nature === 'asset';
            const headerBg = isAsset ? '#DBEAFE' : '#FEF3C7';
            const headerColor = isAsset ? '#1E40AF' : '#92400E';

            const rows = (g.items || []).map(it => `
                <tr>
                    <td class="num text-center">${it.codeCol}</td>
                    <td>${H.esc(it.hesabName)}</td>
                    <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left" style="font-weight:600;">${H.fmt(Math.abs(it.mabMan))}</td>
                </tr>
            `).join('');

            return `
                <div class="card" style="padding:0; overflow:hidden; margin-bottom:12px;">
                    <div style="padding:10px 15px; background:${headerBg}; color:${headerColor}; font-weight:700; font-size:14px;">
                        ${H.esc(g.groupTypeName)}
                    </div>
                    <div class="table-wrapper" style="border:none; border-radius:0;">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:80px;">کد کل</th>
                                    <th>نام حساب</th>
                                    <th class="text-left" style="width:150px;">بدهکار</th>
                                    <th class="text-left" style="width:150px;">بستانکار</th>
                                    <th class="text-left" style="width:150px;">مانده</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                            <tfoot>
                                <tr style="background:#F1F5F9; font-weight:700;">
                                    <td colspan="2" class="text-center">جمع ${H.esc(g.groupTypeName)}</td>
                                    <td class="num text-left">${H.fmt(g.totalMabBed)}</td>
                                    <td class="num text-left">${H.fmt(g.totalMabBes)}</td>
                                    <td class="num text-left">${H.fmt(Math.abs(g.total))}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>`;
        };

        const assetsHtml = (data.assets || []).map(renderGroup).join('');
        const liabilitiesHtml = (data.liabilities || []).map(renderGroup).join('');
        const diffColor = data.isBalanced ? '#059669' : '#DC2626';

        const summaryHtml = `
            <div class="card" style="background:linear-gradient(135deg,#F9FAFB,#EEF2FF); border:2px solid #C7D2FE; margin-bottom:16px;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:16px;">
                    <div style="text-align:center; padding:16px; background:white; border-radius:10px;">
                        <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">جمع دارایی‌ها</div>
                        <div style="font-size:20px; font-weight:700; color:#1E40AF; direction:ltr;">
                            ${H.fmt(data.totalAssets)}
                        </div>
                    </div>
                    <div style="text-align:center; padding:16px; background:white; border-radius:10px;">
                        <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">جمع بدهی‌ها</div>
                        <div style="font-size:20px; font-weight:700; color:#92400E; direction:ltr;">
                            ${H.fmt(data.totalLiabilities)}
                        </div>
                    </div>
                    <div style="text-align:center; padding:16px; background:white; border-radius:10px; border:2px solid ${diffColor};">
                        <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">تفاوت</div>
                        <div style="font-size:20px; font-weight:700; color:${diffColor}; direction:ltr;">
                            ${H.fmt(Math.abs(data.difference))}
                        </div>
                        <div style="font-size:12px; color:${diffColor}; margin-top:4px;">${H.esc(data.resultText)}</div>
                    </div>
                </div>
            </div>`;

        container.innerHTML = `
            ${summaryHtml}
            ${assetsHtml ? `<div style="margin-bottom:8px;"><h3 style="margin-bottom:8px; color:#1E40AF;">🏦 دارایی‌ها</h3>${assetsHtml}</div>` : ''}
            ${liabilitiesHtml ? `<div style="margin-top:16px;"><h3 style="margin-bottom:8px; color:#92400E;">📋 بدهی‌ها</h3>${liabilitiesHtml}</div>` : ''}
        `;

        Exporter.attach(container, {
            title: 'ترازنامه (بیلان)',
            subtitle: subtitle(),
            filename: 'Bilan',
            customHtml: () => buildPrintHtml(data)
        });

        window.App.enhanceTables(container);
    }

    // ═══════════════════════════════════════════
    //  PRINT HTML
    // ═══════════════════════════════════════════
    function buildPrintHtml(data) {
        const renderGroupBlock = (g) => {
            const rows = (g.items || []).map(it => `
                <tr>
                    <td class="num text-center">${it.codeCol}</td>
                    <td>${H.esc(it.hesabName)}</td>
                    <td class="num text-left">${it.mabBed > 0 ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left">${H.fmt(Math.abs(it.mabMan))}</td>
                </tr>
            `).join('');

            return `
                <div class="section-title">${H.esc(g.groupTypeName)}</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:80px;">کد کل</th>
                            <th>نام حساب</th>
                            <th class="text-left" style="width:140px;">بدهکار</th>
                            <th class="text-left" style="width:140px;">بستانکار</th>
                            <th class="text-left" style="width:140px;">مانده</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="text-center">جمع ${H.esc(g.groupTypeName)}</td>
                            <td class="num text-left">${H.fmt(g.totalMabBed)}</td>
                            <td class="num text-left">${H.fmt(g.totalMabBes)}</td>
                            <td class="num text-left">${H.fmt(Math.abs(g.total))}</td>
                        </tr>
                    </tfoot>
                </table>`;
        };

        const assetsBlock = (data.assets || []).map(renderGroupBlock).join('');
        const liabilitiesBlock = (data.liabilities || []).map(renderGroupBlock).join('');
        const diffColor = data.isBalanced ? '#059669' : '#DC2626';

        return `
            <table class="factor-info-table">
                <tr>
                    <td class="label">از تاریخ:</td>
                    <td>${H.esc(data.fromDate || 'ابتدا')}</td>
                    <td class="label">تا تاریخ:</td>
                    <td>${H.esc(data.toDate || 'انتها')}</td>
                </tr>
            </table>

            ${assetsBlock ? `<div class="section-title">🏦 دارایی‌ها</div>${assetsBlock}` : ''}
            ${liabilitiesBlock ? `<div class="section-title">📋 بدهی‌ها</div>${liabilitiesBlock}` : ''}

            <div class="section-title">📊 خلاصه ترازنامه</div>
            <table>
                <tr>
                    <td class="label" style="width:180px;">جمع دارایی‌ها:</td>
                    <td class="num text-left" style="color:#1E40AF; font-weight:700;">${H.fmt(data.totalAssets)}</td>
                </tr>
                <tr>
                    <td class="label">جمع بدهی‌ها:</td>
                    <td class="num text-left" style="color:#92400E; font-weight:700;">${H.fmt(data.totalLiabilities)}</td>
                </tr>
                <tr style="background:#EEF2FF;">
                    <td class="label" style="font-weight:700;">تفاوت:</td>
                    <td class="num text-left" style="color:${diffColor}; font-weight:700;">
                        ${H.fmt(Math.abs(data.difference))} — ${H.esc(data.resultText)}
                    </td>
                </tr>
            </table>`;
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════
    function setupCustomSelect(wrapId, triggerId, menuId, onChange) {
        const wrap = document.getElementById(wrapId);
        const trigger = document.getElementById(triggerId);
        const menu = document.getElementById(menuId);
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(el => {
                if (el !== wrap) el.classList.remove('open');
            });
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                valueEl.textContent = opt.textContent.trim();
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
                onChange(opt.dataset.value);
            });
        });
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return { render, run };
})();

// ⭐ alias برای سازگاری
window.App.renderBilan = window.App.Features.Bilan.render;
window.App.runBilan = window.App.Features.Bilan.run;