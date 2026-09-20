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

    // ═══════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════
    init() {
        // ⭐ راه‌اندازی Core
        window.App.Http.init(window.location.origin);   // ← window.App
        window.App.State.init();                        // ← window.App

        // ⭐ بازیابی از localStorage — الان App.State این کار رو می‌کنه
        //    (این خط رو نگه دار فقط اگه قبلاً اینجا localStorage رو خودت می‌خوندی)
        // const saved = localStorage.getItem('ariana_auth');
        // ... (این بخش رو حذف کن — App.State.init() جاش رو گرفته)

        // رویدادها
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());

        // ⭐ اعمال لوگو
        this.applyLogo();
        // ⭐ Sidebar موبایل
        this.initSidebar();

        // ⭐ تشخیص دستگاه
        this.detectDevice();
        document.getElementById('btnSettings')?.addEventListener('click', () => this.openSettings());

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
            this.checkLicense();
            this.loadOrganizations();
        }
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
    async checkLicense() {
        try {
            const res = await fetch(`${this.baseUrl}/api/license/status`);
            const data = await res.json();

            const warningEl = document.getElementById('licenseWarning');

            if (!data.isValid) {
                warningEl.className = 'license-warning';
                warningEl.innerHTML = `
                <div>
                    <strong>لایسنس نامعتبر است</strong><br>
                    <small>${this.esc(data.errorMessage || '')}</small>
                </div>
            `;
                warningEl.classList.remove('hidden');
            } else {
                warningEl.className = 'license-valid-info';
                const custName = data.customerName && data.customerName.trim()
                    ? data.customerName
                    : '(بدون نام)';
                warningEl.innerHTML = `
                ✅ لایسنس معتبر | 
                <strong>${this.esc(custName)}</strong>
                | سازمان‌های مجاز: ${data.authorizedOrgs.length}
                | انقضا: ${this.esc(data.expiresAt)}
            `;
                warningEl.classList.remove('hidden');
            }
        } catch (err) {
            console.error('License check failed:', err);
        }
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
    //  LOOKUPS (سازمان / دوره مالی)
    // ═══════════════════════════════════════════
    async loadOrganizations() {
        const select = document.getElementById('orgId');
        if (!select) return;

        select.innerHTML = '<option value="">در حال بارگذاری...</option>';

        try {
            const res = await fetch(`${this.baseUrl}/api/lookup/organizations`);
            if (!res.ok) throw new Error('خطا در بارگذاری سازمان‌ها');

            const list = await res.json();

            if (!list || list.length === 0) {
                select.innerHTML = '<option value="">سازمانی یافت نشد</option>';
                return;
            }

            select.innerHTML = '<option value="">-- انتخاب کنید --</option>' +
                list.map(o => `<option value="${o.code}">${this.esc(o.name)}</option>`).join('');

            const savedOrg = this.state.user?.orgId;
            if (savedOrg) {
                select.value = savedOrg;
                await this.loadFiscalYears(savedOrg);
            }
        } catch (err) {
            console.error(err);
            select.innerHTML = '<option value="">خطا در بارگذاری</option>';
        }
    },

    async loadFiscalYears(orgId) {
        const select = document.getElementById('fyId');
        if (!select) return;

        if (!orgId) {
            select.innerHTML = '<option value="">-- ابتدا سازمان --</option>';
            return;
        }

        select.innerHTML = '<option value="">در حال بارگذاری...</option>';

        try {
            const res = await fetch(`${this.baseUrl}/api/lookup/organizations/${orgId}/fiscal-years`);
            if (!res.ok) throw new Error('خطا در بارگذاری دوره‌ها');

            const list = await res.json();

            if (!list || list.length === 0) {
                select.innerHTML = '<option value="">دوره‌ای یافت نشد</option>';
                return;
            }

            select.innerHTML = '<option value="">-- انتخاب کنید --</option>' +
                list.map(f => {
                    const label = (f.beginDate && f.endDate)
                        ? `${f.name} (${f.beginDate} - ${f.endDate})`
                        : f.name;
                    return `<option value="${f.id}">${this.esc(label)}</option>`;
                }).join('');

            const savedFy = this.state.user?.fyId;
            if (savedFy) select.value = savedFy;
        } catch (err) {
            console.error(err);
            select.innerHTML = '<option value="">خطا در بارگذاری</option>';
        }
    },

    // ═══════════════════════════════════════════
    //  LOGIN / LOGOUT
    // ═══════════════════════════════════════════
    async handleLogin(e) {
        e.preventDefault();

        const btn = document.getElementById('loginBtnText');
        const errBox = document.getElementById('loginError');
        errBox.classList.add('hidden');

        const orgVal = document.getElementById('orgId').value;
        const fyVal = document.getElementById('fyId').value;

        if (!orgVal || !fyVal) {
            errBox.textContent = 'لطفاً سازمان و دوره مالی را انتخاب کنید';
            errBox.classList.remove('hidden');
            return;
        }

        btn.textContent = 'در حال ورود...';

        const payload = {
            orgId: parseInt(orgVal),
            fyId: parseInt(fyVal),
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };
        const apiKey = document.getElementById('apiKey').value;

        try {
            const res = await fetch(`${this.baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': apiKey
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'خطای ناشناخته' }));
                throw new Error(err.error || `خطا (${res.status})`);
            }

            const data = await res.json();
            this.state.token = data.accessToken;
            this.state.refreshToken = data.refreshToken;
            this.state.user = data.user;
            this.state.apiKey = apiKey;

            window.App.State.persistAuth();  // ← ساده‌تر

            localStorage.setItem('ariana_auth', JSON.stringify({
                token: this.state.token,
                refreshToken: this.state.refreshToken,
                user: this.state.user,
                apiKey: this.state.apiKey
            }));

            this.showApp();
            this.navigate('dashboard');
            this.toast('خوش آمدید!', 'success');
        } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
        } finally {
            btn.textContent = 'ورود';
        }
    },

    handleLogout() {
        window.App.State.clearAuth();
        this.showLogin();
        this.loadOrganizations();
        this.toast('از سیستم خارج شدید');
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

        const body = `
        <div class="form-group">
            <label>لوگوی برنامه</label>
            <div style="display:flex; align-items:center; gap:12px; padding:12px; background:#F9FAFB; border-radius:10px; margin-bottom:16px;">
                <div class="logo-preview" style="width:56px; height:56px; font-size:22px;">
                    ${hasLogo
                ? `<img src="${this.getLogo()}" alt="لوگو">`
                : '<span>آ</span>'}
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
            <div class="custom-select" id="setPageSizeWrap">
                <button type="button" class="custom-select-trigger" id="setPageSizeTrigger">
                    <span class="custom-select-value">${s.pageSize} ردیف</span>
                    <span class="custom-select-arrow">▼</span>
                </button>
                <div class="custom-select-menu" id="setPageSizeMenu">
                    ${pageSizeOptions.map(v => `
                        <div class="custom-select-option ${s.pageSize === v ? 'selected' : ''}"
                             data-value="${v}">${v} ردیف</div>
                    `).join('')}
                </div>
            </div>
            <p class="form-hint">این مقدار روی همه‌ی جدول‌های برنامه اعمال می‌شود.</p>
        </div>

        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn btn-primary" id="setSaveBtn">💾 ذخیره</button>
            <button class="btn btn-ghost" data-close>انصراف</button>
        </div>
    `;

        this.openModal('⚙️ تنظیمات', body);

        const modalBody = document.getElementById('modalBody');
        let selectedPageSize = s.pageSize;

        // ═══ Custom Select Logic ═══
        const wrap = modalBody.querySelector('#setPageSizeWrap');
        const trigger = modalBody.querySelector('#setPageSizeTrigger');
        const menu = modalBody.querySelector('#setPageSizeMenu');
        const valueEl = modalBody.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedPageSize = parseInt(opt.dataset.value);
                valueEl.textContent = `${selectedPageSize} ردیف`;
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
            });
        });

        // بستن با کلیک بیرون
        const closeHandler = (e) => {
            if (!wrap.contains(e.target)) {
                wrap.classList.remove('open');
            }
        };
        document.addEventListener('click', closeHandler);

        // دکمه لوگو
        const logoBtn = modalBody.querySelector('#openLogoDialogBtn');
        if (logoBtn) {
            logoBtn.addEventListener('click', () => {
                document.removeEventListener('click', closeHandler);
                this.closeModal();
                setTimeout(() => this.openLogoDialog(), 100);
            });
        }

        // ذخیره
        modalBody.querySelector('#setSaveBtn').addEventListener('click', () => {
            this.state.settings.pageSize = selectedPageSize;
            localStorage.setItem('ariana_settings', JSON.stringify(this.state.settings));
            document.removeEventListener('click', closeHandler);
            this.closeModal();
            this.toast('تنظیمات ذخیره شد', 'success');

            // رفرش صفحه فعلی
            if (this.state.currentPage === 'sanad') {
                this.state.sanadPage = 1;
                window.App.Features.Sanad.loadList();
            } else if (this.state.currentPage === 'article') {
                this.runArticleList(1);
            } else if (this.state.currentPage === 'factor') {
                this.runFactorList(1);
            } else if (this.state.currentPage === 'ledger') {
                // کاربر باید دوباره تهیه گزارش بزنه
            }
        });

        // بستن
        modalBody.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => {
                document.removeEventListener('click', closeHandler);
                this.closeModal();
            });
        });
    },

    showLogin() {
        document.getElementById('loginView').classList.remove('hidden');
        document.getElementById('appView').classList.add('hidden');
        const pw = document.getElementById('password');
        if (pw) pw.value = '';
    },

    showApp() {
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('appView').classList.remove('hidden');

        const u = this.state.user || {};
        const initial = (u.fullName || u.username || '?').charAt(0);

        // Topbar user
        document.getElementById('userAvatar').textContent = initial;
        document.getElementById('userName').textContent = u.fullName || u.username || '-';
        document.getElementById('userMeta').textContent =
            `${u.orgName || ''} - ${u.fyName || ''}`;

        // ⭐ Sidebar user mini
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarOrg = document.getElementById('sidebarUserOrg');
        const sidebarSubtitle = document.getElementById('sidebarSubtitle');

        if (sidebarAvatar) sidebarAvatar.textContent = initial;
        if (sidebarName) sidebarName.textContent = u.fullName || u.username || '-';
        if (sidebarOrg) sidebarOrg.textContent = u.orgName || '';
        if (sidebarSubtitle && u.dbName) sidebarSubtitle.textContent = u.dbName;
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
            tafzili: 'تفضیلی‌ها',
            article: 'کالاها',
            sharh: 'شرح‌ها',
            kind: 'انواع سند'
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
            case 'factor': window.App.Features.Factor.render(); break;
            case 'article': window.App.Features.Article.render(); break;
            case 'hesab': window.App.Features.Hesab.render(); break;
            case 'tafzili': window.App.Features.Tafzili.render(); break;
            case 'sharh': window.App.Features.Sharh.render(); break;
            case 'kind': window.App.Features.Kind.render(); break;
        }
    },

 
    // ═══════════════════════════════════════════
    //  MODAL & TOAST
    // ═══════════════════════════════════════════
    openModal(title, bodyHtml) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHtml;
        document.getElementById('modal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modal').classList.add('hidden');
    },

    toast(message, type = '') {
        const el = document.getElementById('toast');
        el.textContent = message;
        el.className = 'toast ' + type;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 3000);
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
        if (n == null || n === '') return '-';
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

});

// شروع
document.addEventListener('DOMContentLoaded', () => window.App.init());
