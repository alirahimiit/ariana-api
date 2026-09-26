/**
 * ⭐ PermissionGuard
 * هر عنصر با data-permission="101" رو hide/disable می‌کنه
 * چند کد می‌شه با کاما جدا کرد: data-permission="101,102"  (OR)
 * data-permission-mode="all"  → همه باید باشن (AND)
 */
window.App = window.App || {};
window.App.UI = window.App.UI || {};

window.App.UI.PermissionGuard = (function () {
    'use strict';

    function apply(root) {
        root = root || document;
        const P = window.App.Permissions;
        if (!P || !P.get()) return;

        root.querySelectorAll('[data-permission]').forEach(el => {
            const raw = el.getAttribute('data-permission');
            if (!raw) return;

            const codes = raw.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
            if (codes.length === 0) return;

            const mode = (el.getAttribute('data-permission-mode') || 'any').toLowerCase();
            const allowed = mode === 'all' ? P.canAll(codes) : P.canAny(codes);

            if (allowed) {
                el.style.display = '';
                el.classList.remove('permission-denied');
                el.removeAttribute('disabled');
            } else {
                // hide by default
                el.style.display = 'none';
                el.classList.add('permission-denied');
            }
        });
    }

    return { apply };
})();