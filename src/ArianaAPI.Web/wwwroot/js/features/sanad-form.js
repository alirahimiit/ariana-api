/* ═══════════════════════════════════════════════════
   Feature / SanadForm — فرم ثبت/ویرایش سند
   نسخه 3.0 — Summary Grid + Row Editor Overlay
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.SanadForm = (function () {
    'use strict';

    const H = window.App.Helpers;

    function getClipboard() {
        if (!window.App.state) window.App.state = {};
        if (!window.App.state.sanadClipboard) window.App.state.sanadClipboard = [];
        return window.App.state.sanadClipboard;
    }
    function setClipboard(items) {
        if (!window.App.state) window.App.state = {};
        window.App.state.sanadClipboard = items;
    }

    function _toast(msg, type = 'info') {
        try { if (window.App.toast) return window.App.toast(msg, type); } catch (e) { }
        console.log('[' + type.toUpperCase() + ']', msg);
    }

    async function _askConfirm(msg, options) {
        try { if (window.App.confirm) return await window.App.confirm(msg, options); } catch (err) { }
        return window.confirm(msg);
    }

    let _state = {
        isEdit: false,
        parentSanadId: null,
        items: [],
        focusedIdx: -1,
        dirty: false,
        selectedRows: new Set(),
        rowEditor: null,
        highlightRowId: null,
        originalVazeit: undefined
    };

    let _cache = { cols: [], moeins: [], tafzils: [], loaded: false };
    let _sharhCache = { parents: null, rows: null };

    function today() {
        try {
            const fmt = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const p = fmt.formatToParts(new Date());
            return `${p.find(x => x.type === 'year').value}/${p.find(x => x.type === 'month').value}/${p.find(x => x.type === 'day').value}`;
        } catch { return ''; }
    }

    function emptyRow() {
        return {
            sanadId: 0, codeCol: 0, codeMoein: 0, codeTafzil: 0, codeTafzili2: 0,
            tafzili2Id: 0, codeSharh: 0, otherSharh: '', mabBed: 0, mabBes: 0, meghdar: 0,
            tikRow: 0, doDate: '', doOK: false,
            colName: '', moeinName: '', tafzilName: '', tafzil2Name: ''
        };
    }

    function normalizeDigits(s) {
        return String(s).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    }

    function parseNum(v) {
        if (v === null || v === undefined || v === '') return 0;
        let s = normalizeDigits(v).replace(/[٫،]/g, '.').replace(/[٬,]/g, '').replace(/[^\d.\-]/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function applyMoneyFormat(input) {
        const oldVal = input.value;
        if (!oldVal) return;
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

    async function ensureLookups() {
        if (_cache.loaded) return;
        try {
            const [tree, tafResp, taf2Resp] = await Promise.all([
                window.App.Http.api('/api/hesab/tree'),
                window.App.Http.api('/api/tafzili/list', { method: 'POST', body: JSON.stringify({ page: 1, pageSize: 100000, mandehFilter: 'all' }) }).catch(() => ({ items: [] })),
                window.App.Http.api('/api/tafzili2/list', { method: 'POST', body: JSON.stringify({ page: 1, pageSize: 100000 }) }).catch(() => ({ items: [] }))
            ]);
            _cache.cols = (tree || []).filter(x => x.level === 'col').sort((a, b) => a.codeCol - b.codeCol);
            _cache.moeins = (tree || []).filter(x => x.level === 'moein').sort((a, b) => a.codeMoein - b.codeMoein);
            _cache.tafzils = (tafResp?.items || []).map(t => ({ code: parseInt(t.codeTafzil), name: t.name }));
            const t2 = taf2Resp?.items || taf2Resp || [];
            _cache.tafzils2 = t2.map(t => ({ code: parseInt(t.code || t.Code || 0), name: t.name || t.Name || '' }));
            _cache.loaded = true;
        } catch (err) { console.error('Lookup load failed:', err); }
    }

    async function ensureSharhLists() {
        if (_sharhCache.parents !== null && _sharhCache.rows !== null) return _sharhCache;
        try {
            const [parents, rows] = await Promise.all([
                window.App.Http.api('/api/sanad/distinct-parent-sharh', { silent: true }).catch(() => []),
                window.App.Http.api('/api/sanad/distinct-row-sharh', { silent: true }).catch(() => [])
            ]);
            _sharhCache.parents = Array.isArray(parents) ? parents : [];
            _sharhCache.rows = Array.isArray(rows) ? rows : [];
        } catch (e) {
            _sharhCache.parents = _sharhCache.parents || [];
            _sharhCache.rows = _sharhCache.rows || [];
        }
        return _sharhCache;
    }

    function fillDatalist(id, items) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = (items || []).slice(0, 500).map(x => {
            const s = String(x ?? '').trim();
            return s ? `<option value="${H.esc(s)}"></option>` : '';
        }).join('');
    }

    function findTafzilName(code) {
        if (!code) return '';
        return (_cache.tafzils?.find(x => x.code === parseInt(code)) || {}).name || '';
    }
    function findTafzili2Name(code) {
        if (!code) return '';
        return (_cache.tafzils2?.find(x => x.code === parseInt(code)) || {}).name || '';
    }

    function enrichItemNames(it) {
        it.colName = (_cache.cols.find(c => c.codeCol === it.codeCol) || {}).name || '';
        it.moeinName = (_cache.moeins.find(m => m.codeCol === it.codeCol && m.codeMoein === it.codeMoein) || {}).name || '';
        it.tafzilName = findTafzilName(it.codeTafzil);
        it.tafzil2Name = findTafzili2Name(it.codeTafzili2);
        return it;
    }

    // ═══ OPEN CREATE ═══
    async function openCreate() {
        if (window.App.Permissions && !window.App.Permissions.can(101)) {
            _toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error'); return;
        }
        _state = { isEdit: false, parentSanadId: null, items: [], focusedIdx: -1, dirty: false, selectedRows: new Set(), rowEditor: null, highlightRowId: null };

        await ensureLookups();
        ensureSharhLists().then(() => fillDatalist('sfParentSharhList', _sharhCache.parents || [])).catch(() => { });

        const body = buildFormHtml({ noSanad: '', dateIn: today(), otherParentSharh: '', vazeit: 0, kindSanad: 0 });
        window.App.openModal('➕ سند جدید', body);
        document.querySelector('.modal-box')?.classList.add('wide-modal');
        bindEvents();
        renderSummary();

        // باز کردن خودکار فرم برای اولین ردیف
        setTimeout(() => openRowEditor('create', -1), 200);
    }

    // ═══ OPEN EDIT ═══
    async function openEdit(id, options = {}) {
        if (window.App.Permissions && !window.App.Permissions.can(102)) {
            _toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error'); return;
        }
        try {
            const vRes = await window.App.Http.api(`/api/sanad/${id}/vazeit`);
            const currentVazeit = vRes?.vazeit ?? 0;
            const P = window.App.Permissions;
            if (P) {
                let canEdit = false, needPerm = '';
                if (currentVazeit === 2) { canEdit = P.can(103); needPerm = '۱۰۳'; }
                else if (currentVazeit === 1) { canEdit = P.can(104) || P.can(105); needPerm = '۱۰۴'; }
                else { canEdit = P.can(102); needPerm = '۱۰۲'; }
                if (!canEdit) {
                    _toast(`برای ویرایش سند «${['پیش‌نویس', 'رسیدگی', 'قطعی'][currentVazeit]}» به دسترسی ${needPerm} نیاز دارید`, 'error'); return;
                }
            }

            await ensureLookups();
            const [detail, items] = await Promise.all([
                window.App.Http.api(`/api/sanad/${id}`),
                window.App.Http.api(`/api/sanad/${id}/items`)
            ]);
            ensureSharhLists().then(() => fillDatalist('sfParentSharhList', _sharhCache.parents || [])).catch(() => { });

            const mapped = (items || []).map(it => enrichItemNames({
                sanadId: it.sanadID || it.sanadId || it.SanadID || 0,
                codeCol: it.code_Col || 0, codeMoein: it.code_Moein || 0, codeTafzil: it.code_Tafzil || 0, codeTafzili2: it.code_Tafzili2 || 0,
                tafzili2Id: it.tafzili2ID || 0, codeSharh: it.code_Sharh || 0, otherSharh: it.otherSharh || '',
                mabBed: it.mabBed || 0, mabBes: it.mabBes || 0, meghdar: Math.abs(it.meghdar || 0),
                tikRow: it.tikRow || it.TikRow || 0, doDate: it.doDate || '', doOK: it.doOK === true || it.doOk === true
            }));

            _state = {
                isEdit: true, parentSanadId: id, originalVazeit: currentVazeit,
                items: mapped, focusedIdx: -1, dirty: false, selectedRows: new Set(),
                highlightRowId: options.highlightRowId || null, rowEditor: null
            };

            const body = buildFormHtml({
                noSanad: detail?.noSanad || '', dateIn: detail?.dateIn || '', otherParentSharh: detail?.otherParentSharh || '',
                vazeit: detail?.vazeit || 0, kindSanad: detail?.kindSanad || 0
            });
            window.App.openModal('✏️ ویرایش سند شماره ' + (detail?.noSanad || ''), body);
            document.querySelector('.modal-box')?.classList.add('wide-modal');
            bindEvents();
            renderSummary();

            // هایلایت ردیف ارجاعی (از دفاتر)
            if (_state.highlightRowId) {
                setTimeout(() => {
                    const tr = document.querySelector(`.sf-summary-table tr[data-sanad-id="${_state.highlightRowId}"]`);
                    if (tr) {
                        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        tr.classList.add('sf-tr-highlight');
                    }
                }, 300);
            }
        } catch (err) { _toast('خطا: ' + err.message, 'error'); }
    }

    // ═══ BUILD MAIN HTML ═══
    function buildFormHtml(h) {
        const vazeitOpts = [
            { v: 0, t: 'پیش‌نویس' }, { v: 1, t: 'رسیدگی' }, { v: 2, t: 'قطعی' }
        ].map(o => {
            let disabled = '', title = '';
            const P = window.App.Permissions;
            if (o.v >= 1) {
                const tb = _state.items.reduce((s, x) => s + (x.mabBed || 0), 0);
                const ts = _state.items.reduce((s, x) => s + (x.mabBes || 0), 0);
                const check = _validateVazeit(o.v, tb, ts);
                if (!check.ok) { disabled = 'disabled'; title = `title="ابتدا ایرادها را رفع کنید: ${check.issues[0]}"`; }
            }
            if (!disabled && _state.isEdit && P && _state.originalVazeit !== undefined) {
                const origV = _state.originalVazeit;
                if (origV === 2 && !P.can(103)) { disabled = 'disabled'; title = 'title="نیاز به دسترسی ۱۰۳"'; }
                else if (origV === 1 && !(P.can(104) || P.can(105))) { disabled = 'disabled'; title = 'title="نیاز به دسترسی ۱۰۴"'; }
                else if (origV === 0 && !P.can(102)) { disabled = 'disabled'; title = 'title="نیاز به دسترسی ۱۰۲"'; }
            }
            return `<option value="${o.v}" ${h.vazeit === o.v ? 'selected' : ''} ${disabled} ${title}>${o.t}${disabled ? ' 🚫' : ''}</option>`;
        }).join('');

        const kindOpts = [
            { v: 0, t: 'عادی' }, { v: 1, t: 'افتتاحیه' }, { v: 2, t: 'اختتامیه' },
            { v: 3, t: 'انبار' }, { v: 4, t: 'حقوق' }, { v: 5, t: 'اموال' },
            { v: 6, t: 'فروش' }, { v: 7, t: 'انتقالی' }, { v: 8, t: 'خاص' }
        ].map(o => `<option value="${o.v}" ${h.kindSanad === o.v ? 'selected' : ''}>${o.t}</option>`).join('');

        return `
            <div class="sanad-form" data-help="sanad-form">
                <datalist id="sfParentSharhList"></datalist>
                <datalist id="sfRowSharhList"></datalist>
                <div class="sanad-form-header">
                    <div class="sf-field"><label>شماره سند</label><input type="text" id="sfNoSanad" value="${H.esc(h.noSanad)}" ${_state.isEdit ? 'readonly' : ''} placeholder="خودکار"></div>
                    <div class="sf-field"><label>تاریخ <span class="req">*</span></label><input type="text" id="sfDateIn" value="${H.esc(h.dateIn)}" placeholder="1404/01/01"></div>
                    <div class="sf-field"><label>نوع سند</label><select id="sfKindSanad">${kindOpts}</select></div>
                    <div class="sf-field"><label>وضعیت</label><select id="sfVazeit">${vazeitOpts}</select></div>
                    <div class="sf-field sf-field-wide"><label>شرح سند</label><input type="text" id="sfParentSharh" list="sfParentSharhList" value="${H.esc(h.otherParentSharh)}" placeholder="شرح کلی سند"></div>
                </div>

                <div class="sanad-form-rows-header">
                    <h4>📋 ردیف‌های سند <span id="sfSummaryCount" style="color:#4F46E5;font-size:13px;font-weight:bold;">(0)</span></h4>
                    <div class="sf-row-actions">
                        <button type="button" class="btn btn-ghost btn-sm" id="sfCopyBtn" title="کپی (Ctrl+F9)">📋</button>
                        <button type="button" class="btn btn-ghost btn-sm" id="sfPasteBtn" title="چسباندن (Ctrl+F10)">📥</button>
                        <button type="button" class="btn btn-primary btn-sm" id="sfAddRow" title="افزودن (Insert)">➕ افزودن ردیف</button>
                    </div>
                </div>

                <div id="sfSummaryWrap" class="sf-summary-wrap"></div>

                <div class="sanad-form-sticky">
                    <div class="sanad-form-totals" id="sfTotals"></div>
                    <div class="sanad-form-footer">
                        <button type="button" class="btn btn-primary" id="sfSaveBtn">💾 ذخیره سند <span class="kbd-hint">Ctrl+Enter</span></button>
                        <button type="button" class="btn btn-ghost" id="sfCancelBtn">انصراف <span class="kbd-hint">Esc</span></button>
                    </div>
                </div>
            </div>`;
    }

    // ═══ RENDER SUMMARY TABLE ═══
    function renderSummary() {
        const wrap = document.getElementById('sfSummaryWrap');
        if (!wrap) return;

        document.getElementById('sfSummaryCount').textContent = `(${_state.items.length})`;

        const pasteBtn = document.getElementById('sfPasteBtn');
        if (pasteBtn) {
            const n = getClipboard().length;
            pasteBtn.disabled = n === 0;
            pasteBtn.title = n > 0 ? `چسباندن ${n} ردیف` : 'بافر خالی';
        }

        if (_state.items.length === 0) {
            wrap.innerHTML = `<div class="sf-summary-empty"><div style="font-size:36px;margin-bottom:10px;">📭</div><p>هنوز ردیفی ثبت نشده است</p><button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('sfAddRow').click()">➕ ثبت اولین ردیف</button></div>`;
            recalcTotals();
            return;
        }

        const rows = _state.items.map((it, i) => {
            const isSel = _state.selectedRows.has(i);
            const isTik = it.tikRow === 1;
            const isErr = _detectRowErrors(it).some(e => e.severity === 'error');

            const codeParts = [it.codeCol, it.codeMoein, it.codeTafzil, it.codeTafzili2].filter(x => x > 0).join('-');
            const name = it.tafzil2Name || it.tafzilName || it.moeinName || it.colName || '';

            return `
                <tr data-idx="${i}" data-sanad-id="${it.sanadId || ''}" class="${isSel ? 'sf-tr-selected' : ''} ${isTik ? 'sf-tr-tik' : ''} ${isErr ? 'sf-tr-err' : ''}">
                    <td class="sf-td-check"><input type="checkbox" class="sf-sum-cb" data-idx="${i}" ${isSel ? 'checked' : ''}></td>
                    <td class="sf-td-num">${i + 1}${isTik ? ' <span style="color:#D97706;font-weight:bold;">✓</span>' : ''}</td>
                    <td class="sf-td-code"><strong>${codeParts || '-'}</strong> <span class="sf-code-name-txt">${H.esc(name)}</span></td>
                    <td class="sf-td-sharh">${H.esc(it.otherSharh || '')}</td>
                    <td class="sf-td-money">${it.mabBed ? H.fmt(it.mabBed) : '-'}</td>
                    <td class="sf-td-money">${it.mabBes ? H.fmt(it.mabBes) : '-'}</td>
                    <td class="sf-td-money">${it.meghdar ? parseFloat(it.meghdar.toFixed(4)) : '-'}</td>
                    <td class="sf-td-actions">
                        <button type="button" class="sf-act-btn" data-action="edit" title="ویرایش (Enter)">✏️</button>
                        <button type="button" class="sf-act-btn" data-action="up" title="بالا">▲</button>
                        <button type="button" class="sf-act-btn" data-action="down" title="پایین">▼</button>
                        <button type="button" class="sf-act-btn" data-action="swap" title="جابجایی (F7)">⇅</button>
                        <button type="button" class="sf-act-btn ${isTik ? 'sf-act-tik-active' : ''}" data-action="tik" title="علامت (F8)">✓</button>
                        <button type="button" class="sf-act-btn" data-action="dup" title="تکثیر">⧉</button>
                        <button type="button" class="sf-act-btn sf-act-del" data-action="del" title="حذف">🗑️</button>
                    </td>
                </tr>`;
        }).join('');

        wrap.innerHTML = `
            <table class="sf-summary-table">
                <thead>
                    <tr>
                        <th style="width:36px;"><input type="checkbox" id="sfSumSelectAll" title="انتخاب همه"></th>
                        <th style="width:40px;">#</th>
                        <th>کدینگ</th>
                        <th>شرح ردیف</th>
                        <th style="width:120px;" class="text-left">بدهکار</th>
                        <th style="width:120px;" class="text-left">بستانکار</th>
                        <th style="width:90px;" class="text-left">مقدار</th>
                        <th style="width:180px;" class="text-center">عملیات</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;

        const allCb = document.getElementById('sfSumSelectAll');
        if (allCb) allCb.checked = _state.items.length > 0 && _state.selectedRows.size === _state.items.length;

        recalcTotals();
    }

    // ═══ اعتبارسنجی وجود کدینگ در سیستم (مثل IsHesabValid دلفی) ═══
    function validateHesabCodes(data) {
        // ۱. چک کد کل
        const col = _cache.cols.find(c => c.codeCol === data.codeCol);
        if (!col) return `کد کل ${data.codeCol} در سیستم وجود ندارد.`;

        // ۲. چک کد معین
        if (data.codeMoein > 0) {
            const moein = _cache.moeins.find(m => m.codeCol === data.codeCol && m.codeMoein === data.codeMoein);
            if (!moein) return `کد معین ${data.codeMoein} برای کل ${data.codeCol} وجود ندارد.`;
        }

        // ۳. چک کد تفصیلی (تفضیلی ۱)
        if (data.codeTafzil > 0) {
            const taf = (_cache.tafzils || []).find(t => t.code === data.codeTafzil);
            if (!taf) return `کد تفصیلی ${data.codeTafzil} در سیستم وجود ندارد.`;
        }

        // ۴. چک کد تفصیلی ۲
        if (data.codeTafzili2 > 0) {
            const taf2 = (_cache.tafzils2 || []).find(t => t.code === data.codeTafzili2);
            if (!taf2) return `کد تفصیلی ۲ ${data.codeTafzili2} در سیستم وجود ندارد.`;
        }

        return null; // اگر نال برگرداند یعنی همه چیز معتبر است
    }

    // ═══════════════════════════════════════════════════════════════
    //  ROW EDITOR OVERLAY (فرم ثبت/ویرایش دلفی)
    // ═══════════════════════════════════════════════════════════════
    function openRowEditor(mode, rowIdx) {
        document.getElementById('sfRowEditorOverlay')?.remove();
        let initialData = (mode === 'edit' && rowIdx >= 0 && _state.items[rowIdx]) ? cloneItem(_state.items[rowIdx]) : emptyRow();
        if (mode !== 'edit') { mode = 'create'; rowIdx = -1; }

        _state.rowEditor = { mode, rowIdx, data: initialData };

        const overlay = document.createElement('div');
        overlay.id = 'sfRowEditorOverlay';
        overlay.className = 'sf-re-overlay';
        overlay.innerHTML = buildRowEditorHtml(mode, initialData);
        document.body.appendChild(overlay);
        // ⭐ اضافه کردن این بلوک برای پر کردن لیست شرح‌ها
        if (_sharhCache.rows && _sharhCache.rows.length > 0) {
            fillDatalist('sfReSharhList', _sharhCache.rows);
        } else {
            ensureSharhLists().then(() => {
                fillDatalist('sfReSharhList', _sharhCache.rows || []);
            }).catch(() => { });
        }

        bindRowEditorEvents();
        setTimeout(() => {
            applyRowEditorState();
            const colInput = document.getElementById('sfReCodeCol');
            if (colInput) { colInput.focus(); if (mode === 'edit') colInput.select(); }
        }, 60);
    }

    function buildRowEditorHtml(mode, data) {
        const title = mode === 'edit' ? '✏️ ویرایش ردیف' : '➕ ثبت ردیف جدید';
        return `
            <div class="sf-re-box">
                <div class="sf-re-header">
                    <span class="sf-re-title">${title}</span>
                    <button type="button" class="sf-re-close" id="sfReCloseBtn" title="انصراف (Esc)">✕</button>
                </div>
                <div class="sf-re-body">
                   <datalist id="sfReSharhList"></datalist>
                    <div class="sf-re-line sf-re-codes-line">
                        <div class="sf-re-field" data-field="col">
                            <label>کد کل <span class="sf-re-req">*</span></label>
                            <div class="sf-re-input-with-btn">
                                <input type="text" id="sfReCodeCol" inputmode="numeric" placeholder="کد" autocomplete="off">
                                <button type="button" class="sf-re-pick-btn" data-pick="col" title="انتخاب (F3)">🔍</button>
                            </div>
                            <span class="sf-re-name" id="sfReColName"></span>
                        </div>
                        <div class="sf-re-field" data-field="moein">
                            <label>کد معین <span class="sf-re-req">*</span></label>
                            <div class="sf-re-input-with-btn">
                                <input type="text" id="sfReCodeMoein" inputmode="numeric" placeholder="کد" autocomplete="off">
                                <button type="button" class="sf-re-pick-btn" data-pick="moein" title="انتخاب (F3)">🔍</button>
                            </div>
                            <span class="sf-re-name" id="sfReMoeinName"></span>
                        </div>
                        <div class="sf-re-field" data-field="tafzil" id="sfReTafzilField">
                            <label>تفصیلی ۱ <span class="sf-re-req" id="sfReTafzilReq" style="display:none;">*</span></label>
                            <div class="sf-re-input-with-btn">
                                <input type="text" id="sfReCodeTafzil" inputmode="numeric" placeholder="کد" autocomplete="off">
                                <button type="button" class="sf-re-pick-btn" data-pick="tafzil" title="انتخاب">🔍</button>
                            </div>
                            <span class="sf-re-name" id="sfReTafzilName"></span>
                        </div>
                        <div class="sf-re-field" data-field="tafzili2" id="sfReTafzili2Field" style="display:none;">
                            <label>تفصیلی ۲ <span class="sf-re-req" id="sfReTafzili2Req" style="display:none;">*</span></label>
                            <div class="sf-re-input-with-btn">
                                <input type="text" id="sfReCodeTafzili2" readonly placeholder="🔍" style="cursor:pointer;background:#F9FAFB;">
                                <button type="button" class="sf-re-pick-btn" data-pick="tafzil2" title="انتخاب">🔍</button>
                            </div>
                            <span class="sf-re-name" id="sfReTafzili2Name"></span>
                        </div>
                    </div>

                    <div class="sf-re-line sf-re-values-line">
                        <div class="sf-re-field sf-re-money"><label>بدهکار</label><input type="text" id="sfReBed" inputmode="numeric" placeholder="0"></div>
                        <div class="sf-re-field sf-re-money"><label>بستانکار</label><input type="text" id="sfReBes" inputmode="numeric" placeholder="0"></div>
                        <div class="sf-re-field sf-re-meghdar" id="sfReMeghdarField" style="display:none;"><label>مقدار <span class="sf-re-req">*</span></label><input type="text" id="sfReMeghdar" inputmode="decimal" placeholder="0"></div>
                        <div class="sf-re-field sf-re-sharh"><label>شرح ردیف</label><input type="text" id="sfReSharh" list="sfReSharhList" placeholder="شرح..."></div>
                        <div class="sf-re-field sf-re-dodate"><label>ت. سررسید</label><input type="text" id="sfReDoDate" maxlength="10" placeholder="1404/01/01"></div>
                        <div class="sf-re-field sf-re-dook"><label class="sf-re-dook-lbl"><input type="checkbox" id="sfReDoOK"><span>رسیدگی</span></label></div>
                    </div>
                    <div class="sf-re-hint"><kbd>Enter</kbd> فیلد بعدی · <kbd>F2</kbd> ثبت · <kbd>F3</kbd> انتخاب حساب · <kbd>F7</kbd> جابجایی مبلغ · <kbd>Esc</kbd> انصراف</div>
                </div>
                <div class="sf-re-footer">
                    <button type="button" class="btn btn-primary" id="sfReSaveBtn">💾 ثبت <span class="kbd-hint">Enter/F2</span></button>
                    <button type="button" class="btn btn-ghost" id="sfReCancelBtn">انصراف <span class="kbd-hint">Esc</span></button>
                </div>
            </div>`;
    }

    function bindRowEditorEvents() {
        const overlay = document.getElementById('sfRowEditorOverlay');
        if (!overlay) return;

        document.getElementById('sfReSaveBtn')?.addEventListener('click', () => saveRowFromEditor());
        document.getElementById('sfReCancelBtn')?.addEventListener('click', () => closeRowEditorOverlay());
        document.getElementById('sfReCloseBtn')?.addEventListener('click', () => closeRowEditorOverlay());

        overlay.querySelectorAll('[data-pick]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const pick = btn.dataset.pick;
                if (pick === 'col') openRowMoeinPicker('col');
                else if (pick === 'moein') openRowMoeinPicker('moein');
                else if (pick === 'tafzil') openRowTafzilPicker();
                else if (pick === 'tafzil2') openRowTafzili2Picker();
            });
        });

        document.getElementById('sfReCodeCol')?.addEventListener('input', onReCodeColInput);
        document.getElementById('sfReCodeMoein')?.addEventListener('input', onReCodeMoeinInput);
        document.getElementById('sfReCodeTafzil')?.addEventListener('input', onReCodeTafzilInput);
        document.getElementById('sfReBed')?.addEventListener('input', onReBedInput);
        document.getElementById('sfReBes')?.addEventListener('input', onReBesInput);
        document.getElementById('sfReMeghdar')?.addEventListener('input', onReMeghdarInput);

        document.getElementById('sfReBed')?.addEventListener('keydown', onRePlusKey);
        document.getElementById('sfReBes')?.addEventListener('keydown', onRePlusKey);

        overlay.addEventListener('keydown', onRowEditorKeyDown);
    }

    function onRowEditorKeyDown(e) {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); closeRowEditorOverlay(); return; }
        if (e.key === 'F2') { e.preventDefault(); saveRowFromEditor(); return; }

        if (e.key === 'F7' && !e.ctrlKey) {
            e.preventDefault();
            const d = _state.rowEditor.data;
            [d.mabBed, d.mabBes] = [d.mabBes, d.mabBed];
            document.getElementById('sfReBed').value = d.mabBed ? Number(d.mabBed).toLocaleString('en-US') : '';
            document.getElementById('sfReBes').value = d.mabBes ? Number(d.mabBes).toLocaleString('en-US') : '';
            _toast('مبالغ جابجا شد', 'success', { duration: 1000 }); return;
        }

        if ((e.key === 'F3' || e.key === 'F4') && !e.ctrlKey) {
            e.preventDefault();
            const activeId = document.activeElement?.id || '';
            if (activeId === 'sfReCodeCol') openRowMoeinPicker('col');
            else if (activeId === 'sfReCodeMoein') openRowMoeinPicker('moein');
            else if (activeId === 'sfReCodeTafzil') openRowTafzilPicker();
            else if (activeId === 'sfReCodeTafzili2') openRowTafzili2Picker();
            return;
        }

        if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            const order = ['sfReCodeCol', 'sfReCodeMoein', 'sfReCodeTafzil', 'sfReBed', 'sfReBes', 'sfReMeghdar', 'sfReSharh', 'sfReDoDate'];
            const activeId = document.activeElement?.id || '';
            if (activeId === 'sfReCodeCol') {
                const val = parseInt(document.getElementById('sfReCodeCol').value) || 0;
                if (val > 0 && !_cache.cols.find(c => c.codeCol === val)) {
                    _toast('کد کل وارد شده در سیستم وجود ندارد', 'error');
                    return; // جلوگیری از پرش به فیلد بعدی
                }
            } else if (activeId === 'sfReCodeMoein') {
                const colVal = parseInt(document.getElementById('sfReCodeCol').value) || 0;
                const val = parseInt(document.getElementById('sfReCodeMoein').value) || 0;
                if (val > 0 && !_cache.moeins.find(m => m.codeCol === colVal && m.codeMoein === val)) {
                    _toast('کد معین وارد شده برای این کل وجود ندارد', 'error');
                    return; // جلوگیری از پرش به فیلد بعدی
                }
            } else if (activeId === 'sfReCodeTafzil') {
                const val = parseInt(document.getElementById('sfReCodeTafzil').value) || 0;
                if (val > 0 && !_cache.tafzils.find(t => t.code === val)) {
                    _toast('کد تفصیلی وارد شده در سیستم وجود ندارد', 'error');
                    return; // جلوگیری از پرش به فیلد بعدی
                }
            }
            const idx = order.indexOf(activeId);
            if (idx >= 0 && idx < order.length - 1) {
                for (let j = idx + 1; j < order.length; j++) {
                    const nextEl = document.getElementById(order[j]);
                    if (nextEl && nextEl.offsetParent !== null) { nextEl.focus(); if (nextEl.select) nextEl.select(); return; }
                }
            }
            saveRowFromEditor();
        }
    }

    function applyRowEditorState() {
        const d = _state.rowEditor?.data;
        if (!d) return;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val == null ? '' : val; };

        setVal('sfReCodeCol', d.codeCol || '');
        setVal('sfReCodeMoein', d.codeMoein || '');
        setVal('sfReCodeTafzil', d.codeTafzil || '');
        setVal('sfReCodeTafzili2', d.codeTafzili2 ? `${d.codeTafzili2} - ${findTafzili2Name(d.codeTafzili2)}` : '');
        setVal('sfReBed', d.mabBed ? Number(d.mabBed).toLocaleString('en-US') : '');
        setVal('sfReBes', d.mabBes ? Number(d.mabBes).toLocaleString('en-US') : '');
        setVal('sfReMeghdar', d.meghdar ? parseFloat(Number(d.meghdar).toFixed(4)) : '');
        setVal('sfReSharh', d.otherSharh || '');
        setVal('sfReDoDate', d.doDate || '');
        if (document.getElementById('sfReDoOK')) document.getElementById('sfReDoOK').checked = !!d.doOK;

        updateRowEditorNames();
        updateRowEditorVisibility();
    }

    function updateRowEditorNames() {
        const colEl = document.getElementById('sfReCodeCol'), moeinEl = document.getElementById('sfReCodeMoein'), tafEl = document.getElementById('sfReCodeTafzil');
        if (!colEl || !moeinEl) return;
        const codeCol = parseInt(colEl.value) || 0, codeMoein = parseInt(moeinEl.value) || 0, codeTafzil = parseInt(tafEl?.value) || 0;

        document.getElementById('sfReColName').textContent = (_cache.cols.find(c => c.codeCol === codeCol) || {}).name || '';
        document.getElementById('sfReMoeinName').textContent = (_cache.moeins.find(m => m.codeCol === codeCol && m.codeMoein === codeMoein) || {}).name || '';
        document.getElementById('sfReTafzilName').textContent = findTafzilName(codeTafzil);
        document.getElementById('sfReTafzili2Name').textContent = findTafzili2Name(_state.rowEditor?.data?.codeTafzili2);
    }

    function updateRowEditorVisibility() {
        const codeCol = parseInt(document.getElementById('sfReCodeCol')?.value) || 0;
        const codeMoein = parseInt(document.getElementById('sfReCodeMoein')?.value) || 0;
        const tafField = document.getElementById('sfReTafzilField'), taf2Field = document.getElementById('sfReTafzili2Field'), meghField = document.getElementById('sfReMeghdarField');

        if (!codeCol || !codeMoein) {
            if (tafField) tafField.style.display = ''; if (taf2Field) taf2Field.style.display = 'none'; if (meghField) meghField.style.display = 'none';
            return;
        }
        const moein = _cache.moeins.find(m => m.codeCol === codeCol && m.codeMoein === codeMoein);
        if (!moein) return;

        if (tafField) tafField.style.display = moein.hasTafzili ? '' : 'none';
        if (taf2Field) taf2Field.style.display = moein.hasTafzili2 ? '' : 'none';
        if (meghField) meghField.style.display = moein.isStock ? '' : 'none';
    }

    function onReCodeColInput(e) {
        e.target.value = normalizeDigits(e.target.value).replace(/\D/g, '');
        _state.rowEditor.data.codeCol = parseInt(e.target.value) || 0;
        updateRowEditorNames(); updateRowEditorVisibility();
        if (!e.target.value) { document.getElementById('sfReCodeMoein').value = ''; _state.rowEditor.data.codeMoein = 0; updateRowEditorNames(); }
    }
    function onReCodeMoeinInput(e) {
        e.target.value = normalizeDigits(e.target.value).replace(/\D/g, '');
        _state.rowEditor.data.codeMoein = parseInt(e.target.value) || 0;
        updateRowEditorNames(); updateRowEditorVisibility();
    }
    function onReCodeTafzilInput(e) {
        e.target.value = normalizeDigits(e.target.value).replace(/\D/g, '');
        _state.rowEditor.data.codeTafzil = parseInt(e.target.value) || 0;
        updateRowEditorNames();
    }
    function onReBedInput(e) {
        applyMoneyFormat(e.target);
        const v = parseNum(e.target.value); _state.rowEditor.data.mabBed = v;
        if (v > 0) { _state.rowEditor.data.mabBes = 0; document.getElementById('sfReBes').value = ''; }
    }
    function onReBesInput(e) {
        applyMoneyFormat(e.target);
        const v = parseNum(e.target.value); _state.rowEditor.data.mabBes = v;
        if (v > 0) { _state.rowEditor.data.mabBed = 0; document.getElementById('sfReBed').value = ''; }
    }
    function onReMeghdarInput(e) {
        e.target.value = normalizeDigits(e.target.value).replace(/[^\d.]/g, '');
        _state.rowEditor.data.meghdar = parseNum(e.target.value);
    }
    function onRePlusKey(e) {
        if (e.key === '+' || e.code === 'NumpadAdd') {
            e.preventDefault();
            const val = parseNum(e.target.value);
            if (val) { e.target.value = (val * 1000).toLocaleString('en-US'); if (e.target.id === 'sfReBed') _state.rowEditor.data.mabBed = val * 1000; else _state.rowEditor.data.mabBes = val * 1000; }
        }
    }

    async function openRowMoeinPicker(mode) {
        const d = _state.rowEditor?.data; if (!d) return;
        const res = await window.App.UI.HesabPicker.open({ mode: mode === 'col' ? 'col' : 'moein', codeCol: d.codeCol || 0 });
        if (!res) return;
        d.codeCol = res.codeCol; d.codeMoein = res.codeMoein || 0; d.codeTafzil = 0; d.codeTafzili2 = 0;
        document.getElementById('sfReCodeCol').value = d.codeCol || '';
        document.getElementById('sfReCodeMoein').value = d.codeMoein || '';
        document.getElementById('sfReCodeTafzil').value = ''; document.getElementById('sfReCodeTafzili2').value = '';
        updateRowEditorNames(); updateRowEditorVisibility();
        setTimeout(() => { document.getElementById(mode === 'col' ? 'sfReCodeMoein' : 'sfReBed')?.focus(); }, 80);
    }

    async function openRowTafzilPicker() {
        const d = _state.rowEditor?.data; if (!d) return;
        const res = await window.App.UI.HesabPicker.open({ mode: 'tafzil' });
        if (res) { d.codeTafzil = res.codeTafzil || 0; document.getElementById('sfReCodeTafzil').value = d.codeTafzil; updateRowEditorNames(); document.getElementById('sfReBed')?.focus(); }
    }

    async function openRowTafzili2Picker() {
        const d = _state.rowEditor?.data; if (!d) return;
        const list = _cache.tafzils2 || [];
        if (!list.length) { _toast('لیست تفصیلی ۲ خالی است', 'warn'); return; }

        const overlay = document.createElement('div');
        overlay.className = 'hp-overlay'; overlay.style.zIndex = '11000';
        overlay.innerHTML = `<div class="hp-box" style="width:min(480px,92vw);max-height:80vh;display:flex;flex-direction:column;background:#fff;border-radius:12px;"><div style="padding:12px 16px;background:#4F46E5;color:#fff;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;"><span>🔍 تفصیلی ۲</span><button type="button" data-close="1" style="background:transparent;border:0;color:#fff;cursor:pointer;">✕</button></div><div style="padding:10px;"><input type="text" id="t2s" placeholder="جستجو..." style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-family:inherit;"></div><div id="t2l" style="overflow-y:auto;padding:6px;"></div></div>`;
        document.body.appendChild(overlay);

        const render = (f = '') => {
            const filtered = list.filter(x => String(x.code).includes(f) || (x.name || '').includes(f)).slice(0, 200);
            overlay.querySelector('#t2l').innerHTML = filtered.map(x => `<div class="t2item" data-c="${x.code}" data-n="${H.esc(x.name)}" style="padding:8px;cursor:pointer;border-bottom:1px solid #eee;display:flex;gap:10px;"><b style="color:#4F46E5;">${x.code}</b><span>${H.esc(x.name)}</span></div>`).join('');
        };
        render();
        overlay.querySelector('#t2s').oninput = (e) => render(e.target.value);
        overlay.onclick = (e) => {
            if (e.target === overlay || e.target.dataset.close) { overlay.remove(); return; }
            const item = e.target.closest('.t2item');
            if (item) { d.codeTafzili2 = parseInt(item.dataset.c); document.getElementById('sfReCodeTafzili2').value = d.codeTafzili2 + ' - ' + item.dataset.n; document.getElementById('sfReTafzili2Name').textContent = item.dataset.n; overlay.remove(); document.getElementById('sfReBed').focus(); }
        };
        setTimeout(() => overlay.querySelector('#t2s').focus(), 50);
    }

    function saveRowFromEditor() {
        const d = _state.rowEditor?.data; if (!d) return;
        d.codeCol = parseInt(document.getElementById('sfReCodeCol').value) || 0;
        d.codeMoein = parseInt(document.getElementById('sfReCodeMoein').value) || 0;
        d.codeTafzil = parseInt(document.getElementById('sfReCodeTafzil').value) || 0;
        d.mabBed = parseNum(document.getElementById('sfReBed').value);
        d.mabBes = parseNum(document.getElementById('sfReBes').value);
        d.meghdar = parseNum(document.getElementById('sfReMeghdar').value);
        d.otherSharh = document.getElementById('sfReSharh').value;
        d.doDate = document.getElementById('sfReDoDate').value;
        d.doOK = document.getElementById('sfReDoOK').checked;

        if (!d.codeCol) { _toast('کد کل اجباری است', 'error'); return; }
        if (!d.codeMoein) { _toast('کد معین اجباری است', 'error'); return; }
        if (!d.mabBed && !d.mabBes) { _toast('مبلغ اجباری است', 'error'); return; }

        const hesabError = validateHesabCodes(d);
        if (hesabError) {
            _toast(hesabError, 'error');
            return; // جلوگیری از بسته شدن فرم و ذخیره شدن
        }
        enrichItemNames(d);

        if (_state.rowEditor.mode === 'edit') {
            _state.items[_state.rowEditor.rowIdx] = d;
            _toast('ردیف به‌روز شد', 'success', { duration: 1500 });
            closeRowEditorOverlay();
        } else {
            _state.items.push(d);
            _toast(`ردیف ${_state.items.length} ثبت شد`, 'success', { duration: 1500 });
            _state.rowEditor.data = emptyRow();
            ['sfReCodeCol', 'sfReCodeMoein', 'sfReCodeTafzil', 'sfReCodeTafzili2', 'sfReBed', 'sfReBes', 'sfReMeghdar', 'sfReSharh', 'sfReDoDate'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('sfReColName').textContent = ''; document.getElementById('sfReMoeinName').textContent = '';
            document.getElementById('sfReDoOK').checked = false;
            setTimeout(() => document.getElementById('sfReCodeCol').focus(), 50);
        }
        _state.dirty = true;
        renderSummary();
    }

    function closeRowEditorOverlay() {
        document.getElementById('sfRowEditorOverlay')?.remove();
        _state.rowEditor = null;
    }

    // ═══ TOTALS & VALIDATION ═══
    function recalcTotals() {
        const wrap = document.getElementById('sfTotals'); if (!wrap) return;
        let tb = 0, ts = 0;
        _state.items.forEach(it => { tb += it.mabBed || 0; ts += it.mabBes || 0; });
        const diff = tb - ts;
        const bal = Math.abs(diff) < 0.01;
        wrap.innerHTML = `
            <div class="sf-total-item"><span>جمع بدهکار:</span> <strong>${H.fmt(tb)}</strong></div>
            <div class="sf-total-item"><span>جمع بستانکار:</span> <strong>${H.fmt(ts)}</strong></div>
            <div class="sf-total-item" style="color:${bal ? '#059669' : '#DC2626'};"><span>تفاوت:</span> <strong>${H.fmt(Math.abs(diff))} ${bal ? '✅ تراز' : ''}</strong></div>`;
    }

    function _detectRowErrors(it) {
        const errs = [];
        const hasAmt = (it.mabBed || 0) > 0 || (it.mabBes || 0) > 0;
        if (!it.codeCol && hasAmt) errs.push({ severity: 'error', label: 'کد کل ندارد' });
        if (it.codeCol > 0 && !it.codeMoein && hasAmt) errs.push({ severity: 'warn', label: 'معین ندارد' });
        const m = _cache.moeins.find(x => x.codeCol === it.codeCol && x.codeMoein === it.codeMoein);
        if (m?.hasTafzili && hasAmt && !it.codeTafzil) errs.push({ severity: 'error', label: 'تفصیلی ۱ ندارد' });
        if (m?.hasTafzili2 && hasAmt && !it.codeTafzili2) errs.push({ severity: 'error', label: 'تفصیلی ۲ ندارد' });
        if (m?.isStock && hasAmt && !it.meghdar) errs.push({ severity: 'error', label: 'مقدار ندارد' });
        return errs;
    }

    function _validateVazeit(vazeit, tb, ts) {
        if (vazeit === 0) return { ok: true };
        const issues = [];
        _state.items.forEach((it, i) => {
            if (!it.codeCol && !it.mabBed && !it.mabBes) return;
            _detectRowErrors(it).forEach(e => { if (vazeit === 1 && e.severity !== 'error') return; issues.push(`ردیف ${i + 1}: ${e.label}`); });
        });
        if (vazeit === 2 && Math.abs(tb - ts) > 0.01) issues.push(`سند تراز نیست (تفاوت: ${H.fmt(Math.abs(tb - ts))})`);
        return { ok: issues.length === 0, issues };
    }

    // ═══ BIND EVENTS (SUMMARY TABLE) ═══
    let _keyHandler = null;

    function bindEvents() {
        document.getElementById('sfAddRow')?.addEventListener('click', () => openRowEditor('create', -1));
        document.getElementById('sfSaveBtn')?.addEventListener('click', save);
        document.getElementById('sfCancelBtn')?.addEventListener('click', handleClose);
        document.getElementById('sfCopyBtn')?.addEventListener('click', copyRows);
        document.getElementById('sfPasteBtn')?.addEventListener('click', pasteRows);

        const wrap = document.getElementById('sfSummaryWrap');
        wrap.addEventListener('click', async (e) => {
            if (e.target.classList.contains('sf-sum-cb') || e.target.id === 'sfSumSelectAll') return; // هندل در change
            const btn = e.target.closest('.sf-act-btn');
            if (btn) {
                const tr = btn.closest('tr'); const idx = parseInt(tr.dataset.idx); const action = btn.dataset.action;
                if (action === 'edit') openRowEditor('edit', idx);
                else if (action === 'up' && idx > 0) { [_state.items[idx - 1], _state.items[idx]] = [_state.items[idx], _state.items[idx - 1]]; renderSummary(); }
                else if (action === 'down' && idx < _state.items.length - 1) { [_state.items[idx], _state.items[idx + 1]] = [_state.items[idx + 1], _state.items[idx]]; renderSummary(); }
                else if (action === 'swap') { const it = _state.items[idx];[it.mabBed, it.mabBes] = [it.mabBes, it.mabBed]; renderSummary(); }
                else if (action === 'tik') { _state.items[idx].tikRow = _state.items[idx].tikRow === 1 ? 0 : 1; renderSummary(); }
                else if (action === 'dup') { const c = cloneItem(_state.items[idx]); c.sanadId = 0; _state.items.splice(idx + 1, 0, c); renderSummary(); }
                else if (action === 'del') { if (await _askConfirm('حذف شود؟', { danger: true })) { _state.items.splice(idx, 1); renderSummary(); } }
                return;
            }
            const tr = e.target.closest('tr[data-idx]');
            if (tr) openRowEditor('edit', parseInt(tr.dataset.idx));
        });

        wrap.addEventListener('change', (e) => {
            if (e.target.id === 'sfSumSelectAll') {
                if (e.target.checked) _state.items.forEach((_, i) => _state.selectedRows.add(i));
                else _state.selectedRows.clear();
                renderSummary();
            } else if (e.target.classList.contains('sf-sum-cb')) {
                const idx = parseInt(e.target.dataset.idx);
                if (e.target.checked) _state.selectedRows.add(idx); else _state.selectedRows.delete(idx);
                e.target.closest('tr').classList.toggle('sf-tr-selected', e.target.checked);
            }
        });

        if (_keyHandler) document.removeEventListener('keydown', _keyHandler, true);
        _keyHandler = (e) => {
            if (document.getElementById('sfRowEditorOverlay') || document.querySelector('.hp-overlay')) return;

            if (e.key === 'Insert' && !e.ctrlKey) { e.preventDefault(); openRowEditor('create', -1); return; }
            if (e.key === 'Escape') { e.preventDefault(); handleClose(); return; }
            if (e.ctrlKey && (e.key === 's' || e.key === 'Enter')) { e.preventDefault(); save(); return; }
            if (e.ctrlKey && e.key === 'e') { e.preventDefault(); const tr = wrap.querySelector('tr.sf-tr-selected') || wrap.querySelector('tr'); if (tr) openRowEditor('edit', parseInt(tr.dataset.idx)); return; }
            if (e.ctrlKey && e.key === 'F9') { e.preventDefault(); copyRows(); return; }
            if (e.ctrlKey && e.key === 'F10') { e.preventDefault(); pasteRows(); return; }
        };
        document.addEventListener('keydown', _keyHandler, true);
    }

    function copyRows() {
        const sel = _state.selectedRows.size > 0 ? [..._state.selectedRows].map(i => _state.items[i]) : _state.items;
        if (!sel.length) return;
        setClipboard(sel.map(cloneItem));
        _toast(`${sel.length} ردیف کپی شد`, 'success'); renderSummary();
    }
    function pasteRows() {
        const clip = getClipboard(); if (!clip.length) return;
        clip.forEach(c => { const n = cloneItem(c); n.sanadId = 0; _state.items.push(n); });
        _toast(`${clip.length} ردیف الحاق شد`, 'success'); renderSummary();
    }

    // ═══ SAVE & DELETE ═══
    async function save() {
        if (document.getElementById('sfRowEditorOverlay')) { _toast('ابتدا فرم ردیف را ذخیره کنید', 'warn'); return; }
        const btn = document.getElementById('sfSaveBtn'); const orig = btn.textContent; btn.disabled = true; btn.textContent = '⏳ ذخیره...';

        const dateIn = document.getElementById('sfDateIn').value.trim();
        const valid = _state.items.filter(it => it.codeCol > 0 && (it.mabBed > 0 || it.mabBes > 0));
        for (let i = 0; i < valid.length; i++) {
            const err = validateHesabCodes(valid[i]);
            if (err) {
                _toast(`ردیف ${i + 1}: ${err}`, 'error');
                return; // کل عملیات ذخیره متوقف می‌شود
            }
        }
        if (!dateIn || !valid.length) { _toast('تاریخ و حداقل یک ردیف معتبر الزامی است', 'error'); btn.disabled = false; btn.textContent = orig; return; }

        const payload = {
            noSanad: parseInt(document.getElementById('sfNoSanad').value) || null,
            dateIn, otherParentSharh: document.getElementById('sfParentSharh').value, vazeit: parseInt(document.getElementById('sfVazeit').value) || 0, kindSanad: parseInt(document.getElementById('sfKindSanad').value) || 0,
            items: valid.map((it, i) => ({ rowNum: i + 1, codeCol: it.codeCol, codeMoein: it.codeMoein, codeTafzil: it.codeTafzil, codeTafzili2: it.codeTafzili2, tafzili2Id: it.tafzili2Id, codeSharh: it.codeSharh, otherSharh: it.otherSharh, mabBed: it.mabBed, mabBes: it.mabBes, meghdar: Math.abs(it.meghdar || 0), tikRow: it.tikRow || 0, doDate: it.doDate || null, doOk: !!it.doOK }))
        };

        try {
            if (_state.isEdit) { payload.parentSanadId = _state.parentSanadId; await window.App.Http.api(`/api/sanad/${_state.parentSanadId}`, { method: 'PUT', body: JSON.stringify(payload) }); }
            else { await window.App.Http.api('/api/sanad', { method: 'POST', body: JSON.stringify(payload) }); }
            _toast('ذخیره شد', 'success'); if (_keyHandler) document.removeEventListener('keydown', _keyHandler, true); window.App.closeModal();
            if (window.App.state.currentPage === 'sanad') window.App.Features.Sanad.loadList();
        } catch (e) { _toast('خطا: ' + e.message, 'error'); btn.disabled = false; btn.textContent = orig; }
    }

    async function handleClose() {
        if (_state.dirty && !await _askConfirm('تغییرات ذخیره نشده است. خارج می‌شوید؟', { danger: true })) return;
        if (_keyHandler) document.removeEventListener('keydown', _keyHandler, true);
        window.App.closeModal();
    }

    async function deleteSanad(id) {
        if (!await _askConfirm('آیا از حذف سند مطمئن هستید؟', { danger: true })) return;
        await window.App.Http.api(`/api/sanad/${id}`, { method: 'DELETE' }); _toast('حذف شد', 'success'); window.App.Features.Sanad.loadList();
    }

    return { openCreate, openEdit, delete: deleteSanad };
})();

window.App.openSanadCreate = window.App.Features.SanadForm.openCreate;
window.App.openSanadEdit = window.App.Features.SanadForm.openEdit;
window.App.deleteSanad = window.App.Features.SanadForm.delete;