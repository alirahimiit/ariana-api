/* ═══════════════════════════════════════════════════
   Feature / Inventory — صفحه اصلی (هاب) انبارگردانی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Inventory = (function () {
    'use strict';

    const H = window.App.Helpers;

    function render() {
        const c = document.getElementById('content');
        
        c.innerHTML = `
        <div class="card" style="margin-bottom:20px;">
            <div class="card-title">
                <span>📊 مرکز مدیریت انبارگردانی</span>
            </div>
            <div style="padding:20px; color:#475569; line-height:1.8;">
                به ماژول انبارگردانی خوش آمدید. از طریق کارت‌های زیر می‌توانید مراحل، تگ‌ها و اسناد انبارگردانی را مدیریت کنید.
            </div>
        </div>

        <div class="dash-charts" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:20px;">
            
            <!-- 1. تعریف مراحل -->
            <div class="card" style="cursor:pointer; transition:transform 0.2s;" onclick="App.Features.InventoryStages.render()" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
                <div style="padding:30px 20px; text-align:center;">
                    <div style="font-size:40px; margin-bottom:15px;">⚙️</div>
                    <h3 style="margin-bottom:10px; color:#1E293B;">تعریف مراحل انبارگردانی</h3>
                    <p style="font-size:12px; color:#64748B;">ایجاد و مدیریت دوره‌های شمارش (مثل پایان سال)</p>
                </div>
            </div>

            <!-- 2. لیست تگ‌ها -->
            <div class="card" style="cursor:pointer; transition:transform 0.2s;" onclick="App.Features.InventoryTags.render()" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
                <div style="padding:30px 20px; text-align:center;">
                    <div style="font-size:40px; margin-bottom:15px;">📋</div>
                    <h3 style="margin-bottom:10px; color:#1E293B;">لیست تگ‌های شمارش</h3>
                    <p style="font-size:12px; color:#64748B;">مشاهده، شمارش و صدور سند برای تگ‌ها</p>
                </div>
            </div>

            <!-- 3. ثبت تگ جدید -->
            <div class="card" style="cursor:pointer; transition:transform 0.2s;" onclick="App.Features.InventoryTagCreate.render('hub')" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
                <div style="padding:30px 20px; text-align:center;">
                    <div style="font-size:40px; margin-bottom:15px;">➕</div>
                    <h3 style="margin-bottom:10px; color:#1E293B;">ثبت تگ جدید</h3>
                    <p style="font-size:12px; color:#64748B;">انتخاب کالاها و ایجاد برگه شمارش فیزیکی</p>
                </div>
            </div>

            <!-- 4. گزارشات -->
            <div class="card" style="cursor:pointer; transition:transform 0.2s;" onclick="App.Features.InventoryReports.render()" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
                <div style="padding:30px 20px; text-align:center;">
                    <div style="font-size:40px; margin-bottom:15px;">🖨️</div>
                    <h3 style="margin-bottom:10px; color:#1E293B;">گزارش اختلافات و تاریخچه</h3>
                    <p style="font-size:12px; color:#64748B;">مشاهده لیست اختلافات و سوابق عملیات</p>
                </div>
            </div>

        </div>`;
    }

    return { render };
})();

// اتصال به روتر
window.App.renderStockCount = window.App.Features.Inventory.render;