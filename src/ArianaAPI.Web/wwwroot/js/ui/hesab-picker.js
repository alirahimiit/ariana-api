/* ═══════════════════════════════════════════════════════════
   UI / HesabPicker v4 — با fullName و codeDisplay
   ═══════════════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.UI = window.App.UI || {};

window.App.UI.HesabPicker = (function () {
    'use strict';
    const H = window.App.Helpers;

    // ─── کش سراسری ───
    const _cache = {
        cols: null,
        moeins: null,
        tafzils: null,
        colNames: null,        // ⭐ Map<codeCol, name>
        loadedAt: 0
    };
    const CACHE_TTL = 5 * 60 * 1000;

    function invalidateCache() {
        _cache.cols = null;
        _cache.moeins = null;
        _cache.tafzils = null;
        _cache.colNames = null;
        _cache.loadedAt = 0;
    }

    // ═══════════════════════════════════════════
    //  Load
    // ═══════════════════════════════════════════
    async function ensureCache() {
        if (_cache.cols && Date.now() - _cache.loadedAt < CACHE_TTL) return;
        const [cols, moeins, tafzils] = await Promise.all([
            window.App.Http.api('/api/hesab/list?level=col').catch(() => []),
            window.App.Http.api('/api/hesab/list?level=moein').catch(() => []),
            window.App.Http.api('/api/hesab/list?level=tafzil').catch(() => [])
        ]);
        _cache.cols = cols || [];
        _cache.moeins = moeins || [];
        _cache.tafzils = tafzils || [];

        // ⭐ Map برای lookup سریع
        _cache.colNames = new Map();
        _cache.cols.forEach(c => _cache.colNames.set(c.codeCol, c.name || ''));

        _cache.loadedAt = Date.now();
    }

    // ═══════════════════════════════════════════
    //  Public API
    // ═══════════════════════════════════════════
    async function open(opts = {}) {
        const cfg = {
            mode: opts.mode || 'moein',       // 'col' | 'moein' | 'tafzil' | 'full'
            codeCol: opts.codeCol || 0,
            allowCreate: opts.allowCreate !== false,
            title: opts.title || '🔍 انتخاب حساب'
        };

        try {
            await ensureCache();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            return null;
        }

        return new Promise((resolve) => {
            const modal = buildModal(cfg);
            document.body.appendChild(modal);

            let _resolved = false;
            const state = {
                mode: cfg.mode === 'full' ? 'moein' : cfg.mode,
                selected: null,
                filter: ''
            };

            const finish = (val) => {
                if (_resolved) return;
                _resolved = true;
                if (modal.__keyHandler) {
                    document.removeEventListener('keydown', modal.__keyHandler, true);
                }
                modal.classList.add('closing');
                setTimeout(() => modal.remove(), 150);
                resolve(val);
            };

            // بستن
            modal.querySelectorAll('[data-hp-close]').forEach(b => b.onclick = () => finish(null));
            modal.onclick = (e) => { if (e.target === modal) finish(null); };

            // تب‌ها
            if (cfg.mode === 'full') {
                const tabs = modal.querySelector('[data-hp-tabs]');
                tabs.hidden = false;
                tabs.querySelectorAll('.hp-tab').forEach(t => {
                    t.onclick = () => {
                        state.mode = t.dataset.mode;
                        state.selected = null;
                        tabs.querySelectorAll('.hp-tab').forEach(x => x.classList.toggle('active', x === t));
                        renderList();
                    };
                });
            }

            // جستجو
            const searchInput = modal.querySelector('.hp-search-input');
            let debounce;
            searchInput.oninput = () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    state.filter = searchInput.value.trim();
                    renderList();
                }, 120);
            };

            // انتخاب
            modal.querySelector('[data-hp-select]').onclick = () => {
                if (state.selected) finish(state.selected);
            };

            // ایجاد
            modal.querySelector('[data-hp-create]').onclick = () => {
                finish({
                    _create: true,
                    keyword: searchInput.value.trim(),
                    mode: state.mode,
                    codeCol: cfg.codeCol
                });
            };

            // ─── Render List ───
            const listWrap = modal.querySelector('[data-hp-list]');

            function renderList() {
                const items = getItems(state, cfg);
                if (items.length === 0) {
                    listWrap.innerHTML = `
                        <div class="hp-empty">
                            <div class="hp-empty-icon">🔍</div>
                            <div class="hp-empty-text">موردی یافت نشد</div>
                            ${state.filter ? '<div class="hp-empty-hint">می‌توانید با دکمه «ایجاد» یکی بسازید</div>' : ''}
                        </div>`;
                } else {
                    listWrap.innerHTML = items.map(it => renderRow(it, state.selected)).join('');
                }

                listWrap.querySelectorAll('.hp-row').forEach(row => {
                    row.onclick = () => {
                        state.selected = JSON.parse(row.dataset.item);
                        renderList();
                    };
                    row.ondblclick = () => {
                        state.selected = JSON.parse(row.dataset.item);
                        finish(state.selected);
                    };
                });

                const selBtn = modal.querySelector('[data-hp-select]');
                selBtn.disabled = !state.selected;

                const createBtn = modal.querySelector('[data-hp-create]');
                const createLabel = modal.querySelector('.hp-create-label');
                const canCreate = cfg.allowCreate && state.filter && state.mode !== 'col';
                createBtn.disabled = !canCreate;
                if (createLabel) createLabel.textContent = canCreate ? `«${state.filter}»` : '';
            }

            renderList();

            // ─── Keyboard ───
            const onKeyDown = (e) => {
                if (!document.body.contains(modal)) {
                    document.removeEventListener('keydown', onKeyDown, true);
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                    finish(null);
                } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); e.stopPropagation();
                    if (state.selected) finish(state.selected);
                    else {
                        const first = listWrap.querySelector('.hp-row');
                        if (first) { state.selected = JSON.parse(first.dataset.item); finish(state.selected); }
                    }
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault(); e.stopPropagation();
                    const rows = Array.from(listWrap.querySelectorAll('.hp-row'));
                    if (!rows.length) return;
                    let idx = rows.findIndex(r => r.classList.contains('focused'));
                    if (idx < 0) idx = e.key === 'ArrowDown' ? -1 : rows.length;
                    idx = Math.max(0, Math.min(rows.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)));
                    rows.forEach(r => r.classList.remove('focused'));
                    rows[idx].classList.add('focused');
                    rows[idx].scrollIntoView({ block: 'nearest' });
                    state.selected = JSON.parse(rows[idx].dataset.item);
                    renderList0nlyUpdate(rows[idx]);
                }
            };
            modal.__keyHandler = onKeyDown;
            document.addEventListener('keydown', onKeyDown, true);

            setTimeout(() => searchInput.focus(), 60);
        });
    }

    function renderList0nlyUpdate(row) {
        document.querySelectorAll('.hp-row.selected').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
    }

    // ═══════════════════════════════════════════
    //  Get Items — با fullName و codeDisplay
    // ═══════════════════════════════════════════
    function getItems(state, cfg) {
        const f = state.filter.toLowerCase();
        const codeCol = cfg.codeCol;

        let list = [];
        if (state.mode === 'col') {
            list = (_cache.cols || []).map(c => {
                const colName = c.name || '';
                return {
                    level: 'col',
                    codeCol: c.codeCol, codeMoein: 0, codeTafzil: 0,
                    name: colName,
                    codeColName: colName,
                    codeMoeinName: '',
                    codeTafzilName: '',
                    fullName: colName,                          // ⭐
                    codeDisplay: String(c.codeCol),             // ⭐
                    hasTafzili: c.hasTafzili, isStock: c.isStock,
                    _searchText: `${c.codeCol} ${colName}`.toLowerCase()
                };
            });
        } else if (state.mode === 'moein') {
            list = (_cache.moeins || [])
                .filter(m => !codeCol || m.codeCol === codeCol)
                .map(m => {
                    const colName = _cache.colNames.get(m.codeCol) || '';
                    const moeinName = m.name || '';
                    const codeStr = `${m.codeCol}-${m.codeMoein}`;
                    const fullName = colName ? `${colName} - ${moeinName}` : moeinName;

                    return {
                        level: 'moein',
                        codeCol: m.codeCol, codeMoein: m.codeMoein, codeTafzil: 0,
                        name: moeinName,
                        parentName: colName,
                        codeColName: colName,
                        codeMoeinName: moeinName,
                        codeTafzilName: '',
                        fullName: fullName,                     // ⭐
                        codeDisplay: codeStr,                   // ⭐
                        hasTafzili: m.hasTafzili, hasTafzili2: m.hasTafzili2, isStock: m.isStock,
                        _searchText: `${m.codeCol} ${m.codeMoein} ${moeinName} ${colName}`.toLowerCase()
                    };
                });
        } else if (state.mode === 'tafzil') {
            list = (_cache.tafzils || []).map(t => {
                const tafzilName = t.name || '';
                return {
                    level: 'tafzil',
                    codeCol: -1, codeMoein: 0, codeTafzil: t.codeTafzil,
                    name: tafzilName,
                    codeColName: '',
                    codeMoeinName: '',
                    codeTafzilName: tafzilName,
                    fullName: tafzilName,                       // ⭐
                    codeDisplay: String(t.codeTafzil),          // ⭐
                    _searchText: `${t.codeTafzil} ${tafzilName}`.toLowerCase()
                };
            });
        }

        if (f) list = list.filter(x => x._searchText.includes(f));
        return list.slice(0, 500);
    }

    // ═══════════════════════════════════════════
    //  Render Row
    // ═══════════════════════════════════════════
    function renderRow(item, selected) {
        const isSel = selected && selected.level === item.level
            && selected.codeCol === item.codeCol
            && selected.codeMoein === item.codeMoein
            && selected.codeTafzil === item.codeTafzil;

        // ⭐ خروجی JSON — همه‌ی فیلدهای مفید
        const dataJson = JSON.stringify({
            level: item.level,
            codeCol: item.codeCol,
            codeMoein: item.codeMoein,
            codeTafzil: item.codeTafzil,
            name: item.name,
            parentName: item.parentName || '',
            codeColName: item.codeColName || '',
            codeMoeinName: item.codeMoeinName || '',
            codeTafzilName: item.codeTafzilName || '',
            fullName: item.fullName || item.name || '',       // ⭐
            codeDisplay: item.codeDisplay || '',               // ⭐
            isStock: item.isStock || false,
            hasTafzili: item.hasTafzili || false,
            hasTafzili2: item.hasTafzili2 || false
        });

        return `
            <div class="hp-row ${isSel ? 'selected' : ''}" data-item='${dataJson}'>
                <span class="hp-code">${item.codeDisplay}</span>
                <div class="hp-name">
                    <div>${H.esc(item.name || '')}</div>
                    ${item.parentName ? `<div class="hp-sub">${H.esc(item.parentName)}</div>` : ''}
                </div>
                <div class="hp-badges">
                    ${item.hasTafzili ? '<span class="hp-badge hp-badge-tafzil">تفصیلی ۱</span>' : ''}
                    ${item.hasTafzili2 ? '<span class="hp-badge hp-badge-tafzil2">تفصیلی ۲</span>' : ''}
                    ${item.isStock ? '<span class="hp-badge hp-badge-stock">انبار</span>' : ''}
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════════
    //  Build Modal
    // ═══════════════════════════════════════════
    function buildModal(cfg) {
        const el = document.createElement('div');
        el.className = 'hp-overlay';
        el.innerHTML = `
            <div class="hp-box">
                <div class="hp-header">
                    <div class="hp-title">${cfg.title}</div>
                    <button type="button" class="hp-close" data-hp-close>✕</button>
                </div>
                <div class="hp-search">
                    <input type="text" class="hp-search-input" placeholder="جستجو (کد یا نام)..." autocomplete="off">
                    <div class="hp-kbd-hint"><kbd>↑↓</kbd> حرکت • <kbd>Enter</kbd> انتخاب • <kbd>Esc</kbd> بستن</div>
                </div>
                <div class="hp-tabs" data-hp-tabs hidden>
                    <button type="button" class="hp-tab" data-mode="col">کل</button>
                    <button type="button" class="hp-tab active" data-mode="moein">معین</button>
                    <button type="button" class="hp-tab" data-mode="tafzil">تفضیلی</button>
                </div>
                <div class="hp-list" data-hp-list></div>
                <div class="hp-footer">
                    <button type="button" class="btn btn-ghost hp-create-btn" data-hp-create disabled>
                        ➕ ایجاد <span class="hp-create-label"></span>
                    </button>
                    <div class="hp-footer-actions">
                        <button type="button" class="btn btn-primary" data-hp-select disabled>✓ انتخاب</button>
                        <button type="button" class="btn btn-ghost" data-hp-close>انصراف</button>
                    </div>
                </div>
            </div>`;
        return el;
    }

    return { open, invalidateCache };
})();