/* ═══════════════════════════════════════════════════
   CollapsibleCard — کارت جمع‌شو
   استفاده: App.makeCollapsible(el, 'storage-key');
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};

window.App.makeCollapsible = function (cardSelector, storageKey) {
    const card = typeof cardSelector === 'string'
        ? document.querySelector(cardSelector)
        : cardSelector;

    if (!card) return;

    // اگه قبلاً فعال شده، دوباره نکن
    if (card.classList.contains('collapsible-card')) return;

    const title = card.querySelector('.card-title');
    if (!title) return;

    // ─── بدنه: هر چیزی که بعد از title هست ───
    let body = card.querySelector(':scope > .card-body');
    if (!body) {
        body = document.createElement('div');
        body.className = 'card-body';

        const children = Array.from(card.children);
        let pastTitle = false;
        children.forEach(child => {
            if (child === title) { pastTitle = true; return; }
            if (pastTitle) body.appendChild(child);
        });
        card.appendChild(body);
    }

    // ─── فلش ───
    if (!title.querySelector('.collapse-arrow')) {
        const arrow = document.createElement('span');
        arrow.className = 'collapse-arrow';
        arrow.textContent = '▼';
        title.appendChild(arrow);
    }

    // ─── کلاس ───
    card.classList.add('collapsible-card');

    // ─── بازیابی حالت ذخیره‌شده ───
    const key = 'ariana_collapse_' + (storageKey || 'default');
    if (localStorage.getItem(key) === '1') {
        card.classList.add('collapsed');
    }

    // ─── toggle روی کلیک هدر ───
    title.addEventListener('click', () => {
        card.classList.toggle('collapsed');
        const isCollapsed = card.classList.contains('collapsed');
        localStorage.setItem(key, isCollapsed ? '1' : '0');
    });
};