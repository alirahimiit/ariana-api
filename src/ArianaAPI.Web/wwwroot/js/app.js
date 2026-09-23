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
    handleLogout: () => window.App.Auth.handleLogout(),
    showLogin: () => window.App.Auth.showLogin(),
    showApp: () => window.App.Auth.showApp(),
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
        // ⭐ Nav groups (تاشو)
        this.initNavGroups();
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
            const page = this.state.currentPage;
            if (this.state.currentPage === 'sanad') {
                this.state.sanadPage = 1;
                window.App.Features.Sanad.loadList();
            } else if (this.state.currentPage === 'article') {
                window.App.Features.Article.runList(1);
            } else if (this.state.currentPage === 'factor') {
                window.App.Features.Factor.runList(1);
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
            // ⭐ گزارشات فاکتور
            'report-factor': 'گزارش فاکتورها',
            'report-sell-summary': 'خلاصه فروش',
            'report-profit': 'سود و زیان فاکتورها'
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

            // ⭐ صفحات در حال توسعه — placeholder نمایش می‌ده
            default:
                window.App.renderComingSoon(page, titles[page] || page);
                break;
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
    },

});

// شروع
document.addEventListener('DOMContentLoaded', () => window.App.init());
