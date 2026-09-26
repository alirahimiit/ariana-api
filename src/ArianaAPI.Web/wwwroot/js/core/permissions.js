/**
 * ⭐ App.Permissions
 * مدیریت دسترسی‌های کاربر بر اساس گروه کاربری
 * 
 * - منوها: چک می‌کنه کاربر مجازه صفحه‌ای رو ببینه یا نه
 * - عملیات: چک می‌کنه کاربر مجازه دکمه‌ای رو بزنه یا نه
 * - EnVi: نحوه‌ی نمایش منوهای غیرمجاز (پنهان یا غیرفعال)
 */
window.App = window.App || {};

window.App.Permissions = (function () {
    'use strict';

    const STORAGE_KEY = 'ariana_permissions';

    let _perms = null;           // { menus, operations, enVi, userGroupCode, groupName }
    let _registry = [];          // از /api/permission/menus
    let _byKey = {};             // menuKey → [items]
    let _registryLoaded = false;

    // ═══════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════

    async function init(permissions) {
        _perms = normalize(permissions);
        persist();
        await loadRegistry();
    }

    function normalize(p) {
        if (!p) p = {};
        return {
            userGroupCode: p.userGroupCode || 0,
            groupName: p.groupName || '',
            enVi: p.enVi !== undefined ? p.enVi : true,
            menus: Array.isArray(p.menus) ? p.menus : [],
            operations: Array.isArray(p.operations) ? p.operations.map(Number) : [],
            sharhs: Array.isArray(p.sharhs) ? p.sharhs : [],
            sarfasls: Array.isArray(p.sarfasls) ? p.sarfasls : []
        };
    }

    function restore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) _perms = normalize(JSON.parse(raw));
        } catch (e) { _perms = null; }
        return _perms;
    }

    function persist() {
        try {
            if (_perms) localStorage.setItem(STORAGE_KEY, JSON.stringify(_perms));
        } catch (e) { /* ignore */ }
    }

    function clear() {
        _perms = null;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
    }

    // ═══════════════════════════════════════════════
    //  REGISTRY
    // ═══════════════════════════════════════════════

    async function loadRegistry() {
        if (_registryLoaded) return;
        try {
            _registry = await window.App.Http.get('/api/permission/menus') || [];
            rebuildIndex();
            _registryLoaded = true;
        } catch (e) {
            console.error('[Permissions] loadRegistry failed', e);
            _registry = [];
            _byKey = {};
        }
    }

    function rebuildIndex() {
        _byKey = {};
        _registry.forEach(item => {
            const k = item.menuKey;
            if (!_byKey[k]) _byKey[k] = [];
            _byKey[k].push(item);
        });
    }

    // ═══════════════════════════════════════════════
    //  MENU CHECK
    // ═══════════════════════════════════════════════

    /**
     * چک می‌کنه کاربر مجازه این منو رو ببینه
     * @param {string} menuKey - مثل 'Sanad', 'Taraz', 'Dashboard'
     */
    function hasMenu(menuKey) {
        if (!_perms) return false;

        const items = _byKey[menuKey] || [];

        // ⭐ اگه menuKey توی Registry نیست → آزاد
        // (چون یا صفحه Coming Soon هست یا Registry لود نشده)
        if (items.length === 0) return true;

        const mainItem = items.find(x => x.subKey === '');
        if (!mainItem) return true;   // ⭐ fail-open

        // اگه نیاز به permission نداره (مثل Dashboard) → آزاد
        if (!mainItem.requiresPermission) return true;

        // چک همه‌ی sub-item ها
        return items.some(item => {
            if (!item.windowsMenuName) return false;
            return _perms.menus.includes(item.windowsMenuName);
        });
    }

    /**
     * لیست subKey های مجاز برای یک صفحه‌ی چندحالته (مثل Taraz)
     * @param {string} menuKey
     * @returns {string[]} - مثل ['Col', 'Moein', 'Tafzili']
     */
    function getVisibleSubKeys(menuKey) {
        const items = _byKey[menuKey] || [];
        const subs = items.filter(x => x.subKey !== '');
        if (subs.length === 0) return [];

        if (!_perms) return [];

        return subs
            .filter(item => item.windowsMenuName && _perms.menus.includes(item.windowsMenuName))
            .map(item => item.subKey);
    }

    // ═══════════════════════════════════════════════
    //  OPERATION CHECK
    // ═══════════════════════════════════════════════

    /**
     * چک می‌کنه کاربر مجازه این عملیات رو انجام بده
     * @param {number|string} code - کد از جدول Other (مثل 101، 143)
     */
    function can(code) {
        if (!_perms) return false;
        return _perms.operations.includes(Number(code));
    }

    function canAny(codes) {
        return codes.some(c => can(c));
    }

    function canAll(codes) {
        return codes.every(c => can(c));
    }

    // ═══════════════════════════════════════════════
    //  UI FILTER
    // ═══════════════════════════════════════════════

    /**
     * همه‌ی عناصر با data-menu-key رو فیلتر می‌کنه
     * EnVi=true → hide
     * EnVi=false → disable (خاکستری)
     */
    function applyMenuFilter() {
        if (!_perms) return;

        const enVi = _perms.enVi;

        document.querySelectorAll('[data-menu-key]').forEach(el => {
            const key = el.getAttribute('data-menu-key');
            const allowed = hasMenu(key);

            if (allowed) {
                el.style.display = '';
                el.classList.remove('nav-item-disabled');
                el.removeAttribute('disabled');
                el.removeAttribute('aria-disabled');
            } else {
                if (enVi) {
                    el.style.display = 'none';
                } else {
                    el.style.display = '';
                    el.classList.add('nav-item-disabled');
                    el.setAttribute('disabled', 'disabled');
                    el.setAttribute('aria-disabled', 'true');
                }
            }
        });

        // اگه همه‌ی آیتم‌های یه گروه پنهان شدن، خود گروه رو هم پنهان کن
        document.querySelectorAll('.nav-group').forEach(group => {
            const items = group.querySelectorAll('[data-menu-key]');
            if (items.length === 0) return;

            const anyVisible = Array.from(items).some(el => el.style.display !== 'none');
            group.style.display = anyVisible ? '' : 'none';
        });
    }

    // ═══════════════════════════════════════════════
    //  GETTERS
    // ═══════════════════════════════════════════════

    function get() { return _perms; }
    function isEnVi() { return _perms ? _perms.enVi : true; }
    function getRegistry() { return _registry; }

    // ═══════════════════════════════════════════════
    //  EXPORT
    // ═══════════════════════════════════════════════

    return {
        init,
        restore,
        clear,
        loadRegistry,
        hasMenu,
        getVisibleSubKeys,
        can,
        canAny,
        canAll,
        applyMenuFilter,
        get,
        isEnVi,
        getRegistry
    };
})();