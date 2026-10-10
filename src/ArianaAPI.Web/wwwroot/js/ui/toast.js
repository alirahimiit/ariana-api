/* ═══════════════════════════════════════════════════
   UI / Toast — اعلان‌های شیک
   ═══════════════════════════════════════════════════
   ⭐ سازگار با:
   - App.UI.Toast.show(msg, type)    → کد قدیمی
   - App.toast(msg, type)             → کد جدید (alias)
   - App.Toast.show(msg, type)        → alias دوم
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.UI = window.App.UI || {};

(function () {
    'use strict';

    const ICONS = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ',
        alert: '★',
        '': 'ℹ'
    };

    const TITLES = {
        success: 'موفق',
        error: 'خطا',
        warning: 'هشدار',
        info: 'اطلاع',
        alert: 'اعلان',
        '': 'اطلاع'
    };

    const DURATIONS = {
        success: 3500,
        info: 4000,
        warning: 6000,
        error: 0,       // فقط دستی بسته می‌شه
        alert: 0,
        '': 3500
    };

    const ALIASES = {
        'warn': 'warning',
        'danger': 'error',
        'err': 'error',
        'ok': 'success',
        'empty': 'info'
    };

    let _container = null;
    let _toasts = [];

    function normalizeType(t) {
        if (t === undefined || t === null || t === '') return 'info';
        const s = String(t).toLowerCase().trim();
        if (ALIASES[s]) return ALIASES[s];
        if (ICONS[s] !== undefined) return s;
        return 'info';
    }

    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function ensureContainer() {
        if (_container && document.body.contains(_container)) return _container;

        // ⭐ اگه کانتینر مدرن هست، استفاده کن
        _container = document.getElementById('toastContainer');
        if (!_container) {
            _container = document.createElement('div');
            _container.id = 'toastContainer';
            _container.className = 'toast-container';
            document.body.appendChild(_container);
        }
        return _container;
    }

    /**
     * نمایش Toast
     * @param {string} message
     * @param {string} [type] - success | error | warning | info | alert
     * @param {object} [options] - { title, duration }
     * @returns {function|undefined} close function
     */
    function show(message, type, options) {
        try {
            type = normalizeType(type);
            options = options || {};

            const duration = options.duration !== undefined
                ? options.duration
                : (DURATIONS[type] !== undefined ? DURATIONS[type] : 4000);
            const title = options.title || TITLES[type] || '';

            // ⭐ حالت ۱: HTML قدیمی داره — <div id="toast">
            const legacyEl = document.getElementById('toast');
            if (legacyEl && !document.getElementById('toastContainer')) {
                // ازش استفاده کن (کد قدیمی)
                legacyEl.textContent = message;
                legacyEl.className = 'toast ' + type;
                legacyEl.classList.remove('hidden');
                clearTimeout(legacyEl._timer);
                legacyEl._timer = setTimeout(() => {
                    legacyEl.classList.add('hidden');
                }, duration > 0 ? duration : 3000);
                return;
            }

            // ⭐ حالت ۲: کانتینر مدرن
            const container = ensureContainer();
            const toast = document.createElement('div');
            toast.className = 'toast-item toast-' + type;
            toast.innerHTML = `
                <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
                <div class="toast-body">
                    ${title ? `<div class="toast-title">${esc(title)}</div>` : ''}
                    <div class="toast-message">${esc(message)}</div>
                </div>
                <button class="toast-close" type="button" title="بستن">✕</button>
                ${duration > 0 ? `<div class="toast-progress" style="animation-duration:${duration}ms"></div>` : ''}
            `;

            container.appendChild(toast);
            _toasts.push(toast);

            requestAnimationFrame(() => toast.classList.add('toast-in'));

            const close = () => {
                if (toast._closed) return;
                toast._closed = true;
                toast.classList.remove('toast-in');
                toast.classList.add('toast-out');
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                    _toasts = _toasts.filter(x => x !== toast);
                }, 300);
            };

            toast.querySelector('.toast-close')?.addEventListener('click', close);

            if (duration > 0) {
                let timer = setTimeout(close, duration);
                toast.addEventListener('mouseenter', () => clearTimeout(timer));
                toast.addEventListener('mouseleave', () => {
                    if (!toast._closed) timer = setTimeout(close, 1500);
                });
            }

            // حداکثر ۵ تا همزمان
            while (_toasts.length > 5) {
                const old = _toasts.shift();
                if (old && old.parentNode) old.parentNode.removeChild(old);
            }

            return close;

        } catch (err) {
            // هیچ‌وقت crash نکن
            console.warn('[Toast]', type, message, err);
        }
    }

    // ⭐ API اصلی — UI.Toast
    window.App.UI.Toast = { show };

    // ⭐ Alias ۱ — App.Toast (برای کد جدید)
    window.App.Toast = { show };

    // ⭐ Alias ۲ — App.toast (تابع ساده، برای همه‌جا)
    window.App.toast = function (message, type, options) {
        return show(message, type, options);
    };

    // ⭐ شورتکات‌های راحت
    window.App.toast.success = (m, o) => show(m, 'success', o);
    window.App.toast.error = (m, o) => show(m, 'error', o);
    window.App.toast.warning = (m, o) => show(m, 'warning', o);
    window.App.toast.warn = (m, o) => show(m, 'warning', o);
    window.App.toast.info = (m, o) => show(m, 'info', o);
    window.App.toast.alert = (m, o) => show(m, 'alert', o);

    console.log('[Toast] ✓ آماده — App.UI.Toast / App.Toast / App.toast');
})();