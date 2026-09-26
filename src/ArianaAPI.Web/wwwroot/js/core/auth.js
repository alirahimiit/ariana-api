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
        try {
            const res = await fetch(`${BASE}/api/license/status`);
            const data = await res.json();

            const warningEl = document.getElementById('licenseWarning');
            if (!warningEl) return;

            if (!data.isValid) {
                warningEl.className = 'license-warning';
                warningEl.innerHTML = `
                    <div>
                        <strong>لایسنس نامعتبر است</strong><br>
                        <small>${H.esc(data.errorMessage || '')}</small>
                    </div>`;
                warningEl.classList.remove('hidden');
            } else {
                warningEl.className = 'license-valid-info';
                const custName = data.customerName && data.customerName.trim()
                    ? data.customerName
                    : '(بدون نام)';
                warningEl.innerHTML = `
                    ✅ لایسنس معتبر | 
                    <strong>${H.esc(custName)}</strong>
                    | سازمان‌های مجاز: ${data.authorizedOrgs.length}
                    | انقضا: ${H.esc(data.expiresAt)}`;
                warningEl.classList.remove('hidden');
            }
        } catch (err) {
            console.error('License check failed:', err);
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
            // ⭐ راه‌اندازی permissions
            await window.App.Permissions.init(data.permissions);

            showApp();

            // ⭐ اعمال فیلتر روی منوها
            window.App.Permissions.applyMenuFilter();

            window.App.navigate('dashboard');
            window.App.toast('خوش آمدید!', 'success');
        } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
        } finally {
            btn.textContent = 'ورود';
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
        document.getElementById('loginView').classList.remove('hidden');
        document.getElementById('appView').classList.add('hidden');
        const pw = document.getElementById('password');
        if (pw) pw.value = '';

        // ⭐ پاک کردن permissions
        if (window.App.Permissions) {
            window.App.Permissions.clear();
        }
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
    //  API عمومی
    // ═══════════════════════════════════════════
    return {
        checkLicense,
        loadOrganizations,
        loadFiscalYears,
        handleLogin,
        handleLogout,
        showLogin,
        showApp
    };
})();