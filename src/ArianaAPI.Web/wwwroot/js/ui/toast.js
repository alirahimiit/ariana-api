/* ═══════════════════════════════════════════════════
   UI / Toast
   نمایش پیام کوتاه در پایین صفحه
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.UI = window.App.UI || {};

window.App.UI.Toast = (function () {
    'use strict';

    /**
     * نمایش پیام
     * @param {string} message
     * @param {''|'success'|'error'} [type]
     */
    function show(message, type = '') {
        const el = document.getElementById('toast');
        if (!el) return;

        el.textContent = message;
        el.className = 'toast ' + type;
        el.classList.remove('hidden');

        setTimeout(() => el.classList.add('hidden'), 3000);
    }

    return { show };
})();