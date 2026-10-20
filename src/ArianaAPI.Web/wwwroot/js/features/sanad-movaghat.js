/* ═══════════════════════════════════════════════════
   Feature / SanadMovaghat — جدول میانی سند موقت
   (جمع‌آوری ردیف‌ها و تبدیل به سند ناتراز)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.SanadMovaghat = (function () {
    'use strict';

    let _u = {};
    let _cu = '';

    async function openDialog() {
        _u = window.App.state.user || {};
        if (!_u.orgId || !_u.fyId) {
            return window.App.toast('اطلاعات سازمان/دوره در دسترس نیست', 'error');
        }
        _cu = _u.username || 'web_user';

        const body = `
            <div class="movaghat-container" style="display:flex; gap:15px; height:60vh;">
                <!-- سمت راست: انتخاب حساب -->
                <div style="width:300px; border-left:1px solid #eee; padding-left:15px; display:flex; flex-direction:column; gap:10px;">
                    <h4 style="margin:0;">انتخاب حساب</h4>
                    <div class="form-group">
                        <label>کد کل / معین / تفصیلی</label>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button class="btn btn-ghost btn-sm" id="mvPickColBtn">🏦 کل</button>
                            <button class="btn btn-ghost btn-sm" id="mvPickMoeinBtn">🔶 معین</button>
                            <button class="btn btn-ghost btn-sm" id="mvPickTafzilBtn">📋 تفصیلی</button>
                        </div>
                        <input type="text" id="mvAccountLabel" class="form-control" placeholder="انتخاب نشده" readonly style="margin-top:8px;">
                    </div>
                    <button class="btn btn-primary" id="mvAddBtn" style="margin-top:auto;">➕ افزودن به لیست</button>
                    <button class="btn btn-danger btn-ghost" id="mvClearBtn">🗑️ پاک کردن لیست</button>
                </div>

                <!-- سمت چپ: گرید سبد خرید -->
                <div style="flex:1; display:flex; flex-direction:column;">
                    <div style="flex:1; overflow-y:auto; border:1px solid #ddd; border-radius:8px;">
                        <table class="table" style="margin:0; font-size:12px;">
                            <thead style="position:sticky; top:0; background:#f9f9f9; z-index:1;">
                                <tr>
                                    <th>کدینگ</th>
                                    <th>نام حساب</th>
                                    <th>بدهکار</th>
                                    <th>بستانکار</th>
                                    <th style="width:40px;"></th>
                                </tr>
                            </thead>
                            <tbody id="mvGridBody"></tbody>
                        </table>
                    </div>
                    <div style="margin-top:15px; display:flex; gap:10px; align-items:center;">
                        <label style="white-space:nowrap;">تاریخ سند:</label>
                        <input type="text" id="mvDateIn" class="form-control" style="width:120px;" placeholder="1405/01/01">
                        <button class="btn btn-success" id="mvSaveBtn" style="flex:1;">💾 ثبت نهایی (سند ناتراز)</button>
                    </div>
                </div>
            </div>
        `;

        window.App.openModal('📝 ایجاد سند موقت (بستن حساب‌ها)', body);
        document.querySelector('.modal-box')?.classList.add('wide-modal');

        let selectedFilter = null;

        // تنظیم تاریخ پیش‌فرض
        const d = new Date();
        const pc = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
        const today = `${pc.find(x => x.type === 'year').value}/${pc.find(x => x.type === 'month').value}/${pc.find(x => x.type === 'day').value}`;
        document.getElementById('mvDateIn').value = today;

        function updateLabel() {
            if (!selectedFilter) { document.getElementById('mvAccountLabel').value = ''; return; }
            let label = '';
            if (selectedFilter.codeCol > 0) label += `کل ${selectedFilter.codeCol}`;
            if (selectedFilter.codeMoein > 0) label += ` / معین ${selectedFilter.codeMoein}`;
            if (selectedFilter.codeTafzil > 0) label += `تفصیلی ${selectedFilter.codeTafzil}`;
            document.getElementById('mvAccountLabel').value = label;
        }

        async function loadGrid() {
            const tbody = document.getElementById('mvGridBody');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">در حال بارگذاری...</td></tr>';
            try {
                const rows = await window.App.Http.api('/api/sanad-movaghat/list', {
                    method: 'POST',
                    body: JSON.stringify({ orgId: _u.orgId, fyId: _u.fyId, cu: _cu })
                });
                if (rows.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:#888;">لیست خالی است. حساب انتخاب کنید و دکمه افزودن را بزنید.</td></tr>';
                    return;
                }

                tbody.innerHTML = rows.map(r => `
                    <tr>
                        <td>${r.codeCol > 0 ? 'کل ' + r.codeCol : ''} ${r.codeMoein > 0 ? '/ ' + r.codeMoein : ''} ${r.codeTafzil > 0 ? 'تفصیلی ' + r.codeTafzil : ''}</td>
                        <td>${r.hesabName || '-'}</td>
                        <td class="num text-left">${r.mabBed > 0 ? window.App.Helpers.fmt(r.mabBed) : '-'}</td>
                        <td class="num text-left">${r.mabBes > 0 ? window.App.Helpers.fmt(r.mabBes) : '-'}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-ghost mv-del-btn" data-id="${r.sanadMovaghatID}" style="color:red;">🗑️</button>
                        </td>
                    </tr>
                `).join('');

                // اتصال رویداد دکمه‌های حذف
                tbody.querySelectorAll('.mv-del-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.target.dataset.id;
                        try {
                            await window.App.Http.api('/api/sanad-movaghat/delete', {
                                method: 'POST',
                                body: JSON.stringify({ orgId: _u.orgId, fyId: _u.fyId, id, cu: _cu })
                            });
                            loadGrid();
                        } catch (err) { window.App.alert.error(err.message); }
                    });
                });

            } catch (e) {
                tbody.innerHTML = `<tr><td colspan="5" style="color:red;">خطا: ${e.message}</td></tr>`;
            }
        }

        // دکمه‌های انتخاب حساب
        document.getElementById('mvPickColBtn').addEventListener('click', async () => {
            const res = await window.App.UI.HesabPicker.open({ mode: 'col' });
            if (res && res.codeCol) { selectedFilter = { codeCol: res.codeCol, codeMoein: 0, codeTafzil: 0 }; updateLabel(); }
        });
        document.getElementById('mvPickMoeinBtn').addEventListener('click', async () => {
            const res = await window.App.UI.HesabPicker.open({ mode: 'moein' });
            if (res && res.codeMoein) { selectedFilter = { codeCol: res.codeCol, codeMoein: res.codeMoein, codeTafzil: 0 }; updateLabel(); }
        });
        document.getElementById('mvPickTafzilBtn').addEventListener('click', async () => {
            const res = await window.App.UI.HesabPicker.open({ mode: 'tafzil' });
            if (res && res.codeTafzil) { selectedFilter = { codeCol: 0, codeMoein: 0, codeTafzil: res.codeTafzil }; updateLabel(); }
        });

        // افزودن به سبد
        document.getElementById('mvAddBtn').addEventListener('click', async () => {
            if (!selectedFilter) return window.App.toast('ابتدا حساب را انتخاب کنید', 'warning');
            const btn = document.getElementById('mvAddBtn');
            btn.disabled = true; btn.textContent = '⏳...';
            try {
                await window.App.Http.api('/api/sanad-movaghat/add', {
                    method: 'POST',
                    body: JSON.stringify({ orgId: _u.orgId, fyId: _u.fyId, cu: _cu, filter: selectedFilter })
                });
                window.App.toast('به لیست اضافه شد', 'success');
                selectedFilter = null; updateLabel();
                loadGrid();
            } catch (e) {
                window.App.alert.error(e.message);
            } finally {
                btn.disabled = false; btn.textContent = '➕ افزودن به لیست';
            }
        });

        // پاک کردن کل سبد
        document.getElementById('mvClearBtn').addEventListener('click', async () => {
            const ok = await window.App.confirm('کل لیست پاک شود؟', { danger: true });
            if (!ok) return;
            await window.App.Http.api('/api/sanad-movaghat/clear', {
                method: 'POST', body: JSON.stringify({ orgId: _u.orgId, fyId: _u.fyId, cu: _cu })
            });
            loadGrid();
        });

        // ثبت نهایی
        document.getElementById('mvSaveBtn').addEventListener('click', async () => {
            const dateIn = document.getElementById('mvDateIn').value;
            if (!dateIn) return window.App.toast('تاریخ را وارد کنید', 'warning');

            const btn = document.getElementById('mvSaveBtn');
            btn.disabled = true; btn.textContent = '⏳ در حال ثبت سند...';
            try {
                const res = await window.App.Http.api('/api/sanad-movaghat/save', {
                    method: 'POST',
                    body: JSON.stringify({ orgId: _u.orgId, fyId: _u.fyId, cu: _cu, dateIn })
                });
                if (res.success) {
                    await window.App.alert.success(`سند موقت شماره ${res.noSanad} ثبت شد.\n\nتوجه: سند ناتراز است. برای تراز کردن آن به لیست اسناد بروید و خط سود/زیان را اضافه کنید.`, { title: 'ثبت شد' });
                    window.App.closeModal();
                    if (window.App.Features.Sanad && window.App.Features.Sanad.loadList) {
                        window.App.Features.Sanad.loadList();
                    }
                } else {
                    await window.App.alert.error(res.message, { title: 'خطا' });
                }
            } catch (e) {
                window.App.alert.error(e.message);
            } finally {
                btn.disabled = false; btn.textContent = '💾 ثبت نهایی (سند ناتراز)';
            }
        });

        // اجرای اولیه
        loadGrid();
    }

    return { openDialog };
})();