/* ═══════════════════════════════════════════════════
   UI / TableCardView
   تبدیل خودکار جدول‌ها به کارت در موبایل
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.UI = window.App.UI || {};

window.App.UI.TableCardView = (function () {
    'use strict';

    // آیا در حالت موبایل هستیم؟
    function isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    // پردازش یک جدول: اضافه کردن data-label از هدر
    function processTable(table) {
        // اگه علامت no-card داره، رد کن
        if (table.dataset.noCard !== undefined) return;
        if (table.classList.contains('mobile-card-view')) return;

        const thead = table.querySelector('thead');
        if (!thead) return;

        const headers = Array.from(thead.querySelectorAll('th'))
            .map(th => (th.textContent || '').trim());

        if (headers.length === 0) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        tbody.querySelectorAll('tr').forEach(tr => {
            const cells = tr.querySelectorAll('td');
            cells.forEach((td, i) => {
                // فقط اگه قبلاً داده نشده
                if (!td.hasAttribute('data-label') && headers[i]) {
                    td.setAttribute('data-label', headers[i]);
                }

                // اگه td خالیه و فقط دکمه‌ها داره → label خالی
                const text = (td.textContent || '').trim();
                const hasOnlyButtons = td.querySelectorAll('button, a').length > 0
                    && text === (Array.from(td.querySelectorAll('button, a'))
                        .map(b => (b.textContent || '').trim())
                        .join(''));

                if (hasOnlyButtons) {
                    td.setAttribute('data-label', '');
                    td.classList.add('td-actions');
                }
            });
        });

        table.classList.add('mobile-card-view');
    }

    // اعمال روی همه‌ی جدول‌ها در یک ریشه
    function apply(root) {
        root = root || document;

        // اگه دسکتاپه، کاری نکن
        if (!isMobile()) {
            // پاک کردن کلاس‌های موبایل (اگه قبلاً بوده)
            root.querySelectorAll('table.mobile-card-view').forEach(t => {
                t.classList.remove('mobile-card-view');
            });
            return;
        }

        root.querySelectorAll('table').forEach(processTable);
    }

    // ری‌پروسس همه‌چیز (در resize)
    function refresh() {
        document.querySelectorAll('table').forEach(processTable);
    }

    // هندل resize
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!isMobile()) {
                // در دسکتاپ، همه چیز رو برگردون
                document.querySelectorAll('table.mobile-card-view').forEach(t => {
                    t.classList.remove('mobile-card-view');
                });
            } else {
                refresh();
            }
        }, 200);
    });

    return { apply, refresh };
})();