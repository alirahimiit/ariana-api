/* ═══════════════════════════════════════════════════
   UI / Alert — دیالوگ پیام (فقط OK)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

window.App.alert = (function () {
    'use strict';

    const ICONS = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ',
        question: '؟',
        alert: '🔔'
    };

    const TITLES = {
        success: 'عملیات موفق',
        error: 'خطا',
        warning: 'هشدار',
        info: 'اطلاع',
        question: 'پرسش',
        alert: 'اعلان'
    };

    function _esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    function show(message, options) {
        options = options || {};
        return new Promise((resolve) => {
            const type = (options.type || 'info').toLowerCase();
            const icon = options.icon || ICONS[type] || ICONS.info;
            const title = options.title || TITLES[type] || '';
            const okText = options.okText || 'باشه';
            const danger = options.danger === true || type === 'error';

            const overlay = document.createElement('div');
            overlay.className = 'sf-confirm-overlay';
            overlay.innerHTML = `
                <div class="sf-confirm-box alert-${type}">
                    <div class="sf-confirm-icon sf-icon-circle">${icon}</div>
                    ${title ? `<div class="sf-confirm-title">${_esc(title)}</div>` : ''}
                    <div class="sf-confirm-msg">${_esc(message)}</div>
                    <div class="sf-confirm-btns">
                        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="ok">
                            ${_esc(okText)}
                        </button>
                    </div>
                </div>`;

            document.body.appendChild(overlay);

            let closed = false;
            const cleanup = () => {
                if (closed) return;
                closed = true;
                document.removeEventListener('keydown', keyHandler, true);
                overlay.classList.add('closing');
                setTimeout(() => overlay.remove(), 150);
                resolve();
            };

            const keyHandler = (e) => {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    cleanup();
                }
            };
            document.addEventListener('keydown', keyHandler, true);

            overlay.querySelector('button')?.addEventListener('click', cleanup);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup();
            });

            setTimeout(() => overlay.querySelector('button')?.focus(), 60);
        });
    }

    show.success = (msg, opts) => show(msg, Object.assign({}, opts, { type: 'success' }));
    show.error = (msg, opts) => show(msg, Object.assign({}, opts, { type: 'error' }));
    show.warning = (msg, opts) => show(msg, Object.assign({}, opts, { type: 'warning' }));
    show.warn = show.warning;
    show.info = (msg, opts) => show(msg, Object.assign({}, opts, { type: 'info' }));
    show.question = (msg, opts) => show(msg, Object.assign({}, opts, { type: 'question' }));

    return show;
})();