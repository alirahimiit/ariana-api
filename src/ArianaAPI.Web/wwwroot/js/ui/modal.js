/* ═══════════════════════════════════════════════════
   UI / Modal
   باز/بسته کردن modal عمومی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.UI = window.App.UI || {};

window.App.UI.Modal = (function () {
    'use strict';

    /**
     * باز کردن modal
     * @param {string} title
     * @param {string} bodyHtml
     */
    function open(title, bodyHtml) {
        const titleEl = document.getElementById('modalTitle');
        const bodyEl = document.getElementById('modalBody');
        const modalEl = document.getElementById('modal');

        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.innerHTML = bodyHtml;
        if (modalEl) modalEl.classList.remove('hidden');
    }

    function close() {
        const el = document.getElementById('modal');
        if (el) el.classList.add('hidden');
    }

    return { open, close };
})();