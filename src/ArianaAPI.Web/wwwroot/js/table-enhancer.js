/* ═══════════════════════════════════════════════════
   TableEnhancer — سورت + تغییر اندازه ستون + ذخیره تنظیمات
   استفاده: TableEnhancer.enhance() بعد از هر رندر جدول
   ═══════════════════════════════════════════════════ */
const TableEnhancer = {
    _styleInjected: false,
    _storageKey: 'ariana_grid_layouts',

    // ═══════════════════════════════════════════
    //  تزریق استایل
    // ═══════════════════════════════════════════
    _injectStyle() {
        if (this._styleInjected) return;
        this._styleInjected = true;

        const style = document.createElement('style');
        style.textContent = `
            /* ═══ هدر سورت‌پذیر ═══ */
            .table-wrapper table th.sortable {
                cursor: pointer;
                user-select: none;
                position: relative;
                padding-left: 22px !important;
                padding-right: 22px !important;
                transition: background 0.12s;
            }
            .table-wrapper table th.sortable:hover {
                background: #E0E7FF !important;
            }
            .table-wrapper table th .sort-indicator {
                position: absolute;
                left: 8px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 10px;
                color: #9CA3AF;
                font-weight: 700;
                line-height: 1;
                pointer-events: none;
                transition: color 0.15s;
            }
            .table-wrapper table th.sort-asc .sort-indicator,
            .table-wrapper table th.sort-desc .sort-indicator {
                color: #4F46E5;
            }
            .table-wrapper table th.sort-asc,
            .table-wrapper table th.sort-desc {
                background: #EEF2FF !important;
            }
            .table-wrapper table th.sort-asc .sort-indicator::before { content: '▲'; }
            .table-wrapper table th.sort-desc .sort-indicator::before { content: '▼'; }
            .table-wrapper table th:not(.sort-asc):not(.sort-desc) .sort-indicator::before { content: '⇅'; opacity: 0.5; }

            /* ═══ دستگیره‌ی تغییر اندازه ═══ */
            .table-wrapper table th .col-resizer {
                position: absolute;
                left: -4px;
                top: 0;
                bottom: 0;
                width: 8px;
                cursor: col-resize;
                user-select: none;
                z-index: 2;
            }
            .table-wrapper table th .col-resizer::after {
                content: '';
                position: absolute;
                left: 3px;
                top: 20%;
                bottom: 20%;
                width: 2px;
                background: transparent;
                border-radius: 2px;
                transition: background 0.15s;
            }
            .table-wrapper table th .col-resizer:hover::after,
            .table-wrapper table th .col-resizer.active::after {
                background: #4F46E5;
                top: 0;
                bottom: 0;
            }
            body.col-resizing {
                cursor: col-resize !important;
                user-select: none !important;
            }
            body.col-resizing * { cursor: col-resize !important; }

            /* ═══ نوار ابزار گرید ═══ */
            .grid-toolbar {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 6px;
                margin-bottom: 8px;
                flex-wrap: wrap;
            }
            .grid-toolbar button {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 5px 11px;
                font-family: inherit;
                font-size: 11.5px;
                font-weight: 500;
                border-radius: 6px;
                border: 1px solid #E5E7EB;
                background: #fff;
                color: #374151;
                cursor: pointer;
                transition: all 0.15s;
            }
            .grid-toolbar button:hover {
                background: #EEF2FF;
                border-color: #4F46E5;
                color: #4F46E5;
            }
            .grid-toolbar .grid-hint {
                font-size: 11px;
                color: #9CA3AF;
                margin-left: auto;
                margin-right: 4px;
            }
        `;
        document.head.appendChild(style);
    },

    // ═══════════════════════════════════════════
    //  enhance — روی همه‌ی جدول‌های داخل root
    // ═══════════════════════════════════════════
    enhance(root = document) {
        this._injectStyle();

        const tables = root.querySelectorAll(
            '.table-wrapper table:not([data-enhanced]), table.daybook-table:not([data-enhanced])'
        );

        tables.forEach(table => {
            // جدول‌هایی که خیلی کوچیک هستن یا layout special دارن
            if (table.querySelectorAll('thead th').length < 2) return;
            this._enhanceTable(table);
        });
    },

    _enhanceTable(table) {
        table.setAttribute('data-enhanced', '1');
        table.style.tableLayout = 'fixed';

        const thead = table.querySelector('thead');
        if (!thead) return;

        const ths = Array.from(thead.querySelectorAll('th'));

        // کلید ذخیره‌سازی
        const key = this._tableKey(table);

        // ─── هر th: sort + resize ───
        ths.forEach((th, idx) => {
            // اگه th با data-nosort علامت خورده باشه، از سورت صرف‌نظر کن
            const noSort = th.hasAttribute('data-nosort') || th.textContent.trim() === '';
            const noResize = th.hasAttribute('data-noresize');

            if (!noSort) this._setupSort(th, idx, table);
            if (!noResize) this._setupResize(th, idx, table, key);
        });

        // ─── اعمال عرض‌های ذخیره‌شده ───
        this._applySavedWidths(table, key);

        // ─── نوار ابزار ───
        this._addGridToolbar(table, key);
    },

    // ═══════════════════════════════════════════
    //  کلید یکتا برای هر جدول
    // ═══════════════════════════════════════════
    _tableKey(table) {
        const page = (window.App && App.state && App.state.currentPage) || 'page';
        const headers = Array.from(table.querySelectorAll('thead th'))
            .map(th => th.textContent.trim().replace(/\s+/g, ' ').slice(0, 20))
            .join('|');
        // هش ساده
        let hash = 0;
        for (let i = 0; i < headers.length; i++) {
            hash = ((hash << 5) - hash + headers.charCodeAt(i)) | 0;
        }
        return `${page}_${Math.abs(hash).toString(36)}`;
    },

    // ═══════════════════════════════════════════
    //  SORT
    // ═══════════════════════════════════════════
    _setupSort(th, colIdx, table) {
        th.classList.add('sortable');

        // اضافه کردن نشانگر
        if (!th.querySelector('.sort-indicator')) {
            const ind = document.createElement('span');
            ind.className = 'sort-indicator';
            th.appendChild(ind);
        }

        th.addEventListener('click', (e) => {
            // اگه روی resizer کلیک شده، کاری نکن
            if (e.target.closest('.col-resizer')) return;

            let dir = 'asc';
            if (th.classList.contains('sort-asc')) dir = 'desc';
            else if (th.classList.contains('sort-desc')) dir = 'asc';

            // پاک کردن sort از بقیه‌ی th ها
            table.querySelectorAll('thead th').forEach(t => {
                t.classList.remove('sort-asc', 'sort-desc');
            });

            th.classList.add('sort-' + dir);

            this._sortTable(table, colIdx, dir);
        });
    },

    _sortTable(table, colIdx, dir) {
        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const type = this._detectColumnType(table, colIdx);
        const rows = Array.from(tbody.querySelectorAll(':scope > tr'));

        const getRaw = (tr) => {
            const td = tr.children[colIdx];
            return td ? td.textContent.trim() : '';
        };

        const parse = (v) => {
            if (!v || v === '-' || v === '—' || v === '…') return null;
            const norm = v
                .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

            if (type === 'date') {
                const parts = norm.match(/(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
                if (parts) return `${parts[1].padStart(4, '0')}${parts[2].padStart(2, '0')}${parts[3].padStart(2, '0')}`;
                return norm;
            }
            if (type === 'number') {
                let c = norm.replace(/[,\s٬،]/g, '');
                if (c.startsWith('(') && c.endsWith(')')) c = '-' + c.slice(1, -1);
                const n = parseFloat(c);
                return isNaN(n) ? null : n;
            }
            return v;
        };

        rows.sort((a, b) => {
            const va = parse(getRaw(a));
            const vb = parse(getRaw(b));
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            let cmp;
            if (type === 'number') cmp = va - vb;
            else cmp = String(va).localeCompare(String(vb), 'fa');
            return dir === 'asc' ? cmp : -cmp;
        });

        rows.forEach(r => tbody.appendChild(r));
    },

    _detectColumnType(table, colIdx) {
        const cells = table.querySelectorAll(`tbody tr > td:nth-child(${colIdx + 1})`);
        let numCount = 0, dateCount = 0, total = 0;

        cells.forEach(td => {
            const t = td.textContent.trim();
            if (!t || t === '-' || t === '—' || t === '…') return;
            total++;
            if (total > 30) return; // sample

            const norm = t
                .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

            if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(norm)) { dateCount++; return; }

            const c = norm.replace(/[,\s٬،]/g, '');
            if (/^-?\(?\d+(\.\d+)?\)?$/.test(c)) numCount++;
        });

        if (total === 0) return 'text';
        if (dateCount / total > 0.7) return 'date';
        if (numCount / total > 0.7) return 'number';
        return 'text';
    },

    // ═══════════════════════════════════════════
    //  RESIZE
    // ═══════════════════════════════════════════
    _setupResize(th, colIdx, table, key) {
        const handle = document.createElement('div');
        handle.className = 'col-resizer';
        handle.dataset.col = colIdx;
        th.appendChild(handle);

        let startX = 0;
        let startWidth = 0;

        const onMove = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            // RTL: کشیدن به چپ → بزرگ‌تر شدن ستون
            const delta = startX - clientX;
            const newWidth = Math.max(40, startWidth + delta);
            this._setColWidth(table, colIdx, newWidth);
        };

        const onUp = () => {
            document.body.classList.remove('col-resizing');
            handle.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            this._saveWidths(table, key);
        };

        const onDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            startX = clientX;
            startWidth = th.offsetWidth;
            handle.classList.add('active');
            document.body.classList.add('col-resizing');

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        };

        handle.addEventListener('mousedown', onDown);
        handle.addEventListener('touchstart', onDown, { passive: false });

        // جلوگیری از trigger شدن sort
        handle.addEventListener('click', e => e.stopPropagation());
    },

    _setColWidth(table, colIdx, width) {
        // روی همه‌ی th و td های همون ستون اعمال کن
        const rows = table.querySelectorAll('tr');
        rows.forEach(tr => {
            const cell = tr.children[colIdx];
            if (cell) {
                cell.style.width = width + 'px';
                cell.style.minWidth = width + 'px';
                cell.style.maxWidth = width + 'px';
            }
        });
    },

    _saveWidths(table, key) {
        const ths = table.querySelectorAll('thead th');
        const widths = Array.from(ths).map(th => Math.round(th.offsetWidth));
        const layouts = this._loadAllLayouts();
        layouts[key] = { widths, ts: Date.now() };
        localStorage.setItem(this._storageKey, JSON.stringify(layouts));
    },

    _applySavedWidths(table, key) {
        const layouts = this._loadAllLayouts();
        const layout = layouts[key];
        if (!layout || !layout.widths) return;
        if (layout.widths.length !== table.querySelectorAll('thead th').length) return;

        layout.widths.forEach((w, idx) => {
            if (w > 0) this._setColWidth(table, idx, w);
        });
    },

    _loadAllLayouts() {
        try {
            return JSON.parse(localStorage.getItem(this._storageKey) || '{}');
        } catch (e) { return {}; }
    },

    // ═══════════════════════════════════════════
    //  نوار ابزار گرید
    // ═══════════════════════════════════════════
    _addGridToolbar(table, key) {
        const wrapper = table.closest('.table-wrapper');
        if (!wrapper || wrapper.previousElementSibling?.classList?.contains('grid-toolbar')) return;
        if (wrapper.dataset.toolbar === '1') return;
        wrapper.dataset.toolbar = '1';

        const bar = document.createElement('div');
        bar.className = 'grid-toolbar';
        bar.innerHTML = `
            <span class="grid-hint">💡 برای سورت روی هدر کلیک کن، برای تغییر عرض از لبه‌ی ستون بکش</span>
            <button type="button" data-act="reset-cols">↺ ریست ستون‌ها</button>
            <button type="button" data-act="reset-sort">⇅ حذف سورت</button>
        `;

        wrapper.parentNode.insertBefore(bar, wrapper);

        bar.querySelector('[data-act="reset-cols"]').addEventListener('click', () => {
            const layouts = this._loadAllLayouts();
            delete layouts[key];
            localStorage.setItem(this._storageKey, JSON.stringify(layouts));
            table.querySelectorAll('th, td').forEach(c => {
                c.style.width = '';
                c.style.minWidth = '';
                c.style.maxWidth = '';
            });
        });

        bar.querySelector('[data-act="reset-sort"]').addEventListener('click', () => {
            table.querySelectorAll('thead th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
            rows.sort((a, b) => (parseInt(a.dataset.origIdx || 0) - parseInt(b.dataset.origIdx || 0)));
            rows.forEach(r => tbody.appendChild(r));
        });
    },

    // ═══════════════════════════════════════════
    //  پاک کردن چیدمان یک صفحه یا همه
    // ═══════════════════════════════════════════
    clearLayouts(pagePrefix = null) {
        if (!pagePrefix) {
            localStorage.removeItem(this._storageKey);
            return;
        }
        const layouts = this._loadAllLayouts();
        Object.keys(layouts).forEach(k => {
            if (k.startsWith(pagePrefix + '_')) delete layouts[k];
        });
        localStorage.setItem(this._storageKey, JSON.stringify(layouts));
    }
};