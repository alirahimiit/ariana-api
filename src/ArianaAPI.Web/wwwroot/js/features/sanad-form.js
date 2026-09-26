/* ═══════════════════════════════════════════════════
   Feature / SanadForm — فرم ثبت/ویرایش سند
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.SanadForm = (function () {
    'use strict';

    const H = window.App.Helpers;

    let _state = { isEdit: false, parentSanadId: null, items: [] };
    let _cache = { cols: [], moeins: [], tafzils: [], loaded: false };

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

    function parseNum(v) {
        if (!v) return 0;
        const n = parseFloat(String(v).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d.\-]/g, ''));
        return isNaN(n) ? 0 : n;
    }

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

    // ═══ OPEN CREATE ═══
    async function openCreate() {
        // ⭐ گارد دسترسی (defense in depth)
        if (window.App.Permissions && !window.App.Permissions.can(101)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        _state = { isEdit: false, parentSanadId: null, items: [emptyRow()] };
        await ensureLookups();
        const body = buildFormHtml({ noSanad: '', dateIn: today(), otherParentSharh: '', vazeit: 0, kindSanad: 0 });
        window.App.openModal('➕ سند جدید', body);
        document.querySelector('.modal-box')?.classList.add('wide-modal');
        bindEvents();
        renderRows();
    }

    // ═══ OPEN EDIT ═══
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
                isEdit: true, parentSanadId: id,
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
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══ BUILD FORM ═══
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
                </div>

                <div class="sanad-form-rows-header">
                    <h4>📋 ردیف‌های سند</h4>
                    <button type="button" class="btn btn-primary btn-sm" id="sfAddRow">➕ افزودن ردیف</button>
                </div>

                <div id="sfRowsWrap"></div>

                <div class="sanad-form-sticky">
                    <div class="sanad-form-totals" id="sfTotals"></div>
                    <div class="sanad-form-footer">
                        <button type="button" class="btn btn-primary" id="sfSaveBtn">💾 ذخیره <span class="kbd-hint">F2</span></button>
                        <button type="button" class="btn btn-ghost" id="sfCancelBtn">انصراف</button>
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
        const counter = document.getElementById('sfRowCount');
        if (counter) counter.textContent = `(${_state.items.length} ردیف)`;
    }

    function buildRowHtml(item, idx) {
        const colOpts = ['<option value="0">-- کل --</option>']
            .concat(_cache.cols.map(c => `<option value="${c.codeCol}" ${item.codeCol === c.codeCol ? 'selected' : ''}>${c.codeCol} - ${H.esc(c.name)}</option>`)).join('');

        const moeinList = item.codeCol ? moeinsOfCol(item.codeCol) : [];
        const moeinOpts = ['<option value="0">-- معین --</option>']
            .concat(moeinList.map(m => `<option value="${m.codeMoein}" ${item.codeMoein === m.codeMoein ? 'selected' : ''}>${m.codeMoein} - ${H.esc(m.name)}</option>`)).join('');

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

        return `
            <div class="sf-row">
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
                                       placeholder="🔍 جستجو..." readonly
                                       style="cursor:pointer; background:#F9FAFB;">
                                <button type="button" class="sf-pick-btn" data-idx="${idx}" data-pick="moein" title="انتخاب معین">🔍</button>
                            </div>
                        </div>
                           <div class="sf-field">
                            <label>تفصیلی ۱ ${tafzilName ? `<span class="sf-hint">— ${H.esc(tafzilName)}</span>` : ''}</label>
                            <div class="sf-input-with-btn">
                                <input type="number" class="sf-tafzil num-input" data-idx="${idx}"
                                       value="${item.codeTafzil || ''}" placeholder="کد"
                                       ${canTafzil1 ? '' : 'disabled title="این معین تفصیلی ندارد"'}>
                                ${canTafzil1 ? `<button type="button" class="sf-pick-btn" data-idx="${idx}" data-pick="tafzil" title="انتخاب تفصیلی">🔍</button>` : ''}
                            </div>
                        </div>
                        <div class="sf-field">
                            <label>تفصیلی ۲</label>
                            <div class="sf-input-with-btn">
                                <input type="number" class="sf-tafzil2 num-input" data-idx="${idx}"
                                       value="${item.codeTafzili2 || ''}" placeholder="کد"
                                       ${canTafzil2 ? '' : 'disabled title="این معین تفصیلی ۲ ندارد"'}>
                            </div>
                        </div>

                    </div>
                    <div class="sf-line sf-line-values">
                        <div class="sf-field">
                            <label>بدهکار</label>
                            <input type="text" class="sf-bed num-input" data-idx="${idx}" value="${bed ? H.fmt(bed) : ''}" placeholder="0">
                        </div>
                        <div class="sf-field">
                            <label>بستانکار</label>
                            <input type="text" class="sf-bes num-input" data-idx="${idx}" value="${bes ? H.fmt(bes) : ''}" placeholder="0">
                        </div>
                        <div class="sf-field">
                            <label>مقدار ${isStock ? '<span class="sf-hint sf-stock-req">* انبار — اجباری</span>' : ''}</label>
                            <input type="text" class="sf-meghdar num-input ${isStock ? 'sf-required-stock' : ''}" data-idx="${idx}"
                                   value="${megh ? H.fmt(megh) : ''}" placeholder="${isStock ? 'اجباری' : '0'}"
                                   ${isStock ? '' : 'disabled title="این حساب انباری نیست — مقدار لازم ندارد"'}>
                        </div>
                        <div class="sf-field sf-field-wide">
                            <label>شرح ردیف</label>
                            <input type="text" class="sf-sharh" data-idx="${idx}" value="${H.esc(item.otherSharh || '')}" placeholder="شرح ردیف">
                        </div>
                    </div>
                </div>
                <button type="button" class="sf-row-del" data-idx="${idx}" title="حذف">🗑️</button>
            </div>`;
    }

    // ═══ BIND ═══
    let _keyHandler = null;

    function bindEvents() {
        const mb = document.getElementById('modalBody');
        if (!mb) return;

        document.getElementById('sfAddRow')?.addEventListener('click', () => {
            _state.items.push(emptyRow());
            renderRows();
        });

        document.getElementById('sfSaveBtn')?.addEventListener('click', save);
        document.getElementById('sfCancelBtn')?.addEventListener('click', () => window.App.closeModal());

        mb.addEventListener('change', onFieldChange);
        mb.addEventListener('input', onFieldInput);
        mb.addEventListener('click', onRowClick);

        // keyboard
        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = (e) => {
            if ((e.ctrlKey && e.key === 's') || e.key === 'F2') { e.preventDefault(); save(); }
            else if (e.key === 'Escape') { e.preventDefault(); window.App.closeModal(); document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
        };
        document.addEventListener('keydown', _keyHandler);
    }

    function onFieldChange(e) {
        const t = e.target;
        const idx = parseInt(t.dataset.idx);
        if (isNaN(idx)) return;

        if (t.classList.contains('sf-col')) {
            _state.items[idx].codeCol = parseInt(t.value) || 0;
            _state.items[idx].codeMoein = 0;
            _state.items[idx].codeTafzil = 0;
            _state.items[idx].codeTafzili2 = 0;
            renderRows();
        }  else if (t.classList.contains('sf-tafzil2')) {
            _state.items[idx].codeTafzili2 = parseInt(t.value) || 0;
        } else if (t.classList.contains('sf-tafzil')) {
            _state.items[idx].codeTafzil = parseInt(t.value) || 0;
            const name = findTafzilName(t.value);
            const label = t.parentElement.querySelector('label');
            if (label) {
                label.innerHTML = `تفصیلی ۱ ${name ? `<span class="sf-hint">— ${H.esc(name)}</span>` : ''}`;
            }
        }
    }

    function onFieldInput(e) {
        const t = e.target;
        const idx = parseInt(t.dataset.idx);
        if (isNaN(idx)) return;

        if (t.classList.contains('sf-sharh')) {
            _state.items[idx].otherSharh = t.value;
        } else if (t.classList.contains('sf-bed')) {
            const v = parseNum(t.value);
            _state.items[idx].mabBed = v;
            if (v > 0) {
                _state.items[idx].mabBes = 0;
                const besInput = document.querySelector(`.sf-bes[data-idx="${idx}"]`);
                if (besInput) besInput.value = '';
            }
            recalcTotals();
        } else if (t.classList.contains('sf-bes')) {
            const v = parseNum(t.value);
            _state.items[idx].mabBes = v;
            if (v > 0) {
                _state.items[idx].mabBed = 0;
                const bedInput = document.querySelector(`.sf-bed[data-idx="${idx}"]`);
                if (bedInput) bedInput.value = '';
            }
            recalcTotals();
        } else if (t.classList.contains('sf-meghdar')) {
            const v = Math.abs(parseNum(t.value));   // ⭐ همیشه مثبت
            _state.items[idx].meghdar = v;
            // اگه کاربر منفی زد، خودکار مثبت شه
            if (t.value.startsWith('-')) {
                t.value = H.fmt(v);
            }
        }
    }

    function onRowClick(e) {
        if (e.target.classList.contains('sf-row-del')) {
            const idx = parseInt(e.target.dataset.idx);
            _state.items.splice(idx, 1);
            if (_state.items.length === 0) _state.items.push(emptyRow());
            renderRows();
        } else if (e.target.classList.contains('sf-pick-btn')) {
            const idx = parseInt(e.target.dataset.idx);
            const pick = e.target.dataset.pick;
            if (pick === 'moein') openMoeinPicker(idx);
            else openTafzilPicker(idx);
        }
    }
    // ═══ Tafzil Picker ═══
    function openTafzilPicker(rowIdx) {
        const list = _cache.tafzils || [];
        const currentCode = _state.items[rowIdx].codeTafzil;

        const modalBody = document.getElementById('modalBody');
        const pickerId = 'sfTafzilPicker';
        const existing = document.getElementById(pickerId);
        if (existing) existing.remove();

        const picker = document.createElement('div');
        picker.id = pickerId;
        picker.className = 'sf-picker-overlay';
        picker.innerHTML = `
            <div class="sf-picker-box">
                <div class="sf-picker-header">
                    <span>🔍 انتخاب تفصیلی ۱</span>
                    <button type="button" class="sf-picker-close">✕</button>
                </div>
                <div class="sf-picker-search">
                    <input type="text" id="sfTafzilSearch" placeholder="جستجو (کد یا نام)..." autofocus>
                </div>
                <div class="sf-picker-list" id="sfTafzilList"></div>
            </div>`;

        modalBody.appendChild(picker);

        const searchInput = picker.querySelector('#sfTafzilSearch');
        const listWrap = picker.querySelector('#sfTafzilList');

        function renderPickerList(filter = '') {
            const f = filter.trim().toLowerCase();
            const filtered = !f
                ? list
                : list.filter(x =>
                    String(x.code).includes(f) ||
                    (x.name || '').toLowerCase().includes(f)
                );

            if (filtered.length === 0) {
                listWrap.innerHTML = '<div class="sf-picker-empty">موردی یافت نشد</div>';
                return;
            }

            listWrap.innerHTML = filtered.slice(0, 200).map(x => `
                <div class="sf-picker-item ${x.code === currentCode ? 'selected' : ''}"
                     data-code="${x.code}" data-name="${H.esc(x.name || '')}">
                    <span class="sf-picker-code">${x.code}</span>
                    <span class="sf-picker-name">${H.esc(x.name || '')}</span>
                </div>`).join('');
        }

        renderPickerList();

        searchInput.addEventListener('input', () => renderPickerList(searchInput.value));

        picker.querySelector('.sf-picker-close').addEventListener('click', () => picker.remove());

        picker.addEventListener('click', (e) => {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.sf-picker-item');
            if (!item) return;
            const code = parseInt(item.dataset.code);
            const name = item.dataset.name;
            _state.items[rowIdx].codeTafzil = code;
            picker.remove();
            renderRows();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') picker.remove();
            if (e.key === 'Enter') {
                const first = listWrap.querySelector('.sf-picker-item');
                if (first) first.click();
            }
        });

        setTimeout(() => searchInput.focus(), 50);
    }
    // ═══ Moein Picker ═══
    function openMoeinPicker(rowIdx) {
        const allMoeins = _cache.moeins || [];
        const currentCodeCol = _state.items[rowIdx].codeCol;
        const currentMoein = _state.items[rowIdx].codeMoein;

        // نگاشت col names برای نمایش
        const colNameMap = {};
        (_cache.cols || []).forEach(c => { colNameMap[c.codeCol] = c.name; });

        const mb = document.getElementById('modalBody');
        const pickerId = 'sfMoeinPicker';
        document.getElementById(pickerId)?.remove();

        const picker = document.createElement('div');
        picker.id = pickerId;
        picker.className = 'sf-picker-overlay';
        picker.innerHTML = `
            <div class="sf-picker-box" style="max-width: 700px;">
                <div class="sf-picker-header">
                    <span>🔍 انتخاب کد معین</span>
                    <button type="button" class="sf-picker-close">✕</button>
                </div>
                <div class="sf-picker-search">
                    <input type="text" id="sfMoeinSearch" placeholder="جستجو بر اساس نام یا کد (مثلاً «بانک»)...">
                </div>
                <div class="sf-picker-list" id="sfMoeinList"></div>
            </div>`;

        mb.appendChild(picker);

        const searchInput = picker.querySelector('#sfMoeinSearch');
        const listWrap = picker.querySelector('#sfMoeinList');

        function renderList(filter = '') {
            const f = filter.trim().toLowerCase();
            let filtered = allMoeins;

            // اگه کاربر ابتدا کل رو انتخاب کرده، فیلتر به همون کل
            if (currentCodeCol > 0) {
                filtered = filtered.filter(m => m.codeCol === currentCodeCol);
            }

            if (f) {
                filtered = filtered.filter(m =>
                    String(m.codeMoein).includes(f) ||
                    (m.name || '').toLowerCase().includes(f) ||
                    String(m.codeCol).includes(f)
                );
            }

            if (filtered.length === 0) {
                listWrap.innerHTML = '<div class="sf-picker-empty">موردی یافت نشد</div>';
                return;
            }

            listWrap.innerHTML = filtered.slice(0, 300).map(m => {
                const isSelected = m.codeCol === currentCodeCol && m.codeMoein === currentMoein;
                const colName = colNameMap[m.codeCol] || '';
                return `
                    <div class="sf-picker-item moein-item ${isSelected ? 'selected' : ''}"
                         data-col="${m.codeCol}"
                         data-moein="${m.codeMoein}">
                        <span class="sf-picker-code">${m.codeCol} - ${m.codeMoein}</span>
                        <div class="sf-picker-name">
                            <div>${H.esc(m.name || '')}</div>
                            ${colName ? `<div class="sf-picker-parent">${H.esc(colName)}</div>` : ''}
                        </div>
                        <div class="sf-picker-badges">
                            ${m.hasTafzili ? '<span class="sf-badge-mini">تفصیلی</span>' : ''}
                            ${m.hasTafzili2 ? '<span class="sf-badge-mini">تفصیلی۲</span>' : ''}
                            ${m.isStock ? '<span class="sf-badge-mini sf-badge-stock">انبار</span>' : ''}
                        </div>
                    </div>`;
            }).join('');
        }

        renderList();
        setTimeout(() => searchInput.focus(), 50);

        searchInput.addEventListener('input', () => renderList(searchInput.value));

        picker.querySelector('.sf-picker-close').addEventListener('click', () => picker.remove());
        picker.addEventListener('click', (e) => {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.moein-item');
            if (!item) return;

            const codeCol = parseInt(item.dataset.col);
            const codeMoein = parseInt(item.dataset.moein);

            _state.items[rowIdx].codeCol = codeCol;
            _state.items[rowIdx].codeMoein = codeMoein;
            _state.items[rowIdx].codeTafzil = 0;
            _state.items[rowIdx].codeTafzili2 = 0;

            picker.remove();
            renderRows();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') picker.remove();
            if (e.key === 'Enter') {
                const first = listWrap.querySelector('.moein-item');
                if (first) first.click();
            }
        });
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

        if (!dateIn) { window.App.toast('تاریخ سند الزامی است', 'error'); return; }

        const valid = _state.items.filter(it => it.codeCol > 0 && (it.mabBed > 0 || it.mabBes > 0));
        if (valid.length === 0) { window.App.toast('حداقل یک ردیف با کد کل و مبلغ لازم است', 'error'); return; }

        let tb = 0, ts = 0;
        valid.forEach(it => { tb += it.mabBed || 0; ts += it.mabBes || 0; });
        if (Math.abs(tb - ts) > 0.01) { if (!confirm('سند تراز نیست. ادامه می‌دهید؟')) return; }

        const payload = {
            noSanad: noStr && !isNaN(parseInt(noStr)) ? parseInt(noStr) : null,
            dateIn, otherParentSharh: sharh, parentSharhCode: null, vazeit, kindSanad: kind,
            items: valid.map((it, i) => ({
                rowNum: i + 1, codeCol: it.codeCol, codeMoein: it.codeMoein,
                codeTafzil: it.codeTafzil, codeTafzili2: it.codeTafzili2,
                tafzili2Id: it.tafzili2Id, codeSharh: it.codeSharh,
                otherSharh: it.otherSharh, mabBed: it.mabBed, mabBes: it.mabBes, meghdar: Math.abs(it.meghdar || 0)
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
            if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
            window.App.closeModal();
            window.App.Features.Sanad.loadList();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        } finally {
            btn.disabled = false; btn.textContent = orig;
        }
    }

    // ═══ DELETE ═══
    async function deleteSanad(id) {
        // ⭐ گارد دسترسی
        if (window.App.Permissions && !window.App.Permissions.can(108)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
        if (!confirm('آیا از حذف این سند مطمئن هستید؟')) return;
        try {
            await window.App.Http.api(`/api/sanad/${id}`, { method: 'DELETE' });
            window.App.toast('سند حذف شد', 'success');
            window.App.Features.Sanad.loadList();
        } catch (err) { window.App.toast('خطا: ' + err.message, 'error'); }
    }

    return { openCreate, openEdit, delete: deleteSanad };
})();

window.App.openSanadCreate = window.App.Features.SanadForm.openCreate;
window.App.openSanadEdit = window.App.Features.SanadForm.openEdit;
window.App.deleteSanad = window.App.Features.SanadForm.delete;