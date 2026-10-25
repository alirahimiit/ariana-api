/* ═══════════════════════════════════════════════════
   Feature / InventoryTagCreate — فرم ثبت تگ جدید
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.InventoryTagCreate = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;
    let _lookups = null;
    let _selectedArticles = [];
    let _overlay = null;
    let _returnUrl = 'hub'; 

    async function render(from = 'hub')
    { 
        _returnUrl = from;
        try {
            _lookups = await window.App.Http.api('/api/inventory/lookups');
        } catch (e) {
            return window.App.toast('خطا در بارگذاری اطلاعات پایه', 'error');
        }

        _selectedArticles = [];
        const today = _lookups.todayDate;
        const stockOpts = _lookups.stockTypes.map(s => `<option value="${s.id}">${H.esc(s.name)}</option>`).join('');

        if (_overlay) _overlay.remove();
        _overlay = document.createElement('div');
        _overlay.className = 'hp-overlay';
        _overlay.style.zIndex = '11000';

        _overlay.innerHTML = `
        <div class="hp-box" style="width:min(96vw, 1000px); max-height: 90vh; display: flex; flex-direction: column;">
            
            <!-- هدر ثابت -->
            <div class="hp-header" style="flex-shrink: 0;">
                <span>➕ ثبت تگ جدید انبارگردانی</span>
                <button class="hp-close" id="itcClose">✕</button>
            </div>
            
            <!-- بدنه اسکرول‌شونده -->
            <div style="padding:16px 20px; flex: 1; overflow-y: auto; background:#F8FAFC;">
                
                <div class="card" style="margin-bottom:15px;">
                    <div class="filters two-rows">
                        <div class="form-group">
                            <label>انبار <span class="req">*</span></label>
                            <select id="itcStock" class="form-select" style="width:100%;"><option value="">انتخاب کنید...</option>${stockOpts}</select>
                        </div>
                        <div class="form-group">
                            <label>مرحله <span class="req">*</span></label>
                            <select id="itcStage" class="form-select" style="width:100%;"><option value="">اول انبار را انتخاب کنید</option></select>
                        </div>
                        <div class="form-group">
                            <label>تاریخ <span class="req">*</span></label>
                            <input type="text" id="itcDate" dir="ltr" value="${today}">
                        </div>
                        <div class="form-group">
                            <label>کد مکان</label>
                            <input type="text" id="itcLocation" placeholder="اختیاری">
                        </div>
                    </div>
                </div>

                 <div class="card" style="margin-bottom:0;">
                    <div class="card-title">
                        <span>📋 کالاهای انتخاب شده</span>
                        <button class="btn btn-sm btn-primary" id="itcAddArticleBtn">➕ افزودن کالا</button>
                    </div>
                    <div class="table-wrapper" style="border: none;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th style="width:35px;">#</th>
                                    <th style="width:100px;">کد کالا</th>
                                    <th>نام کالا</th>
                                    <th style="width:60px;">واحد</th>
                                    <th class="text-left" style="width:100px;">موجودی سیستم</th>
                                    <th style="width:60px;">عملیات</th>
                                </tr>
                            </thead>
                            <tbody id="itcItemsBody">
                                <tr><td colspan="6" class="text-center" style="padding:20px;color:#94A3B8;">کالایی اضافه نشده است</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            
            <!-- فوتر ثابت -->
            <div class="hp-footer" style="flex-shrink: 0; display:flex; justify-content:flex-end; gap:8px; padding:12px 20px; border-top:1px solid #E2E8F0; background:#fff; border-radius: 0 0 12px 12px;">
                <button class="btn btn-secondary" id="itcCancel">انصراف</button>
                <button class="btn btn-primary" id="itcSave">💾 ثبت نهایی تگ</button>
            </div>
            
        </div>`;
        document.body.appendChild(_overlay);

        // بایندها
        document.getElementById('itcClose').addEventListener('click', close);
        document.getElementById('itcCancel').addEventListener('click', close);
        document.getElementById('itcSave').addEventListener('click', save);

        document.getElementById('itcStock').addEventListener('change', async function () {
            const sid = this.value;
            const stageSel = document.getElementById('itcStage');
            stageSel.innerHTML = '<option value="">در حال بارگذاری...</option>';
            if (!sid) {
                stageSel.innerHTML = '<option value="">اول انبار را انتخاب کنید</option>';
                return;
            }
            try {
                const stages = await window.App.Http.api(`/api/inventory/stages?stockTypeId=${sid}`);
                if (stages.length === 0) {
                    stageSel.innerHTML = '<option value="">مرحله‌ای تعریف نشده</option>';
                } else {
                    stageSel.innerHTML = stages.map(s => `<option value="${s.stageNo}">${s.stageNo} - ${H.esc(s.stageName)}</option>`).join('');
                }
            } catch (e) { stageSel.innerHTML = '<option value="">خطا در بارگذاری</option>'; }
        });

        document.getElementById('itcAddArticleBtn').addEventListener('click', openArticlePicker);

        renderItems();
    }

    function renderItems() {
        const tbody = document.getElementById('itcItemsBody');
        if (_selectedArticles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:20px;color:#94A3B8;">کالایی اضافه نشده است</td></tr>';
            return;
        }

        tbody.innerHTML = _selectedArticles.map((it, idx) => `
            <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="num text-center">${H.esc(it.code)}</td>
                <td>${H.esc(it.name)}</td>
                <td class="text-center">${H.esc(it.unitName || '')}</td>
                <td class="num text-left">${H.fmt(it.systemQty)}</td>
                <td class="text-center">
                    <button class="btn-icon btn-icon-danger" onclick="App.Features.InventoryTagCreate.removeItem(${idx})">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    function removeItem(idx) {
        _selectedArticles.splice(idx, 1);
        renderItems();
    }

    // پیکر کالا (شبیه به stock-form)
    // پیکر کالا (با قابلیت انتخاب گروهی و فیلتر انبار)
    function openArticlePicker() {
        const stockId = document.getElementById('itcStock').value;
        if (!stockId) return window.App.toast('ابتدا انبار را انتخاب کنید', 'warning');

        const pk = document.createElement('div');
        pk.className = 'ffi-article-picker';
        pk.style.zIndex = '13000';

        // فیلتر کردن گروه‌ها فقط برای انبار انتخاب شده
        const filteredGroups = (_lookups.articleGroups || []).filter(g => String(g.stockTypeId) === String(stockId));

        // ساخت آپشن‌های گروه به صورت استاندارد
        const groupOpts = filteredGroups.map(g => `<option value="${g.id}">${H.esc(g.name)}</option>`).join('');

        pk.innerHTML = `<div class="ffi-picker-box" style="width: 750px; max-width: 95vw; display: flex; flex-direction: column; height: 80vh; max-height: 600px;">
            <div class="ffi-picker-header">
                <span>🔍 جستجو و انتخاب گروهی کالا</span>
                <button class="ffi-picker-close">✕</button>
            </div>
            
            <!-- بخش فیلترها با select بومی -->
            <div style="padding:12px; background:#F8FAFC; border-bottom:1px solid #E2E8F0; flex-shrink: 0;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <select id="itcSearchGroup" class="form-select" style="width: 200px; height: 38px; padding: 0 10px; border: 1px solid #CBD5E1; border-radius: 6px;">
                        <option value="">همه گروه‌ها</option>
                        ${groupOpts}
                    </select>
                    
                    <input type="text" id="itcArticleSearch" placeholder="کد یا نام کالا..." style="flex: 1; height: 38px; padding: 0 10px; border: 1px solid #CBD5E1; border-radius: 6px;">
                    
                    <button type="button" class="btn btn-sm btn-secondary" id="itcSelectAllBtn" style="height: 38px; white-space: nowrap;">✔️ انتخاب همه</button>
                </div>
            </div>
            
            <!-- لیست کالاها -->
            <div class="ffi-picker-list" id="itcArticleList" style="flex: 1; overflow-y: auto; padding:0 10px;">
                <div class="ffi-picker-empty">در حال بارگذاری...</div>
            </div>
            
            <!-- فوتر -->
            <div class="ffi-picker-footer" style="padding:12px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; background:#F8FAFC; flex-shrink: 0;">
                <span id="itcSelectedCount" style="font-weight:bold; color:#4F46E5;">۰ مورد انتخاب شده</span>
                <button type="button" class="btn btn-primary" id="itcAddSelectedBtn">➕ افزودن به تگ</button>
            </div>
        </div>`;

        document.body.appendChild(pk);

        const searchInput = pk.querySelector('#itcArticleSearch');
        const groupSelect = pk.querySelector('#itcSearchGroup');
        const listWrap = pk.querySelector('#itcArticleList');
        const countLabel = pk.querySelector('#itcSelectedCount');

        let _pickerSelectedIds = new Set();
        let _currentListData = [];
        let debounce = null;

        function updateCount() {
            countLabel.textContent = `${H.fmt(_pickerSelectedIds.size)} مورد انتخاب شده`;
        }

        function doSearch() {
            const q = searchInput.value.trim();
            const gid = groupSelect.value;

            listWrap.innerHTML = '<div class="ffi-picker-empty">در حال جستجو...</div>';

            const payload = {
                code: /^\d/.test(q) ? q : null,
                name: !/^\d/.test(q) && q ? q : null,
                groupId: gid ? parseInt(gid) : null,
                stockTypeId: parseInt(stockId),
                page: 1, pageSize: 500
            };

            window.App.Http.api('/api/article/list', { method: 'POST', body: JSON.stringify(payload) })
                .then(resp => {
                    _currentListData = resp.items || [];
                    if (_currentListData.length === 0) return listWrap.innerHTML = '<div class="ffi-picker-empty">کالایی یافت نشد</div>';

                    const html = _currentListData.map(a => {
                        const isSelected = _pickerSelectedIds.has(a.id);
                        const isAlreadyAdded = _selectedArticles.some(x => x.id === a.id);

                        return `<div class="ffi-picker-item" style="display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px solid #F1F5F9; ${isAlreadyAdded ? 'opacity:0.5;' : ''}">
                            <input type="checkbox" class="itc-pick-chk" data-id="${a.id}" 
                                ${isSelected ? 'checked' : ''} 
                                ${isAlreadyAdded ? 'disabled' : ''}
                                style="width:18px; height:18px; cursor:pointer;">
                            <div style="flex:1; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <span class="ffi-picker-code" style="font-weight:bold; margin-left:10px; color:#1E293B;">${H.esc(a.code)}</span>
                                    <span class="ffi-picker-name">${H.esc(a.name)} ${isAlreadyAdded ? '<small style="color:#DC2626;">(اضافه شده)</small>' : ''}</span>
                                </div>
                                <span style="font-size:12px; color:#64748B; background:#F1F5F9; padding:2px 8px; border-radius:4px;">${H.esc(a.articleUnitName || '')}</span>
                            </div>
                        </div>`;
                    });
                    listWrap.innerHTML = html.join('');
                    bindCheckboxes();
                });
        }

        function bindCheckboxes() {
            listWrap.querySelectorAll('.itc-pick-chk').forEach(chk => {
                chk.addEventListener('change', function () {
                    const id = parseInt(this.dataset.id);
                    if (this.checked) _pickerSelectedIds.add(id);
                    else _pickerSelectedIds.delete(id);
                    updateCount();
                });
            });
        }

        // رویدادها
        searchInput.addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(doSearch, 300); });
        groupSelect.addEventListener('change', doSearch);

        pk.querySelector('#itcSelectAllBtn').addEventListener('click', () => {
            _currentListData.forEach(a => {
                const isAlreadyAdded = _selectedArticles.some(x => x.id === a.id);
                if (!isAlreadyAdded) _pickerSelectedIds.add(a.id);
            });
            listWrap.querySelectorAll('.itc-pick-chk').forEach(chk => {
                if (!chk.disabled) chk.checked = true;
            });
            updateCount();
        });

        pk.querySelector('#itcAddSelectedBtn').addEventListener('click', async () => {
            if (_pickerSelectedIds.size === 0) return window.App.toast('هیچ کالایی انتخاب نشده است', 'warning');

            const btn = pk.querySelector('#itcAddSelectedBtn');
            btn.disabled = true; btn.innerHTML = '⏳ در حال افزودن...';

            const promises = Array.from(_pickerSelectedIds).map(async (id) => {
                const a = _currentListData.find(x => x.id === id);
                const stockRes = await window.App.Http.api(`/api/inventory/article-stock/${id}?stockTypeId=${stockId}`, { silent: true }).catch(() => ({ qty: 0 }));
                return { id: a.id, code: a.code, name: a.name, unitName: a.articleUnitName, systemQty: stockRes.qty };
            });

            const results = await Promise.all(promises);
            _selectedArticles.push(...results);

            renderItems();
            pk.remove();
        });

        pk.querySelector('.ffi-picker-close').addEventListener('click', () => pk.remove());

        doSearch();
    }

    async function save() {
        const stockId = document.getElementById('itcStock').value;
        const stageNo = document.getElementById('itcStage').value;
        const date = document.getElementById('itcDate').value;
        const location = document.getElementById('itcLocation').value;

        if (!stockId) return window.App.toast('انبار را انتخاب کنید', 'warning');
        if (!stageNo) return window.App.toast('مرحله را انتخاب کنید', 'warning');
        if (!date) return window.App.toast('تاریخ را وارد کنید', 'warning');
        if (_selectedArticles.length === 0) return window.App.toast('حداقل یک کالا اضافه کنید', 'warning');

        const payload = {
            stockTypeId: parseInt(stockId),
            stageNo: parseInt(stageNo),
            tagDate: date,
            locationCode: location,
            articleIds: _selectedArticles.map(x => x.id)
        };

        const btn = document.getElementById('itcSave');
        btn.disabled = true;
        btn.innerHTML = '⏳ در حال ثبت...';

        try {
            const res = await window.App.Http.api('/api/inventory/tags', { method: 'POST', body: JSON.stringify(payload), successMsg: 'تگ با موفقیت ثبت شد' });

            // بستن فرم (که خودش بر اساس _returnUrl به صفحه قبل برمی‌گردد)
            close();

            // سوال برای چاپ
            const doPrint = await window.App.confirm('تگ با موفقیت ثبت شد. آیا می‌خواهید برگه‌های شمارش (برچسب‌ها) را چاپ کنید؟', { okText: 'بله، چاپ کن' });
            if (doPrint) {
                if (window.App.Features.InventoryTags) {
                    window.App.Features.InventoryTags.printLabels([res.id]);
                }
            }
        } catch (e) {
            btn.disabled = false;
            btn.innerHTML = '💾 ثبت نهایی تگ';
        }
    }

    function close() {
        if (_overlay) _overlay.remove();
        _overlay = null;

        // بازگشت هوشمند بر اساس اینکه از کجا باز شده است
        if (_returnUrl === 'tags') {
            if (window.App.Features.InventoryTags) window.App.Features.InventoryTags.render();
        } else {
            if (window.App.Features.Inventory) window.App.Features.Inventory.render();
        }
    }

    return { render, removeItem };
})();