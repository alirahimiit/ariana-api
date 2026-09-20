/* ═══════════════════════════════════════════════════
   Feature / Hesab (درخت حساب‌ها)
   مسئولیت: نمایش درخت کل/معین + رنگ‌بندی مانده
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Hesab = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>`;

        try {
            const items = await window.App.Http.api('/api/hesab/tree') || [];

            if (items.length === 0) {
                c.innerHTML = `<div class="empty"><div class="empty-icon">🏦</div><p>حسابی یافت نشد</p></div>`;
                return;
            }

            // ─── ساختار درخت ───
            const cols = items.filter(x => x.level === 'col').sort((a, b) => a.codeCol - b.codeCol);
            const moeinMap = {};
            items.filter(x => x.level === 'moein').forEach(m => {
                if (!moeinMap[m.codeCol]) moeinMap[m.codeCol] = [];
                moeinMap[m.codeCol].push(m);
            });

            c.innerHTML = `
                <div class="card">
                    <div class="card-title">
                        <span>🏦 درخت حساب‌ها</span>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-ghost btn-sm" id="hesabExpandAll">🔽 باز کردن همه</button>
                            <button class="btn btn-ghost btn-sm" id="hesabCollapseAll">🔼 بستن همه</button>
                        </div>
                    </div>

                    <div class="tree-container">
                        ${cols.map(col => renderCol(col, moeinMap[col.codeCol] || [])).join('')}
                    </div>
                </div>`;

            // ─── رویداد باز/بسته ───
            document.querySelectorAll('[data-toggle]').forEach(el => {
                el.addEventListener('click', () => {
                    const targetId = el.dataset.toggle;
                    const target = document.getElementById(targetId);
                    if (!target) return;

                    const isOpen = target.classList.contains('open');
                    target.classList.toggle('open', !isOpen);
                    el.querySelector('.tree-toggle').textContent = isOpen ? '▶' : '▼';
                });
            });

            // ─── باز/بستن همه ───
            document.getElementById('hesabExpandAll').addEventListener('click', () => {
                document.querySelectorAll('.tree-children').forEach(el => el.classList.add('open'));
                document.querySelectorAll('.tree-toggle').forEach(el => el.textContent = '▼');
            });

            document.getElementById('hesabCollapseAll').addEventListener('click', () => {
                document.querySelectorAll('.tree-children').forEach(el => el.classList.remove('open'));
                document.querySelectorAll('.tree-toggle').forEach(el => el.textContent = '▶');
            });

            // ─── دکمه‌های خروجی ───
            Exporter.attach(c, {
                title: 'درخت حساب‌ها',
                subtitle: subtitle(),
                filename: 'HesabTree',
                customHtml: () => buildTreeHtml(cols, moeinMap)
            });

            window.App.enhanceTables(c);

        } catch (err) {
            c.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function renderCol(col, moeins) {
        const colMandeh = mandehDisplay(col.mabMandeh, col.mahiat);
        const sorted = [...moeins].sort((a, b) => a.codeMoein - b.codeMoein);

        const moeinRows = sorted.map(moein => {
            const mnt = mandehDisplay(moein.mabMandeh, moein.mahiat);
            return `
                <div class="tree-row level-moein ${mnt.rowClass}">
                    <span class="tree-indent"></span>
                    <span class="tree-code">${moein.codeMoein}</span>
                    <span class="tree-name">${H.esc(moein.name)}</span>
                    <span class="tree-badges">
                        ${moein.hasTafzili ? '<span class="badge badge-info" style="font-size:10px;">تفصیلی‌دار</span>' : ''}
                    </span>
                    <span class="tree-mahiat">${mahiatBadge(moein.mahiat)}</span>
                    <span class="tree-num">${H.fmt(moein.sumBed)}</span>
                    <span class="tree-num">${H.fmt(moein.sumBes)}</span>
                    <span class="tree-num tree-mandeh" style="${mnt.colorStyle}">
                        ${mnt.value}
                        ${mnt.direction ? `<span class="mandeh-dir">${mnt.direction}</span>` : ''}
                    </span>
                </div>`;
        }).join('');

        return `
            <div class="tree-col" data-code="${col.codeCol}">
                <div class="tree-row level-col ${colMandeh.rowClass}" data-toggle="col-${col.codeCol}">
                    <span class="tree-toggle">▶</span>
                    <span class="tree-code">${col.codeCol}</span>
                    <span class="tree-name">${H.esc(col.name)}</span>
                    <span class="tree-badges">
                        ${col.hasTafzili ? '<span class="badge badge-info" style="font-size:10px;">تفصیلی‌دار</span>' : ''}
                    </span>
                    <span class="tree-mahiat">${mahiatBadge(col.mahiat)}</span>
                    <span class="tree-num">${H.fmt(col.sumBed)}</span>
                    <span class="tree-num">${H.fmt(col.sumBes)}</span>
                    <span class="tree-num tree-mandeh" style="${colMandeh.colorStyle}">
                        ${colMandeh.value}
                        ${colMandeh.direction ? `<span class="mandeh-dir">${colMandeh.direction}</span>` : ''}
                    </span>
                </div>
                <div class="tree-children" id="col-${col.codeCol}">
                    ${moeinRows}
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  PRINT HTML
    // ═══════════════════════════════════════════
    function buildTreeHtml(cols, moeinMap) {
        const rows = [];

        cols.forEach(col => {
            const colM = mandehDisplay(col.mabMandeh, col.mahiat);

            // ردیف کل
            rows.push(`
                <tr style="background:#EEF2FF; font-weight:bold;">
                    <td class="num text-center">${col.codeCol}</td>
                    <td colspan="2">${H.esc(col.name || '')}</td>
                    <td class="text-center">${mahiatText(col.mahiat)}</td>
                    <td class="num text-left">${H.fmt(col.sumBed)}</td>
                    <td class="num text-left">${H.fmt(col.sumBes)}</td>
                    <td class="num text-left" style="${colM.isNormal ? '' : 'color:#DC2626; font-weight:bold;'}">
                        ${colM.value} ${colM.direction}
                    </td>
                </tr>`);

            // معین‌ها
            const moeins = (moeinMap[col.codeCol] || [])
                .sort((a, b) => a.codeMoein - b.codeMoein);

            moeins.forEach(moein => {
                const mnt = mandehDisplay(moein.mabMandeh, moein.mahiat);
                rows.push(`
                    <tr>
                        <td class="num text-center" style="color:#6B7280;">${col.codeCol}</td>
                        <td style="color:#6B7280;">${H.esc(col.name || '')}</td>
                        <td class="num text-center">${moein.codeMoein}</td>
                        <td>${H.esc(moein.name || '')}</td>
                        <td class="text-center">${mahiatText(moein.mahiat)}</td>
                        <td class="num text-left">${H.fmt(moein.sumBed)}</td>
                        <td class="num text-left">${H.fmt(moein.sumBes)}</td>
                        <td class="num text-left" style="${mnt.isNormal ? '' : 'color:#DC2626; font-weight:bold;'}">
                            ${mnt.value} ${mnt.direction}
                        </td>
                    </tr>`);
            });

            // ردیف جمع
            if (moeins.length > 0) {
                const totalBed = moeins.reduce((s, m) => s + (m.sumBed || 0), 0);
                const totalBes = moeins.reduce((s, m) => s + (m.sumBes || 0), 0);
                const totalMan = moeins.reduce((s, m) => s + (m.mabMandeh || 0), 0);
                const totalM = mandehDisplay(totalMan, col.mahiat);

                rows.push(`
                    <tr style="background:#F9FAFB; font-weight:600;">
                        <td colspan="4" class="text-center" style="color:#6B7280; font-size:11px;">
                            جمع معین‌های حساب کل ${col.codeCol}
                        </td>
                        <td class="num text-left">${H.fmt(totalBed)}</td>
                        <td class="num text-left">${H.fmt(totalBes)}</td>
                        <td class="num text-left" style="${totalM.isNormal ? '' : 'color:#DC2626; font-weight:bold;'}">
                            ${totalM.value} ${totalM.direction}
                        </td>
                    </tr>`);
            }
        });

        return `
            <table>
                <thead>
                    <tr>
                        <th style="width:60px;">کد کل</th>
                        <th style="width:150px;">نام کل</th>
                        <th style="width:60px;">کد معین</th>
                        <th>نام معین</th>
                        <th style="width:70px;">ماهیت</th>
                        <th class="text-left" style="width:120px;">بدهکار</th>
                        <th class="text-left" style="width:120px;">بستانکار</th>
                        <th class="text-left" style="width:120px;">مانده</th>
                    </tr>
                </thead>
                <tbody>${rows.join('')}</tbody>
            </table>`;
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════
    function mahiatText(m) {
        if (m == null) return '-';
        if (m === 1) return 'بدهکار';
        if (m === 2) return 'بستانکار';
        if (m === 3) return 'دو طرفه';
        return '-';
    }

    function mahiatBadge(m) {
        if (m == null) return '<span class="badge badge-gray">-</span>';
        return m == 1
            ? '<span class="badge badge-info">بدهکار</span>'
            : '<span class="badge badge-warning">بستانکار</span>';
    }

    function mandehDisplay(mandehRaw, mahiat) {
        const raw = mandehRaw ?? 0;
        const abs = Math.abs(raw);

        if (raw === 0) {
            return {
                value: '-', direction: '', isNormal: true, isZero: true,
                colorStyle: 'color:#9CA3AF;', rowClass: ''
            };
        }

        const balanceIsDebit = raw > 0;
        const balanceIsCredit = raw < 0;

        const isDebitNature = mahiat === 1;
        const isCreditNature = mahiat === 2;

        const isNormal =
            (isDebitNature && balanceIsDebit) ||
            (isCreditNature && balanceIsCredit);

        const direction = balanceIsDebit ? 'بد' : 'بس';
        const colorStyle = isNormal
            ? 'color:#059669; font-weight:600;'
            : 'color:#DC2626; font-weight:700;';

        return {
            value: H.fmt(abs),
            direction,
            isNormal,
            isZero: false,
            colorStyle,
            rowClass: isNormal ? '' : 'row-abnormal'
        };
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

// ⭐ alias
window.App.renderHesab = window.App.Features.Hesab.render;