/* ═══════════════════════════════════════════════════
   Ariana API - Client App
   ═══════════════════════════════════════════════════ */

const App = {

    // ═══════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════
    state: {
        token: null,
        refreshToken: null,
        user: null,
        apiKey: null,
        currentPage: 'dashboard',
        sanadPage: 1,
        // ⭐ تنظیمات سراسری
        settings: {pageSize: 10 }
    },

    baseUrl: '',

    // ═══════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════
    init() {
        this.baseUrl = window.location.origin;
        this.initNavGroups();

        // بازیابی از localStorage
        const saved = localStorage.getItem('ariana_auth');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.state.token = data.token;
                this.state.refreshToken = data.refreshToken;
                this.state.user = data.user;
                this.state.apiKey = data.apiKey;
            } catch (e) { /* ignore */ }
        }
        // ⭐ بارگذاری تنظیمات
        const savedSettings = localStorage.getItem('ariana_settings');
        if (savedSettings) {
            try {
                const data = JSON.parse(savedSettings);
                this.state.settings = { ...this.state.settings, ...data };
            } catch (e) { /* ignore */ }
        }

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
        localStorage.removeItem('ariana_auth');
        this.state.token = null;
        this.state.refreshToken = null;
        this.state.user = null;
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
                this.loadSanadList();
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
            case 'dashboard': this.renderDashboard(); break;
            case 'sanad': this.renderSanadList(); break;
            case 'taraz': this.renderTaraz(); break;
            case 'ledger': this.renderLedger(); break;
            case 'profitloss': this.renderProfitLoss(); break;
            case 'bilan': this.renderBilan(); break;
            case 'daybook': this.renderDayBook(); break;
            case 'factor': this.renderFactorList(); break;
            case 'hesab': this.renderHesab(); break;
            case 'tafzili': this.renderTafziliList(); break;
            case 'article': this.renderArticleList(); break;
            case 'sharh': this.renderSharh(); break;
            case 'kind': this.renderKindSanad(); break;
        }
    },

    // ═══════════════════════════════════════════
    //  PROFIT & LOSS (سود و زیان)
    // ═══════════════════════════════════════════
    renderProfitLoss() {
        const c = document.getElementById('content');
        c.innerHTML = `
        <div class="card">
            <div class="card-title">⚙️ تنظیمات گزارش سود و زیان</div>

            <div class="filters">
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="plFromDate" placeholder="1404/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="plToDate" placeholder="1404/12/29">
                </div>
                <div class="form-group">
                    <label>نمایش</label>
                    <div class="custom-select" id="plZeroWrap">
                        <button type="button" class="custom-select-trigger" id="plZeroTrigger">
                            <span class="custom-select-value">فقط دارای گردش</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="plZeroMenu">
                            <div class="custom-select-option selected" data-value="false">فقط دارای گردش</div>
                            <div class="custom-select-option" data-value="true">نمایش همه (حتی صفر)</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="plBtnRun">
                        💰 تهیه گزارش
                    </button>
                </div>
            </div>
        </div>

        <div id="plResult">
            <div class="empty">
                <div class="empty-icon">💰</div>
                <p>بازه تاریخ را وارد کنید و روی «تهیه گزارش» بزنید</p>
            </div>
        </div>
    `;

        // Custom Select
        this._plIncludeZero = false;
        const wrap = document.getElementById('plZeroWrap');
        const trigger = document.getElementById('plZeroTrigger');
        const menu = document.getElementById('plZeroMenu');
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this._plIncludeZero = opt.dataset.value === 'true';
                valueEl.textContent = opt.textContent.trim();
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
            });
        });

        document.getElementById('plBtnRun').addEventListener('click', () => this.runProfitLoss());
    },

    async runProfitLoss() {
        const btn = document.getElementById('plBtnRun');
        btn.disabled = true;
        btn.textContent = 'در حال تهیه...';

        const fromDate = document.getElementById('plFromDate').value || null;
        const toDate = document.getElementById('plToDate').value || null;

        try {
            // ⭐ همون مسیری که ProfitLossController تو داره
            let url = `/api/orgs/${this.state.user.orgId}/fy/${this.state.user.fyId}/reports/profit-loss`;
            const params = [];
            if (fromDate) params.push('fromDate=' + encodeURIComponent(fromDate));
            if (toDate) params.push('toDate=' + encodeURIComponent(toDate));
            if (this._plIncludeZero) params.push('includeZeroBalance=true');
            if (params.length) url += '?' + params.join('&');

            const result = await this.api(url);
            this.renderProfitLossResult(result);
        } catch (err) {
            document.getElementById('plResult').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '💰 تهیه گزارش';
        }
    },
    // ═══════════════════════════════════════════
    //  BILAN (ترازنامه)
    // ═══════════════════════════════════════════
    renderBilan() {
        const c = document.getElementById('content');
        c.innerHTML = `
    <div class="card">
        <div class="card-title">⚙️ تنظیمات ترازنامه</div>
        <div class="filters">
            <div class="form-group">
                <label>از تاریخ</label>
                <input type="text" id="blFromDate" placeholder="1404/01/01">
            </div>
            <div class="form-group">
                <label>تا تاریخ</label>
                <input type="text" id="blToDate" placeholder="1404/12/29">
            </div>
            <div class="form-group">
                <label>نمایش</label>
                <div class="custom-select" id="blZeroWrap">
                    <button type="button" class="custom-select-trigger" id="blZeroTrigger">
                        <span class="custom-select-value">فقط دارای گردش</span>
                        <span class="custom-select-arrow">▼</span>
                    </button>
                    <div class="custom-select-menu" id="blZeroMenu">
                        <div class="custom-select-option selected" data-value="false">فقط دارای گردش</div>
                        <div class="custom-select-option" data-value="true">نمایش همه (حتی صفر)</div>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn btn-primary btn-block" id="blBtnRun">⚖️ تهیه ترازنامه</button>
            </div>
        </div>
    </div>
    <div id="blResult">
        <div class="empty">
            <div class="empty-icon">⚖️</div>
            <p>بازه تاریخ را وارد کنید و روی «تهیه ترازنامه» بزنید</p>
        </div>
    </div>
    `;

        this._blIncludeZero = false;
        const wrap = document.getElementById('blZeroWrap');
        const trigger = document.getElementById('blZeroTrigger');
        const menu = document.getElementById('blZeroMenu');
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this._blIncludeZero = opt.dataset.value === 'true';
                valueEl.textContent = opt.textContent.trim();
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
            });
        });

        document.getElementById('blBtnRun').addEventListener('click', () => this.runBilan());
    },

    async runBilan() {
        const btn = document.getElementById('blBtnRun');
        btn.disabled = true;
        btn.textContent = 'در حال تهیه...';

        const fromDate = document.getElementById('blFromDate').value || null;
        const toDate = document.getElementById('blToDate').value || null;

        try {
            let url = `/api/orgs/${this.state.user.orgId}/fy/${this.state.user.fyId}/reports/bilan`;
            const params = [];
            if (fromDate) params.push('fromDate=' + encodeURIComponent(fromDate));
            if (toDate) params.push('toDate=' + encodeURIComponent(toDate));
            if (this._blIncludeZero) params.push('includeZeroBalance=true');
            if (params.length) url += '?' + params.join('&');

            const result = await this.api(url);
            this.renderBilanResult(result);
        } catch (err) {
            document.getElementById('blResult').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '⚖️ تهیه ترازنامه';
        }
    },

    renderBilanResult(data) {
        const container = document.getElementById('blResult');

        if ((!data.assets || data.assets.length === 0) &&
            (!data.liabilities || data.liabilities.length === 0)) {
            container.innerHTML = `
        <div class="empty">
            <div class="empty-icon">📭</div>
            <p>داده‌ای برای این بازه یافت نشد</p>
        </div>`;
            return;
        }

        // ─── رندر یک گروه ───
        const renderGroup = (g) => {
            const isAsset = g.nature === 'asset';
            const headerBg = isAsset ? '#DBEAFE' : '#FEF3C7';
            const headerColor = isAsset ? '#1E40AF' : '#92400E';

            const rows = (g.items || []).map(it => `
        <tr>
            <td class="num text-center">${it.codeCol}</td>
            <td>${this.esc(it.hesabName)}</td>
            <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
            <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
            <td class="num text-left" style="font-weight:600;">${this.fmt(Math.abs(it.mabMan))}</td>
        </tr>
        `).join('');

            return `
        <div class="card" style="padding:0; overflow:hidden; margin-bottom:12px;">
            <div style="padding:10px 15px; background:${headerBg}; color:${headerColor}; font-weight:700; font-size:14px;">
                ${this.esc(g.groupTypeName)}
            </div>
            <div class="table-wrapper" style="border:none; border-radius:0;">
                <table>
                    <thead>
                        <tr>
                            <th style="width:80px;">کد کل</th>
                            <th>نام حساب</th>
                            <th class="text-left" style="width:150px;">بدهکار</th>
                            <th class="text-left" style="width:150px;">بستانکار</th>
                            <th class="text-left" style="width:150px;">مانده</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#F1F5F9; font-weight:700;">
                            <td colspan="2" class="text-center">جمع ${this.esc(g.groupTypeName)}</td>
                            <td class="num text-left">${this.fmt(g.totalMabBed)}</td>
                            <td class="num text-left">${this.fmt(g.totalMabBes)}</td>
                            <td class="num text-left">${this.fmt(Math.abs(g.total))}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>`;
        };

        const assetsHtml = (data.assets || []).map(renderGroup).join('');
        const liabilitiesHtml = (data.liabilities || []).map(renderGroup).join('');

        const isBalanced = data.isBalanced;
        const diffColor = isBalanced ? '#059669' : '#DC2626';

        // ─── کارت خلاصه ───
        const summaryHtml = `
    <div class="card" style="background:linear-gradient(135deg,#F9FAFB,#EEF2FF); border:2px solid #C7D2FE; margin-bottom:16px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:16px;">
            <div style="text-align:center; padding:16px; background:white; border-radius:10px;">
                <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">جمع دارایی‌ها</div>
                <div style="font-size:20px; font-weight:700; color:#1E40AF; direction:ltr;">
                    ${this.fmt(data.totalAssets)}
                </div>
            </div>
            <div style="text-align:center; padding:16px; background:white; border-radius:10px;">
                <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">جمع بدهی‌ها</div>
                <div style="font-size:20px; font-weight:700; color:#92400E; direction:ltr;">
                    ${this.fmt(data.totalLiabilities)}
                </div>
            </div>
            <div style="text-align:center; padding:16px; background:white; border-radius:10px; border:2px solid ${diffColor};">
                <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">تفاوت</div>
                <div style="font-size:20px; font-weight:700; color:${diffColor}; direction:ltr;">
                    ${this.fmt(Math.abs(data.difference))}
                </div>
                <div style="font-size:12px; color:${diffColor}; margin-top:4px;">${this.esc(data.resultText)}</div>
            </div>
        </div>
    </div>`;

        container.innerHTML = `
    ${summaryHtml}
    ${assetsHtml ? `<div style="margin-bottom:8px;"><h3 style="margin-bottom:8px; color:#1E40AF;">🏦 دارایی‌ها</h3>${assetsHtml}</div>` : ''}
    ${liabilitiesHtml ? `<div style="margin-top:16px;"><h3 style="margin-bottom:8px; color:#92400E;">📋 بدهی‌ها</h3>${liabilitiesHtml}</div>` : ''}
    `;

        // ─── دکمه‌های خروجی ───
        const self = this;
        Exporter.attach(container, {
            title: 'ترازنامه (بیلان)',
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: 'Bilan',
            customHtml: () => self.buildBilanPrintHtml(data)
        });
    },

    buildBilanPrintHtml(data) {
        const renderGroupBlock = (g) => {
            const rows = (g.items || []).map(it => `
        <tr>
            <td class="num text-center">${it.codeCol}</td>
            <td>${this.esc(it.hesabName)}</td>
            <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
            <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
            <td class="num text-left">${this.fmt(Math.abs(it.mabMan))}</td>
        </tr>
        `).join('');

            return `
        <div class="section-title">${this.esc(g.groupTypeName)}</div>
        <table>
            <thead>
                <tr>
                    <th style="width:80px;">کد کل</th>
                    <th>نام حساب</th>
                    <th class="text-left" style="width:140px;">بدهکار</th>
                    <th class="text-left" style="width:140px;">بستانکار</th>
                    <th class="text-left" style="width:140px;">مانده</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr>
                    <td colspan="2" class="text-center">جمع ${this.esc(g.groupTypeName)}</td>
                    <td class="num text-left">${this.fmt(g.totalMabBed)}</td>
                    <td class="num text-left">${this.fmt(g.totalMabBes)}</td>
                    <td class="num text-left">${this.fmt(Math.abs(g.total))}</td>
                </tr>
            </tfoot>
        </table>`;
        };

        const assetsBlock = (data.assets || []).map(renderGroupBlock).join('');
        const liabilitiesBlock = (data.liabilities || []).map(renderGroupBlock).join('');
        const diffColor = data.isBalanced ? '#059669' : '#DC2626';

        return `
    <table class="factor-info-table">
        <tr>
            <td class="label">از تاریخ:</td>
            <td>${this.esc(data.fromDate || 'ابتدا')}</td>
            <td class="label">تا تاریخ:</td>
            <td>${this.esc(data.toDate || 'انتها')}</td>
        </tr>
    </table>

    ${assetsBlock ? `<div class="section-title">🏦 دارایی‌ها</div>${assetsBlock}` : ''}
    ${liabilitiesBlock ? `<div class="section-title">📋 بدهی‌ها</div>${liabilitiesBlock}` : ''}

    <div class="section-title">📊 خلاصه ترازنامه</div>
    <table>
        <tr>
            <td class="label" style="width:180px;">جمع دارایی‌ها:</td>
            <td class="num text-left" style="color:#1E40AF; font-weight:700;">${this.fmt(data.totalAssets)}</td>
        </tr>
        <tr>
            <td class="label">جمع بدهی‌ها:</td>
            <td class="num text-left" style="color:#92400E; font-weight:700;">${this.fmt(data.totalLiabilities)}</td>
        </tr>
        <tr style="background:#EEF2FF;">
            <td class="label" style="font-weight:700;">تفاوت:</td>
            <td class="num text-left" style="color:${diffColor}; font-weight:700;">
                ${this.fmt(Math.abs(data.difference))} — ${this.esc(data.resultText)}
            </td>
        </tr>
    </table>
    `;
    },
  

    
///////////

renderProfitLossResult(data) {
        const container = document.getElementById('plResult');

        if ((!data.revenues || data.revenues.length === 0) &&
            (!data.expenses || data.expenses.length === 0)) {
            container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📭</div>
                <p>داده‌ای برای این بازه یافت نشد</p>
            </div>`;
            return;
        }

        // ─── گروه‌ها ───
        const renderGroup = (g) => {
            const isRevenue = g.nature === 'revenue';
            const cls = isRevenue ? 'revenue' : 'expense';
            const headerBg = isRevenue ? '#DCFCE7' : '#FEE2E2';
            const headerColor = isRevenue ? '#166534' : '#991B1B';

            const rows = (g.items || []).map(it => `
            <tr>
                <td class="num text-center">${it.codeCol}</td>
                <td>${this.esc(it.hesabName)}</td>
                <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
                <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
                <td class="num text-left" style="font-weight:600;">${this.fmt(Math.abs(it.mabMan))}</td>
            </tr>
        `).join('');

            return `
            <div class="card" style="padding:0; overflow:hidden;">
                <div style="padding:10px 15px; background:${headerBg}; color:${headerColor}; font-weight:700; font-size:14px;">
                    ${this.esc(g.groupTypeName)}
                </div>
                <div class="table-wrapper" style="border:none; border-radius:0;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:80px;">کد کل</th>
                                <th>نام حساب</th>
                                <th class="text-left" style="width:150px;">بدهکار</th>
                                <th class="text-left" style="width:150px;">بستانکار</th>
                                <th class="text-left" style="width:150px;">مانده</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                        <tfoot>
                            <tr style="background:#F1F5F9; font-weight:700;">
                                <td colspan="2" class="text-center">جمع ${this.esc(g.groupTypeName)}</td>
                                <td class="num text-left">${this.fmt(g.totalMabBed)}</td>
                                <td class="num text-left">${this.fmt(g.totalMabBes)}</td>
                                <td class="num text-left">${this.fmt(Math.abs(g.total))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
        };

        const revenuesHtml = (data.revenues || []).map(renderGroup).join('');
        const expensesHtml = (data.expenses || []).map(renderGroup).join('');

        // ─── کارت سود/زیان ───
        const netClass = data.resultType === 'profit' ? 'success' :
            data.resultType === 'loss' ? 'danger' : 'warning';
        const netColor = data.resultType === 'profit' ? '#059669' :
            data.resultType === 'loss' ? '#DC2626' : '#6B7280';

        const summaryHtml = `
        <div class="card" style="background:linear-gradient(135deg,#F9FAFB,#EEF2FF); border:2px solid #C7D2FE;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:16px;">
                <div style="text-align:center; padding:16px; background:white; border-radius:10px;">
                    <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">جمع درآمدها</div>
                    <div style="font-size:20px; font-weight:700; color:#059669; direction:ltr;">
                        ${this.fmt(data.totalRevenue)}
                    </div>
                </div>
                <div style="text-align:center; padding:16px; background:white; border-radius:10px;">
                    <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">جمع هزینه‌ها</div>
                    <div style="font-size:20px; font-weight:700; color:#DC2626; direction:ltr;">
                        ${this.fmtAcc(data.totalExpense)}
                    </div>
                </div>
                <div style="text-align:center; padding:16px; background:white; border-radius:10px; border:2px solid ${netColor};">
                    <div style="font-size:13px; color:#6B7280; margin-bottom:6px;">${this.esc(data.resultText)}</div>
                    <div style="font-size:22px; font-weight:700; color:${netColor}; direction:ltr;">
                        ${this.fmt(Math.abs(data.netProfit))}
                    </div>
                </div>
            </div>
        </div>
    `;

        container.innerHTML = `
        ${summaryHtml}
        ${revenuesHtml ? `<div style="margin-top:16px;"><h3 style="margin-bottom:12px; color:#166534;">💰 درآمدها</h3>${revenuesHtml}</div>` : ''}
        ${expensesHtml ? `<div style="margin-top:16px;"><h3 style="margin-bottom:12px; color:#991B1B;">💸 هزینه‌ها</h3>${expensesHtml}</div>` : ''}
    `;

        // ─── دکمه‌های خروجی ───
        const self = this;
        Exporter.attach(container, {
            title: 'گزارش سود و زیان',
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: 'ProfitLoss',
            customHtml: () => self.buildProfitLossHtml(data)
        });
    },

buildProfitLossHtml(data) {
        const renderGroupBlock = (g) => {
            const isRevenue = g.nature === 'revenue';
            const rows = (g.items || []).map(it => `
            <tr>
                <td class="num text-center">${it.codeCol}</td>
                <td>${this.esc(it.hesabName)}</td>
                <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
                <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
                <td class="num text-left">${this.fmt(Math.abs(it.mabMan))}</td>
            </tr>
        `).join('');

            return `
            <div class="section-title">${this.esc(g.groupTypeName)}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:80px;">کد کل</th>
                        <th>نام حساب</th>
                        <th class="text-left" style="width:140px;">بدهکار</th>
                        <th class="text-left" style="width:140px;">بستانکار</th>
                        <th class="text-left" style="width:140px;">مانده</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" class="text-center">جمع ${this.esc(g.groupTypeName)}</td>
                        <td class="num text-left">${this.fmt(g.totalMabBed)}</td>
                        <td class="num text-left">${this.fmt(g.totalMabBes)}</td>
                        <td class="num text-left">${this.fmt(Math.abs(g.total))}</td>
                    </tr>
                </tfoot>
            </table>
        `;
        };

        const revenuesBlock = (data.revenues || []).map(renderGroupBlock).join('');
        const expensesBlock = (data.expenses || []).map(renderGroupBlock).join('');

        const netColor = data.resultType === 'profit' ? '#059669' :
            data.resultType === 'loss' ? '#DC2626' : '#6B7280';

        return `
        <table class="factor-info-table">
            <tr>
                <td class="label">از تاریخ:</td>
                <td>${this.esc(data.fromDate || 'ابتدا')}</td>
                <td class="label">تا تاریخ:</td>
                <td>${this.esc(data.toDate || 'انتها')}</td>
            </tr>
        </table>

        ${revenuesBlock ? `<div class="section-title">💰 درآمدها</div>${revenuesBlock}` : ''}
        ${expensesBlock ? `<div class="section-title">💸 هزینه‌ها</div>${expensesBlock}` : ''}

        <div class="section-title">📊 خلاصه سود و زیان</div>
        <table>
            <tr>
                <td class="label" style="width:180px;">جمع درآمدها:</td>
                <td class="num text-left" style="color:#059669; font-weight:700;">${this.fmt(data.totalRevenue)}</td>
            </tr>
            <tr>
                <td class="label">جمع هزینه‌ها:</td>
                <td class="num text-left" style="color:#DC2626; font-weight:700;">${this.fmt(data.totalExpense)}</td>
            </tr>
            <tr style="background:#EEF2FF;">
                <td class="label" style="font-weight:700;">${this.esc(data.resultText)}:</td>
                <td class="num text-left" style="color:${netColor}; font-weight:700; font-size:14px;">
                    ${this.fmt(Math.abs(data.netProfit))}
                </td>
            </tr>
        </table>
    `;
    },
    // ═══════════════════════════════════════════
    //  DASHBOARD
    // ═══════════════════════════════════════════
    async renderDashboard() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>`;

        // ⭐ ذخیره‌ی chart ها برای destroy
        if (this._dashCharts) {
            this._dashCharts.forEach(ch => { try { ch.destroy(); } catch (e) { } });
        }
        this._dashCharts = [];

        try {
            const stats = await this.api('/api/dashboard/stats');
            const u = this.state.user || {};

            c.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon purple">📄</div>
                    <div>
                        <div class="stat-value">${this.fmt(stats.totalSanads)}</div>
                        <div class="stat-label">کل اسناد</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">🧾</div>
                    <div>
                        <div class="stat-value">${this.fmt(stats.totalFactors)}</div>
                        <div class="stat-label">کل فاکتورها</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange">🏦</div>
                    <div>
                        <div class="stat-value">${this.fmt(stats.totalHesabs)}</div>
                        <div class="stat-label">حساب‌های کل</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon blue">👥</div>
                    <div>
                        <div class="stat-value">${this.fmt(stats.totalTafzilis)}</div>
                        <div class="stat-label">حساب‌های تفضیلی</div>
                    </div>
                </div>
            </div>

            <div class="dash-charts">
                <div class="card">
                    <div class="card-title">
                        <span>🧾 فاکتورها</span>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="chartFactors"></canvas>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title">
                        <span>📄 اسناد</span>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="chartSanads"></canvas>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title">
                        <span>🏦 گروه‌های حساب</span>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="chartGroups"></canvas>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">🔗 اطلاعات اتصال</div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">سازمان</span>
                        <span class="info-value">
                            ${this.esc(u.orgName || '-')}
                            <span class="info-meta">(کد ${u.orgId})</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">دوره مالی</span>
                        <span class="info-value">
                            ${this.esc(u.fyName || '-')}
                            <span class="info-meta">(کد ${u.fyId})</span>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">دیتابیس</span>
                        <span class="info-value">
                            <code class="db-code">${this.esc(u.dbName || '-')}</code>
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">کاربر</span>
                        <span class="info-value">
                            ${this.esc(u.fullName || u.username || '-')}
                            <span class="info-meta">(${this.esc(u.username || '')})</span>
                        </span>
                    </div>
                </div>
            </div>
        `;

            // ⭐ رسم نمودارها
            this._renderPieChart('chartFactors', stats.factorsByKind || []);
            this._renderPieChart('chartSanads', stats.sanadsByVazeit || []);
            this._renderPieChart('chartGroups', stats.accountsByGroupType || []);

        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    // ⭐ رنگ‌های دلخواه برای نمودار
    _chartColors: [
        '#4F46E5', // بنفش
        '#10B981', // سبز
        '#F59E0B', // نارنجی
        '#EF4444', // قرمز
        '#3B82F6', // آبی
        '#8B5CF6', // بنفش روشن
        '#EC4899', // صورتی
        '#14B8A6', // فیروزه‌ای
        '#EAB308', // زرد
        '#6366F1', // نیلی
        '#F97316', // نارنجی تیره
        '#06B6D4'  // آبی روشن
    ],

    // ⭐ رسم نمودار دایره‌ای
    _renderPieChart(canvasId, items) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (!items || items.length === 0) {
            const parent = canvas.parentElement;
            parent.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>داده‌ای برای نمایش نیست</p></div>`;
            return;
        }

        // ⭐ آیا این نمودار مبلغ هست؟
        const isMoney = items[0].isMoney === true;

        const labels = items.map(x => x.label);
        const values = items.map(x => Number(x.value) || 0);
        const colors = items.map((_, idx) => this._chartColors[idx % this._chartColors.length]);

        // ⭐ فرمت‌کننده‌ی مقدار
        const formatValue = (v) => {
            const num = Number(v) || 0;
            if (isMoney) {
                return this.fmt(Math.round(num));   // مبلغ با جداکننده هزار
            }
            return this.fmt(num);                   // تعداد
        };

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true,
                        textDirection: 'rtl',
                        labels: {
                            font: {
                                family: 'Tahoma, Vazirmatn, sans-serif',
                                size: 10
                            },
                            padding: 8,
                            boxWidth: 10,           // ← مربع رنگی کوچیک‌تر
                            boxHeight: 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            generateLabels: (chart) => {
                                const data = chart.data;
                                if (!data.labels || !data.labels.length) return [];

                                return data.labels.map((label, i) => {
                                    const val = Number(data.datasets[0].data[i]) || 0;
                                    return {
                                        text: `${label} — ${formatValue(val)}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].backgroundColor[i],
                                        lineWidth: 0,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        rtl: true,
                        textDirection: 'rtl',
                        titleFont: {
                            family: 'Tahoma, Vazirmatn, sans-serif'
                        },
                        bodyFont: {
                            family: 'Tahoma, Vazirmatn, sans-serif'
                        },
                        callbacks: {
                            label: (ctx) => {
                                const val = Number(ctx.parsed) || 0;
                                return ` ${ctx.label}: ${formatValue(val)}`;
                            }
                        }
                    }
                }
            }
        });

        this._dashCharts.push(chart);
    },
    // ═══════════════════════════════════════════
    //  SANAD (اسناد)
    // ═══════════════════════════════════════════
    async renderSanadList() {
        const c = document.getElementById('content');
        c.innerHTML = `<div id="sanadFilters"></div>
                   <div id="sanadListContainer"><div class="loading"><div class="spinner"></div></div></div>`;

        FilterPanel.render(document.getElementById('sanadFilters'), {
            pageKey: 'sanad',
            runButtonText: '🔍 جستجوی اسناد',
            sections: [
                {
                    title: 'بازه تاریخی و شماره',
                    icon: '📅',
                    cols: 4,
                    fields: [
                        { name: 'fromDate', label: 'از تاریخ', type: 'date' },
                        { name: 'toDate', label: 'تا تاریخ', type: 'date' },
                        { name: 'noFrom', label: 'از شماره', type: 'number', placeholder: '۱' },
                        { name: 'noTo', label: 'تا شماره', type: 'number' },
                    ]
                },
                {
                    title: 'وضعیت و نوع',
                    icon: '🏷️',
                    cols: 4,
                    fields: [
                        {
                            name: 'vazeit', label: 'وضعیت سند', type: 'select',
                            placeholder: 'همه', ignoreValue: null,
                            options: [
                                { value: '0', label: 'پیش‌نویس' },
                                { value: '1', label: 'ثبت شده' },
                                { value: '2', label: 'تأیید شده' },
                            ]
                        },
                        {
                            name: 'kindSanad', label: 'نوع سند', type: 'select',
                            placeholder: 'همه',
                            options: [
                                { value: '0', label: 'عادی' },
                                { value: '1', label: 'افتتاحیه' },
                                { value: '2', label: 'اختتامیه' },
                            ]
                        },
                    ]
                }
            ],
            onRun: (values) => {
                this._sanadFilters = values;
                this.state.sanadPage = 1;
                this.loadSanadList();
            }
        });

        // اجرای اولیه
        this._sanadFilters = FilterPanel.getValues();
        this.loadSanadList();
    },

    async loadSanadList() {
        
        const container = document.getElementById('sanadListContainer');
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const f = this._sanadFilters || {};

            // ⬇️ بقیه دقیقاً همونه، فقط اسم متغیرها f.xxx شده
            const pageSize = this.state.settings.pageSize;
            let url = `/api/sanad?page=${this.state.sanadPage}&pageSize=${pageSize}`;
            if (f.fromDate) url += `&fromDate=${encodeURIComponent(f.fromDate)}`;
            if (f.toDate) url += `&toDate=${encodeURIComponent(f.toDate)}`;
            if (f.noFrom != null) url += `&noFrom=${f.noFrom}`;
            if (f.noTo != null) url += `&noTo=${f.noTo}`;
            if (f.vazeit != null) url += `&vazeit=${f.vazeit}`;         // ⭐ وضعیت
            if (f.kindSanad != null) url += `&kindSanad=${f.kindSanad}`; // ⭐ نوع سند ← اضافه شد


            const data = await this.api(url);
            const items = data || [];

            if (items.length === 0) {
                container.innerHTML = `
                    <div class="empty">
                        <div class="empty-icon">📭</div>
                        <p>سندی یافت نشد</p>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <div class="card">
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>شماره</th>
                                    <th>تاریخ</th>
                                    <th>شرح</th>
                                    <th>وضعیت</th>
                                    <th>نوع</th>
                                    <th class="text-left">بدهکار</th>
                                    <th class="text-left">بستانکار</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(s => `
                                    <tr>
                                        <td class="num">${this.fmt(s.noSanad)}</td>
                                        <td class="num">${this.esc(s.dateIn || '-')}</td>
                                        <td>${this.esc(s.otherParentSharh || '-')}</td>
                                        <td>${this.statusBadge(s.vazeit)}</td>
                                        <td>${this._kindSanadText(s.kindSanad)}</td>
                                        <td class="num text-left">${this.fmt(s.mabBed)}</td>
                                        <td class="num text-left">${this.fmt(s.mabBes)}</td>
                                        <td>
                                            <button class="btn btn-sm btn-ghost"
                                                    onclick="App.showSanadDetail(${s.parentSanadID})">
                                                مشاهده
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="pagination">
                    <button ${this.state.sanadPage <= 1 ? 'disabled' : ''}
                            onclick="App.gotoSanadPage(${this.state.sanadPage - 1})">قبلی</button>
                    <span>صفحه ${this.state.sanadPage}</span>
                    <button ${items.length < pageSize ? 'disabled' : ''}
                            onclick="App.gotoSanadPage(${this.state.sanadPage + 1})">بعدی</button>
                </div>
            `;

            // ⭐ دکمه‌های Excel و چاپ — فقط یک خط!
            Exporter.attach(container, {
                table: container.querySelector('table'),
                title: 'لیست اسناد حسابداری',
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: 'SanadList'
            });
            this.enhanceTables(container);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    gotoSanadPage(page) {
        if (page < 1) return;
        this.state.sanadPage = page;
        this.loadSanadList();
    },

    async showSanadDetail(sanadId) {
        if (!sanadId) return;
        this.openModal('جزئیات سند', `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const [detail, items] = await Promise.all([
                this.api(`/api/sanad/${sanadId}`),
                this.api(`/api/sanad/${sanadId}/items`)
            ]);

            const rows = (items || []).map(it => `
                <tr>
                    <td class="num text-center">${this.fmt(it.rowNum)}</td>
                    <td class="num text-center">${it.code_Col ?? '-'}</td>
                    <td>${this.esc(it.colName || '-')}</td>
                    <td class="num text-center">${it.code_Moein || '-'}</td>
                    <td>${this.esc(it.moeinName || '-')}</td>
                    <td class="num text-center">${it.code_Tafzil || '-'}</td>
                    <td>${this.esc(it.tafzilName || '-')}</td>
                    <td>${this.esc(it.otherSharh || '-')}</td>
                    <td class="num text-left">${this.fmt(it.mabBed)}</td>
                    <td class="num text-left">${this.fmt(it.mabBes)}</td>
                    <td class="num text-left">${this.fmtSigned(it.meghdar)}</td>
                </tr>
            `).join('');

            document.getElementById('modalBody').innerHTML = `
                 <div class="stats-grid" style="margin-bottom:16px;">
                <div class="stat-card">
                    <div>
                        <div class="stat-label">شماره سند</div>
                        <div class="stat-value">${this.fmt(detail?.noSanad)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">تاریخ</div>
                        <div class="stat-value">${detail?.dateIn || '-'}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">وضعیت</div>
                        <div class="stat-value">${this.statusBadge(detail?.vazeit)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">نوع سند</div>
                        <div class="stat-value" style="font-size:16px;">
                            ${this._kindSanadText(detail?.kindSanad)}
                        </div>
                    </div>
                </div>
            </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:40px;">ردیف</th>
                                <th style="width:50px;">کد کل</th>
                                <th>نام کل</th>
                                <th style="width:50px;">معین</th>
                                <th>نام معین</th>
                                <th style="width:60px;">تفصیلی</th>
                                <th>نام تفصیلی</th>
                                <th>شرح</th>
                                <th class="text-left" style="width:100px;">بدهکار</th>
                                <th class="text-left" style="width:100px;">بستانکار</th>
                                <th class="text-left" style="width:80px;">مقدار</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="11" class="text-center">ردیفی وجود ندارد</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;

            // ⭐ دکمه‌های Excel و چاپ با HTML کامل
            const modalBody = document.getElementById('modalBody');
            const self = this;
            Exporter.attach(modalBody, {
                title: 'سند حسابداری - شماره ' + (detail?.noSanad || ''),
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: 'Sanad_' + (detail?.noSanad || 'detail'),
                customHtml: () => self.buildSanadPrintHtml(detail, items)
            });
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
    },

    // ⭐ ساخت HTML کامل سند برای چاپ و Excel
    buildSanadPrintHtml(detail, items) {
        // ─── هدر سند ───
        const headerBlock = `
            <table class="factor-info-table">
                <tr>
                    <td class="label">شماره سند:</td>
                    <td>${detail?.noSanad || '-'}</td>
                    <td class="label">تاریخ سند:</td>
                    <td>${this.esc(detail?.dateIn || '-')}</td>
                    <td class="label">وضعیت:</td>
                    <td>${this._statusText(detail?.vazeit)}</td>
                    <td class="label">نوع سند:</td>
                    <td>${this._kindSanadText(detail?.kindSanad)}</td>
                </tr>
                <tr>
                    <td class="label">شرح سند:</td>
                    <td colspan="7">${this.esc(detail?.otherParentSharh || '-')}</td>
                </tr>
                ${(detail?.creator || detail?.confirmer || detail?.date_Op || detail?.time_Op) ? `
                <tr>
                    <td class="label">ایجادکننده:</td>
                    <td>${detail?.creator || '-'}</td>
                    <td class="label">تأییدکننده:</td>
                    <td>${detail?.confirmer || '-'}</td>
                    <td class="label">تاریخ/ساعت ثبت:</td>
                    <td colspan="3">${this.esc(detail?.date_Op || '')} ${this.esc(detail?.time_Op || '')}</td>
                </tr>` : ''}
            </table>
        `;

        // ─── اقلام سند ───
        const itemsRows = (items || []).map((it, idx) => `
            <tr>
                <td class="num text-center">${idx + 1}</td>
                <td class="num text-center">${it.code_Col ?? '-'}</td>
                <td>${this.esc(it.colName || '')}</td>
                <td class="num text-center">${it.code_Moein || '-'}</td>
                <td>${this.esc(it.moeinName || '')}</td>
                <td class="num text-center">${it.code_Tafzil || '-'}</td>
                <td>${this.esc(it.tafzilName || '')}</td>
                <td>${this.esc(it.otherSharh || '')}</td>
                <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
                <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
                <td class="num text-left">${this.fmtSigned(it.meghdar)}</td>
            </tr>
        `).join('');

        const totalBed = (items || []).reduce((s, x) => s + (x.mabBed || 0), 0);
        const totalBes = (items || []).reduce((s, x) => s + (x.mabBes || 0), 0);
        const totalMegh = (items || []).reduce((s, x) => s + (x.meghdar || 0), 0);

        const itemsBlock = `
            <div class="section-title">📋 ردیف‌های سند (${(items || []).length})</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:30px;">#</th>
                        <th style="width:50px;">کد کل</th>
                        <th>نام کل</th>
                        <th style="width:50px;">معین</th>
                        <th>نام معین</th>
                        <th style="width:60px;">تفصیلی</th>
                        <th>نام تفصیلی</th>
                        <th>شرح</th>
                        <th class="text-left" style="width:110px;">بدهکار</th>
                        <th class="text-left" style="width:110px;">بستانکار</th>
                        <th class="text-left" style="width:80px;">مقدار</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows || '<tr><td colspan="12" class="text-center">ردیفی وجود ندارد</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="8" class="text-center">جمع کل</td>
                        <td class="num text-left">${this.fmt(totalBed)}</td>
                        <td class="num text-left">${this.fmt(totalBes)}</td>
                        <td class="num text-left">${this.fmtSigned(totalMegh)}</td>
                    </tr>
                </tfoot>
            </table>
        `;

        return headerBlock + itemsBlock;
    },

    // helper — تبدیل وضعیت عددی به متن
    _statusText(v) {
        const map = { 0: 'پیش‌نویس', 1: 'ثبت شده', 2: 'تأیید شده', 3: 'برگشتی' };
        return map[v] ?? '-';
    },
    // helper — تبدیل نوع سند عددی به متن
    _kindSanadText(v) {
        const map = {
            0: 'عادی',
            1: 'افتتاحیه',
            2: 'اختتامیه',
            3: 'انبار',
            4: 'حقوق',
            5: 'اموال',
            6: 'فروش',
            7: 'انتقالی',
            8: 'خاص'
        };
        return map[v] ?? '-';
    },

    // ═══════════════════════════════════════════
    //  LEDGER (دفتر حساب)
    // ═══════════════════════════════════════════
    renderLedger() {
        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card">
                <div class="card-title">⚙️ تنظیمات گزارش</div>

                <div class="form-group">
                    <label>سطح گزارش</label>
                    <div class="radio-group">
                        <label class="radio-item">
                            <input type="radio" name="ledLevel" value="col" checked>
                            <span>کل</span>
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="ledLevel" value="moein">
                            <span>معین</span>
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="ledLevel" value="tafzil">
                            <span>تفضیلی 1</span>
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="ledLevel" value="tafzil2">
                            <span>تفضیلی 2</span>
                        </label>
                    </div>
                </div>

                <div class="filters">
                    <div class="form-group">
                        <label>از تاریخ</label>
                        <input type="text" id="ledFromDate" placeholder="1403/01/01">
                    </div>
                    <div class="form-group">
                        <label>تا تاریخ</label>
                        <input type="text" id="ledToDate" placeholder="1403/12/29">
                    </div>
                    <div class="form-group">
                        <label>از شماره سند</label>
                        <input type="number" id="ledNoFrom">
                    </div>
                    <div class="form-group">
                        <label>تا شماره سند</label>
                        <input type="number" id="ledNoTo">
                    </div>
                    <div class="form-group">
                        <label>وضعیت</label>
                        <select id="ledVazeit">
                            <option value="">همه</option>
                            <option value="0">پیش‌نویس</option>
                            <option value="1">رسیدگی</option>
                            <option value="2">قطعی</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>وضعیت ردیف</label>
                        <select id="ledTikRow">
                            <option value="">همه</option>
                            <option value="1">تیک‌دار</option>
                            <option value="0">بدون تیک</option>
                        </select>
                    </div>
                </div>

                <div class="filters" id="ledAccountFilters"></div>

                <button class="btn btn-primary" id="ledBtnRun" style="margin-top:12px;">
                    📊 تهیه گزارش
                </button>
            </div>

            <div id="ledResult">
                <div class="empty">
                    <div class="empty-icon">📒</div>
                    <p>تنظیمات را انتخاب کنید و دکمه «تهیه گزارش» را بزنید</p>
                </div>
            </div>
        `;

        this.buildLedgerAccountFilters('col');

        document.querySelectorAll('input[name="ledLevel"]').forEach(r => {
            r.addEventListener('change', (e) => this.buildLedgerAccountFilters(e.target.value));
        });

        document.getElementById('ledBtnRun').addEventListener('click', () => this.runLedger());
    },

    buildLedgerAccountFilters(level) {
        const box = document.getElementById('ledAccountFilters');
        let html = `
            <div class="form-group">
                <label>از کد کل</label>
                <input type="number" id="ledFromCodeCol">
            </div>
            <div class="form-group">
                <label>تا کد کل</label>
                <input type="number" id="ledToCodeCol">
            </div>
        `;

        if (level === 'moein' || level === 'tafzil' || level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>از کد معین</label>
                    <input type="number" id="ledFromCodeMoein">
                </div>
                <div class="form-group">
                    <label>تا کد معین</label>
                    <input type="number" id="ledToCodeMoein">
                </div>
            `;
        }

        if (level === 'tafzil' || level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>از کد تفصیلی 1</label>
                    <input type="number" id="ledFromCodeTafzil">
                </div>
                <div class="form-group">
                    <label>تا کد تفصیلی 1</label>
                    <input type="number" id="ledToCodeTafzil">
                </div>
            `;
        }

        if (level === 'tafzil2') {
            html += `
                <div class="form-group">
                    <label>کد تفصیلی 2</label>
                    <input type="number" id="ledCodeTafzili2">
                </div>
            `;
        }

        box.innerHTML = html;
    },

    async runLedger(page = 1) {
        const btn = document.getElementById('ledBtnRun');
        btn.disabled = true;
        btn.textContent = 'در حال تهیه...';

        const level = document.querySelector('input[name="ledLevel"]:checked').value;

        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const payload = {
            level,
            page: page,
            pageSize: this.state.settings.pageSize,
            fromDate: document.getElementById('ledFromDate').value || null,
            toDate: document.getElementById('ledToDate').value || null,
            noFrom: parseIntOrNull('ledNoFrom'),
            noTo: parseIntOrNull('ledNoTo'),
            vazeit: parseIntOrNull('ledVazeit'),
            tikRow: parseIntOrNull('ledTikRow'),
            fromCodeCol: parseIntOrNull('ledFromCodeCol'),
            toCodeCol: parseIntOrNull('ledToCodeCol'),
            fromCodeMoein: parseIntOrNull('ledFromCodeMoein'),
            toCodeMoein: parseIntOrNull('ledToCodeMoein'),
            fromCodeTafzil: parseIntOrNull('ledFromCodeTafzil'),
            toCodeTafzil: parseIntOrNull('ledToCodeTafzil'),
            codeTafzili2: parseIntOrNull('ledCodeTafzili2'),
            includeMandehBefore: false
        };

        try {
            const result = await this.api('/api/ledger', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            this.renderLedgerResult(result);
        } catch (err) {
            document.getElementById('ledResult').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '📊 تهیه گزارش';
        }
    },

    renderLedgerResult(data) {
        const container = document.getElementById('ledResult');
        const items = data.items || [];
        const level = data.level;

        if (items.length === 0) {
            container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📭</div>
                <p>موردی یافت نشد</p>
            </div>`;
            return;
        }

        // ─── ستون‌های کد بر اساس سطح ───
        let codeHeaders = `<th>کد کل</th><th>نام کل</th>`;
        if (level === 'moein' || level === 'tafzil' || level === 'tafzil2') {
            codeHeaders += `<th>کد معین</th><th>نام معین</th>`;
        }
        if (level === 'tafzil' || level === 'tafzil2') {
            codeHeaders += `<th>کد تفصیلی</th><th>نام تفصیلی</th>`;
        }
        if (level === 'tafzil2') {
            codeHeaders += `<th>کد تفصیلی 2</th><th>نام تفصیلی 2</th>`;
        }

        const codeColSpan = 2 + (level !== 'col' ? 2 : 0) + (level === 'tafzil' || level === 'tafzil2' ? 2 : 0) + (level === 'tafzil2' ? 2 : 0);

        // ─── ردیف‌ها ───
        const rows = items.map(it => {
            let codeCells = `
            <td class="num">${it.codeCol ?? ''}</td>
            <td>${this.esc(it.colName || '')}</td>
        `;
            if (level === 'moein' || level === 'tafzil' || level === 'tafzil2') {
                codeCells += `<td class="num">${it.codeMoein ?? ''}</td><td>${this.esc(it.moeinName || '')}</td>`;
            }
            if (level === 'tafzil' || level === 'tafzil2') {
                codeCells += `<td class="num">${it.codeTafzil ?? ''}</td><td>${this.esc(it.tafzilName || '')}</td>`;
            }
            if (level === 'tafzil2') {
                codeCells += `<td class="num">${it.codeTafzili2 ?? ''}</td><td>${this.esc(it.tafzili2Name || '')}</td>`;
            }

            const manValue = it.mabMan;
            const manBadge = manValue > 0 ? 'بس' : (manValue < 0 ? 'بد' : '');
            const manAbs = Math.abs(manValue);

            return `
                <tr class="clickable-row" onclick="App.showSanadDetail(${it.parentSanadID})" title="کلیک برای مشاهده سند">
                        <td class="num text-center">${this.fmt(it.noSanad)}</td>
                        <td class="num">${this.esc(it.dateIn || '')}</td>
                        ${codeCells}
                        <td>${this.esc(it.otherSharh || it.otherParentSharh || '')}</td>
                        <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
                        <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
                        <td class="num text-left">${this.fmtSigned(it.meghdar)}</td>
                        <td class="num text-left">
                            ${this.fmt(manAbs)}
                            ${manBadge ? `<span class="badge ${manValue > 0 ? 'badge-warning' : 'badge-info'}" style="margin-right:4px; font-size:10px;">${manBadge}</span>` : ''}
                        </td>
                    </tr>
                `;
        }).join('');

        const totalBes = data.totalMan > 0;
        const totalManAbs = Math.abs(data.totalMan);

        // ⭐ صفحه‌بندی
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        // ─── ساخت HTML دکمه‌های صفحه ───
        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) {
                startPage = Math.max(1, endPage - maxBtn + 1);
            }

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `
                <button class="page-btn ${p === page ? 'active' : ''}"
                        onclick="App.runLedger(${p})">${p}</button>
            `;
            }

            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${items.length.toLocaleString('fa-IR')} از ${totalCount.toLocaleString('fa-IR')} ردیف
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                            onclick="App.runLedger(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                            onclick="App.runLedger(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                            onclick="App.runLedger(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                            onclick="App.runLedger(${totalPages})">»</button>
                </div>
            </div>
        `;
        } else {
            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    مجموع: ${totalCount.toLocaleString('fa-IR')} ردیف
                </div>
            </div>
        `;
        }

        container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>📊 نتیجه گزارش (${items.length} ردیف از ${totalCount.toLocaleString('fa-IR')})</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:60px;">سند</th>
                            <th style="width:90px;">تاریخ</th>
                            ${codeHeaders}
                            <th>شرح</th>
                            <th class="text-left" style="width:110px;">بدهکار</th>
                            <th class="text-left" style="width:110px;">بستانکار</th>
                            <th class="text-left" style="width:80px;">مقدار</th>
                            <th class="text-left" style="width:130px;">مانده</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="${3 + codeColSpan - 2}" class="text-center">جمع این صفحه</td>
                        <td class="num text-left">${this.fmt(data.totalBed)}</td>
                        <td class="num text-left">${this.fmt(data.totalBes)}</td>
                        <td class="num text-left">${this.fmtSigned(items.reduce((s, x) => s + (x.meghdar || 0), 0))}</td>
                        <td class="num text-left">
                        </tr>
                    </tfoot>
                </table>
            </div>
            ${paginationHtml}
        </div>
    `;

        // ⭐ دکمه‌های Excel و چاپ — با پرچم ALL برای گرفتن کل داده
        const levelTitles = {
            col: 'دفتر کل',
            moein: 'دفتر معین',
            tafzil: 'دفتر تفصیلی 1',
            tafzil2: 'دفتر تفصیلی 2'
        };

        Exporter.attach(document.querySelector('#ledResult .card'), {
            title: levelTitles[level] || 'دفتر حساب',
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: 'Ledger_' + level,
            // ⭐ تابع گرفتن کل داده برای export/print
            getFullTable: async () => {
                return await this.fetchFullLedgerTable();
            }
        });
    },

    // ⭐ گرفتن کل داده دفتر برای export/print
    async fetchFullLedgerTable() {
        const level = document.querySelector('input[name="ledLevel"]:checked').value;

        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const payload = {
            level,
            page: 1,
            pageSize: 100000,   // همه ردیف‌ها
            fromDate: document.getElementById('ledFromDate').value || null,
            toDate: document.getElementById('ledToDate').value || null,
            noFrom: parseIntOrNull('ledNoFrom'),
            noTo: parseIntOrNull('ledNoTo'),
            vazeit: parseIntOrNull('ledVazeit'),
            tikRow: parseIntOrNull('ledTikRow'),
            fromCodeCol: parseIntOrNull('ledFromCodeCol'),
            toCodeCol: parseIntOrNull('ledToCodeCol'),
            fromCodeMoein: parseIntOrNull('ledFromCodeMoein'),
            toCodeMoein: parseIntOrNull('ledToCodeMoein'),
            fromCodeTafzil: parseIntOrNull('ledFromCodeTafzil'),
            toCodeTafzil: parseIntOrNull('ledToCodeTafzil'),
            codeTafzili2: parseIntOrNull('ledCodeTafzili2'),
            includeMandehBefore: false
        };

        const result = await this.api('/api/ledger', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // ساخت جدول HTML از همه ردیف‌ها
        return this.buildLedgerTableHtml(result);
    },

    buildLedgerTableHtml(data) {
        const items = data.items || [];
        const level = data.level;

        let codeHeaders = `<th>کد کل</th><th>نام کل</th>`;
        if (level === 'moein' || level === 'tafzil' || level === 'tafzil2') {
            codeHeaders += `<th>کد معین</th><th>نام معین</th>`;
        }
        if (level === 'tafzil' || level === 'tafzil2') {
            codeHeaders += `<th>کد تفصیلی</th><th>نام تفصیلی</th>`;
        }
        if (level === 'tafzil2') {
            codeHeaders += `<th>کد تفصیلی 2</th><th>نام تفصیلی 2</th>`;
        }

        const codeColSpan = 2 + (level !== 'col' ? 2 : 0) + (level === 'tafzil' || level === 'tafzil2' ? 2 : 0) + (level === 'tafzil2' ? 2 : 0);

        const rows = items.map(it => {
            let codeCells = `<td class="num">${it.codeCol ?? ''}</td><td>${this.esc(it.colName || '')}</td>`;
            if (level === 'moein' || level === 'tafzil' || level === 'tafzil2') {
                codeCells += `<td class="num">${it.codeMoein ?? ''}</td><td>${this.esc(it.moeinName || '')}</td>`;
            }
            if (level === 'tafzil' || level === 'tafzil2') {
                codeCells += `<td class="num">${it.codeTafzil ?? ''}</td><td>${this.esc(it.tafzilName || '')}</td>`;
            }
            if (level === 'tafzil2') {
                codeCells += `<td class="num">${it.codeTafzili2 ?? ''}</td><td>${this.esc(it.tafzili2Name || '')}</td>`;
            }

            const manValue = it.mabMan;
            const manBadge = manValue > 0 ? 'بس' : (manValue < 0 ? 'بد' : '');
            const manAbs = Math.abs(manValue);

            return `
    <tr>
        <td class="num text-center">${this.fmt(it.noSanad)}</td>
        <td class="num">${this.esc(it.dateIn || '')}</td>
        ${codeCells}
        <td>${this.esc(it.otherSharh || it.otherParentSharh || '')}</td>
        <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
        <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
        <td class="num text-left">${this.fmtSigned(it.meghdar)}</td>
        <td class="num text-left">
            ${this.fmt(manAbs)}
            ${manBadge ? `<span class="badge ${manValue > 0 ? 'badge-warning' : 'badge-info'}" style="margin-right:4px; font-size:10px;">${manBadge}</span>` : ''}
        </td>
    </tr>
`;
        }).join('');

        const totalBes = data.totalMan > 0;
        const totalManAbs = Math.abs(data.totalMan);

        const table = document.createElement('table');
        table.innerHTML = `
    <thead>
        <tr>
            <th style="width:60px;">سند</th>
            <th style="width:90px;">تاریخ</th>
            ${codeHeaders}
            <th>شرح</th>
            <th class="text-left" style="width:110px;">بدهکار</th>
            <th class="text-left" style="width:110px;">بستانکار</th>
            <th class="text-left" style="width:80px;">مقدار</th>
            <th class="text-left" style="width:130px;">مانده</th>
        </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
        <tr style="background:#EEF2FF; font-weight:700;">
            <td colspan="${3 + codeColSpan - 2}" class="text-center">جمع کل (${items.length.toLocaleString('fa-IR')} ردیف)</td>
            <td class="num text-left">${this.fmt(data.totalBed)}</td>
            <td class="num text-left">${this.fmt(data.totalBes)}</td>
            <td class="num text-left">${this.fmtSigned(items.reduce((s, x) => s + (x.meghdar || 0), 0))}</td>
            <td class="num text-left">
                ${this.fmt(totalManAbs)}
                ${data.totalMan !== 0 ? `<span class="badge ${totalBes ? 'badge-warning' : 'badge-info'}">${totalBes ? 'بس' : 'بد'}</span>` : ''}
            </td>
        </tr>
    </tfoot>
`;
        return table;
    }, 
    // ═══════════════════════════════════════════
    //  TARAZ (تراز حساب‌ها)
    // ═══════════════════════════════════════════
    renderTaraz() {
        const c = document.getElementById('content');
        // ⭐ ریست کامل state هر بار که وارد صفحه می‌شیم
        this._tarazDrill = null;
        this._tarazCurrentItems = [];
        c.innerHTML = `
        <div class="card">
            <div class="card-title">⚖️ تنظیمات تراز</div>

            <div class="form-group">
                <label>سطح گزارش</label>
                <div class="radio-group">
                    <label class="radio-item">
                        <input type="radio" name="tarazLevel" value="col" checked>
                        <span>کل</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="tarazLevel" value="moein" >
                        <span>معین</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="tarazLevel" value="tafzil">
                        <span>تفصیلی 1</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="tarazLevel" value="tafzil2">
                        <span>تفصیلی 2</span>
                    </label>
                </div>
            </div>

            <div class="form-group">
                <label>نمایش سطوح</label>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="tarazSetDetail">
                    <span>نمایش همه سطوح کدینگ</span>
                </label>
            </div>

            <div class="filters">
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="tarazFromDate" placeholder="1403/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="tarazToDate" placeholder="1403/12/29">
                </div>
                <div class="form-group">
                    <label>از شماره سند</label>
                    <input type="number" id="tarazNoFrom">
                </div>
                <div class="form-group">
                    <label>تا شماره سند</label>
                    <input type="number" id="tarazNoTo">
                </div>
                <div class="form-group">
                    <label>وضعیت سند</label>
                    <select id="tarazVazeit">
                        <option value="">همه</option>
                        <option value="0">پیش‌نویس</option>
                        <option value="1">رسیدگی</option>
                        <option value="2">قطعی</option>
                    </select>
                </div>
                 <div class="form-group">
                    <label>نوع خروجی</label>
                    <select id="tarazFilterOption">
                        <option value="all">کلیه حساب‌ها</option>
                        <option value="noZeroMandeh">حساب‌های با مانده صفر آورده نشود</option>
                        <option value="noZeroGardesh" selected>حساب‌های با گردش صفر آورده نشود</option>
                    </select>
                </div>
            </div>

            <div class="filters" id="tarazAccountFilters"></div>

            <button class="btn btn-primary" id="tarazBtnRun" style="margin-top:12px;">
                ⚖️ تهیه تراز
            </button>
        </div>

        <div id="tarazResult">
            <div class="empty">
                <div class="empty-icon">⚖️</div>
                <p>تنظیمات را انتخاب کنید و دکمه «تهیه تراز» را بزنید</p>
            </div>
        </div>
    `;

        this.buildTarazAccountFilters('moein');

        document.querySelectorAll('input[name="tarazLevel"]').forEach(r => {
            r.addEventListener('change', (e) => this.buildTarazAccountFilters(e.target.value));
        });

        document.getElementById('tarazBtnRun').addEventListener('click', () => {
            // ⭐ ریست کامل state
            this._tarazDrill = null;
            this.runTaraz(1);
        });
    },

    buildTarazAccountFilters(level) {
        const box = document.getElementById('tarazAccountFilters');
        let html = `
        <div class="form-group">
            <label>از کد کل</label>
            <input type="number" id="tarazFromCodeCol">
        </div>
        <div class="form-group">
            <label>تا کد کل</label>
            <input type="number" id="tarazToCodeCol">
        </div>
    `;

        if (level !== 'col') {
            html += `
            <div class="form-group">
                <label>از کد معین</label>
                <input type="number" id="tarazFromCodeMoein">
            </div>
            <div class="form-group">
                <label>تا کد معین</label>
                <input type="number" id="tarazToCodeMoein">
            </div>
        `;
        }

        if (level === 'tafzil' || level === 'tafzil2') {
            html += `
            <div class="form-group">
                <label>از کد تفصیلی 1</label>
                <input type="number" id="tarazFromCodeTafzil">
            </div>
            <div class="form-group">
                <label>تا کد تفصیلی 1</label>
                <input type="number" id="tarazToCodeTafzil">
            </div>
        `;
        }

        if (level === 'tafzil2') {
            html += `
            <div class="form-group">
                <label>کد تفصیلی 2</label>
                <input type="number" id="tarazCodeTafzili2">
            </div>
        `;
        }

        box.innerHTML = html;
    },

    async runTaraz(page = 1, drillState = null) {
        // ⭐ اگه drillState داده شده، استفاده کن؛ وگرنه اگه state هست نگه دار
        if (drillState) {
            this._tarazDrill = drillState;
        }

        // ⭐ اگه هنوز state نداریم، از رادیو مقدار بگیر
        if (!this._tarazDrill) {
            const selectedLevel = document.querySelector('input[name="tarazLevel"]:checked')?.value || 'col';
            this._tarazDrill = {
                level: selectedLevel,
                codeCol: null,
                codeMoein: null,
                codeTafzil: null,
                codeTafzili2: null,
                colName: '',
                moeinName: '',
                tafzilName: '',
                tafzili2Name: '',
                breadcrumb: []
            };
        }

        const btn = document.getElementById('tarazBtnRun');
        if (btn) { btn.disabled = true; btn.textContent = 'در حال تهیه...'; }

        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const d = this._tarazDrill;

        console.log('[Taraz] Payload for level:', d.level, d);

        const payload = {
            level: d.level,
            page: page,
            pageSize: this.state.settings.pageSize,
            setDetail: document.getElementById('tarazSetDetail')?.checked || false,
            filterOption: document.getElementById('tarazFilterOption')?.value || 'noZeroGardesh',
            fromDate: document.getElementById('tarazFromDate')?.value || null,
            toDate: document.getElementById('tarazToDate')?.value || null,
            noFrom: parseIntOrNull('tarazNoFrom'),
            noTo: parseIntOrNull('tarazNoTo'),
            vazeit: parseIntOrNull('tarazVazeit'),
            // ⭐ فیلتر Drill - اگه کد داریم، فقط همون رو بفرست
            fromCodeCol: d.codeCol ?? parseIntOrNull('tarazFromCodeCol'),
            toCodeCol: d.codeCol ?? parseIntOrNull('tarazToCodeCol'),
            fromCodeMoein: d.codeMoein ?? parseIntOrNull('tarazFromCodeMoein'),
            toCodeMoein: d.codeMoein ?? parseIntOrNull('tarazToCodeMoein'),
            fromCodeTafzil: d.codeTafzil ?? parseIntOrNull('tarazFromCodeTafzil'),
            toCodeTafzil: d.codeTafzil ?? parseIntOrNull('tarazToCodeTafzil'),
            codeTafzili2: d.codeTafzili2 ?? parseIntOrNull('tarazCodeTafzili2')
        };

        try {
            const result = await this.api('/api/taraz', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            this.renderTarazResult(result);
        } catch (err) {
            document.getElementById('tarazResult').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '⚖️ تهیه تراز'; }
        }
    },

    // ⭐ Drill-Down
    async drillTaraz(row) {
        const d = this._tarazDrill;

        let nextLevel, codeCol = d.codeCol, codeMoein = d.codeMoein,
            codeTafzil = d.codeTafzil, codeTafzili2 = d.codeTafzili2,
            colName = d.colName, moeinName = d.moeinName,
            tafzilName = d.tafzilName, tafzili2Name = d.tafzili2Name;
        let breadcrumb = [...(d.breadcrumb || [])];

        switch (d.level) {
            case 'col':
                // کل همیشه معین داره → همیشه برو معین
                nextLevel = 'moein';
                codeCol = row.codeCol;
                colName = row.hesabName || `کل ${row.codeCol}`;
                breadcrumb.push({ level: 'col', code: row.codeCol, name: colName });
                break;

            case 'moein':
                // ⭐ همیشه برو تفصیلی (اگه داشته باشه نشون می‌ده، اگه نداشت فallback می‌شه)
                nextLevel = 'tafzil';
                codeMoein = row.codeMoein;
                moeinName = row.hesabName || `معین ${row.codeMoein}`;
                breadcrumb.push({ level: 'moein', code: row.codeMoein, name: moeinName });
                break;

            case 'tafzil':
                // ⭐ همیشه برو تفصیلی 2 (اگه داشت نشون بده، اگه نداشت fallback)
                nextLevel = 'tafzil2';
                codeTafzil = row.codeTafzil;
                tafzilName = row.hesabName || `تفصیلی ${row.codeTafzil}`;
                breadcrumb.push({ level: 'tafzil', code: row.codeTafzil, name: tafzilName });
                break;

            case 'tafzil2':
                await this.showTarazAccountSanads(row);
                return;
        }

        this._tarazDrill = {
            level: nextLevel,
            codeCol, codeMoein, codeTafzil, codeTafzili2,
            colName, moeinName, tafzilName, tafzili2Name,
            breadcrumb
        };

        await this.runTaraz(1);
    },

    // ⭐ برگشت یک سطح
    async tarazGoBack() {
        const d = this._tarazDrill;
        if (!d) return;

        const bc = [...(d.breadcrumb || [])];
        if (bc.length === 0) return;

        // حذف آخرین
        const last = bc.pop();

        // بازسازی state
        let level = 'moein', codeCol = null, codeMoein = null, codeTafzil = null;
        let colName = '', moeinName = '', tafzilName = '';

        // بر اساس breadcrumb باقی‌مانده
        bc.forEach(item => {
            if (item.level === 'col') { codeCol = item.code; colName = item.name; }
            if (item.level === 'moein') { codeMoein = item.code; moeinName = item.name; }
            if (item.level === 'tafzil') { codeTafzil = item.code; tafzilName = item.name; }
        });

        if (bc.length === 0) {
            // برگشت به ریشه
            level = 'moein';
        } else if (bc[bc.length - 1].level === 'col') {
            level = 'moein';
        } else if (bc[bc.length - 1].level === 'moein') {
            level = 'tafzil';
        } else if (bc[bc.length - 1].level === 'tafzil') {
            level = 'tafzil2';
        }

        this._tarazDrill = {
            level,
            codeCol, codeMoein, codeTafzil, codeTafzili2: null,
            colName, moeinName, tafzilName, tafzili2Name: '',
            breadcrumb: bc
        };

        await this.runTaraz(1);
    },

    // ⭐ نمایش اسناد یک حساب (Modal جدید)
    async showTarazAccountSanads(row) {
        const d = this._tarazDrill;

        // ⭐ تعیین کدهای نهایی برای فیلتر
        // - اگه ردیف تفضیلی۲ داره → فیلتر با ۴ کد
        // - اگه تفضیلی داره → فیلتر با ۳ کد
        // - اگه معین داره → فیلتر با ۲ کد
        // - اگه فقط کل → فیلتر با ۱ کد
        const codeCol = row.codeCol ?? d.codeCol;
        const codeMoein = row.codeMoein ?? d.codeMoein;
        const codeTafzil = row.codeTafzil ?? d.codeTafzil;
        const codeTafzili2 = row.codeTafzili2 ?? d.codeTafzili2;

        // ─── عنوان ───
        let title = `اسناد حساب`;
        let codeParts = [];
        if (codeCol) codeParts.push(`کل ${codeCol}`);
        if (codeMoein) codeParts.push(`معین ${codeMoein}`);
        if (codeTafzil) codeParts.push(`تفصیلی ${codeTafzil}`);
        if (codeTafzili2) codeParts.push(`تفصیلی ۲ ${codeTafzili2}`);

        this.openModal(`📒 ${title} - ${codeParts.join(' / ')}`,
            `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const payload = {
                codeCol: codeCol,
                codeMoein: codeMoein,
                codeTafzil: codeTafzil,
                codeTafzili2: codeTafzili2,
                fromDate: document.getElementById('tarazFromDate')?.value || null,
                toDate: document.getElementById('tarazToDate')?.value || null
            };

            const items = await this.api('/api/taraz/account-sanads', {
                method: 'POST',
                body: JSON.stringify(payload)
            }) || [];

            if (items.length === 0) {
                document.getElementById('modalBody').innerHTML =
                    `<div class="empty"><div class="empty-icon">📭</div><p>سندی برای این حساب یافت نشد</p></div>`;
                return;
            }

            // خلاصه
            const first = items[0];
            const totalBed = items.reduce((s, x) => s + (x.mabBed || 0), 0);
            const totalBes = items.reduce((s, x) => s + (x.mabBes || 0), 0);
            const totalMan = totalBed - totalBes;

            // ⭐ مرتب‌سازی بر اساس تاریخ و شماره سند
            items.sort((a, b) => {
                if (a.dateIn !== b.dateIn) return (a.dateIn || '').localeCompare(b.dateIn || '');
                return (a.noSanad || 0) - (b.noSanad || 0);
            });

            // ⭐ محاسبه‌ی مانده‌ی تجمعی
            let running = 0;
            const rows = items.map(it => {
                running += ((it.mabBed || 0) - (it.mabBes || 0));
                const mandehAbs = Math.abs(running);
                const mandehDir = running >= 0 ? 'بد' : 'بس';
                const mandehColor = running >= 0 ? '#059669' : '#DC2626';

                // اسم حساب (اگه تفصیلی نداشت، از ColName + MoeinName استفاده کن)
                let hesabName = '';
                if (it.colName) hesabName += it.colName;
                if (it.moeinName) hesabName += ' - ' + it.moeinName;
                if (it.tafzilName) hesabName += ' - ' + it.tafzilName;
                if (it.tafzili2Name) hesabName += ' - ' + it.tafzili2Name;

                return `
                <tr class="clickable-row" onclick="App.showSanadDetail(${it.parentSanadId})" title="کلیک برای مشاهده سند">
                   <td class="num text-center">${this.fmt(it.noSanad)}</td>
                    <td class="num">${this.esc(it.dateIn || '')}</td>
                    <td>${this.esc(it.otherParentSharh || '')}</td>
                    <td>${this.esc(it.otherSharh || '')}</td>
                    <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
                    <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
                    <td class="num text-left" style="color:${mandehColor}; font-weight:600;">
                        ${this.fmt(mandehAbs)} ${mandehDir}
                    </td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-ghost"
                                onclick="App.showSanadDetail(${it.parentSanadId})">
                            🔍
                        </button>
                    </td>
                </tr>
            `;
            }).join('');

            const body = `
            <div class="stats-grid" style="margin-bottom:16px;">
                <div class="stat-card">
                    <div>
                        <div class="stat-label">حساب</div>
                        <div class="stat-value" style="font-size:14px;">
                            ${this.esc(first.colName || '')}
                            ${first.moeinName ? ' - ' + this.esc(first.moeinName) : ''}
                            ${first.tafzilName ? ' - ' + this.esc(first.tafzilName) : ''}
                            ${first.tafzili2Name ? ' - ' + this.esc(first.tafzili2Name) : ''}
                        </div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">جمع بدهکار</div>
                        <div class="stat-value" style="font-size:15px;">${this.fmt(totalBed)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">جمع بستانکار</div>
                        <div class="stat-value" style="font-size:15px;">${this.fmt(totalBes)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-label">مانده نهایی</div>
                        <div class="stat-value" style="font-size:15px; color:${totalMan >= 0 ? '#059669' : '#DC2626'};">
                            ${this.fmt(Math.abs(totalMan))} ${totalMan >= 0 ? 'بد' : 'بس'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:70px;">سند</th>
                            <th style="width:90px;">تاریخ</th>
                            <th>شرح سند</th>
                            <th>شرح ردیف</th>
                            <th class="text-left" style="width:120px;">بدهکار</th>
                            <th class="text-left" style="width:120px;">بستانکار</th>
                            <th class="text-left" style="width:130px;">مانده</th>
                            <th style="width:50px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:700;">
                            <td colspan="4" class="text-center">جمع کل</td>
                            <td class="num text-left">${this.fmt(totalBed)}</td>
                            <td class="num text-left">${this.fmt(totalBes)}</td>
                            <td class="num text-left" style="color:${totalMan >= 0 ? '#059669' : '#DC2626'};">
                                ${this.fmt(Math.abs(totalMan))} ${totalMan >= 0 ? 'بد' : 'بس'}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

            document.getElementById('modalBody').innerHTML = body;

            // دکمه‌های خروجی
            const self = this;
            Exporter.attach(document.getElementById('modalBody'), {
                title: `دفتر حساب - ${codeParts.join(' / ')}`,
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: `Ledger_${codeCol}_${codeMoein || 0}_${codeTafzil || 0}`,
                customHtml: () => self.buildTarazSanadHtml(items, first, totalBed, totalBes, totalMan)
            });
            this.enhanceTables(document.getElementById('modalBody'));

        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
    },

    buildTarazSanadHtml(items, first, totalBed, totalBes, totalMan) {
        // مرتب‌سازی
        const sorted = [...items].sort((a, b) => {
            if (a.dateIn !== b.dateIn) return (a.dateIn || '').localeCompare(b.dateIn || '');
            return (a.noSanad || 0) - (b.noSanad || 0);
        });

        let running = 0;
        const rows = sorted.map(it => {
            running += ((it.mabBed || 0) - (it.mabBes || 0));
            const mandehAbs = Math.abs(running);
            const mandehDir = running >= 0 ? 'بد' : 'بس';

            return `
            <tr>
                <td class="num text-center">${this.fmt(it.noSanad)}</td>
                <td class="num">${this.esc(it.dateIn || '')}</td>
                <td>${this.esc(it.otherParentSharh || '')}</td>
                <td>${this.esc(it.otherSharh || '')}</td>
                <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
                <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
                <td class="num text-left">${this.fmt(mandehAbs)} ${mandehDir}</td>
            </tr>
        `;
        }).join('');

        return `
        <table class="factor-info-table">
            <tr>
                <td class="label">حساب:</td>
                <td colspan="5">
                    ${this.esc(first.colName || '')}
                    ${first.moeinName ? ' - ' + this.esc(first.moeinName) : ''}
                    ${first.tafzilName ? ' - ' + this.esc(first.tafzilName) : ''}
                </td>
            </tr>
        </table>

        <div class="section-title">📒 دفتر حساب (${sorted.length} ردیف)</div>
        <table>
            <thead>
                <tr>
                    <th>سند</th>
                    <th>تاریخ</th>
                    <th>شرح سند</th>
                    <th>شرح ردیف</th>
                    <th class="text-left">بدهکار</th>
                    <th class="text-left">بستانکار</th>
                    <th class="text-left">مانده</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr style="background:#EEF2FF; font-weight:700;">
                    <td colspan="4" class="text-center">جمع کل</td>
                    <td class="num text-left">${this.fmt(totalBed)}</td>
                    <td class="num text-left">${this.fmt(totalBes)}</td>
                    <td class="num text-left">${this.fmt(Math.abs(totalMan))} ${totalMan >= 0 ? 'بد' : 'بس'}</td>
                </tr>
            </tfoot>
        </table>
    `;
    },

    buildTarazPayload(level, page) {
        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        return {
            level,
            page: page,
            pageSize: this.state.settings.pageSize,
            setDetail: document.getElementById('tarazSetDetail').checked,
            filterOption: document.getElementById('tarazFilterOption').value,
            fromDate: document.getElementById('tarazFromDate').value || null,
            toDate: document.getElementById('tarazToDate').value || null,
            noFrom: parseIntOrNull('tarazNoFrom'),
            noTo: parseIntOrNull('tarazNoTo'),
            vazeit: parseIntOrNull('tarazVazeit'),
            fromCodeCol: parseIntOrNull('tarazFromCodeCol'),
            toCodeCol: parseIntOrNull('tarazToCodeCol'),
            fromCodeMoein: parseIntOrNull('tarazFromCodeMoein'),
            toCodeMoein: parseIntOrNull('tarazToCodeMoein'),
            fromCodeTafzil: parseIntOrNull('tarazFromCodeTafzil'),
            toCodeTafzil: parseIntOrNull('tarazToCodeTafzil'),
            codeTafzili2: parseIntOrNull('tarazCodeTafzili2')
        };
    },

    renderTarazResult(data) {
        const container = document.getElementById('tarazResult');
        const items = data.items || [];
        const level = data.level;
        const d = this._tarazDrill || { breadcrumb: [] };

        // ⭐ اگه خالیه و ما در حال drill هستیم → فallback به دفتر
        if (items.length === 0 && d.breadcrumb && d.breadcrumb.length > 0) {
            const last = d.breadcrumb[d.breadcrumb.length - 1];
            if (last.level === 'moein' || last.level === 'tafzil') {
                // مستقیم دفتر باز کن
                this.showTarazAccountSanadsForState();
                return;
            }
        }

        // ═══ Breadcrumb ═══
        const bcHtml = d.breadcrumb && d.breadcrumb.length > 0
            ? `
            <div class="taraz-breadcrumb">
                <button class="btn btn-ghost btn-sm" onclick="App.tarazGoBack()">
                    ↩️ بازگشت
                </button>
                <span class="bc-item">ریشه</span>
                ${d.breadcrumb.map((item) => `
                    <span class="bc-sep">›</span>
                    <span class="bc-item">${this.esc(item.name)} (${item.code})</span>
                `).join('')}
            </div>
        `
            : '';

        if (items.length === 0) {
            container.innerHTML = `
            ${bcHtml}
            <div class="empty">
                <div class="empty-icon">📭</div>
                <p>موردی یافت نشد</p>
            </div>`;
            return;
        }

        // ⭐ ذخیره‌ی items
        this._tarazCurrentItems = items;

        // ⭐ همیشه ۴ ستون کد نمایش بده (مثل دلفی)
        const codeHeaders = `
        <th style="width:80px;">تفصیلی 2</th>
        <th style="width:80px;">تفصیلی</th>
        <th style="width:70px;">معین</th>
        <th style="width:70px;">کل</th>
    `;

        // ⭐ ساخت ردیف‌ها
        const rows = items.map((it, idx) => {
            // ⭐ ترتیب ستون‌ها: تفصیلی2 | تفصیلی | معین | کل
            const tafzili2Cell = (level === 'tafzil2' && it.codeTafzili2) ? it.codeTafzili2 : '-';
            const tafzilCell = (level === 'tafzil' || level === 'tafzil2') && it.codeTafzil ? it.codeTafzil : '-';
            const moeinCell = (level !== 'col') && it.codeMoein ? it.codeMoein : '-';
            const colCell = it.codeCol || '-';

            // ⭐ آیکن بر اساس سطح
            let drillIcon = '📒';
            let drillTitle = 'نمایش دفتر';

            if (level === 'col') {
                drillIcon = '▶';
                drillTitle = 'ورود به معین‌ها';
            } else if (level === 'moein') {
                drillIcon = it.hasTafzili ? '▶' : '📒';
                drillTitle = it.hasTafzili ? 'ورود به تفصیلی‌ها' : 'نمایش دفتر';
            } else if (level === 'tafzil') {
                drillIcon = it.hasTafzili2 ? '▶' : '📒';
                drillTitle = it.hasTafzili2 ? 'ورود به تفصیلی 2' : 'نمایش دفتر';
            }

            return `
            <tr class="taraz-row-drill" data-idx="${idx}" style="cursor: pointer;">
                <td class="num text-center" style="color:${level === 'tafzil2' && it.codeTafzili2 ? 'inherit' : '#D1D5DB'};">${tafzili2Cell}</td>
                <td class="num text-center" style="color:${(level === 'tafzil' || level === 'tafzil2') && it.codeTafzil ? 'inherit' : '#D1D5DB'};">${tafzilCell}</td>
                <td class="num text-center" style="color:${level !== 'col' && it.codeMoein ? 'inherit' : '#D1D5DB'};">${moeinCell}</td>
                <td class="num text-center" style="font-weight:600; color:var(--primary);">${colCell}</td>
                <td>${this.esc(it.hesabName || '-')}</td>
                <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
                <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
                <td class="num text-left">${it.mabManBed > 0 ? this.fmt(it.mabManBed) : '-'}</td>
                <td class="num text-left">${it.mabManBes > 0 ? this.fmt(it.mabManBes) : '-'}</td>
                <td class="num text-left">${this.fmtSigned(it.meghdar)}</td>
                <td class="text-center">
                    <span class="drill-icon" title="${drillTitle}">${drillIcon}</span>
                </td>
            </tr>
        `;
        }).join('');

        // ═══ صفحه‌بندی ═══
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                                onclick="App.runTaraz(${p})">${p}</button>`;
            }

            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${items.length.toLocaleString('fa-IR')} از ${totalCount.toLocaleString('fa-IR')} ردیف
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runTaraz(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runTaraz(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runTaraz(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runTaraz(${totalPages})">»</button>
                </div>
            </div>`;
        } else {
            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">مجموع: ${totalCount.toLocaleString('fa-IR')} ردیف</div>
            </div>`;
        }

        container.innerHTML = `
        ${bcHtml}
        <div class="card">
            <div class="card-title">
                <span>⚖️ تراز - سطح ${this._levelName(level)} (${items.length} از ${totalCount.toLocaleString('fa-IR')})</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            ${codeHeaders}
                            <th>نام حساب</th>
                            <th class="text-left" style="width:100px;">گردش بدهکار</th>
                            <th class="text-left" style="width:100px;">گردش بستانکار</th>
                            <th class="text-left" style="width:100px;">مانده بدهکار</th>
                            <th class="text-left" style="width:100px;">مانده بستانکار</th>
                            <th class="text-left" style="width:80px;">مقدار</th>
                            <th style="width:40px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:700;">
                            <td colspan="5" class="text-center">جمع کل</td>
                            <td class="num text-left">${this.fmt(data.totalBed)}</td>
                            <td class="num text-left">${this.fmt(data.totalBes)}</td>
                            <td class="num text-left">${this.fmt(data.totalManBed)}</td>
                            <td class="num text-left">${this.fmt(data.totalManBes)}</td>
                            <td class="num text-left">${this.fmtSigned(data.totalMeghdar)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            ${paginationHtml}
        </div>
    `;

        // ⭐ بایند رویداد کلیک
        setTimeout(() => {
            container.querySelectorAll('.taraz-row-drill').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    const idx = parseInt(tr.dataset.idx);
                    const row = this._tarazCurrentItems[idx];
                    if (row) this.drillTaraz(row);
                });
            });
        }, 30);

        // دکمه‌های خروجی
        const self = this;
        const levelTitles = {
            col: 'تراز - کل',
            moein: 'تراز - معین',
            tafzil: 'تراز - تفصیلی 1',
            tafzil2: 'تراز - تفصیلی 2'
        };

        Exporter.attach(container, {
            title: levelTitles[level] || 'تراز',
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: 'Taraz_' + level,
            getFullTable: async () => {
                const payload = {
                    level: level, page: 1, pageSize: 100000,
                    setDetail: document.getElementById('tarazSetDetail')?.checked || false,
                    filterOption: document.getElementById('tarazFilterOption')?.value || 'noZeroGardesh',
                    fromDate: document.getElementById('tarazFromDate')?.value || null,
                    toDate: document.getElementById('tarazToDate')?.value || null,
                    fromCodeCol: d.codeCol, toCodeCol: d.codeCol,
                    fromCodeMoein: d.codeMoein, toCodeMoein: d.codeMoein,
                    fromCodeTafzil: d.codeTafzil, toCodeTafzil: d.codeTafzil,
                    codeTafzili2: d.codeTafzili2
                };
                const full = await self.api('/api/taraz', {
                    method: 'POST', body: JSON.stringify(payload)
                });
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = self.buildTarazTableHtml(full, level);
                return tempContainer.querySelector('table');
            }
        });
    },

    // ⭐ اضافه کن
    async showTarazAccountSanadsForState() {
        const d = this._tarazDrill;
        if (!d) return;

        // آخرین breadcrumb
        const last = d.breadcrumb && d.breadcrumb.length > 0
            ? d.breadcrumb[d.breadcrumb.length - 1]
            : null;

        const row = {
            codeCol: d.codeCol,
            codeMoein: d.codeMoein,
            codeTafzil: d.codeTafzil,
            codeTafzili2: d.codeTafzili2
        };

        await this.showTarazAccountSanads(row);
    },    

    _levelName(level) {
        return { col: 'کل', moein: 'معین', tafzil: 'تفصیلی 1', tafzil2: 'تفصیلی 2' }[level] || level;
    },

    buildTarazTableHtml(data, forExport) {
        const items = data.items || [];
        const level = data.level;

        // ستون‌های کد بر اساس سطح
        let codeHeaders = `<th>کد کل</th>`;
        if (level !== 'col') codeHeaders += `<th>کد معین</th>`;
        if (level === 'tafzil' || level === 'tafzil2') codeHeaders += `<th>کد تفصیلی</th>`;
        if (level === 'tafzil2') codeHeaders += `<th>کد تفصیلی 2</th>`;

        const rows = items.map(it => {
            let codeCells = `<td class="num text-center">${it.codeCol ?? ''}</td>`;
            if (level !== 'col') codeCells += `<td class="num text-center">${it.codeMoein || (it.codeMoein === 0 ? '' : '')}</td>`;
            if (level === 'tafzil' || level === 'tafzil2') codeCells += `<td class="num text-center">${it.codeTafzil || ''}</td>`;
            if (level === 'tafzil2') codeCells += `<td class="num text-center">${it.codeTafzili2 || ''}</td>`;

            return `
            <tr>
                ${codeCells}
                <td>${this.esc(it.hesabName || '-')}</td>
                <td class="num text-left">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
                <td class="num text-left">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
                <td class="num text-left">${it.mabManBed > 0 ? this.fmt(it.mabManBed) : '-'}</td>
                <td class="num text-left">${it.mabManBes > 0 ? this.fmt(it.mabManBes) : '-'}</td>
                <td class="num text-left">${this.fmtSigned(it.meghdar)}</td>
            </tr>
        `;
        }).join('');

        const codeColCount = 1 + (level !== 'col' ? 1 : 0) + (level === 'tafzil' || level === 'tafzil2' ? 1 : 0) + (level === 'tafzil2' ? 1 : 0);

        return `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        ${codeHeaders}
                        <th>نام حساب</th>
                        <th class="text-left" style="width:110px;">گردش بدهکار</th>
                        <th class="text-left" style="width:110px;">گردش بستانکار</th>
                        <th class="text-left" style="width:110px;">مانده بدهکار</th>
                        <th class="text-left" style="width:110px;">مانده بستانکار</th>
                        <th class="text-left" style="width:90px;">مقدار</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr style="background:#EEF2FF; font-weight:700;">
                        <td colspan="${codeColCount + 1}" class="text-center">جمع کل</td>
                        <td class="num text-left">${this.fmt(data.totalBed)}</td>
                        <td class="num text-left">${this.fmt(data.totalBes)}</td>
                        <td class="num text-left">${this.fmt(data.totalManBed)}</td>
                        <td class="num text-left">${this.fmt(data.totalManBes)}</td>
                        <td class="num text-left">${this.fmtSigned(data.totalMeghdar)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    },    

    // ═══════════════════════════════════════════
    //  HESAB (حساب‌ها) — Tree View
    // ═══════════════════════════════════════════
    async renderHesab() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>`;

        try {
            const items = await this.api('/api/hesab/tree') || [];

            if (items.length === 0) {
                c.innerHTML = `<div class="empty"><div class="empty-icon">🏦</div><p>حسابی یافت نشد</p></div>`;
                return;
            }

            // ═══ ساختار درخت ═══
            const cols = items.filter(x => x.level === 'col').sort((a, b) => a.codeCol - b.codeCol);
            const moeinMap = {};
            items.filter(x => x.level === 'moein').forEach(m => {
                if (!moeinMap[m.codeCol]) moeinMap[m.codeCol] = [];
                moeinMap[m.codeCol].push(m);
            });

            c.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>🏦 درخت حساب‌ها</span>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-ghost btn-sm" id="hesabExpandAll">🔽 باز کردن همه</button>
                        <button class="btn btn-ghost btn-sm" id="hesabCollapseAll">🔼 بستن همه</button>
                    </div>
                </div>

                <div class="tree-container">
                    ${cols.map(col => {
                const moeins = (moeinMap[col.codeCol] || [])
                    .sort((a, b) => a.codeMoein - b.codeMoein);

                const colMandeh = this._mandehDisplay(col.mabMandeh, col.mahiat);

                return `
                            <div class="tree-col" data-code="${col.codeCol}">
                                <div class="tree-row level-col ${colMandeh.rowClass}" data-toggle="col-${col.codeCol}">
                                    <span class="tree-toggle">▶</span>
                                    <span class="tree-code">${col.codeCol}</span>
                                    <span class="tree-name">${this.esc(col.name)}</span>
                                    <span class="tree-badges">
                                        ${col.hasTafzili ? '<span class="badge badge-info" style="font-size:10px;">تفصیلی‌دار</span>' : ''}
                                    </span>
                                    <span class="tree-mahiat">${this.mahiatBadge(col.mahiat)}</span>
                                    <span class="tree-num">${this.fmt(col.sumBed)}</span>
                                    <span class="tree-num">${this.fmt(col.sumBes)}</span>
                                    <span class="tree-num tree-mandeh" style="${colMandeh.colorStyle}">
                                        ${colMandeh.value}
                                        ${colMandeh.direction ? `<span class="mandeh-dir">${colMandeh.direction}</span>` : ''}
                                    </span>
                                </div>
                                <div class="tree-children" id="col-${col.codeCol}">
                                    ${moeins.map(moein => {
                    const mnt = this._mandehDisplay(moein.mabMandeh, moein.mahiat);

                    return `
                                            <div class="tree-row level-moein ${mnt.rowClass}">
                                                <span class="tree-indent"></span>
                                                <span class="tree-code">${moein.codeMoein}</span>
                                                <span class="tree-name">${this.esc(moein.name)}</span>
                                                <span class="tree-badges">
                                                    ${moein.hasTafzili ? '<span class="badge badge-info" style="font-size:10px;">تفصیلی‌دار</span>' : ''}
                                                </span>
                                                <span class="tree-mahiat">${this.mahiatBadge(moein.mahiat)}</span>
                                                <span class="tree-num">${this.fmt(moein.sumBed)}</span>
                                                <span class="tree-num">${this.fmt(moein.sumBes)}</span>
                                                <span class="tree-num tree-mandeh" style="${mnt.colorStyle}">
                                                    ${mnt.value}
                                                    ${mnt.direction ? `<span class="mandeh-dir">${mnt.direction}</span>` : ''}
                                                </span>
                                            </div>
                                        `;
                }).join('')}
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            </div>
        `;

            // ═══ رویداد باز/بسته ═══
            document.querySelectorAll('[data-toggle]').forEach(el => {
                el.addEventListener('click', () => {
                    const targetId = el.dataset.toggle;
                    const target = document.getElementById(targetId);
                    if (!target) return;

                    const isOpen = target.classList.contains('open');
                    target.classList.toggle('open', !isOpen);
                    el.querySelector('.tree-toggle').textContent = isOpen ? '▶' : '▼';
                });
            });

            // ═══ باز/بستن همه ═══
            document.getElementById('hesabExpandAll').addEventListener('click', () => {
                document.querySelectorAll('.tree-children').forEach(el => el.classList.add('open'));
                document.querySelectorAll('.tree-toggle').forEach(el => el.textContent = '▼');
            });

            document.getElementById('hesabCollapseAll').addEventListener('click', () => {
                document.querySelectorAll('.tree-children').forEach(el => el.classList.remove('open'));
                document.querySelectorAll('.tree-toggle').forEach(el => el.textContent = '▶');
            });

            // ⭐ دکمه‌های چاپ و Excel
            const self = this;
            Exporter.attach(c, {
                title: 'درخت حساب‌ها',
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: 'HesabTree',
                customHtml: () => self.buildHesabTreeHtml(cols, moeinMap)
            });

        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    // ⭐ ساخت HTML سلسله‌مراتبی برای چاپ و Excel
        buildHesabTreeHtml(cols, moeinMap) {
            const rows = [];

            cols.forEach(col => {
                const colM = this._mandehDisplay(col.mabMandeh, col.mahiat);

                // ─── ردیف کل ───
                rows.push(`
            <tr style="background:#EEF2FF; font-weight:bold;">
                <td class="num text-center">${col.codeCol}</td>
                <td colspan="2">${this.esc(col.name || '')}</td>
                <td class="text-center">${this._mahiatText(col.mahiat)}</td>
                <td class="num text-left">${this.fmt(col.sumBed)}</td>
                <td class="num text-left">${this.fmt(col.sumBes)}</td>
                <td class="num text-left" style="${colM.isNormal ? '' : 'color:#DC2626; font-weight:bold;'}">
                    ${colM.value} ${colM.direction}
                </td>
            </tr>
        `);

                // ─── ردیف معین‌ها ───
                const moeins = (moeinMap[col.codeCol] || [])
                    .sort((a, b) => a.codeMoein - b.codeMoein);

                moeins.forEach(moein => {
                    const mnt = this._mandehDisplay(moein.mabMandeh, moein.mahiat);

                    rows.push(`
                <tr>
                    <td class="num text-center" style="color:#6B7280;">${col.codeCol}</td>
                    <td style="color:#6B7280;">${this.esc(col.name || '')}</td>
                    <td class="num text-center">${moein.codeMoein}</td>
                    <td>${this.esc(moein.name || '')}</td>
                    <td class="text-center">${this._mahiatText(moein.mahiat)}</td>
                    <td class="num text-left">${this.fmt(moein.sumBed)}</td>
                    <td class="num text-left">${this.fmt(moein.sumBes)}</td>
                    <td class="num text-left" style="${mnt.isNormal ? '' : 'color:#DC2626; font-weight:bold;'}">
                        ${mnt.value} ${mnt.direction}
                    </td>
                </tr>
            `);
                });

                // ─── ردیف جمع ───
                if (moeins.length > 0) {
                    const totalBed = moeins.reduce((s, m) => s + (m.sumBed || 0), 0);
                    const totalBes = moeins.reduce((s, m) => s + (m.sumBes || 0), 0);
                    const totalMan = moeins.reduce((s, m) => s + (m.mabMandeh || 0), 0);
                    const totalM = this._mandehDisplay(totalMan, col.mahiat);

                    rows.push(`
                <tr style="background:#F9FAFB; font-weight:600;">
                    <td colspan="4" class="text-center" style="color:#6B7280; font-size:11px;">
                        جمع معین‌های حساب کل ${col.codeCol}
                    </td>
                    <td class="num text-left">${this.fmt(totalBed)}</td>
                    <td class="num text-left">${this.fmt(totalBes)}</td>
                    <td class="num text-left" style="${totalM.isNormal ? '' : 'color:#DC2626; font-weight:bold;'}">
                        ${totalM.value} ${totalM.direction}
                    </td>
                </tr>
            `);
                }
            });

            return `
        <table>
            <thead>
                <tr>
                    <th style="width:60px;">کد کل</th>
                    <th style="width:150px;">نام کل</th>
                    <th style="width:60px;">کد معین</th>
                    <th>نام معین</th>
                    <th style="width:70px;">ماهیت</th>
                    <th class="text-left" style="width:120px;">بدهکار</th>
                    <th class="text-left" style="width:120px;">بستانکار</th>
                    <th class="text-left" style="width:120px;">مانده</th>
                </tr>
            </thead>
            <tbody>
                ${rows.join('')}
            </tbody>
        </table>
    `;
        },

    // helper — تبدیل ماهیت به متن
    _mahiatText(m) {
        if (m == null) return '-';
        if (m === 1) return 'بدهکار';
        if (m === 2) return 'بستانکار';
        if (m === 3) return 'دو طرفه';
        return '-';
    },
    // ⭐ محاسبه‌ی نمایش مانده بر اساس ماهیت
    _mandehDisplay(mandehRaw, mahiat) {
        const raw = mandehRaw ?? 0;
        const abs = Math.abs(raw);

        // ─── وضعیت صفر ───
        if (raw === 0) {
            return {
                value: '-',
                direction: '',
                isNormal: true,
                isZero: true,
                colorStyle: 'color:#9CA3AF;',
                rowClass: ''
            };
        }

        // ─── آیا مانده‌ی بدهکار است یا بستانکار؟ ───
        const balanceIsDebit = raw > 0;   // Bed > Bes
        const balanceIsCredit = raw < 0;  // Bes > Bed

        // ─── ماهیت حساب ───
        const isDebitNature = mahiat === 1;
        const isCreditNature = mahiat === 2;

        // ─── آیا با ماهیت سازگاره؟ ───
        // حساب بدهکار با مانده بدهکار → عادی
        // حساب بستانکار با مانده بستانکار → عادی
        // غیر این صورت → غیرعادی
        const isNormal =
            (isDebitNature && balanceIsDebit) ||
            (isCreditNature && balanceIsCredit);

        // ─── نشانه‌ی مانده ───
        const direction = balanceIsDebit ? 'بد' : 'بس';

        // ─── رنگ ───
        // عادی → سبز، غیرعادی → قرمز
        const colorStyle = isNormal
            ? 'color:#059669; font-weight:600;'   // سبز
            : 'color:#DC2626; font-weight:700;';  // قرمز

        return {
            value: this.fmt(abs),
            direction,
            isNormal,
            isZero: false,
            colorStyle,
            rowClass: isNormal ? '' : 'row-abnormal'
        };
    },

    // ═══════════════════════════════════════════
    //  SHARH (شرح‌ها)
    // ═══════════════════════════════════════════
    async renderSharh() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const list = await this.api('/api/sharh') || [];

            c.innerHTML = `
                <div class="card">
                    <div class="card-title">شرح‌ها (${list.length})</div>
                    <div class="table-wrapper">
                        <table>
                            <thead><tr><th>کد</th><th>شرح</th></tr></thead>
                            <tbody>
                                ${list.map(s => `
                                    <tr>
                                        <td class="num">${s.sharhID ?? s.sharhId}</td>
                                        <td>${this.esc(s.sharhText || s.sharh)}</td>
                                    </tr>
                                `).join('') || '<tr><td colspan="2" class="text-center">موردی نیست</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            Exporter.attach(c, {
                table: c.querySelector('table'),
                title: 'شرح‌های اسناد',
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: 'SharhList'
            });
        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    // ═══════════════════════════════════════════
    //  KIND SANAD (انواع سند)
    // ═══════════════════════════════════════════
    async renderKindSanad() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const list = await this.api('/api/kindsanad') || [];

            c.innerHTML = `
                <div class="card">
                    <div class="card-title">انواع سند (${list.length})</div>
                    <div class="table-wrapper">
                        <table>
                            <thead><tr><th>کد</th><th>نام</th></tr></thead>
                            <tbody>
                                ${list.map(k => `
                                    <tr>
                                        <td class="num">${k.code}</td>
                                        <td>${this.esc(k.name)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            Exporter.attach(c, {
                table: c.querySelector('table'),
                title: 'انواع سند',
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: 'KindSanad'
            });
        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },
    // ═══════════════════════════════════════════
    //  FACTOR (فاکتورها)
    // ═══════════════════════════════════════════
    renderFactorList() {
        const c = document.getElementById('content');
        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>نوع فاکتور</label>
                    <select id="facKind">
                        <option value="">همه</option>
                        <option value="0">خرید</option>
                        <option value="1">فروش</option>
                        <option value="2">برگشت از خرید</option>
                        <option value="3">برگشت از فروش</option>
                        <option value="4">پیش فاکتور</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>از شماره</label>
                    <input type="number" id="facNoFrom">
                </div>
                <div class="form-group">
                    <label>تا شماره</label>
                    <input type="number" id="facNoTo">
                </div>
                <div class="form-group">
                    <label>از تاریخ</label>
                    <input type="text" id="facDateFrom" placeholder="1404/01/01">
                </div>
                <div class="form-group">
                    <label>تا تاریخ</label>
                    <input type="text" id="facDateTo" placeholder="1404/12/29">
                </div>
                <div class="form-group">
                    <label>از مبلغ</label>
                    <input type="number" id="facCostFrom">
                </div>
                <div class="form-group">
                    <label>تا مبلغ</label>
                    <input type="number" id="facCostTo">
                </div>
                <div class="form-group">
                    <label>کد طرف حساب</label>
                    <input type="number" id="facCodeTafzil">
                </div>
                <div class="form-group">
                    <label>نام طرف حساب</label>
                    <input type="text" id="facHesabName">
                </div>
                <div class="form-group">
                    <label>شرح</label>
                    <input type="text" id="facDescript">
                </div>
                <div class="form-group">
                    <label>کد کالا</label>
                    <input type="text" id="facArticleCode">
                </div>
                <div class="form-group">
                    <label>نام کالا</label>
                    <input type="text" id="facArticleName">
                </div>
            </div>
            <button class="btn btn-primary" id="facBtnRun">🔍 جستجو</button>
        </div>

        <div id="facResult">
            <div class="loading"><div class="spinner"></div></div>
        </div>
    `;

        document.getElementById('facBtnRun').addEventListener('click', () => this.runFactorList(1));
        this.runFactorList(1);
    },

    async runFactorList(page = 1) {
        const container = document.getElementById('facResult');
        if (!container) return;

        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };
        const parseDecOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseFloat(el.value);
        };

        const payload = {
            factorKind: parseIntOrNull('facKind'),
            noFrom: parseIntOrNull('facNoFrom'),
            noTo: parseIntOrNull('facNoTo'),
            dateFrom: document.getElementById('facDateFrom').value || null,
            dateTo: document.getElementById('facDateTo').value || null,
            costFrom: parseDecOrNull('facCostFrom'),
            costTo: parseDecOrNull('facCostTo'),
            codeTafzil: parseIntOrNull('facCodeTafzil'),
            hesabName: document.getElementById('facHesabName').value || null,
            descript: document.getElementById('facDescript').value || null,
            articleCode: document.getElementById('facArticleCode').value || null,
            articleName: document.getElementById('facArticleName').value || null,
            page: page,
            pageSize: this.state.settings.pageSize
        };

        try {
            const result = await this.api('/api/factor/list', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            this.renderFactorListResult(result);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    renderFactorListResult(data) {
        const container = document.getElementById('facResult');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📭</div>
                <p>فاکتوری یافت نشد</p>
            </div>`;
            return;
        }

        const rows = items.map(f => `
        <tr>
            <td class="num text-center">${f.noFactor || ''}</td>
            <td class="num">${this.esc(f.dateIn || '')}</td>
            <td>${this.esc(f.factorKindTitle || '')}</td>
            <td class="num">${f.codeTafzil || ''}</td>
            <td>${this.esc(f.hesabName || '')}</td>
            <td>${this.esc(f.isCashName || '')}</td>
            <td class="num text-left">${this.fmt(f.cost)}</td>
            <td>${this.esc(f.markerName || '')}</td>
            <td class="num text-center">${f.noSanad || ''}</td>
            <td>${this.esc(f.dateSanad || '')}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-ghost"
                        onclick="App.showFactorDetail(${f.id})">
                    🔍 مشاهده
                </button>
            </td>
        </tr>
    `).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        // ─── Pagination ───
        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                                onclick="App.runFactorList(${p})">${p}</button>`;
            }

            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${items.length.toLocaleString('fa-IR')} از ${totalCount.toLocaleString('fa-IR')} فاکتور
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runFactorList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runFactorList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runFactorList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runFactorList(${totalPages})">»</button>
                </div>
            </div>`;
        } else {
            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    مجموع: ${totalCount.toLocaleString('fa-IR')} فاکتور
                </div>
            </div>`;
        }

        container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>🧾 لیست فاکتورها (${totalCount.toLocaleString('fa-IR')})</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:70px;">شماره</th>
                            <th style="width:90px;">تاریخ</th>
                            <th style="width:110px;">نوع</th>
                            <th style="width:70px;">کد طرف</th>
                            <th>طرف حساب</th>
                            <th style="width:70px;">پرداخت</th>
                            <th class="text-left" style="width:130px;">مبلغ</th>
                            <th style="width:130px;">بازاریاب</th>
                            <th style="width:70px;">سند</th>
                            <th style="width:90px;">تاریخ سند</th>
                            <th style="width:90px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>
    `;

        Exporter.attach(container, {
            title: 'لیست فاکتورها',
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: 'FactorList',
            getFullTable: async () => {
                // خروجی کل: یک‌بار همه رو fetch کن
                const full = await this.api('/api/factor/list', {
                    method: 'POST',
                    body: JSON.stringify({
                        factorKind: this._parseIntOrNull('facKind'),
                        noFrom: this._parseIntOrNull('facNoFrom'),
                        noTo: this._parseIntOrNull('facNoTo'),
                        dateFrom: document.getElementById('facDateFrom').value || null,
                        dateTo: document.getElementById('facDateTo').value || null,
                        costFrom: this._parseDecOrNull('facCostFrom'),
                        costTo: this._parseDecOrNull('facCostTo'),
                        codeTafzil: this._parseIntOrNull('facCodeTafzil'),
                        hesabName: document.getElementById('facHesabName').value || null,
                        descript: document.getElementById('facDescript').value || null,
                        articleCode: document.getElementById('facArticleCode').value || null,
                        articleName: document.getElementById('facArticleName').value || null,
                        page: 1,
                        pageSize: 100000
                    })
                });
                return this.buildFactorTableHtml(full.items || []);
            }
        });
    },

    buildFactorTableHtml(items) {
        const rows = items.map(f => `
        <tr>
            <td class="num text-center">${f.noFactor || ''}</td>
            <td class="num">${this.esc(f.dateIn || '')}</td>
            <td>${this.esc(f.factorKindTitle || '')}</td>
            <td class="num">${f.codeTafzil || ''}</td>
            <td>${this.esc(f.hesabName || '')}</td>
            <td>${this.esc(f.isCashName || '')}</td>
            <td class="num text-left">${this.fmt(f.cost)}</td>
            <td>${this.esc(f.markerName || '')}</td>
            <td class="num text-center">${f.noSanad || ''}</td>
            <td>${this.esc(f.dateSanad || '')}</td>
        </tr>
    `).join('');

        const table = document.createElement('table');
        table.innerHTML = `
        <thead>
            <tr>
                <th>شماره</th>
                <th>تاریخ</th>
                <th>نوع</th>
                <th>کد طرف</th>
                <th>طرف حساب</th>
                <th>پرداخت</th>
                <th class="text-left">مبلغ</th>
                <th>بازاریاب</th>
                <th>سند</th>
                <th>تاریخ سند</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `;
        return table;
    },

    async showFactorDetail(factorId) {
        this.openModal('جزئیات فاکتور', `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const detail = await this.api(`/api/factor/${factorId}`);
            const h = detail.header || {};
            const items = detail.items || [];

            const rows = items.map((it, idx) => `
            <tr>
                <td class="num text-center">${idx + 1}</td>
                <td class="num">${it.articleCode || ''}</td>
                <td>${this.esc(it.articleName || '')}</td>
                <td>${this.esc(it.articleUnitName || '')}</td>
                <td class="num text-left">${this.fmt(it.articleCount)}</td>
                <td class="num text-left">${this.fmt(it.cost)}</td>
                <td class="num text-left">${this.fmt(it.costItem)}</td>
                <td class="num text-center">${it.perDiscount > 0 ? this.fmt(it.perDiscount) + '%' : '-'}</td>
                <td class="num text-left">${this.fmt(it.discount)}</td>
                <td class="num text-center">${it.taxFi > 0 ? this.fmt(it.taxFi) + '%' : '-'}</td>
                <td class="num text-left">${this.fmt(it.tax)}</td>
                <td class="num text-left">${this.fmt(it.transCost)}</td>
                <td class="num text-left">${this.fmt(it.finallCost)}</td>
            </tr>
        `).join('');

            const body = `
            <!-- ═══ سر فاکتور ═══ -->
            <div class="factor-header">
                <div class="factor-header-col">
                    <div class="factor-field">
                        <span class="factor-label">شماره فاکتور:</span>
                        <span class="factor-value">${h.noFactor || '-'}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">تاریخ:</span>
                        <span class="factor-value">${this.esc(h.dateIn || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">نوع:</span>
                        <span class="factor-value">${this.esc(h.factorKindTitle || '-')}</span>
                    </div>
                </div>
                <div class="factor-header-col">
                    <div class="factor-field">
                        <span class="factor-label">شماره سند:</span>
                        <span class="factor-value">${h.noSanad || '-'}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">تاریخ سند:</span>
                        <span class="factor-value">${this.esc(h.dateSanad || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">وضعیت:</span>
                        <span class="factor-value">${h.parentSanadId ? 'ثبت شده' : 'بدون سند'}</span>
                    </div>
                </div>
                <div class="factor-header-col">
                    <div class="factor-field">
                        <span class="factor-label">بازاریاب:</span>
                        <span class="factor-value">${this.esc(h.markerName || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">موبایل بازاریاب:</span>
                        <span class="factor-value">${this.esc(h.markerMobile || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">شماره ماشین:</span>
                        <span class="factor-value">${this.esc(h.carInfo || '-')}</span>
                    </div>
                </div>
            </div>

            <!-- ═══ طرف حساب ═══ -->
            <div class="factor-party">
                <h4>👤 اطلاعات طرف حساب</h4>
                <div class="factor-party-grid">
                    <div class="factor-field">
                        <span class="factor-label">نام:</span>
                        <span class="factor-value">${this.esc(h.hesabName || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">کد تفصیلی:</span>
                        <span class="factor-value">${h.codeTafzil || '-'}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">تلفن:</span>
                        <span class="factor-value">${this.esc(h.phone || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">موبایل:</span>
                        <span class="factor-value">${this.esc(h.mobile || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">کد اقتصادی:</span>
                        <span class="factor-value">${this.esc(h.economicCode || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">کد ملی:</span>
                        <span class="factor-value">${this.esc(h.nationalCode || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">کد پستی:</span>
                        <span class="factor-value">${this.esc(h.postalCode || '-')}</span>
                    </div>
                    <div class="factor-field">
                        <span class="factor-label">استان/شهر:</span>
                        <span class="factor-value">${this.esc(h.stateName || '')} - ${this.esc(h.cityName1 || '')}</span>
                    </div>
                    <div class="factor-field factor-field-wide">
                        <span class="factor-label">آدرس:</span>
                        <span class="factor-value">${this.esc(h.address || '-')}</span>
                    </div>
                </div>
            </div>

            <!-- ═══ شرح ═══ -->
            ${h.descript ? `
            <div class="factor-descript">
                <span class="factor-label">شرح:</span>
                <span>${this.esc(h.descript)}</span>
            </div>` : ''}

            <!-- ═══ ردیف‌ها ═══ -->
            <h4 style="margin:16px 0 8px;">📋 ردیف‌های کالا (${items.length})</h4>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:35px;">#</th>
                            <th style="width:70px;">کد کالا</th>
                            <th>نام کالا</th>
                            <th style="width:55px;">واحد</th>
                            <th class="text-left" style="width:70px;">تعداد</th>
                            <th class="text-left" style="width:100px;">قیمت واحد</th>
                            <th class="text-left" style="width:110px;">مبلغ کل</th>
                            <th class="text-center" style="width:60px;">تخفیف %</th>
                            <th class="text-left" style="width:90px;">مبلغ تخفیف</th>
                            <th class="text-center" style="width:60px;">ارزش افزوده %</th>
                            <th class="text-left" style="width:90px;">مبلغ مالیات</th>
                            <th class="text-left" style="width:80px;">حمل</th>
                            <th class="text-left" style="width:110px;">جمع نهایی</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="10" class="text-center">ردیفی وجود ندارد</td></tr>'}</tbody>
                    <tfoot>
                        <tr style="background:#EEF2FF; font-weight:700;">
                            <td colspan="4" class="text-center">جمع کل</td>
                            <td class="num text-left">${this.fmt(detail.totalRows)} ردیف</td>
                            <td colspan="3" class="num text-left">تخفیف: ${this.fmt(detail.totalDiscount)}</td>
                            <td colspan="2" class="num text-left">مالیات: ${this.fmt(detail.totalTax)}</td>
                            <td class="num text-left">حمل: ${this.fmt(detail.totalTransCost)}</td>
                            <td class="num text-left">${this.fmt(detail.totalFinall)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- ═══ جمع نهایی ═══ -->
            <div class="factor-totals">
                <div class="factor-total-item">
                    <span class="factor-label">مبلغ کالاها:</span>
                    <span class="factor-value">${this.fmt(detail.totalCostItem)}</span>
                </div>
                <div class="factor-total-item">
                    <span class="factor-label">جمع تخفیف:</span>
                    <span class="factor-value">${this.fmt(detail.totalDiscount)}</span>
                </div>
                <div class="factor-total-item">
                    <span class="factor-label">جمع مالیات و عوارض:</span>
                    <span class="factor-value">${this.fmt(detail.totalTax)}</span>
                </div>
                <div class="factor-total-item">
                    <span class="factor-label">جمع حمل:</span>
                    <span class="factor-value">${this.fmt(detail.totalTransCost)}</span>
                </div>
                <div class="factor-total-item factor-total-final">
                    <span class="factor-label">مبلغ نهایی:</span>
                    <span class="factor-value">${this.fmt(detail.totalFinall)}</span>
                </div>
            </div>
        `;

            document.getElementById('modalBody').innerHTML = body;

            // ⭐ دکمه‌های خروجی با HTML کامل
            const modalBody = document.getElementById('modalBody');
            const self = this;
            Exporter.attach(modalBody, {
                title: `${h.factorKindTitle || 'فاکتور'} - شماره ${h.noFactor || ''}`,
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: `Factor_${h.noFactor || factorId}`,
                customHtml: () => self.buildFactorPrintHtml(h, items, detail)
            });
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
    },
    // ═══════════════════════════════════════════
    //  ARTICLE (کالاها)
    // ═══════════════════════════════════════════
    renderArticleList() {
        const c = document.getElementById('content');
        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد کالا</label>
                    <input type="text" id="artCode">
                </div>
                <div class="form-group">
                    <label>نام کالا</label>
                    <input type="text" id="artName">
                </div>
                <div class="form-group">
                    <label>شناسه مالیاتی</label>
                    <input type="text" id="artTaxId">
                </div>
                <div class="form-group">
                    <label>گروه کالا</label>
                    <input type="number" id="artGroupId">
                </div>
                <div class="form-group">
                    <label>انبار</label>
                    <input type="number" id="artStockTypeId">
                </div>
                <div class="form-group">
                    <label>واحد</label>
                    <input type="number" id="artUnitId">
                </div>
                <div class="form-group">
                    <label>وضعیت موجودی</label>
                    <div class="custom-select" id="artStockFilterWrap">
                        <button type="button" class="custom-select-trigger" id="artStockFilterTrigger">
                            <span class="custom-select-value">همه کالاها</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="artStockFilterMenu">
                            <div class="custom-select-option selected" data-value="all">همه کالاها</div>
                            <div class="custom-select-option" data-value="hasStock">فقط دارای موجودی</div>
                            <div class="custom-select-option" data-value="noStock">فقط موجودی صفر</div>
                            <div class="custom-select-option" data-value="negativeStock">فقط موجودی منفی</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="artBtnRun">🔍 جستجو</button>
                </div>
            </div>
        </div>
        <div id="artResult">
            <div class="loading"><div class="spinner"></div></div>
        </div>
    `;

        // ═══ Custom Select برای فیلتر موجودی ═══
        this._stockFilterValue = 'all';

        const wrap = document.getElementById('artStockFilterWrap');
        const trigger = document.getElementById('artStockFilterTrigger');
        const menu = document.getElementById('artStockFilterMenu');
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this._stockFilterValue = opt.dataset.value;
                valueEl.textContent = opt.textContent;
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
            });
        });

        const closeHandler = (e) => {
            if (!wrap.contains(e.target)) wrap.classList.remove('open');
        };
        document.addEventListener('click', closeHandler);

        document.getElementById('artBtnRun').addEventListener('click', () => this.runArticleList(1));
        this.runArticleList(1);
    },

    async runArticleList(page = 1) {
        const container = document.getElementById('artResult');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const payload = {
            code: document.getElementById('artCode')?.value || null,
            name: document.getElementById('artName')?.value || null,
            taxId: document.getElementById('artTaxId')?.value || null,
            groupId: parseIntOrNull('artGroupId'),
            stockTypeId: parseIntOrNull('artStockTypeId'),
            unitId: parseIntOrNull('artUnitId'),
            stockFilter: this._stockFilterValue || 'all',
            page: page,
            pageSize: this.state.settings.pageSize
        };

        try {
            const data = await this.api('/api/article/list', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            this.renderArticleListResult(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    renderArticleListResult(data) {
        const container = document.getElementById('artResult');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📭</div>
                <p>کالایی یافت نشد</p>
            </div>`;
            return;
        }

        const rows = items.map(a => {
            const stock = a.finallExistence ?? 0;
            const stockClass = stock > 0
                ? 'color:#059669; font-weight:600;'
                : (stock < 0 ? 'color:#DC2626; font-weight:600;' : 'color:#6B7280;');

            return `
            <tr>
                <td class="num text-center">${a.code || ''}</td>
                <td>${this.esc(a.name || '')}</td>
                <td class="num text-center">${a.taxId || '-'}</td>
                <td>${this.esc(a.articleGroupName || '')}</td>
                <td>${this.esc(a.stockTypeName || '')}</td>
                <td>${this.esc(a.articleUnitName || '')}</td>
                <td class="num text-left" style="${stockClass}">${this.fmt(stock)}</td>
                <td class="num text-left">${this.fmt(a.amountSale)}</td>
                <td class="text-center">${this.esc(a.statusName || '')}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-ghost"
                            onclick="App.showArticleDetail(${a.id})">
                        🔍 مشاهده
                    </button>
                </td>
            </tr>
        `;
        }).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                                onclick="App.runArticleList(${p})">${p}</button>`;
            }

            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${items.length.toLocaleString('fa-IR')} از ${totalCount.toLocaleString('fa-IR')} کالا
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runArticleList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runArticleList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runArticleList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runArticleList(${totalPages})">»</button>
                </div>
            </div>`;
        } else {
            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">مجموع: ${totalCount.toLocaleString('fa-IR')} کالا</div>
            </div>`;
        }

        container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>🏷️ لیست کالاها (${totalCount.toLocaleString('fa-IR')})</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:90px;">کد</th>
                            <th>نام کالا</th>
                            <th style="width:100px;">شناسه مالیاتی</th>
                            <th style="width:110px;">گروه</th>
                            <th style="width:120px;">انبار</th>
                            <th style="width:80px;">واحد</th>
                            <th class="text-left" style="width:100px;">موجودی</th>
                            <th class="text-left" style="width:110px;">قیمت فروش</th>
                            <th style="width:80px;">وضعیت</th>
                            <th style="width:90px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>
    `;

        const self = this;
        Exporter.attach(container, {
            title: 'لیست کالاها',
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: 'ArticleList',
            getFullTable: async () => {
                const parseIntOrNull = (id) => {
                    const el = document.getElementById(id);
                    if (!el) return null;
                    return el.value === '' ? null : parseInt(el.value);
                };
                const payload = {
                    code: document.getElementById('artCode')?.value || null,
                    name: document.getElementById('artName')?.value || null,
                    taxId: document.getElementById('artTaxId')?.value || null,
                    groupId: parseIntOrNull('artGroupId'),
                    stockTypeId: parseIntOrNull('artStockTypeId'),
                    unitId: parseIntOrNull('artUnitId'),
                    stockFilter: self._stockFilterValue || 'all',
                    page: 1,
                    pageSize: 100000
                };
                const full = await self.api('/api/article/list', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                return self.buildArticleTableHtml(full.items || []);
            }
        });
    }, 

    buildArticleTableHtml(items) {
        const rows = items.map(a => `
        <tr>
            <td class="num text-center">${a.code || ''}</td>
            <td>${this.esc(a.name || '')}</td>
            <td class="num text-center">${a.taxId || '-'}</td>
            <td>${this.esc(a.articleGroupName || '')}</td>
            <td>${this.esc(a.stockTypeName || '')}</td>
            <td>${this.esc(a.articleUnitName || '')}</td>
            <td class="num text-left">${this.fmt(a.finallExistence)}</td>
            <td class="num text-left">${this.fmt(a.amountSale)}</td>
            <td class="text-center">${this.esc(a.statusName || '')}</td>
        </tr>
    `).join('');

        const table = document.createElement('table');
        table.innerHTML = `
        <thead>
            <tr>
                <th>کد</th>
                <th>نام کالا</th>
                <th>شناسه مالیاتی</th>
                <th>گروه</th>
                <th>انبار</th>
                <th>واحد</th>
                <th class="text-left">موجودی</th>
                <th class="text-left">قیمت فروش</th>
                <th>وضعیت</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `;
        return table;
    },

    async showArticleDetail(articleId) {
        this.openModal('جزئیات کالا', `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const d = await this.api(`/api/article/${articleId}`);

            const body = `
            <!-- ═══ اطلاعات پایه ═══ -->
            <div class="section-title">📋 اطلاعات پایه</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">کد کالا:</td>
                    <td>${d.code || '-'}</td>
                    <td class="label">نام کالا:</td>
                    <td colspan="3">${this.esc(d.name || '-')}</td>
                </tr>
                <tr>
                    <td class="label">گروه:</td>
                    <td>${this.esc(d.articleGroupName || '-')} (${d.articleGroupCode || ''})</td>
                    <td class="label">انبار:</td>
                    <td>${this.esc(d.stockTypeName || '-')} (${d.stockTypeCode || ''})</td>
                    <td class="label">وضعیت:</td>
                    <td>${this.esc(d.statusName || '-')}</td>
                </tr>
                ${d.articleCoding ? `
                <tr>
                    <td class="label">کدینگ کالا:</td>
                    <td colspan="5">${this.esc(d.articleCoding)}</td>
                </tr>` : ''}
            </table>

            <!-- ═══ واحدها ═══ -->
            <div class="section-title">📏 واحدها</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">واحد اصلی:</td>
                    <td>${this.esc(d.articleUnitName || '-')}</td>
                    <td class="label">واحد دوم:</td>
                    <td>${this.esc(d.articleUnitName2 || '-')} ${d.tabdil2 ? '(تبدیل: ' + d.tabdil2 + ')' : ''}</td>
                    <td class="label">واحد سوم:</td>
                    <td>${this.esc(d.articleUnitName3 || '-')} ${d.tabdil3 ? '(تبدیل: ' + d.tabdil3 + ')' : ''}</td>
                </tr>
            </table>

            <!-- ═══ موجودی ═══ -->
            <div class="section-title">📦 موجودی</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">موجودی اول دوره:</td>
                    <td class="num">${this.fmt(d.firstExistence)}</td>
                    <td class="label">ورودی:</td>
                    <td class="num">${this.fmt(d.inputed)}</td>
                    <td class="label">خروجی:</td>
                    <td class="num">${this.fmt(d.outPuted)}</td>
                </tr>
                <tr>
                    <td class="label">ضایعات ۱:</td>
                    <td class="num">${this.fmt(d.loss1)}</td>
                    <td class="label">ضایعات ۲:</td>
                    <td class="num">${this.fmt(d.loss2)}</td>
                    <td class="label">موجودی فعلی:</td>
                    <td class="num" style="font-weight:bold; color:#4F46E5;">${this.fmt(d.finallExistence)}</td>
                </tr>
            </table>

            <!-- ═══ قیمت‌ها ═══ -->
            <div class="section-title">💰 قیمت‌ها</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">موجودی اولیه (مقدار):</td>
                    <td class="num">${this.fmt(d.amountFirst)}</td>
                    <td class="label">بهای اولیه:</td>
                    <td class="num">${this.fmt(d.costFirst)}</td>
                    <td class="label">قیمت فروش:</td>
                    <td class="num" style="font-weight:bold;">${this.fmt(d.amountSale)}</td>
                </tr>
            </table>

            <!-- ═══ کدینگ حسابداری ═══ -->
            <div class="section-title">🔢 کدینگ حسابداری</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">پیش‌فرض (کل-معین-تفصیل):</td>
                    <td colspan="5">${d.codeCol || 0} - ${d.codeMoein || 0} - ${d.codeTafzil || 0}</td>
                </tr>
                <tr>
                    <td class="label">خرید:</td>
                    <td>${d.codeColBuy || 0} - ${d.codeMoeinBuy || 0} - ${d.codeTafzilBuy || 0}</td>
                    <td class="label">برگشت از خرید:</td>
                    <td>${d.codeColReBuy || 0} - ${d.codeMoeinReBuy || 0} - ${d.codeTafzilReBuy || 0}</td>
                    <td class="label">برگشت از فروش:</td>
                    <td>${d.codeColReSale || 0} - ${d.codeMoeinReSale || 0} - ${d.codeTafzilReSale || 0}</td>
                </tr>
            </table>

            <!-- ═══ تنظیمات ═══ -->
            <div class="section-title">⚙️ تنظیمات</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">درصد بازاریاب:</td>
                    <td class="num">${d.marketerPercent ? d.marketerPercent + '%' : '-'}</td>
                    <td class="label">حد سفارش (ورود):</td>
                    <td class="num">${this.fmt(d.maxCostOrderBy)}</td>
                    <td class="label">حد سفارش (خروج):</td>
                    <td class="num">${this.fmt(d.minCostOrderBy)}</td>
                </tr>
                <tr>
                    <td class="label">استهلاک:</td>
                    <td>${this.esc(d.depreciationTypeName || '-')} (${d.depreciation || 0})</td>
                    <td class="label">کنترل موجودی منفی:</td>
                    <td>${d.xIsRegNegativKala ? '✅ فعال' : '❌ غیرفعال'}</td>
                    <td class="label">محاسبه ارزش افزوده:</td>
                    <td>${d.xNotCalcArezeshafzode ? '❌ غیرفعال' : '✅ فعال'}</td>
                </tr>
            </table>
        `;

            document.getElementById('modalBody').innerHTML = body;

            const self = this;
            Exporter.attach(document.getElementById('modalBody'), {
                title: `کالا: ${d.name || ''} (${d.code || ''})`,
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: `Article_${d.code || articleId}`,
                customHtml: () => self.buildArticlePrintHtml(d)
            });
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
    },

    buildArticlePrintHtml(d) {
        const unitInfo = `
        <tr>
            <td class="label">واحد اصلی:</td>
            <td>${this.esc(d.articleUnitName || '-')}</td>
            <td class="label">واحد دوم:</td>
            <td>${this.esc(d.articleUnitName2 || '-')}</td>
            <td class="label">تبدیل دوم:</td>
            <td>${d.tabdil2 ?? '-'}</td>
        </tr>
        <tr>
            <td class="label">واحد سوم:</td>
            <td>${this.esc(d.articleUnitName3 || '-')}</td>
            <td class="label">تبدیل سوم:</td>
            <td>${d.tabdil3 ?? '-'}</td>
            <td></td>
            <td></td>
        </tr>`;

        const existInfo = `
        <tr>
            <td class="label">موجودی اول دوره:</td>
            <td class="num text-left">${this.fmt(d.firstExistence)}</td>
            <td class="label">ورودی:</td>
            <td class="num text-left">${this.fmt(d.inputed)}</td>
            <td class="label">خروجی:</td>
            <td class="num text-left">${this.fmt(d.outPuted)}</td>
        </tr>
        <tr>
            <td class="label">ضایعات ۱:</td>
            <td class="num text-left">${this.fmt(d.loss1)}</td>
            <td class="label">ضایعات ۲:</td>
            <td class="num text-left">${this.fmt(d.loss2)}</td>
            <td class="label">موجودی فعلی:</td>
            <td class="num text-left" style="font-weight:bold; color:#4F46E5;">${this.fmt(d.finallExistence)}</td>
        </tr>`;

        const priceInfo = `
        <tr>
            <td class="label">موجودی اولیه:</td>
            <td class="num text-left">${this.fmt(d.amountFirst)}</td>
            <td class="label">بهای اولیه:</td>
            <td class="num text-left">${this.fmt(d.costFirst)}</td>
            <td class="label">قیمت فروش:</td>
            <td class="num text-left" style="font-weight:bold;">${this.fmt(d.amountSale)}</td>
        </tr>`;

        return `
        <table class="factor-info-table">
            <tr>
                <td class="label">کد کالا:</td>
                <td>${d.code || '-'}</td>
                <td class="label">نام کالا:</td>
                <td colspan="3">${this.esc(d.name || '-')}</td>
            </tr>
            <tr>
                <td class="label">گروه:</td>
                <td>${this.esc(d.articleGroupName || '-')} (${d.articleGroupCode || ''})</td>
                <td class="label">انبار:</td>
                <td>${this.esc(d.stockTypeName || '-')} (${d.stockTypeCode || ''})</td>
                <td class="label">وضعیت:</td>
                <td>${this.esc(d.statusName || '-')}</td>
            </tr>
        </table>

        <div class="section-title">📏 واحدها</div>
        <table class="factor-info-table">${unitInfo}</table>

        <div class="section-title">📦 موجودی</div>
        <table class="factor-info-table">${existInfo}</table>

        <div class="section-title">💰 قیمت‌ها</div>
        <table class="factor-info-table">${priceInfo}</table>

        <div class="section-title">🔢 کدینگ حسابداری</div>
        <table class="factor-info-table">
            <tr>
                <td class="label">پیش‌فرض:</td>
                <td colspan="5">${d.codeCol || 0} - ${d.codeMoein || 0} - ${d.codeTafzil || 0}</td>
            </tr>
            <tr>
                <td class="label">خرید:</td>
                <td>${d.codeColBuy || 0} - ${d.codeMoeinBuy || 0} - ${d.codeTafzilBuy || 0}</td>
                <td class="label">برگشت خرید:</td>
                <td>${d.codeColReBuy || 0} - ${d.codeMoeinReBuy || 0} - ${d.codeTafzilReBuy || 0}</td>
                <td class="label">برگشت فروش:</td>
                <td>${d.codeColReSale || 0} - ${d.codeMoeinReSale || 0} - ${d.codeTafzilReSale || 0}</td>
            </tr>
        </table>

        <div class="section-title">⚙️ تنظیمات</div>
        <table class="factor-info-table">
            <tr>
                <td class="label">درصد بازاریاب:</td>
                <td class="num text-left">${d.marketerPercent ? d.marketerPercent + '%' : '-'}</td>
                <td class="label">حد سفارش (ورود):</td>
                <td class="num text-left">${this.fmt(d.maxCostOrderBy)}</td>
                <td class="label">حد سفارش (خروج):</td>
                <td class="num text-left">${this.fmt(d.minCostOrderBy)}</td>
            </tr>
            <tr>
                <td class="label">استهلاک:</td>
                <td>${this.esc(d.depreciationTypeName || '-')}</td>
                <td class="label">کنترل موجودی منفی:</td>
                <td>${d.xIsRegNegativKala ? '✅ فعال' : '❌ غیرفعال'}</td>
                <td class="label">محاسبه ارزش افزوده:</td>
                <td>${d.xNotCalcArezeshafzode ? '❌ غیرفعال' : '✅ فعال'}</td>
            </tr>
        </table>
    `;
    },
    // ⭐ ساخت HTML کامل فاکتور برای چاپ و Excel
    buildFactorPrintHtml(h, items, detail) {
        // ─── اطلاعات فاکتور ───
        const headerRows = `
        <table class="factor-info-table">
            <tr>
                <td class="label">شماره فاکتور:</td>
                <td>${h.noFactor || '-'}</td>
                <td class="label">تاریخ:</td>
                <td>${this.esc(h.dateIn || '-')}</td>
                <td class="label">نوع:</td>
                <td>${this.esc(h.factorKindTitle || '-')}</td>
                <td class="label">شماره سند:</td>
                <td>${h.noSanad || '-'}</td>
                <td class="label">تاریخ سند:</td>
                <td>${this.esc(h.dateSanad || '-')}</td>
            </tr>
        </table>
    `;

        // ─── اطلاعات طرف حساب ───
        const partyRows = `
        <div class="section-title">👤 اطلاعات طرف حساب</div>
        <table class="factor-info-table">
            <tr>
                <td class="label">نام:</td>
                <td>${this.esc(h.hesabName || '-')}</td>
                <td class="label">کد تفصیلی:</td>
                <td>${h.codeTafzil || '-'}</td>
                <td class="label">تلفن:</td>
                <td>${this.esc(h.phone || '-')}</td>
                <td class="label">موبایل:</td>
                <td>${this.esc(h.mobile || '-')}</td>
            </tr>
            <tr>
                <td class="label">کد اقتصادی:</td>
                <td>${this.esc(h.economicCode || '-')}</td>
                <td class="label">کد ملی:</td>
                <td>${this.esc(h.nationalCode || '-')}</td>
                <td class="label">کد پستی:</td>
                <td>${this.esc(h.postalCode || '-')}</td>
                <td class="label">استان/شهر:</td>
                <td>${this.esc(h.stateName || '')} / ${this.esc(h.cityName1 || '')}</td>
            </tr>
            <tr>
                <td class="label">آدرس:</td>
                <td colspan="7">${this.esc(h.address || '-')}</td>
            </tr>
            ${h.markerName ? `
            <tr>
                <td class="label">بازاریاب:</td>
                <td>${this.esc(h.markerName)}</td>
                <td class="label">موبایل بازاریاب:</td>
                <td>${this.esc(h.markerMobile || '-')}</td>
                <td class="label">شماره ماشین:</td>
                <td colspan="3">${this.esc(h.carInfo || '-')}</td>
            </tr>` : ''}
        </table>
    `;

        // ─── شرح ───
        const descriptBlock = h.descript ? `
        <div class="section-title">📝 شرح</div>
        <table class="factor-info-table">
            <tr><td>${this.esc(h.descript)}</td></tr>
        </table>
    ` : '';

        // ─── اقلام ───
        const itemsRows = items.map((it, idx) => `
        <tr>
            <td class="num text-center">${idx + 1}</td>
            <td class="num text-center">${it.articleCode || ''}</td>
            <td>${this.esc(it.articleName || '')}</td>
            <td class="text-center">${this.esc(it.articleUnitName || '')}</td>
            <td class="num text-left">${this.fmt(it.articleCount)}</td>
            <td class="num text-left">${this.fmt(it.cost)}</td>
            <td class="num text-left">${this.fmt(it.costItem)}</td>
            <td class="num text-center">${it.perDiscount > 0 ? this.fmt(it.perDiscount) + '%' : '-'}</td>
            <td class="num text-left">${this.fmt(it.discount)}</td>
            <td class="num text-center">${it.taxFi > 0 ? this.fmt(it.taxFi) + '%' : '-'}</td>
            <td class="num text-left">${this.fmt(it.tax)}</td>
            <td class="num text-left">${this.fmt(it.transCost)}</td>
            <td class="num text-left">${this.fmt(it.finallCost)}</td>
        </tr>
    `).join('');

        const itemsBlock = `
        <div class="section-title">📋 ردیف‌های کالا (${items.length})</div>
        <table>
            <thead>
                <tr>
                    <th style="width:30px;">#</th>
                    <th style="width:70px;">کد کالا</th>
                    <th>نام کالا</th>
                    <th style="width:55px;">واحد</th>
                    <th style="width:70px;">تعداد</th>
                    <th style="width:100px;">قیمت واحد</th>
                    <th style="width:110px;">مبلغ کل</th>
                    <th style="width:60px;">تخفیف %</th>
                    <th style="width:90px;">مبلغ تخفیف</th>
                    <th style="width:60px;">ارزش افزوده %</th>
                    <th style="width:90px;">مبلغ مالیات</th>
                    <th style="width:70px;">حمل</th>
                    <th style="width:110px;">جمع نهایی</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRows || '<tr><td colspan="13" class="text-center">ردیفی وجود ندارد</td></tr>'}
            </tbody>
        </table>
    `;

        // ─── جمع‌ها ───
        const totalsBlock = `
        <table class="totals-table">
            <tr>
                <td class="label" style="width:150px;">تعداد ردیف:</td>
                <td class="num text-left">${detail.totalRows}</td>
                <td class="label" style="width:150px;">مبلغ کالاها:</td>
                <td class="num text-left">${this.fmt(detail.totalCostItem)}</td>
                <td class="label" style="width:130px;">جمع تخفیف:</td>
                <td class="num text-left">${this.fmt(detail.totalDiscount)}</td>
            </tr>
            <tr>
                <td class="label">جمع مالیات و عوارض:</td>
                <td class="num text-left">${this.fmt(detail.totalTax)}</td>
                <td class="label">جمع حمل:</td>
                <td class="num text-left">${this.fmt(detail.totalTransCost)}</td>
                <td class="label">مبلغ نهایی:</td>
                <td class="num text-left" style="font-weight:bold; color:#4F46E5; font-size:13px;">
                    ${this.fmt(detail.totalFinall)}
                </td>
            </tr>
        </table>
    `;

        return headerRows + partyRows + descriptBlock + itemsBlock + totalsBlock;
    },
    // ═══════════════════════════════════════════
    //  TAFZILI (تفضیلی‌ها)
    // ═══════════════════════════════════════════
    async renderTafziliList() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        // بارگذاری لیست گروه‌ها
        let groups = [];
        try {
            groups = await this.api('/api/tafzili/groups') || [];
        } catch (err) {
            console.error('Failed to load groups:', err);
        }

        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد تفضیلی</label>
                    <input type="text" id="tafCode">
                </div>
                <div class="form-group">
                    <label>نام</label>
                    <input type="text" id="tafName">
                </div>
                <div class="form-group">
                    <label>گروه تفضیلی</label>
                    <div class="custom-select" id="tafGroupWrap">
                        <button type="button" class="custom-select-trigger" id="tafGroupTrigger">
                            <span class="custom-select-value">همه گروه‌ها</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="tafGroupMenu">
                            <div class="custom-select-option selected" data-value="">همه گروه‌ها</div>
                            ${groups.map(g => `
                                <div class="custom-select-option" data-value="${g.id}">
                                    ${this.esc(g.name || '')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>نوع</label>
                    <div class="custom-select" id="tafKindWrap">
                        <button type="button" class="custom-select-trigger" id="tafKindTrigger">
                            <span class="custom-select-value">همه</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="tafKindMenu">
                            <div class="custom-select-option selected" data-value="">همه</div>
                            <div class="custom-select-option" data-value="0">عادی</div>
                            <div class="custom-select-option" data-value="1">حقیقی</div>
                            <div class="custom-select-option" data-value="2">حقوقی شرکت</div>
                            <div class="custom-select-option" data-value="3">حقوقی سازمان</div>
                            <div class="custom-select-option" data-value="4">بازاریاب</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>وضعیت مانده</label>
                    <div class="custom-select" id="tafMandehWrap">
                        <button type="button" class="custom-select-trigger" id="tafMandehTrigger">
                            <span class="custom-select-value">همه</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="tafMandehMenu">
                            <div class="custom-select-option selected" data-value="all">همه</div>
                            <div class="custom-select-option" data-value="hasMandeh">فقط دارای مانده</div>
                            <div class="custom-select-option" data-value="noMandeh">فقط مانده صفر</div>
                            <div class="custom-select-option" data-value="hasBed">فقط دارای گردش بدهکار</div>
                            <div class="custom-select-option" data-value="hasBes">فقط دارای گردش بستانکار</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>موبایل</label>
                    <input type="text" id="tafMobile">
                </div>
                <div class="form-group">
                    <label>کد ملی</label>
                    <input type="text" id="tafMelliCode">
                </div>
                <div class="form-group">
                    <label>کد اقتصادی</label>
                    <input type="text" id="tafEconomicCode">
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
             <button class="btn btn-primary btn-block" id="tafBtnRun">🔍 جستجو</button>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-ghost btn-block" id="tafBtnManageGroups">
                        ⚙️ مدیریت گروه‌ها
                    </button>
                </div>
            </div>
        <div id="tafResult">
            <div class="loading"><div class="spinner"></div></div>
        </div>
    `;

        // ─── مقادیر انتخاب‌شده ───
        this._tafGroupId = '';
        this._tafKind = '';
        this._tafMandeh = 'all';

        // ─── راه‌اندازی custom selects ───
        this._initTafCustomSelect('tafGroupWrap', 'tafGroupTrigger', 'tafGroupMenu', (v) => {
            this._tafGroupId = v;
        });
        this._initTafCustomSelect('tafKindWrap', 'tafKindTrigger', 'tafKindMenu', (v) => {
            this._tafKind = v;
        });
        this._initTafCustomSelect('tafMandehWrap', 'tafMandehTrigger', 'tafMandehMenu', (v) => {
            this._tafMandeh = v;
        });

        document.getElementById('tafBtnRun').addEventListener('click', () => this.runTafziliList(1));
        this.runTafziliList(1);

        document.getElementById('tafBtnManageGroups').addEventListener('click', () => {
            this.openGroupManager();
        });
    },

    _initTafCustomSelect(wrapId, triggerId, menuId, onChange) {
        const wrap = document.getElementById(wrapId);
        const trigger = document.getElementById(triggerId);
        const menu = document.getElementById(menuId);
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(el => {
                if (el !== wrap) el.classList.remove('open');
            });
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                valueEl.textContent = opt.textContent.trim();
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
                onChange(opt.dataset.value);
            });
        });
    },
    async openGroupManager() {
        const body = `
        <div style="margin-bottom:16px;">
            <button class="btn btn-primary" id="grpAddBtn">➕ گروه جدید</button>
        </div>
        <div id="grpList"><div class="loading"><div class="spinner"></div></div></div>
    `;

        this.openModal('⚙️ مدیریت گروه‌های تفضیلی', body);

        const modalBody = document.getElementById('modalBody');

        modalBody.querySelector('#grpAddBtn').addEventListener('click', () => {
            this._showGroupForm(null);
        });

        await this._loadGroupList();
    },

    async _loadGroupList() {
        const container = document.getElementById('grpList');
        if (!container) return;

        try {
            const groups = await this.api('/api/tafzili/groups') || [];

            if (groups.length === 0) {
                container.innerHTML = `<div class="empty"><p>گروهی تعریف نشده</p></div>`;
                return;
            }

            container.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:60px;">کد</th>
                            <th>نام گروه</th>
                            <th style="width:150px;">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groups.map(g => `
                            <tr>
                                <td class="num text-center">${g.id}</td>
                                <td>${this.esc(g.name || '')}</td>
                                <td class="text-center">
                                    <button class="btn btn-sm btn-ghost"
                                            onclick="App._showGroupForm(${g.id}, '${this.esc(g.name || '').replace(/'/g, "\\'")}')">
                                        ✏️ ویرایش
                                    </button>
                                    <button class="btn btn-sm btn-ghost" style="color:var(--danger);"
                                            onclick="App._deleteGroup(${g.id}, '${this.esc(g.name || '').replace(/'/g, "\\'")}')">
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        } catch (err) {
            container.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    _showGroupForm(id, name = '') {
        const body = `
        <div class="form-group">
            <label>نام گروه *</label>
            <input type="text" id="grpName" class="form-select" style="padding:10px 14px;" value="${this.esc(name)}">
        </div>
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn btn-primary" id="grpSaveBtn">💾 ذخیره</button>
            <button class="btn btn-ghost" id="grpCancelBtn">انصراف</button>
        </div>
    `;

        this.openModal(id ? '✏️ ویرایش گروه' : '➕ گروه جدید', body);

        const modalBody = document.getElementById('modalBody');
        const nameInput = modalBody.querySelector('#grpName');
        setTimeout(() => nameInput.focus(), 100);

        modalBody.querySelector('#grpSaveBtn').addEventListener('click', async () => {
            const groupName = nameInput.value.trim();
            if (!groupName) {
                this.toast('نام گروه الزامی است', 'error');
                return;
            }

            try {
                await this.api('/api/tafzili/groups/save', {
                    method: 'POST',
                    body: JSON.stringify({ id: id || null, name: groupName })
                });

                this.toast(id ? 'گروه ویرایش شد' : 'گروه جدید ساخته شد', 'success');
                this._reopenGroupManager();
            } catch (err) {
                this.toast(err.message, 'error');
            }
        });

        modalBody.querySelector('#grpCancelBtn').addEventListener('click', () => {
            this._reopenGroupManager();
        });
    },

    async _deleteGroup(id, name) {
        if (!confirm(`آیا از حذف گروه «${name}» مطمئن هستید؟`)) return;

        try {
            await this.api(`/api/tafzili/groups/${id}`, { method: 'DELETE' });
            this.toast('گروه حذف شد', 'success');
            await this._loadGroupList();
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    _reopenGroupManager() {
        // ریفرش لیست گروه‌ها
        this._loadGroupList();
        this.openGroupManager();
    },
    async runTafziliList(page = 1) {
        const container = document.getElementById('tafResult');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        const parseLongOrNull = (v) => {
            if (!v) return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        };
        const parseIntOrNull = (v) => {
            if (v === '' || v === null || v === undefined) return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        };

        const payload = {
            code: document.getElementById('tafCode')?.value || null,
            name: document.getElementById('tafName')?.value || null,
            tafziliGroupId: parseLongOrNull(this._tafGroupId),
            kind: parseIntOrNull(this._tafKind),
            mobile: document.getElementById('tafMobile')?.value || null,
            melliCode: document.getElementById('tafMelliCode')?.value || null,
            economicCode: document.getElementById('tafEconomicCode')?.value || null,
            mandehFilter: this._tafMandeh || 'all',
            page: page,
            pageSize: this.state.settings.pageSize
        };

        try {
            const data = await this.api('/api/tafzili/list', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            this.renderTafziliListResult(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    renderTafziliListResult(data) {
        const container = document.getElementById('tafResult');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📭</div>
                <p>تفضیلی‌ای یافت نشد</p>
            </div>`;
            return;
        }

        const rows = items.map(t => {
            const mandeh = t.mabMandeh ?? 0;
            const mandehClass = mandeh > 0
                ? 'color:#059669; font-weight:600;'
                : (mandeh < 0 ? 'color:#DC2626; font-weight:600;' : 'color:#6B7280;');

            return `
            <tr>
                <td class="num text-center">${t.codeTafzil || ''}</td>
                <td>${this.esc(t.name || '')}</td>
                <td>${this.esc(t.tafziliGroupName || '-')}</td>
                <td class="text-center">${this._kindBadge(t.kind, t.kindName)}</td>
                <td class="num text-center">${this.esc(t.mobile || '-')}</td>
                <td class="num text-center">${this.esc(t.melliCode || '-')}</td>
                <td class="num text-left">${this.fmt(t.sumBed)}</td>
                <td class="num text-left">${this.fmt(t.sumBes)}</td>
                <td class="num text-left" style="${mandehClass}">${this.fmt(Math.abs(mandeh))}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-ghost"
                            onclick="App.showTafziliDetail(${t.id})">
                        🔍 مشاهده
                    </button>
                </td>
            </tr>
        `;
        }).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                                onclick="App.runTafziliList(${p})">${p}</button>`;
            }

            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${items.length.toLocaleString('fa-IR')} از ${totalCount.toLocaleString('fa-IR')} تفضیلی
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runTafziliList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runTafziliList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runTafziliList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runTafziliList(${totalPages})">»</button>
                </div>
            </div>`;
        } else {
            paginationHtml = `
            <div class="pagination-bar">
                <div class="pagination-info">مجموع: ${totalCount.toLocaleString('fa-IR')} تفضیلی</div>
            </div>`;
        }

        container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>👥 لیست تفضیلی‌ها (${totalCount.toLocaleString('fa-IR')})</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:80px;">کد</th>
                            <th>نام</th>
                            <th style="width:130px;">گروه تفضیلی</th>
                            <th style="width:100px;">نوع</th>
                            <th style="width:110px;">موبایل</th>
                            <th style="width:110px;">کد ملی</th>
                            <th class="text-left" style="width:110px;">گردش بدهکار</th>
                            <th class="text-left" style="width:110px;">گردش بستانکار</th>
                            <th class="text-left" style="width:110px;">مانده</th>
                            <th style="width:90px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${paginationHtml}
        </div>
    `;

        const self = this;
        Exporter.attach(container, {
            title: 'لیست تفضیلی‌ها',
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: 'TafziliList',
            getFullTable: async () => {
                const parseLongOrNull = (v) => { if (!v) return null; const n = parseInt(v); return isNaN(n) ? null : n; };
                const parseIntOrNull = (v) => { if (v === '' || v === null || v === undefined) return null; const n = parseInt(v); return isNaN(n) ? null : n; };
                const payload = {
                    code: document.getElementById('tafCode')?.value || null,
                    name: document.getElementById('tafName')?.value || null,
                    tafziliGroupId: parseLongOrNull(self._tafGroupId),
                    kind: parseIntOrNull(self._tafKind),
                    mobile: document.getElementById('tafMobile')?.value || null,
                    melliCode: document.getElementById('tafMelliCode')?.value || null,
                    economicCode: document.getElementById('tafEconomicCode')?.value || null,
                    mandehFilter: self._tafMandeh || 'all',
                    page: 1,
                    pageSize: 100000
                };
                const full = await self.api('/api/tafzili/list', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                return self.buildTafziliTableHtml(full.items || []);
            }
        });
    },

    buildTafziliTableHtml(items) {
        const rows = items.map(t => `
        <tr>
            <td class="num text-center">${t.codeTafzil || ''}</td>
            <td>${this.esc(t.name || '')}</td>
            <td>${this.esc(t.tafziliGroupName || '-')}</td>
            <td class="text-center">${this.esc(t.kindName || '-')}</td>
            <td class="num text-center">${this.esc(t.mobile || '-')}</td>
            <td class="num text-center">${this.esc(t.melliCode || '-')}</td>
            <td class="num text-left">${this.fmt(t.sumBed)}</td>
            <td class="num text-left">${this.fmt(t.sumBes)}</td>
            <td class="num text-left">${this.fmt(Math.abs(t.mabMandeh || 0))}</td>
        </tr>
    `).join('');

        const table = document.createElement('table');
        table.innerHTML = `
        <thead>
            <tr>
                <th>کد</th>
                <th>نام</th>
                <th>گروه تفضیلی</th>
                <th>نوع</th>
                <th>موبایل</th>
                <th>کد ملی</th>
                <th class="text-left">گردش بدهکار</th>
                <th class="text-left">گردش بستانکار</th>
                <th class="text-left">مانده</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    `;
        return table;
    },

    _kindBadge(kind, kindName) {
        if (kind == null) return '<span class="badge badge-gray">-</span>';
        const map = {
            0: 'badge-gray',
            1: 'badge-info',
            2: 'badge-success',
            3: 'badge-warning',
            4: 'badge-danger'
        };
        const cls = map[kind] || 'badge-gray';
        return `<span class="badge ${cls}">${this.esc(kindName || '-')}</span>`;
    },

    async showTafziliDetail(tafziliId) {
        this.openModal('جزئیات تفضیلی', `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const d = await this.api(`/api/tafzili/${tafziliId}`);

            const body = `
            <!-- ═══ اطلاعات پایه ═══ -->
            <div class="section-title">📋 اطلاعات پایه</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">کد تفضیلی:</td>
                    <td>${d.codeTafzil || '-'}</td>
                    <td class="label">نام:</td>
                    <td colspan="3">${this.esc(d.name || '-')}</td>
                </tr>
                <tr>
                    <td class="label">گروه تفضیلی:</td>
                    <td colspan="5">
                        ${d.tafziliGroupName
                    ? `<span class="badge badge-info">${this.esc(d.tafziliGroupName)}</span>`
                    : '<span class="badge badge-gray">بدون گروه</span>'}
                    </td>
                </tr>
                <tr>
                    <td class="label">نوع:</td>
                    <td>${this._kindBadge(d.kind, d.kindName)}</td>
                    <td class="label">شغل:</td>
                    <td>${this.esc(d.jobName || '-')}</td>
                    <td class="label">وضعیت:</td>
                    <td>${d.vaziat === 1 ? 'فعال' : 'غیرفعال'}</td>
                </tr>
                ${d.discript ? `
                <tr>
                    <td class="label">توضیحات:</td>
                    <td colspan="5">${this.esc(d.discript)}</td>
                </tr>` : ''}
            </table>

            <!-- ═══ اطلاعات تماس ═══ -->
            <div class="section-title">📞 اطلاعات تماس</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">تلفن:</td>
                    <td>${this.esc(d.phone || '-')}</td>
                    <td class="label">موبایل:</td>
                    <td>${this.esc(d.mobile || '-')}</td>
                    <td class="label">کد پستی:</td>
                    <td>${this.esc(d.postalCode || '-')}</td>
                </tr>
                <tr>
                    <td class="label">استان:</td>
                    <td>${this.esc(d.stateName || '-')}</td>
                    <td class="label">شهر ۱:</td>
                    <td>${this.esc(d.cityName1 || '-')}</td>
                    <td class="label">شهر ۲:</td>
                    <td>${this.esc(d.cityName2 || '-')}</td>
                </tr>
                <tr>
                    <td class="label">آدرس:</td>
                    <td colspan="5">${this.esc(d.address || '-')}</td>
                </tr>
            </table>

            <!-- ═══ اطلاعات مالی و هویتی ═══ -->
            <div class="section-title">💰 اطلاعات مالی و هویتی</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">شماره حساب بانکی:</td>
                    <td>${this.esc(d.accountNumber || '-')}</td>
                    <td class="label">کد ملی:</td>
                    <td>${this.esc(d.melliCode || '-')}</td>
                    <td class="label">کد اقتصادی:</td>
                    <td>${this.esc(d.economicCode || '-')}</td>
                </tr>
                <tr>
                    <td class="label">شناسه ثبت:</td>
                    <td colspan="5">${this.esc(d.nationalCode || '-')}</td>
                </tr>
            </table>

            <!-- ═══ مانده ═══ -->
            <div class="section-title">📊 گردش و مانده</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">گردش بدهکار:</td>
                    <td class="num" style="font-weight:bold;">${this.fmt(d.sumBed)}</td>
                    <td class="label">گردش بستانکار:</td>
                    <td class="num" style="font-weight:bold;">${this.fmt(d.sumBes)}</td>
                    <td class="label">مانده:</td>
                    <td class="num" style="font-weight:bold; color:#4F46E5;">
                        ${this.fmt(Math.abs(d.mabMandeh || 0))}
                        ${d.mabMandeh > 0 ? 'بس' : (d.mabMandeh < 0 ? 'بد' : '')}
                    </td>
                </tr>
            </table>

            <!-- ═══ تنظیمات ═══ -->
            <div class="section-title">⚙️ تنظیمات</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">در فروشندگان:</td>
                    <td>${d.isSaleMan ? '✅ بله' : '❌ خیر'}</td>
                    <td class="label">انبار:</td>
                    <td>${d.isStock ? '✅ بله' : '❌ خیر'}</td>
                    <td class="label">ماهیت:</td>
                    <td>${d.mahiat === 1 ? 'بدهکار' : (d.mahiat === 2 ? 'بستانکار' : '-')}</td>
                </tr>
            </table>
        `;

            document.getElementById('modalBody').innerHTML = body;

            const self = this;
            Exporter.attach(document.getElementById('modalBody'), {
                title: `تفضیلی: ${d.name || ''} (${d.codeTafzil || ''})`,
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: `Tafzili_${d.codeTafzil || tafziliId}`,
                customHtml: () => self.buildTafziliPrintHtml(d)
            });
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
    },

    buildTafziliPrintHtml(d) {
        return `
        <table class="factor-info-table">
            <tr>
                <td class="label">کد تفضیلی:</td>
                <td>${d.codeTafzil || '-'}</td>
                <td class="label">نام:</td>
                <td colspan="3">${this.esc(d.name || '-')}</td>
            </tr>
            <tr>
                <td class="label">گروه تفضیلی:</td>
                <td>${this.esc(d.tafziliGroupName || '-')}</td>
                <td class="label">نوع:</td>
                <td>${this.esc(d.kindName || '-')}</td>
                <td class="label">شغل:</td>
                <td>${this.esc(d.jobName || '-')}</td>
            </tr>
            <tr>
                <td class="label">وضعیت:</td>
                <td>${d.vaziat === 1 ? 'فعال' : 'غیرفعال'}</td>
                <td class="label">در فروشندگان:</td>
                <td>${d.isSaleMan ? 'بله' : 'خیر'}</td>
                <td class="label">انبار:</td>
                <td>${d.isStock ? 'بله' : 'خیر'}</td>
            </tr>
            ${d.discript ? `
            <tr>
                <td class="label">توضیحات:</td>
                <td colspan="5">${this.esc(d.discript)}</td>
            </tr>` : ''}
        </table>

        <div class="section-title">📞 اطلاعات تماس</div>
        <table class="factor-info-table">
            <tr>
                <td class="label">تلفن:</td>
                <td>${this.esc(d.phone || '-')}</td>
                <td class="label">موبایل:</td>
                <td>${this.esc(d.mobile || '-')}</td>
                <td class="label">کد پستی:</td>
                <td>${this.esc(d.postalCode || '-')}</td>
            </tr>
            <tr>
                <td class="label">استان:</td>
                <td>${this.esc(d.stateName || '-')}</td>
                <td class="label">شهر ۱:</td>
                <td>${this.esc(d.cityName1 || '-')}</td>
                <td class="label">شهر ۲:</td>
                <td>${this.esc(d.cityName2 || '-')}</td>
            </tr>
            <tr>
                <td class="label">آدرس:</td>
                <td colspan="5">${this.esc(d.address || '-')}</td>
            </tr>
        </table>

        <div class="section-title">💰 اطلاعات مالی و هویتی</div>
        <table class="factor-info-table">
            <tr>
                <td class="label">شماره حساب بانکی:</td>
                <td>${this.esc(d.accountNumber || '-')}</td>
                <td class="label">کد ملی:</td>
                <td>${this.esc(d.melliCode || '-')}</td>
                <td class="label">کد اقتصادی:</td>
                <td>${this.esc(d.economicCode || '-')}</td>
            </tr>
            <tr>
                <td class="label">شناسه ثبت:</td>
                <td colspan="5">${this.esc(d.nationalCode || '-')}</td>
            </tr>
        </table>

        <div class="section-title">📊 گردش و مانده</div>
        <table class="factor-info-table">
            <tr>
                <td class="label">گردش بدهکار:</td>
                <td class="num text-left">${this.fmt(d.sumBed)}</td>
                <td class="label">گردش بستانکار:</td>
                <td class="num text-left">${this.fmt(d.sumBes)}</td>
                <td class="label">مانده:</td>
                <td class="num text-left" style="font-weight:bold; color:#4F46E5;">
                    ${this.fmt(Math.abs(d.mabMandeh || 0))}
                    ${d.mabMandeh > 0 ? 'بس' : (d.mabMandeh < 0 ? 'بد' : '')}
                </td>
            </tr>
        </table>
    `;
    },     
    // ═══════════════════════════════════════════
    //  DAYBOOK (دفتر روزنامه)
    // ═══════════════════════════════════════════
    renderDayBook() {
        const c = document.getElementById('content');
        c.innerHTML = `
    <div class="card">
        <div class="card-title">📘 تنظیمات دفتر روزنامه</div>

        <div class="form-group">
            <label>نوع گزارش</label>
            <div class="custom-select" id="dbModeWrap">
                <button type="button" class="custom-select-trigger" id="dbModeTrigger">
                    <span class="custom-select-value">سطح کل (تجمیعی)</span>
                    <span class="custom-select-arrow">▼</span>
                </button>
                <div class="custom-select-menu" id="dbModeMenu">
                    <div class="custom-select-option selected" data-level="col" data-mode="aggregated">
                        سطح کل (تجمیعی)
                    </div>
                    <div class="custom-select-option" data-level="col" data-mode="perSanad">
                        سطح کل (بصورت سند)
                    </div>
                    <div class="custom-select-option" data-level="tafzil" data-mode="aggregated">
                        سطح معین/تفضیل (تجمیعی)
                    </div>
                    <div class="custom-select-option" data-level="tafzil2" data-mode="aggregated">
                        سطح تفضیلی ۲ (تجمیعی)
                    </div>
                </div>
            </div>
        </div>

        <div class="filters">
            <div class="form-group">
                <label>از تاریخ سند</label>
                <input type="text" id="dbFromDate" placeholder="1404/01/01">
            </div>
            <div class="form-group">
                <label>تا تاریخ سند</label>
                <input type="text" id="dbToDate" placeholder="1404/12/29">
            </div>
            <div class="form-group">
                <label>از شماره سند</label>
                <input type="number" id="dbNoFrom">
            </div>
            <div class="form-group">
                <label>تا شماره سند</label>
                <input type="number" id="dbNoTo">
            </div>
            <div class="form-group">
                <label>وضعیت سند</label>
                <select id="dbVazeit">
                    <option value="">همه</option>
                    <option value="0">پیش‌نویس</option>
                    <option value="1">رسیدگی</option>
                    <option value="2">قطعی</option>
                </select>
            </div>
            <div class="form-group">
                <label>نوع حساب‌ها</label>
                <select id="dbHesabOption">
                    <option value="all">کلیه حساب‌ها</option>
                    <option value="noZeroMandeh">حساب‌های با مانده صفر آورده نشود</option>
                    <option value="noZeroGardesh">حساب‌های با گردش صفر آورده نشود</option>
                </select>
            </div>
            <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn btn-primary btn-block" id="dbBtnRun">
                    📊 تهیه گزارش
                </button>
            </div>
        </div>
    </div>

    <div id="dbResult">
        <div class="empty">
            <div class="empty-icon">📘</div>
            <p>تنظیمات را انتخاب کنید و دکمه «تهیه گزارش» را بزنید</p>
        </div>
    </div>
    `;

        // ─── Custom Select برای حالت ───
        this._dbLevel = 'col';
        this._dbMode = 'aggregated';

        const wrap = document.getElementById('dbModeWrap');
        const trigger = document.getElementById('dbModeTrigger');
        const menu = document.getElementById('dbModeMenu');
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this._dbLevel = opt.dataset.level;
                this._dbMode = opt.dataset.mode;
                valueEl.textContent = opt.textContent.trim();
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
            });
        });

        document.getElementById('dbBtnRun').addEventListener('click', () => this.runDayBook(1));
    },

    async runDayBook(page = 1) {
        const btn = document.getElementById('dbBtnRun');
        const container = document.getElementById('dbResult');
        btn.disabled = true; btn.textContent = 'در حال تهیه...';
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const payload = {
            level: this._dbLevel,
            mode: this._dbMode,
            fromDate: document.getElementById('dbFromDate').value || null,
            toDate: document.getElementById('dbToDate').value || null,
            noFrom: parseIntOrNull('dbNoFrom'),
            noTo: parseIntOrNull('dbNoTo'),
            vazeit: parseIntOrNull('dbVazeit'),
            hesabOption: document.getElementById('dbHesabOption').value || 'all',
            page: page,
            pageSize: this.state.settings.pageSize
        };

        try {
            const url = `/api/orgs/${this.state.user.orgId}/fy/${this.state.user.fyId}/reports/daybook`;
            const result = await this.api(url, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            // ⭐ اگه این اولین باره یا از فیلتر جدید اومده، کل دیتا رو ذخیره کن
            if (page === 1) {
                this._dbAllData = result;
            } else {
                // اگه صفحه‌ی دیگه‌ایه، ردیف‌ها رو به هم بچسبون (برای export)
                if (this._dbAllData && this._dbAllData.items) {
                    // فقط اگه ردیف تکراری نبود
                    this._dbAllData.items = this._dbAllData.items.concat(result.items || []);
                } else {
                    this._dbAllData = result;
                }
            }

            this.renderDayBookResult(result, page);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${err.message}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '📊 تهیه گزارش';
        }
    },

    renderDayBookResult(data, currentPage = 1) {
        const container = document.getElementById('dbResult');
        const items = data.items || [];
        const mode = (data.mode || 'aggregated').toLowerCase();
        const level = (data.level || 'col').toLowerCase();

        if (items.length === 0) {
            container.innerHTML = `
        <div class="empty">
            <div class="empty-icon">📭</div>
            <p>موردی یافت نشد</p>
        </div>`;
            return;
        }

        let tableHtml = '';

        if (mode === 'persanad') {
            // ═══ حالت بصورت سند ═══
            const rows = items.map(it => `
            <tr>
                <td class="code-col">${it.codeCol}</td>
                <td class="code-col">${this.esc(it.dateIn || '-')}</td>
                <td class="code-col">${this.esc(it.noSanad || '-')}</td>
                <td>${this.esc(it.hesabName || '')}</td>
                <td style="font-size:11.5px; color:#6B7280;">${this.esc(it.otherParentSharh || '')}</td>
                <td class="num-col">${it.mabBed > 0 ? this.fmt(it.mabBed) : '—'}</td>
                <td class="num-col">${it.mabBes > 0 ? this.fmt(it.mabBes) : '—'}</td>
            </tr>
        `).join('');

            tableHtml = `
        <table class="daybook-table">
            <thead>
                <tr>
                    <th class="code-col" style="width:60px;">کل</th>
                    <th class="code-col" style="width:110px;">تاریخ سند</th>
                    <th class="code-col" style="width:80px;">سند</th>
                    <th>نام حساب</th>
                    <th style="width:240px;">شرح سند</th>
                    <th class="num-col" style="width:150px;">بدهکار</th>
                    <th class="num-col" style="width:150px;">بستانکار</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr style="background:#EEF2FF; font-weight:700;">
                    <td colspan="5" class="text-center">جمع کل</td>
                    <td class="num-col">${this.fmt(data.totalBed)}</td>
                    <td class="num-col">${this.fmt(data.totalBes)}</td>
                </tr>
            </tfoot>
        </table>`;
        } else {
            // ═══ حالت تجمیعی ═══
            const rows = items.map(it => `
            <tr>
                <td class="code-col">${it.codeTafzili2 || '—'}</td>
                <td class="code-col">${it.codeTafzil || '—'}</td>
                <td class="code-col">${it.codeMoein || '—'}</td>
                <td class="code-col" style="font-weight:600; color:var(--primary);">${it.codeCol}</td>
                <td>${this.esc(it.hesabName || '')}</td>
                <td class="num-col">${it.mabBed > 0 ? this.fmt(it.mabBed) : '—'}</td>
                <td class="num-col">${it.mabBes > 0 ? this.fmt(it.mabBes) : '—'}</td>
            </tr>
        `).join('');

            tableHtml = `
        <table class="daybook-table">
            <thead>
                <tr>
                    <th class="code-col" style="width:80px;">تفضیلی ۲</th>
                    <th class="code-col" style="width:80px;">تفضیلی</th>
                    <th class="code-col" style="width:70px;">معین</th>
                    <th class="code-col" style="width:70px;">کل</th>
                    <th>نام حساب</th>
                    <th class="num-col" style="width:150px;">بدهکار</th>
                    <th class="num-col" style="width:150px;">بستانکار</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr style="background:#EEF2FF; font-weight:700;">
                    <td colspan="5" class="text-center">جمع کل</td>
                    <td class="num-col">${this.fmt(data.totalBed)}</td>
                    <td class="num-col">${this.fmt(data.totalBes)}</td>
                </tr>
            </tfoot>
        </table>`;
        }

        // ─── صفحه‌بندی ───
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        let paginationHtml = '';
        if (totalPages > 1) {
            const maxBtn = 7;
            let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
            let endPage = Math.min(totalPages, startPage + maxBtn - 1);
            if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

            let pageBtns = '';
            for (let p = startPage; p <= endPage; p++) {
                pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.runDayBook(${p})">${p}</button>`;
            }

            paginationHtml = `
        <div class="pagination-bar">
            <div class="pagination-info">
                نمایش ${items.length.toLocaleString('fa-IR')} از ${totalCount.toLocaleString('fa-IR')} ردیف
            </div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runDayBook(1)">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.runDayBook(${page - 1})">‹ قبلی</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runDayBook(${page + 1})">بعدی ›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.runDayBook(${totalPages})">»</button>
            </div>
        </div>`;
        } else {
            paginationHtml = `
        <div class="pagination-bar">
            <div class="pagination-info">مجموع: ${totalCount.toLocaleString('fa-IR')} ردیف</div>
        </div>`;
        }

        const modeTitles = {
            'col-aggregated': 'سطح کل (تجمیعی)',
            'col-persanad': 'سطح کل (بصورت سند)',
            'tafzil-aggregated': 'سطح معین/تفضیل (تجمیعی)',
            'tafzil2-aggregated': 'سطح تفضیلی ۲ (تجمیعی)'
        };
        const title = modeTitles[`${level}-${mode}`] || 'دفتر روزنامه';

        container.innerHTML = `
    <div class="card">
        <div class="card-title">
            <span>📘 ${this.esc(title)} (${totalCount.toLocaleString('fa-IR')} ردیف)</span>
        </div>
        <div class="table-wrapper">
            ${tableHtml}
        </div>
        ${paginationHtml}
    </div>`;

        // ⭐ دکمه‌های خروجی — با ارجاع به tableHtml که همون جدول روی صفحه هست
        const self = this;
        const renderedTable = container.querySelector('.table-wrapper table');

        Exporter.attach(container, {
            title: 'دفتر روزنامه - ' + title,
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: `DayBook_${level}_${mode}`,
            // ⭐ به جای getFullTable، از همون جدول HTML روی صفحه استفاده کن
            table: renderedTable
        });
    },

    // ─── ساخت جدول خروجی کامل (برای Excel/چاپ) ───
    buildDayBookTableHtml(data) {
        const items = data.items || [];
        const mode = (data.mode || 'aggregated').toLowerCase();

        if (mode === 'persanad') {
            const rows = items.map(it => `
<tr>
    <td class="code-col" style="color:${it.codeTafzili2 ? 'inherit' : '#D1D5DB'};">${it.codeTafzili2 || '-'}</td>
    <td class="code-col" style="color:${it.codeTafzil ? 'inherit' : '#D1D5DB'};">${it.codeTafzil || '-'}</td>
    <td class="code-col" style="color:${it.codeMoein ? 'inherit' : '#D1D5DB'};">${it.codeMoein || '-'}</td>
    <td class="code-col" style="font-weight:600; color:var(--primary);">${it.codeCol}</td>
    <td>${this.esc(it.hesabName || '')}</td>
    <td class="num-col" style="${it.mabBed > 0 ? 'font-weight:600;' : ''}">${it.mabBed > 0 ? this.fmt(it.mabBed) : '-'}</td>
    <td class="num-col" style="${it.mabBes > 0 ? 'font-weight:600;' : ''}">${it.mabBes > 0 ? this.fmt(it.mabBes) : '-'}</td>
</tr>
`).join('');

            return `
        <table>
            <thead>
                <tr>
                    <th>کل</th><th>تاریخ سند</th><th>سند</th>
                    <th>نام حساب</th><th>شرح</th>
                    <th class="text-left">بدهکار</th>
                    <th class="text-left">بستانکار</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr style="background:#EEF2FF; font-weight:700;">
                    <td colspan="5" class="text-center">جمع کل</td>
                    <td class="num text-left">${this.fmt(data.totalBed)}</td>
                    <td class="num text-left">${this.fmt(data.totalBes)}</td>
                </tr>
            </tfoot>
        </table>`;
        } else {
            // ═══ حالت تجمیعی ═══
            const rows = items.map(it => `
    <tr>
        <td class="code-col" style="color:${it.codeTafzili2 ? 'inherit' : '#D1D5DB'};">${it.codeTafzili2 || '—'}</td>
        <td class="code-col" style="color:${it.codeTafzil ? 'inherit' : '#D1D5DB'};">${it.codeTafzil || '—'}</td>
        <td class="code-col" style="color:${it.codeMoein ? 'inherit' : '#D1D5DB'};">${it.codeMoein || '—'}</td>
        <td class="code-col" style="font-weight:600; color:var(--primary);">${it.codeCol}</td>
        <td>${this.esc(it.hesabName || '')}</td>
        <td class="num-col" style="${it.mabBed > 0 ? 'font-weight:600;' : 'color:#D1D5DB;'}">
            ${it.mabBed > 0 ? this.fmt(it.mabBed) : '—'}
        </td>
        <td class="num-col" style="${it.mabBes > 0 ? 'font-weight:600;' : 'color:#D1D5DB;'}">
            ${it.mabBes > 0 ? this.fmt(it.mabBes) : '—'}
        </td>
    </tr>
    `).join('');

            tableHtml = `
    <table class="daybook-table">
        <thead>
            <tr>
                <th class="code-col">تفضیلی ۲</th>
                <th class="code-col">تفضیلی</th>
                <th class="code-col">معین</th>
                <th class="code-col">کل</th>
                <th>نام حساب</th>
                <th class="num-col">بدهکار</th>
                <th class="num-col">بستانکار</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
            <tr style="background:#EEF2FF; font-weight:700;">
                <td colspan="5" class="text-center">جمع کل</td>
                <td class="num-col">${this.fmt(data.totalBed)}</td>
                <td class="num-col">${this.fmt(data.totalBes)}</td>
            </tr>
        </tfoot>
    </table>`;
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

    mahiatBadge(m) {
        if (m == null) return '<span class="badge badge-gray">-</span>';
        return m == 1
            ? '<span class="badge badge-info">بدهکار</span>'
            : '<span class="badge badge-warning">بستانکار</span>';
    }
};

// شروع
document.addEventListener('DOMContentLoaded', () => App.init());