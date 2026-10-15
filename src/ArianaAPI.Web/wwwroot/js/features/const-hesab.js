/* ═══════════════════════════════════════════════════════════
   Feature / ConstHesab — حساب‌های پیش‌فرض
   ═══════════════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.ConstHesab = (function () {
    'use strict';
    const H = window.App.Helpers;

    const _state = {
        items: [],
        filter: 'all'
    };

    // ═══════════════════════════════════════════
    //  Render
    // ═══════════════════════════════════════════
    async function render() {
        document.getElementById('content').innerHTML = `
            <div class="ch-page">
                <div class="ch-header">
                    <div>
                        <h2 class="ch-title">⚙️ حساب‌های پیش‌فرض</h2>
                        <div class="ch-sub">
                            تعیین کدینگ حساب برای هر نوع سند خودکار (خرید، فروش، مالیات، ...)
                        </div>
                    </div>
                </div>

                <div class="ch-toolbar">
                    <div class="ch-stats" id="chStats"></div>
                    <div class="ch-filters">
                        <label class="ch-filter">
                            <input type="radio" name="chFilter" value="all" checked>
                            <span>همه</span>
                        </label>
                        <label class="ch-filter">
                            <input type="radio" name="chFilter" value="set">
                            <span>تنظیم‌شده</span>
                        </label>
                        <label class="ch-filter">
                            <input type="radio" name="chFilter" value="unset">
                            <span>تنظیم‌نشده</span>
                        </label>
                    </div>
                </div>

                <div id="chTableWrap" class="ch-table-wrap">
                    <div class="loading">در حال بارگذاری...</div>
                </div>
            </div>`;

        document.querySelectorAll('input[name="chFilter"]').forEach(r => {
            r.addEventListener('change', e => {
                _state.filter = e.target.value;
                renderTable();
            });
        });

        await loadList();
    }

    // ═══════════════════════════════════════════
    //  Load
    // ═══════════════════════════════════════════
    async function loadList() {
        try {
            const list = await window.App.Http.api('/api/const-hesab/list');
            _state.items = list || [];
            renderStats();
            renderTable();
        } catch (err) {
            const w = document.getElementById('chTableWrap');
            if (w) w.innerHTML = `<div class="empty">خطا: ${H.esc(err.message)}</div>`;
        }
    }

    function renderStats() {
        const total = _state.items.length;
        const setCount = _state.items.filter(x => x.isSet).length;
        const unsetCount = total - setCount;

        const el = document.getElementById('chStats');
        if (!el) return;
        el.innerHTML = `
            <div class="ch-stat ch-stat-total">
                <span class="ch-stat-num">${total}</span>
                <span class="ch-stat-label">کل</span>
            </div>
            <div class="ch-stat ch-stat-ok">
                <span class="ch-stat-num">${setCount}</span>
                <span class="ch-stat-label">تنظیم‌شده</span>
            </div>
            <div class="ch-stat ch-stat-warn">
                <span class="ch-stat-num">${unsetCount}</span>
                <span class="ch-stat-label">تنظیم‌نشده</span>
            </div>`;
    }

    function formatCode(it) {
        const col = it.codeCol;
        const moein = it.codeMoein;
        const tafzil = it.codeTafzil;

        if (!col && !moein && !tafzil) return '—';
        if (col === -1 && tafzil) return `تفصیلی ${tafzil}`;
        if (col > 0 && moein > 0) return `${col}-${moein}`;
        if (col > 0) return `${col}`;
        return '—';
    }

    // ⭐ نام کامل: کل - معین
    function formatFullName(it) {
        const colName = it.colName || '';
        const moeinName = it.hesabName || '';

        if (colName && moeinName) return `${colName} - ${moeinName}`;
        if (moeinName) return moeinName;
        if (colName) return colName;
        return '—';
    }

    function renderTable() {
        const wrap = document.getElementById('chTableWrap');
        if (!wrap) return;

        let items = _state.items;
        if (_state.filter === 'set') items = items.filter(x => x.isSet);
        else if (_state.filter === 'unset') items = items.filter(x => !x.isSet);

        if (items.length === 0) {
            wrap.innerHTML = `<div class="empty">موردی یافت نشد</div>`;
            return;
        }

        const rows = items.map(it => {
            const code = it.isSet
                ? `<span class="ch-code">${H.esc(formatCode(it))}</span>`
                : `<span class="ch-code-empty">—</span>`;

            const name = it.isSet
                ? `<span class="ch-hesab-name">${H.esc(formatFullName(it))}</span>`
                : `<span class="ch-unset">تنظیم نشده</span>`;

            const badge = it.isSet
                ? `<span class="ch-badge ch-badge-ok">✓</span>`
                : `<span class="ch-badge ch-badge-warn">!</span>`;

            let actions = '';
            actions += `<button class="ch-btn ch-btn-pick" data-type="${it.type}" title="انتخاب حساب">🏦</button>`;
            if (it.isSet) {
                actions += `<button class="ch-btn ch-btn-clear" data-type="${it.type}" title="پاک کردن">🗑️</button>`;
            }

            return `
                <tr class="${it.isSet ? 'row-set' : 'row-unset'}">
                    <td class="ch-col-type">${it.type}</td>
                    <td class="ch-col-name">${H.esc(it.typeName)}</td>
                    <td class="ch-col-code">${code}</td>
                    <td class="ch-col-hesab">${name}</td>
                    <td class="ch-col-status">${badge}</td>
                    <td class="ch-col-actions">${actions}</td>
                </tr>`;
        }).join('');

        wrap.innerHTML = `
            <table class="ch-table">
                <thead>
                    <tr>
                        <th style="width:60px">#</th>
                        <th>نوع</th>
                        <th style="width:130px">کدینگ</th>
                        <th>نام حساب (کل - معین)</th>
                        <th style="width:60px">وضعیت</th>
                        <th style="width:110px">عملیات</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;

        wrap.querySelectorAll('.ch-btn-pick').forEach(btn => {
            btn.addEventListener('click', () => pickHesab(parseInt(btn.dataset.type, 10)));
        });
        wrap.querySelectorAll('.ch-btn-clear').forEach(btn => {
            btn.addEventListener('click', () => clearHesab(parseInt(btn.dataset.type, 10)));
        });
    }

    // ═══════════════════════════════════════════
    //  Pick & Set
    // ═══════════════════════════════════════════
    async function pickHesab(type) {
        const item = _state.items.find(x => x.type === type);
        if (!item) return;

        const picker = window.App.UI.HesabPicker;
        if (!picker) {
            window.App.toast('HesabPicker لود نشده', 'error');
            return;
        }

        const result = await picker.open({
            mode: 'full',
            title: `🏦 انتخاب حساب برای «${item.typeName}»`
        });

        if (!result || result._create) return;

        try {
            await window.App.Http.api('/api/const-hesab/set', {
                method: 'POST',
                body: JSON.stringify({
                    type,
                    codeCol: result.codeCol || 0,
                    codeMoein: result.codeMoein || 0,
                    codeTafzil: result.codeTafzil || 0
                }),
                successMsg: '✅ حساب تنظیم شد'
            });
            await loadList();
        } catch (err) {
            // Http.api خودکار Toast می‌کنه
        }
    }

    // ═══════════════════════════════════════════
    //  Clear
    // ═══════════════════════════════════════════
    async function clearHesab(type) {
        const item = _state.items.find(x => x.type === type);
        if (!item) return;

        const ok = await window.App.confirm(
            `حساب پیش‌فرض «${item.typeName}» پاک شود؟`,
            { danger: true, okText: 'پاک کن' }
        );
        if (!ok) return;

        try {
            await window.App.Http.api(`/api/const-hesab/${type}`, {
                method: 'DELETE',
                successMsg: '🗑️ حساب پاک شد'
            });
            await loadList();
        } catch (err) {
            // Http.api خودکار Toast می‌کنه
        }
    }

    return { render };
})();