/* ═══════════════════════════════════════════════════
   Core / State
   نگه‌داری state سراسری برنامه — بدون منطق UI
   ═══════════════════════════════════════════════════
   وابستگی: App.Storage (اختیاری — برای persist)
   استفاده:
     App.State.get()              // ← کل state
     App.State.getUser()          // ← کاربر فعلی
     App.State.set({ token: 'x' }) // ← patch
     App.State.init()             // ← بازیابی از localStorage
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

App.State = (function () {
    'use strict';

    const STORAGE_KEY = 'ariana_auth';
    const SETTINGS_KEY = 'ariana_settings';

    // ═══════════════════════════════════════════
    //  State اولیه
    // ═══════════════════════════════════════════
    const _state = {
        token: null,
        refreshToken: null,
        user: null,
        apiKey: null,
        currentPage: 'dashboard',
        sanadPage: 1,
        settings: {
            pageSize: 10,
            logo: null
        }
    };

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════

    /**
     * بازگرداندن کل state (reference زنده)
     * @returns {object}
     */
    function get() {
        return _state;
    }

    /**
     * به‌روزرسانی چند فیلد
     * @param {object} patch
     */
    function set(patch) {
        Object.assign(_state, patch);
    }

    function getUser() { return _state.user; }
    function setUser(user) { _state.user = user; }
    function getToken() { return _state.token; }
    function getApiKey() { return _state.apiKey; }
    function getSettings() { return _state.settings; }
    function getCurrentPage() { return _state.currentPage; }

    /**
     * به‌روزرسانی تنظیمات
     * @param {object} patch
     */
    function updateSettings(patch) {
        Object.assign(_state.settings, patch);
        persistSettings();
    }

    // ═══════════════════════════════════════════
    //  Persistence
    // ═══════════════════════════════════════════

    /**
     * ذخیره‌ی auth در localStorage
     */
    function persistAuth() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                token: _state.token,
                refreshToken: _state.refreshToken,
                user: _state.user,
                apiKey: _state.apiKey
            }));
        } catch (e) {
            console.warn('Failed to persist auth', e);
        }
    }

    /**
     * حذف auth از localStorage
     */
    function clearAuth() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }
        _state.token = null;
        _state.refreshToken = null;
        _state.user = null;
        _state.apiKey = null;
    }

    /**
     * ذخیره‌ی تنظیمات
     */
    function persistSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(_state.settings));
        } catch (e) { /* ignore */ }
    }

    /**
     * بازیابی از localStorage در شروع
     */
    function init() {
        // ─── auth ───
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                _state.token = data.token;
                _state.refreshToken = data.refreshToken;
                _state.user = data.user;
                _state.apiKey = data.apiKey;
            }
        } catch (e) { /* ignore */ }

        // ─── settings ───
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                Object.assign(_state.settings, data);
            }
        } catch (e) { /* ignore */ }
    }

    return {
        get,
        set,
        getUser,
        setUser,
        getToken,
        getApiKey,
        getSettings,
        getCurrentPage,
        updateSettings,
        persistAuth,
        clearAuth,
        persistSettings,
        init
    };
})();