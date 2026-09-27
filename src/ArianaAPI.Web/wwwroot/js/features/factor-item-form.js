/* ═══════════════════════════════════════════════════
   Feature / FactorItemForm — دیالوگ ردیف کالا
   الهام گرفته از Factor2InputForm دلفی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.FactorItemForm = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════
    let _state = {
        mode: 'add',
        factorKind: 1,
        codeTafzil: null,
        factorDate: null,
        existingItems: [],
        onSave: null,
        editIndex: -1,
        // کالای انتخاب‌شده (FactorArticleCalcDto)
        article: null,
        // فیلدها
        item: null,
        // از تنظیمات سراسری
        taxFi: 0
    };

    let _keyHandler = null;

    // ═══════════════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════════════
    async function openForAdd(opts) {
        const lookups = await getLookups();
        _state = {
            mode: 'add',
            factorKind: opts.factorKind,
            codeTafzil: opts.codeTafzil,
            factorDate: opts.factorDate,
            existingItems: opts.existingItems || [],
            onSave: opts.onSave,
            editIndex: -1,
            article: null,
            taxFi: lookups.taxFi || 0,
            item: blankItem(lookups.taxFi || 0)
        };
        openDialog();
    }

    async function openForEdit(opts) {
        const lookups = await getLookups();
        _state = {
            mode: 'edit',
            factorKind: opts.factorKind,
            codeTafzil: opts.codeTafzil,
            factorDate: opts.factorDate,
            existingItems: opts.existingItems || [],
            onSave: opts.onSave,
            editIndex: opts.editIndex != null ? opts.editIndex : -1,
            article: null,
            taxFi: lookups.taxFi || 0,
            item: Object.assign(blankItem(lookups.taxFi || 0), opts.item)
        };
        openDialog();

        // ─── لود اطلاعات کالا ───
        if (_state.item.articleId) {
            await loadArticleCalc(_state.item.articleId);
        }
    }

    // ═══════════════════════════════════════════════════
    //  Lookups
    // ═══════════════════════════════════════════════════
    let _lookupsCache = null;
    async function getLookups() {
        if (_lookupsCache) return _lookupsCache;
        try {
            _lookupsCache = await window.App.Http.api('/api/factor/lookups');
        } catch (e) {
            _lookupsCache = { taxFi: 0, taxPer: 0, avarezPer: 0 };
        }
        return _lookupsCache;
    }

    function blankItem(taxFi) {
        return {
            articleId: 0,
            articleCode: null,
            articleName: '',
            articleUnit: '',
            articleCount: 1,
            articleCount2: 0,
            articleCount3: 0,
            cost: 0,
            incCost: 0,
            discount: 0,
            perDiscount: 0,
            tax: 0,
            taxFi: taxFi,
            transCost: 0,
            costItem: 0,
            costTax: 0,
            finallCost: 0,
            stockId: 0,
            marketerPercent: 0,
            marketerCosts: 0,
            degreeKala: 0,
            dropKala: 0
        };
    }

    // ═══════════════════════════════════════════════════
    //  OPEN DIALOG
    // ═══════════════════════════════════════════════════
    function openDialog() {
        // ─── حذف قبلی اگه هست ───
        const existing = document.getElementById('ffiOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ffiOverlay';
        overlay.className = 'ffi-overlay';
        overlay.innerHTML = buildHtml();
        document.body.appendChild(overlay);

        bindEvents();
        renderArticleField();
        renderUnits();
        recalcAll(true);
        setTimeout(function () {
            document.getElementById('ffiArticleCode')?.focus();
        }, 100);
    }

    function closeDialog() {
        unbindKeyboard();
        const overlay = document.getElementById('ffiOverlay');
        if (overlay) overlay.remove();
    }

    // ═══════════════════════════════════════════════════
    //  HTML
    // ═══════════════════════════════════════════════════
    function buildHtml() {
        const title = _state.mode === 'add' ? '➕ افزودن کالا' : '✏️ ویرایش کالا';
        const it = _state.item;

        return '' +
            '<div class="ffi-box">' +

            // ─── Header ───
            '<div class="ffi-header">' +
            '<span>' + title + '</span>' +
            '<button type="button" class="ffi-close" id="ffiCloseBtn">✕</button>' +
            '</div>' +

            // ─── Article Selector ───
            '<div class="ffi-article-section">' +
            '<div class="ffi-article-row">' +
            '<label>کد کالا <span class="req">*</span></label>' +
            '<div class="ffi-input-with-btn">' +
            '<input type="text" id="ffiArticleCode" class="num-input" dir="ltr" ' +
            'placeholder="کد کالا..." autocomplete="off">' +
            '<button type="button" class="ffi-pick-btn" id="ffiPickArticleBtn" title="جستجو">🔍</button>' +
            '</div>' +
            '</div>' +
            '<div class="ffi-article-name" id="ffiArticleName">—</div>' +
            '</div>' +

            // ─── Info Bar ───
            '<div class="ffi-info-bar" id="ffiInfoBar">' +
            '<div class="ffi-info-item">' +
            '<span>موجودی:</span>' +
            '<strong id="ffiStock">—</strong>' +
            '</div>' +
            '<div class="ffi-info-item">' +
            '<span>میانگین خرید:</span>' +
            '<strong id="ffiAvgBuy">—</strong>' +
            '</div>' +
            '<div class="ffi-info-item">' +
            '<span>میانگین فروش:</span>' +
            '<strong id="ffiAvgSale">—</strong>' +
            '</div>' +
            '<div class="ffi-info-item">' +
            '<span>قیمت پیشنهادی:</span>' +
            '<strong id="ffiSuggested">—</strong>' +
            '</div>' +
            '<div class="ffi-info-item">' +
            '<span>نرخ مالیات:</span>' +
            '<strong id="ffiTaxRate">' + H.fmt(_state.taxFi) + '%</strong>' +
            '</div>' +
            '</div>' +

            // ─── Fields Grid ───
            '<div class="ffi-body">' +

            // ردیف ۱: مقدار / قیمت واحد / واحد
            '<div class="ffi-grid ffi-grid-3">' +
            '<div class="ffi-field">' +
            '<label>مقدار <span class="req">*</span></label>' +
            '<input type="text" id="ffiCount" class="num-input" dir="ltr" value="' + H.fmt(it.articleCount || '') + '">' +
            '</div>' +
            '<div class="ffi-field">' +
            '<label>قیمت واحد <span class="req">*</span></label>' +
            '<input type="text" id="ffiCost" class="num-input" dir="ltr" value="' + H.fmt(it.cost || '') + '">' +
            '</div>' +
            '<div class="ffi-field">' +
            '<label>واحد کالا</label>' +
            '<input type="text" id="ffiUnit" readonly class="ffi-readonly">' +
            '</div>' +
            '</div>' +

            // ردیف ۲: واحد ۲ و ۳ (مخفی پیش‌فرض)
            '<div class="ffi-grid ffi-grid-2" id="ffiUnitsExtraRow" style="display:none;">' +
            '<div class="ffi-field" id="ffiUnit2Field">' +
            '<label>مقدار واحد ۲ (<span id="ffiUnit2Name">—</span>)</label>' +
            '<input type="text" id="ffiCount2" class="num-input" dir="ltr" value="">' +
            '</div>' +
            '<div class="ffi-field" id="ffiUnit3Field">' +
            '<label>مقدار واحد ۳ (<span id="ffiUnit3Name">—</span>)</label>' +
            '<input type="text" id="ffiCount3" class="num-input" dir="ltr" value="">' +
            '</div>' +
            '</div>' +

            // ردیف ۳: تخفیف
            '<div class="ffi-grid ffi-grid-3">' +
            '<div class="ffi-field">' +
            '<label>درصد تخفیف (%)</label>' +
            '<input type="text" id="ffiPerDiscount" class="num-input" dir="ltr" value="' + H.fmt(it.perDiscount || '') + '">' +
            '</div>' +
            '<div class="ffi-field">' +
            '<label>مبلغ تخفیف</label>' +
            '<input type="text" id="ffiDiscount" class="num-input" dir="ltr" value="' + H.fmt(it.discount || '') + '">' +
            '</div>' +
            '<div class="ffi-field">' +
            '<label>مبلغ کل (قبل تخفیف)</label>' +
            '<input type="text" id="ffiCostItem" readonly class="ffi-readonly num-input" dir="ltr">' +
            '</div>' +
            '</div>' +

            // ردیف ۴: مالیات
            '<div class="ffi-grid ffi-grid-3">' +
            '<div class="ffi-field">' +
            '<label>نرخ ارزش افزوده (%)</label>' +
            '<input type="text" id="ffiTaxFi" class="num-input" dir="ltr" value="' + H.fmt(it.taxFi || _state.taxFi) + '">' +
            '</div>' +
            '<div class="ffi-field">' +
            '<label>مبلغ مالیات و عوارض</label>' +
            '<input type="text" id="ffiTax" readonly class="ffi-readonly num-input" dir="ltr">' +
            '</div>' +
            '<div class="ffi-field">' +
            '<label>جمع پس از تخفیف</label>' +
            '<input type="text" id="ffiCostTax" readonly class="ffi-readonly num-input" dir="ltr">' +
            '</div>' +
            '</div>' +

            // ردیف ۵: بازاریاب (فقط فروش/برگشت فروش)
            '<div class="ffi-grid ffi-grid-3" id="ffiMarketerRow"' +
            (_state.factorKind === 1 || _state.factorKind === 3 ? '' : ' style="display:none;"') + '>' +
            '<div class="ffi-field">' +
            '<label>درصد بازاریاب (%)</label>' +
            '<input type="text" id="ffiMarketerPercent" class="num-input" dir="ltr" value="' + H.fmt(it.marketerPercent || '') + '">' +
            '</div>' +
            '<div class="ffi-field">' +
            '<label>مبلغ بازاریاب</label>' +
            '<input type="text" id="ffiMarketerCosts" readonly class="ffi-readonly num-input" dir="ltr">' +
            '</div>' +
            '<div class="ffi-field"></div>' +
            '</div>' +

            // ردیف ۶: درجه/افت (اختیاری — از Setting)
            '<div class="ffi-grid ffi-grid-3" id="ffiInfoForoshRow" style="display:none;">' +
            '<div class="ffi-field">' +
            '<label>درجه کالا</label>' +
            '<input type="text" id="ffiDegreeKala" class="num-input" dir="ltr" value="' + H.fmt(it.degreeKala || '') + '">' +
            '</div>' +
            '<div class="ffi-field">' +
            '<label>افت کالا</label>' +
            '<input type="text" id="ffiDropKala" class="num-input" dir="ltr" value="' + H.fmt(it.dropKala || '') + '">' +
            '</div>' +
            '<div class="ffi-field"></div>' +
            '</div>' +

            '</div>' +

            // ─── Final Cost ───
            '<div class="ffi-final">' +
            '<span>جمع نهایی این ردیف:</span>' +
            '<strong id="ffiFinallCost">0</strong>' +
            '</div>' +

            // ─── Footer ───
            '<div class="ffi-footer">' +
            '<button type="button" class="btn btn-primary" id="ffiSaveBtn">' +
            '💾 تأیید <span class="kbd-hint">F2</span>' +
            '</button>' +
            '<button type="button" class="btn btn-ghost" id="ffiCancelBtn">' +
            'انصراف <span class="kbd-hint">Esc</span>' +
            '</button>' +
            '</div>' +

            '</div>';
    }

    // ═══════════════════════════════════════════════════
    //  BIND EVENTS
    // ═══════════════════════════════════════════════════
    function bindEvents() {
        document.getElementById('ffiCloseBtn')?.addEventListener('click', cancel);
        document.getElementById('ffiCancelBtn')?.addEventListener('click', cancel);
        document.getElementById('ffiSaveBtn')?.addEventListener('click', save);

        document.getElementById('ffiPickArticleBtn')?.addEventListener('click', openArticlePicker);

        // ─── کد کالا Enter → بررسی ───
        const codeEl = document.getElementById('ffiArticleCode');
        codeEl?.addEventListener('keydown', async function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const code = (this.value || '').trim();
                if (!code) { openArticlePicker(); return; }
                await tryLoadArticleByCode(code);
            }
        });

        // ─── مقدار ───
        bindNum('ffiCount', function () {
            _state.item.articleCount = numVal('ffiCount');
            recalcTabdilFromMain();
            recalcAll();
        });

        // ─── قیمت واحد ───
        bindNum('ffiCost', function () {
            _state.item.cost = numVal('ffiCost');
            recalcAll();
        });

        // ─── مقدار ۲ ───
        bindNum('ffiCount2', function () {
            _state.item.articleCount2 = numVal('ffiCount2');
            recalcTabdilFromUnit2();
            recalcAll();
        });

        // ─── مقدار ۳ ───
        bindNum('ffiCount3', function () {
            _state.item.articleCount3 = numVal('ffiCount3');
            recalcTabdilFromUnit3();
            recalcAll();
        });

        // ─── درصد تخفیف ───
        bindNum('ffiPerDiscount', function () {
            _state.item.perDiscount = numVal('ffiPerDiscount');
            recalcDiscount();
            recalcAll();
        });

        // ─── مبلغ تخفیف (دستی) ───
        bindNum('ffiDiscount', function () {
            _state.item.discount = numVal('ffiDiscount');
            // اگه دستی تغییر داد، درصد رو از روی مبلغ حساب کن
            const costItem = _state.item.cost * _state.item.articleCount;
            if (costItem > 0 && _state.item.discount > 0) {
                _state.item.perDiscount = (_state.item.discount / costItem) * 100;
                setVal('ffiPerDiscount', fmtNum(_state.item.perDiscount));
            }
            recalcAll();
        });

        // ─── نرخ TaxFi ───
        bindNum('ffiTaxFi', function () {
            _state.item.taxFi = numVal('ffiTaxFi');
            recalcTax();
            recalcAll();
        });

        // ─── درصد بازاریاب ───
        bindNum('ffiMarketerPercent', function () {
            _state.item.marketerPercent = numVal('ffiMarketerPercent');
            recalcMarketer();
            recalcAll();
        });

        // ─── درجه/افت ───
        bindNum('ffiDegreeKala', function () {
            _state.item.degreeKala = numVal('ffiDegreeKala');
        });
        bindNum('ffiDropKala', function () {
            _state.item.dropKala = numVal('ffiDropKala');
        });

        // ─── F2 / Esc ───
        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = function (e) {
            const pickerOpen = document.querySelector('.ffi-article-picker');
            if (e.key === 'F2' && !pickerOpen) {
                e.preventDefault();
                save();
            } else if (e.key === 'Escape' && !pickerOpen) {
                e.preventDefault();
                cancel();
            }
        };
        document.addEventListener('keydown', _keyHandler);
    }

    function unbindKeyboard() {
        if (_keyHandler) {
            document.removeEventListener('keydown', _keyHandler);
            _keyHandler = null;
        }
    }

    function bindNum(id, cb) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', cb);
        el.addEventListener('blur', function () {
            // نرمال‌سازی نمایش
            const v = numVal(id);
            if (v > 0 || v === 0) this.value = fmtNum(v);
        });
    }

    // ═══════════════════════════════════════════════════
    //  ARTICLE PICKER
    // ═══════════════════════════════════════════════════
    function openArticlePicker() {
        const existing = document.getElementById('ffiArticlePicker');
        if (existing) existing.remove();

        const picker = document.createElement('div');
        picker.id = 'ffiArticlePicker';
        picker.className = 'ffi-article-picker';
        picker.innerHTML =
            '<div class="ffi-picker-box">' +
            '<div class="ffi-picker-header">' +
            '<span>🔍 جستجوی کالا</span>' +
            '<button type="button" class="ffi-picker-close">✕</button>' +
            '</div>' +
            '<div class="ffi-picker-search">' +
            '<input type="text" id="ffiArticleSearch" ' +
            'placeholder="کد، نام یا شناسه مالیاتی...">' +
            '</div>' +
            '<div class="ffi-picker-list" id="ffiArticleList">' +
            '<div class="ffi-picker-empty">برای جستجو تایپ کنید...</div>' +
            '</div>' +
            '</div>';
        document.body.appendChild(picker);

        const searchInput = picker.querySelector('#ffiArticleSearch');
        const listWrap = picker.querySelector('#ffiArticleList');
        let _debounceTimer = null;

        function doSearch(q) {
            const query = (q || '').trim();
            if (query.length < 1) {
                listWrap.innerHTML = '<div class="ffi-picker-empty">برای جستجو تایپ کنید...</div>';
                return;
            }

            listWrap.innerHTML = '<div class="ffi-picker-empty">در حال جستجو...</div>';

            window.App.Http.api('/api/article/list', {
                method: 'POST',
                body: JSON.stringify({
                    code: /^\d/.test(query) ? query : null,
                    name: !/^\d/.test(query) ? query : null,
                    taxId: null,
                    page: 1,
                    pageSize: 50,
                    stockFilter: 'all'
                })
            }).then(function (resp) {
                renderArticleList(resp.items || [], query);
            }).catch(function (err) {
                listWrap.innerHTML = '<div class="ffi-picker-empty">خطا: ' +
                    H.esc(err.message) + '</div>';
            });
        }

        function renderArticleList(items, query) {
            if (items.length === 0) {
                listWrap.innerHTML = '<div class="ffi-picker-empty">کالایی یافت نشد</div>';
                return;
            }
            let html = '';
            items.forEach(function (a) {
                const stock = a.finallExistence ?? 0;
                const stockCls = stock > 0 ? 'positive' : (stock < 0 ? 'negative' : 'zero');
                html += '<div class="ffi-picker-item" data-id="' + a.id + '" data-code="' + (a.code || '') + '">' +
                    '<span class="ffi-picker-code">' + (a.code || '-') + '</span>' +
                    '<div class="ffi-picker-info">' +
                    '<div class="ffi-picker-name">' + H.esc(a.name || '') + '</div>' +
                    '<div class="ffi-picker-sub">' +
                    'واحد: ' + H.esc(a.articleUnitName || '-') +
                    ' • موجودی: <span class="' + stockCls + '">' + H.fmt(stock) + '</span>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
            });
            listWrap.innerHTML = html;
        }

        searchInput.addEventListener('input', function () {
            clearTimeout(_debounceTimer);
            const q = this.value;
            _debounceTimer = setTimeout(function () { doSearch(q); }, 300);
        });

        picker.querySelector('.ffi-picker-close').addEventListener('click', function () {
            picker.remove();
        });

        picker.addEventListener('click', async function (e) {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.ffi-picker-item');
            if (!item) return;
            const id = parseInt(item.dataset.id, 10);
            const code = item.dataset.code;
            picker.remove();
            await loadArticleCalc(id, code);
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { picker.remove(); return; }
            if (e.key === 'Enter') {
                const first = listWrap.querySelector('.ffi-picker-item');
                if (first) first.click();
            }
        });

        setTimeout(function () { searchInput.focus(); }, 50);
    }

    // ─── لود کالا با کد ───
    async function tryLoadArticleByCode(code) {
        try {
            const resp = await window.App.Http.api('/api/article/list', {
                method: 'POST',
                body: JSON.stringify({
                    code: code, name: null, taxId: null,
                    page: 1, pageSize: 5, stockFilter: 'all'
                })
            });
            if (!resp.items || resp.items.length === 0) {
                window.App.toast('کالایی با این کد یافت نشد', 'error');
                return;
            }
            // اگه دقیقاً یک نتیجه بود، لود کن
            const exact = resp.items.find(function (x) {
                return String(x.code) === String(code);
            });
            const target = exact || resp.items[0];
            await loadArticleCalc(target.id, target.code);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ─── لود اطلاعات محاسباتی کالا ───
    async function loadArticleCalc(articleId, codeHint) {
        const btn = document.getElementById('ffiPickArticleBtn');
        const oldHtml = btn ? btn.innerHTML : '';

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '⏳';
            }

            // ⭐ فراخوانی endpoint محاسبه
            let url = '/api/factor/article/' + articleId + '/calc' +
                '?factorKind=' + _state.factorKind;
            if (_state.codeTafzil) url += '&codeTafzil=' + _state.codeTafzil;
            if (_state.factorDate) url += '&factorDate=' + encodeURIComponent(_state.factorDate);

            const calc = await window.App.Http.api(url);
            _state.article = calc;

            // ─── فیلد کد ───
            setVal('ffiArticleCode', codeHint || calc.articleId);

            // ─── نام ───
            const nameEl = document.getElementById('ffiArticleName');
            if (nameEl) {
                nameEl.textContent = calc.name || calc.articleName || '(بدون نام)';
            }

            // ─── اطلاعات ───
            setVal('ffiUnit', calc.unitName || '');
            setText('ffiStock', H.fmt(calc.finallExistence || 0));
            setText('ffiAvgBuy', calc.lastBuyCost ? H.fmt(calc.lastBuyCost) : '—');
            setText('ffiAvgSale', calc.lastSaleCost ? H.fmt(calc.lastSaleCost) : '—');

            // ─── قیمت پیشنهادی (نمایش) ───
            let suggested = 0;
            if (_state.factorKind === 1 || _state.factorKind === 3) {
                // فروش / برگشت فروش → AmountSale
                suggested = calc.amountSale || 0;
            }
            setText('ffiSuggested', suggested ? H.fmt(suggested) : '—');

            // ─── item.articleId / نام / واحد ───
            _state.item.articleId = calc.articleId;
            _state.item.articleCode = codeHint || calc.articleId;
            _state.item.articleName = calc.name || calc.articleName || '';
            _state.item.articleUnit = calc.unitName || '';
            _state.item.stockId = calc.stockTypeId || 0;

            // ─── TaxFi کالا (اگه خالی بود، از سراسری) ───
            if (!_state.item.taxFi || _state.item.taxFi === 0) {
                _state.item.taxFi = _state.taxFi;
                setVal('ffiTaxFi', fmtNum(_state.taxFi));
            }

            // ─── MarketerPercent پیش‌فرض کالا ───
            if (calc.marketerPercent > 0 && (!_state.item.marketerPercent || _state.item.marketerPercent === 0)) {
                _state.item.marketerPercent = calc.marketerPercent;
                setVal('ffiMarketerPercent', fmtNum(calc.marketerPercent));
            }

            // ─── نمایش واحدهای ۲ و ۳ (Tabdil) ───
            renderUnits();
            recalcMarketer();
            recalcAll();
        } catch (err) {
            window.App.toast('خطا در بارگذاری کالا: ' + err.message, 'error');
            _state.article = null;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = oldHtml;
            }
        }
    }

    function renderArticleField() {
        const el = document.getElementById('ffiArticleCode');
        if (el && _state.item.articleCode) {
            el.value = _state.item.articleCode;
        }
        const nameEl = document.getElementById('ffiArticleName');
        if (nameEl && _state.item.articleName) {
            nameEl.textContent = _state.item.articleName;
        }
    }

    // ═══════════════════════════════════════════════════
    //  UNITS (Tabdil)
    // ═══════════════════════════════════════════════════
    function renderUnits() {
        const a = _state.article;
        const extraRow = document.getElementById('ffiUnitsExtraRow');
        const f2 = document.getElementById('ffiUnit2Field');
        const f3 = document.getElementById('ffiUnit3Field');

        if (!a) {
            if (extraRow) extraRow.style.display = 'none';
            return;
        }

        const has2 = a.tabdil2 && a.tabdil2 !== 0;
        const has3 = a.tabdil3 && a.tabdil3 !== 0;

        if (has2) {
            if (f2) f2.style.display = '';
            setText('ffiUnit2Name', a.unitName2 || '—');
            if (!_state.item.articleCount2 && _state.item.articleCount) {
                _state.item.articleCount2 = _state.item.articleCount / a.tabdil2;
                setVal('ffiCount2', fmtNum(_state.item.articleCount2));
            }
        } else {
            if (f2) f2.style.display = 'none';
            _state.item.articleCount2 = 0;
            setVal('ffiCount2', '');
        }

        if (has3) {
            if (f3) f3.style.display = '';
            setText('ffiUnit3Name', a.unitName3 || '—');
            if (!_state.item.articleCount3 && _state.item.articleCount) {
                _state.item.articleCount3 = _state.item.articleCount / a.tabdil3;
                setVal('ffiCount3', fmtNum(_state.item.articleCount3));
            }
        } else {
            if (f3) f3.style.display = 'none';
            _state.item.articleCount3 = 0;
            setVal('ffiCount3', '');
        }

        if (extraRow) {
            extraRow.style.display = (has2 || has3) ? '' : 'none';
        }
    }

    // main → 2,3
    function recalcTabdilFromMain() {
        const a = _state.article;
        if (!a) return;
        const qty = _state.item.articleCount;
        if (a.tabdil2) {
            _state.item.articleCount2 = qty / a.tabdil2;
            setVal('ffiCount2', fmtNum(_state.item.articleCount2));
        }
        if (a.tabdil3) {
            _state.item.articleCount3 = qty / a.tabdil3;
            setVal('ffiCount3', fmtNum(_state.item.articleCount3));
        }
    }

    // 2 → main
    function recalcTabdilFromUnit2() {
        const a = _state.article;
        if (!a || !a.tabdil2) return;
        const qty2 = _state.item.articleCount2;
        if (qty2 > 0) {
            _state.item.articleCount = qty2 * a.tabdil2;
            setVal('ffiCount', fmtNum(_state.item.articleCount));
            // 2 → 3
            if (a.tabdil3) {
                _state.item.articleCount3 = _state.item.articleCount / a.tabdil3;
                setVal('ffiCount3', fmtNum(_state.item.articleCount3));
            }
        }
    }

    // 3 → main
    function recalcTabdilFromUnit3() {
        const a = _state.article;
        if (!a || !a.tabdil3) return;
        const qty3 = _state.item.articleCount3;
        if (qty3 > 0) {
            _state.item.articleCount = qty3 * a.tabdil3;
            setVal('ffiCount', fmtNum(_state.item.articleCount));
            if (a.tabdil2) {
                _state.item.articleCount2 = _state.item.articleCount / a.tabdil2;
                setVal('ffiCount2', fmtNum(_state.item.articleCount2));
            }
        }
    }

    // ═══════════════════════════════════════════════════
    //  CALCULATIONS
    // ═══════════════════════════════════════════════════

    // تخفیف از روی درصد
    function recalcDiscount() {
        const it = _state.item;
        if (it.perDiscount > 0) {
            it.discount = Math.round(it.cost * it.articleCount * it.perDiscount / 100);
        }
        setVal('ffiDiscount', fmtNum(it.discount || 0));
    }

    // مالیات
    function recalcTax() {
        const it = _state.item;
        const costItemTrunc = Math.trunc(it.cost * it.articleCount);
        const afterDiscount = costItemTrunc - (it.discount || 0);
        const taxFi = it.taxFi > 0 ? it.taxFi : _state.taxFi;
        it.tax = Math.trunc(afterDiscount * taxFi / 100);
    }

    // بازاریاب
    function recalcMarketer() {
        const it = _state.item;
        if (it.marketerPercent > 0) {
            it.marketerCosts = Math.round(it.cost * it.articleCount * it.marketerPercent / 100);
        } else {
            it.marketerCosts = 0;
        }
        setVal('ffiMarketerCosts', fmtNum(it.marketerCosts || 0));
    }

    // محاسبه‌ی نهایی همه‌چیز
    function recalcAll(silent) {
        const it = _state.item;

        // ─── ۱. CostItem ───
        it.costItem = it.cost * it.articleCount;

        // ─── ۲. اگه perDiscount داره، discount رو دوباره حساب کن ───
        if (it.perDiscount > 0) {
            it.discount = Math.round(it.costItem * it.perDiscount / 100);
            setVal('ffiDiscount', fmtNum(it.discount));
        }

        // ─── ۳. CostTax ───
        it.costTax = it.costItem - it.discount;

        // ─── ۴. Tax ───
        recalcTax();

        // ─── ۵. FinallCost ───
        it.finallCost = it.costTax + it.tax;

        // ─── ۶. Marketer ───
        recalcMarketer();

        // ─── نمایش ───
        setVal('ffiCostItem', fmtNum(it.costItem));
        setVal('ffiCostTax', fmtNum(it.costTax));
        setVal('ffiTax', fmtNum(it.tax));
        setText('ffiFinallCost', H.fmt(it.finallCost || 0));
    }

    // ═══════════════════════════════════════════════════
    //  SAVE
    // ═══════════════════════════════════════════════════
    async function save() {
        const it = _state.item;

        // ─── اعتبارسنجی ───
        if (!it.articleId) {
            window.App.toast('کد کالا الزامی است', 'error');
            document.getElementById('ffiArticleCode')?.focus();
            return;
        }

        if (!it.articleCount || it.articleCount <= 0) {
            window.App.toast('مقدار باید بیشتر از صفر باشد', 'error');
            document.getElementById('ffiCount')?.focus();
            return;
        }

        if (!it.cost || it.cost <= 0) {
            window.App.toast('قیمت واحد باید بیشتر از صفر باشد', 'error');
            document.getElementById('ffiCost')?.focus();
            return;
        }

        // ─── کنترل موجودی منفی (برای فروش) ───
        const a = _state.article;
        if (a && (a.xIsRegNegativKala) &&
            (_state.factorKind === 1 || _state.factorKind === 3)) {

            const available = a.finallExistence || 0;
            if (it.articleCount > available) {
                const ok = confirm(
                    'موجودی فعلی ' + H.fmt(available) + ' است ولی مقدار درخواستی ' +
                    H.fmt(it.articleCount) + '.\nآیا ادامه می‌دهید؟'
                );
                if (!ok) return;
            }
        }

        // ─── کنترل سفارش (min/max) ───
        if (a && (_state.factorKind === 0 || _state.factorKind === 3)) {
            // ورود کالا
            if (a.xIsRegMinOrderToIn && a.maxCostOrderBy > 0) {
                const finalCost = (a.finallExistence || 0) + it.articleCount;
                if (finalCost > a.maxCostOrderBy) {
                    window.App.toast(
                        'تجاوز از حداکثر سفارش ورود (' + H.fmt(a.maxCostOrderBy) + ')',
                        'error'
                    );
                    return;
                }
            }
        }
        if (a && _state.factorKind === 1) {
            // فروش کالا
            if (a.xIsRegMaxOrderToOut && a.minCostOrderBy > 0) {
                const finalCost = (a.finallExistence || 0) - it.articleCount;
                if (finalCost < a.minCostOrderBy) {
                    window.App.toast(
                        'تجاوز از نقطه سفارش خروج (' + H.fmt(a.minCostOrderBy) + ')',
                        'error'
                    );
                    return;
                }
            }
        }

        // ─── کپی نهایی ───
        const outItem = {
            articleId: it.articleId,
            articleCode: it.articleCode,
            articleName: it.articleName,
            articleUnit: it.articleUnit,
            articleCount: it.articleCount,
            articleCount2: it.articleCount2,
            articleCount3: it.articleCount3,
            cost: it.cost,
            incCost: it.incCost,
            discount: it.discount,
            perDiscount: it.perDiscount,
            tax: it.tax,
            taxFi: it.taxFi,
            transCost: it.transCost,
            costItem: it.costItem,
            costTax: it.costTax,
            finallCost: it.finallCost,
            stockId: it.stockId,
            marketerPercent: it.marketerPercent,
            marketerCosts: it.marketerCosts,
            degreeKala: it.degreeKala,
            dropKala: it.dropKala
        };

        // ─── callback ───
        closeDialog();
        if (_state.onSave) {
            _state.onSave(outItem);
        }
    }

    // ═══════════════════════════════════════════════════
    //  CANCEL
    // ═══════════════════════════════════════════════════
    function cancel() {
        closeDialog();
    }

    // ═══════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════
    function setVal(id, v) {
        const el = document.getElementById(id);
        if (el) el.value = v != null ? v : '';
    }
    function setText(id, v) {
        const el = document.getElementById(id);
        if (el) el.textContent = v != null ? v : '';
    }
    function numVal(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const n = H.parseNumber(el.value);
        return n == null ? 0 : n;
    }
    function fmtNum(n) {
        if (n == null || n === '') return '';
        const num = Number(n);
        if (isNaN(num)) return '';
        if (Number.isInteger(num)) {
            return num.toLocaleString('en-US');
        }
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4
        });
    }

    // ═══════════════════════════════════════════════════
    //  API
    // ═══════════════════════════════════════════════════
    return {
        openForAdd: openForAdd,
        openForEdit: openForEdit
    };
})();