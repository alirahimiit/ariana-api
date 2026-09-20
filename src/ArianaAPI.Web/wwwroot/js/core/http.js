/* ═══════════════════════════════════════════════════
   Core / HTTP
   لایه ارتباط با API — fetch، auth، error handling
   ═══════════════════════════════════════════════════
   وابستگی: App.State (برای token و apiKey)
   استفاده:
     App.Http.init(window.location.origin)
     const data = await App.Http.api('/api/sanad');
     const data = await App.Http.api('/api/sanad', {
         method: 'POST',
         body: JSON.stringify({ ... })
     });
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

App.Http = (function () {
    'use strict';

    let _baseUrl = '';

    /**
     * راه‌اندازی اولیه
     * @param {string} baseUrl
     */
    function init(baseUrl) {
        _baseUrl = baseUrl;
    }

    /**
     * ارسال درخواست به API
     * @param {string} path
     * @param {object} [options]
     * @returns {Promise<any>}
     */
    async function api(path, options = {}) {
        const url = `${_baseUrl}${path}`;
        const state = App.State.get();

        // ─── Header ها ───
        const headers = {
            'X-Api-Key': state.apiKey || '',
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }

        // ─── fetch ───
        const res = await fetch(url, { ...options, headers });

        // ─── 401: logout خودکار ───
        if (res.status === 401) {
            App.Toast?.show?.('نشست منقضی شد. دوباره وارد شوید.', 'error');

            // خروج تمیز
            App.State.clearAuth();

            // نمایش صفحه‌ی login
            if (App.Auth?.showLogin) App.Auth.showLogin();
            else if (App.Boot?.showLogin) App.Boot.showLogin();

            throw new Error('Unauthorized');
        }

        // ─── خطاهای HTTP ───
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `خطا (${res.status})` }));
            throw new Error(err.error || `خطا (${res.status})`);
        }

        // ─── 204: بدون body ───
        if (res.status === 204) return null;

        // ─── JSON ───
        return await res.json();
    }

    /**
     * درخواست GET
     */
    function get(path, options = {}) {
        return api(path, { ...options, method: 'GET' });
    }

    /**
     * درخواست POST
     */
    function post(path, body, options = {}) {
        return api(path, {
            ...options,
            method: 'POST',
            body: typeof body === 'string' ? body : JSON.stringify(body)
        });
    }

    /**
     * درخواست PUT
     */
    function put(path, body, options = {}) {
        return api(path, {
            ...options,
            method: 'PUT',
            body: typeof body === 'string' ? body : JSON.stringify(body)
        });
    }

    /**
     * درخواست DELETE
     */
    function del(path, options = {}) {
        return api(path, { ...options, method: 'DELETE' });
    }

    return {
        init,
        api,
        get,
        post,
        put,
        del
    };
})();