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
            this.loadOrganizations();
        }
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
    //  تنظیمات
    // ═══════════════════════════════════════════
    openSettings() {
        const s = this.state.settings;

        const body = `
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
        document.getElementById('userAvatar').textContent = initial;
        document.getElementById('userName').textContent = u.fullName || u.username || '-';
        document.getElementById('userMeta').textContent =
            `${u.orgName || ''} - ${u.fyName || ''}`;
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
        this.state.currentPage = page;

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        const titles = {
            dashboard: 'داشبورد',
            sanad: 'اسناد حسابداری',
            ledger: 'دفتر حساب',
            hesab: 'حساب‌ها',
            sharh: 'شرح‌ها',
            kind: 'انواع سند'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        switch (page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'sanad': this.renderSanadList(); break;
            case 'ledger': this.renderLedger(); break;
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
                        <button class="quick-btn" onclick="App.navigate('sharh')">
                            <span class="quick-icon">📝</span>
                            <span>شرح‌ها</span>
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
                                        <td>${this.esc(s.kindSanad ?? '-')}</td>
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

            // ⭐ دکمه‌های Excel و چاپ برای Modal
            const modalBody = document.getElementById('modalBody');
            Exporter.attach(modalBody, {
                title: 'سند شماره ' + (detail?.noSanad || ''),
                subtitle: 'تاریخ: ' + (detail?.dateIn || '') + ' | ' +
                    (this.state.user?.orgName || '') + ' - ' + (this.state.user?.fyName || ''),
                filename: 'Sanad_' + (detail?.noSanad || 'detail')
            });
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
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