/* ═══════════════════════════════════════════════════
   UI / CustomSelect — کامپوننت مشترک
   جایگزین <select> بومی (RTL-Safe)
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.UI = window.App.UI || {};

window.App.UI.CustomSelect = (function () {
    'use strict';

    const _registry = {};

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ⭐ بستن همه سلکت‌ها (عمومی)
    function closeAll() {
        document.querySelectorAll('.custom-select.open').forEach(function (el) {
            el.classList.remove('open');
        });
    }

    // ═══════════════════════════════════════════════════
    //  ساخت HTML
    // ═══════════════════════════════════════════════════
    function html(id, options, selectedValue, placeholder) {
        options = options || [];
        selectedValue = selectedValue == null ? '' : String(selectedValue);
        const sel = options.find(o => String(o.value) === selectedValue);

        _registry[id] = { options: options, value: selectedValue, onChange: null };

        const opts = options.map(o => {
            const isSel = String(o.value) === selectedValue ? 'selected' : '';
            const icon = o.icon ? `<span class="cs-icon">${o.icon}</span>` : '';
            return `<div class="cs-item ${isSel}" data-value="${esc(o.value)}">
                ${icon}
                <span class="cs-item-label">${esc(o.label)}</span>
            </div>`;
        }).join('');

        const labelText = sel ? sel.label : (placeholder || 'انتخاب کنید...');

        return `<div class="custom-select" id="${id}">
            <button type="button" class="cs-trigger" data-cs-trigger>
                <span class="cs-label">${esc(labelText)}</span>
                <span class="cs-arrow">▼</span>
            </button>
            <div class="cs-menu" data-cs-menu>${opts}</div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════
    //  فعال‌سازی یک Custom Select
    // ═══════════════════════════════════════════════════
    function bind(id, onChange) {
        const wrap = document.getElementById(id);
        if (!wrap) { console.warn('CustomSelect: not found', id); return; }

        if (!_registry[id]) _registry[id] = { options: [], value: '' };
        if (onChange) _registry[id].onChange = onChange;

        const trigger = wrap.querySelector('[data-cs-trigger]');
        const menu = wrap.querySelector('[data-cs-menu]');
        if (!trigger || !menu) return;

        // ⭐ اگه از قبل bind شده، دوباره bind نکن (جلوگیری از duplicate listener)
        if (trigger.dataset.csBound === '1') return;
        trigger.dataset.csBound = '1';

        // باز/بسته کردن
        trigger.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const wasOpen = wrap.classList.contains('open');
            closeAll();   // ⭐ همه رو ببند
            if (!wasOpen) {
                wrap.classList.add('open');   // ⭐ اگه قبلاً بسته بود، بازش کن
            }
        });

        // انتخاب گزینه
        menu.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const item = e.target.closest('.cs-item');
            if (!item) return;

            const value = item.dataset.value;
            const labelEl = item.querySelector('.cs-item-label');
            const label = labelEl ? labelEl.textContent : item.textContent.trim();

            _registry[id].value = value;
            menu.querySelectorAll('.cs-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');

            const labelSpan = trigger.querySelector('.cs-label');
            if (labelSpan) labelSpan.textContent = label;

            closeAll();   // ⭐ ببند همه

            if (_registry[id].onChange) {
                _registry[id].onChange(value);
            }
        });
    }

    // ═══════════════════════════════════════════════════
    //  فعال‌سازی همه‌ی select ها در یه container
    // ═══════════════════════════════════════════════════
    function bindAll(container, onChangeMap) {
        closeAll();   // ⭐ اول همه رو ببند
        const root = container || document;
        root.querySelectorAll('.custom-select').forEach(el => {
            const id = el.id;
            const cb = onChangeMap ? onChangeMap[id] : null;
            bind(id, cb);
        });
    }

    // ═══════════════════════════════════════════════════
    //  خواندن/نوشتن مقدار
    // ═══════════════════════════════════════════════════
    function getValue(id) {
        return _registry[id] ? _registry[id].value : '';
    }

    function setValue(id, value) {
        const wrap = document.getElementById(id);
        if (!wrap || !_registry[id]) return;

        value = String(value);
        _registry[id].value = value;

        const items = wrap.querySelectorAll('.cs-item');
        items.forEach(el => {
            if (el.dataset.value === value) {
                el.classList.add('selected');
                const labelEl = el.querySelector('.cs-item-label');
                const label = labelEl ? labelEl.textContent : el.textContent.trim();
                const labelSpan = wrap.querySelector('.cs-label');
                if (labelSpan) labelSpan.textContent = label;
            } else {
                el.classList.remove('selected');
            }
        });
    }

    // ═══════════════════════════════════════════════════
    //  بستن با کلیک بیرون — چند لایه امنیتی
    // ═══════════════════════════════════════════════════

    // لایه ۱: کلیک روی document
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.custom-select')) {
            closeAll();
        }
    });

    // لایه ۲: کلید Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeAll();
        }
    });

    // لایه ۳: هر بار صفحه scroll یا resize (بستن خودکار)
    window.addEventListener('scroll', closeAll, true);
    window.addEventListener('resize', closeAll);

    return {
        html: html,
        bind: bind,
        bindAll: bindAll,
        getValue: getValue,
        setValue: setValue,
        closeAll: closeAll
    };
})();