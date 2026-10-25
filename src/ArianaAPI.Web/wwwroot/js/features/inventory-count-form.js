/* ═══════════════════════════════════════════════════
   Feature / InventoryCountForm — فرم شمارش انبارگردانی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.InventoryCountForm = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _overlay = null;
    let _tagId = null;
    let _tagData = null;

    async function open(tagId) {
        _tagId = tagId;
        try {
            _tagData = await window.App.Http.api(`/api/inventory/tags/${tagId}`);
            renderForm();
        } catch (e) {
            window.App.toast('خطا در بارگذاری جزئیات تگ', 'error');
        }
    }

    function renderForm() {
        if (_overlay) _overlay.remove();

        // وضعیت‌های تگ
        const isLocked = _tagData.tagStatus >= 2; // اگر 2 یا 3 باشد، قفل است
        const statusMap = { 0: 'چاپ شده', 1: 'در حال شمارش', 2: 'تکمیل شده', 3: 'سند صادر شده' };

        _overlay = document.createElement('div');
        _overlay.className = 'hp-overlay';
        _overlay.style.zIndex = '11000';

        _overlay.innerHTML = `
        <div class="hp-box" style="width:min(96vw, 1100px);">
            <div class="hp-header">
                <span>📝 شمارش تگ: ${H.esc(_tagData.tagNo)}</span>
                <button class="hp-close" id="icfClose">✕</button>
            </div>
            
            <div style="padding:16px 20px; background:#F8FAFC; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="margin-left:15px;"><b>انبار:</b> ${H.esc(_tagData.stockName)}</span>
                    <span style="margin-left:15px;"><b>مرحله:</b> ${_tagData.stageNo}</span>
                    <span style="margin-left:15px;"><b>تاریخ:</b> ${H.esc(_tagData.tagDate)}</span>
                    <span><b>وضعیت:</b> <span class="inv-badge inv-badge-${_tagData.tagStatus}">${statusMap[_tagData.tagStatus]}</span></span>
                </div>
                <div>
                    ${_tagData.tagStatus === 1 ? `<button class="btn btn-success" id="icfConfirmBtn">✅ تأیید نهایی تگ</button>` : ''}
                    ${_tagData.tagStatus === 2 ? `<button class="btn btn-primary" id="icfSanadBtn">📄 صدور سند حسابداری</button>` : ''}
                    ${_tagData.tagStatus === 3 ? `<button class="btn btn-warning" id="icfRecreateSanadBtn">🔄 بازسازی سند</button>` : ''}
                </div>
            </div>

            <div class="table-wrapper" style="max-height:60vh; overflow-y:auto;">
                <table class="data-table">
                    <thead style="position:sticky; top:0; z-index:10;">
                        <tr>
                            <th style="width:35px;">#</th>
                            <th style="width:90px;">کد کالا</th>
                            <th>نام کالا</th>
                            <th style="width:60px;">واحد</th>
                            <th class="text-left" style="width:90px;">موجودی سیستم</th>
                            <th class="text-left" style="width:100px;">مقدار شمارش</th>
                            <th class="text-left" style="width:100px;">ضایعات</th>
                            <th class="text-left" style="width:100px;">اختلاف</th>
                            <th style="width:70px;">عملیات</th>
                        </tr>
                    </thead>
                    <tbody id="icfItemsBody">
                        ${renderItems(isLocked)}
                    </tbody>
                </table>
            </div>

            <div class="hp-footer" style="display:flex; justify-content:flex-end; padding:10px 20px; border-top:1px solid #E2E8F0;">
                <button class="btn btn-secondary" id="icfCancel">بستن</button>
            </div>
        </div>`;
        document.body.appendChild(_overlay);

        // بایندها
        document.getElementById('icfClose').addEventListener('click', close);
        document.getElementById('icfCancel').addEventListener('click', close);

        document.getElementById('icfConfirmBtn')?.addEventListener('click', confirmTag);
        document.getElementById('icfSanadBtn')?.addEventListener('click', createSanad);
        document.getElementById('icfRecreateSanadBtn')?.addEventListener('click', recreateSanad);

        bindItemActions(isLocked);
    }

    function renderItems(isLocked) {
        if (!_tagData.items || _tagData.items.length === 0) {
            return '<tr><td colspan="9" class="text-center" style="padding:20px;color:#94A3B8;">کالایی ثبت نشده است</td></tr>';
        }

        return _tagData.items.map((it, idx) => {
            const diff = it.diffQty || 0;
            let diffClass = 'inv-diff-zero';
            if (diff > 0) diffClass = 'inv-diff-positive';
            else if (diff < 0) diffClass = 'inv-diff-negative';

            const countedVal = it.countedQty !== null ? it.countedQty : '';
            const scrapVal = it.scrapQty !== null ? it.scrapQty : '';

            return `<tr data-id="${it.id}">
                <td class="text-center">${idx + 1}</td>
                <td class="num text-center">${H.esc(it.articleCode)}</td>
                <td>${H.esc(it.articleName)}</td>
                <td class="text-center">${H.esc(it.unitName)}</td>
                <td class="num text-left">${H.fmt(it.systemQty)}</td>
                
                <td class="text-left">
                    ${isLocked
                    ? H.fmt(it.countedQty || 0)
                    : `<input type="text" class="inv-count-input icf-counted" dir="ltr" value="${countedVal}" data-id="${it.id}">`}
                </td>
                <td class="text-left">
                    ${isLocked
                    ? H.fmt(it.scrapQty || 0)
                    : `<input type="text" class="inv-count-input icf-scrap" dir="ltr" value="${scrapVal}" data-id="${it.id}">`}
                </td>
                
                <td class="num text-left ${diffClass} icf-diff-val">${H.fmt(diff)}</td>
                
                <td class="text-center">
                    ${!isLocked ? `<button class="btn-icon icf-save-row" data-id="${it.id}" title="ذخیره این ردیف">💾</button>` : '🔒'}
                </td>
            </tr>`;
        }).join('');
    }

    function bindItemActions(isLocked) {
        if (isLocked) return;

        // محاسبه زنده اختلاف هنگام تایپ
        document.querySelectorAll('.icf-counted, .icf-scrap').forEach(input => {
            input.addEventListener('input', function () {
                const tr = this.closest('tr');
                const id = parseInt(this.dataset.id);
                const item = _tagData.items.find(x => x.id === id);
                if (!item) return;

                const counted = parseNum(tr.querySelector('.icf-counted').value);
                const scrap = parseNum(tr.querySelector('.icf-scrap').value);
                const diff = (counted - scrap) - item.systemQty;

                const diffCell = tr.querySelector('.icf-diff-val');
                diffCell.textContent = H.fmt(diff);

                diffCell.className = 'num text-left icf-diff-val ';
                if (diff > 0) diffCell.classList.add('inv-diff-positive');
                else if (diff < 0) diffCell.classList.add('inv-diff-negative');
                else diffCell.classList.add('inv-diff-zero');
            });
        });

        // دکمه ذخیره ردیف
        document.querySelectorAll('.icf-save-row').forEach(btn => {
            btn.addEventListener('click', async function () {
                const tr = this.closest('tr');
                const id = parseInt(this.dataset.id);

                const counted = parseNum(tr.querySelector('.icf-counted').value);
                const scrap = parseNum(tr.querySelector('.icf-scrap').value);

                this.disabled = true;
                this.innerHTML = '⏳';

                try {
                    await window.App.Http.api(`/api/inventory/tags/${_tagId}/count`, {
                        method: 'POST',
                        body: JSON.stringify({ tagDetailId: id, countedQty: counted, scrapQty: scrap }),
                        silent: true // برای اینکه برای هر ردیف پیام موفقیت نده و شلوغ نشه
                    });

                    this.innerHTML = '✅';
                    window.App.toast('ردیف ذخیره شد', 'success');

                    // آپدیت دیتای لوکال
                    const item = _tagData.items.find(x => x.id === id);
                    if (item) {
                        item.countedQty = counted;
                        item.scrapQty = scrap;
                        item.diffQty = (counted - scrap) - item.systemQty;
                    }

                    // اگر اولین شمارش بود، وضعیت تگ در دیتابیس به 1 (در حال شمارش) تغییر میکند
                    if (_tagData.tagStatus === 0) {
                        _tagData.tagStatus = 1;
                        // رفرش فرم برای نمایش دکمه تایید نهایی
                        setTimeout(() => renderForm(), 500);
                    }

                } catch (e) {
                    this.disabled = false;
                    this.innerHTML = '💾';
                }
            });
        });
    }

    async function confirmTag() {
        const ok = await window.App.confirm('آیا از تأیید نهایی این تگ اطمینان دارید؟ پس از تأیید امکان ویرایش مقادیر وجود ندارد.', { danger: true, okText: 'تأیید می‌کنم' });
        if (!ok) return;

        try {
            await window.App.Http.api(`/api/inventory/tags/${_tagId}/confirm`, {
                method: 'POST', successMsg: 'تگ با موفقیت تأیید شد'
            });
            open(_tagId); // رفرش فرم
        } catch (e) {
            window.App.alert.error(e.message);
        }
    }

    async function createSanad() {
        const ok = await window.App.confirm('آیا از صدور سند حسابداری برای این تگ اطمینان دارید؟', { okText: 'بله، صادر کن' });
        if (!ok) return;

        try {
            const res = await window.App.Http.api(`/api/inventory/tags/${_tagId}/create-sanad`, {
                method: 'POST'
            });
            window.App.toast(res.message || 'سند صادر شد', 'success');
            open(_tagId);
        } catch (e) {
            window.App.alert.error(e.error || e.message);
        }
    }

    async function recreateSanad() {
        const ok = await window.App.confirm('با بازسازی سند، سند قبلی حذف و سند جدید صادر می‌شود. ادامه می‌دهید؟', { danger: true, okText: 'بازسازی کن' });
        if (!ok) return;

        try {
            const res = await window.App.Http.api(`/api/inventory/tags/${_tagId}/recreate-sanad`, {
                method: 'POST'
            });
            window.App.toast(res.message || 'سند بازسازی شد', 'success');
            open(_tagId);
        } catch (e) {
            window.App.alert.error(e.error || e.message);
        }
    }

    function parseNum(v) {
        if (!v) return 0;
        const latin = H.toLatinDigits ? H.toLatinDigits(String(v)) : String(v);
        const n = parseFloat(latin.replace(/,/g, ''));
        return isNaN(n) ? 0 : n;
    }

    function close() {
        if (_overlay) _overlay.remove();
        _overlay = null;
        // رفرش لیست تگ‌ها در پس‌زمینه
        if (window.App.Features.InventoryTags) window.App.Features.InventoryTags.render();
    }

    return { open };
})();