/* ═══════════════════════════════════════════════════
   Core / Auth
   احراز هویت + لایسنس + lookup سازمان/دوره
   ═══════════════════════════════════════════════════
   وابستگی‌ها:
     - window.App.Helpers
     - window.App.State
     - window.App.toast / navigate (در زمان اجرا)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

window.App.Auth = (function () {
    'use strict';

    const H = window.App.Helpers;
    const S = window.App.State;
    const BASE = window.location.origin;

    // ═══════════════════════════════════════════
    //  LICENSE
    // ═══════════════════════════════════════════
    async function checkLicense() {
        const el = document.getElementById('licenseWarning');
        if (el) {
            el.className = 'license-status license-loading';
            el.textContent = 'در حال بررسی لایسنس...';
            el.classList.remove('hidden');
        }

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const data = await window.App.Http.api('/api/license/status');

                // ⭐ Backend فیلد isValid می‌فرسته
                const isValid = data && (data.isValid === true || data.valid === true);

                if (el) {
                    // ⭐ اگه نیاز به activation
                    if (isValid && data.requiresActivation === true) {
                        window.App.Auth._licenseData = { valid: true, raw: data };
                        showActivation(data.systemId);
                        return data;
                    }
                    if (isValid) {
                        const orgCount = (data.authorizedOrgs || []).length;
                        const expires = data.expiresAt || '-';
                        el.className = 'license-status license-valid';
                        el.textContent = ' لایسنس معتبر | ' +
                            'تعداد سازمان‌های مجاز: ' + orgCount +
                            ' | انقضا: ' + expires;   
                    } else {
                        el.className = 'license-status license-invalid';
                        const msg = data?.errorMessage || data?.error || 'لطفاً با پشتیبانی تماس بگیرید';
                        el.textContent = '⚠️ ' + msg;
                    }
                }

                // ⭐ ذخیره برای استفاده در handleLogin
                window.App.Auth._licenseData = {
                    valid: isValid,
                    raw: data
                };

                return data;
                // ⭐ اگه نیاز به activation
                if (data && data.valid === true && data.requiresActivation === true) {
                    showActivation(data.systemId);
                    window.App.Auth._licenseData = { valid: true, raw: data };
                    return data;
                }

            } catch (err) {
                if (attempt === 2) {
                    if (el) {
                        el.className = 'license-status license-invalid';
                        el.textContent = '⚠️ خطا در بررسی لایسنس: ' + (err.message || 'ناشناخته');
                    }
                    window.App.Auth._licenseData = { valid: false, raw: null };
                    return null;
                }
                await new Promise(r => setTimeout(r, 800));
            }
        }
    }

    // ═══════════════════════════════════════════
    //  LOOKUPS
    // ═══════════════════════════════════════════
    async function loadOrganizations() {
        const select = document.getElementById('orgId');
        if (!select) return;

        select.innerHTML = '<option value="">در حال بارگذاری...</option>';

        try {
            const res = await fetch(`${BASE}/api/lookup/organizations`);
            if (!res.ok) throw new Error('خطا در بارگذاری سازمان‌ها');

            const list = await res.json();

            if (!list || list.length === 0) {
                select.innerHTML = '<option value="">سازمانی یافت نشد</option>';
                return;
            }

            select.innerHTML = '<option value="">-- انتخاب کنید --</option>' +
                list.map(o => `<option value="${o.code}">${H.esc(o.name)}</option>`).join('');

            const savedOrg = window.App.state.user?.orgId;
            if (savedOrg) {
                select.value = savedOrg;
                await loadFiscalYears(savedOrg);
            }
        } catch (err) {
            console.error(err);
            select.innerHTML = '<option value="">خطا در بارگذاری</option>';
        }
    }

    async function loadFiscalYears(orgId) {
        const select = document.getElementById('fyId');
        if (!select) return;

        if (!orgId) {
            select.innerHTML = '<option value="">-- ابتدا سازمان --</option>';
            return;
        }

        select.innerHTML = '<option value="">در حال بارگذاری...</option>';

        try {
            const res = await fetch(`${BASE}/api/lookup/organizations/${orgId}/fiscal-years`);
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
                    return `<option value="${f.id}">${H.esc(label)}</option>`;
                }).join('');

            const savedFy = window.App.state.user?.fyId;
            if (savedFy) select.value = savedFy;
        } catch (err) {
            console.error(err);
            select.innerHTML = '<option value="">خطا در بارگذاری</option>';
        }
    }

    // ═══════════════════════════════════════════
    //  LOGIN / LOGOUT
    // ═══════════════════════════════════════════
    async function handleLogin(e) {
        e.preventDefault();

        const btn = document.getElementById('loginBtnText');
        const originalText = btn ? btn.textContent : '';
        const errBox = document.getElementById('loginError');
        errBox.classList.add('hidden');

        // ⭐ چک لایسنس قبل از هر کاری
        const lic = window.App.Auth._licenseData;
        if (!lic || lic.valid !== true) {
            errBox.textContent = '❌ لایسنس معتبر نیست. لطفاً با پشتیبانی تماس بگیرید.';
            errBox.classList.remove('hidden');
            return;
        }

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
            const res = await fetch(`${BASE}/api/auth/login`, {
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
            const state = window.App.state;
            state.token = data.accessToken;
            state.refreshToken = data.refreshToken;
            state.user = data.user;
            state.apiKey = apiKey;

            S.persistAuth();
            await window.App.Permissions.init(data.permissions);

            showApp();
            window.App.Permissions.applyMenuFilter();
            window.App.navigate('dashboard');
            window.App.toast('خوش آمدید!', 'success');
        } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
        } finally {
            if (btn) btn.textContent = originalText;
        }
    }

    function handleLogout() {
        // ⭐ پاک کردن permissions
        window.App.Permissions.clear();

        S.clearAuth();
        showLogin();
        loadOrganizations();
        window.App.toast('از سیستم خارج شدید');
    }

    // ═══════════════════════════════════════════
    //  SHOW LOGIN / SHOW APP
    // ═══════════════════════════════════════════
    function showLogin() {
        document.getElementById('activationView')?.classList.add('hidden');
        document.getElementById('loginView').classList.remove('hidden');
        document.getElementById('appView').classList.add('hidden');
        

        // ⭐ پاک کردن رمز + برگرداندن به حالت password
        const pw = document.getElementById('password');
        if (pw) {
            pw.value = '';
            pw.type = 'password';
        }

        // ⭐ برگرداندن آیکن دکمه‌ی نمایش رمز
        const toggle = document.getElementById('togglePwdBtn');
        if (toggle) toggle.textContent = '👁️';

        // ⭐ پاک کردن permissions
        if (window.App.Permissions) {
            window.App.Permissions.clear();
        }

        // ⭐ پاک کردن متن دکمه ورود
        const btnText = document.getElementById('loginBtnText');
        if (btnText) btnText.textContent = 'ورود به سیستم';
    }

    function showApp() {
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('appView').classList.remove('hidden');

        const u = window.App.state.user || {};
        const initial = (u.fullName || u.username || '?').charAt(0);

        // Topbar
        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        const metaEl = document.getElementById('userMeta');
        if (avatarEl) avatarEl.textContent = initial;
        if (nameEl) nameEl.textContent = u.fullName || u.username || '-';
        if (metaEl) metaEl.textContent = `${u.orgName || ''} - ${u.fyName || ''}`;

        // Sidebar mini
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarOrg = document.getElementById('sidebarUserOrg');
        const sidebarSubtitle = document.getElementById('sidebarSubtitle');

        if (sidebarAvatar) sidebarAvatar.textContent = initial;
        if (sidebarName) sidebarName.textContent = u.fullName || u.username || '-';
        if (sidebarOrg) sidebarOrg.textContent = u.orgName || '';
        if (sidebarSubtitle && u.dbName) sidebarSubtitle.textContent = u.dbName;
    }
    // ═══════════════════════════════════════════
    //  ACTIVATION
    // ═══════════════════════════════════════════
    function showActivation(systemId) {
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('appView').classList.add('hidden');
        document.getElementById('activationView').classList.remove('hidden');

        const el = document.getElementById('activationSystemId');
        if (el) el.textContent = systemId || '-';
    }

    function copySystemId() {
        const el = document.getElementById('activationSystemId');
        if (el) {
            navigator.clipboard.writeText(el.textContent);
            window.App.toast('System ID کپی شد');
        }
    }

    async function handleActivate(e) {
        e.preventDefault();

        const serial = document.getElementById('activationSerial').value.trim();
        const errBox = document.getElementById('activationError');
        const btnText = document.getElementById('activationBtnText');

        if (!serial) {
            errBox.textContent = 'سریال را وارد کنید';
            errBox.classList.remove('hidden');
            return;
        }

        errBox.classList.add('hidden');
        const orig = btnText.textContent;
        btnText.textContent = 'در حال فعال‌سازی...';

        try {
            const res = await fetch(`${BASE}/api/license/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serial })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'خطا در فعال‌سازی');
            }

            window.App.toast('✅ برنامه با موفقیت ثبت شد', 'success');

            // برگرد به Login
            setTimeout(() => {
                showLogin();
                window.App.Auth.checkLicense();
            }, 1500);
        } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
        } finally {
            btnText.textContent = orig;
        }
    }
    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return {
        checkLicense,
        loadOrganizations,
        loadFiscalYears,
        handleLogin,
        handleLogout,
        showLogin,
        showApp,
        showActivation,
        copySystemId,
        handleActivate
    };
})();