/* ═══════════════════════════════════════════════════
   Help Registry — لودر خودکار
   هر راهنما در فایل /js/features/help/pages/{key}.js
   ═══════════════════════════════════════════════════ */

window.HelpRegistry = (function () {

    const _registry = {};       // کش
    const _loadPromises = {};   // جلوگیری از لود دوباره

    // ⭐ ثبت محتوا (از داخل فایل‌های pages/ صدا زده می‌شه)
    function register(pageKey, content) {
        if (pageKey) _registry[pageKey] = content;
    }

    // ⭐ لود اسکریپت صفحه از سرور (بار اول)
    function _loadScript(pageKey) {
        if (_loadPromises[pageKey]) return _loadPromises[pageKey];

        _loadPromises[pageKey] = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = `/js/features/help/pages/${pageKey}.js`;
            s.async = true;

            s.onload = () => resolve(true);

            s.onerror = () => {
                // فایل وجود نداره → با احترام رد شو
                console.info(`[Help] راهنمایی برای «${pageKey}» یافت نشد (فایل نداره)`);
                resolve(false);
            };

            document.head.appendChild(s);
        });

        return _loadPromises[pageKey];
    }

    // ⭐ گرفتن محتوا — اگه نبود، خودش لود می‌کنه
    async function get(pageKey) {
        // کش داغ
        if (_registry[pageKey]) return _registry[pageKey];

        // تلاش برای لود
        const loaded = await _loadScript(pageKey);

        // اگه لود شد و ثبت کرد
        if (loaded && _registry[pageKey]) return _registry[pageKey];

        // fallback
        if (!_registry['__default__']) {
            await _loadScript('__default__');
        }
        return _registry['__default__'] || null;
    }

    // ⭐ چک سریع (بدون لود) — برای موارد خاص
    function has(pageKey) { return !!_registry[pageKey]; }

    return { register, get, has };
})();