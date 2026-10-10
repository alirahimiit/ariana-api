/* ═══════════════════════════════════════════════════
   UI / Confirm — دیالوگ تأییدیه (بله / خیر)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

window.App.confirm = (function () {
    'use strict';

    function _esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    /**
     * ask(message, options)
     *   title: عنوان
     *   okText / cancelText
     *   danger: boolean → دکمه قرمز
     *   type: 'question' | 'warning' | 'error' | 'info'
     * @returns Promise<boolean>
     */
    function ask(message, options) {
        options = options || {};
        return new Promise((resolve) => {
            const title = options.title || 'تأیید عملیات';
            const okText = options.okText || 'بله، ادامه';
            const cancelText = options.cancelText || 'لغو';
            const danger = options.danger === true;
            const type = options.type || (danger ? 'warning' : 'question');

            const icons = {
                question: '❓',
                warning: '⚠️',
                error: '⛔',
                info: 'ℹ️',
                danger: '⚠️'
            };

            const overlay = document.createElement('div');
            overlay.className = 'sf-confirm-overlay';
            overlay.innerHTML = `
                <div class="sf-confirm-box confirm-${type}">
                    <div class="sf-confirm-icon sf-icon-circle">${icons[type] || icons.question}</div>
                    <div class="sf-confirm-title">${_esc(title)}</div>
                    <div class="sf-confirm-msg">${_esc(message)}</div>
                    <div class="sf-confirm-btns">
                        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="ok">
                            ${_esc(okText)}
                        </button>
                        <button class="btn btn-ghost" data-action="cancel">
                            ${_esc(cancelText)}
                        </button>
                    </div>
                </div>`;

            document.body.appendChild(overlay);

            let closed = false;
            const cleanup = (result) => {
                if (closed) return;
                closed = true;
                document.removeEventListener('keydown', keyHandler, true);
                overlay.classList.add('closing');
                setTimeout(() => overlay.remove(), 150);
                resolve(result);
            };

            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault(); e.stopPropagation();
                    cleanup(false);
                } else if (e.key === 'Enter') {
                    e.preventDefault(); e.stopPropagation();
                    cleanup(true);
                }
            };
            document.addEventListener('keydown', keyHandler, true);

            overlay.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    cleanup(btn.dataset.action === 'ok');
                });
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });

            setTimeout(() => overlay.querySelector('[data-action="ok"]')?.focus(), 60);
        });
    }

    return ask;
})();