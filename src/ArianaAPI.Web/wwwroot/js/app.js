/* ═══════════════════════════════════════════════════
   Ariana API - Client App
   ═══════════════════════════════════════════════════ */

const App = {
    // ─── state ───
    state: {
        token: null,
        refreshToken: null,
        user: null,
        apiKey: null,
        currentPage: 'dashboard',
        sanadPage: 1,
        sanadPageSize: 20,
        sanadTotal: 0
    },

    // ─── api base ───
    baseUrl: '',

    // ═══════════════════════════════════════════
    //  شروع
    // ═══════════════════════════════════════════
    init() {
        this.baseUrl = window.location.origin;

        // بازیابی توکن‌ها
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

        // رویدادها
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.navigate(item.dataset.page));
        });

        // modal close
        document.querySelectorAll('[data-close]').forEach(el => {
            el.addEventListener('click', () => this.closeModal());
        });

        // ⭐ سازمان → دوره مالی (زنجیره‌ای)
        const orgSelect = document.getElementById('orgId');
        const fySelect = document.getElementById('fyId');

        if (orgSelect) {
            orgSelect.addEventListener('change', (e) => this.loadFiscalYears(e.target.value));
        }

        // شروع
        if (this.state.token) {
            this.showApp();
            this.navigate('dashboard');
        } else {
            this.showLogin();
            this.loadOrganizations();   // ⭐ بارگذاری سازمان‌ها
        }
    },

    // ═══════════════════════════════════════════
    //  Lookups (سازمان / دوره مالی)
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

            // اگه قبلاً ذخیره شده بود، انتخاب کن
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

            // اگه قبلاً ذخیره شده بود، انتخاب کن
            const savedFy = this.state.user?.fyId;
            if (savedFy) select.value = savedFy;
        } catch (err) {
            console.error(err);
            select.innerHTML = '<option value="">خطا در بارگذاری</option>';
        }
    },

    // ═══════════════════════════════════════════
    //  Login / Logout
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
        // ⭐ دوباره سازمان‌ها رو بارگذاری کن
        this.loadOrganizations();
        this.toast('از سیستم خارج شدید');
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
    //  API Helper
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
    //  Navigation
    // ═══════════════════════════════════════════
    navigate(page) {
        this.state.currentPage = page;

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        const titles = {
            dashboard: 'داشبورد',
            sanad: 'اسناد حسابداری',
            hesab: 'حساب‌ها',
            sharh: 'شرح‌ها',
            kind: 'انواع سند'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        switch (page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'sanad': this.renderSanadList(); break;
            case 'hesab': this.renderHesab(); break;
            case 'sharh': this.renderSharh(); break;
            case 'kind': this.renderKindSanad(); break;
        }
    },

    // ═══════════════════════════════════════════
    //  Dashboard
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
                    <button class="quick-btn" onclick="App.navigate('hesab')">
                        <span class="quick-icon">🏦</span>
                        <span>مشاهده حساب‌ها</span>
                    </button>
                    <button class="quick-btn" onclick="App.navigate('sharh')">
                        <span class="quick-icon">📝</span>
                        <span>شرح‌ها</span>
                    </button>
                    <button class="quick-btn" onclick="App.navigate('kind')">
                        <span class="quick-icon">🏷️</span>
                        <span>انواع سند</span>
                    </button>
                </div>
            </div>
        `;
        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    // ═══════════════════════════════════════════
    //  Sanad
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
                        <button class="btn btn-primary btn-block" id="btnSearchSanad">
                            🔍 جستجو
                        </button>
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

            let url = `/api/sanad?page=${this.state.sanadPage}&pageSize=${this.state.sanadPageSize}`;
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

                <div class="pagination">
                    <button ${this.state.sanadPage <= 1 ? 'disabled' : ''}
                            onclick="App.gotoSanadPage(${this.state.sanadPage - 1})">
                        قبلی
                    </button>
                    <span>صفحه ${this.state.sanadPage}</span>
                    <button ${items.length < this.state.sanadPageSize ? 'disabled' : ''}
                            onclick="App.gotoSanadPage(${this.state.sanadPage + 1})">
                        بعدی
                    </button>
                </div>
            `;
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
                    <td>${this.esc(it.colName || it.code_Col || '-')}</td>
                    <td>${this.esc(it.moeinName || '-')}</td>
                    <td>${this.esc(it.tafzilName || '-')}</td>
                    <td>${this.esc(it.otherSharh || '-')}</td>
                    <td class="num text-left">${this.fmt(it.mab_Bed || it.mabBed)}</td>
                    <td class="num text-left">${this.fmt(it.mab_Bes || it.mabBes)}</td>
                </tr>
            `).join('');

            document.getElementById('modalBody').innerHTML = `
                <div class="stats-grid" style="margin-bottom:16px;">
                    <div class="stat-card">
                        <div>
                            <div class="stat-label">شماره سند</div>
                            <div class="stat-value">${this.fmt(detail?.noSanad ?? detail?.no_Sanad)}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div>
                            <div class="stat-label">تاریخ</div>
                            <div class="stat-value">${detail?.dateIn || detail?.date_IN || '-'}</div>
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
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="7" class="text-center">ردیفی وجود ندارد</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${err.message}</div>`;
        }
    },

    // ═══════════════════════════════════════════
    //  Hesab
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
    //  Sharh
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
        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    // ═══════════════════════════════════════════
    //  Kind Sanad
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
        } catch (err) {
            c.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    },

    // ═══════════════════════════════════════════
    //  Modal & Toast
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
    //  Helpers
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