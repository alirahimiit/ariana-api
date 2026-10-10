/* ═══════════════════════════════════════════════════
   Feature / SanadForm — فرم ثبت/ویرایش سند
   نسخه 2.1 — با رفع چیدمان + کلیدهای میان‌بر
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.SanadForm = (function () {
    'use strict';

    const H = window.App.Helpers;
    // ⭐ Helper امن برای Toast
    function _toast(message, type = 'info') {
        try {
            if (window.App && typeof window.App.toast === 'function') {
                window.App.toast(message, type);
                return;
            }
        } catch (e) {
            console.error('[Toast Error]', e, message);
        }
        console.log('[' + type.toUpperCase() + ']', message);
    }

    // ⭐⭐ Fallback هوشمند برای confirm
    async function _askConfirm(message, options) {
        try {
            if (window.App && typeof window.App.confirm === 'function') {
                return await window.App.confirm(message, options);
            }
        } catch (err) {
            console.warn('[Confirm] UI جدید خطا داد، از native استفاده می‌شود:', err);
        }
        // Fallback به native
        return window.confirm(message);
    }

    let _state = {
        isEdit: false,
        parentSanadId: null,
        items: [],
        focusedIdx: 0,
        dirty: false
    };
    let _cache = { cols: [], moeins: [], tafzils: [], loaded: false };
    let _clipboard = [];

    // ═══ UTILS ═══
    function today() {
        try {
            const fmt = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
                year: 'numeric', month: '2-digit', day: '2-digit'
            });
            const p = fmt.formatToParts(new Date());
            const y = p.find(x => x.type === 'year').value;
            const m = p.find(x => x.type === 'month').value;
            const d = p.find(x => x.type === 'day').value;
            return `${y}/${m}/${d}`;
        } catch { return ''; }
    }

    function emptyRow() {
        return {
            codeCol: 0, codeMoein: 0, codeTafzil: 0, codeTafzili2: 0,
            tafzili2Id: 0, codeSharh: 0, otherSharh: '', mabBed: 0, mabBes: 0, meghdar: 0
        };
    }

    function normalizeDigits(s) {
        return String(s)
            .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
            .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    }

    function parseNum(v) {
        if (v === null || v === undefined || v === '') return 0;
        let s = normalizeDigits(v);
        s = s.replace(/[٫،]/g, '.');
        s = s.replace(/[٬,]/g, '');
        s = s.replace(/[^\d.\-]/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    // ⭐ فرمت مبلغ — با نرمال‌سازی ارقام فارسی (رفع باگ تایپ)
    function applyMoneyFormat(input) {
        const oldVal = input.value;
        if (!oldVal) return;

        // نرمال‌سازی ارقام فارسی/عربی → لاتین (طول کاراکتر حفظ می‌شه)
        const normalized = normalizeDigits(oldVal);

        const cursorPos = input.selectionStart;
        const beforeCursor = normalized.substring(0, cursorPos);
        const digitsBefore = (beforeCursor.match(/\d/g) || []).length;

        const digits = normalized.replace(/\D/g, '');
        if (!digits) { input.value = ''; return; }

        const num = parseInt(digits, 10);
        const formatted = num.toLocaleString('en-US');

        if (input.value === formatted) return;
        input.value = formatted;

        if (digitsBefore === 0) { input.setSelectionRange(0, 0); return; }

        let digitCount = 0, newPos = formatted.length;
        for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
                digitCount++;
                if (digitCount === digitsBefore) { newPos = i + 1; break; }
            }
        }
        try { input.setSelectionRange(newPos, newPos); } catch { }
    }

    function cloneItem(it) { return JSON.parse(JSON.stringify(it)); }

    // ═══ LOOKUPS ═══
    async function ensureLookups() {
        if (_cache.loaded) return;
        try {
            const [tree, tafResp] = await Promise.all([
                window.App.Http.api('/api/hesab/tree'),
                window.App.Http.api('/api/tafzili/list', {
                    method: 'POST',
                    body: JSON.stringify({ page: 1, pageSize: 100000, mandehFilter: 'all' })
                }).catch(() => ({ items: [] }))
            ]);
            _cache.cols = (tree || []).filter(x => x.level === 'col').sort((a, b) => a.codeCol - b.codeCol);
            _cache.moeins = (tree || []).filter(x => x.level === 'moein').sort((a, b) => a.codeMoein - b.codeMoein);
            _cache.tafzils = (tafResp?.items || []).map(t => ({ code: parseInt(t.codeTafzil), name: t.name }));
            _cache.loaded = true;
        } catch (err) { console.error('Lookup load failed:', err); }
    }

    function moeinsOfCol(codeCol) {
        return _cache.moeins.filter(m => m.codeCol === codeCol);
    }

    function findTafzilName(code) {
        if (!code) return '';
        const list = _cache.tafzils || [];
        const t = list.find(x => x.code === parseInt(code));
        return t ? t.name : '';
    }

    async function ensureTafzili2Lookup() {
        if (_cache.tafzils2 !== undefined) return _cache.tafzils2;
        try {
            const resp = await window.App.Http.api('/api/tafzili2/list', {
                method: 'POST',
                body: JSON.stringify({ page: 1, pageSize: 100000 })
            });
            _cache.tafzils2 = (resp?.items || resp || []).map(t => ({
                code: parseInt(t.code || t.Code || 0),
                name: t.name || t.Name || ''
            }));
        } catch {
            _cache.tafzils2 = [];
        }
        return _cache.tafzils2;
    }

    // ═══ OPEN ═══
    async function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(101)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        _state = { isEdit: false, parentSanadId: null, items: [emptyRow()], focusedIdx: 0 };
        _clipboard = [];
        await ensureLookups();
        const body = buildFormHtml({
            noSanad: '', dateIn: today(), otherParentSharh: '', vazeit: 0, kindSanad: 0
        });
        window.App.openModal('➕ سند جدید', body);
        document.querySelector('.modal-box')?.classList.add('wide-modal');
        bindEvents();
        renderRows();
        focusRow(0, 'bed');   // ⭐
    }

    async function openEdit(id) {
        if (window.App.Permissions && !window.App.Permissions.can(102)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        try {
            const vRes = await window.App.Http.api(`/api/sanad/${id}/vazeit`);
            if (vRes?.vazeit === 2) { window.App.toast('سند قطعی قابل ویرایش نیست', 'error'); return; }
            await ensureLookups();
            const [detail, items] = await Promise.all([
                window.App.Http.api(`/api/sanad/${id}`),
                window.App.Http.api(`/api/sanad/${id}/items`)
            ]);
            _state = {
                isEdit: true, parentSanadId: id, focusedIdx: 0,
                items: (items || []).map(it => ({
                    codeCol: it.code_Col || 0,
                    codeMoein: it.code_Moein || 0,
                    codeTafzil: it.code_Tafzil || 0,
                    codeTafzili2: it.code_Tafzili2 || 0,
                    tafzili2Id: it.tafzili2ID || 0,
                    codeSharh: it.code_Sharh || 0,
                    otherSharh: it.otherSharh || '',
                    mabBed: it.mabBed || 0,
                    mabBes: it.mabBes || 0,
                    meghdar: Math.abs(it.meghdar || 0)
                }))
            };
            _clipboard = [];
            if (_state.items.length === 0) _state.items = [emptyRow()];
            const body = buildFormHtml({
                noSanad: detail?.noSanad || '',
                dateIn: detail?.dateIn || '',
                otherParentSharh: detail?.otherParentSharh || '',
                vazeit: detail?.vazeit || 0,
                kindSanad: detail?.kindSanad || 0
            });
            window.App.openModal('✏️ ویرایش سند شماره ' + (detail?.noSanad || ''), body);
            document.querySelector('.modal-box')?.classList.add('wide-modal');
            bindEvents();
            renderRows();
            focusRow(0, 'bed');   // ⭐
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══ BUILD FORM — ساختار تمیز ═══
    function buildFormHtml(h) {
        const vazeitOpts = [
            { v: 0, t: 'پیش‌نویس' }, { v: 1, t: 'رسیدگی' }, { v: 2, t: 'قطعی' }
        ].map(o => `<option value="${o.v}" ${h.vazeit === o.v ? 'selected' : ''}>${o.t}</option>`).join('');

        const kindOpts = [
            { v: 0, t: 'عادی' }, { v: 1, t: 'افتتاحیه' }, { v: 2, t: 'اختتامیه' },
            { v: 3, t: 'انبار' }, { v: 4, t: 'حقوق' }, { v: 5, t: 'اموال' },
            { v: 6, t: 'فروش' }, { v: 7, t: 'انتقالی' }, { v: 8, t: 'خاص' }
        ].map(o => `<option value="${o.v}" ${h.kindSanad === o.v ? 'selected' : ''}>${o.t}</option>`).join('');

        return `
            <div class="sanad-form">
                <div class="sanad-form-header">
                    <div class="sf-field">
                        <label>شماره سند</label>
                        <input type="text" id="sfNoSanad" value="${H.esc(h.noSanad)}" ${_state.isEdit ? 'readonly' : ''} placeholder="خودکار">
                    </div>
                    <div class="sf-field">
                        <label>تاریخ <span class="req">*</span></label>
                        <input type="text" id="sfDateIn" value="${H.esc(h.dateIn)}" placeholder="1404/01/01">
                    </div>
                    <div class="sf-field">
                        <label>نوع سند</label>
                        <select id="sfKindSanad">${kindOpts}</select>
                    </div>
                    <div class="sf-field">
                        <label>وضعیت</label>
                        <select id="sfVazeit">${vazeitOpts}</select>
                    </div>
                    <div class="sf-field sf-field-wide">
                        <label>شرح سند</label>
                        <input type="text" id="sfParentSharh" value="${H.esc(h.otherParentSharh)}" placeholder="شرح کلی سند">
                    </div>
                    <button type="button" class="sf-help-btn" id="sfHelpBtn" title="راهنمای کلیدهای میان‌بر">⌨️</button>
                </div>

                <div class="sanad-form-rows-header">
                    <h4>📋 ردیف‌های سند</h4>
                    <div class="sf-row-actions">
                        <button type="button" class="btn btn-ghost btn-sm" id="sfCopyBtn" title="کپی (Ctrl+F9)">📋</button>
                        <button type="button" class="btn btn-ghost btn-sm" id="sfPasteBtn" title="چسباندن (Ctrl+F10)">📥</button>
                        <button type="button" class="btn btn-primary btn-sm" id="sfAddRow" title="افزودن (Insert)">➕ افزودن ردیف</button>
                    </div>
                </div>

                <div id="sfRowsWrap"></div>

                <div class="sanad-form-sticky">
                    <div class="sanad-form-totals" id="sfTotals"></div>
                    <div class="sanad-form-footer">
                        <button type="button" class="btn btn-primary" id="sfSaveBtn">💾 ذخیره <span class="kbd-hint">Ctrl+Enter</span></button>
                        <button type="button" class="btn btn-ghost" id="sfCancelBtn">انصراف <span class="kbd-hint">Esc</span></button>
                        <span class="sanad-row-count" id="sfRowCount"></span>
                    </div>
                </div>
            </div>`;
    }
    // ═══ RENDER ROWS ═══
    function renderRows() {
        const wrap = document.getElementById('sfRowsWrap');
        if (!wrap) return;
        wrap.innerHTML = _state.items.map((it, i) => buildRowHtml(it, i)).join('');
        recalcTotals();
        updateRowCount();       // ⭐ یکسان‌سازی
        updateFocusedRow();
        updatePasteBtnState();
    }

    function buildRowHtml(item, idx) {
        const colOpts = ['<option value="0">-- کل --</option>']
            .concat(_cache.cols.map(c => `<option value="${c.codeCol}" ${item.codeCol === c.codeCol ? 'selected' : ''}>${c.codeCol} - ${H.esc(c.name)}</option>`)).join('');

        const bed = Number(item.mabBed) || 0;
        const bes = Number(item.mabBes) || 0;
        const megh = Number(item.meghdar) || 0;
        const tafzilName = item.codeTafzil ? findTafzilName(item.codeTafzil) : '';
        const currentMoein = item.codeMoein
            ? (_cache.moeins.find(m => m.codeCol === item.codeCol && m.codeMoein === item.codeMoein) || null)
            : null;

        const canTafzil1 = !currentMoein || currentMoein.hasTafzili;
        const canTafzil2 = !currentMoein || currentMoein.hasTafzili2;
        const isStock = currentMoein?.isStock === true;

        const bedStr = bed ? bed.toLocaleString('en-US') : '';
        const besStr = bes ? bes.toLocaleString('en-US') : '';
        const meghStr = megh ? parseFloat(Number(megh).toFixed(4)).toString() : '';

        return `
            <div class="sf-row ${idx === _state.focusedIdx ? 'sf-row-focused' : ''}" data-row-idx="${idx}">
                <div class="sf-row-num">${idx + 1}</div>
                <div class="sf-row-body">
                    <div class="sf-line sf-line-codes">
                        <div class="sf-field">
                            <label>کد کل</label>
                            <select class="sf-col" data-idx="${idx}">${colOpts}</select>
                        </div>
                        <div class="sf-field">
                            <label>کد معین</label>
                            <div class="sf-input-with-btn">
                                <input type="text" class="sf-moein-text" data-idx="${idx}"
                                       value="${item.codeMoein ? item.codeMoein + (currentMoein ? ' - ' + H.esc(currentMoein.name) : '') : ''}"
                                       placeholder="🔍" readonly style="cursor:pointer; background:#F9FAFB;">
                                <button type="button" class="sf-pick-btn" data-idx="${idx}" data-pick="moein" title="انتخاب معین">🔍</button>
                            </div>
                        </div>
                        <div class="sf-field">
                            <label>تفصیلی ۱</label>
                            <div class="sf-input-with-btn">
                                <input type="number" class="sf-tafzil num-input" data-idx="${idx}"
                                       value="${item.codeTafzil || ''}" placeholder="کد"
                                       ${canTafzil1 ? '' : 'disabled'}>
                                ${canTafzil1 ? `<button type="button" class="sf-pick-btn" data-idx="${idx}" data-pick="tafzil">🔍</button>` : ''}
                            </div>
                        </div>
                        <div class="sf-field">
                            <label>تفصیلی ۲</label>
                            <div class="sf-input-with-btn">
                                <input type="number" class="sf-tafzil2 num-input" data-idx="${idx}"
                                       value="${item.codeTafzili2 || ''}" placeholder="کد"
                                       ${canTafzil2 ? '' : 'disabled'}>
                                ${canTafzil2 ? `<button type="button" class="sf-pick-btn" data-idx="${idx}" data-pick="tafzil2">🔍</button>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="sf-line sf-line-values">
                        <div class="sf-field sf-field-money">
                            <label>بدهکار</label>
                            <input type="text" inputmode="numeric" class="sf-bed num-input" data-idx="${idx}"
                                   value="${bedStr}" placeholder="0">
                        </div>
                        <div class="sf-field sf-field-money">
                            <label>بستانکار</label>
                            <input type="text" inputmode="numeric" class="sf-bes num-input" data-idx="${idx}"
                                   value="${besStr}" placeholder="0">
                        </div>
                        <div class="sf-field sf-field-meghdar">
                            <label>مقدار ${isStock ? '<span class="sf-hint sf-stock-req">*</span>' : ''}</label>
                            <input type="text" inputmode="decimal" class="sf-meghdar num-input ${isStock ? 'sf-required-stock' : ''}" data-idx="${idx}"
                                   value="${meghStr}" placeholder="${isStock ? 'اجباری' : '0'}"
                                   ${isStock ? '' : 'disabled'}>
                        </div>
                        <div class="sf-field sf-field-sharh">
                            <label>شرح ردیف</label>
                            <input type="text" class="sf-sharh" data-idx="${idx}" value="${H.esc(item.otherSharh || '')}" placeholder="شرح ردیف">
                        </div>

                        <div class="sf-row-tools">
                            <button type="button" class="sf-row-tool" data-idx="${idx}" data-action="up" title="بالا (F6)">▲</button>
                            <button type="button" class="sf-row-tool" data-idx="${idx}" data-action="down" title="پایین (Ctrl+F6)">▼</button>
                            <button type="button" class="sf-row-tool" data-idx="${idx}" data-action="swap" title="جابجایی (F7)">⇅</button>
                            <button type="button" class="sf-row-tool" data-idx="${idx}" data-action="dup" title="تکثیر">⧉</button>
                            <button type="button" class="sf-row-tool sf-row-del" data-idx="${idx}" data-action="del" title="حذف (Ctrl+Del)">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }
    // ═══ FOCUS ═══
    function focusRow(idx, fieldClass) {
        if (idx < 0 || idx >= _state.items.length) return;
        _state.focusedIdx = idx;
        updateFocusedRow();

        const targetClass = fieldClass || 'bed';   // ⭐ پیش‌فرض bed

        setTimeout(() => {
            const wrap = document.getElementById('sfRowsWrap');
            if (!wrap) return;
            const row = wrap.querySelector(`.sf-row[data-row-idx="${idx}"]`);
            if (!row) return;
            const el = row.querySelector(`.sf-${targetClass}[data-idx="${idx}"]`);
            if (el) {
                el.focus();
                if (el.select && el.tagName === 'INPUT') el.select();
            }
        }, 0);
    }

    function updateFocusedRow() {
        document.querySelectorAll('.sf-row').forEach(el => {
            const i = parseInt(el.dataset.rowIdx);
            el.classList.toggle('sf-row-focused', i === _state.focusedIdx);
        });
    }

    function getFocusedRowIdx() {
        const active = document.activeElement;
        if (active && active.dataset && active.dataset.idx !== undefined) {
            const i = parseInt(active.dataset.idx);
            if (!isNaN(i)) return i;
        }
        return _state.focusedIdx;
    }

    // ═══ SCROLL ═══
    function getScrollContainer() {
        return document.getElementById('modalBody');
    }

    function scrollToRow(idx) {
        setTimeout(() => {
            const row = document.querySelector(`.sf-row[data-row-idx="${idx}"]`);
            if (!row) return;

            // اگه آخرین ردیف → به ته فرم
            const isLast = idx === _state.items.length - 1;

            // روش ۱: scrollIntoView (بهترین — خودش container رو پیدا می‌کنه)
            try {
                row.scrollIntoView({
                    behavior: 'smooth',
                    block: isLast ? 'end' : 'center'
                });
            } catch {
                // fallback
                const scroller = document.getElementById('modalBody');
                if (scroller) {
                    scroller.scrollTop = isLast
                        ? scroller.scrollHeight
                        : row.offsetTop - 100;
                }
            }
        }, 100);
    }
    // ═══ ROW OPS ═══
    function moveRowUp(idx) {
        if (idx <= 0) { window.App.toast('ردیف اول قابل جابجایی نیست', 'info'); return; }
        const items = _state.items;
        [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];

        const wrap = document.getElementById('sfRowsWrap');
        const rows = [...wrap.querySelectorAll(':scope > .sf-row')];
        // ردیف idx رو قبل از ردیف idx-1 بذار
        wrap.insertBefore(rows[idx], rows[idx - 1]);

        reindexRowsDOM();
        _state.focusedIdx = idx - 1;
        _state.dirty = true;
        updateFocusedRow();

        setTimeout(() => {
            const newRow = wrap.querySelector(`.sf-row[data-row-idx="${idx - 1}"]`);
            newRow?.querySelector('.sf-bed')?.focus();
        }, 30);
    }

    function moveRowDown(idx) {
        if (idx >= _state.items.length - 1) { window.App.toast('ردیف آخر قابل جابجایی نیست', 'info'); return; }
        const items = _state.items;
        [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];

        const wrap = document.getElementById('sfRowsWrap');
        const rows = [...wrap.querySelectorAll(':scope > .sf-row')];
        // ردیف idx+1 رو قبل از ردیف idx بذار
        wrap.insertBefore(rows[idx + 1], rows[idx]);

        reindexRowsDOM();
        _state.focusedIdx = idx + 1;
        _state.dirty = true;
        updateFocusedRow();

        setTimeout(() => {
            const newRow = wrap.querySelector(`.sf-row[data-row-idx="${idx + 1}"]`);
            newRow?.querySelector('.sf-bed')?.focus();
        }, 30);
    }
    // ⭐ reindex بدون re-render
    function reindexRowsDOM() {
        const wrap = document.getElementById('sfRowsWrap');
        if (!wrap) return;
        const rows = wrap.querySelectorAll(':scope > .sf-row');
        rows.forEach((row, i) => {
            row.dataset.rowIdx = i;
            const num = row.querySelector('.sf-row-num');
            if (num) num.textContent = i + 1;
            row.querySelectorAll('[data-idx]').forEach(el => { el.dataset.idx = i; });
        });
    }

    function swapBedBes(idx) {
        const it = _state.items[idx];
        if (!it) return;
        [it.mabBed, it.mabBes] = [it.mabBes, it.mabBed];

        // ⭐ آپدیت مستقیم DOM
        const wrap = document.getElementById('sfRowsWrap');
        const bedInput = wrap?.querySelector(`.sf-bed[data-idx="${idx}"]`);
        const besInput = wrap?.querySelector(`.sf-bes[data-idx="${idx}"]`);
        if (bedInput) bedInput.value = it.mabBed ? it.mabBed.toLocaleString('en-US') : '';
        if (besInput) besInput.value = it.mabBes ? it.mabBes.toLocaleString('en-US') : '';

        _state.dirty = true;
        recalcTotals();
        window.App.toast('بدهکار و بستانکار جابجا شد', 'success');
    }

    function duplicateRow(idx) {
        const it = _state.items[idx];
        if (!it) return;
        const newItem = cloneItem(it);
        _state.items.splice(idx + 1, 0, newItem);

        const wrap = document.getElementById('sfRowsWrap');
        const rows = [...wrap.querySelectorAll(':scope > .sf-row')];
        const temp = document.createElement('div');
        temp.innerHTML = buildRowHtml(newItem, idx + 1);
        const newNode = temp.firstElementChild;

        if (rows[idx + 1]) wrap.insertBefore(newNode, rows[idx + 1]);
        else wrap.appendChild(newNode);

        reindexRowsDOM();
        _state.focusedIdx = idx + 1;
        _state.dirty = true;
        updateFocusedRow();
        updateRowCount();

        setTimeout(() => {
            newNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            newNode.querySelector('.sf-bed')?.focus();
        }, 80);
    }

    function deleteRowAt(idx) {
        if (_state.items.length === 1) {
            window.App.toast('حداقل یک ردیف باید باشد', 'warn');
            return;
        }
        _state.items.splice(idx, 1);

        const wrap = document.getElementById('sfRowsWrap');
        const rows = wrap.querySelectorAll(':scope > .sf-row');
        if (rows[idx]) rows[idx].remove();

        reindexRowsDOM();
        const newIdx = Math.min(idx, _state.items.length - 1);
        _state.focusedIdx = newIdx;
        _state.dirty = true;
        updateFocusedRow();
        updateRowCount();

        setTimeout(() => {
            const row = wrap.querySelector(`.sf-row[data-row-idx="${newIdx}"]`);
            row?.querySelector('.sf-bed')?.focus();
        }, 30);
    }

    function addRowAt(idx) {
        const newItem = emptyRow();
        _state.items.splice(idx + 1, 0, newItem);

        const wrap = document.getElementById('sfRowsWrap');
        const rows = [...wrap.querySelectorAll(':scope > .sf-row')];
        const temp = document.createElement('div');
        temp.innerHTML = buildRowHtml(newItem, idx + 1);
        const newNode = temp.firstElementChild;

        if (rows[idx + 1]) wrap.insertBefore(newNode, rows[idx + 1]);
        else wrap.appendChild(newNode);

        reindexRowsDOM();
        _state.focusedIdx = idx + 1;
        _state.dirty = true;
        updateFocusedRow();
        updateRowCount();

        setTimeout(() => {
            const scroller = document.getElementById('modalBody');
            if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
            newNode.querySelector('.sf-bed')?.focus();
        }, 100);
    }

    function pasteRows() {
        if (_clipboard.length === 0) { window.App.toast('بافر خالی است', 'warn'); return; }
        const idx = getFocusedRowIdx();
        const newItems = _clipboard.map(cloneItem);

        const wrap = document.getElementById('sfRowsWrap');
        const rows = [...wrap.querySelectorAll(':scope > .sf-row')];

        // ⭐ درج به‌ترتیب — با tracking آخرین گره درج‌شده
        let insertAfterNode = rows[idx] || null;

        newItems.forEach((it, k) => {
            _state.items.splice(idx + 1 + k, 0, it);
            const temp = document.createElement('div');
            temp.innerHTML = buildRowHtml(it, idx + 1 + k);
            const newNode = temp.firstElementChild;

            if (insertAfterNode && insertAfterNode.nextSibling) {
                wrap.insertBefore(newNode, insertAfterNode.nextSibling);
            } else {
                wrap.appendChild(newNode);
            }
            insertAfterNode = newNode;   // ⭐ برای تکرار بعدی
        });

        reindexRowsDOM();
        _state.focusedIdx = idx + newItems.length;
        _state.dirty = true;
        updateFocusedRow();
        updateRowCount();

        setTimeout(() => {
            const targetRow = wrap.querySelector(`.sf-row[data-row-idx="${idx + newItems.length}"]`);
            targetRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRow?.querySelector('.sf-bed')?.focus();
        }, 100);

        window.App.toast(`${newItems.length} ردیف چسبانده شد`, 'success');
    }

    function updateRowCount() {
        const counter = document.getElementById('sfRowCount');
        if (counter) counter.textContent = `(${_state.items.length} ردیف)`;
    }

    function updatePasteBtnState() {
        const btn = document.getElementById('sfPasteBtn');
        if (btn) {
            btn.disabled = _clipboard.length === 0;
            btn.title = _clipboard.length > 0
                ? `چسباندن ${_clipboard.length} ردیف (Ctrl+F10)`
                : 'بافر خالی است';
        }
    }

    function jumpToLastRow() {
        const lastIdx = _state.items.length - 1;
        _state.focusedIdx = lastIdx;
        updateFocusedRow();
        const wrap = document.getElementById('sfRowsWrap');
        const row = wrap?.querySelector(`.sf-row[data-row-idx="${lastIdx}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'end' });
            setTimeout(() => {
                row.querySelector('.sf-bed')?.focus();   // ⭐ bed نه col
            }, 300);
        }
    }

    function jumpToFirstRow() {
        _state.focusedIdx = 0;
        updateFocusedRow();
        const wrap = document.getElementById('sfRowsWrap');
        const row = wrap?.querySelector(`.sf-row[data-row-idx="0"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => {
                row.querySelector('.sf-bed')?.focus();   // ⭐ bed نه col
            }, 300);
        }
    }


    // ═══ COPY / PASTE ═══
    function copyRows() {
        const idx = getFocusedRowIdx();
        const it = _state.items[idx];
        if (!it) { window.App.toast('ردیفی برای کپی نیست', 'warn'); return; }
        _clipboard = [cloneItem(it)];
        window.App.toast('1 ردیف کپی شد', 'success');
        updatePasteBtnState();
    }



    // ═══ KEYBOARD ═══
    let _keyHandler = null;

async function handleGlobalKey(e) {
    const active = document.activeElement;
    const isOnInput = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'SELECT' ||
        active.tagName === 'TEXTAREA'
    );
    const isOnBedOrBes = active && (
        active.classList.contains('sf-bed') ||
        active.classList.contains('sf-bes')
    );

    const isArrowUp = e.key === 'ArrowUp' || e.keyCode === 38;
    const isArrowDown = e.key === 'ArrowDown' || e.keyCode === 40;
    const isHome = e.key === 'Home' || e.keyCode === 36;
    const isEnd = e.key === 'End' || e.keyCode === 35;
    const isF6 = e.key === 'F6' || e.code === 'F6' || e.keyCode === 117;

    // ⭐⭐⭐ Arrow Up/Down خالی روی فیلد بدهکار/بستانکار خالی → پیمایش ردیف
    if (isOnBedOrBes && (isArrowUp || isArrowDown) &&
        !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const isEmpty = (active.value || '').trim() === '' || active.value === '0';
        if (isEmpty) {
            e.preventDefault();
            e.stopPropagation();
            const cur = getFocusedRowIdx();
            if (isArrowUp && cur > 0) {
                focusRow(cur - 1, 'bed');
            } else if (isArrowDown && cur < _state.items.length - 1) {
                focusRow(cur + 1, 'bed');
            }
            return;
        }
    }

    // ⭐ Ctrl+Home / Alt+↑ → اولین ردیف
    if ((e.ctrlKey && isHome) || (e.altKey && isArrowUp)) {
        e.preventDefault();
        focusRow(0, 'bed');
        const row = document.querySelector('.sf-row[data-row-idx="0"]');
        row?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    // ⭐ Ctrl+End / Alt+↓ → آخرین ردیف
    if ((e.ctrlKey && isEnd) || (e.altKey && isArrowDown)) {
        e.preventDefault();
        const last = _state.items.length - 1;
        focusRow(last, 'bed');
        const row = document.querySelector(`.sf-row[data-row-idx="${last}"]`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        return;
    }

    // F6 → انتقال به بالا
    if (isF6 && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault(); e.stopPropagation();
        moveRowUp(getFocusedRowIdx());
        return;
    }
    // Ctrl+F6 → انتقال به پایین
    if (isF6 && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault(); e.stopPropagation();
        moveRowDown(getFocusedRowIdx());
        return;
    }
    // F7 → swap bed/bes
    if (e.key === 'F7' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault(); e.stopPropagation();
        swapBedBes(getFocusedRowIdx());
        return;
    }
    // Ctrl+F9 → کپی
    if (e.key === 'F9' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault(); copyRows(); return;
    }
    // Ctrl+F10 → پیست
    if (e.key === 'F10' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault(); pasteRows(); return;
    }
    // Insert → افزودن ردیف
    if (e.key === 'Insert' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault(); addRowAt(getFocusedRowIdx()); return;
    }
    // Ctrl+Delete → حذف ردیف
     if (e.key === 'Delete' && e.ctrlKey) {
        e.preventDefault();
         const ok = await _askConfirm('این ردیف حذف شود؟', {
             title: 'حذف ردیف',
             danger: true,
             okText: 'حذف کن'
         });
        if (ok) deleteRowAt(getFocusedRowIdx());
        return;
    }
    // Ctrl+S / Ctrl+Enter → ذخیره
    if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.key === 'Enter')) {
        e.preventDefault(); save(); return;
    }
    // Escape → تأیید خروج
    if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
    }
}
    // ═══ BIND ═══
  function bindEvents() {
    const mb = document.getElementById('modalBody');
      if (!mb) return;

      _state.dirty = false;

    document.getElementById('sfAddRow')?.addEventListener('click', () => {
        addRowAt(_state.items.length - 1);
    });
    document.getElementById('sfSaveBtn')?.addEventListener('click', save);
    document.getElementById('sfCancelBtn')?.addEventListener('click', handleClose);  // ⭐
    document.getElementById('sfCopyBtn')?.addEventListener('click', copyRows);
    document.getElementById('sfPasteBtn')?.addEventListener('click', pasteRows);
    document.getElementById('sfHelpBtn')?.addEventListener('click', toggleHelpPanel);

    mb.addEventListener('change', onFieldChange);
    mb.addEventListener('input', onFieldInput);
    mb.addEventListener('click', onRowClick);
    mb.addEventListener('focusin', onRowFocus);

    if (_keyHandler) document.removeEventListener('keydown', _keyHandler, true);
    _keyHandler = handleGlobalKey;
    document.addEventListener('keydown', _keyHandler, true);
   }

  function onRowFocus(e) {
        const t = e.target;
        if (t && t.dataset && t.dataset.idx !== undefined) {
            const idx = parseInt(t.dataset.idx);
            if (!isNaN(idx)) {
                _state.focusedIdx = idx;
                updateFocusedRow();
            }
        }
    }


  function onFieldInput(e) {
        
        const t = e.target;
        const idx = parseInt(t.dataset.idx);
        if (isNaN(idx)) return;
        _state.dirty = true;
        if (t.classList.contains('sf-sharh')) {
            _state.items[idx].otherSharh = t.value;

        } else if (t.classList.contains('sf-bed')) {
            applyMoneyFormat(t);
            const v = parseNum(t.value);
            _state.items[idx].mabBed = v;
            if (v > 0) {
                _state.items[idx].mabBes = 0;
                const besInput = document.querySelector(`.sf-bes[data-idx="${idx}"]`);
                if (besInput) besInput.value = '';
            }
            recalcTotals();

        } else if (t.classList.contains('sf-bes')) {
            applyMoneyFormat(t);
            const v = parseNum(t.value);
            _state.items[idx].mabBes = v;
            if (v > 0) {
                _state.items[idx].mabBed = 0;
                const bedInput = document.querySelector(`.sf-bed[data-idx="${idx}"]`);
                if (bedInput) bedInput.value = '';
            }
            recalcTotals();

        } else if (t.classList.contains('sf-meghdar')) {
            const curPos = t.selectionStart;
            let raw = normalizeDigits(t.value)
                .replace(/[٫،]/g, '.')
                .replace(/[^\d.]/g, '');

            const parts = raw.split('.');
            if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');

            const fp = raw.split('.');
            const intPart = fp[0].slice(0, 8);
            const decPart = fp.length > 1 ? fp[1].slice(0, 4) : null;
            const newVal = intPart + (decPart !== null ? '.' + decPart : '');

            if (t.value !== newVal) {
                t.value = newVal;
                const newPos = Math.min(curPos, newVal.length);
                try { t.setSelectionRange(newPos, newPos); } catch { }
            }

            _state.items[idx].meghdar = parseNum(newVal) || 0;
        }
    }

    function onFieldChange(e) {
        const t = e.target;
        const idx = parseInt(t.dataset.idx);
        if (isNaN(idx)) return;
        _state.dirty = true;

        if (t.classList.contains('sf-col')) {
            _state.items[idx].codeCol = parseInt(t.value) || 0;
            _state.items[idx].codeMoein = 0;
            _state.items[idx].codeTafzil = 0;
            _state.items[idx].codeTafzili2 = 0;

            // ⭐ فقط همین ردیف رو آپدیت کن — بدون re-render کل
            const wrap = document.getElementById('sfRowsWrap');
            const row = wrap?.querySelector(`.sf-row[data-row-idx="${idx}"]`);
            if (row) {
                const moeinText = row.querySelector('.sf-moein-text');
                if (moeinText) moeinText.value = '';
                const tafzil = row.querySelector('.sf-tafzil');
                if (tafzil) tafzil.value = '';
                const tafzili2 = row.querySelector('.sf-tafzil2');
                if (tafzili2) tafzili2.value = '';
            }
        } else if (t.classList.contains('sf-tafzil2')) {
            _state.items[idx].codeTafzili2 = parseInt(t.value) || 0;
        } else if (t.classList.contains('sf-tafzil')) {
            _state.items[idx].codeTafzil = parseInt(t.value) || 0;
        }
    }

 async function onRowClick(e) {
        const tool = e.target.closest('.sf-row-tool');
        if (tool) {
            const idx = parseInt(tool.dataset.idx);
            const action = tool.dataset.action;
            if (action === 'up') moveRowUp(idx);
            else if (action === 'down') moveRowDown(idx);
            else if (action === 'swap') swapBedBes(idx);
            else if (action === 'dup') duplicateRow(idx);
            else if (action === 'del') {
                const ok = await _askConfirm('این ردیف حذف شود؟', {
                    title: 'حذف ردیف',
                    danger: true,
                    okText: 'حذف کن'
                });
                if (ok) deleteRowAt(idx); }
            return;
        }

        if (e.target.classList.contains('sf-pick-btn')) {
            const idx = parseInt(e.target.dataset.idx);
            const pick = e.target.dataset.pick;
            if (pick === 'moein') openMoeinPicker(idx);
            else if (pick === 'tafzil') openTafzilPicker(idx);
            else if (pick === 'tafzil2') openTafzili2Picker(idx);
        }
    }

    // ═══ PICKERS ═══
    async function openTafzilPicker(rowIdx) {
        const result = await window.App.UI.HesabPicker.open({ mode: 'tafzil', allowCreate: true });
        if (!result) return;
        if (result._create) { await handleCreateFromPicker(rowIdx, result); return; }
        _state.items[rowIdx].codeTafzil = result.codeTafzil;
        renderRows();
        setTimeout(() => {
            const wrap = document.getElementById('sfRowsWrap');
            const row = wrap?.querySelector(`.sf-row[data-row-idx="${rowIdx}"]`);
            row?.querySelector('.sf-tafzil')?.focus();
        }, 50);
    }

    async function openMoeinPicker(rowIdx) {
        const current = _state.items[rowIdx] || {};
        const result = await window.App.UI.HesabPicker.open({
            mode: 'moein',
            codeCol: current.codeCol || 0,
            allowCreate: true,
            initial: current.codeMoein ? { codeCol: current.codeCol, codeMoein: current.codeMoein } : null
        });
        if (!result) return;
        if (result._create) { await handleCreateFromPicker(rowIdx, result); return; }

        _state.items[rowIdx].codeCol = result.codeCol;
        _state.items[rowIdx].codeMoein = result.codeMoein;
        _state.items[rowIdx].codeTafzil = 0;
        _state.items[rowIdx].codeTafzili2 = 0;
        renderRows();
        setTimeout(() => {
            const wrap = document.getElementById('sfRowsWrap');
            const row = wrap?.querySelector(`.sf-row[data-row-idx="${rowIdx}"]`);
            row?.querySelector('.sf-moein-text')?.focus();
        }, 50);
    }

    async function handleCreateFromPicker(rowIdx, pickerResult) {
        const { keyword, mode, codeCol } = pickerResult;
        const name = prompt(`نام ${mode === 'moein' ? 'معین' : 'تفصیلی'} جدید:`, keyword);
        if (!name) return;
        try {
            const payload = {
                level: mode, name: name.trim(), mahiat: 1, vaziat: 1,
                codeCol: mode === 'moein' ? codeCol : null
            };
            const r = await window.App.Http.api('/api/hesab', { method: 'POST', body: JSON.stringify(payload) });
            if (r && r.hesabId) {
                window.App.UI.HesabPicker.invalidateCache();
                window.App.toast('حساب جدید ایجاد شد', 'success');
                if (mode === 'moein') await openMoeinPicker(rowIdx);
                else await openTafzilPicker(rowIdx);
            }
        } catch (err) { window.App.toast('خطا در ایجاد: ' + err.message, 'error'); }
    }

    async function openTafzili2Picker(rowIdx) {
        const list = await ensureTafzili2Lookup();
        if (!list || list.length === 0) { window.App.toast('لیست تفصیلی ۲ در دسترس نیست', 'warn'); return; }

        const currentCode = _state.items[rowIdx].codeTafzili2;
        const modalBody = document.getElementById('modalBody');
        document.getElementById('sfTafzil2Picker')?.remove();

        const picker = document.createElement('div');
        picker.id = 'sfTafzil2Picker';
        picker.className = 'sf-picker-overlay';
        picker.innerHTML = `
            <div class="sf-picker-box">
                <div class="sf-picker-header">
                    <span>🔍 انتخاب تفصیلی ۲</span>
                    <button type="button" class="sf-picker-close">✕</button>
                </div>
                <div class="sf-picker-search">
                    <input type="text" id="sfTafzil2Search" placeholder="جستجو..." autofocus>
                </div>
                <div class="sf-picker-list" id="sfTafzil2List"></div>
            </div>`;
        modalBody.appendChild(picker);

        const searchInput = picker.querySelector('#sfTafzil2Search');
        const listWrap = picker.querySelector('#sfTafzil2List');

        function renderList(filter = '') {
            const f = filter.trim().toLowerCase();
            const filtered = !f ? list : list.filter(x =>
                String(x.code).includes(f) || (x.name || '').toLowerCase().includes(f));
            if (filtered.length === 0) { listWrap.innerHTML = '<div class="sf-picker-empty">یافت نشد</div>'; return; }
            listWrap.innerHTML = filtered.slice(0, 200).map(x => `
                <div class="sf-picker-item ${x.code === currentCode ? 'selected' : ''}"
                     data-code="${x.code}"><span class="sf-picker-code">${x.code}</span>
                    <span class="sf-picker-name">${H.esc(x.name || '')}</span></div>`).join('');
        }
        renderList();
        searchInput.addEventListener('input', () => renderList(searchInput.value));
        picker.querySelector('.sf-picker-close').addEventListener('click', () => picker.remove());
        picker.addEventListener('click', (e) => {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.sf-picker-item');
            if (!item) return;
            _state.items[rowIdx].codeTafzili2 = parseInt(item.dataset.code);
            picker.remove();
            renderRows();
            setTimeout(() => {
                const wrap = document.getElementById('sfRowsWrap');
                const row = wrap?.querySelector(`.sf-row[data-row-idx="${rowIdx}"]`);
                row?.querySelector('.sf-tafzil2')?.focus();
            }, 50);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') picker.remove();
            if (e.key === 'Enter') { const first = listWrap.querySelector('.sf-picker-item'); if (first) first.click(); }
        });
        setTimeout(() => searchInput.focus(), 50);
    }

    // ═══ TOTALS ═══
    function recalcTotals() {
        const wrap = document.getElementById('sfTotals');
        if (!wrap) return;
        let tb = 0, ts = 0;
        _state.items.forEach(it => { tb += it.mabBed || 0; ts += it.mabBes || 0; });
        const diff = tb - ts;
        const bal = Math.abs(diff) < 0.01;
        const color = bal ? '#059669' : '#DC2626';
        wrap.innerHTML = `
            <div class="sf-total-item"><span>جمع بدهکار:</span><strong>${H.fmt(tb)}</strong></div>
            <div class="sf-total-item"><span>جمع بستانکار:</span><strong>${H.fmt(ts)}</strong></div>
            <div class="sf-total-item" style="color:${color};"><span>تفاوت:</span><strong>${H.fmt(Math.abs(diff))} ${bal ? '✅ تراز' : ''}</strong></div>`;
    }

    // ═══ SAVE ═══
   async function save() {
        const btn = document.getElementById('sfSaveBtn');
        const orig = btn.textContent;

        const dateIn = document.getElementById('sfDateIn').value.trim();
        const sharh = document.getElementById('sfParentSharh').value.trim();
        const vazeit = parseInt(document.getElementById('sfVazeit').value) || 0;
        const kind = parseInt(document.getElementById('sfKindSanad').value) || 0;
        const noStr = document.getElementById('sfNoSanad').value.trim();

       if (!dateIn) {
           console.warn('[save] تاریخ خالی است');
           window.App.toast('تاریخ سند الزامی است', 'error');
           return;
}

        const valid = _state.items.filter(it => it.codeCol > 0 && (it.mabBed > 0 || it.mabBes > 0));
       if (valid.length === 0) {
           console.warn('[save] هیچ ردیف معتبری نیست');
           window.App.toast('حداقل یک ردیف با کد کل و مبلغ لازم است', 'error');
           return;
       }

        let tb = 0, ts = 0;
        valid.forEach(it => { tb += it.mabBed || 0; ts += it.mabBes || 0; });
       if (Math.abs(tb - ts) > 0.01) {
           const diff = Math.abs(tb - ts);
           const ok = await _askConfirm(
               `سند تراز نیست!\n\nجمع بدهکار: ${H.fmt(tb)}\nجمع بستانکار: ${H.fmt(ts)}\nتفاوت: ${H.fmt(diff)}\n\nآیا باز هم می‌خواهید ذخیره کنید؟`,
               {
                   title: '⚠️ سند تراز نیست',
                   type: 'warning',
                   okText: 'بله، ذخیره کن',
                   cancelText: 'برگشت به ویرایش'
               }
           );
           if (!ok) return;
       }

        const payload = {
            noSanad: noStr && !isNaN(parseInt(noStr)) ? parseInt(noStr) : null,
            dateIn, otherParentSharh: sharh, parentSharhCode: null, vazeit, kindSanad: kind,
            items: valid.map((it, i) => ({
                rowNum: i + 1, codeCol: it.codeCol, codeMoein: it.codeMoein,
                codeTafzil: it.codeTafzil, codeTafzili2: it.codeTafzili2,
                tafzili2Id: it.tafzili2Id, codeSharh: it.codeSharh,
                otherSharh: it.otherSharh, mabBed: it.mabBed, mabBes: it.mabBes,
                meghdar: Math.abs(it.meghdar || 0)
            }))
        };

        try {
            btn.disabled = true; btn.textContent = '⏳ در حال ذخیره...';
            if (_state.isEdit) {
                payload.parentSanadId = _state.parentSanadId;
                await window.App.Http.api(`/api/sanad/${_state.parentSanadId}`, { method: 'PUT', body: JSON.stringify(payload) });
                window.App.toast('سند به‌روزرسانی شد', 'success');
            } else {
                await window.App.Http.api('/api/sanad', { method: 'POST', body: JSON.stringify(payload) });
                window.App.toast('سند جدید ثبت شد', 'success');
            }
            if (_keyHandler) {
                document.removeEventListener('keydown', _keyHandler, true);
                _keyHandler = null;
            }
            window.App.closeModal();

            const currentPage = window.App.state.currentPage;
            if (currentPage === 'sanad') {
                window.App.Features.Sanad.loadList();
            } else {
                const feat = window.App.Features[currentPage];
                if (feat && typeof feat.reload === 'function') feat.reload();
                else if (feat && typeof feat.loadList === 'function') feat.loadList();
                else if (feat && typeof feat.run === 'function') feat.run();
            }
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        } finally {
            btn.disabled = false; btn.textContent = orig;
        }
    }

    // ═══ DELETE ═══
    async function deleteSanad(id) {
        if (window.App.Permissions && !window.App.Permissions.can(108)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        const ok = await _askConfirm(
            'آیا از حذف این سند مطمئن هستید؟ این عملیات قابل بازگشت نیست.',
            {
                title: 'حذف سند',
                danger: true,
                okText: 'بله، حذف کن',
                cancelText: 'لغو'
            }
        );
        if (!ok) return;
        try {
            await window.App.Http.api(`/api/sanad/${id}`, { method: 'DELETE' });
            window.App.toast('سند حذف شد', 'success');
            window.App.Features.Sanad.loadList();
        } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
    }
    // ═══ Help Modal ═══
    // ⭐ نمایش راهنما به‌صورت پنل بازشو (نه modal جدید)
  function toggleHelpPanel() {
    let panel = document.getElementById('sfHelpInline');
    if (panel) { panel.remove(); return; }

    const form = document.querySelector('.sanad-form');
    if (!form) return;

    panel = document.createElement('div');
    panel.id = 'sfHelpInline';
    panel.className = 'sf-help-inline';
    panel.innerHTML = `
            <div class="sf-hi-header">
                <span>⌨️ کلیدهای میان‌بر</span>
                <button type="button" class="sf-hi-close" id="sfHelpClose">✕</button>
            </div>
            <div class="sf-hi-grid">
                <div class="sf-hi-item"><kbd>↑</kbd>/<kbd>↓</kbd><span>پیمایش ردیف (روی فیلد خالی)</span></div>
                <div class="sf-hi-item"><kbd>F6</kbd><span>انتقال ردیف به بالا</span></div>
                <div class="sf-hi-item"><kbd>Ctrl</kbd>+<kbd>F6</kbd><span>انتقال ردیف به پایین</span></div>
                <div class="sf-hi-item"><kbd>F7</kbd><span>جابجایی بدهکار ↔ بستانکار</span></div>
                <div class="sf-hi-item"><kbd>Insert</kbd><span>افزودن ردیف</span></div>
                <div class="sf-hi-item"><kbd>Ctrl</kbd>+<kbd>Del</kbd><span>حذف ردیف</span></div>
                <div class="sf-hi-item"><kbd>Ctrl</kbd>+<kbd>F9</kbd><span>کپی ردیف</span></div>
                <div class="sf-hi-item"><kbd>Ctrl</kbd>+<kbd>F10</kbd><span>چسباندن</span></div>
                <div class="sf-hi-item"><kbd>Ctrl</kbd>+<kbd>Home</kbd><span>اولین ردیف</span></div>
                <div class="sf-hi-item"><kbd>Ctrl</kbd>+<kbd>End</kbd><span>آخرین ردیف</span></div>
                <div class="sf-hi-item"><kbd>Ctrl</kbd>+<kbd>Enter</kbd><span>ذخیره</span></div>
                <div class="sf-hi-item"><kbd>Esc</kbd><span>بستن فرم</span></div>
            </div>`;

    const header = form.querySelector('.sanad-form-header');
    if (header) header.after(panel);
    else form.insertBefore(panel, form.firstChild);

    panel.querySelector('#sfHelpClose')?.addEventListener('click', () => panel.remove());
   }

// ⭐⭐ تأیید خروج با prompt داخلی (نه modal)
    function showCloseConfirm() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'sf-confirm-overlay';
            overlay.innerHTML = `
                <div class="sf-confirm-box">
                    <div class="sf-confirm-icon">⚠️</div>
                    <div class="sf-confirm-title">تغییرات ذخیره نشده است</div>
                    <div class="sf-confirm-msg">آیا می‌خواهید قبل از خروج، تغییرات را ذخیره کنید؟</div>
                    <div class="sf-confirm-btns">
                        <button class="btn btn-primary" data-action="save">💾 ذخیره و بستن</button>
                        <button class="btn btn-danger" data-action="discard">🗑️ بستن بدون ذخیره</button>
                        <button class="btn btn-ghost" data-action="cancel">لغو</button>
                    </div>
                </div>`;

            document.body.appendChild(overlay);

            // ⭐ cleanup یکسان برای همه راه‌های بستن
            const cleanup = () => {
                document.removeEventListener('keydown', escHandler, true);
                overlay.remove();
            };

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    cleanup();
                    resolve('cancel');
                }
            };

            overlay.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    cleanup();
                    resolve(btn.dataset.action);
                });
            });

            document.addEventListener('keydown', escHandler, true);
        });
    }
    // ⭐ فعال/غیرفعال کردن دکمه چسباندن
 
  async function handleClose() {
    if (!_state.dirty) {
        if (_keyHandler) {
            document.removeEventListener('keydown', _keyHandler, true);
            _keyHandler = null;
        }
        window.App.closeModal();
        return;
    }

    const action = await showCloseConfirm();

    if (action === 'save') {
        save();   // save خودش می‌بنده
    } else if (action === 'discard') {
        if (_keyHandler) {
            document.removeEventListener('keydown', _keyHandler, true);
            _keyHandler = null;
        }
        window.App.closeModal();
    }
    // cancel → هیچ کاری نکن
   }

    return { openCreate, openEdit, delete: deleteSanad };
})();

window.App.openSanadCreate = window.App.Features.SanadForm.openCreate;
window.App.openSanadEdit = window.App.Features.SanadForm.openEdit;
window.App.deleteSanad = window.App.Features.SanadForm.delete;