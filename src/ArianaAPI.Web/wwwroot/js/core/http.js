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

   ⭐ جدید (v2):
   - خطاهای HTTP خودکار به Toast تبدیل می‌شن
   - گزینه silent: true → بدون Toast (برای هندل دستی)
   - گزینه showError: false → معادل silent
   - گزینه successMsg: '...' → Toast موفقیت خودکار
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

App.Http = (function () {
    'use strict';

    let _baseUrl = '';

    /**
     * راه‌اندازی اولیه
     */
    function init(baseUrl) {
        _baseUrl = baseUrl;
    }

    /**
     * نمایش Toast — با fallback اگه Toast آماده نبود
     */
    function _showToast(message, type, opts) {
        // اولویت ۱: Toast جدید
        if (App.Toast && typeof App.Toast.show === 'function') {
            App.Toast.show(message, type, opts);
            return;
        }
        // اولویت ۲: تابع window.App.toast (نسخه قدیمی)
        if (typeof window.App.toast === 'function') {
            window.App.toast(message, type);
            return;
        }
        // Fallback نهایی (نباید معمولاً اینجا بیاد)
        console.warn('[Toast]', type, message);
    }

    /**
     * ارسال درخواست به API
     *
     * @param {string} path
     * @param {object} [options]
     * @param {boolean} [options.silent]       - اگه true → خطاها Toast نمی‌شن
     * @param {boolean} [options.showError]    - اگه false → خطا Toast نمی‌شه
     * @param {string}  [options.successMsg]   - پیام Toast موفقیت خودکار
     * @returns {Promise<any>}
     */
    async function api(path, options = {}) {
        const url = `${_baseUrl}${path}`;
        const state = App.State.get();

        // ─── تنظیمات نمایش خطا ───
        const silent = options.silent === true || options.showError === false;
        const successMsg = options.successMsg;

        // ─── پاک‌سازی گزینه‌های سفارشی قبل از fetch ───
        const { silent: _s, showError: _se, successMsg: _sm, ...fetchOptions } = options;

        // ─── Header ها ───
        const headers = {
            'X-Api-Key': state.apiKey || '',
            'Content-Type': 'application/json',
            ...(fetchOptions.headers || {})
        };
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }

        // ─── fetch ───
        let res;
        try {
            res = await fetch(url, { ...fetchOptions, headers });
        } catch (networkErr) {
            // خطای شبکه (قطعی اتصال)
            const msg = 'خطای اتصال به سرور. لطفاً اینترنت را بررسی کنید.';
            if (!silent) {
                _showToast(msg, 'error', { title: 'خطای شبکه' });
            }
            const err = new Error(msg);
            err.isNetworkError = true;
            err.handled = !silent;
            throw err;
        }

        // ═══════════════════════════════════════════
        //  ۴۰۱: نشست منقضی → خروج خودکار
        // ═══════════════════════════════════════════
        if (res.status === 401) {
            _showToast('نشست منقضی شد. دوباره وارد شوید.', 'warning', {
                title: 'نیاز به ورود مجدد'
            });

            App.State.clearAuth();

            if (App.Auth?.showLogin) App.Auth.showLogin();
            else if (App.Boot?.showLogin) App.Boot.showLogin();

            const err = new Error('Unauthorized');
            err.status = 401;
            err.handled = true;
            throw err;
        }

        // ═══════════════════════════════════════════
        //  خطاهای HTTP (4xx / 5xx)
        // ═══════════════════════════════════════════
        if (!res.ok) {
            let errMsg = `خطا (${res.status})`;

            // تلاش برای خواندن پیام دقیق از body
            try {
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const j = await res.json();
                    errMsg = j.error || j.message || j.detail || j.title || errMsg;
                } else {
                    const txt = await res.text();
                    if (txt && txt.trim()) {
                        // اگه HTML برگشت، متن رو خلاصه کن
                        if (txt.trim().startsWith('<')) {
                            errMsg = `خطای سرور (${res.status})`;
                        } else {
                            errMsg = txt;
                        }
                    }
                }
            } catch { }

            // ⭐ نمایش خودکار Toast — مگر اینکه silent باشه
            if (!silent) {
                const type = res.status >= 500 ? 'error' : 'warning';
                const title = res.status >= 500 ? 'خطای سرور' : 'خطا';
                _showToast(errMsg, type, { title });
            }

            const err = new Error(errMsg);
            err.status = res.status;
            err.handled = !silent;
            throw err;
        }

        // ═══════════════════════════════════════════
        //  موفقیت — Toast اختیاری
        // ═══════════════════════════════════════════
        if (successMsg && !silent) {
            _showToast(successMsg, 'success');
        }

        // ─── 204: بدون body ───
        if (res.status === 204) return null;

        // ─── JSON / text ───
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await res.json();
        }
        return await res.text();
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