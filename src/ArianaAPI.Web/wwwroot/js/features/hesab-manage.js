/* ═══════════════════════════════════════════════════════════
   Feature / HesabManage — مدیریت حساب‌ها
   نسخه 2.0 — با گروه + تفضیلی ۲
   ═══════════════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.HesabManage = (function () {
    'use strict';

    const H = window.App.Helpers;

    let _state = {
        level: 'group',
        search: '',
        items: [],           // لیست اصلی از سرور
        displayItems: [],    // ⭐ لیست پس از سورت
        sort: { col: null, dir: 'asc' },   // ⭐ جدید
        loading: false,
        cache: { cols: [], loaded: false }
    };
    let _searchDebounce = null;
    let _containerRef = null;

    const LEVEL_LABELS = {
        group: 'گروه',
        col: 'کل',
        moein: 'معین',
        tafzil: 'تفضیلی ۱',
        tafzil2: 'تفضیلی ۲'
    };

    const GROUP_TYPES = [
        { code: 1, name: 'دارایی' },
        { code: 2, name: 'بدهی' },
        { code: 3, name: 'فروش' },
        { code: 4, name: 'خرید' },
        { code: 5, name: 'هزینه' },
        { code: 6, name: 'درآمد' }
    ];

    function levelLabel(lv) { return LEVEL_LABELS[lv] || lv; }

    // ⭐ سورت — روی لیست client-side
    function sortBy(col) {
        if (_state.sort.col === col) {
            _state.sort.dir = _state.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            _state.sort.col = col;
            _state.sort.dir = 'asc';
        }
        applySort();
        renderTable();
    }

    function sortIcon(col) {
        if (_state.sort.col !== col) return '<span class="sort-icon-idle">⇅</span>';
        return _state.sort.dir === 'asc'
            ? '<span class="sort-icon-active">▲</span>'
            : '<span class="sort-icon-active">▼</span>';
    }

    function applySort() {
        const list = [..._state.items];
        const { col, dir } = _state.sort;
        if (!col) {
            _state.displayItems = list;
            return;
        }
        const mult = dir === 'asc' ? 1 : -1;
        list.sort((a, b) => {
            let va = a[col], vb = b[col];
            if (va == null) va = '';
            if (vb == null) vb = '';
            // اعداد
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
            // تاریخ‌ها (رشته‌ی yyyy/MM/dd)
            // متن‌ها
            return String(va).localeCompare(String(vb), 'fa') * mult;
        });
        _state.displayItems = list;
    }

    function mahiatText(m) {
        if (m === 1) return 'بدهکار';
        if (m === 2) return 'بستانکار';
        if (m === 3) return 'عادی';
        return '-';
    }

    function vaziatText(v) { return v === 1 ? 'فعال' : 'غیرفعال'; }

    // ═══ LOOKUPS ═══
    async function ensureLookups() {
        if (_state.cache.loaded) return;
        try {
            const cols = await window.App.Http.api('/api/hesab/list?level=col');
            _state.cache.cols = (cols || []).sort((a, b) => a.codeCol - b.codeCol);
            _state.cache.loaded = true;
        } catch (err) { console.error('Lookup failed:', err); }
    }

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════
    async function render(targetContainer) {
        const c = targetContainer || document.getElementById('content');
        if (!c) return;
        _containerRef = c;

        c.innerHTML = `
            <div class="hm-page">
                <div class="hm-card">
                    <div class="hm-tabs">
                        ${['group', 'col', 'moein', 'tafzil', 'tafzil2'].map(lv => `
                            <button class="hm-tab ${_state.level === lv ? 'active' : ''}" data-level="${lv}">
                                ${levelLabel(lv)}
                            </button>
                        `).join('')}
                    </div>

                    <div class="hm-toolbar">
                        <div class="hm-search">
                            <span class="hm-search-icon">🔍</span>
                            <input type="text" id="hmSearch"
                                   placeholder="جستجو (کد یا نام)..."
                                   value="${H.esc(_state.search)}"
                                   autocomplete="off">
                        </div>
                        <div class="hm-actions">
                            ${_state.level !== 'tafzil2' ? `
                                <button class="btn btn-primary btn-sm" id="hmCreateBtn">
                                    ➕ ایجاد ${levelLabel(_state.level)} جدید
                                </button>
                            ` : ''}
                            <button class="btn btn-ghost btn-sm" id="hmRefreshBtn" title="به‌روزرسانی">🔄</button>
                        </div>
                    </div>

                    <div class="hm-list-wrap" id="hmListWrap">
                        <div class="loading"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>`;

        c.querySelectorAll('.hm-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const lv = tab.dataset.level;
                if (lv === _state.level) return;
                _state.level = lv;
                _state.search = '';
                _state.sort = { col: null, dir: 'asc' };   // ⭐ ریست سورت
                render(_containerRef);
            });
        });

        const searchInput = document.getElementById('hmSearch');
        searchInput?.addEventListener('input', () => {
            clearTimeout(_searchDebounce);
            _searchDebounce = setTimeout(() => {
                _state.search = searchInput.value.trim();
                loadList();
            }, 250);
        });

        document.getElementById('hmCreateBtn')?.addEventListener('click', openCreateForm);
        document.getElementById('hmRefreshBtn')?.addEventListener('click', () => {
            window.App.UI.HesabPicker?.invalidateCache?.();
            loadList();
        });

        await loadList();
    }

    // ═══════════════════════════════════════════
    //  LOAD LIST
    // ═══════════════════════════════════════════
    async function loadList() {
        const wrap = document.getElementById('hmListWrap');
        if (!wrap) return;

        _state.loading = true;
        wrap.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            // ⭐ تفضیلی ۲ هنوز ساخته نشده — placeholder
            if (_state.level === 'tafzil2') {
                _state.items = [];
                _state.displayItems = [];
                _state.loading = false;
                renderTafzili2Placeholder();
                return;
            }

            // ⭐ همه‌ی سطوح دیگه → از API لیست بگیر
            const url = `/api/hesab/list?level=${_state.level}` +
                (_state.search ? `&search=${encodeURIComponent(_state.search)}` : '');
            const items = await window.App.Http.api(url) || [];

            _state.items = items;
            applySort();                     // ⭐ سورت کن
            _state.loading = false;
            renderTable();
        } catch (err) {
            _state.loading = false;
            wrap.innerHTML = `<div class="error-box">خطا: ${H.esc(err.message)}</div>`;
        }
    }

    function renderTafzili2Placeholder() {
        const wrap = document.getElementById('hmListWrap');
        if (!wrap) return;
        wrap.innerHTML = `
        <div class="hm-empty" style="padding:80px 20px;">
            <div class="hm-empty-icon" style="font-size:64px;">🚧</div>
            <div class="hm-empty-text" style="font-size:16px; font-weight:600; color:#374151;">
                ماژول تفضیلی ۲ به زودی
            </div>
            <div style="margin-top:12px; color:#6B7280; font-size:13px; max-width:400px; margin-right:auto; margin-left:auto;">
                این بخش هنوز پیاده‌سازی نشده است.<br>
                جدول <code style="background:#F3F4F6; padding:2px 6px; border-radius:4px;">Tafzili2</code> 
                آماده است و در نسخه‌های بعدی، CRUD و اتصال به اسناد اضافه می‌شود.
            </div>
        </div>`;
    }
    // ═══════════════════════════════════════════
    //  RENDER TABLE
    // ═══════════════════════════════════════════
    function renderTable() {
        const wrap = document.getElementById('hmListWrap');
        if (!wrap) return;

        const items = _state.displayItems;

        if (items.length === 0) {
            wrap.innerHTML = `
                <div class="hm-empty">
                    <div class="hm-empty-icon">📭</div>
                    <div class="hm-empty-text">
                        ${_state.search ? 'موردی با این جستجو یافت نشد' : `${levelLabel(_state.level)}ای یافت نشد`}
                    </div>
                </div>`;
            return;
        }

        const isGroup = _state.level === 'group';
        const isCol = _state.level === 'col';
        const isMoein = _state.level === 'moein';
        const isTafzil = _state.level === 'tafzil';
        const isTafzil2 = _state.level === 'tafzil2';

        const rows = items.map(it => {
            let codeDisplay = '';
            if (isGroup) codeDisplay = it.codeGroup;
            else if (isCol) codeDisplay = it.codeCol;
            else if (isMoein) codeDisplay = `${it.codeCol} - ${it.codeMoein}`;
            else if (isTafzil) codeDisplay = it.codeTafzil;

            const badges = [];
            if (isGroup && it.groupTypeName) {
                badges.push(`<span class="hm-badge hm-badge-gtype">${H.esc(it.groupTypeName)}</span>`);
            }
            if (it.hasTafzili) badges.push('<span class="hm-badge hm-badge-tafzil">تفصیلی ۱</span>');
            if (it.hasTafzili2) badges.push('<span class="hm-badge hm-badge-tafzil">تفصیلی ۲</span>');
            if (it.isStock) badges.push('<span class="hm-badge hm-badge-stock">انبار</span>');
            if (it.isCodeVahed) badges.push('<span class="hm-badge hm-badge-vahed">کد واحد</span>');
            if (it.isCodeMarkaz) badges.push('<span class="hm-badge hm-badge-markaz">مرکز هزینه</span>');
            if (it.isCodeProjeh) badges.push('<span class="hm-badge hm-badge-projeh">کد پروژه</span>');

            const mahiatCls = it.mahiat === 1 ? 'hm-mahiat-bed'
                : it.mahiat === 2 ? 'hm-mahiat-bes' : 'hm-mahiat-neutral';
            const vaziatCls = it.vaziat === 1 ? 'hm-active' : 'hm-inactive';

            const showMahiat = !isGroup && !isTafzil2;
            const showVaziat = !isTafzil2;

            let actionBtns = '';
            if (!isTafzil2) {
                actionBtns = `
                    <button class="btn btn-sm btn-ghost hm-edit-btn" data-id="${it.hesabID}" title="ویرایش">✏️</button>
                    <button class="btn btn-sm btn-ghost hm-del-btn" data-id="${it.hesabID}" title="حذف" style="color:#DC2626;">🗑️</button>`;
            }

            return `
                <tr data-id="${it.hesabID}">
                    <td class="hm-col-code"><code>${H.esc(String(codeDisplay))}</code></td>
                    <td class="hm-col-name">${H.esc(it.name || '')}</td>
                    ${showMahiat ? `
                        <td class="hm-col-mahiat">
                            <span class="hm-badge ${mahiatCls}">${mahiatText(it.mahiat)}</span>
                        </td>` : ''}
                    ${showVaziat ? `
                        <td class="hm-col-vaziat">
                            <span class="hm-dot ${vaziatCls}"></span>${vaziatText(it.vaziat)}
                        </td>` : ''}
                    <td class="hm-col-badges">${badges.join(' ') || '<span style="color:#9CA3AF;">—</span>'}</td>
                    <td class="hm-col-actions">${actionBtns}</td>
                </tr>`;
        }).join('');

        const showMahiatCol = _state.level !== 'group' && _state.level !== 'tafzil2';
        const showVaziatCol = _state.level !== 'tafzil2';

        // ⭐ کلید سورت هر ستون
        const sortKeyCode = isGroup ? 'codeGroup'
            : isCol ? 'codeCol'
                : isMoein ? 'codeMoein'
                    : isTafzil ? 'codeTafzil'
                        : null;

        wrap.innerHTML = `
            <div class="hm-count">${items.length} مورد</div>
            <div class="hm-table-wrap">
                <table class="hm-table">
                    <thead>
                        <tr>
                            <th class="sortable-th" onclick="App.Features.HesabManage.sortBy('${sortKeyCode}')">
                                کد ${sortIcon(sortKeyCode)}
                            </th>
                            <th class="sortable-th" onclick="App.Features.HesabManage.sortBy('name')">
                                نام ${sortIcon('name')}
                            </th>
                            ${showMahiatCol ? `
                                <th class="sortable-th" onclick="App.Features.HesabManage.sortBy('mahiat')">
                                    ماهیت ${sortIcon('mahiat')}
                                </th>` : ''}
                            ${showVaziatCol ? `
                                <th class="sortable-th" onclick="App.Features.HesabManage.sortBy('vaziat')">
                                    وضعیت ${sortIcon('vaziat')}
                                </th>` : ''}
                            <th style="width:240px;">ویژگی‌ها</th>
                            <th style="width:100px;">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        wrap.querySelectorAll('.hm-edit-btn').forEach(b => {
            b.addEventListener('click', () => openEditForm(parseInt(b.dataset.id)));
        });
        wrap.querySelectorAll('.hm-del-btn').forEach(b => {
            b.addEventListener('click', () => deleteItem(parseInt(b.dataset.id)));
        });
    }
    // ═══════════════════════════════════════════
    //  CREATE
    // ═══════════════════════════════════════════
    async function openCreateForm() {
        // ⭐ تفصیلی ۱ → فرم خودش
        if (_state.level === 'tafzil') {
            if (window.App.Features.TafziliForm) window.App.Features.TafziliForm.openCreate();
            else window.App.toast('ماژول تفضیلی بارگذاری نشده', 'error');
            return;
        }

        await ensureLookups();
        const nextCode = await fetchNextCode();

        const body = buildFormHtml({
            mode: 'create',
            level: _state.level,
            code: nextCode,
            name: '',
            discript: '',
            mahiat: 1,
            vaziat: 1,
            groupTypeCode: 1,
            hasTafzili: 0, hasTafzili2: 0, isStock: 0,
            isCodeVahed: 0, isCodeMarkaz: 0, isCodeProjeh: 0,
            locked: { mahiat: false, code: true, groupType: false }
        });

        window.App.openModal(`➕ ایجاد ${levelLabel(_state.level)} جدید`, body);
        document.querySelector('.modal-box')?.classList.add('hm-modal');
        bindFormEvents('create');
    }

    async function openEditForm(id) {
        // ⭐ تفصیلی ۱ → فرم خودش
        if (_state.level === 'tafzil') {
            if (window.App.Features.TafziliForm) window.App.Features.TafziliForm.openEdit(id);
            else window.App.toast('ماژول تفضیلی بارگذاری نشده', 'error');
            return;
        }

        try {
            await ensureLookups();
            const [item, usage] = await Promise.all([
                window.App.Http.api(`/api/hesab/${id}`),
                window.App.Http.api(`/api/hesab/${id}/usage`).catch(() => null)
            ]);

            if (!item) { window.App.toast('حساب یافت نشد', 'error'); return; }

            const locked = {
                mahiat: usage?.usedInSanad === true,
                code: true,
                groupType: usage?.usedInSanad === true
            };

            const codeDisplay = _state.level === 'group' ? item.codeGroup
                : _state.level === 'moein' ? `${item.codeCol} - ${item.codeMoein}`
                    : _state.level === 'tafzil' ? item.codeTafzil
                        : item.codeCol;

            const body = buildFormHtml({
                mode: 'edit',
                id: id,
                level: _state.level,
                code: codeDisplay,
                name: item.name || '',
                discript: item.discript || '',
                mahiat: item.mahiat || 1,
                vaziat: item.vaziat ?? 1,
                groupTypeCode: item.groupTypeCode || 1,
                hasTafzili: item.hasTafzili || 0,
                hasTafzili2: item.hasTafzili2 || 0,
                isStock: item.isStock || 0,
                isCodeVahed: item.isCodeVahed || 0,
                isCodeMarkaz: item.isCodeMarkaz || 0,
                isCodeProjeh: item.isCodeProjeh || 0,
                codeCol: item.codeCol,
                locked: locked,
                usage: usage
            });

            window.App.openModal(`✏️ ویرایش ${levelLabel(_state.level)}`, body);
            document.querySelector('.modal-box')?.classList.add('hm-modal');
            bindFormEvents('edit', id, item);
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════
    //  BUILD FORM
    // ═══════════════════════════════════════════
    function buildFormHtml(d) {
        const isCreate = d.mode === 'create';
        const lv = d.level;
        const isGroup = lv === 'group';
        const isMoein = lv === 'moein';
        const isCol = lv === 'col';

        let lockWarning = '';
        if (d.usage?.usedInSanad) {
            lockWarning = `
                <div class="hm-warn">
                    <span class="hm-warn-icon">⚠️</span>
                    <div>
                        این حساب در <strong>${H.fmt(d.usage.sanadCount)} سند</strong> استفاده شده — 
                        <strong>تغییر ماهیت/نوع مجاز نیست</strong>.<br>
                        بقیه فیلدها آزاد هستند.
                    </div>
                </div>`;
        }

        // فیلد والد برای معین
        let parentColField = '';
        if (isMoein && isCreate) {
            const colOpts = ['<option value="0">-- انتخاب کل --</option>']
                .concat(_state.cache.cols.map(c =>
                    `<option value="${c.codeCol}">${c.codeCol} - ${H.esc(c.name)}</option>`))
                .join('');
            parentColField = `
                <div class="hm-form-row">
                    <label>حساب کل <span class="req">*</span></label>
                    <select id="hmParentCol">${colOpts}</select>
                </div>`;
        }

        // فیلد نوع گروه (فقط برای گروه)
        let groupTypeField = '';
        if (isGroup) {
            const gTypeOpts = GROUP_TYPES.map(gt =>
                `<option value="${gt.code}" ${d.groupTypeCode === gt.code ? 'selected' : ''}>${gt.name}</option>`
            ).join('');
            groupTypeField = `
                <div class="hm-form-row">
                    <label>نوع گروه <span class="req">*</span></label>
                    <select id="hmGroupType" ${d.locked?.groupType ? 'disabled' : ''}>${gTypeOpts}</select>
                </div>`;
        }

        return `
            <div class="hm-form">
                ${lockWarning}
                ${parentColField}
                ${groupTypeField}

                <div class="hm-form-row">
                    <label>کد ${levelLabel(lv)}</label>
                    <input type="text" id="hmCode"
                           value="${H.esc(String(d.code || ''))}"
                           readonly placeholder="خودکار">
                </div>

                <div class="hm-form-row">
                    <label>نام <span class="req">*</span></label>
                    <input type="text" id="hmName" value="${H.esc(d.name || '')}" autofocus>
                </div>

                <div class="hm-form-row">
                    <label>توضیحات</label>
                    <input type="text" id="hmDiscript" value="${H.esc(d.discript || '')}">
                </div>

                ${!isGroup ? `
                <div class="hm-form-row hm-form-row-inline">
                    <label>ماهیت</label>
                    <div class="hm-radio-group">
                        <label class="hm-radio">
                            <input type="radio" name="hmMahiat" value="1" ${d.mahiat === 1 ? 'checked' : ''}
                                   ${d.locked?.mahiat ? 'disabled' : ''}>
                            <span>بدهکار</span>
                        </label>
                        <label class="hm-radio">
                            <input type="radio" name="hmMahiat" value="2" ${d.mahiat === 2 ? 'checked' : ''}
                                   ${d.locked?.mahiat ? 'disabled' : ''}>
                            <span>بستانکار</span>
                        </label>
                        <label class="hm-radio">
                            <input type="radio" name="hmMahiat" value="3" ${d.mahiat === 3 ? 'checked' : ''}
                                   ${d.locked?.mahiat ? 'disabled' : ''}>
                            <span>عادی</span>
                        </label>
                    </div>
                </div>
                ` : ''}

                <div class="hm-form-row hm-form-row-inline">
                    <label>وضعیت</label>
                    <div class="hm-radio-group">
                        <label class="hm-radio">
                            <input type="radio" name="hmVaziat" value="1" ${d.vaziat === 1 ? 'checked' : ''}>
                            <span>فعال</span>
                        </label>
                        <label class="hm-radio">
                            <input type="radio" name="hmVaziat" value="0" ${d.vaziat === 0 ? 'checked' : ''}>
                            <span>غیرفعال</span>
                        </label>
                    </div>
                </div>

                ${(isMoein) ? `
                <div class="hm-form-section">ویژگی‌های حساب</div>
                <div class="hm-checks">
                    <label class="hm-check">
                        <input type="checkbox" id="hmHasTafzili" ${d.hasTafzili ? 'checked' : ''}>
                        <span>تفصیلی ۱ دارد</span>
                    </label>
                    <label class="hm-check">
                        <input type="checkbox" id="hmHasTafzili2" ${d.hasTafzili2 ? 'checked' : ''}>
                        <span>تفصیلی ۲ دارد</span>
                    </label>
                    <label class="hm-check">
                        <input type="checkbox" id="hmIsStock" ${d.isStock ? 'checked' : ''}>
                        <span>انبار</span>
                    </label>
                    <label class="hm-check">
                        <input type="checkbox" id="hmIsCodeVahed" ${d.isCodeVahed ? 'checked' : ''}>
                        <span>کد واحد</span>
                    </label>
                    <label class="hm-check">
                        <input type="checkbox" id="hmIsCodeMarkaz" ${d.isCodeMarkaz ? 'checked' : ''}>
                        <span>مرکز هزینه</span>
                    </label>
                    <label class="hm-check">
                        <input type="checkbox" id="hmIsCodeProjeh" ${d.isCodeProjeh ? 'checked' : ''}>
                        <span>کد پروژه</span>
                    </label>
                </div>
                ` : ''}

                <div class="hm-form-footer">
                    <button class="btn btn-primary" id="hmSaveBtn">💾 ذخیره</button>
                    <button class="btn btn-ghost" id="hmCancelBtn">انصراف</button>
                </div>
            </div>`;
    }

    function bindFormEvents(mode, id, originalItem) {
        document.getElementById('hmSaveBtn')?.addEventListener('click', () => {
            saveForm(mode, id, originalItem);
        });
        document.getElementById('hmCancelBtn')?.addEventListener('click', () => {
            window.App.closeModal();
        });
    }

    // ═══════════════════════════════════════════
    //  SAVE
    // ═══════════════════════════════════════════
    async function saveForm(mode, id, originalItem) {
        const btn = document.getElementById('hmSaveBtn');
        const orig = btn?.textContent;
        if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

        try {
            const name = document.getElementById('hmName').value.trim();
            const discript = document.getElementById('hmDiscript').value.trim();
            const vaziat = parseInt(document.querySelector('input[name="hmVaziat"]:checked')?.value || '1');

            const lv = _state.level;
            const isGroup = lv === 'group';

            let payload = { name, discript: discript || null, vaziat };

            if (isGroup) {
                payload.level = 'group';
                payload.groupTypeCode = parseInt(document.getElementById('hmGroupType').value);
            } else {
                payload.mahiat = parseInt(document.querySelector('input[name="hmMahiat"]:checked')?.value || '1');
                payload.hasTafzili = document.getElementById('hmHasTafzili')?.checked ? 1 : 0;
                payload.hasTafzili2 = document.getElementById('hmHasTafzili2')?.checked ? 1 : 0;
                payload.isStock = document.getElementById('hmIsStock')?.checked ? 1 : 0;
                payload.isCodeVahed = document.getElementById('hmIsCodeVahed')?.checked ? 1 : 0;
                payload.isCodeMarkaz = document.getElementById('hmIsCodeMarkaz')?.checked ? 1 : 0;
                payload.isCodeProjeh = document.getElementById('hmIsCodeProjeh')?.checked ? 1 : 0;
            }

            if (!name) {
                window.App.toast('نام الزامی است', 'error');
                if (btn) { btn.disabled = false; btn.textContent = orig; }
                return;
            }

            if (mode === 'create') {
                if (lv === 'moein') {
                    const pc = parseInt(document.getElementById('hmParentCol')?.value || '0');
                    if (!pc) {
                        window.App.toast('حساب کل والد را انتخاب کنید', 'error');
                        if (btn) { btn.disabled = false; btn.textContent = orig; }
                        return;
                    }
                    payload.codeCol = pc;
                }
                payload.level = lv;

                await window.App.Http.api('/api/hesab', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.App.toast(`${levelLabel(lv)} جدید ایجاد شد`, 'success');
            } else {
                // در ویرایش، فقط تغییرات مجاز
                if (originalItem?.usedInSanad) {
                    delete payload.mahiat;
                    delete payload.groupTypeCode;
                }
                await window.App.Http.api(`/api/hesab/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.App.toast('تغییرات ذخیره شد', 'success');
            }

            window.App.UI.HesabPicker?.invalidateCache?.();
            window.App.closeModal();
            await loadList();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = orig; }
        }
    }

    // ═══════════════════════════════════════════
    //  DELETE
    // ═══════════════════════════════════════════
    async function deleteItem(id) {
        // تفصیلی ۱ → فرم خودش
        if (_state.level === 'tafzil' && window.App.Features.TafziliForm) {
            await window.App.Features.TafziliForm.delete(id);
            return;
        }

        try {
            const usage = await window.App.Http.api(`/api/hesab/${id}/usage`).catch(() => null);

            // ─── چک استفاده در اسناد ───
            if (usage?.usedInSanad) {
                let msg = `این حساب در ${H.fmt(usage.sanadCount)} سند استفاده شده و قابل حذف نیست.`;

                if (usage.hasChildren && usage.childrenInfo) {
                    msg = `این حساب در ${H.fmt(usage.sanadCount)} سند استفاده شده و همچنین دارای ${usage.childrenInfo} است.\n\n` +
                        `برای حذف، ابتدا باید تمام اسناد مرتبط و زیرمجموعه‌ها حذف شوند.`;
                }

                await window.App.alert.warning(msg, {
                    title: '🔒 قابل حذف نیست'
                });
                return;
            }

            // ─── چک زیرمجموعه ───
            if (usage?.hasChildren) {
                const info = usage.childrenInfo || 'زیرمجموعه';
                await window.App.alert.warning(
                    `این حساب دارای ${info} است.\n\n` +
                    `ابتدا باید زیرمجموعه‌ها حذف شوند.`,
                    { title: '🔒 دارای زیرمجموعه' }
                );
                return;
            }

            // ─── تأیید حذف ───
            const ok = await window.App.confirm(
                `آیا از حذف این ${levelLabel(_state.level)} مطمئن هستید؟`,
                { title: `🗑️ حذف`, danger: true, okText: 'بله، حذف کن' }
            );
            if (!ok) return;

            // ─── حذف ───
            await window.App.Http.api(`/api/hesab/${id}`, { method: 'DELETE' });
            window.App.toast('حذف شد', 'success');
            window.App.UI.HesabPicker?.invalidateCache?.();
            await loadList();
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════
    async function fetchNextCode() {
        try {
            const r = await window.App.Http.api(`/api/hesab/next-code?level=${_state.level}`);
            return r?.nextCode || '';
        } catch { return ''; }
    }

    return { render, reload: loadList, sortBy };
})();