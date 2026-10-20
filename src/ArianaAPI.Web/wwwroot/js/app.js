/* ═══════════════════════════════════════════════════
   Ariana API - Client App
   ═══════════════════════════════════════════════════ */

window.App = Object.assign(window.App || {}, {

    // ⭐ پل به Core جدید
    state: window.App.State.get(),           // reference زنده به App.State
    baseUrl: window.location.origin,

    // ⭐ alias متدها — تا کدهای موجود (this.fmt, this.api, ...) کار کنن
    fmt: (n) => window.App.Helpers.fmt(n),
    fmtAcc: (n) => window.App.Helpers.fmtAcc(n),
    esc: (s) => window.App.Helpers.esc(s),
    fmtSigned: (n) => window.App.Helpers.fmtSigned(n),
    api: (p, o) => window.App.Http.api(p, o),


    toast: (msg, type) => window.App.UI.Toast.show(msg, type),
    openModal: (title, body) => window.App.UI.Modal.open(title, body),
    closeModal: () => window.App.UI.Modal.close(),
    checkLicense: () => window.App.Auth.checkLicense(),
    loadOrganizations: () => window.App.Auth.loadOrganizations(),
    loadFiscalYears: (orgId) => window.App.Auth.loadFiscalYears(orgId),
    handleLogin: (e) => window.App.Auth.handleLogin(e),
    handleLogout: () => {
        window.App.Permissions.clear();
        // ⭐ پاک‌سازی FAB و Popup پیام‌رسان
        window.App.Features.Messaging?._stopFabPolling?.();
        window.App.Features.Messaging?._stopPolling?.();
        document.getElementById('msgFab')?.remove();
        document.getElementById('msgPopupOverlay')?.remove();
        return window.App.Auth.handleLogout();
    },
    showLogin: () => window.App.Auth.showLogin(),
    showApp: () => window.App.Auth.showApp(),
    // ═══════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════
    init() {
        // ⭐ راه‌اندازی Core
        window.App.Http.init(window.location.origin);   // ← window.App
        window.App.State.init();                        // ← window.App

        window.App.Permissions.restore();
        // ⭐ بازیابی از localStorage — الان App.State این کار رو می‌کنه
        //    (این خط رو نگه دار فقط اگه قبلاً اینجا localStorage رو خودت می‌خوندی)
        // const saved = localStorage.getItem('ariana_auth');
        // ... (این بخش رو حذف کن — App.State.init() جاش رو گرفته)

        // رویدادها
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());

        // ⭐ اعمال لوگو
        this.applyLogo();
        // ⭐ Nav groups (تاشو)
        this.initNavGroups();
        // ⭐ Sidebar موبایل
        this.initSidebar();

        // ⭐ سال جاری در فوتر لاگین
        const yearEl = document.getElementById('loginYear');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        // ⭐ toggle نمایش رمز عبور
        document.getElementById('togglePwdBtn')?.addEventListener('click', function () {
            const pwd = document.getElementById('password');
            if (!pwd) return;
            if (pwd.type === 'password') {
                pwd.type = 'text';
                this.textContent = '🙈';
            } else {
                pwd.type = 'password';
                this.textContent = '👁️';
            }
        });

        // ⭐ رصد خودکار جدول‌های جدید
        this._initTableObserver();

        // ⭐ انتخاب ردیف با کلیک
        this._initRowSelect();



        // ⭐ تشخیص دستگاه
        this.detectDevice();
        document.getElementById('btnSettings')?.addEventListener('click', () => this.openSettings());

        document.getElementById('btnChangePassword')?.addEventListener('click', () => this.openChangePassword());
        // nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.navigate(item.dataset.page));
        });

        // modal close
        document.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => this.closeModal());
        });

        // سازمان → دوره مالی
        document.getElementById('orgId')?.addEventListener('change', (e) => {
            this.loadFiscalYears(e.target.value);
        });

        
        // شروع
        if (this.state.token) {
            this.showApp();
            this.navigate('dashboard');
            
        } else {
            this.showLogin();
            // ⭐ اول لایسنس، بعد سازمان‌ها (به صورت موازی)
            //    همیشه showLogin انجام می‌شه ولی لایسنس هم صدا زده می‌شه
            this.checkLicense().catch(() => { });
            this.loadOrganizations();
        }
        // ⭐ لود رجیستری منوها (اگه کاربر لاگین هست)
        if (this.state.token) {
            window.App.Permissions.loadRegistry().then(() => {
                window.App.Permissions.applyMenuFilter();
            });
        }

        window.App.Features.Messaging?.initFab();
        window.HelpUI?.init();
        this._setupTabSync();
    },

    // ═══════════════════════════════════════════
    //  NAV GROUPS
    // ═══════════════════════════════════════════
    initNavGroups() {
        const STORAGE_KEY = 'ariana_nav_groups';

        // حالت ذخیره‌شده
        let collapsed = {};
        try {
            collapsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch (e) { /* ignore */ }

        document.querySelectorAll('.nav-group').forEach(group => {
            const name = group.dataset.group;
            if (collapsed[name]) group.classList.add('collapsed');

            const header = group.querySelector('.nav-group-header');
            header?.addEventListener('click', () => {
                group.classList.toggle('collapsed');
                collapsed[name] = group.classList.contains('collapsed');
                localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
            });
        });
    },

    // وقتی کاربر به صفحه‌ای می‌ره، گروه مربوطه رو باز کن
    _expandGroupOfPage(page) {
        const item = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (!item) return;
        const group = item.closest('.nav-group');
        if (group?.classList.contains('collapsed')) {
            group.classList.remove('collapsed');
            const name = group.dataset.group;
            try {
                const stored = JSON.parse(localStorage.getItem('ariana_nav_groups') || '{}');
                stored[name] = false;
                localStorage.setItem('ariana_nav_groups', JSON.stringify(stored));
            } catch (e) { /* ignore */ }
        }
    },
    // ⭐ آیا کاربر مجازه این صفحه رو ببینه؟
    _canAccessPage(page) {
        const item = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (!item) return true;   // صفحه‌ای که توی منو نیست → آزاد
        const key = item.getAttribute('data-menu-key');
        if (!key) return true;    // بدون کلید → آزاد
        return window.App.Permissions.hasMenu(key);
    },
    // ═══════════════════════════════════════════
    //  SIDEBAR (mobile drawer)
    // ═══════════════════════════════════════════
    initSidebar() {
        const sidebar = document.getElementById('appSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const btnHamburger = document.getElementById('btnHamburger');
        const btnClose = document.getElementById('btnSidebarClose');

        if (!sidebar) return;

        // باز کردن منو
        btnHamburger?.addEventListener('click', () => this.openSidebar());

        // بستن منو
        btnClose?.addEventListener('click', () => this.closeSidebar());
        overlay?.addEventListener('click', () => this.closeSidebar());

        // بستن با Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSidebar();
        });

        // بستن بعد از کلیک روی nav-item (فقط موبایل)
        sidebar.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (this.isMobile()) this.closeSidebar();
            });
        });

        // سوییپ برای بستن
        let touchStartX = 0;
        sidebar.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        sidebar.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (dx > 80) this.closeSidebar(); // سوییپ از راست
        }, { passive: true });
    },
    _initTableObserver() {
        const self = this;
        const observer = new MutationObserver((mutations) => {
            let hasTable = false;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.tagName === 'TABLE' || node.querySelector?.('table')) {
                            hasTable = true;
                            break;
                        }
                    }
                }
                if (hasTable) break;
            }
            if (hasTable) {
                requestAnimationFrame(() => {
                    window.App.UI.TableCardView?.apply(document);
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },
    // ═══════════════════════════════════════════
    //  ROW SELECT — انتخاب ردیف با کلیک
    //  کلیک = تک‌انتخاب | Ctrl+کلیک = چندتایی
    // ═══════════════════════════════════════════
    _initRowSelect() {
        if (this._rowSelectInitialized) return;
        this._rowSelectInitialized = true;

        document.addEventListener('click', (e) => {
            // روی دکمه/لینک/input کلیک شده؟ بی‌خیال
            if (e.target.closest('button, a, input, select, textarea, label, .no-row-select')) return;

            const tr = e.target.closest('tbody tr');
            if (!tr) return;

            const table = tr.closest('table');
            if (!table) return;
            if (table.hasAttribute('data-no-row-select')) return;

            // ⭐ جدول‌هایی که با mobile-card-view تبدیل شدن → نادیده بگیر
            if (table.classList.contains('mobile-card-view') && window.matchMedia('(max-width: 768px)').matches) return;

            if (e.ctrlKey || e.metaKey) {
                // چندتایی
                tr.classList.toggle('row-selected');
            } else {
                // تک‌انتخاب
                table.querySelectorAll('tbody tr.row-selected').forEach(r => {
                    if (r !== tr) r.classList.remove('row-selected');
                });
                tr.classList.toggle('row-selected');
            }
        });

        console.log('[RowSelect] ✓ فعال — کلیک/Ctrl+کلیک');
    },


    openSidebar() {
        document.getElementById('appSidebar')?.classList.add('open');
        document.getElementById('sidebarOverlay')?.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeSidebar() {
        document.getElementById('appSidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
        document.body.style.overflow = '';
    },

    isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    },
    
    // ═══════════════════════════════════════════
    //  DEVICE DETECTION
    // ═══════════════════════════════════════════
    detectDevice() {
        const ua = navigator.userAgent || '';
        const isAndroid = /android/i.test(ua);
        const isIOS = /iPad|iPhone|iPod/.test(ua);
        const isMobile = this.isMobile() || isAndroid || isIOS;

        document.body.classList.toggle('is-mobile', isMobile);
        document.body.classList.toggle('is-desktop', !isMobile);
        document.body.classList.toggle('is-android', isAndroid);
        document.body.classList.toggle('is-ios', isIOS);

        // گوش دادن به تغییر اندازه
        window.addEventListener('resize', () => {
            if (!this.isMobile()) {
                this.closeSidebar();
            }
        });
    },


 
    // ═══════════════════════════════════════════
    //  LOGO
    // ═══════════════════════════════════════════
    getLogo() {
        return localStorage.getItem('ariana_logo'); // base64 data URL
    },

    applyLogo() {
        const logo = this.getLogo();

        // عناصر لوگو
        const logos = [
            document.getElementById('loginLogo'),
            document.getElementById('sidebarLogo')
        ];

        logos.forEach(el => {
            if (!el) return;

            // پاک کردن قبلی
            const oldImg = el.querySelector('img');
            if (oldImg) oldImg.remove();

            if (logo) {
                // نمایش عکس
                const img = document.createElement('img');
                img.src = logo;
                img.alt = 'لوگو';
                el.appendChild(img);
                el.classList.add('has-image');
            } else {
                // نمایش متن
                el.classList.remove('has-image');
            }
        });
    },

    setLogo(base64) {
        if (base64) {
            localStorage.setItem('ariana_logo', base64);
        } else {
            localStorage.removeItem('ariana_logo');
        }
        this.applyLogo();
    },

    async openLogoDialog() {
        // ساخت مودال اختصاصی
        const currentLogo = this.getLogo();

        const body = `
        <div class="logo-uploader" id="logoDropZone">
            <div class="logo-preview" id="logoPreview">
                ${currentLogo
                ? `<img src="${currentLogo}" alt="لوگو">`
                : '<span>آ</span>'
            }
            </div>
            <div class="logo-upload-info">
                <h4>لوگوی برنامه</h4>
                <p>
                    یک تصویر انتخاب یا اینجا رها کنید.<br>
                    فرمت‌های مجاز: PNG، JPG، SVG، WEBP<br>
                    حداکثر حجم: ۵۰۰ کیلوبایت — ابعاد پیشنهادی: 512×512
                </p>
                <div class="logo-upload-actions">
                    <button type="button" id="logoChooseBtn">📁 انتخاب تصویر</button>
                    ${currentLogo ? '<button type="button" class="btn-danger" id="logoRemoveBtn">🗑️ حذف لوگو</button>' : ''}
                </div>
            </div>
            <input type="file" id="logoFileInput" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none">
        </div>

        <div class="form-group">
            <label>یا آدرس تصویر (URL)</label>
            <input type="text" id="logoUrlInput" placeholder="https://example.com/logo.png">
        </div>

        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn btn-primary" id="logoSaveBtn">💾 ذخیره</button>
            <button class="btn btn-ghost" data-close>انصراف</button>
        </div>
    `;

        this.openModal('🎨 تنظیم لوگو', body);

        const modalBody = document.getElementById('modalBody');
        const fileInput = modalBody.querySelector('#logoFileInput');
        const preview = modalBody.querySelector('#logoPreview');
        const dropZone = modalBody.querySelector('#logoDropZone');
        const urlInput = modalBody.querySelector('#logoUrlInput');

        let pendingLogo = currentLogo; // ذخیره موقت

        // ─── انتخاب فایل ───
        modalBody.querySelector('#logoChooseBtn').addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this._handleLogoFile(file, preview, (dataUrl) => {
                pendingLogo = dataUrl;
                urlInput.value = '';
            });
        });

        // ─── Drag & Drop ───
        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                this.toast('فقط فایل تصویری مجاز است', 'error');
                return;
            }
            this._handleLogoFile(file, preview, (dataUrl) => {
                pendingLogo = dataUrl;
                urlInput.value = '';
            });
        });

        // ─── URL ───
        urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            if (url) {
                preview.innerHTML = `<img src="${url}" alt="لوگو" onerror="this.parentElement.innerHTML='<span style=color:red;font-size:12px;>خطا</span>'">`;
                pendingLogo = url;
            }
        });

        // ─── حذف ───
        const removeBtn = modalBody.querySelector('#logoRemoveBtn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                pendingLogo = null;
                preview.innerHTML = '<span>آ</span>';
                urlInput.value = '';
            });
        }

        // ─── ذخیره ───
        modalBody.querySelector('#logoSaveBtn').addEventListener('click', () => {
            this.setLogo(pendingLogo);
            this.closeModal();
            this.toast(pendingLogo ? 'لوگو ذخیره شد' : 'لوگو حذف شد', 'success');
        });

        // ─── بستن ───
        modalBody.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => this.closeModal());
        });
    },

    _handleLogoFile(file, previewEl, onSuccess) {
        // ─── بررسی حجم ───
        const MAX_SIZE = 500 * 1024; // 500 KB
        if (file.size > MAX_SIZE) {
            this.toast(`حجم فایل بیش از حد مجاز است (${(file.size / 1024).toFixed(0)} KB)`, 'error');
            return;
        }

        // ─── بررسی نوع ───
        if (!file.type.startsWith('image/')) {
            this.toast('فایل انتخاب‌شده تصویر نیست', 'error');
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const dataUrl = e.target.result;

            // ─── پیش‌نمایش ───
            previewEl.innerHTML = `<img src="${dataUrl}" alt="لوگو">`;

            // ─── callback ───
            if (onSuccess) onSuccess(dataUrl);
        };

        reader.onerror = () => {
            this.toast('خطا در خواندن فایل', 'error');
        };

        reader.readAsDataURL(file);
    },
    // ═══════════════════════════════════════════
    //  تنظیمات
    // ═══════════════════════════════════════════
    openSettings() {
        const s = this.state.settings;
        const hasLogo = !!this.getLogo();
        const pageSizeOptions = [10, 20, 30, 50, 75, 100, 200, 300, 500, 1000];
        const user = this.state.user || {};
        const orgId = user.orgId;
        const fyId = user.fyId;

        // ساخت گزینه‌ها برای CustomSelect
        const pageSizeCsOptions = pageSizeOptions.map(v => ({
            value: String(v),
            label: `${v} ردیف`
        }));

        const body = `
            <div class="settings-tabs" style="display:flex; gap:10px; border-bottom:1px solid #E2E8F0; margin-bottom:20px;">
                <button class="stab active" data-tab="general" style="padding:10px 20px; background:none; border:none; border-bottom:3px solid #3B82F6; color:#1E293B; font-weight:bold; cursor:pointer; font-family:inherit;">تنظیمات عمومی</button>
                <button class="stab" data-tab="org" style="padding:10px 20px; background:none; border:none; border-bottom:3px solid transparent; color:#64748B; font-weight:bold; cursor:pointer; font-family:inherit;">اطلاعات سازمان</button>
                <button class="stab" data-tab="fy" style="padding:10px 20px; background:none; border:none; border-bottom:3px solid transparent; color:#64748B; font-weight:bold; cursor:pointer; font-family:inherit;">اطلاعات دوره مالی</button>
            </div>

            <div id="tab-general" class="stab-content">
                <div class="form-group">
                    <label>لوگوی برنامه</label>
                    <div style="display:flex; align-items:center; gap:12px; padding:12px; background:#F9FAFB; border-radius:10px; margin-bottom:16px;">
                        <div class="logo-preview" style="width:56px; height:56px; font-size:22px;">
                            ${hasLogo ? `<img src="${this.getLogo()}" alt="لوگو">` : '<span>آ</span>'}
                        </div>
                        <div style="flex:1;">
                            <p style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">
                                ${hasLogo ? 'لوگوی فعلی' : 'لوگویی تنظیم نشده'}
                            </p>
                            <button type="button" class="btn btn-ghost btn-sm" id="openLogoDialogBtn">
                                🎨 تغییر لوگو
                            </button>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>تعداد ردیف در هر صفحه (صفحه‌بندی)</label>
                    <div id="csPageSizeWrapper">
                        ${window.App.UI.CustomSelect.html('setPageSizeCustom', pageSizeCsOptions, String(s.pageSize), 'انتخاب کنید...')}
                    </div>
                    <p class="form-hint" style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">این مقدار روی همه‌ی جدول‌های برنامه اعمال می‌شود.</p>
                </div>

                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn btn-primary" id="setSaveBtn">💾 ذخیره</button>
                    <button class="btn btn-ghost" data-close>انصراف</button>
                </div>
            </div>

            <div id="tab-org" class="stab-content" style="display:none;">
                <div id="orgLoading" style="text-align:center; padding:20px; color:#64748B;">در حال بارگذاری...</div>
                <div id="orgForm" style="display:none;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div class="form-group"><label>نام سازمان</label><input type="text" id="editOrgName" class="form-control"></div>
                        <div class="form-group"><label>کد لایسنس</label><input type="text" id="editOrgLicence" class="form-control"></div>
                        <div class="form-group"><label>شناسه ملی</label><input type="text" id="editOrgNationalCode" class="form-control" dir="ltr"></div>
                        <div class="form-group"><label>شماره ثبت</label><input type="text" id="editOrgRegNo" class="form-control" dir="ltr"></div>
                        <div class="form-group"><label>کد اقتصادی</label><input type="text" id="editOrgEcoNo" class="form-control" dir="ltr"></div>
                        <div class="form-group"><label>کد پستی</label><input type="text" id="editOrgPostalCode" class="form-control" dir="ltr"></div>
                        <div class="form-group"><label>استان</label><input type="text" id="editOrgOstan" class="form-control"></div>
                        <div class="form-group"><label>شهرستان</label><input type="text" id="editOrgCity1" class="form-control"></div>
                        <div class="form-group"><label>شهر</label><input type="text" id="editOrgCity2" class="form-control"></div>
                        <div class="form-group"><label>تلفن</label><input type="text" id="editOrgPhone" class="form-control" dir="ltr"></div>
                        <div class="form-group" style="grid-column: span 2;"><label>آدرس</label><input type="text" id="editOrgAddress" class="form-control"></div>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button class="btn btn-primary" id="saveOrgBtn">💾 ذخیره اطلاعات سازمان</button>
                    </div>
                </div>
            </div>

            <div id="tab-fy" class="stab-content" style="display:none;">
                <div id="fyLoading" style="text-align:center; padding:20px; color:#64748B;">در حال بارگذاری...</div>
                <div id="fyForm" style="display:none;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <div class="form-group" style="grid-column: span 2;"><label>نام دوره</label><input type="text" id="editFyName" class="form-control"></div>
                        <div class="form-group"><label>تاریخ شروع</label><input type="text" id="editFyBeginDate" class="form-control" dir="ltr"></div>
                        <div class="form-group"><label>تاریخ پایان</label><input type="text" id="editFyEndDate" class="form-control" dir="ltr"></div>
                        <div class="form-group"><label>درصد مالیات</label><input type="number" id="editFyTax" class="form-control" dir="ltr"></div>
                        <div class="form-group"><label>درصد عوارض</label><input type="number" id="editFyAvarez" class="form-control" dir="ltr"></div>
                        <div class="form-group" style="grid-column: span 2; background:#FEF3C7; padding:10px; border-radius:8px;">
                            <label style="color:#92400E;">نسخه دیتابیس (UpDate_Database) - ⚠️ با احتیاط تغییر دهید</label>
                            <input type="text" id="editFyUpdateDb" class="form-control" dir="ltr">
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button class="btn btn-primary" id="saveFyBtn">💾 ذخیره اطلاعات دوره</button>
                    </div>
                </div>
            </div>
        `;

        this.openModal('⚙️ تنظیمات', body);
        const modalBody = document.getElementById('modalBody');

        // ═══ تب‌ها ═══
        modalBody.querySelectorAll('.stab').forEach(btn => {
            btn.addEventListener('click', () => {
                // تغییر حالت دکمه‌ها
                modalBody.querySelectorAll('.stab').forEach(b => {
                    b.classList.remove('active');
                    b.style.borderBottomColor = 'transparent';
                    b.style.color = '#64748B';
                });
                btn.classList.add('active');
                btn.style.borderBottomColor = '#3B82F6';
                btn.style.color = '#1E293B';

                // مخفی کردن محتواها
                modalBody.querySelectorAll('.stab-content').forEach(c => c.style.display = 'none');
                document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';

                // لود دیتا
                if (btn.dataset.tab === 'org') loadOrgData();
                if (btn.dataset.tab === 'fy') loadFyData();
            });
        });

        // ═══ تب عمومی (لوگو و صفحه‌بندی) ═══
        setTimeout(() => {
            window.App.UI.CustomSelect.bind('setPageSizeCustom', () => { });
        }, 50);

        modalBody.querySelector('#openLogoDialogBtn')?.addEventListener('click', () => {
            this.closeModal();
            setTimeout(() => this.openLogoDialog(), 100);
        });

        modalBody.querySelector('#setSaveBtn').addEventListener('click', () => {
            const selectedPageSize = parseInt(window.App.UI.CustomSelect.getValue('setPageSizeCustom'));
            this.state.settings.pageSize = selectedPageSize;
            localStorage.setItem('ariana_settings', JSON.stringify(this.state.settings));
            this.closeModal();
            this.toast('تنظیمات ذخیره شد', 'success');

            // رفرش صفحه فعلی
            if (this.state.currentPage === 'sanad') { this.state.sanadPage = 1; window.App.Features.Sanad.loadList(); }
            else if (this.state.currentPage === 'article') { window.App.Features.Article.runList(1); }
            else if (this.state.currentPage === 'factor') { window.App.Features.Factor.runList(1); }
            else if (this.state.currentPage === 'tafzili2') { window.App.Features.Tafzili2.runList(1); }
        });

        // ═══ تب سازمان ═══
        async function loadOrgData() {
            const loading = document.getElementById('orgLoading');
            const form = document.getElementById('orgForm');
            loading.style.display = 'block'; form.style.display = 'none';

            try {
                const res = await window.App.Http.api(`/api/setup/sazman/${orgId}`);
                document.getElementById('editOrgName').value = res.name || '';
                document.getElementById('editOrgLicence').value = res.licenceSazman || '';
                document.getElementById('editOrgNationalCode').value = res.nationalCode || '';
                document.getElementById('editOrgRegNo').value = res.regNo || '';
                document.getElementById('editOrgEcoNo').value = res.ecoNo || '';
                document.getElementById('editOrgPostalCode').value = res.postalCode || '';
                document.getElementById('editOrgOstan').value = res.ostan || '';
                document.getElementById('editOrgCity1').value = res.cityName1 || '';
                document.getElementById('editOrgCity2').value = res.cityName2 || '';
                document.getElementById('editOrgPhone').value = res.phoneNo || '';
                document.getElementById('editOrgAddress').value = res.address || '';

                loading.style.display = 'none'; form.style.display = 'block';
            } catch (e) { loading.textContent = 'خطا در بارگذاری اطلاعات'; }
        }

        modalBody.querySelector('#saveOrgBtn').addEventListener('click', async () => {
            const payload = {
                SazmanId: orgId,
                Name: document.getElementById('editOrgName').value,
                LicenceSazman: document.getElementById('editOrgLicence').value,
                NationalCode: document.getElementById('editOrgNationalCode').value,
                RegNo: document.getElementById('editOrgRegNo').value,
                EcoNo: document.getElementById('editOrgEcoNo').value,
                PostalCode: document.getElementById('editOrgPostalCode').value,
                Ostan: document.getElementById('editOrgOstan').value,
                CityName1: document.getElementById('editOrgCity1').value,
                CityName2: document.getElementById('editOrgCity2').value,
                PhoneNo: document.getElementById('editOrgPhone').value,
                Address: document.getElementById('editOrgAddress').value
            };
            try {
                await window.App.Http.api(`/api/setup/sazman/${orgId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                    successMsg: 'اطلاعات سازمان ذخیره شد'
                });
            } catch (e) { /* handled by Http.api */ }
        });

        // ═══ تب دوره مالی ═══
        async function loadFyData() {
            const loading = document.getElementById('fyLoading');
            const form = document.getElementById('fyForm');
            loading.style.display = 'block'; form.style.display = 'none';

            try {
                const res = await window.App.Http.api(`/api/setup/doreh-mali/${fyId}`);
                document.getElementById('editFyName').value = res.name || '';
                document.getElementById('editFyBeginDate').value = res.beginDate || '';
                document.getElementById('editFyEndDate').value = res.endDate || '';
                document.getElementById('editFyTax').value = res.tax_Per || 0;
                document.getElementById('editFyAvarez').value = res.avarez_Per || 0;
                document.getElementById('editFyUpdateDb').value = res.upDate_Database || '';

                loading.style.display = 'none'; form.style.display = 'block';
            } catch (e) { loading.textContent = 'خطا در بارگذاری اطلاعات'; }
        }

        modalBody.querySelector('#saveFyBtn').addEventListener('click', async () => {
            const payload = {
                DorehMaliId: fyId,
                Name: document.getElementById('editFyName').value,
                BeginDate: document.getElementById('editFyBeginDate').value,
                EndDate: document.getElementById('editFyEndDate').value,
                Tax_Per: parseFloat(document.getElementById('editFyTax').value) || 0,
                Avarez_Per: parseFloat(document.getElementById('editFyAvarez').value) || 0,
                UpDate_Database: document.getElementById('editFyUpdateDb').value
            };
            try {
                await window.App.Http.api(`/api/setup/doreh-mali/${fyId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                    successMsg: 'اطلاعات دوره مالی ذخیره شد'
                });
            } catch (e) { /* handled by Http.api */ }
        });

        // ═══ بستن ═══
        modalBody.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => this.closeModal());
        });
    },
    // ═══════════════════════════════════════════
    //  API HELPER
    // ═══════════════════════════════════════════
    async api(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'X-Api-Key': this.state.apiKey || '',
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        if (this.state.token) {
            headers['Authorization'] = `Bearer ${this.state.token}`;
        }

        const res = await fetch(url, { ...options, headers });

        if (res.status === 401) {
            this.toast('نشست منقضی شد. دوباره وارد شوید.', 'error');
            this.handleLogout();
            throw new Error('Unauthorized');
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `خطا (${res.status})` }));
            throw new Error(err.error || `خطا (${res.status})`);
        }

        if (res.status === 204) return null;
        return await res.json();
    },

    // ═══════════════════════════════════════════
    //  NAVIGATION
    // ═══════════════════════════════════════════
    navigate(page) {
        // ⭐ بستن منو در موبایل
        if (this.isMobile()) this.closeSidebar();

        this.state.currentPage = page;
        // ⭐ چک دسترسی
        if (!this._canAccessPage(page)) {
            this.toast('شما به این بخش دسترسی ندارید', 'error');
            return;
        }
        this._expandGroupOfPage(page);


        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        const titles = {
            dashboard: 'داشبورد',
            sanad: 'اسناد حسابداری',
            taraz: 'تراز حساب‌ها',
            ledger: 'دفتر حساب',
            profitloss: 'سود و زیان',
            bilan: 'ترازنامه (بیلان)',
            daybook: 'دفتر روزنامه',
            factor: 'فاکتورها',
            hesab: 'حساب‌ها',
            tafzili: 'تفضیلی 1',
            tafzili2: 'تفضیلی ۲',
            unit: 'واحدهای شمارش',
            article: 'کالاها',
            sharh: 'شرح‌ها',
            kind: 'انواع سند',

            // ⭐ منوی ورود/خروج کالا
            'factor-buy': 'فاکتور خرید',
            'factor-sell': 'فاکتور فروش',
            'factor-buy-return': 'مرجوع از خرید',
            'factor-sell-return': 'مرجوع از فروش',
            'factor-scrap': 'فروش ضایعات',
            'factor-pre': 'پیش فاکتور',
            'stock-receipt': 'ثبت رسید انبار',
            'stock-transfer': 'ثبت حواله انبار',
            'stock-return-receipt': 'ثبت رسید برگشتی',
            'asset-goods': 'ثبت کالاهای اموالی',
            'asset-goods-transfer': 'انتقالی اموالی',
            'stock-count': 'انبار گردانی کالا',
            // ⭐ منوی دریافت/پرداخت
            'receive-cash': 'دریافت نقدی',
            'receive-cheque': 'دریافت چکی',
            'pay-cash': 'پرداخت نقدی',
            'pay-cheque': 'پرداخت چکی',
            'cheque-expend': 'خرج چک‌های دریافتی', 
            'report-cheque-pay': 'گزارش چک‌های پرداختی',
            'report-cheque-receive': 'گزارش چک‌های دریافتی',
            'report-cheque-expend': 'گزارش خرج چک‌های دریافتی',
            'report-cheque-returned':'گزارش چک‌های برگشتی',

            // ⭐ گزارشات فاکتور
            'report-factor': 'گزارش فاکتورها',
            'report-sell-summary': 'خلاصه فروش',
            'report-profit': 'سود و زیان فاکتورها',
            // ⭐ گزارشات ابنار و گردش کالا
            'article-rotate': 'گردش کالاها',
            'kardex': 'کاردکس کالا',
            'party-factor': 'فاکتورهای طرف حساب',
            'factor-profit-loss': 'سود و زیان فاکتوری',
            'article-stock': 'گزارش موجودی کالا',
            //
            'const-hesab':'حسابهای پیش فرض',
            'stock-type': 'انبارها / اموال',
            'article-group': 'گروه‌های کالا',
            'bank': 'بانک‌ها',
            'bank-acc': 'حساب‌های بانکی',
            'sanad-renumber': 'مرتب‌ساز اطلاعات',
            // * مودیان
            'moadian': '🏛️ سامانه مودیان'

        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        switch (page) {
            case 'dashboard': window.App.Features.Dashboard.render(); break;
            case 'sanad': window.App.Features.Sanad.render(); break;
            case 'taraz': window.App.Features.Taraz.render(); break;
            case 'ledger': window.App.Features.Ledger.render(); break;
            case 'profitloss': window.App.Features.ProfitLoss.render(); break;
            case 'bilan': window.App.Features.Bilan.render(); break;
            case 'daybook': window.App.Features.DayBook.render(); break;
            case 'pay-cash': window.App.Features.TreasuryCash.render(0); break;
            case 'receive-cash': window.App.Features.TreasuryCash.render(1); break;
            case 'pay-cheque': window.App.Features.TreasuryCheque.render(0); break;
            case 'receive-cheque': window.App.Features.TreasuryCheque.render(1); break;
            case 'cheque-expend': window.App.Features.TreasuryChequeExpend.render(); break; 
            case 'report-cheque-pay': window.App.Features.TreasuryChequeReport.render(0); break;
            case 'report-cheque-receive': window.App.Features.TreasuryChequeReport.render(1); break;
            case 'report-cheque-expend': window.App.Features.TreasuryChequeReport.render(2); break;
            case 'report-cheque-returned': window.App.Features.TreasuryChequeReturnedReport.render(); break;
            case 'factor': window.App.Features.Factor.render(); break;
            case 'factor-buy': window.App.Features.Factor.render(0); break;
            case 'factor-sell': window.App.Features.Factor.render(1); break;
            case 'factor-buy-return': window.App.Features.Factor.render(2); break;
            case 'factor-sell-return': window.App.Features.Factor.render(3); break;
            case 'factor-scrap': window.App.Features.Factor.render(9); break;
            case 'factor-pre': window.App.Features.Factor.render(4); break;
            case 'article': window.App.Features.Article.render(); break;
            case 'hesab': window.App.Features.Hesab.render(); break;
            case 'tafzili': window.App.Features.Tafzili.render(); break;
            case 'tafzili2': window.App.Features.Tafzili2.render(); break;
            case 'const-hesab': window.App.Features.ConstHesab.render(); break;
            case 'stock-type': window.App.Features.StockType.render(); break; 
            case 'article-group': window.App.Features.ArticleGroup.render(); break;
            case 'unit': window.App.Features.Unit.render(); break;
            case 'sharh': window.App.Features.Sharh.render(); break;
            case 'kind': window.App.Features.Kind.render(); break;
            case 'kardex': window.App.Features.Kardex.render(); break;
            case 'article-rotate': window.App.Features.ArticleRotate.render(); break;
            case 'party-factor': window.App.Features.PartyFactor.render(); break;
            case 'factor-profit-loss': window.App.Features.FactorProfitLoss.render(); break;
            case 'article-stock': window.App.Features.ArticleStock.render(); break;
            case 'bank': window.App.Features.Bank.render(); break;
            case 'bank-acc': window.App.Features.BankAcc.render(); break;
            case 'sanad-renumber': window.App.Features.SanadRenumber.render(); break;
            case 'moadian': window.App.Features.Moadian.render(); break;
            // ⭐ صفحات در حال توسعه — placeholder نمایش می‌ده
            default:
                window.App.renderComingSoon(page, titles[page] || page);
                break;
        }
        // ⭐ اعمال آیکن‌ها بعد از هر route
        if (window.App.Icons) {
            setTimeout(function () { window.App.Icons.applyAll(); }, 0);
        }
    },



    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════
    _parseIntOrNull(id) {
        const el = document.getElementById(id);
        if (!el) return null;
        return el.value === '' ? null : parseInt(el.value);
    },

    _parseDecOrNull(id) {
        const el = document.getElementById(id);
        if (!el) return null;
        return el.value === '' ? null : parseFloat(el.value);
    },
    fmt(n) {
        if (n == null || n === '' || n === 0) return '';
        const num = Number(n);
        if (isNaN(num)) return this.esc(String(n));
        return num.toLocaleString('fa-IR');
    },
    // ⭐ بعد از هر بار رندر جدول صدا زده می‌شه
    enhanceTables(root = document) {
        // با تأخیر کوچیک تا DOM کامل بشینه
        requestAnimationFrame(() => {
            if (window.TableEnhancer) {
                TableEnhancer.enhance(root);
            }
            // ⭐ تبدیل به کارت در موبایل
            if (window.App.UI.TableCardView) {
                window.App.UI.TableCardView.apply(root);
            }
        });
    },

    fmtAcc(n) {
        if (n == null || n === '') return '-';
        const num = Number(n);
        if (isNaN(num)) return this.esc(String(n));
        if (num < 0) return `(${Math.abs(num).toLocaleString('fa-IR')})`;
        return num.toLocaleString('fa-IR');
    },

    esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },
    // ⭐ عدد علامت‌دار (مقدار): مثبت و منفی رو نشون می‌ده
    fmtSigned(n) {
        if (n == null || n === '') return '-';
        const num = Number(n);
        if (isNaN(num)) return this.esc(String(n));
        if (num === 0) return '-';
        return num.toLocaleString('fa-IR');
    },
    statusBadge(v) {
        if (v == null) return '<span class="badge badge-gray">-</span>';
        const map = {
            0: ['badge-warning', 'پیش‌نویس'],
            1: ['badge-info', 'ثبت شده'],
            2: ['badge-success', 'تأیید شده'],
            3: ['badge-danger', 'برگشتی']
        };
        const [cls, label] = map[v] || ['badge-gray', 'نامشخص'];
        return `<span class="badge ${cls}">${label}</span>`;
    },
    // ⭐ صفحه‌ی «در حال توسعه» برای صفحات ساخته‌نشده
    renderComingSoon(page, title) {
        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card">
                <div class="empty" style="padding: 60px 20px;">
                    <div class="empty-icon" style="font-size:64px; opacity:0.4;">🚧</div>
                    <h2 style="margin: 16px 0 8px; color: var(--text); font-size: 18px;">
                        ${this.esc(title)}
                    </h2>
                    <p class="muted" style="font-size: 14px; margin-top: 8px;">
                        این بخش در حال توسعه است
                    </p>
                    <p class="muted" style="font-size: 12px; margin-top: 4px; direction: ltr;">
                        صفحه: ${this.esc(page)}
                    </p>
                </div>
            </div>`;
        if (window.App.UI.PermissionGuard) {
            window.App.UI.PermissionGuard.apply(c);
        }
    },
    // ⭐ دریافت ردیف‌های انتخاب‌شده
    getSelectedRows(tableSelector) {
        const tbl = tableSelector
            ? document.querySelector(tableSelector)
            : document.querySelector('table');
        if (!tbl) return [];
        return Array.from(tbl.querySelectorAll('tbody tr.row-selected'));
    },

    // ⭐ پاک کردن انتخاب
    clearRowSelection(tableSelector) {
        const tbl = tableSelector
            ? document.querySelector(tableSelector)
            : document.querySelectorAll('table');
        if (!tbl) return;
        if (tbl.length && !tbl.querySelectorAll) {
            // single element
            tbl.querySelectorAll('tbody tr.row-selected').forEach(r => r.classList.remove('row-selected'));
        } else {
            // NodeList
            tbl.forEach(t => t.querySelectorAll('tbody tr.row-selected').forEach(r => r.classList.remove('row-selected')));
        }
    },

    // ═══════════════════════════════════════════
    //  تغییر رمز
    // ═══════════════════════════════════════════
    openChangePassword() {
        const user = this.state.user || {};

        const body = `
        <div class="pwd-form">
            <div class="pwd-user-banner">
                <div class="pwd-user-avatar">${this.esc((user.fullName || user.username || '?').charAt(0))}</div>
                <div>
                    <div class="pwd-user-name">${this.esc(user.fullName || user.username || '-')}</div>
                    <div class="pwd-user-meta">${this.esc(user.orgName || '')} - ${this.esc(user.fyName || '')}</div>
                </div>
            </div>

            <div class="pwd-field">
                <label>رمز فعلی <span class="req">*</span></label>
                <input type="password" id="pwdCurrent" autocomplete="current-password" placeholder="رمز فعلی خود را وارد کنید">
            </div>

            <div class="pwd-field">
                <label>رمز جدید <span class="req">*</span></label>
                <input type="password" id="pwdNew" autocomplete="new-password" placeholder="حداقل ۴ کاراکتر">
            </div>

            <div class="pwd-field">
                <label>تأیید رمز جدید <span class="req">*</span></label>
                <input type="password" id="pwdConfirm" autocomplete="new-password" placeholder="رمز جدید را دوباره وارد کنید">
            </div>

            <div id="pwdError" class="pwd-error hidden"></div>

            <div class="pwd-footer">
                <button class="btn btn-primary" id="pwdSaveBtn">💾 ذخیره</button>
                <button class="btn btn-ghost" data-close>انصراف</button>
            </div>
        </div>
    `;

        this.openModal('🔑 تغییر رمز عبور', body);

        const modalBody = document.getElementById('modalBody');
        const currentEl = modalBody.querySelector('#pwdCurrent');
        const newEl = modalBody.querySelector('#pwdNew');
        const confirmEl = modalBody.querySelector('#pwdConfirm');
        const errorEl = modalBody.querySelector('#pwdError');

        setTimeout(() => currentEl.focus(), 100);

        const showError = (msg) => {
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
        };
        const clearError = () => errorEl.classList.add('hidden');

        const doSave = async () => {
            clearError();

            const cur = currentEl.value;
            const nw = newEl.value;
            const cf = confirmEl.value;

            if (!cur) return showError('رمز فعلی را وارد کنید');
            if (!nw) return showError('رمز جدید را وارد کنید');
            if (nw.length < 4) return showError('رمز جدید باید حداقل ۴ کاراکتر باشد');
            if (nw !== cf) return showError('رمز جدید و تأیید آن یکسان نیستند');
            if (cur === nw) return showError('رمز جدید با رمز فعلی یکسان است');

            const btn = modalBody.querySelector('#pwdSaveBtn');
            const orig = btn.textContent;
            btn.disabled = true;
            btn.textContent = '⏳ در حال ذخیره...';

            try {
                await window.App.Http.api('/api/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                        currentPassword: cur,
                        newPassword: nw
                    })
                });

                this.toast('رمز با موفقیت تغییر کرد', 'success');
                this.closeModal();
            } catch (err) {
                btn.disabled = false;
                btn.textContent = orig;
                showError(err.message || 'خطا در تغییر رمز');
            }
        };

        modalBody.querySelector('#pwdSaveBtn').addEventListener('click', doSave);
        modalBody.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => this.closeModal());
        });

        // Enter برای ذخیره
        [currentEl, newEl, confirmEl].forEach(el => {
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); doSave(); }
            });
        });
    },

    // ═══════════════════════════════════════════
    //  TAB SYNC — قفل تک-دوره در یک مرورگر
    //  برای دو دوره مختلف همزمان → مرورگر دیگه
    // ═══════════════════════════════════════════
    _tabSyncInitialized: false,

    _setupTabSync() {
        if (this._tabSyncInitialized) return;
        this._tabSyncInitialized = true;

        const self = this;

        window.addEventListener('storage', function (e) {
            // ⭐ تغییر توکن JWT (login مجدد یا سوییچ دوره)
            if (e.key === 'ariana_token') {
                if (!e.newValue && e.oldValue) {
                    self._handleTabLogout();
                    return;
                }
                if (e.newValue && e.newValue !== e.oldValue) {
                    self._handleTabTokenChange(e.newValue);
                    return;
                }
            }

            // ⭐ تغییر API Key (logout ناقص)
            if (e.key === 'ariana_api_key' && !e.newValue && e.oldValue) {
                self._handleTabLogout();
                return;
            }

            // ⭐ پاکسازی سراسری (localStorage.clear)
            if (e.key === null) {
                self._handleTabLogout();
                return;
            }
        });

        console.log('[TabSync] ✓ فعال — قفل تک-دوره');
    },

    _decodeJwt(token) {
        try {
            const parts = String(token).split('.');
            if (parts.length !== 3) return null;
            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(payload));
        } catch {
            return null;
        }
    },

    _handleTabTokenChange(newToken) {
        const newPayload = this._decodeJwt(newToken);
        if (!newPayload) return;

        const curState = (window.App.State && window.App.State.get) ? window.App.State.get() : {};
        const curUser = curState.user || {};
        const curToken = curState.token;

        // اگه این تب لاگین نیست → کاربر تو تب دیگه Login کرد
        if (!curToken) {
            this._showTabLoginNotice();
            return;
        }

        // استخراج fyId / orgId
        const curPayload = this._decodeJwt(curToken) || {};
        const curFy = curUser.fyId || curPayload.fyId;
        const curOrg = curUser.orgId || curPayload.orgId;
        const newFy = newPayload.fyId;
        const newOrg = newPayload.orgId;

        // اگه دوره یا سازمان عوض شد → قفل
        if (String(curFy) !== String(newFy) || String(curOrg) !== String(newOrg)) {
            this._showTabSwitchWarning();
        }
    },

    _handleTabLogout() {
        const curState = (window.App.State && window.App.State.get) ? window.App.State.get() : {};
        if (!curState.token) return;   // این تب هم خارج بود

        console.warn('[TabSync] کاربر در تب دیگه Logout کرد → این تب هم خارج می‌شه');

        try { window.App.State.clearAuth(); } catch { }

        if (window.App.Auth && typeof window.App.Auth.showLogin === 'function') {
            window.App.Auth.showLogin();
        } else {
            location.href = '/';
        }
    },

    _showTabSwitchWarning() {
        if (document.getElementById('tabSyncSwitchOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tabSyncSwitchOverlay';
        overlay.className = 'tab-sync-overlay';
        overlay.innerHTML = `
            <div class="tab-sync-box">
                <div class="tab-sync-icon">🔄</div>
                <div class="tab-sync-title">تغییر دوره مالی در تب دیگر</div>
                <div class="tab-sync-msg">
                    در یکی دیگر از تب‌های این مرورگر، دوره مالی یا سازمان تغییر کرد.
                    <br>
                    برای جلوگیری از اختلاط داده‌ها، این تب باید بسته شود.
                </div>
                <div class="tab-sync-hint">
                    💡 اگر می‌خواهید <b>دو دوره مالی مختلف</b> را همزمان کار کنید،
                    از یک <b>مرورگر دیگر</b> استفاده کنید (مثلاً Chrome + Firefox).
                </div>
                <div class="tab-sync-btns">
                    <button class="btn btn-primary" id="tabSyncClose">🔄 بستن و ادامه</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        // ⭐ اجباری — کاربر نمی‌تونه ببنده (فقط دکمه)
        document.getElementById('tabSyncClose')?.addEventListener('click', () => {
            try { window.App.State.clearAuth(); } catch { }
            location.href = '/';
        });
    },

    _showTabLoginNotice() {
        if (document.getElementById('tabSyncLoginOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tabSyncLoginOverlay';
        overlay.className = 'tab-sync-overlay';
        overlay.innerHTML = `
            <div class="tab-sync-box">
                <div class="tab-sync-icon">✓</div>
                <div class="tab-sync-title">ورود در تب دیگر</div>
                <div class="tab-sync-msg">
                    شما در یکی دیگر از تب‌های این مرورگر وارد سیستم شده‌اید.
                    <br>
                    برای استفاده از این تب، صفحه را دوباره باز کنید.
                </div>
                <div class="tab-sync-btns">
                    <button class="btn btn-primary" id="tabSyncReload">🔄 بارگذاری مجدد</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        document.getElementById('tabSyncReload')?.addEventListener('click', () => {
            location.reload();
        });
    },


});

// شروع
document.addEventListener('DOMContentLoaded', () => window.App.init());
