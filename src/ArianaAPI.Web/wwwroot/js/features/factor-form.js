/* ═══════════════════════════════════════════════════
   Feature / FactorForm — فرم ثبت/ویرایش فاکتور
   الگو: ArticleForm ولی با پیچیدگی بیشتر
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.FactorForm = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════
    let _state = {
        mode: 'create',           // create | edit
        factorId: null,
        factorKind: 1,            // 0=buy, 1=sale, 2=reBuy, 3=reSale, 4=pre, 9=loss
        lookups: null,            // lookups سراسری (TaxFi, ...)
        header: {},               // داده‌های هدر
        items: [],                // ردیف‌های کالا
        customer: null,           // مشتری انتخاب‌شده
        marketer: null,           // بازاریاب انتخاب‌شده
        transDistMode: 0          // 0=مقدار، 1=ارزش
    };

    // ═══════════════════════════════════════════════════
    //  LOOKUPS
    // ═══════════════════════════════════════════════════
    async function ensureLookups() {
        if (_state.lookups) return _state.lookups;
        try {
            _state.lookups = await window.App.Http.api('/api/factor/lookups');
        } catch (err) {
            console.error('Factor lookups failed:', err);
            window.App.toast('خطا در بارگذاری تنظیمات فاکتور', 'error');
            _state.lookups = { taxFi: 0, taxPer: 0, avarezPer: 0 };
        }
        return _state.lookups;
    }

    // ═══════════════════════════════════════════════════
    //  OPEN — CREATE
    // ═══════════════════════════════════════════════════
    async function openCreate(factorKind) {
        if (window.App.Permissions && !window.App.Permissions.can(200)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        try {
            await ensureLookups();

            // شماره خودکار
            let nextNo = 0;
            try {
                const r = await window.App.Http.api(
                    '/api/factor/next-no?factorKind=' + factorKind);
                nextNo = r.noFactor;
            } catch (e) { /* ignore */ }

            _state = {
                mode: 'create',
                factorId: null,
                factorKind: factorKind,
                lookups: _state.lookups,
                header: {
                    noFactor: nextNo,
                    dateIn: _state.lookups.todayDate || getTodayPersian(),
                    factorKind: factorKind,
                    isCash: 1,
                    transCost: 0,
                    descript: '',
                    carInfo: '',
                    withSanad: true,
                    existingNoSanad: 0
                },
                items: [],
                customer: null,
                marketer: null,
                transDistMode: 0
            };

            window.App.openModal(getTitle(factorKind, 'create'), buildFormHtml());
            bindEvents();
            updateTotals();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════
    //  OPEN — EDIT
    // ═══════════════════════════════════════════════════
    async function openEdit(factorId, factorKind) {
        if (window.App.Permissions && !window.App.Permissions.can(201)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        try {
            await ensureLookups();

            const detail = await window.App.Http.api('/api/factor/' + factorId);
            if (!detail || !detail.header) {
                window.App.toast('فاکتور یافت نشد', 'error');
                return;
            }

            const h = detail.header;

            _state = {
                mode: 'edit',
                factorId: factorId,
                factorKind: h.factorKind,
                lookups: _state.lookups,
                header: {
                    noFactor: h.noFactor,
                    dateIn: h.dateIn,
                    factorKind: h.factorKind,
                    isCash: h.isCash || 1,
                    transCost: h.transCost || 0,
                    descript: h.descript || '',
                    carInfo: h.carInfo || '',
                    withSanad: true,
                    existingNoSanad: h.noSanad || 0
                },
                items: (detail.items || []).map(mapServerItemToLocal),
                customer: null,
                marketer: null,
                transDistMode: 0
            };

            // لود اطلاعات مشتری
            if (h.codeTafzil > 0) {
                await loadCustomerInfo(h.codeTafzil);
            }
            if (h.codeTafMarketer > 0) {
                await loadMarketerInfo(h.codeTafMarketer);
            }

            window.App.openModal(getTitle(_state.factorKind, 'edit'), buildFormHtml());
            bindEvents();
            renderItemsGrid();
            updateTotals();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════
    //  OPEN — DELETE
    // ═══════════════════════════════════════════════════
    async function deleteFactor(factorId) {
        if (window.App.Permissions && !window.App.Permissions.can(202)) {
            window.App.toast('شما برای این عمل سطح دسترسی لازم را ندارید', 'error');
            return;
        }

        if (!confirm('آیا از حذف این فاکتور مطمئن هستید؟')) return;

        try {
            await window.App.Http.api('/api/factor/' + factorId, { method: 'DELETE' });
            window.App.toast('فاکتور حذف شد', 'success');
            if (window.App.Features.Factor && window.App.Features.Factor.runList) {
                window.App.Features.Factor.runList(1);
            }
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════
    //  HTML BUILDER
    // ═══════════════════════════════════════════════════
    function buildFormHtml() {
        let html = '<div class="ff-form">';

        // ═══ ۱. هدر ═══
        html += buildHeaderSection();

        // ═══ ۲. مشتری ═══
        html += buildCustomerSection();

        // ═══ ۳. بازاریاب (فقط فروش) ═══
        if (_state.factorKind === 1 || _state.factorKind === 3) {
            html += buildMarketerSection();
        }

        // ═══ ۴. پرداخت و توضیحات ═══
        html += buildPaymentSection();

        // ═══ ۴.۵ سند حسابداری ═══
        if ([0, 1, 2, 3].indexOf(_state.factorKind) !== -1) {
            html += buildSanadSection();
        }

        // ═══ ۵. Grid اقلام ═══
        html += buildItemsSection();

        // ═══ ۶. تخفیف گروهی + حمل ═══
        html += buildBulkSection();

        // ═══ ۷. جمع‌ها + Footer ═══
        html += buildTotalsSection();
        html += buildFooter();

        html += '</div>';
        return html;
    }

    // ─── هدر ───
    function buildHeaderSection() {
        const h = _state.header;
        const isEdit = _state.mode === 'edit';

        return '' +
            '<div class="ff-section ff-section-top">' +
              '<div class="ff-section-title">🧾 مشخصات فاکتور</div>' +
              '<div class="ff-grid ff-grid-4">' +

                '<div class="ff-field">' +
                  '<label>شماره فاکتور <span class="req">*</span></label>' +
                  '<input type="text" id="ffNoFactor" value="' + H.esc(h.noFactor || '') + '" class="num-input" dir="ltr">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>تاریخ <span class="req">*</span></label>' +
                  '<input type="text" id="ffDateIn" value="' + H.esc(h.dateIn || '') + '" placeholder="1404/09/26" class="num-input" dir="ltr">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>نوع فاکتور</label>' +
                  '<input type="text" value="' + H.esc(getKindTitle(_state.factorKind)) + '" readonly class="ff-readonly">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>وضعیت</label>' +
                  '<input type="text" value="' + (isEdit ? 'ویرایش' : 'جدید') + '" readonly class="ff-readonly">' +
                '</div>' +

              '</div>' +
            '</div>';
    }

    // ─── مشتری ───
    function buildCustomerSection() {
        const c = _state.customer || {};
        const isBuyKind = (_state.factorKind === 0 || _state.factorKind === 2); // خرید یا برگشت از خرید
        const label = isBuyKind ? 'فروشنده' : 'خریدار';

        return '' +
            '<div class="ff-section ff-section-customer">' +
              '<div class="ff-section-title">🧑 اطلاعات ' + label + ' (تفضیلی ۱)</div>' +

              '<div class="ff-grid ff-grid-3">' +

                '<div class="ff-field">' +
                  '<label>کد ' + label + ' <span class="req">*</span></label>' +
                  '<div class="ff-input-with-btn">' +
            '<input type="text" id="ffCodeTafzil" value="' + (c.codeTafzil || '') + '" class="num-input" dir="ltr" placeholder="کد را وارد کنید...">' +
                    '<button type="button" class="ff-pick-btn" id="ffPickCustomerBtn" title="انتخاب ' + label + '">🔍</button>' +
                  '</div>' +
                '</div>' +

                '<div class="ff-field ff-col-2">' +
                  '<label>نام</label>' +
                  '<input type="text" id="ffCustomerName" value="' + H.esc(c.name || '') + '" readonly class="ff-readonly">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>مانده حساب</label>' +
                  '<input type="text" id="ffMandehHesab" value="' + H.fmt(c.mandeh || 0) + '" readonly class="ff-readonly num-input" dir="ltr">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>تلفن</label>' +
                  '<input type="text" id="ffCustomerPhone" value="' + H.esc(c.phone || '') + '" readonly class="ff-readonly num-input" dir="ltr">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>موبایل</label>' +
                  '<input type="text" id="ffCustomerMobile" value="' + H.esc(c.mobile || '') + '" readonly class="ff-readonly num-input" dir="ltr">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>کد ملی</label>' +
                  '<input type="text" id="ffCustomerNationalCode" value="' + H.esc(c.nationalCode || '') + '" readonly class="ff-readonly num-input" dir="ltr">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>کد اقتصادی</label>' +
                  '<input type="text" id="ffCustomerEconomicCode" value="' + H.esc(c.economicCode || '') + '" readonly class="ff-readonly num-input" dir="ltr">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>استان / شهر</label>' +
                  '<input type="text" id="ffCustomerState" value="' + H.esc((c.stateName || '') + ' / ' + (c.cityName1 || '')) + '" readonly class="ff-readonly">' +
                '</div>' +

              '</div>' +

              '<div class="ff-field ff-col-full" style="margin-top:8px;">' +
                '<label>آدرس</label>' +
                '<input type="text" id="ffCustomerAddress" value="' + H.esc(c.address || '') + '" readonly class="ff-readonly">' +
              '</div>' +

            '</div>';
    }

    // ─── بازاریاب ───
    function buildMarketerSection() {
        const m = _state.marketer || {};

        return '' +
            '<div class="ff-section ff-section-marketer">' +
              '<div class="ff-section-title">📞 بازاریاب (اختیاری)</div>' +

              '<div class="ff-grid ff-grid-3">' +

                '<div class="ff-field">' +
                  '<label>کد بازاریاب</label>' +
                  '<div class="ff-input-with-btn">' +
                    '<input type="text" id="ffCodeMarketer" value="' + (m.codeTafzil || '') + '" class="num-input" dir="ltr" readonly>' +
                    '<button type="button" class="ff-pick-btn" id="ffPickMarketerBtn" title="انتخاب بازاریاب">🔍</button>' +
                    '<button type="button" class="ff-pick-btn" id="ffClearMarketerBtn" title="حذف">✕</button>' +
                  '</div>' +
                '</div>' +

                '<div class="ff-field ff-col-2">' +
                  '<label>نام بازاریاب</label>' +
                  '<input type="text" id="ffMarketerName" value="' + H.esc(m.name || '') + '" readonly class="ff-readonly">' +
                '</div>' +

              '</div>' +
            '</div>';
    }

    // ─── پرداخت و توضیحات ───
    function buildPaymentSection() {
        const h = _state.header;

        return '' +
            '<div class="ff-section">' +
              '<div class="ff-section-title">💳 نحوه پرداخت و توضیحات</div>' +

              '<div class="ff-grid ff-grid-4">' +

                '<div class="ff-field">' +
                  '<label>نحوه فروش</label>' +
                  '<select id="ffIsCash" class="ff-select">' +
                    '<option value="1"' + (h.isCash === 1 ? ' selected' : '') + '>نقدی</option>' +
                    '<option value="2"' + (h.isCash === 2 ? ' selected' : '') + '>غیرنقدی</option>' +
                  '</select>' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>شماره ماشین</label>' +
                  '<input type="text" id="ffCarInfo" value="' + H.esc(h.carInfo || '') + '" maxlength="20">' +
                '</div>' +

                '<div class="ff-field ff-col-2">' +
                  '<label>توضیحات</label>' +
                  '<input type="text" id="ffDescript" value="' + H.esc(h.descript || '') + '" maxlength="200">' +
                '</div>' +

              '</div>' +
            '</div>';
    }

    // ─── سند حسابداری ───
    function buildSanadSection() {
        const h = _state.header;
        const supportsMarketer = _state.factorKind === 1;
        const defaultChecked = h.withSanad !== false;
        const disabledAttr = defaultChecked ? '' : ' disabled';

        return '' +
            '<div class="ff-section ff-section-sanad">' +
            '<div class="ff-section-title">📄 سند حسابداری</div>' +
            '<div class="ff-grid ff-grid-3">' +

            '<div class="ff-field">' +
            '<label class="ff-checkbox-label">' +
            '<input type="checkbox" id="ffWithSanad"' +
            (defaultChecked ? ' checked' : '') + '>' +
            ' صدور سند خودکار' +
            '</label>' +
            '<p class="form-hint">در صورت فعال بودن، سند حسابداری به‌صورت خودکار صادر می‌شود</p>' +
            '</div>' +

            '<div class="ff-field" id="ffNoSanadField">' +
            '<label>شماره سند</label>' +
            '<input type="text" id="ffNoSanad" ' +
            'value="' + (h.existingNoSanad || 0) + '" ' +
            'class="num-input" dir="ltr" ' +
            'placeholder="0 = خودکار"' + disabledAttr + '>' +
            '<p class="form-hint">0 = شماره جدید، عدد = سند موجود</p>' +
            '</div>' +

            (supportsMarketer ?
                '<div class="ff-field">' +
                '<label class="ff-checkbox-label">' +
                '<input type="checkbox" id="ffWithMarketer">' +
                ' صدور سند بازاریاب' +
                '</label>' +
                '<p class="form-hint">فقط برای فاکتور فروش</p>' +
                '</div>'
                : '<div></div>') +

            '</div>' +
            '</div>';
    }
    // ─── اقلام ───
    function buildItemsSection() {
        return '' +
            '<div class="ff-section">' +
              '<div class="ff-section-header">' +
                '<div class="ff-section-title">📋 اقلام فاکتور</div>' +
                '<button type="button" class="btn btn-sm btn-primary" id="ffAddItemBtn">➕ افزودن کالا</button>' +
              '</div>' +
              '<div id="ffItemsGridWrap" class="ff-grid-wrap">' +
                '<div class="ff-grid-empty">هنوز کالایی اضافه نشده — برای شروع «افزودن کالا» را بزنید</div>' +
              '</div>' +
            '</div>';
    }

    // ─── تخفیف گروهی + حمل ───
    function buildBulkSection() {
        return '' +
            '<div class="ff-section ff-section-bulk">' +
              '<div class="ff-grid ff-grid-3">' +

                '<div class="ff-field">' +
                  '<label>تخفیف گروهی (%)</label>' +
                  '<div class="ff-input-with-btn">' +
                    '<input type="text" id="ffBulkDiscountPer" class="num-input" dir="ltr" placeholder="0">' +
                    '<button type="button" class="btn btn-sm btn-ghost" id="ffApplyBulkDiscount">اعمال</button>' +
                  '</div>' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>هزینه حمل</label>' +
                  '<input type="text" id="ffTransCost" value="' + H.fmt(_state.header.transCost || 0) + '" class="num-input" dir="ltr">' +
                '</div>' +

                '<div class="ff-field">' +
                  '<label>تسهیم حمل</label>' +
                  '<div class="ff-radio-inline">' +
                    '<label><input type="radio" name="ffTransMode" value="0" checked> مقدار</label>' +
                    '<label><input type="radio" name="ffTransMode" value="1"> ارزش</label>' +
                    '<button type="button" class="btn btn-sm btn-ghost" id="ffApplyTransCost">اعمال</button>' +
                  '</div>' +
                '</div>' +

              '</div>' +
            '</div>';
    }

    // ─── جمع‌ها ───
    function buildTotalsSection() {
        return '' +
            '<div class="ff-totals" id="ffTotals">' +
              '<div class="ff-total-item">' +
                '<span>جمع اقلام:</span><strong id="ffTotalCostItem">0</strong>' +
              '</div>' +
              '<div class="ff-total-item">' +
                '<span>جمع تخفیف:</span><strong id="ffTotalDiscount">0</strong>' +
              '</div>' +
              '<div class="ff-total-item">' +
                '<span>جمع مالیات:</span><strong id="ffTotalTax">0</strong>' +
              '</div>' +
              '<div class="ff-total-item">' +
                '<span>جمع حمل:</span><strong id="ffTotalTrans">0</strong>' +
              '</div>' +
              '<div class="ff-total-item ff-total-final">' +
                '<span>مبلغ نهایی:</span><strong id="ffTotalFinall">0</strong>' +
              '</div>' +
            '</div>';
    }

    // ─── Footer ───
    function buildFooter() {
        return '' +
            '<div class="ff-footer">' +
            '<button type="button" class="btn btn-primary" id="ffSaveBtn">' +
            '💾 ذخیره <span class="kbd-hint">F2</span>' +
            '</button>' +
            '<button type="button" class="btn btn-ghost" id="ffCancelBtn">' +
            'انصراف <span class="kbd-hint">Esc</span>' +
            '</button>' +
            '<div class="ff-footer-summary">' +
            '<span class="ff-footer-count" id="ffRowCount">0 ردیف</span>' +
            '<span class="ff-footer-total">' +
            'جمع کل: <strong id="ffFooterTotal">0</strong>' +
            '</span>' +
            '</div>' +
            '</div>';
    }

    // ═══════════════════════════════════════════════════
    //  BIND EVENTS
    // ═══════════════════════════════════════════════════
    let _keyHandler = null;

    function bindEvents() {
        const mb = document.getElementById('modalBody');

        // ─── کلیک روی دکمه‌ها ───
        document.getElementById('ffPickCustomerBtn')?.addEventListener('click', pickCustomer);
        document.getElementById('ffPickMarketerBtn')?.addEventListener('click', pickMarketer);
        document.getElementById('ffClearMarketerBtn')?.addEventListener('click', clearMarketer);
        document.getElementById('ffAddItemBtn')?.addEventListener('click', addNewItem);
        document.getElementById('ffApplyBulkDiscount')?.addEventListener('click', applyBulkDiscount);
        document.getElementById('ffApplyTransCost')?.addEventListener('click', applyTransCost);
        document.getElementById('ffSaveBtn')?.addEventListener('click', save);
        document.getElementById('ffCancelBtn')?.addEventListener('click', cancel);

        // ─── تغییر تاریخ ───
        document.getElementById('ffDateIn')?.addEventListener('blur', function () {
            _state.header.dateIn = this.value.trim();
        });
        // ─── کد مشتری: Enter → جستجو ───
        const codeInput = document.getElementById('ffCodeTafzil');
        codeInput?.addEventListener('keydown', async function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const code = (this.value || '').trim();
                if (!code) { pickCustomer(); return; }
                await loadCustomerInfo(parseInt(code, 10));
            }
        });
        // ─── چک‌باکس سند ───
        const withSanadCb = document.getElementById('ffWithSanad');
        const noSanadInput = document.getElementById('ffNoSanad');
        if (withSanadCb && noSanadInput) {
            withSanadCb.addEventListener('change', function () {
                noSanadInput.disabled = !this.checked;
                const field = document.getElementById('ffNoSanadField');
                if (field) field.style.opacity = this.checked ? '1' : '0.5';
            });
            noSanadInput.disabled = !withSanadCb.checked;
        }

        // ─── کد مشتری: blur → جستجو ───
        codeInput?.addEventListener('blur', async function () {
            const code = (this.value || '').trim();
            if (!code) return;
            const currentCode = _state.customer ? _state.customer.codeTafzil : null;
            if (parseInt(code, 10) === currentCode) return;  // تغییری نکرده
            await loadCustomerInfo(parseInt(code, 10));
        });

        // ─── F2 / Esc ───
        if (_keyHandler) document.removeEventListener('keydown', _keyHandler);
        _keyHandler = function (e) {
            const pickerOpen = document.querySelector('.ff-picker-overlay, .ff-item-modal-open');
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

    // ═══════════════════════════════════════════════════
    //  PICK CUSTOMER
    // ═══════════════════════════════════════════════════
    async function pickCustomer() {
        openTafziliPicker({
            title: '🔍 انتخاب طرف حساب',
            filterKind: null,
            onSelect: function (item) {
                // ⭐ مستقیم از داده‌ی picker استفاده کن — بدون API مجدد
                _state.customer = {

                    codeTafzil: item.codeTafzil,
                    name: item.name,
                    phone: item.phone,
                    mobile: item.mobile,
                    nationalCode: item.nationalCode,
                    economicCode: item.economicCode,
                    postalCode: item.postalCode,
                    address: item.address,
                    stateName: item.stateName,
                    cityName1: item.cityName1,
                    cityName2: item.cityName2,
                    mandeh: (item.mabManBed != null && item.mabManBes != null)
                        ? (item.mabManBed - item.mabManBes)
                        : (item.mandeh || 0)
                };
                setVal('ffCodeTafzil', item.codeTafzil);
                renderCustomer();
            }
        });
    }

    async function loadCustomerInfo(codeTafzil) {
        try {
            // ⭐ از endpoint list استفاده می‌کنیم — با pageSize بزرگ
            //    و کد رو در سرور فیلتر می‌کنیم اگه پشتیبانی کرد
            const resp = await window.App.Http.api('/api/tafzili/list', {
                method: 'POST',
                body: JSON.stringify({
                    page: 1,
                    pageSize: 100000,
                    codeTafzil: codeTafzil,      // سرور اگه پشتیبانی کنه فیلتر می‌کنه
                    mandehFilter: 'all'
                })
            });

            // ⭐ در سمت کلاینت هم دقیق چک می‌کنیم
            const found = (resp.items || []).find(function (x) {
                return parseInt(x.codeTafzil, 10) === parseInt(codeTafzil, 10);
            });

            if (!found) {
                window.App.toast('کد ' + codeTafzil + ' یافت نشد', 'error');
                _state.customer = null;
                renderCustomer();
                return false;
            }

            _state.customer = {
                codeTafzil: found.codeTafzil,
                name: found.name,
                phone: found.phone,
                mobile: found.mobile,
                nationalCode: found.nationalCode,
                economicCode: found.economicCode,
                postalCode: found.postalCode,
                address: found.address,
                stateName: found.stateName,
                cityName1: found.cityName1,
                cityName2: found.cityName2,
                mandeh: (found.mabManBed != null && found.mabManBes != null)
                    ? (found.mabManBed - found.mabManBes)
                    : (found.mandeh || 0)
            };
            setVal('ffCodeTafzil', codeTafzil);
            renderCustomer();
            return true;
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            _state.customer = null;
            return false;
        }
    }

    function renderCustomer() {
        const c = _state.customer || {};
        setVal('ffCustomerName', c.name || '');
        setVal('ffMandehHesab', H.fmt(c.mandeh || 0));
        setVal('ffCustomerPhone', c.phone || '');
        setVal('ffCustomerMobile', c.mobile || '');
        setVal('ffCustomerNationalCode', c.nationalCode || '');
        setVal('ffCustomerEconomicCode', c.economicCode || '');
        setVal('ffCustomerState', (c.stateName || '') + ' / ' + (c.cityName1 || ''));
        setVal('ffCustomerAddress', c.address || '');
    }

    // ═══════════════════════════════════════════════════
    //  PICK MARKETER
    // ═══════════════════════════════════════════════════
    async function pickMarketer() {
        openTafziliPicker({
            title: '🔍 انتخاب بازاریاب',
            filterKind: 4,        // Kind=4 برای بازاریاب
            onSelect: async function (item) {
                _state.marketer = {
                    codeTafzil: item.codeTafzil,
                    name: item.name,
                    mobile: item.mobile,
                    phone: item.phone
                };
                renderMarketer();
            }
        });
    }

    function clearMarketer() {
        _state.marketer = null;
        renderMarketer();
    }

    function renderMarketer() {
        const m = _state.marketer || {};
        setVal('ffCodeMarketer', m.codeTafzil || '');
        setVal('ffMarketerName', m.name || '');
    }

    // ═══════════════════════════════════════════════════
    //  PICKER عمومی برای تفضیلی
    // ═══════════════════════════════════════════════════
    function openTafziliPicker(opts) {
        const mb = document.getElementById('modalBody');
        const pickerId = 'ffTafziliPicker';
        const existing = document.getElementById(pickerId);
        if (existing) existing.remove();

        const picker = document.createElement('div');
        picker.id = pickerId;
        picker.className = 'ff-picker-overlay';
        picker.innerHTML =
            '<div class="ff-picker-box">' +
              '<div class="ff-picker-header">' +
                '<span>' + H.esc(opts.title) + '</span>' +
                '<button type="button" class="ff-picker-close">✕</button>' +
              '</div>' +
              '<div class="ff-picker-search">' +
                '<input type="text" id="ffPickerSearch" placeholder="جستجو (کد یا نام)...">' +
              '</div>' +
              '<div class="ff-picker-list" id="ffPickerList">' +
                '<div class="ff-picker-empty">در حال بارگذاری...</div>' +
              '</div>' +
            '</div>';
        mb.appendChild(picker);

        const searchInput = picker.querySelector('#ffPickerSearch');
        const listWrap = picker.querySelector('#ffPickerList');
        let _allItems = [];

        // لود
        (async function load() {
            try {
                const resp = await window.App.Http.api('/api/tafzili/list', {
                    method: 'POST',
                    body: JSON.stringify({
                        page: 1,
                        pageSize: 100000,
                        mandehFilter: 'all',
                        kind: opts.filterKind || null
                    })
                });
                _allItems = (resp.items || []).filter(function (x) {
                    return x.codeTafzil > 0;
                });
                renderList('');
            } catch (err) {
                listWrap.innerHTML = '<div class="ff-picker-empty">خطا در بارگذاری</div>';
            }
        })();

        function renderList(filter) {
            const f = (filter || '').trim().toLowerCase();
            let filtered = _allItems;
            if (f) {
                filtered = _allItems.filter(function (x) {
                    return String(x.codeTafzil).indexOf(f) !== -1 ||
                           (x.name || '').toLowerCase().indexOf(f) !== -1;
                });
            }
            if (filtered.length === 0) {
                listWrap.innerHTML = '<div class="ff-picker-empty">موردی یافت نشد</div>';
                return;
            }

            let html = '';
            filtered.slice(0, 300).forEach(function (x) {
                html += '<div class="ff-picker-item" data-code="' + x.codeTafzil + '">' +
                          '<span class="ff-picker-code">' + x.codeTafzil + '</span>' +
                          '<div class="ff-picker-name-wrap">' +
                            '<div class="ff-picker-name">' + H.esc(x.name || '') + '</div>' +
                            '<div class="ff-picker-sub">' + H.esc(x.phone || x.mobile || '') + '</div>' +
                          '</div>' +
                        '</div>';
            });
            listWrap.innerHTML = html;
        }

        searchInput.addEventListener('input', function () { renderList(this.value); });
        picker.querySelector('.ff-picker-close').addEventListener('click', function () {
            picker.remove();
        });

        picker.addEventListener('click', function (e) {
            if (e.target === picker) { picker.remove(); return; }
            const item = e.target.closest('.ff-picker-item');
            if (!item) return;
            const code = parseInt(item.dataset.code, 10);
            const src = _allItems.find(function (x) {
                return parseInt(x.codeTafzil, 10) === code;
            });
            if (src) {
                opts.onSelect(src);
                picker.remove();
            }
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') picker.remove();
            if (e.key === 'Enter') {
                const first = listWrap.querySelector('.ff-picker-item');
                if (first) first.click();
            }
        });

        setTimeout(function () { searchInput.focus(); }, 50);
    }

    // ═══════════════════════════════════════════════════
    //  ITEMS — Grid
    // ═══════════════════════════════════════════════════
    function addNewItem() {
        // ⚠️ این متد بعداً در فاز 4b — با دیالوگ واقعی جایگزین می‌شود
        if (!window.App.Features.FactorItemForm) {
            window.App.toast('دیالوگ کالا هنوز آماده نیست', 'error');
            return;
        }

        window.App.Features.FactorItemForm.openForAdd({
            factorKind: _state.factorKind,
            codeTafzil: _state.customer ? _state.customer.codeTafzil : null,
            factorDate: _state.header.dateIn,
            existingItems: _state.items,
            onSave: function (item) {
                _state.items.push(item);
                renderItemsGrid();
                updateTotals();
            }
        });
    }

    function editItem(index) {
        if (!window.App.Features.FactorItemForm) return;

        window.App.Features.FactorItemForm.openForEdit({
            factorKind: _state.factorKind,
            codeTafzil: _state.customer ? _state.customer.codeTafzil : null,
            factorDate: _state.header.dateIn,
            item: _state.items[index],
            existingItems: _state.items.filter(function (_, i) { return i !== index; }),
            onSave: function (item) {
                _state.items[index] = item;
                renderItemsGrid();
                updateTotals();
            }
        });
    }

    function removeItem(index) {
        if (!confirm('این ردیف حذف بشود؟')) return;
        _state.items.splice(index, 1);
        renderItemsGrid();
        updateTotals();
    }

    function renderItemsGrid() {
        const wrap = document.getElementById('ffItemsGridWrap');
        if (!wrap) return;

        if (_state.items.length === 0) {
            wrap.innerHTML = '<div class="ff-grid-empty">هنوز کالایی اضافه نشده — برای شروع «افزودن کالا» را بزنید</div>';
            updateRowCount();
            return;
        }

        let html = '<table class="ff-items-table">' +
            '<thead>' +
              '<tr>' +
                '<th style="width:35px;">#</th>' +
                '<th style="width:80px;">کد کالا</th>' +
                '<th>نام کالا</th>' +
                '<th style="width:60px;">واحد</th>' +
                '<th class="num-col" style="width:70px;">تعداد</th>' +
                '<th class="num-col" style="width:90px;">قیمت واحد</th>' +
                '<th class="num-col" style="width:110px;">مبلغ کل</th>' +
                '<th class="num-col" style="width:100px;">تخفیف</th>' +
                '<th class="num-col" style="width:90px;">مالیات</th>' +
                '<th class="num-col" style="width:80px;">حمل</th>' +
                '<th class="num-col" style="width:110px;">جمع نهایی</th>' +
                '<th style="width:60px;"></th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>';

        _state.items.forEach(function (it, idx) {
            html += '<tr class="ff-item-row" data-index="' + idx + '">' +
                '<td class="text-center">' + (idx + 1) + '</td>' +
                '<td class="num text-center">' + H.esc(it.articleCode || '') + '</td>' +
                '<td>' + H.esc(it.articleName || '') + '</td>' +
                '<td class="text-center">' + H.esc(it.articleUnit || '') + '</td>' +
                '<td class="num text-left">' + H.fmt(it.articleCount) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.cost) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.costItem) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.discount) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.tax) + '</td>' +
                '<td class="num text-left">' + H.fmt(it.transCost) + '</td>' +
                '<td class="num text-left" style="font-weight:600;">' + H.fmt(it.finallCost) + '</td>' +
                '<td class="text-center">' +
                  '<button type="button" class="ff-row-del" data-remove="' + idx + '" title="حذف">🗑️</button>' +
                '</td>' +
              '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;

        // ─── رویدادها ───
        wrap.querySelectorAll('.ff-item-row').forEach(function (row) {
            row.addEventListener('click', function (e) {
                if (e.target.closest('[data-remove]')) return;
                const idx = parseInt(this.dataset.index, 10);
                editItem(idx);
            });
        });
        wrap.querySelectorAll('[data-remove]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const idx = parseInt(this.dataset.remove, 10);
                removeItem(idx);
            });
        });

        updateRowCount();
    }

    function updateRowCount() {
        const el = document.getElementById('ffRowCount');
        if (el) el.textContent = _state.items.length.toLocaleString('fa-IR') + ' ردیف';
    }

    // ═══════════════════════════════════════════════════
    //  تخفیف گروهی
    // ═══════════════════════════════════════════════════
    function applyBulkDiscount() {
        const el = document.getElementById('ffBulkDiscountPer');
        const per = parseFloat((el.value || '0').replace(/,/g, ''));
        if (isNaN(per) || per <= 0) {
            window.App.toast('درصد تخفیف را وارد کنید', 'error');
            return;
        }
        if (_state.items.length === 0) {
            window.App.toast('ابتدا کالا اضافه کنید', 'error');
            return;
        }

        const taxFi = (_state.lookups.taxFi || 0);

        _state.items.forEach(function (it) {
            const costItem = it.costItem;
            const disc = Math.round(costItem * per / 100);
            const costTax = costItem - disc;
            const tax = it.taxFi > 0
                ? Math.round(costTax * it.taxFi / 100)
                : Math.round(costTax * taxFi / 100);

            it.perDiscount = per;
            it.discount = disc;
            it.costTax = costTax;
            it.tax = tax;
            it.finallCost = costTax + tax;
        });

        renderItemsGrid();
        updateTotals();
        window.App.toast('تخفیف گروهی اعمال شد', 'success');
    }

    // ═══════════════════════════════════════════════════
    //  تسهیم حمل
    // ═══════════════════════════════════════════════════
    function applyTransCost() {
        const el = document.getElementById('ffTransCost');
        const total = parseFloat((el.value || '0').replace(/,/g, '')) || 0;
        _state.header.transCost = total;

        if (_state.items.length === 0) {
            window.App.toast('ابتدا کالا اضافه کنید', 'error');
            return;
        }
        if (total === 0) {
            // صفر کردن حمل
            _state.items.forEach(function (it) {
                it.transCost = 0;
                it.incCost = 0;
                recalcRow(it);
            });
            renderItemsGrid();
            updateTotals();
            return;
        }

        const mode = parseInt(
            document.querySelector('input[name="ffTransMode"]:checked').value, 10);

        // ─── محاسبه‌ی مبنا ───
        let sumBase = 0;
        _state.items.forEach(function (it) {
            sumBase += (mode === 0)
                ? it.articleCount
                : it.costItem;
        });

        if (sumBase === 0) return;

        // ─── تسهیم ───
        let distributed = 0;
        const lastIdx = _state.items.length - 1;

        _state.items.forEach(function (it, idx) {
            const rowBase = (mode === 0) ? it.articleCount : it.costItem;
            let share = Math.trunc((total * rowBase) / sumBase);

            // ─── ردیف آخر: تصحیح باقیمانده ───
            if (idx === lastIdx) {
                share = total - distributed;
            }
            distributed += share;

            const oldCost = it.cost;
            const newCost = Math.round(
                (share + oldCost * it.articleCount) / it.articleCount);

            it.transCost = share;
            it.incCost = newCost - oldCost;
            it.cost = newCost;
            recalcRow(it);
        });

        renderItemsGrid();
        updateTotals();
        window.App.toast('هزینه حمل تسهیم شد', 'success');
    }

    function recalcRow(it) {
        it.costItem = it.cost * it.articleCount;
        // تخفیف بر اساس درصد (اگه درصد داده شده)
        if (it.perDiscount > 0) {
            it.discount = Math.round(it.costItem * it.perDiscount / 100);
        }
        it.costTax = it.costItem - it.discount;
        const taxFi = it.taxFi > 0 ? it.taxFi : (_state.lookups.taxFi || 0);
        it.tax = Math.round(it.costTax * taxFi / 100);
        it.finallCost = it.costTax + it.tax;

        // بازاریاب
        if (it.marketerPercent > 0) {
            it.marketerCosts = Math.round(it.costItem * it.marketerPercent / 100);
        }
    }

    // ═══════════════════════════════════════════════════
    //  TOTALS
    // ═══════════════════════════════════════════════════
    function updateTotals() {
        let sumCostItem = 0, sumDiscount = 0, sumTax = 0, sumTrans = 0, sumFinall = 0;

        _state.items.forEach(function (it) {
            sumCostItem += it.costItem || 0;
            sumDiscount += it.discount || 0;
            sumTax += it.tax || 0;
            sumTrans += it.transCost || 0;
            sumFinall += it.finallCost || 0;
        });

        setText('ffTotalCostItem', H.fmt(sumCostItem));
        setText('ffTotalDiscount', H.fmt(sumDiscount));
        setText('ffTotalTax', H.fmt(sumTax));
        setText('ffTotalTrans', H.fmt(sumTrans));
        setText('ffTotalFinall', H.fmt(sumFinall));
        setText('ffFooterTotal', H.fmt(sumFinall));

        _state.header.totalCost = sumFinall;
    }

    // ═══════════════════════════════════════════════════
    //  SAVE
    // ═══════════════════════════════════════════════════
    async function save() {
        // ─── اعتبارسنجی (بدون تغییر) ───
        const noFactor = parseInt(val('ffNoFactor'), 10);
        if (!noFactor || noFactor <= 0) {
            window.App.toast('شماره فاکتور الزامی است', 'error');
            return;
        }
        const dateIn = val('ffDateIn').trim();
        if (!dateIn) {
            window.App.toast('تاریخ فاکتور الزامی است', 'error');
            return;
        }
        if (!_state.customer || !_state.customer.codeTafzil) {
            window.App.toast('انتخاب طرف حساب الزامی است', 'error');
            return;
        }
        if (_state.items.length === 0) {
            window.App.toast('حداقل یک کالا اضافه کنید', 'error');
            return;
        }

        // ─── Payload فاکتور ───
        const payload = {
            noFactor: noFactor,
            dateIn: dateIn,
            descript: val('ffDescript'),
            factorKind: _state.factorKind,
            isCash: parseInt(val('ffIsCash'), 10) || 1,
            codeTafzil: _state.customer.codeTafzil,
            codeTafMarketer: _state.marketer ? _state.marketer.codeTafzil : null,
            stockId: 0,
            transCost: _state.header.transCost || 0,
            carInfo: val('ffCarInfo'),
            perOk: 0,
            noFactorPer: 0,
            cost: _state.header.totalCost || 0,
            items: _state.items.map(mapLocalItemToServer)
        };

        // ─── سند خودکار ───
        const withSanadCb = document.getElementById('ffWithSanad');
        const withSanad = withSanadCb ? withSanadCb.checked : false;
        const withMarketerCb = document.getElementById('ffWithMarketer');
        const withMarketer = withMarketerCb ? withMarketerCb.checked : false;
        const noSanadInput = document.getElementById('ffNoSanad');
        const noSanadValue = withSanad && noSanadInput
            ? (parseInt(noSanadInput.value, 10) || 0)
            : 0;

        const btn = document.getElementById('ffSaveBtn');
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ در حال ذخیره...';

        try {
            let factorId = _state.factorId;

            // ─── ۱. ذخیره فاکتور ───
            if (_state.mode === 'create') {
                const resp = await window.App.Http.api('/api/factor', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                factorId = resp.id;
                window.App.toast('فاکتور جدید ثبت شد', 'success');
            } else {
                await window.App.Http.api('/api/factor/' + _state.factorId, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.App.toast('فاکتور به‌روزرسانی شد', 'success');
            }

            // ─── ۲. سند خودکار ───
            if (withSanad && factorId) {
                btn.innerHTML = '⏳ در حال ثبت سند...';

                try {
                    const sanadResult = await window.App.Http.api(
                        '/api/factor/' + factorId + '/create-sanad',
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                noSanad: noSanadValue,
                                withMarketer: withMarketer,
                                noSanadMarketer: 0
                            })
                        });

                    if (sanadResult.success) {
                        window.App.toast(
                            '✅ سند شماره ' + (sanadResult.noSanad || '—') + ' صادر شد',
                            'success'
                        );
                    } else {
                        window.App.toast(
                            '⚠️ فاکتور ثبت شد ولی سند خطا داد: ' +
                            (sanadResult.error || 'ناشناخته'),
                            'error'
                        );
                    }
                } catch (sanadErr) {
                    window.App.toast(
                        '⚠️ فاکتور ثبت شد ولی سند خطا داد: ' + sanadErr.message,
                        'error'
                    );
                }
            }

            unbindKeyboard();
            window.App.closeModal();

            if (window.App.Features.Factor && window.App.Features.Factor.runList) {
                window.App.Features.Factor.runList(1);
            }
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    // ═══════════════════════════════════════════════════
    //  CANCEL
    // ═══════════════════════════════════════════════════
    function cancel() {
        if (_state.items.length > 0) {
            if (!confirm('تغییرات ذخیره نشده — از فرم خارج بشوید؟')) return;
        }
        unbindKeyboard();
        window.App.closeModal();
    }

    // ═══════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════
    function val(id) {
        const el = document.getElementById(id);
        return el ? (el.value || '') : '';
    }
    function setVal(id, v) {
        const el = document.getElementById(id);
        if (el) el.value = v;
    }
    function setText(id, v) {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
    }

    function getTitle(kind, mode) {
        const action = mode === 'create' ? 'ثبت' : 'ویرایش';
        return action + ' — ' + getKindTitle(kind);
    }

    function getKindTitle(kind) {
        const map = {
            0: 'فاکتور خرید',
            1: 'فاکتور فروش',
            2: 'برگشت از خرید',
            3: 'برگشت از فروش',
            4: 'پیش‌فاکتور',
            9: 'فاکتور ضایعات'
        };
        return map[kind] || ('فاکتور نوع ' + kind);
    }

    function getTodayPersian() {
        return H.todayPersian();
    }

    function mapServerItemToLocal(s) {
        return {
            articleId: s.articleId,
            articleCode: s.articleCode,
            articleName: s.articleName,
            articleUnit: s.articleUnitName,
            articleCount: s.articleCount || 0,
            cost: s.cost || 0,
            incCost: s.incCost || 0,
            discount: s.discount || 0,
            perDiscount: s.perDiscount || 0,
            tax: s.tax || 0,
            taxFi: s.taxFi || 0,
            transCost: s.transCost || 0,
            costItem: s.costItem || 0,
            costTax: s.costTax || 0,
            finallCost: s.finallCost || 0,
            stockId: s.stockId || 0,
            marketerPercent: s.marketerPercent || 0,
            marketerCosts: s.marketerCosts || 0,
            degreeKala: s.degreeKala || 0,
            dropKala: s.dropKala || 0,
            _calc: null    // اطلاعات کمکی از سرور
        };
    }

    function mapLocalItemToServer(it) {
        return {
            articleId: it.articleId,
            articleCount: it.articleCount,
            articleCount2: 0,
            articleCount3: 0,
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
    }

    // ═══════════════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════════════
    return {
        openCreate: openCreate,
        openEdit: openEdit,
        delete: deleteFactor,
        // برای دیالوگ ردیف (فاز 4b)
        _getState: function () { return _state; }
    };
})();

// alias
window.App.openFactorCreate = window.App.Features.FactorForm.openCreate;
window.App.openFactorEdit = window.App.Features.FactorForm.openEdit;