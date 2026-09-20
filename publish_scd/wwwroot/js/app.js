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
                warningEl.innerHTML = `
                لایسنس: <strong>${this.esc(data.customerName)}</strong>
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

        const body = `
             <div class="form-group">
                <label>لوگوی برنامه</label>
            <div style="display:flex; align-items:center; gap:12px; padding:12px; background:#F9FAFB; border-radius:10px; margin-bottom:16px;">
                <div class="logo-preview" style="width:56px; height:56px; font-size:22px;">
                    ${hasLogo
                ? `<img src="${this.getLogo()}" alt="لوگو">`
                : '<span>آ</span>'
            }
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
            <select id="setPageSize" class="form-select">
        <div class="form-group">
            <label>تعداد ردیف در هر صفحه (صفحه‌بندی)</label>
            <select id="setPageSize" class="form-select">
                <option value="10"   ${s.pageSize === 10 ? 'selected' : ''}>10 ردیف</option>
                <option value="20"  ${s.pageSize === 20 ? 'selected' : ''}>20 ردیف</option>
                <option value="50"  ${s.pageSize === 50 ? 'selected' : ''}>50 ردیف</option>
                <option value="100" ${s.pageSize === 100 ? 'selected' : ''}>100 ردیف</option>
                <option value="200" ${s.pageSize === 200 ? 'selected' : ''}>200 ردیف</option>
                <option value="500" ${s.pageSize === 500 ? 'selected' : ''}>500 ردیف</option>
                <option value="1000" ${s.pageSize === 1000 ? 'selected' : ''}>1000 ردیف</option>
            </select>
            <p class="form-hint">این مقدار روی همه‌ی جدول‌های برنامه اعمال می‌شود.</p>
        </div>

        <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="btn btn-primary" id="setSaveBtn">💾 ذخیره</button>
            <button class="btn btn-ghost" data-close>انصراف</button>
        </div>
    `;

        this.openModal('⚙️ تنظیمات', body);

        // بایند دکمه‌ها
        const modalBody = document.getElementById('modalBody');
        modalBody.querySelector('#setSaveBtn').addEventListener('click', () => {
            // ⭐ دکمه لوگو
            const logoBtn = modalBody.querySelector('#openLogoDialogBtn');
            if (logoBtn) {
                logoBtn.addEventListener('click', () => {
                    this.closeModal();
                    setTimeout(() => this.openLogoDialog(), 100);
                });
            }
            const newSize = parseInt(document.getElementById('setPageSize').value);
            this.state.settings.pageSize = newSize;
            localStorage.setItem('ariana_settings', JSON.stringify(this.state.settings));
            this.closeModal();
            this.toast('تنظیمات ذخیره شد', 'success');

            // رفرش صفحه فعلی
            if (this.state.currentPage === 'sanad') {
                this.state.sanadPage = 1;
                this.loadSanadList();
            } else if (this.state.currentPage === 'ledger') {
                // کاربر باید دوباره دکمه تهیه گزارش رو بزنه
            }
        });
            const logoBtn = modalBody.querySelector('#openLogoDialogBtn');
    if (logoBtn) {
        logoBtn.addEventListener('click', () => {
            this.closeModal();
            setTimeout(() => this.openLogoDialog(), 100);
        });
    }

        modalBody.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => this.closeModal());
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

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        const titles = {
            dashboard: 'داشبورد',
            sanad: 'اسناد حسابداری',
            taraz: 'تراز حساب‌ها',
            ledger: 'دفتر حساب',
            factor: 'فاکتورها',
            hesab: 'حساب‌ها',
            sharh: 'شرح‌ها',
            kind: 'انواع سند'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        switch (page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'sanad': this.renderSanadList(); break;
            case 'taraz': this.renderTaraz(); break;
            case 'ledger': this.renderLedger(); break;
            case 'factor': this.renderFactorList(); break;
            case 'hesab': this.renderHesab(); break;
            case 'sharh': this.renderSharh(); break;
            case 'kind': this.renderKindSanad(); break;
        }
    },

    // ═══════════════════════════════════════════
    //  DASHBOARD
    // ═══════════════════════════════════════════
    async renderDashboard() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>`;

        try {
            const [count, cols] = await Promise.all([
                this.api('/api/sanad/count').catch(() => ({ count: 0 })),
                this.api('/api/hesab/cols').catch(() => [])
            ]);

            const u = this.state.user || {};

            c.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon purple">📄</div>
                        <div>
                            <div class="stat-value">${this.fmt(count.count)}</div>
                            <div class="stat-label">کل اسناد</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">🏦</div>
                        <div>
                            <div class="stat-value">${cols.length}</div>
                            <div class="stat-label">حساب‌های کل</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon orange">📅</div>
                        <div>
                            <div class="stat-value">${this.esc(u.fyName || u.fyId || '-')}</div>
                            <div class="stat-label">دوره مالی فعال</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🏢</div>
                        <div>
                            <div class="stat-value" style="font-size:16px;">${this.esc(u.orgName || u.orgId || '-')}</div>
                            <div class="stat-label">سازمان فعال</div>
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

                <div class="card">
                    <div class="card-title">⚡ دسترسی سریع</div>
                    <div class="quick-actions">
                        <button class="quick-btn" onclick="App.navigate('sanad')">
                            <span class="quick-icon">📄</span>
                            <span>مشاهده اسناد</span>
                        </button>
                        <button class="quick-btn" onclick="App.navigate('ledger')">
                            <span class="quick-icon">📒</span>
                            <span>دفتر حساب</span>
                        </button>
                        <button class="quick-btn" onclick="App.navigate('hesab')">
                            <span class="quick-icon">🏦</span>
                            <span>مشاهده حساب‌ها</span>
                        </button>
                        <button class="quick-btn" onclick="App.navigate('factor')">
                            <span class="quick-icon">🧾</span>
                            <span>فاکتورها</span>
                        </button>
                    </div>
                </div>
            `;
        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    // ═══════════════════════════════════════════
    //  SANAD (اسناد)
    // ═══════════════════════════════════════════
    async renderSanadList() {
        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="card">
                <div class="card-title">فیلترها</div>
                <div class="filters">
                    <div class="form-group">
                        <label>از تاریخ</label>
                        <input type="text" id="fFromDate" placeholder="1403/01/01">
                    </div>
                    <div class="form-group">
                        <label>تا تاریخ</label>
                        <input type="text" id="fToDate" placeholder="1403/12/29">
                    </div>
                    <div class="form-group">
                        <label>از شماره</label>
                        <input type="number" id="fNoFrom">
                    </div>
                    <div class="form-group">
                        <label>تا شماره</label>
                        <input type="number" id="fNoTo">
                    </div>
                    <div class="form-group">
                        <label>&nbsp;</label>
                        <button class="btn btn-primary btn-block" id="btnSearchSanad">🔍 جستجو</button>
                    </div>
                </div>
            </div>
            <div id="sanadListContainer">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        `;

        document.getElementById('btnSearchSanad').addEventListener('click', () => {
            this.state.sanadPage = 1;
            this.loadSanadList();
        });

        this.loadSanadList();
    },

    async loadSanadList() {
        const container = document.getElementById('sanadListContainer');
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const fromDate = document.getElementById('fFromDate')?.value || '';
            const toDate = document.getElementById('fToDate')?.value || '';
            const noFrom = document.getElementById('fNoFrom')?.value || '';
            const noTo = document.getElementById('fNoTo')?.value || '';

            const pageSize = this.state.settings.pageSize;
            let url = `/api/sanad?page=${this.state.sanadPage}&pageSize=${pageSize}`;
            if (fromDate) url += `&fromDate=${encodeURIComponent(fromDate)}`;
            if (toDate) url += `&toDate=${encodeURIComponent(toDate)}`;
            if (noFrom) url += `&noFrom=${noFrom}`;
            if (noTo) url += `&noTo=${noTo}`;

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
                    <td class="num">${this.fmt(it.rowNum)}</td>
                    <td>${this.esc(it.colName || '-')}</td>
                    <td>${this.esc(it.moeinName || '-')}</td>
                    <td>${this.esc(it.tafzilName || '-')}</td>
                    <td>${this.esc(it.otherSharh || '-')}</td>
                    <td class="num text-left">${this.fmt(it.mabBed)}</td>
                    <td class="num text-left">${this.fmt(it.mabBes)}</td>
                    <td class="num text-left">${this.fmtSigned(it.meghdar ?? it.Meghdar)}</td>
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
                                <th>ردیف</th>
                                <th>کل</th>
                                <th>معین</th>
                                <th>تفصیل</th>
                                <th>شرح</th>
                                <th class="text-left">بدهکار</th>
                                <th class="text-left">بستانکار</th>
                                <th class="text-left">مقدار</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="8" class="text-center">ردیفی وجود ندارد</td></tr>'}
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
                <td class="num text-center">${it.code_Col ?? ''}</td>
                <td>${this.esc(it.colName || '')}</td>
                <td class="num text-center">${it.code_Moein ?? ''}</td>
                <td>${this.esc(it.moeinName || '')}</td>
                <td class="num text-center">${it.code_Tafzil ?? ''}</td>
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
                    ${itemsRows || '<tr><td colspan="11" class="text-center">ردیفی وجود ندارد</td></tr>'}
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
        c.innerHTML = `
        <div class="card">
            <div class="card-title">⚖️ تنظیمات تراز</div>

            <div class="form-group">
                <label>سطح گزارش</label>
                <div class="radio-group">
                    <label class="radio-item">
                        <input type="radio" name="tarazLevel" value="col">
                        <span>کل</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="tarazLevel" value="moein" checked>
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
                        <option value="noZeroGardesh">حساب‌های با گردش صفر آورده نشود</option>
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

        document.getElementById('tarazBtnRun').addEventListener('click', () => this.runTaraz(1));
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

    async runTaraz(page = 1) {
        const btn = document.getElementById('tarazBtnRun');
        btn.disabled = true;
        btn.textContent = 'در حال تهیه...';

        const level = document.querySelector('input[name="tarazLevel"]:checked').value;

        const parseIntOrNull = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            return el.value === '' ? null : parseInt(el.value);
        };

        const payload = this.buildTarazPayload(level, page);

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
            btn.disabled = false;
            btn.textContent = '⚖️ تهیه تراز';
        }
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

        if (items.length === 0) {
            container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📭</div>
                <p>موردی یافت نشد</p>
            </div>`;
            return;
        }

        const html = this.buildTarazTableHtml(data, false);
        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        // صفحه‌بندی
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
                <div class="pagination-info">
                    مجموع: ${totalCount.toLocaleString('fa-IR')} ردیف
                </div>
            </div>`;
        }

        container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>⚖️ نتیجه تراز (${items.length} از ${totalCount.toLocaleString('fa-IR')})</span>
            </div>
            ${html}
            ${paginationHtml}
        </div>
    `;

        const levelTitles = {
            col: 'تراز - سطح کل',
            moein: 'تراز - سطح معین',
            tafzil: 'تراز - سطح تفصیلی 1',
            tafzil2: 'تراز - سطح تفصیلی 2'
        };

        Exporter.attach(document.querySelector('#tarazResult .card'), {
            title: levelTitles[level] || 'تراز',
            subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
            filename: 'Taraz_' + level,
            getFullTable: async () => {
                const payload = this.buildTarazPayload(level, 1);
                payload.pageSize = 100000;
                const full = await this.api('/api/taraz', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = this.buildTarazTableHtml(full, true);
                return tempContainer.querySelector('table');
            }
        });
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
    //  HESAB (حساب‌ها)
    // ═══════════════════════════════════════════
    async renderHesab() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const cols = await this.api('/api/hesab/cols') || [];

            if (cols.length === 0) {
                c.innerHTML = `<div class="empty"><div class="empty-icon">🏦</div><p>حسابی یافت نشد</p></div>`;
                return;
            }

            c.innerHTML = `
                <div class="card">
                    <div class="card-title">حساب‌های کل (${cols.length})</div>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>کد</th>
                                    <th>نام</th>
                                    <th>ماهیت</th>
                                    <th class="text-left">بدهکار</th>
                                    <th class="text-left">بستانکار</th>
                                    <th class="text-left">مانده</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cols.map(h => `
                                    <tr>
                                        <td class="num">${h.code_Col ?? h.codeCol}</td>
                                        <td>${this.esc(h.name)}</td>
                                        <td>${this.mahiatBadge(h.mahiat)}</td>
                                        <td class="num text-left">${this.fmt(h.sum_Bed || h.sumBed)}</td>
                                        <td class="num text-left">${this.fmt(h.sum_Bes || h.sumBes)}</td>
                                        <td class="num text-left">${this.fmt(h.mab_Mandeh || h.mabMandeh)}</td>
                                        <td>
                                            <button class="btn btn-sm btn-ghost"
                                                    onclick="App.showMoeins(${h.code_Col ?? h.codeCol})">
                                                معین‌ها
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            Exporter.attach(c, {
                table: c.querySelector('table'),
                title: 'حساب‌های کل',
                subtitle: (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: 'HesabCols'
            });
        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    async showMoeins(codeCol) {
        this.openModal(`معین‌های حساب کل ${codeCol}`, `<div class="loading"><div class="spinner"></div></div>`);
        try {
            const list = await this.api(`/api/hesab/cols/${codeCol}/moeins`) || [];

            document.getElementById('modalBody').innerHTML = list.length === 0
                ? `<div class="empty"><p>معینی یافت نشد</p></div>`
                : `
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>کد معین</th>
                                    <th>نام</th>
                                    <th class="text-left">بدهکار</th>
                                    <th class="text-left">بستانکار</th>
                                    <th class="text-left">مانده</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(m => `
                                    <tr>
                                        <td class="num">${m.code_Moein ?? m.codeMoein}</td>
                                        <td>${this.esc(m.name)}</td>
                                        <td class="num text-left">${this.fmt(m.sum_Bed || m.sumBed)}</td>
                                        <td class="num text-left">${this.fmt(m.sum_Bes || m.sumBes)}</td>
                                        <td class="num text-left">${this.fmt(m.mab_Mandeh || m.mabMandeh)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
        } catch (err) {
            document.getElementById('modalBody').innerHTML = `<div class="error-box">${err.message}</div>`;
        }
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