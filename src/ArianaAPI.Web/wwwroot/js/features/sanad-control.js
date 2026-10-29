/* ═══════════════════════════════════════════════════
   Feature / SanadControl (کنترل و بررسی اسناد)
   شامل: مغایرت‌گیری، توالی اسناد، ماهیت حساب
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.SanadControl = (function () {
    'use strict';

    const H = window.App.Helpers;
    let _activeTab = 'moghayerat'; // 'moghayerat' | 'tavali' | 'mahiyat'

    function render() {
        const c = document.getElementById('content');

        c.innerHTML = `
            <div class="card">
                <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>🛡️ کنترل و بررسی اسناد حسابداری</span>
                </div>
                
                <div class="tabs-container" style="margin-bottom: 20px; border-bottom: 2px solid #E5E7EB; display: flex; gap: 10px;">
                    <button class="btn ${_activeTab === 'moghayerat' ? 'btn-primary' : 'btn-ghost'}" 
                            id="tabMoghayerat" style="border-radius: 8px 8px 0 0; padding: 10px 20px;">
                        ⚖️ مغایرت‌گیری اسناد
                    </button>
                    <button class="btn ${_activeTab === 'tavali' ? 'btn-primary' : 'btn-ghost'}" 
                            id="tabTavali" style="border-radius: 8px 8px 0 0; padding: 10px 20px;">
                        🔢 توالی اسناد
                    </button>
                    <button class="btn ${_activeTab === 'mahiyat' ? 'btn-primary' : 'btn-ghost'}" 
                            id="tabMahiyat" style="border-radius: 8px 8px 0 0; padding: 10px 20px;">
                        ⚠️ ماهیت حساب
                    </button>
                </div>

                <div id="controlResult">
                    <div class="empty" style="padding: 40px;">
                        <div class="empty-icon">📊</div>
                        <p>برای مشاهده گزارش، روی دکمه «بررسی» کلیک کنید.</p>
                        <button class="btn btn-primary" id="btnRunReport" style="margin-top: 15px;">
                            🔍 بررسی کن
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('tabMoghayerat').addEventListener('click', () => { _activeTab = 'moghayerat'; render(); });
        document.getElementById('tabTavali').addEventListener('click', () => { _activeTab = 'tavali'; render(); });
        document.getElementById('tabMahiyat').addEventListener('click', () => { _activeTab = 'mahiyat'; render(); });

        document.getElementById('btnRunReport').addEventListener('click', runReport);
    }

    async function runReport() {
        const btn = document.getElementById('btnRunReport');
        const container = document.getElementById('controlResult');
        const orig = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = '⏳ در حال بررسی...';
        container.innerHTML = '<div class="loading" style="padding:30px;"><div class="spinner"></div></div>';

        try {
            const endpoint = _activeTab === 'moghayerat' ? '/api/sanad/control/moghayerat'
                : _activeTab === 'tavali' ? '/api/sanad/control/tavali'
                    : '/api/sanad/control/mahiyat';

            const data = await window.App.Http.api(endpoint);

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="alert alert-success" style="background:#F0FDF4; color:#166534; border:1px solid #BBF7D0; padding:20px; text-align:center; border-radius:8px;">
                        <div style="font-size:40px; margin-bottom:10px;">✅</div>
                        <h3 style="margin:0;">همه چیز مرتب است!</h3>
                        <p style="margin-top:8px;">هیچ موردی برای این گزارش یافت نشد.</p>
                    </div>`;
                return;
            }

            if (_activeTab === 'moghayerat') container.innerHTML = buildMoghayeratHtml(data);
            else if (_activeTab === 'tavali') container.innerHTML = buildTavaliHtml(data);
            else if (_activeTab === 'mahiyat') container.innerHTML = buildMahiyatHtml(data);

            // اتصال دکمه‌های مشاهده سند (اگر آیدی سند در دیتا باشد)
            container.querySelectorAll('.btn-view-sanad').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const sanadId = e.currentTarget.dataset.id;
                    if (sanadId && sanadId !== 'undefined') {
                        window.App.Features.Sanad.showDetail(sanadId);
                    }
                });
            });

            // دکمه خروجی اکسل
            Exporter.attach(container, {
                title: _activeTab === 'moghayerat' ? 'گزارش مغایرت‌گیری اسناد'
                    : _activeTab === 'tavali' ? 'گزارش توالی اسناد'
                        : 'گزارش ماهیت حساب',
                subtitle: (window.App.state.user?.orgName || '') + ' - ' + (window.App.state.user?.fyName || ''),
                filename: `Sanad_${_activeTab}`
            });

        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    function buildMoghayeratHtml(data) {
        const rows = data.map(it => `
            <tr>
                <td class="num text-center font-bold">${H.fmt(it.noSanad)}</td>
                <td class="num text-center">${H.esc(it.dateIn || '-')}</td>
                <td>${H.esc(it.sharh || '-')}</td>
                <td class="num text-left">${H.fmt(it.sumMabBed)}</td>
                <td class="num text-left">${H.fmt(it.sumMabBes)}</td>
                <td class="num text-left text-danger font-bold">${H.fmt(Math.abs(it.diff))}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-ghost btn-view-sanad" data-id="${it.parentSanadId || it.parentSanadId}">👁️</button>
                </td>
            </tr>
        `).join('');

        return `
            <div class="alert alert-warning" style="background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:12px; border-radius:8px; margin-bottom:15px;">
                ⚠️ <strong>توجه:</strong> اسنادی که جمع بدهکار و بستانکار آنها برابر نیست.
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:80px;">شماره سند</th>
                            <th style="width:100px;">تاریخ</th>
                            <th>شرح سند</th>
                            <th class="text-left">جمع بدهکار</th>
                            <th class="text-left">جمع بستانکار</th>
                            <th class="text-left">میزان مغایرت</th>
                            <th style="width:60px;">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    function buildTavaliHtml(data) {
        const rows = data.map(it => {
            const isGap = it.errorType === 'پرش شماره';
            const rowClass = isGap ? 'style="background:#FFFBEB;"' : 'style="background:#FEF2F2;"';

            // تبدیل وضعیت به متن
            const vazeitMap = { 0: 'پیش‌نویس', 1: 'رسیدگی', 2: 'قطعی' };
            const vazeitText = it.vazeit !== undefined && it.vazeit !== null ? (vazeitMap[it.vazeit] || it.vazeit) : '-';

            return `
                <tr ${rowClass}>
                    <td class="num text-center font-bold">${H.fmt(it.noSanad)}</td>
                    <td class="num text-center">${H.esc(it.dateIn || '-')}</td>
                    <td>${H.esc(it.sharh || '-')}</td>
                    <td class="text-center">
                        <span class="badge" style="background:#E5E7EB; padding:2px 6px; border-radius:4px; font-size:11px;">${vazeitText}</span>
                    </td>
                    <td class="text-danger" style="font-size:12px;">${H.esc(it.errorDesc)}</td>
                    <td class="num text-center font-bold text-primary">${H.fmt(it.expectedNo)}</td>
                    <td class="text-center">
                        ${!isGap ? `<button class="btn btn-sm btn-ghost btn-view-sanad" data-id="${it.parentSanadId || it.noSanad}">👁️</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="alert alert-warning" style="background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:12px; border-radius:8px; margin-bottom:15px;">
                ⚠️ <strong>توجه:</strong> این گزارش اسنادی را نشان می‌دهد که شماره آنها پیوسته نیست (پرش دارد) یا تاریخ آنها از سند قبلی کوچکتر است.
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:80px;" class="text-center">شماره سند (کد روزنامه)</th>
                            <th style="width:100px;" class="text-center">تاریخ</th>
                            <th>شرح سند</th>
                            <th style="width:100px;" class="text-center">وضعیت</th>
                            <th>علت مغایرت</th>
                            <th style="width:100px;" class="text-center">شماره مورد انتظار</th>
                            <th style="width:60px;">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }
    function buildMahiyatHtml(data) {
        const rows = data.map(it => {
            const mahiatText = it.mahiat === 1 ? 'بدهکار' : (it.mahiat === 2 ? 'بستانکار' : '-');

            const bed = Number(it.sumBed) || 0;
            const bes = Number(it.sumBes) || 0;

            return `
                <tr style="background:#FEF2F2; border-bottom: 1px solid #FCA5A5;">
                    <td class="num text-center">${it.codeTafzil || '-'}</td>
                    <td class="num text-center">${it.codeMoein || '-'}</td>
                    <td class="num text-center font-bold text-primary">${it.codeCol || '-'}</td>
                    <td>${H.esc(it.hesabName || '-')}</td>
                    <td class="text-center font-bold">${mahiatText}</td>
                    <td class="num text-left font-bold text-danger">${bed ? H.fmt(bed) : '-'}</td>
                    <td class="num text-left font-bold text-danger">${bes ? H.fmt(bes) : '-'}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="alert alert-warning" style="background:#FEF3C7; border:1px solid #FDE68A; color:#92400E; padding:12px; border-radius:8px; margin-bottom:15px;">
                ⚠️ <strong>توجه:</strong> این حساب‌ها مانده‌ای خلاف ماهیت خود گرفته‌اند (مثلاً حساب بانک که ماهیت بدهکار دارد، مانده بستانکار پیدا کرده است). این موضوع نیاز به بررسی دارد.
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:80px;" class="text-center">کد تفصیلی</th>
                            <th style="width:80px;" class="text-center">کد معین</th>
                            <th style="width:80px;" class="text-center">کد کل</th>
                            <th>نام حساب</th>
                            <th style="width:100px;" class="text-center">ماهیت حساب</th>
                            <th class="text-left" style="width:130px;">بدهکار</th>
                            <th class="text-left" style="width:130px;">بستانکار</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }


    return { render };
})();

window.App.renderSanadControl = window.App.Features.SanadControl.render;