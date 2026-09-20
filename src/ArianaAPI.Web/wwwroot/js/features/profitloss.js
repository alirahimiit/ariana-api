/* ═══════════════════════════════════════════════════
   Feature / ProfitLoss (گزارش سود و زیان)
   مسئولیت: صفحه تنظیمات + اجرای گزارش + نمایش نتیجه + خروجی
   ═══════════════════════════════════════════════════
   وابستگی‌ها:
     - window.App.Helpers     (fmt, fmtAcc, esc)
     - window.App.Http        (api)
     - window.App.State
     - window.App.state       (state سراسری — pageSize، user)
     - Exporter
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.ProfitLoss = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _includeZero = false;

    // ═══════════════════════════════════════════
    //  RENDER — صفحه تنظیمات
    // ═══════════════════════════════════════════
    function render() {
        const c = document.getElementById('content');
        c.innerHTML = `
        <div class="card">
            <div class="card-title">⚙️ تنظیمات گزارش سود و زیان</div>
            <div class="filters">
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="plFromDate" placeholder="1404/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="plToDate" placeholder="1404/12/29">
                </div>
                <div class="form-group">
                    <label>نمایش</label>
                    <div class="custom-select" id="plZeroWrap">
                        <button type="button" class="custom-select-trigger" id="plZeroTrigger">
                            <span class="custom-select-value">فقط دارای گردش</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="plZeroMenu">
                            <div class="custom-select-option selected" data-value="false">فقط دارای گردش</div>
                            <div class="custom-select-option" data-value="true">نمایش همه (حتی صفر)</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="plBtnRun">
                        💰 تهیه گزارش
                    </button>
                </div>
            </div>
        </div>
        <div id="plResult">
            <div class="empty">
                <div class="empty-icon">💰</div>
                <p>بازه تاریخ را وارد کنید و روی «تهیه گزارش» بزنید</p>
            </div>
        </div>`;

        _includeZero = false;
        setupCustomSelect('plZeroWrap', 'plZeroTrigger', 'plZeroMenu', (v) => {
            _includeZero = v === 'true';
        });

        document.getElementById('plBtnRun').addEventListener('click', run);
    }

    // ═══════════════════════════════════════════
    //  RUN — تهیه گزارش
    // ═══════════════════════════════════════════
    async function run() {
        const btn = document.getElementById('plBtnRun');
        btn.disabled = true;
        btn.textContent = 'در حال تهیه...';

        const fromDate = document.getElementById('plFromDate').value || null;
        const toDate = document.getElementById('plToDate').value || null;
        const u = window.App.state.user;

        try {
            let url = `/api/orgs/${u.orgId}/fy/${u.fyId}/reports/profit-loss`;
            const params = [];
            if (fromDate) params.push('fromDate=' + encodeURIComponent(fromDate));
            if (toDate) params.push('toDate=' + encodeURIComponent(toDate));
            if (_includeZero) params.push('includeZeroBalance=true');
            if (params.length) url += '?' + params.join('&');

            const result = await window.App.Http.api(url);
            renderResult(result);
        } catch (err) {
            document.getElementById('plResult').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '💰 تهیه گزارش';
        }
    }

    // ═══════════════════════════════════════════
    //  RENDER RESULT
    // ═══════════════════════════════════════════
    function renderResult(data) {
        const container = document.getElementById('plResult');

        if ((!data.revenues || data.revenues.length === 0) &&
            (!data.expenses || data.expenses.length === 0)) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>داده‌ای برای این بازه یافت نشد</p>
                </div>`;
            return;
        }

        // ─── گروه ───
        const renderGroup = (g) => {
            const isRevenue = g.nature === 'revenue';
            const headerBg = isRevenue ? '#DCFCE7' : '#FEE2E2';
            const headerColor = isRevenue ? '#166534' : '#991B1B';

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
                <div class="card" style="padding:0; overflow:hidden;">
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

        const revenuesHtml = (data.revenues || []).map(renderGroup).join('');
        const expensesHtml = (data.expenses || []).map(renderGroup).join('');

        const netColor = data.resultType === 'profit' ? '#059669'
            : data.resultType === 'loss' ? '#DC2626' : '#6B7280';

        const summaryHtml = `
            <div class="card" style="background:linear-gradient(135deg,#F9FAFB,#EEF2FF); border:2px solid #C7D2FE;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:16px;">
                    <div style="text-align:center; padding:16px; background:white; border-radius:10px;">
                        <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">جمع درآمدها</div>
                        <div style="font-size:20px; font-weight:700; color:#059669; direction:ltr;">
                            ${H.fmt(data.totalRevenue)}
                        </div>
                    </div>
                    <div style="text-align:center; padding:16px; background:white; border-radius:10px;">
                        <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">جمع هزینه‌ها</div>
                        <div style="font-size:20px; font-weight:700; color:#DC2626; direction:ltr;">
                            ${H.fmtAcc(data.totalExpense)}
                        </div>
                    </div>
                    <div style="text-align:center; padding:16px; background:white; border-radius:10px; border:2px solid ${netColor};">
                        <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">${H.esc(data.resultText)}</div>
                        <div style="font-size:22px; font-weight:700; color:${netColor}; direction:ltr;">
                            ${H.fmt(Math.abs(data.netProfit))}
                        </div>
                    </div>
                </div>
            </div>`;

        container.innerHTML = `
            ${summaryHtml}
            ${revenuesHtml ? `<div style="margin-top:16px;"><h3 style="margin-bottom:12px; color:#166534;">💰 درآمدها</h3>${revenuesHtml}</div>` : ''}
            ${expensesHtml ? `<div style="margin-top:16px;"><h3 style="margin-bottom:12px; color:#991B1B;">💸 هزینه‌ها</h3>${expensesHtml}</div>` : ''}
        `;

        const self = this;
        Exporter.attach(container, {
            title: 'گزارش سود و زیان',
            subtitle: subtitle(),
            filename: 'ProfitLoss',
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

        const revenuesBlock = (data.revenues || []).map(renderGroupBlock).join('');
        const expensesBlock = (data.expenses || []).map(renderGroupBlock).join('');
        const netColor = data.resultType === 'profit' ? '#059669'
            : data.resultType === 'loss' ? '#DC2626' : '#6B7280';

        return `
            <table class="factor-info-table">
                <tr>
                    <td class="label">از تاریخ:</td>
                    <td>${H.esc(data.fromDate || 'ابتدا')}</td>
                    <td class="label">تا تاریخ:</td>
                    <td>${H.esc(data.toDate || 'انتها')}</td>
                </tr>
            </table>

            ${revenuesBlock ? `<div class="section-title">💰 درآمدها</div>${revenuesBlock}` : ''}
            ${expensesBlock ? `<div class="section-title">💸 هزینه‌ها</div>${expensesBlock}` : ''}

            <div class="section-title">📊 خلاصه سود و زیان</div>
            <table>
                <tr>
                    <td class="label" style="width:180px;">جمع درآمدها:</td>
                    <td class="num text-left" style="color:#059669; font-weight:700;">${H.fmt(data.totalRevenue)}</td>
                </tr>
                <tr>
                    <td class="label">جمع هزینه‌ها:</td>
                    <td class="num text-left" style="color:#DC2626; font-weight:700;">${H.fmt(data.totalExpense)}</td>
                </tr>
                <tr style="background:#EEF2FF;">
                    <td class="label" style="font-weight:700;">${H.esc(data.resultText)}:</td>
                    <td class="num text-left" style="color:${netColor}; font-weight:700; font-size:14px;">
                        ${H.fmt(Math.abs(data.netProfit))}
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
window.App.renderProfitLoss = window.App.Features.ProfitLoss.render;
window.App.runProfitLoss = window.App.Features.ProfitLoss.run;