/* ═══════════════════════════════════════════════════
   Feature / ArticleQuickCreate — ایجاد سریع کالا از فرم فاکتور
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.ArticleQuickCreate = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _state = {
        lookups: null,      // { groups, units, stockTypes }
        stockCoding: null,  // { codeCol, codeMoein, codeTafzil, codeTafzil2 }
        nextCode: null,     // { fullCode, code, codingStore, codingGroupStore }
        resolve: null
    };
    let _keyHandler = null;

    // ═══ API ═══
    async function ensureLookups() {
        if (_state.lookups) return _state.lookups;
        try {
            _state.lookups = await window.App.Http.api('/api/article/lookups');
        } catch {
            _state.lookups = { groups: [], units: [], stockTypes: [] };
        }
        return _state.lookups;
    }

    async function loadStockCoding(stockTypeId) {
        try {
            return await window.App.Http.api('/api/stock-type/' + stockTypeId);
        } catch { return null; }
    }

    async function fetchNextCode(stockTypeId, groupId) {
        try {
            return await window.App.Http.api(
                `/api/article/next-code?stockTypeId=${stockTypeId}&groupId=${groupId}`);
        } catch { return null; }
    }

    // ═══ OPEN ═══
    async function open() {
        if (window.App.Permissions && !window.App.Permissions.can(190)) {
            window.App.toast('شما برای ایجاد کالا دسترسی ندارید', 'error');
            return null;
        }

        await ensureLookups();

        return new Promise((resolve) => {
            _state.resolve = resolve;
            _state.stockCoding = null;
            _state.nextCode = null;

            const overlay = document.createElement('div');
            overlay.id = 'aqcOverlay';
            overlay.className = 'aqc-overlay';
            overlay.innerHTML = buildHtml();
            document.body.appendChild(overlay);

            bindEvents();
            setTimeout(() => document.getElementById('aqcName')?.focus(), 100);
        });
    }

    function close(result) {
        if (_keyHandler) {
            document.removeEventListener('keydown', _keyHandler, true);
            _keyHandler = null;
        }
        document.getElementById('aqcOverlay')?.remove();
        if (_state.resolve) {
            _state.resolve(result);
            _state.resolve = null;
        }
    }

    // ═══ HTML ═══
    function buildHtml() {
        const L = _state.lookups;

        const stockOpts = ['<option value="">-- انتخاب انبار --</option>']
            .concat((L.stockTypes || []).map(s =>
                `<option value="${s.id}">${H.esc(s.name || '')}</option>`)).join('');

        const unitOpts = ['<option value="">-- بدون واحد --</option>']
            .concat((L.units || []).map(u =>
                `<option value="${u.id}">${H.esc(u.name || '')}</option>`)).join('');

        return `
        <div class="aqc-box">
            <div class="aqc-header">
                <span>➕ ایجاد کالای جدید</span>
                <button type="button" class="aqc-close" id="aqcCloseBtn">✕</button>
            </div>

            <div class="aqc-body">
                <div class="tf-section">
                    <div class="tf-section-title">🏷️ اطلاعات کالا</div>
                    <div class="tf-grid tf-grid-2">
                        <div class="tf-field tf-field-full">
                            <label>نام کالا <span class="req">*</span></label>
                            <input type="text" id="aqcName" maxlength="100">
                        </div>
                        <div class="tf-field">
                            <label>شناسه مالیاتی</label>
                            <input type="text" id="aqcTaxId" dir="ltr" inputmode="numeric">
                        </div>
                        <div class="tf-field">
                            <label>انبار <span class="req">*</span></label>
                            <select id="aqcStockType">${stockOpts}</select>
                        </div>
                        <div class="tf-field">
                            <label>گروه کالا <span class="req">*</span></label>
                            <select id="aqcGroup"><option value="">-- ابتدا انبار --</option></select>
                        </div>
                        <div class="tf-field">
                            <label>واحد شمارش</label>
                            <select id="aqcUnit">${unitOpts}</select>
                        </div>
                        <div class="tf-field">
                            <label>قیمت فروش</label>
                            <input type="text" id="aqcAmountSale" dir="ltr" inputmode="numeric">
                        </div>
                    </div>
                </div>

                <div class="tf-section">
                    <div class="tf-section-title">🔢 کد کالا (خودکار)</div>
                    <div class="aqc-code-box">
                        <span id="aqcCodeDisplay" class="aqc-code-value">—</span>
                        <span class="aqc-code-hint" id="aqcCodeHint">
                            پس از انتخاب انبار و گروه محاسبه می‌شود
                        </span>
                    </div>
                    <div id="aqcCodingPreview" class="aqc-coding-preview" style="display:none;"></div>
                </div>
            </div>

            <div class="aqc-footer">
                <button class="btn btn-primary tf-save-btn" id="aqcSaveBtn">
                    💾 ثبت کالا
                </button>
                <button class="btn btn-ghost" id="aqcCancelBtn">انصراف</button>
                <span class="tf-footer-hint">
                    کلیدها: <kbd>F2</kbd> / <kbd>Ctrl+Enter</kbd> ثبت — <kbd>Esc</kbd> انصراف
                </span>
            </div>
        </div>`;
    }

    // ═══ EVENTS ═══
    function bindEvents() {
        document.getElementById('aqcCloseBtn')?.addEventListener('click', () => close(null));
        document.getElementById('aqcCancelBtn')?.addEventListener('click', () => close(null));
        document.getElementById('aqcSaveBtn')?.addEventListener('click', save);

        // stock type → group cascade
        document.getElementById('aqcStockType')?.addEventListener('change', onStockChange);

        // وقتی انبار و گروه هر دو انتخاب شدن → کد
        document.getElementById('aqcGroup')?.addEventListener('change', onGroupChange);

        _keyHandler = (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                e.stopImmediatePropagation();   // ⭐
                save();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopImmediatePropagation();   // ⭐
                save();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();   // ⭐
                close(null);
            }
        };
        document.addEventListener('keydown', _keyHandler, true);
    }

    async function onStockChange(e) {
        const stockTypeId = parseInt(e.target.value) || 0;
        const groupSel = document.getElementById('aqcGroup');
        const codeDisplay = document.getElementById('aqcCodeDisplay');
        const codeHint = document.getElementById('aqcCodeHint');
        const codingPreview = document.getElementById('aqcCodingPreview');

        // فیلتر گروه‌ها بر اساس انبار
        if (!stockTypeId) {
            groupSel.innerHTML = '<option value="">-- ابتدا انبار --</option>';
            codeDisplay.textContent = '—';
            codeHint.textContent = 'پس از انتخاب انبار و گروه محاسبه می‌شود';
            codingPreview.style.display = 'none';
            _state.stockCoding = null;
            _state.nextCode = null;
            return;
        }

        // لود کدینگ انبار
        _state.stockCoding = await loadStockCoding(stockTypeId);

        // نمایش پیش‌نمایش کدینگ
        if (_state.stockCoding && _state.stockCoding.codeCol > 0) {
            const c = _state.stockCoding;
            codingPreview.style.display = '';
            codingPreview.innerHTML = `
                <div class="aqc-coding-title">کدینگ پیش‌فرض از انبار:</div>
                <div class="aqc-coding-row">
                    <span>فروش: <strong>${c.codeCol} / ${c.codeMoein || 0} / ${c.codeTafzil || 0}</strong></span>
                </div>`;
        } else {
            codingPreview.style.display = 'none';
        }

        // فیلتر گروه‌ها
        const groups = (_state.lookups.groups || [])
            .filter(g => parseInt(g.stockTypeId) === stockTypeId);

        groupSel.innerHTML = ['<option value="">-- انتخاب گروه --</option>']
            .concat(groups.map(g =>
                `<option value="${g.id}">${H.esc(g.name || '')}</option>`)).join('');

        codeDisplay.textContent = '—';
        codeHint.textContent = 'حالا گروه را انتخاب کنید';
        _state.nextCode = null;
    }

    async function onGroupChange(e) {
        const stockTypeId = parseInt(document.getElementById('aqcStockType').value) || 0;
        const groupId = parseInt(e.target.value) || 0;
        const codeDisplay = document.getElementById('aqcCodeDisplay');
        const codeHint = document.getElementById('aqcCodeHint');

        if (!stockTypeId || !groupId) {
            codeDisplay.textContent = '—';
            codeHint.textContent = 'انتخاب انبار و گروه الزامی است';
            _state.nextCode = null;
            return;
        }

        codeHint.textContent = '⏳ در حال محاسبه...';
        _state.nextCode = await fetchNextCode(stockTypeId, groupId);

        if (_state.nextCode) {
            codeDisplay.textContent = _state.nextCode.fullCode || '—';
            codeHint.textContent = `کد خودکار از سرور (توالی: ${_state.nextCode.sequence})`;
        } else {
            codeDisplay.textContent = '—';
            codeHint.textContent = 'خطا در محاسبه کد';
        }
    }

    // ═══ SAVE ═══
    async function save() {
        const val = id => document.getElementById(id)?.value?.trim() || null;
        const intOrNull = id => {
            const v = val(id);
            if (!v) return null;
            const n = parseInt(v.replace(/,/g, ''), 10);
            return isNaN(n) ? null : n;
        };
        const decOrNull = id => {
            const v = val(id);
            if (!v) return null;
            const n = parseFloat(v.replace(/,/g, ''));
            return isNaN(n) ? null : n;
        };

        const name = val('aqcName');
        if (!name) {
            window.App.toast('نام کالا الزامی است', 'error');
            document.getElementById('aqcName')?.focus();
            return;
        }

        const stockTypeId = intOrNull('aqcStockType');
        if (!stockTypeId) {
            window.App.toast('انتخاب انبار الزامی است', 'error');
            return;
        }

        const groupId = intOrNull('aqcGroup');
        if (!groupId) {
            window.App.toast('انتخاب گروه کالا الزامی است', 'error');
            return;
        }

        // ⭐ اگه کد محاسبه نشده بود، الان محاسبه کن
        if (!_state.nextCode) {
            _state.nextCode = await fetchNextCode(stockTypeId, groupId);
        }

        // ⭐ کدینگ از StockType
        const coding = _state.stockCoding || {};
        const codeCol = coding.codeCol || 0;
        const codeMoein = coding.codeMoein || 0;
        const codeTafzil = coding.codeTafzil || 0;

        const payload = {
            name: name,
            taxId: intOrNull('aqcTaxId'),
            articleCoding: _state.nextCode?.fullCode || null,
            stockTypeId: stockTypeId,
            articleGroupId: groupId,
            articleUnitId: intOrNull('aqcUnit'),
            articleUnitId2: null,
            articleUnitId3: null,

            // ⭐ کدینگ‌ها — همه از StockType
            codeCol: codeCol,
            codeMoein: codeMoein,
            codeTafzil: codeTafzil,
            codeColBuy: codeCol,
            codeMoeinBuy: codeMoein,
            codeTafzilBuy: codeTafzil,
            codeColReBuy: codeCol,
            codeMoeinReBuy: codeMoein,
            codeTafzilReBuy: codeTafzil,
            codeColReSale: codeCol,
            codeMoeinReSale: codeMoein,
            codeTafzilReSale: codeTafzil,

            amountFirst: 0,
            costFirst: 0,
            amountSale: decOrNull('aqcAmountSale'),
            marketerPercent: null,
            maxCostOrderBy: null,
            minCostOrderBy: null,
            depreciation: null,
            depreciationType: null,
            status: 1
        };

        const btn = document.getElementById('aqcSaveBtn');
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ در حال ثبت...';

        try {
            const result = await window.App.Http.api('/api/article', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (!result || !result.id) {
                throw new Error('کالا ثبت نشد');
            }

            window.App.toast(`✅ کالای «${name}» با کد ${result.fullCode || result.code} ثبت شد`, 'success');

            // ⭐ بستن با نتیجه
            close({
                id: result.id,
                code: result.code,
                fullCode: result.fullCode,
                name: name
            });
        } catch (err) {
            window.App.toast(err.message || 'خطا در ثبت کالا', 'error');
            btn.disabled = false;
            btn.textContent = orig;
        }
    }

    return { open };
})();