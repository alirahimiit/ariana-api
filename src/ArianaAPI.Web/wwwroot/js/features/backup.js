/* ═══════════════════════════════════════════════════════════════════
   ویژگی «پشتیبان‌گیری و بازیابی» — ArianaAPI
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    window.App = window.App || {};
    window.App.Features = window.App.Features || {};

    // ─── وضعیت داخلی
    let _currentStatus = null;
    let _verifiedFile = null;   // فایل تأییدشده برای Restore

    // ═══════════════════════════════════════════════════════════════
    //  کمکی: هدرهای احراز هویت
    // ⚠️ اگر توکن در جای دیگری است، این تابع را تنظیم کن
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    //  کمکی: هدرهای احراز هویت (دقیقاً هماهنگ با App.State و http.js)
    // ═══════════════════════════════════════════════════════════════
    function authHeaders() {
        // گرفتن State متمرکز برنامه
        const state = (window.App.State && typeof window.App.State.get === 'function')
            ? window.App.State.get()
            : {};

        const t = state.token || '';
        const apiKey = state.apiKey || 'dev-api-key-change-in-production'; // فال‌بک برای محیط دولوپمنت

        return {
            ...(t ? { 'Authorization': 'Bearer ' + t } : {}),
            'X-Api-Key': apiKey
        };
    }

    function formatBytes(n) {
        if (!n) return '—';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // ═══════════════════════════════════════════════════════════════
    //  رندر صفحه
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    //  رندر صفحه
    // ═══════════════════════════════════════════════════════════════
    async function show() {
        const root = document.getElementById('content') || document.getElementById('page-content') || document.body;

        // ⭐ data-help="backup" به کانتینر اصلی اضافه شد تا سیستم راهنما این صفحه را بشناسد
        root.innerHTML = `
            <div class="bk-page" data-help="backup">
                <!-- هدر صفحه با دکمه بازگشت -->
                <div class="bk-page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #1f2937; font-size: 20px;">💾 پشتیبان‌گیری و بازیابی</h2>
                    <button class="bk-btn bk-btn-secondary" id="bkBtnBack" style="display: flex; align-items: center; gap: 6px;">
                        <span>🔙</span> بازگشت به داشبورد
                    </button>
                </div>

                <!-- کارت ۱: بک‌آپ دیتابیس جاری -->
                <div class="bk-card">
                    <div class="bk-card-header">
                        <h3>📥 بک‌آپ دیتابیس جاری</h3>
                        <span class="bk-db-name" id="bkTenantName">...</span>
                    </div>
                    <p>پشتیبان‌گیری از دیتابیس این دوره مالی. پس از کلیک، فایل <code>.bak</code> دانلود می‌شود.</p>
                    <div class="bk-actions">
                        <button class="bk-btn bk-btn-primary" id="bkBtnTenant">📥 دانلود بک‌آپ دوره</button>
                    </div>
                </div>

                <!-- کارت ۲: بک‌آپ Permanent -->
                <div class="bk-card">
                    <div class="bk-card-header">
                        <h3>📥 بک‌آپ دیتابیس اصلی (Permanent)</h3>
                        <span class="bk-db-name" id="bkPermName">...</span>
                    </div>
                    <p>پشتیبان‌گیری از جدول‌های «سازمان» و «دوره مالی». این کار برای آرشیو توصیه می‌شود. <b>بازیابی این دیتابیس از این صفحه امکان‌پذیر نیست.</b></p>
                    <div class="bk-actions">
                        <button class="bk-btn bk-btn-secondary" id="bkBtnPerm">📥 دانلود بک‌آپ Permanent</button>
                    </div>
                </div>

                <!-- کارت ۳: بازیابی -->
                <div class="bk-card danger">
                    <div class="bk-card-header">
                        <h3>⚠️ بازیابی (Restore)</h3>
                    </div>
                    <div class="bk-warning">
                        <b>توجه:</b> پس از بازیابی، تمام داده‌های فعلی این دوره مالی با محتوای فایل جایگزین می‌شود. همه کاربران باید مجدداً وارد شوند. این عملیات برگشت‌پذیر نیست.
                    </div>

                    <p>فایل <code>.bak</code> موردنظر را انتخاب کنید:</p>
                    <input type="file" id="bkFile" class="bk-file-input" accept=".bak" />

                    <div class="bk-actions">
                        <button class="bk-btn bk-btn-secondary" id="bkBtnVerify" disabled>🔍 بررسی فایل</button>
                        <button class="bk-btn bk-btn-secondary" id="bkBtnCancelFile" style="display: none; color: #dc2626;">✖ انصراف از فایل</button>
                    </div>

                    <div class="bk-progress" id="bkProgressWrap" style="display:none">
                        <div class="bk-progress-bar" id="bkProgressBar"></div>
                    </div>

                    <div id="bkPreview"></div>

                    <div id="bkConfirmBlock" style="display:none">
                        <div class="bk-warning">
                            ⚠️ برای تأیید نهایی، نام دیتابیس مقصد را عیناً تایپ کنید:
                        </div>
                        <p style="font-size:12px;color:#6b7280;margin-bottom:4px">نام موردنظر:</p>
                        <p style="font-family:monospace;font-size:14px;color:#dc2626;margin:0"><code id="bkConfirmTarget"></code></p>
                        <input type="text" id="bkConfirmInput" class="bk-confirm-input" placeholder="نام دیتابیس را تایپ کنید" />
                        
                        <div class="bk-actions" style="margin-top: 10px;">
                            <button class="bk-btn bk-btn-danger" id="bkBtnRestore" disabled>🔥 اجرای بازیابی</button>
                            <button class="bk-btn bk-btn-secondary" id="bkBtnCancelRestore">✖ انصراف</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await loadStatus();
        bindEvents();
    }

    // ═══════════════════════════════════════════════════════════════
    //  رویدادها (اصلاح شده و ایمن)
    // ═══════════════════════════════════════════════════════════════
    function bindEvents() {
        // دکمه‌های دانلود
        document.getElementById('bkBtnTenant')?.addEventListener('click', () => downloadBackup('tenant'));
        document.getElementById('bkBtnPerm')?.addEventListener('click', () => downloadBackup('permanent'));

        // دکمه بازگشت به داشبورد
        document.getElementById('bkBtnBack')?.addEventListener('click', () => {
            window.App.navigate('dashboard');
        });

        const fileInput = document.getElementById('bkFile');
        const btnVerify = document.getElementById('bkBtnVerify');
        const btnCancelFile = document.getElementById('bkBtnCancelFile');
        const btnCancelRestore = document.getElementById('bkBtnCancelRestore');
        const previewArea = document.getElementById('bkPreview');
        const confirmBlock = document.getElementById('bkConfirmBlock');

        // انتخاب فایل
        fileInput?.addEventListener('change', () => {
            if (btnVerify) btnVerify.disabled = !fileInput.files.length;
            if (btnCancelFile) btnCancelFile.style.display = fileInput.files.length ? 'inline-block' : 'none';
            if (previewArea) previewArea.innerHTML = '';
            if (confirmBlock) confirmBlock.style.display = 'none';
        });

        // دکمه بررسی فایل
        btnVerify?.addEventListener('click', verifyFile);

        // ⭐ دکمه انصراف از فایل انتخاب شده (قبل از بررسی)
        btnCancelFile?.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            if (previewArea) previewArea.innerHTML = '';
            if (confirmBlock) confirmBlock.style.display = 'none';
            if (btnVerify) btnVerify.disabled = true;
            if (btnCancelFile) btnCancelFile.style.display = 'none';
        });

        const confirmInput = document.getElementById('bkConfirmInput');
        const btnRestore = document.getElementById('bkBtnRestore');

        // تایپ نام دیتابیس برای تایید
        confirmInput?.addEventListener('input', () => {
            const target = document.getElementById('bkConfirmTarget')?.textContent || '';
            const ok = confirmInput.value === target;
            confirmInput.classList.toggle('match', ok);
            if (btnRestore) btnRestore.disabled = !ok;
        });

        // دکمه اجرای بازیابی
        btnRestore?.addEventListener('click', doRestore);

        // ⭐ دکمه انصراف در مرحله تایید نهایی بازیابی
        btnCancelRestore?.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            if (previewArea) previewArea.innerHTML = '';
            if (confirmBlock) confirmBlock.style.display = 'none';
            if (btnVerify) btnVerify.disabled = true;
            if (btnCancelFile) btnCancelFile.style.display = 'none';
            _verifiedFile = null;
        });
    }


    async function loadStatus() {
        try {
            const r = await fetch('/api/backup/status', { headers: authHeaders() });
            if (!r.ok) return;
            _currentStatus = await r.json();
            document.getElementById('bkTenantName').textContent = _currentStatus.tenantDatabase;
            document.getElementById('bkPermName').textContent = _currentStatus.permanentDatabase;
        } catch { /* ignore */ }
    }

 
    // ═══════════════════════════════════════════════════════════════
    //  دانلود
    // ═══════════════════════════════════════════════════════════════
    async function downloadBackup(kind) {
        const btn = document.getElementById(kind === 'tenant' ? 'bkBtnTenant' : 'bkBtnPerm');
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ در حال آماده‌سازی...';

        try {
            const confirmed = await App.confirm(
                'فایل بک‌آپ آماده می‌شود. لطفاً چند لحظه صبر کنید.',
                { okText: 'شروع', cancelText: 'انصراف' }
            );
            if (!confirmed) { btn.disabled = false; btn.textContent = oldText; return; }

            const resp = await fetch('/api/backup/' + kind, { headers: authHeaders() });
            if (!resp.ok) {
                let msg = 'خطا در بک‌آپ';
                try { const j = await resp.json(); msg = j.message || msg; } catch { }
                App.toast(msg, 'error');
                return;
            }

            const blob = await resp.blob();
            const cd = resp.headers.get('Content-Disposition') || '';
            const fnMatch = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
            const filename = fnMatch ? decodeURIComponent(fnMatch[1]) : `backup_${kind}.bak`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);

            App.toast('دانلود آغاز شد: ' + filename, 'success');
        } catch (e) {
            console.error(e);
            App.toast('خطا در دریافت فایل بک‌آپ', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = oldText;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Verify
    // ═══════════════════════════════════════════════════════════════
    async function verifyFile() {
        const file = document.getElementById('bkFile').files[0];
        if (!file) return;

        const btnVerify = document.getElementById('bkBtnVerify');
        btnVerify.disabled = true;
        btnVerify.textContent = '⏳ در حال بررسی...';

        try {
            const fd = new FormData();
            fd.append('file', file);

            const data = await uploadWithProgress('/api/backup/verify', fd, p => {
                const wrap = document.getElementById('bkProgressWrap');
                const bar = document.getElementById('bkProgressBar');
                wrap.style.display = 'block';
                bar.style.width = (p * 100).toFixed(0) + '%';
            });

            document.getElementById('bkProgressWrap').style.display = 'none';

            if (!data.success) {
                App.toast(data.message || 'فایل معتبر نیست', 'error');
                document.getElementById('bkPreview').innerHTML =
                    `<div class="bk-warning" style="margin-top:12px">⛔ ${escapeHtml(data.message || 'فایل معتبر نیست')}</div>`;
                return;
            }

            _verifiedFile = file;
            renderPreview(data);
            App.toast('فایل معتبر است', 'success');
        } catch (e) {
            console.error(e);
            App.toast('خطا در بررسی فایل', 'error');
        } finally {
            btnVerify.disabled = false;
            btnVerify.textContent = '🔍 بررسی فایل';
        }
    }

    function renderPreview(d) {
        const html = `
            <div class="bk-preview">
                <div class="bk-preview-row"><span class="lbl">دیتابیس داخل فایل</span><span class="val">${escapeHtml(d.databaseNameInBackup || '—')}</span></div>
                <div class="bk-preview-row"><span class="lbl">سرور مبدأ</span><span class="val">${escapeHtml(d.serverName || '—')}</span></div>
                <div class="bk-preview-row"><span class="lbl">تاریخ بک‌آپ</span><span class="val">${escapeHtml(d.backupDate || '—')}</span></div>
                <div class="bk-preview-row"><span class="lbl">حجم فایل</span><span class="val">${formatBytes(d.fileSizeBytes)}</span></div>
                <div class="bk-preview-row"><span class="lbl">بازیابی روی</span><span class="val" style="color:#dc2626">${escapeHtml(d.targetDatabase)}</span></div>
            </div>
        `;
        document.getElementById('bkPreview').innerHTML = html;
        document.getElementById('bkConfirmTarget').textContent = d.targetDatabase;
        document.getElementById('bkConfirmInput').value = '';
        document.getElementById('bkConfirmInput').classList.remove('match');
        document.getElementById('bkBtnRestore').disabled = true;
        document.getElementById('bkConfirmBlock').style.display = 'block';
    }

    // ═══════════════════════════════════════════════════════════════
    //  Restore
    // ═══════════════════════════════════════════════════════════════
    async function doRestore() {
        if (!_verifiedFile) return;

        const target = document.getElementById('bkConfirmTarget').textContent;
        const confirmed = await App.confirm(
            `آیا از بازیابی دیتابیس «${target}» مطمئن هستید؟\n\nتمام داده‌های فعلی این دوره با محتوای فایل جایگزین می‌شود. این عملیات برگشت‌پذیر نیست.`,
            { danger: true, okText: '🔥 بله، بازیابی کن', cancelText: 'انصراف' }
        );
        if (!confirmed) return;

        const btnRestore = document.getElementById('bkBtnRestore');
        btnRestore.disabled = true;
        btnRestore.textContent = '⏳ در حال بازیابی...';

        try {
            const fd = new FormData();
            fd.append('file', _verifiedFile);

            const data = await uploadWithProgress('/api/backup/restore', fd, p => {
                const wrap = document.getElementById('bkProgressWrap');
                const bar = document.getElementById('bkProgressBar');
                wrap.style.display = 'block';
                bar.style.width = (p * 100).toFixed(0) + '%';
            });

            document.getElementById('bkProgressWrap').style.display = 'none';

            if (!data.success) {
                await App.alert.error(data.message || 'بازیابی با شکست مواجه شد');
                btnRestore.disabled = false;
                btnRestore.textContent = '🔥 اجرای بازیابی';
                return;
            }

            await App.alert.success(data.message || 'بازیابی با موفقیت انجام شد. لطفاً مجدداً وارد شوید.');

            // Force Logout
            try {
                if (window.App && window.App.Auth && window.App.Auth.logout) window.App.Auth.logout();
            } catch { }
            localStorage.removeItem('token');
            localStorage.removeItem('jwt');
            sessionStorage.clear();

            // بازگشت به لاگین
            setTimeout(() => {
                window.location.hash = '#/login';
                window.location.reload();
            }, 500);
        } catch (e) {
            console.error(e);
            App.toast('خطا در بازیابی', 'error');
            btnRestore.disabled = false;
            btnRestore.textContent = '🔥 اجرای بازیابی';
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Upload با پیشرفت
    // ═══════════════════════════════════════════════════════════════
    function uploadWithProgress(url, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            const h = authHeaders();
            Object.keys(h).forEach(k => xhr.setRequestHeader(k, h[k]));

            xhr.upload.onprogress = e => {
                if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
            };

            xhr.onload = () => {
                try {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText || '{}'));
                    } else {
                        let msg = `HTTP ${xhr.status}`;
                        try { const j = JSON.parse(xhr.responseText); msg = j.message || msg; } catch { }
                        reject(new Error(msg));
                    }
                } catch (e) { reject(e); }
            };
            xhr.onerror = () => reject(new Error('خطای شبکه'));
            xhr.send(formData);
        });
    }

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ─── خروجی
    window.App.Features.Backup = { render: show };
})();