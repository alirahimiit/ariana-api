/* ═══════════════════════════════════════════════════
   Feature / Tafzili (تفضیلی‌ها + گروه‌ها)
   مسئولیت: لیست تفضیلی، فیلتر، جزئیات، CRUD گروه‌ها
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Tafzili = (function () {
    'use strict';

    const H = window.App.Helpers;

    // state محلی
    let _groupId = '';
    let _kind = '';
    let _mandeh = 'all';
    let _groupsCache = [];

    // ═══════════════════════════════════════════
    //  RENDER — صفحه اصلی
    // ═══════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        // بارگذاری گروه‌ها
        let groups = [];
        try {
            groups = await window.App.Http.api('/api/tafzili/groups') || [];
            _groupsCache = groups;
        } catch (err) {
            console.error('Failed to load groups:', err);
        }

        c.innerHTML = `
        <div class="card">
            <div class="card-title">فیلترها</div>
            <div class="filters">
                <div class="form-group">
                    <label>کد تفضیلی</label>
                    <input type="text" id="tafCode">
                </div>
                <div class="form-group">
                    <label>نام</label>
                    <input type="text" id="tafName">
                </div>
                <div class="form-group">
                    <label>گروه تفضیلی</label>
                    <div class="custom-select" id="tafGroupWrap">
                        <button type="button" class="custom-select-trigger" id="tafGroupTrigger">
                            <span class="custom-select-value">همه گروه‌ها</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="tafGroupMenu">
                            <div class="custom-select-option selected" data-value="">همه گروه‌ها</div>
                            ${groups.map(g => `
                                <div class="custom-select-option" data-value="${g.id}">
                                    ${H.esc(g.name || '')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>نوع</label>
                    <div class="custom-select" id="tafKindWrap">
                        <button type="button" class="custom-select-trigger" id="tafKindTrigger">
                            <span class="custom-select-value">همه</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="tafKindMenu">
                            <div class="custom-select-option selected" data-value="">همه</div>
                            <div class="custom-select-option" data-value="0">عادی</div>
                            <div class="custom-select-option" data-value="1">حقیقی</div>
                            <div class="custom-select-option" data-value="2">حقوقی شرکت</div>
                            <div class="custom-select-option" data-value="3">حقوقی سازمان</div>
                            <div class="custom-select-option" data-value="4">بازاریاب</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>وضعیت مانده</label>
                    <div class="custom-select" id="tafMandehWrap">
                        <button type="button" class="custom-select-trigger" id="tafMandehTrigger">
                            <span class="custom-select-value">همه</span>
                            <span class="custom-select-arrow">▼</span>
                        </button>
                        <div class="custom-select-menu" id="tafMandehMenu">
                            <div class="custom-select-option selected" data-value="all">همه</div>
                            <div class="custom-select-option" data-value="hasMandeh">فقط دارای مانده</div>
                            <div class="custom-select-option" data-value="noMandeh">فقط مانده صفر</div>
                            <div class="custom-select-option" data-value="hasBed">فقط دارای گردش بدهکار</div>
                            <div class="custom-select-option" data-value="hasBes">فقط دارای گردش بستانکار</div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>موبایل</label>
                    <input type="text" id="tafMobile">
                </div>
                <div class="form-group">
                    <label>کد ملی</label>
                    <input type="text" id="tafMelliCode">
                </div>
                <div class="form-group">
                    <label>کد اقتصادی</label>
                    <input type="text" id="tafEconomicCode">
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary btn-block" id="tafBtnRun">🔍 جستجو</button>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-ghost btn-block" id="tafBtnManageGroups">
                        ⚙️ مدیریت گروه‌ها
                    </button>
                </div>
            </div>
        </div>
        <div id="tafResult">
            <div class="loading"><div class="spinner"></div></div>
        </div>`;

        _groupId = '';
        _kind = '';
        _mandeh = 'all';

        setupCustomSelect('tafGroupWrap', 'tafGroupTrigger', 'tafGroupMenu', v => _groupId = v);
        setupCustomSelect('tafKindWrap', 'tafKindTrigger', 'tafKindMenu', v => _kind = v);
        setupCustomSelect('tafMandehWrap', 'tafMandehTrigger', 'tafMandehMenu', v => _mandeh = v);

        document.getElementById('tafBtnRun').addEventListener('click', () => runList(1));
        document.getElementById('tafBtnManageGroups').addEventListener('click', openGroupManager);

        // Enter key
        ['tafCode', 'tafName', 'tafMobile', 'tafMelliCode', 'tafEconomicCode'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') runList(1);
            });
        });

        runList(1);
    }

    // ═══════════════════════════════════════════
    //  RUN — لیست تفضیلی‌ها
    // ═══════════════════════════════════════════
    async function runList(page = 1) {
        const container = document.getElementById('tafResult');
        if (!container) return;
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const data = await window.App.Http.api('/api/tafzili/list', {
                method: 'POST',
                body: JSON.stringify(buildPayload(page))
            });
            renderListResult(data);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildPayload(page, pageSizeOverride = null) {
        const parseLongOrNull = v => {
            if (!v) return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        };
        const parseIntOrNull = v => {
            if (v === '' || v === null || v === undefined) return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        };

        return {
            code: document.getElementById('tafCode')?.value || null,
            name: document.getElementById('tafName')?.value || null,
            tafziliGroupId: parseLongOrNull(_groupId),
            kind: parseIntOrNull(_kind),
            mobile: document.getElementById('tafMobile')?.value || null,
            melliCode: document.getElementById('tafMelliCode')?.value || null,
            economicCode: document.getElementById('tafEconomicCode')?.value || null,
            mandehFilter: _mandeh || 'all',
            page: page,
            pageSize: pageSizeOverride || window.App.state.settings.pageSize
        };
    }

    function renderListResult(data) {
        const container = document.getElementById('tafResult');
        const items = data.items || [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">📭</div>
                    <p>تفضیلی‌ای یافت نشد</p>
                </div>`;
            return;
        }

        const rows = items.map(t => {
            const mandeh = t.mabMandeh ?? 0;
            const mandehClass = mandeh > 0
                ? 'color:#059669; font-weight:600;'
                : (mandeh < 0 ? 'color:#DC2626; font-weight:600;' : 'color:#6B7280;');

            return `
                <tr>
                    <td class="num text-center">${t.codeTafzil || ''}</td>
                    <td>${H.esc(t.name || '')}</td>
                    <td>${H.esc(t.tafziliGroupName || '-')}</td>
                    <td class="text-center">${kindBadge(t.kind, t.kindName)}</td>
                    <td class="num text-center">${H.esc(t.mobile || '-')}</td>
                    <td class="num text-center">${H.esc(t.melliCode || '-')}</td>
                    <td class="num text-left">${H.fmt(t.sumBed)}</td>
                    <td class="num text-left">${H.fmt(t.sumBes)}</td>
                    <td class="num text-left" style="${mandehClass}">${H.fmt(Math.abs(mandeh))}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-ghost"
                                onclick="App.Features.Tafzili.showDetail(${t.id})">
                            🔍 مشاهده
                        </button>
                    </td>
                </tr>`;
        }).join('');

        const page = data.page || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || items.length;

        container.innerHTML = `
            <div class="card">
                <div class="card-title">
                    <span>👥 لیست تفضیلی‌ها (${H.fmt(totalCount)})</span>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:80px;">کد</th>
                                <th>نام</th>
                                <th style="width:130px;">گروه تفضیلی</th>
                                <th style="width:100px;">نوع</th>
                                <th style="width:110px;">موبایل</th>
                                <th style="width:110px;">کد ملی</th>
                                <th class="text-left" style="width:110px;">گردش بدهکار</th>
                                <th class="text-left" style="width:110px;">گردش بستانکار</th>
                                <th class="text-left" style="width:110px;">مانده</th>
                                <th style="width:90px;"></th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                ${buildPagination(page, totalPages, totalCount, items.length)}
            </div>`;

        Exporter.attach(container, {
            title: 'لیست تفضیلی‌ها',
            subtitle: subtitle(),
            filename: 'TafziliList',
            getFullTable: fetchFullTable
        });

        window.App.enhanceTables(container);
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        if (totalPages <= 1) {
            return `
                <div class="pagination-bar">
                    <div class="pagination-info">مجموع: ${H.fmt(totalCount)} تفضیلی</div>
                </div>`;
        }

        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}"
                            onclick="App.Features.Tafzili.runList(${p})">${p}</button>`;
        }

        return `
            <div class="pagination-bar">
                <div class="pagination-info">
                    نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)} تفضیلی
                </div>
                <div class="pagination-controls">
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Tafzili.runList(1)">«</button>
                    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.Features.Tafzili.runList(${page - 1})">‹ قبلی</button>
                    ${pageBtns}
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Tafzili.runList(${page + 1})">بعدی ›</button>
                    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="App.Features.Tafzili.runList(${totalPages})">»</button>
                </div>
            </div>`;
    }

    async function fetchFullTable() {
        const payload = buildPayload(1, 100000);
        const full = await window.App.Http.api('/api/tafzili/list', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return buildTableHtml(full.items || []);
    }

    function buildTableHtml(items) {
        const rows = items.map(t => `
            <tr>
                <td class="num text-center">${t.codeTafzil || ''}</td>
                <td>${H.esc(t.name || '')}</td>
                <td>${H.esc(t.tafziliGroupName || '-')}</td>
                <td class="text-center">${H.esc(t.kindName || '-')}</td>
                <td class="num text-center">${H.esc(t.mobile || '-')}</td>
                <td class="num text-center">${H.esc(t.melliCode || '-')}</td>
                <td class="num text-left">${H.fmt(t.sumBed)}</td>
                <td class="num text-left">${H.fmt(t.sumBes)}</td>
                <td class="num text-left">${H.fmt(Math.abs(t.mabMandeh || 0))}</td>
            </tr>
        `).join('');

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>کد</th>
                    <th>نام</th>
                    <th>گروه تفضیلی</th>
                    <th>نوع</th>
                    <th>موبایل</th>
                    <th>کد ملی</th>
                    <th class="text-left">گردش بدهکار</th>
                    <th class="text-left">گردش بستانکار</th>
                    <th class="text-left">مانده</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>`;
        return table;
    }

    // ═══════════════════════════════════════════
    //  SHOW DETAIL
    // ═══════════════════════════════════════════
    async function showDetail(tafziliId) {
        window.App.openModal('جزئیات تفضیلی',
            `<div class="loading"><div class="spinner"></div></div>`);

        try {
            const d = await window.App.Http.api(`/api/tafzili/${tafziliId}`);
            document.getElementById('modalBody').innerHTML = buildDetailHtml(d);

            Exporter.attach(document.getElementById('modalBody'), {
                title: `تفضیلی: ${d.name || ''} (${d.codeTafzil || ''})`,
                subtitle: subtitle(),
                filename: `Tafzili_${d.codeTafzil || tafziliId}`,
                customHtml: () => buildPrintHtml(d)
            });
        } catch (err) {
            document.getElementById('modalBody').innerHTML =
                `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function buildDetailHtml(d) {
        return `
            <div class="section-title">📋 اطلاعات پایه</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">کد تفضیلی:</td>
                    <td>${d.codeTafzil || '-'}</td>
                    <td class="label">نام:</td>
                    <td colspan="3">${H.esc(d.name || '-')}</td>
                </tr>
                <tr>
                    <td class="label">گروه تفضیلی:</td>
                    <td colspan="5">
                        ${d.tafziliGroupName
                ? `<span class="badge badge-info">${H.esc(d.tafziliGroupName)}</span>`
                : '<span class="badge badge-gray">بدون گروه</span>'}
                    </td>
                </tr>
                <tr>
                    <td class="label">نوع:</td>
                    <td>${kindBadge(d.kind, d.kindName)}</td>
                    <td class="label">شغل:</td>
                    <td>${H.esc(d.jobName || '-')}</td>
                    <td class="label">وضعیت:</td>
                    <td>${d.vaziat === 1 ? 'فعال' : 'غیرفعال'}</td>
                </tr>
                ${d.discript ? `
                <tr>
                    <td class="label">توضیحات:</td>
                    <td colspan="5">${H.esc(d.discript)}</td>
                </tr>` : ''}
            </table>

            <div class="section-title">📞 اطلاعات تماس</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">تلفن:</td>
                    <td>${H.esc(d.phone || '-')}</td>
                    <td class="label">موبایل:</td>
                    <td>${H.esc(d.mobile || '-')}</td>
                    <td class="label">کد پستی:</td>
                    <td>${H.esc(d.postalCode || '-')}</td>
                </tr>
                <tr>
                    <td class="label">استان:</td>
                    <td>${H.esc(d.stateName || '-')}</td>
                    <td class="label">شهر ۱:</td>
                    <td>${H.esc(d.cityName1 || '-')}</td>
                    <td class="label">شهر ۲:</td>
                    <td>${H.esc(d.cityName2 || '-')}</td>
                </tr>
                <tr>
                    <td class="label">آدرس:</td>
                    <td colspan="5">${H.esc(d.address || '-')}</td>
                </tr>
            </table>

            <div class="section-title">💰 اطلاعات مالی و هویتی</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">شماره حساب بانکی:</td>
                    <td>${H.esc(d.accountNumber || '-')}</td>
                    <td class="label">کد ملی:</td>
                    <td>${H.esc(d.melliCode || '-')}</td>
                    <td class="label">کد اقتصادی:</td>
                    <td>${H.esc(d.economicCode || '-')}</td>
                </tr>
                <tr>
                    <td class="label">شناسه ثبت:</td>
                    <td colspan="5">${H.esc(d.nationalCode || '-')}</td>
                </tr>
            </table>

            <div class="section-title">📊 گردش و مانده</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">گردش بدهکار:</td>
                    <td class="num" style="font-weight:bold;">${H.fmt(d.sumBed)}</td>
                    <td class="label">گردش بستانکار:</td>
                    <td class="num" style="font-weight:bold;">${H.fmt(d.sumBes)}</td>
                    <td class="label">مانده:</td>
                    <td class="num" style="font-weight:bold; color:#4F46E5;">
                        ${H.fmt(Math.abs(d.mabMandeh || 0))}
                        ${d.mabMandeh > 0 ? 'بس' : (d.mabMandeh < 0 ? 'بد' : '')}
                    </td>
                </tr>
            </table>

            <div class="section-title">⚙️ تنظیمات</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">در فروشندگان:</td>
                    <td>${d.isSaleMan ? '✅ بله' : '❌ خیر'}</td>
                    <td class="label">انبار:</td>
                    <td>${d.isStock ? '✅ بله' : '❌ خیر'}</td>
                    <td class="label">ماهیت:</td>
                    <td>${d.mahiat === 1 ? 'بدهکار' : (d.mahiat === 2 ? 'بستانکار' : '-')}</td>
                </tr>
            </table>`;
    }

    function buildPrintHtml(d) {
        return `
            <table class="factor-info-table">
                <tr>
                    <td class="label">کد تفضیلی:</td>
                    <td>${d.codeTafzil || '-'}</td>
                    <td class="label">نام:</td>
                    <td colspan="3">${H.esc(d.name || '-')}</td>
                </tr>
                <tr>
                    <td class="label">گروه تفضیلی:</td>
                    <td>${H.esc(d.tafziliGroupName || '-')}</td>
                    <td class="label">نوع:</td>
                    <td>${H.esc(d.kindName || '-')}</td>
                    <td class="label">شغل:</td>
                    <td>${H.esc(d.jobName || '-')}</td>
                </tr>
                <tr>
                    <td class="label">وضعیت:</td>
                    <td>${d.vaziat === 1 ? 'فعال' : 'غیرفعال'}</td>
                    <td class="label">در فروشندگان:</td>
                    <td>${d.isSaleMan ? 'بله' : 'خیر'}</td>
                    <td class="label">انبار:</td>
                    <td>${d.isStock ? 'بله' : 'خیر'}</td>
                </tr>
                ${d.discript ? `
                <tr>
                    <td class="label">توضیحات:</td>
                    <td colspan="5">${H.esc(d.discript)}</td>
                </tr>` : ''}
            </table>

            <div class="section-title">📞 اطلاعات تماس</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">تلفن:</td>
                    <td>${H.esc(d.phone || '-')}</td>
                    <td class="label">موبایل:</td>
                    <td>${H.esc(d.mobile || '-')}</td>
                    <td class="label">کد پستی:</td>
                    <td>${H.esc(d.postalCode || '-')}</td>
                </tr>
                <tr>
                    <td class="label">استان:</td>
                    <td>${H.esc(d.stateName || '-')}</td>
                    <td class="label">شهر ۱:</td>
                    <td>${H.esc(d.cityName1 || '-')}</td>
                    <td class="label">شهر ۲:</td>
                    <td>${H.esc(d.cityName2 || '-')}</td>
                </tr>
                <tr>
                    <td class="label">آدرس:</td>
                    <td colspan="5">${H.esc(d.address || '-')}</td>
                </tr>
            </table>

            <div class="section-title">💰 اطلاعات مالی و هویتی</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">شماره حساب بانکی:</td>
                    <td>${H.esc(d.accountNumber || '-')}</td>
                    <td class="label">کد ملی:</td>
                    <td>${H.esc(d.melliCode || '-')}</td>
                    <td class="label">کد اقتصادی:</td>
                    <td>${H.esc(d.economicCode || '-')}</td>
                </tr>
                <tr>
                    <td class="label">شناسه ثبت:</td>
                    <td colspan="5">${H.esc(d.nationalCode || '-')}</td>
                </tr>
            </table>

            <div class="section-title">📊 گردش و مانده</div>
            <table class="factor-info-table">
                <tr>
                    <td class="label">گردش بدهکار:</td>
                    <td class="num text-left">${H.fmt(d.sumBed)}</td>
                    <td class="label">گردش بستانکار:</td>
                    <td class="num text-left">${H.fmt(d.sumBes)}</td>
                    <td class="label">مانده:</td>
                    <td class="num text-left" style="font-weight:bold; color:#4F46E5;">
                        ${H.fmt(Math.abs(d.mabMandeh || 0))}
                        ${d.mabMandeh > 0 ? 'بس' : (d.mabMandeh < 0 ? 'بد' : '')}
                    </td>
                </tr>
            </table>`;
    }

    // ═══════════════════════════════════════════
    //  GROUP MANAGER (CRUD)
    // ═══════════════════════════════════════════
    function openGroupManager() {
        const body = `
            <div style="margin-bottom:16px;">
                <button class="btn btn-primary" id="grpAddBtn">➕ گروه جدید</button>
            </div>
            <div id="grpList"><div class="loading"><div class="spinner"></div></div></div>`;

        window.App.openModal('⚙️ مدیریت گروه‌های تفضیلی', body);

        const modalBody = document.getElementById('modalBody');
        modalBody.querySelector('#grpAddBtn').addEventListener('click', () => showGroupForm(null));

        loadGroupList();
    }

    async function loadGroupList() {
        const container = document.getElementById('grpList');
        if (!container) return;

        try {
            const groups = await window.App.Http.api('/api/tafzili/groups') || [];
            _groupsCache = groups;

            if (groups.length === 0) {
                container.innerHTML = `<div class="empty"><p>گروهی تعریف نشده</p></div>`;
                return;
            }

            container.innerHTML = `
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:60px;">کد</th>
                                <th>نام گروه</th>
                                <th style="width:150px;">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groups.map(g => `
                                <tr>
                                    <td class="num text-center">${g.id}</td>
                                    <td>${H.esc(g.name || '')}</td>
                                    <td class="text-center">
                                        <button class="btn btn-sm btn-ghost" data-edit="${g.id}">
                                            ✏️ ویرایش
                                        </button>
                                        <button class="btn btn-sm btn-ghost" data-del="${g.id}"
                                                style="color:var(--danger);">
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;

            container.querySelectorAll('[data-edit]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.dataset.edit);
                    const g = _groupsCache.find(x => x.id === id);
                    showGroupForm(id, g?.name || '');
                });
            });

            container.querySelectorAll('[data-del]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.dataset.del);
                    const g = _groupsCache.find(x => x.id === id);
                    deleteGroup(id, g?.name || '');
                });
            });
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function showGroupForm(id, name = '') {
        const body = `
            <div class="form-group">
                <label>نام گروه *</label>
                <input type="text" id="grpName" class="form-select"
                       style="padding:10px 14px;" value="${H.esc(name)}">
            </div>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button class="btn btn-primary" id="grpSaveBtn">💾 ذخیره</button>
                <button class="btn btn-ghost" id="grpCancelBtn">انصراف</button>
            </div>`;

        window.App.openModal(id ? '✏️ ویرایش گروه' : '➕ گروه جدید', body);

        const modalBody = document.getElementById('modalBody');
        const nameInput = modalBody.querySelector('#grpName');
        setTimeout(() => nameInput.focus(), 100);

        modalBody.querySelector('#grpSaveBtn').addEventListener('click', async () => {
            const groupName = nameInput.value.trim();
            if (!groupName) {
                window.App.toast('نام گروه الزامی است', 'error');
                return;
            }

            try {
                await window.App.Http.api('/api/tafzili/groups/save', {
                    method: 'POST',
                    body: JSON.stringify({ id: id || null, name: groupName })
                });
                window.App.toast(id ? 'گروه ویرایش شد' : 'گروه جدید ساخته شد', 'success');
                openGroupManager();
            } catch (err) {
                window.App.toast(err.message, 'error');
            }
        });

        modalBody.querySelector('#grpCancelBtn').addEventListener('click', () => {
            openGroupManager();
        });
    }

    async function deleteGroup(id, name) {
        if (!confirm(`آیا از حذف گروه «${name}» مطمئن هستید؟`)) return;

        try {
            await window.App.Http.api(`/api/tafzili/groups/${id}`, { method: 'DELETE' });
            window.App.toast('گروه حذف شد', 'success');
            await loadGroupList();
        } catch (err) {
            window.App.toast(err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════
    function setupCustomSelect(wrapId, triggerId, menuId, onChange) {
        const wrap = document.getElementById(wrapId);
        const trigger = document.getElementById(triggerId);
        const menu = document.getElementById(menuId);
        const valueEl = trigger.querySelector('.custom-select-value');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(el => {
                if (el !== wrap) el.classList.remove('open');
            });
            wrap.classList.toggle('open');
        });

        menu.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                valueEl.textContent = opt.textContent.trim();
                menu.querySelectorAll('.custom-select-option')
                    .forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                wrap.classList.remove('open');
                onChange(opt.dataset.value);
            });
        });
    }

    function kindBadge(kind, kindName) {
        if (kind == null) return '<span class="badge badge-gray">-</span>';
        const map = {
            0: 'badge-gray',
            1: 'badge-info',
            2: 'badge-success',
            3: 'badge-warning',
            4: 'badge-danger'
        };
        const cls = map[kind] || 'badge-gray';
        return `<span class="badge ${cls}">${H.esc(kindName || '-')}</span>`;
    }

    function subtitle() {
        const u = window.App.state.user || {};
        return (u.orgName || '') + ' - ' + (u.fyName || '');
    }

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    return {
        render,
        runList,
        showDetail,
        openGroupManager
    };
})();

// ⭐ alias برای سازگاری
window.App.renderTafziliList = window.App.Features.Tafzili.render;
window.App.runTafziliList = window.App.Features.Tafzili.runList;
window.App.showTafziliDetail = window.App.Features.Tafzili.showDetail;
window.App.openGroupManager = window.App.Features.Tafzili.openGroupManager;