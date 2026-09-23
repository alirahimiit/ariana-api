/* ═══════════════════════════════════════════════════
   Feature / ArticleForm — فرم ویرایش کالا
   ═══════════════════════════════════════════════════
   وابستگی‌ها:
     - window.App.Helpers (fmt, esc)
     - window.App.Http (api)
     - window.App.openModal / closeModal / toast
     - window.App.Features.Article.loadList (برای ریفرش)
   ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   Feature / ArticleForm — ویرایش + درج کالا (v4)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.ArticleForm = (function () {
    'use strict';

    const H = window.App.Helpers;

    let _state = { mode: 'edit', articleId: null, data: null };
    let _cache = {
        groups: [],
        units: [],
        stockTypes: [],
        cols: [],
        moeins: [],
        tafzils: [],
        loaded: false
    };

    // ═══════════════════════════════════════
    //  LOOKUPS
    // ═══════════════════════════════════════
    async function ensureLookups() {
        if (_cache.loaded) return;
        try {
            const [artLookups, tree, tafziliResp] = await Promise.all([
                window.App.Http.api('/api/article/lookups'),
                window.App.Http.api('/api/hesab/tree'),
                window.App.Http.api('/api/tafzili/list', {
                    method: 'POST',
                    body: JSON.stringify({ page: 1, pageSize: 100000, mandehFilter: 'all' })
                }).catch(() => ({ items: [] }))
            ]);

            _cache.groups = artLookups && artLookups.groups ? artLookups.groups : [];
            _cache.units = artLookups && artLookups.units ? artLookups.units : [];
            _cache.stockTypes = artLookups && artLookups.stockTypes ? artLookups.stockTypes : [];
            _cache.cols = (tree || []).filter(x => x.level === 'col').sort((a, b) => a.codeCol - b.codeCol);
            _cache.moeins = (tree || []).filter(x => x.level === 'moein').sort((a, b) => a.codeCol - b.codeCol || a.codeMoein - b.codeMoein);
            _cache.tafzils = (tafziliResp && tafziliResp.items ? tafziliResp.items : []).map(t => ({
                code: parseInt(t.codeTafzil),
                name: t.name
            }));
            _cache.loaded = true;
        } catch (err) {
            console.error('Lookups load failed:', err);
            window.App.toast('خطا در بارگذاری اطلاعات پایه', 'error');
        }
    }

    // ═══════════════════════════════════════
    //  OPEN CREATE
    // ═══════════════════════════════════════
    async function openCreate() {
        try {
            await ensureLookups();
            _state = { mode: 'create', articleId: null, data: {} };
            window.App.openModal('➕ کالای جدید', buildFormHtml({}));
            bindEvents();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════
    //  OPEN EDIT
    // ═══════════════════════════════════════
    async function openEdit(articleId) {
        try {
            await ensureLookups();
            const data = await window.App.Http.api('/api/article/' + articleId);
            if (!data) {
                window.App.toast('کالا یافت نشد', 'error');
                return;
            }
            _state = { mode: 'edit', articleId: articleId, data: data };
            window.App.openModal('✏️ ویرایش کالا: ' + (data.name || ''), buildFormHtml(data));
            bindEvents();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════
    //  BUILD FORM
    // ═══════════════════════════════════════
    function buildFormHtml(d) {
        const isEdit = _state.mode === 'edit';

        let html = '<div class="af-form">';
        html += sectionStockGroup(d, isEdit);
        html += sectionBasic(d);
        html += sectionUnits(d);
        html += sectionCoding('خرید', 'buy', d.codeColBuy, d.codeMoeinBuy, d.codeTafzilBuy, '🛒');
        html += sectionCoding('فروش', 'sale', d.codeCol, d.codeMoein, d.codeTafzil, '💵');
        html += sectionCoding('برگشت خرید', 'rebuy', d.codeColReBuy, d.codeMoeinReBuy, d.codeTafzilReBuy, '↩️');
        html += sectionCoding('برگشت فروش', 'resale', d.codeColReSale, d.codeMoeinReSale, d.codeTafzilReSale, '↪️');
        html += sectionPrices(d);
        html += sectionSettings(d);
        html += '<div class="af-footer">';
        html += '<button type="button" class="btn btn-primary" id="afSaveBtn">💾 ';
        html += (isEdit ? 'ذخیره' : 'ثبت کالا');
        html += ' <span class="kbd-hint">F2</span></button>';
        html += '<button type="button" class="btn btn-ghost" id="afCancelBtn">انصراف <span class="kbd-hint">Esc</span></button>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    // ═══════════════════════════════════════
    //  Section: انبار و گروه
    // ═══════════════════════════════════════
    function sectionStockGroup(d, isEdit) {
        if (isEdit) {
            return '<div class="af-section af-section-top">' +
                '<div class="af-section-title">📦 انبار و گروه کالا</div>' +
                '<div class="af-grid af-grid-3">' +
                '<div class="af-field">' +
                '<label>انبار</label>' +
                '<input type="text" value="' + H.esc(d.stockTypeName || '') + '" readonly class="af-readonly">' +
                '</div>' +
                '<div class="af-field">' +
                '<label>گروه کالا</label>' +
                '<input type="text" value="' + H.esc(d.articleGroupName || '') + '" readonly class="af-readonly">' +
                '</div>' +
                '<div class="af-field">' +
                '<label>کد کالا (کدینگ) <button type="button" class="af-unlock-btn" id="afUnlockCodeBtn" title="ویرایش دستی">🔓</button></label>' +
                '<input type="text" id="afFullCode" value="' + H.esc(d.articleCoding || '') + '" readonly class="af-readonly num-input" style="font-weight:bold; color:var(--primary); direction:ltr; text-align:center;">' +
                '</div>' +
                '</div>' +
                '</div>';
        }

        let stockOpts = '<option value="0">-- انتخاب انبار --</option>';
        _cache.stockTypes.forEach(s => {
            stockOpts += '<option value="' + s.id + '">' + H.esc(s.name || '') + ' (کد ' + (s.code || '') + ')</option>';
        });

        return '<div class="af-section af-section-top">' +
            '<div class="af-section-title">📦 انبار و گروه کالا (اول این رو انتخاب کن)</div>' +
            '<div class="af-grid af-grid-3">' +
            '<div class="af-field">' +
            '<label>انبار <span class="req">*</span></label>' +
            '<select id="afStockTypeId">' + stockOpts + '</select>' +
            '</div>' +
            '<div class="af-field">' +
            '<label>گروه کالا <span class="req">*</span></label>' +
            '<select id="afGroupId"><option value="0">-- ابتدا انبار --</option></select>' +
            '</div>' +
            '<div class="af-field">' +
            '<label>کد کالا (خودکار) <button type="button" class="af-unlock-btn" id="afUnlockCodeBtn" title="ویرایش دستی">🔓</button></label>' +
            '<input type="text" id="afFullCode" readonly class="af-readonly num-input" placeholder="خودکار" style="font-weight:bold; color:var(--primary); direction:ltr; text-align:center;">' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════
    //  Section: اطلاعات پایه
    // ═══════════════════════════════════════
    function sectionBasic(d) {
        return '<div class="af-section">' +
            '<div class="af-section-title">📋 اطلاعات پایه</div>' +
            '<div class="af-grid af-grid-2">' +
            '<div class="af-field">' +
            '<label>نام کالا <span class="req">*</span></label>' +
            '<input type="text" id="afName" value="' + H.esc(d.name || '') + '">' +
            '</div>' +
            '<div class="af-field">' +
            '<label>شناسه مالیاتی</label>' +
            '<input type="text" id="afTaxId" value="' + H.esc(d.taxId || '') + '" dir="ltr">' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════
    //  Section: واحدها و وضعیت
    // ═══════════════════════════════════════
    function sectionUnits(d) {
        let unitOpts = '<option value="0">-- انتخاب --</option>';
        _cache.units.forEach(u => {
            const sel = String(u.id) === String(d.articleUnitId) ? 'selected' : '';
            unitOpts += '<option value="' + u.id + '" ' + sel + '>' + H.esc(u.name || '') + '</option>';
        });

        let unit2Opts = '<option value="0">-- انتخاب --</option>';
        _cache.units.forEach(u => {
            const sel = String(u.id) === String(d.articleUnitId2) ? 'selected' : '';
            unit2Opts += '<option value="' + u.id + '" ' + sel + '>' + H.esc(u.name || '') + '</option>';
        });

        let unit3Opts = '<option value="0">-- انتخاب --</option>';
        _cache.units.forEach(u => {
            const sel = String(u.id) === String(d.articleUnitId3) ? 'selected' : '';
            unit3Opts += '<option value="' + u.id + '" ' + sel + '>' + H.esc(u.name || '') + '</option>';
        });

        return '<div class="af-section">' +
            '<div class="af-section-title">📏 واحدها و وضعیت</div>' +
            '<div class="af-grid af-grid-4">' +
            '<div class="af-field">' +
            '<label>واحد اصلی <span class="req">*</span></label>' +
            '<select id="afUnitId">' + unitOpts + '</select>' +
            '</div>' +
            '<div class="af-field">' +
            '<label>واحد دوم</label>' +
            '<select id="afUnitId2">' + unit2Opts + '</select>' +
            '</div>' +
            '<div class="af-field">' +
            '<label>واحد سوم</label>' +
            '<select id="afUnitId3">' + unit3Opts + '</select>' +
            '</div>' +
            '<div class="af-field">' +
            '<label>وضعیت کالا</label>' +
            '<select id="afStatus">' +
            '<option value="0"' + (d.status === 0 ? ' selected' : '') + '>غیرفعال</option>' +
            '<option value="1"' + (d.status === 1 || d.status === undefined ? ' selected' : '') + '>فعال</option>' +
            '<option value="2"' + (d.status === 2 ? ' selected' : '') + '>انباری</option>' +
            '<option value="3"' + (d.status === 3 ? ' selected' : '') + '>اموالی</option>' +
            '</select>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════
    //  Section: کدینگ
    // ═══════════════════════════════════════
    function sectionCoding(title, key, codeCol, codeMoein, codeTafzil, icon) {
        const colName = findColName(codeCol);
        const moeinName = findMoeinName(codeCol, codeMoein);
        const tafzilName = findTafzilName(codeTafzil);

        return '<div class="af-section">' +
            '<div class="af-section-title">' + icon + ' کدینگ ' + title + '</div>' +
            '<div class="af-grid af-grid-3">' +
            '<div class="af-field">' +
            '<label>کد کل</label>' +
            '<input type="text" id="afCodeCol_' + key + '" value="' + H.esc(codeCol || '') + '" class="num-input" oninput="App.Features.ArticleForm.refreshNames(\'' + key + '\')">' +
            '<div class="af-code-name" id="afCodeColName_' + key + '">' + H.esc(colName) + '</div>' +
            '</div>' +
            '<div class="af-field">' +
            '<label>کد معین</label>' +
            '<div class="af-input-with-btn">' +
            '<input type="text" id="afCodeMoein_' + key + '" value="' + H.esc(codeMoein || '') + '" class="num-input" oninput="App.Features.ArticleForm.refreshNames(\'' + key + '\')">' +
            '<button type="button" class="af-pick-btn" data-pick="moein" data-section="' + key + '">🔍</button>' +
            '</div>' +
            '<div class="af-code-name" id="afCodeMoeinName_' + key + '">' + H.esc(moeinName) + '</div>' +
            '</div>' +
            '<div class="af-field">' +
            '<label>کد تفصیلی</label>' +
            '<div class="af-input-with-btn">' +
            '<input type="text" id="afCodeTafzil_' + key + '" value="' + H.esc(codeTafzil || '') + '" class="num-input" oninput="App.Features.ArticleForm.refreshNames(\'' + key + '\')">' +
            '<button type="button" class="af-pick-btn" data-pick="tafzil" data-section="' + key + '">🔍</button>' +
            '</div>' +
            '<div class="af-code-name" id="afCodeTafzilName_' + key + '">' + H.esc(tafzilName) + '</div>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════
    //  Section: قیمت‌ها
    // ═══════════════════════════════════════
    function sectionPrices(d) {
        return '<div class="af-section">' +
            '<div class="af-section-title">💰 قیمت‌ها</div>' +
            '<div class="af-grid af-grid-3">' +
            '<div class="af-field"><label>موجودی اولیه</label>' +
            '<input type="text" id="afAmountFirst" value="' + H.fmt(d.amountFirst || 0) + '" class="num-input"></div>' +
            '<div class="af-field"><label>بهای اولیه</label>' +
            '<input type="text" id="afCostFirst" value="' + H.esc(d.costFirst || 0) + '" class="num-input"></div>' +
            '<div class="af-field"><label>قیمت فروش</label>' +
            '<input type="text" id="afAmountSale" value="' + H.fmt(d.amountSale || 0) + '" class="num-input"></div>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════
    //  Section: تنظیمات
    // ═══════════════════════════════════════
    function sectionSettings(d) {
        const dep0 = (!d.depreciationType || d.depreciationType === 0) ? ' selected' : '';
        const dep1 = d.depreciationType === 1 ? ' selected' : '';
        const dep2 = d.depreciationType === 2 ? ' selected' : '';

        return '<div class="af-section">' +
            '<div class="af-section-title">⚙️ تنظیمات و استهلاک</div>' +
            '<div class="af-grid af-grid-3">' +
            '<div class="af-field"><label>درصد بازاریاب</label>' +
            '<input type="text" id="afMarketerPercent" value="' + H.esc(d.marketerPercent || 0) + '" class="num-input"></div>' +
            '<div class="af-field"><label>حد سفارش (ورود)</label>' +
            '<input type="text" id="afMaxCostOrderBy" value="' + H.esc(d.maxCostOrderBy || 0) + '" class="num-input"></div>' +
            '<div class="af-field"><label>حد سفارش (خروج)</label>' +
            '<input type="text" id="afMinCostOrderBy" value="' + H.esc(d.minCostOrderBy || 0) + '" class="num-input"></div>' +
            '<div class="af-field"><label>استهلاک (مبلغ)</label>' +
            '<input type="text" id="afDepreciation" value="' + H.esc(d.depreciation || 0) + '" class="num-input"></div>' +
            '<div class="af-field"><label>نوع استهلاک</label>' +
            '<select id="afDepreciationType">' +
            '<option value="0"' + dep0 + '>-- ندارد --</option>' +
            '<option value="1"' + dep1 + '>مستقیم</option>' +
            '<option value="2"' + dep2 + '>نزولی</option>' +
            '</select></div>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════
    //  Name lookups
    // ═══════════════════════════════════════
    function findColName(code) {
        if (!code) return '';
        const c = _cache.cols.find(x => x.codeCol === parseInt(code));
        return c ? c.name : '';
    }
    function findMoeinName(colCode, moeinCode) {
        if (!colCode || !moeinCode) return '';
        const m = _cache.moeins.find(x => x.codeCol === parseInt(colCode) && x.codeMoein === parseInt(moeinCode));
        return m ? m.name : '';
    }
    function findTafzilName(code) {
        if (!code) return '';
        const t = _cache.tafzils.find(x => x.code === parseInt(code));
        return t ? t.name : '';
    }
    function refreshNames(section) {
        const col = document.getElementById('afCodeCol_' + section);
        const moein = document.getElementById('afCodeMoein_' + section);
        const tafzil = document.getElementById('afCodeTafzil_' + section);

        const colEl = document.getElementById('afCodeColName_' + section);
        const moeinEl = document.getElementById('afCodeMoeinName_' + section);
        const tafzilEl = document.getElementById('afCodeTafzilName_' + section);

        if (colEl) colEl.textContent = findColName(col ? col.value : '');
        if (moeinEl) moeinEl.textContent = findMoeinName(col ? col.value : '', moein ? moein.value : '');
        if (tafzilEl) tafzilEl.textContent = findTafzilName(tafzil ? tafzil.value : '');
    }

    // ═══════════════════════════════════════
    //  پیش‌بینی کد کالا
    // ═══════════════════════════════════════
    async function refreshNextCode() {
        if (_state.mode !== 'create') return;
        const stockEl = document.getElementById('afStockTypeId');
        const groupEl = document.getElementById('afGroupId');
        const codeEl = document.getElementById('afFullCode');
        if (!stockEl || !groupEl || !codeEl) return;

        const stockId = parseInt(stockEl.value) || 0;
        const groupId = parseInt(groupEl.value) || 0;

        if (!stockId || !groupId) {
            codeEl.value = '';
            codeEl.placeholder = 'ابتدا انبار و گروه';
            return;
        }

        codeEl.value = '...';
        try {
            const res = await window.App.Http.api('/api/article/next-code?stockTypeId=' + stockId + '&groupId=' + groupId);
            codeEl.value = res.fullCode || '';
            codeEl.dataset.code = res.code;
            codeEl.dataset.codingStore = res.codingStore;
            codeEl.dataset.codingGroupStore = res.codingGroupStore;
        } catch (err) {
            codeEl.value = '';
            codeEl.placeholder = 'خطا';
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    function updateGroupOptions() {
        if (_state.mode !== 'create') return;
        const stockEl = document.getElementById('afStockTypeId');
        const groupSel = document.getElementById('afGroupId');
        if (!stockEl || !groupSel) return;

        const stockId = parseInt(stockEl.value) || 0;

        if (!stockId) {
            groupSel.innerHTML = '<option value="0">-- ابتدا انبار --</option>';
            refreshNextCode();
            return;
        }

        const filtered = _cache.groups.filter(g => String(g.stockTypeId) === String(stockId));
        let html = '<option value="0">-- انتخاب گروه --</option>';
        filtered.forEach(g => {
            html += '<option value="' + g.id + '">' + H.esc(g.name || '') + ' (کد ' + (g.code || '') + ')</option>';
        });
        groupSel.innerHTML = html;
        refreshNextCode();
    }

    // ═══════════════════════════════════════
    //  BIND
    // ═══════════════════════════════════════
    let _keyHandler = null;

    function bindEvents() {
        const saveBtn = document.getElementById('afSaveBtn');
        const cancelBtn = document.getElementById('afCancelBtn');
        if (saveBtn) saveBtn.addEventListener('click', save);
        if (cancelBtn) cancelBtn.addEventListener('click', function () { window.App.closeModal(); });

        // درج جدید: انبار و گروه
        if (_state.mode === 'create') {
            const stockSel = document.getElementById('afStockTypeId');
            const groupSel = document.getElementById('afGroupId');
            if (stockSel) stockSel.addEventListener('change', updateGroupOptions);
            if (groupSel) groupSel.addEventListener('change', refreshNextCode);
        }

        // Pickers
        document.querySelectorAll('.af-pick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const section = btn.dataset.section;
                if (btn.dataset.pick === 'moein') openMoeinPicker(section);
                else openTafzilPicker(section);
            });
        });

        // 🔓 ویرایش دستی کد
        const unlockBtn = document.getElementById('afUnlockCodeBtn');
        const codeInput = document.getElementById('afFullCode');
        if (unlockBtn && codeInput) {
            unlockBtn.addEventListener('click', function () {
                const isReadonly = codeInput.hasAttribute('readonly');
                if (isReadonly) {
                    if (!confirm('توجه: تغییر کد کالا ممکن است باعث ناسازگاری شود.\nمطمئن هستید؟')) return;
                    codeInput.removeAttribute('readonly');
                    codeInput.classList.remove('af-readonly');
                    codeInput.classList.add('af-code-editing');
                    codeInput.focus();
                    codeInput.select();
                    unlockBtn.textContent = '🔒';
                } else {
                    codeInput.setAttribute('readonly', 'readonly');
                    codeInput.classList.add('af-readonly');
                    codeInput.classList.remove('af-code-editing');
                    unlockBtn.textContent = '🔓';
                }
            });
        }

        // F2 / Esc
        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = function (e) {
            if (e.key === 'F2') { e.preventDefault(); save(); }
            else if (e.key === 'Escape' && !document.querySelector('.af-picker-overlay')) {
                e.preventDefault();
                window.App.closeModal();
                document.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        };
        document.addEventListener('keydown', _keyHandler);
    }

    // ═══════════════════════════════════════
    //  PICKER معین
    // ═══════════════════════════════════════
    function openMoeinPicker(section) {
        const mb = document.getElementById('modalBody');
        const pickerId = 'afMoeinPicker';
        const existing = document.getElementById(pickerId);
        if (existing) existing.remove();

        const colMap = {};
        _cache.cols.forEach(function (c) { colMap[c.codeCol] = c.name; });

        const picker = document.createElement('div');
        picker.id = pickerId;
        picker.className = 'af-picker-overlay';
        picker.innerHTML =
            '<div class="af-picker-box">' +
            '<div class="af-picker-header">' +
            '<span>🔍 انتخاب کد معین</span>' +
            '<button type="button" class="af-picker-close">✕</button>' +
            '</div>' +
            '<div class="af-picker-search">' +
            '<input type="text" id="afMoeinSearch" placeholder="جستجو (نام یا کد)...">' +
            '</div>' +
            '<div class="af-picker-list" id="afMoeinList"></div>' +
            '</div>';
        mb.appendChild(picker);

        const searchInput = picker.querySelector('#afMoeinSearch');
        const listWrap = picker.querySelector('#afMoeinList');

        function renderList(filter) {
            const f = (filter || '').trim().toLowerCase();
            let filtered = _cache.moeins;
            if (f) {
                filtered = filtered.filter(function (m) {
                    return String(m.codeMoein).indexOf(f) !== -1 ||
                        String(m.codeCol).indexOf(f) !== -1 ||
                        (m.name || '').toLowerCase().indexOf(f) !== -1;
                });
            }
            if (filtered.length === 0) {
                listWrap.innerHTML = '<div class="af-picker-empty">موردی یافت نشد</div>';
                return;
            }

            let html = '';
            filtered.slice(0, 300).forEach(function (m) {
                const colName = colMap[m.codeCol] || '';
                html += '<div class="af-picker-item" data-col="' + m.codeCol + '" data-moein="' + m.codeMoein + '">';
                html += '<span class="af-picker-code">' + m.codeCol + ' - ' + m.codeMoein + '</span>';
                html += '<div class="af-picker-name">';
                html += '<div>' + H.esc(m.name || '') + '</div>';
                if (colName) html += '<div class="af-picker-parent">' + H.esc(colName) + '</div>';
                html += '</div></div>';
            });
            listWrap.innerHTML = html;
        }
        renderList('');
        setTimeout(function () { searchInput.focus(); }, 50);
        searchInput.addEventListener('input', function () { renderList(searchInput.value); });

        picker.querySelector('.af-picker-close').addEventListener('click', function () { picker.remove(); });

        picker.addEventListener('click', function (e) {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.af-picker-item');
            if (!item) return;
            document.getElementById('afCodeCol_' + section).value = item.dataset.col;
            document.getElementById('afCodeMoein_' + section).value = item.dataset.moein;
            document.getElementById('afCodeTafzil_' + section).value = '';
            refreshNames(section);
            picker.remove();
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') picker.remove();
            if (e.key === 'Enter') {
                const first = listWrap.querySelector('.af-picker-item');
                if (first) first.click();
            }
        });
    }

    // ═══════════════════════════════════════
    //  PICKER تفصیلی
    // ═══════════════════════════════════════
    function openTafzilPicker(section) {
        const mb = document.getElementById('modalBody');
        const pickerId = 'afTafzilPicker';
        const existing = document.getElementById(pickerId);
        if (existing) existing.remove();

        const picker = document.createElement('div');
        picker.id = pickerId;
        picker.className = 'af-picker-overlay';
        picker.innerHTML =
            '<div class="af-picker-box">' +
            '<div class="af-picker-header">' +
            '<span>🔍 انتخاب کد تفصیلی ۱</span>' +
            '<button type="button" class="af-picker-close">✕</button>' +
            '</div>' +
            '<div class="af-picker-search">' +
            '<input type="text" id="afTafzilSearch" placeholder="جستجو...">' +
            '</div>' +
            '<div class="af-picker-list" id="afTafzilList"></div>' +
            '</div>';
        mb.appendChild(picker);

        const searchInput = picker.querySelector('#afTafzilSearch');
        const listWrap = picker.querySelector('#afTafzilList');
        const list = _cache.tafzils || [];

        function renderList(filter) {
            const f = (filter || '').trim().toLowerCase();
            let filtered = list;
            if (f) {
                filtered = list.filter(function (x) {
                    return String(x.code).indexOf(f) !== -1 || (x.name || '').toLowerCase().indexOf(f) !== -1;
                });
            }
            if (filtered.length === 0) {
                listWrap.innerHTML = '<div class="af-picker-empty">موردی یافت نشد</div>';
                return;
            }
            let html = '';
            filtered.slice(0, 200).forEach(function (x) {
                html += '<div class="af-picker-item" data-code="' + x.code + '">';
                html += '<span class="af-picker-code">' + x.code + '</span>';
                html += '<span class="af-picker-name">' + H.esc(x.name || '') + '</span>';
                html += '</div>';
            });
            listWrap.innerHTML = html;
        }
        renderList('');
        setTimeout(function () { searchInput.focus(); }, 50);
        searchInput.addEventListener('input', function () { renderList(searchInput.value); });

        picker.querySelector('.af-picker-close').addEventListener('click', function () { picker.remove(); });

        picker.addEventListener('click', function (e) {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.af-picker-item');
            if (!item) return;
            document.getElementById('afCodeTafzil_' + section).value = parseInt(item.dataset.code);
            refreshNames(section);
            picker.remove();
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') picker.remove();
            if (e.key === 'Enter') {
                const first = listWrap.querySelector('.af-picker-item');
                if (first) first.click();
            }
        });
    }

    // ═══════════════════════════════════════
    //  SAVE
    // ═══════════════════════════════════════
    async function save() {
        const btn = document.getElementById('afSaveBtn');
        const orig = btn.textContent;

        const nameEl = document.getElementById('afName');
        const name = nameEl ? nameEl.value.trim() : '';
        if (!name) {
            window.App.toast('نام کالا الزامی است', 'error');
            return;
        }

        function val(id) {
            const el = document.getElementById(id);
            return el && el.value ? el.value.trim() : null;
        }
        function num(id) {
            const el = document.getElementById(id);
            if (!el) return null;
            const v = el.value || '';
            const n = parseFloat(String(v).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[^\d.\-]/g, ''));
            return isNaN(n) ? null : n;
        }
        function decOrNull(id) {
            const el = document.getElementById(id);
            if (!el) return null;
            const n = parseFloat(el.value);
            return isNaN(n) || n === 0 ? null : n;
        }

        const taxIdStr = val('afTaxId');

        const payload = {
            name: name,
            taxId: taxIdStr ? parseInt(taxIdStr) : null,
            articleCoding: val('afFullCode'),

            articleGroupId: decOrNull('afGroupId'),
            articleUnitId: decOrNull('afUnitId'),
            articleUnitId2: decOrNull('afUnitId2'),
            articleUnitId3: decOrNull('afUnitId3'),

            codeCol: num('afCodeCol_sale'),
            codeMoein: num('afCodeMoein_sale'),
            codeTafzil: num('afCodeTafzil_sale'),

            codeColBuy: num('afCodeCol_buy'),
            codeMoeinBuy: num('afCodeMoein_buy'),
            codeTafzilBuy: num('afCodeTafzil_buy'),

            codeColReBuy: num('afCodeCol_rebuy'),
            codeMoeinReBuy: num('afCodeMoein_rebuy'),
            codeTafzilReBuy: num('afCodeTafzil_rebuy'),

            codeColReSale: num('afCodeCol_resale'),
            codeMoeinReSale: num('afCodeMoein_resale'),
            codeTafzilReSale: num('afCodeTafzil_resale'),

            amountFirst: num('afAmountFirst'),
            costFirst: num('afCostFirst'),
            amountSale: num('afAmountSale'),
            marketerPercent: num('afMarketerPercent'),
            maxCostOrderBy: num('afMaxCostOrderBy'),
            minCostOrderBy: num('afMinCostOrderBy'),

            depreciation: num('afDepreciation'),
            depreciationType: parseInt((document.getElementById('afDepreciationType') || {}).value) || null,

            status: parseInt((document.getElementById('afStatus') || {}).value) || 1
        };

        if (_state.mode === 'create') {
            const stockId = parseInt((document.getElementById('afStockTypeId') || {}).value) || 0;
            if (!stockId) { window.App.toast('انتخاب انبار الزامی است', 'error'); return; }
            if (!payload.articleGroupId) { window.App.toast('انتخاب گروه کالا الزامی است', 'error'); return; }
            payload.stockTypeId = stockId;
        }

        try {
            btn.disabled = true;
            btn.textContent = '⏳ در حال ذخیره...';

            if (_state.mode === 'create') {
                await window.App.Http.api('/api/article', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.App.toast('کالای جدید ثبت شد', 'success');
            } else {
                await window.App.Http.api('/api/article/' + _state.articleId, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.App.toast('کالا به‌روزرسانی شد', 'success');
            }

            if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
            window.App.closeModal();
            window.App.Features.Article.runList(1);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
    }

    // ═══════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════
    async function getLookups() {
        await ensureLookups();
        return _cache;
    }

    return {
        openEdit: openEdit,
        openCreate: openCreate,
        refreshNames: refreshNames,
        getLookups: getLookups
    };
})();

window.App.openArticleEdit = window.App.Features.ArticleForm.openEdit;
window.App.openArticleCreate = window.App.Features.ArticleForm.openCreate;