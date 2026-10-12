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
            _cache.moeins = (tree || [])
                .filter(x => x.level === 'moein')
                .map(m => ({
                    codeCol: parseInt(m.codeCol),
                    codeMoein: parseInt(m.codeMoein),
                    name: m.name,
                    hasTafzili: m.hasTafzili === true || m.hasTafzili === 1
                }))
                .sort((a, b) => a.codeCol - b.codeCol || a.codeMoein - b.codeMoein);
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
        if (window.App.Permissions && !window.App.Permissions.can(190)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
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
        if (window.App.Permissions && !window.App.Permissions.can(191)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }
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
        html += sectionStats(d);
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
            // ⭐ در ویرایش: select های قفل‌شده با مقادیر فعلی
            let stockOpts = '';
            _cache.stockTypes.forEach(s => {
                const sel = String(s.id) === String(d.stockTypeId) ? 'selected' : '';
                stockOpts += '<option value="' + s.id + '" ' + sel + '>' + H.esc(s.name || '') + '</option>';
            });

            let groupOpts = '';
            const groupsForStock = _cache.groups.filter(g => String(g.stockTypeId) === String(d.stockTypeId));
            groupsForStock.forEach(g => {
                const sel = String(g.id) === String(d.articleGroupId) ? 'selected' : '';
                groupOpts += '<option value="' + g.id + '" ' + sel + '>' + H.esc(g.name || '') + '</option>';
            });

            return '<div class="af-section af-section-top">' +
                '<div class="af-section-title">📦 انبار و گروه کالا ' +
                '<button type="button" class="af-unlock-btn" id="afUnlockStockBtn" title="ویرایش دستی">🔓</button>' +
                '</div>' +
                '<div class="af-grid af-grid-3">' +
                '<div class="af-field">' +
                '<label>انبار</label>' +
                '<select id="afStockTypeId" disabled>' + stockOpts + '</select>' +
                '</div>' +
                '<div class="af-field">' +
                '<label>گروه کالا</label>' +
                '<select id="afGroupId" disabled>' + groupOpts + '</select>' +
                '</div>' +
                '<div class="af-field">' +
                '<label>کد کالا (کدینگ) <button type="button" class="af-unlock-btn" id="afUnlockCodeBtn" title="ویرایش دستی">🔓</button></label>' +
                '<input type="text" id="afFullCode" value="' + H.esc(d.articleCoding || '') + '" readonly class="af-readonly num-input" style="font-weight:bold; color:var(--primary); direction:ltr; text-align:center;">' +
                '</div>' +
                '</div>' +
                '</div>';
        }

        // create mode — بدون تغییر
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
            '<option value="0"' + (d.status === 0 || d.status === 2 ? ' selected' : '') + '>مشاهده در انبار</option>' +
            '<option value="1"' + (d.status === 1 || d.status === 3 || d.status === undefined ? ' selected' : '') + '>مشاهده در اموال</option>' +
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
    //  Section: آمار حرکات (فقط در ویرایش)
    // ═══════════════════════════════════════
    function sectionStats(d) {
        if (_state.mode !== 'edit') return '';

        return '<div class="af-section">' +
            '<div class="af-section-title">📊 آمار حرکات (فقط خواندنی)</div>' +
            '<div class="af-grid af-grid-4">' +
            '<div class="af-field"><label>خرید (تعداد)</label>' +
            '<input type="text" value="' + H.fmtT(d.inVal1) + '" readonly class="af-readonly num-input"></div>' +
            '<div class="af-field"><label>خرید (ریالی)</label>' +
            '<input type="text" value="' + H.fmtT(d.inAmount1) + '" readonly class="af-readonly num-input"></div>' +
            '<div class="af-field"><label>فروش (تعداد)</label>' +
            '<input type="text" value="' + H.fmtT(d.outVal1) + '" readonly class="af-readonly num-input"></div>' +
            '<div class="af-field"><label>فروش (ریالی)</label>' +
            '<input type="text" value="' + H.fmtT(d.outAmount1) + '" readonly class="af-readonly num-input"></div>' +
            '<div class="af-field"><label>برگشت (تعداد)</label>' +
            '<input type="text" value="' + H.fmtT(d.backVal1) + '" readonly class="af-readonly num-input"></div>' +
            '<div class="af-field"><label>برگشت (ریالی)</label>' +
            '<input type="text" value="' + H.fmtT(d.backAmount1) + '" readonly class="af-readonly num-input"></div>' +
            '<div class="af-field"><label>قیمت فروش</label>' +
            '<input type="text" value="' + H.fmtT(d.amountSale) + '" readonly class="af-readonly num-input"></div>' +
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

        // ⭐ Cascade انبار → گروه (هم create هم edit)
        const stockSel = document.getElementById('afStockTypeId');
        const groupSel = document.getElementById('afGroupId');
        if (stockSel && groupSel) {
            stockSel.addEventListener('change', function () {
                const stockId = parseInt(stockSel.value) || 0;
                const groups = _cache.groups.filter(g => String(g.stockTypeId) === String(stockId));
                let html = '<option value="0">-- انتخاب گروه --</option>';
                groups.forEach(g => {
                    html += '<option value="' + g.id + '">' + H.esc(g.name || '') + ' (' + (g.code || '') + ')</option>';
                });
                groupSel.innerHTML = html;
                if (_state.mode === 'create') refreshNextCode();
            });
            if (_state.mode === 'create') {
                groupSel.addEventListener('change', refreshNextCode);
            }
        }

        // 🔓 ویرایش دستی کد
        const unlockBtn = document.getElementById('afUnlockCodeBtn');
        const codeInput = document.getElementById('afFullCode');
        if (unlockBtn && codeInput) {
            unlockBtn.addEventListener('click', async function () {
                const isReadonly = codeInput.hasAttribute('readonly');
                if (isReadonly) {
                    const ok = await window.App.confirm(
                        'توجه: تغییر کد کالا ممکن است باعث ناسازگاری شود.\nمطمئن هستید؟',
                        { title: 'هشدار', okText: 'بله، مطمئنم', danger: true }
                    );
                    if (!ok) return;
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

        // 🔓 ویرایش دستی انبار و گروه (فقط edit)
        const unlockStockBtn = document.getElementById('afUnlockStockBtn');
        if (unlockStockBtn && stockSel && groupSel) {
            unlockStockBtn.addEventListener('click', async function () {
                const isDisabled = stockSel.disabled;
                if (isDisabled) {
                    const ok = await window.App.confirm(
                        'با تغییر انبار یا گروه، بهتر است کد کالا هم اصلاح شود.\nمطمئن هستید؟',
                        { title: 'هشدار', okText: 'بله، مطمئنم', danger: true }
                    );
                    if (!ok) return;
                    stockSel.disabled = false;
                    groupSel.disabled = false;
                    unlockStockBtn.textContent = '🔒';
                } else {
                    stockSel.disabled = true;
                    groupSel.disabled = true;
                    unlockStockBtn.textContent = '🔓';
                }
            });
        }

        // Pickers
        // Pickers — استفاده از HesabPicker مشترک
        document.querySelectorAll('.af-pick-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                const section = btn.dataset.section;
                const pickType = btn.dataset.pick;

                if (pickType === 'moein') {
                    const result = await window.App.UI.HesabPicker.open({
                        mode: 'moein',
                        codeCol: 0,
                        title: '🔍 انتخاب کد معین'
                    });
                    if (!result) return;

                    const colEl = document.getElementById('afCodeCol_' + section);
                    const moeinEl = document.getElementById('afCodeMoein_' + section);
                    const tafzilEl = document.getElementById('afCodeTafzil_' + section);

                    if (colEl) colEl.value = result.codeCol || '';
                    if (moeinEl) moeinEl.value = result.codeMoein || '';
                    if (tafzilEl) tafzilEl.value = '';

                    refreshNames(section);
                    updateTafzilState(section);

                    // ⚠️ هشدار: معین از نوع انباری نیست
                    if (result.isStock === false) {
                        window.App.toast('این معین از نوع انباری نیست', 'warning', {
                            title: 'هشدار'
                        });
                    }
                } else {
                    const result = await window.App.UI.HesabPicker.open({
                        mode: 'tafzil',
                        codeCol: 0,
                        title: '🔍 انتخاب کد تفصیلی'
                    });
                    if (!result) return;

                    const tafzilEl = document.getElementById('afCodeTafzil_' + section);
                    if (tafzilEl) tafzilEl.value = result.codeTafzil || '';

                    refreshNames(section);
                }
            });
        });

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
    function updateTafzilState(section) {
        const colEl = document.getElementById('afCodeCol_' + section);
        const moeinEl = document.getElementById('afCodeMoein_' + section);
        const tafzilEl = document.getElementById('afCodeTafzil_' + section);
        const pickBtn = document.querySelector('.af-pick-btn[data-pick="tafzil"][data-section="' + section + '"]');

        if (!tafzilEl || !pickBtn) return;

        const colCode = colEl ? parseInt(colEl.value) || 0 : 0;
        const moeinCode = moeinEl ? parseInt(moeinEl.value) || 0 : 0;

        // معین انتخاب نشده → قفل
        if (!colCode || !moeinCode) {
            lockTafzil(tafzilEl, pickBtn);
            return;
        }

        const moein = _cache.moeins.find(x =>
            x.codeCol === colCode && x.codeMoein === moeinCode);

        // معین پیدا نشد → قفل (احتیاط)
        if (!moein) {
            lockTafzil(tafzilEl, pickBtn);
            return;
        }

        // معین تفضیلی داره → باز، وگرنه قفل
        if (moein.hasTafzili) {
            unlockTafzil(tafzilEl, pickBtn);
        } else {
            tafzilEl.value = '';
            lockTafzil(tafzilEl, pickBtn);
        }
    }

    function lockTafzil(input, btn) {
        input.setAttribute('readonly', 'readonly');
        input.classList.add('af-readonly');
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
    }

    function unlockTafzil(input, btn) {
        input.removeAttribute('readonly');
        input.classList.remove('af-readonly');
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.cursor = '';
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

        if (_state.mode === 'edit') {
            const stockEl = document.getElementById('afStockTypeId');
            const groupEl = document.getElementById('afGroupId');
            if (stockEl && !stockEl.disabled) {
                payload.stockTypeId = parseInt(stockEl.value) || null;
            }
            if (groupEl && !groupEl.disabled) {
                payload.articleGroupId = parseInt(groupEl.value) || null;
            }
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

    async function deleteArticle(articleId) {
        if (window.App.Permissions && !window.App.Permissions.can(192)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        try {
            const check = await window.App.Http.api('/api/article/' + articleId + '/can-delete');
            if (!check.canDelete) {
                window.App.alert(check.reason, {
                    title: 'امکان حذف نیست',
                    type: 'warning',
                    okText: 'متوجه شدم'
                });
                return;
            }
        } catch (err) {
            window.App.toast('خطا در بررسی: ' + err.message, 'error');
            return;
        }

        if (!await window.App.confirm('آیا از حذف این کالا مطمئن هستید؟', {
            title: 'حذف کالا',
            okText: 'بله، حذف کن',
            cancelText: 'انصراف',
            danger: true
        })) return;

        try {
            await window.App.Http.api('/api/article/' + articleId, { method: 'DELETE' });
            window.App.toast('کالا حذف شد', 'success');
            window.App.Features.Article.runList(1);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    return {
        openEdit: openEdit,
        openCreate: openCreate,
        delete: deleteArticle,
        refreshNames: refreshNames,
        getLookups: getLookups
    };
})();

window.App.openArticleEdit = window.App.Features.ArticleForm.openEdit;
window.App.openArticleCreate = window.App.Features.ArticleForm.openCreate;