/* ═══════════════════════════════════════════════════════════════
   Feature / SanadRenumber — مرتب‌ساز اطلاعات (جلسه ۵۱)
   دو تب: اسناد / فاکتورها — Preview + Commit
   ═══════════════════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.SanadRenumber = (function () {
    'use strict';

    const H = window.App.Helpers;
    const S = window.App.State;

    let _activeTab = 'sanad';   // 'sanad' | 'factor'
    let _preview = null;
    let _page = 1;
    let _committing = false;

    const _PAGE_KEY = 'sanad-renumber';
    const _KIND_LABELS = { 0: 'خرید', 1: 'فروش', 2: 'مرجوع از خرید', 3: 'مرجوع از فروش' };

    // ═══ CSS ═══
    function _injectCss() {
        if (document.getElementById('srnStyles')) return;
        const s = document.createElement('style');
        s.id = 'srnStyles';
        s.textContent = `
.srn-tabs{display:flex;gap:6px;margin-bottom:16px;border-bottom:2px solid #E2E8F0}
.srn-tab{padding:10px 20px;background:transparent;border:none;border-bottom:3px solid transparent;font-family:inherit;font-size:14px;font-weight:600;color:#64748B;cursor:pointer;margin-bottom:-2px;transition:all 0.15s}
.srn-tab:hover{color:#3B82F6;background:#F1F5F9}
.srn-tab.active{color:#2563EB;border-bottom-color:#2563EB;background:#EFF6FF}
.srn-info{background:#F8FAFC;border-radius:8px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#334155;line-height:1.9}
.srn-info p{margin:0 0 6px}
.srn-info p:last-child{margin-bottom:0}
.srn-warning{background:#FEF3C7;color:#92400E;padding:10px 14px;border-radius:6px;border-right:4px solid #F59E0B;margin-top:10px !important}
.srn-actions{display:flex;gap:10px;margin-top:16px}
.srn-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.srn-summary-card{padding:14px 16px;border-radius:10px;border-left:4px solid}
.srn-summary-total{background:#F1F5F9;border-color:#64748B;color:#1E293B}
.srn-summary-changed{background:#DBEAFE;border-color:#3B82F6;color:#1E40AF}
.srn-summary-old{background:#FEF3C7;border-color:#F59E0B;color:#92400E}
.srn-summary-new{background:#DCFCE7;border-color:#22C55E;color:#166534}
.srn-summary-title{font-size:12px;font-weight:600;margin-bottom:6px}
.srn-summary-value{font-size:16px;font-weight:700}
.srn-block-card{background:#FEE2E2;border:2px solid #EF4444;border-radius:10px;padding:20px}
.srn-block-title{font-size:16px;font-weight:700;color:#991B1B;margin-bottom:10px}
.srn-block-msg{color:#7F1D1D;font-size:13px;margin-bottom:14px;line-height:1.8}
.srn-block-table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:6px;overflow:hidden}
.srn-block-table th{background:#FEE2E2;color:#991B1B;padding:8px 10px;text-align:right;font-weight:600}
.srn-block-table td{padding:8px 10px;border-top:1px solid #FECACA;color:#1E293B}
.srn-preview-table tr.srn-row-changed{background:#EFF6FF}
.srn-success-card{background:#DCFCE7;border:2px solid #22C55E;border-radius:10px;padding:24px;text-align:center}
.srn-success-title{font-size:18px;font-weight:700;color:#166534;margin-bottom:14px}
.srn-success-stats{display:flex;justify-content:center;gap:24px;flex-wrap:wrap;font-size:14px;color:#166534;margin-bottom:16px}
.srn-success-stats strong{font-size:16px;color:#14532D}
`;
        document.head.appendChild(s);
    }

    // ═══════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════
    function render() {
        window.App.state.currentPage = _PAGE_KEY;
        _activeTab = 'sanad';
        _preview = null;
        _page = 1;
        _committing = false;

        _injectCss();

        const c = document.getElementById('content');
        c.innerHTML = `
            <div class="srn-tabs">
                <button class="srn-tab active" data-tab="sanad">📄 اسناد</button>
                <button class="srn-tab" data-tab="factor">📋 فاکتورها</button>
            </div>
            <div id="srnBody"></div>
        `;

        c.querySelectorAll('.srn-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                if (_committing) return;
                _activeTab = btn.dataset.tab;
                _preview = null;
                _page = 1;
                c.querySelectorAll('.srn-tab').forEach(b => b.classList.toggle('active', b === btn));
                renderBody();
            });
        });

        renderBody();
        if (window.App.UI.PermissionGuard) window.App.UI.PermissionGuard.apply(c);
    }

    function renderBody() {
        const body = document.getElementById('srnBody');
        if (!body) return;

        body.innerHTML = _activeTab === 'sanad' ? buildSanadPanel() : buildFactorPanel();
        bindEvents();
    }

    function buildSanadPanel() {
        return `
            <div class="card">
                <div class="card-title">
                    <span>🔄 مرتب‌سازی شماره اسناد</span>
                </div>
                <div class="srn-info">
                    <p>این عملیات شماره اسناد حسابداری را بر اساس ترتیب تاریخ سند از شماره <strong>۱</strong> به صورت پیوسته بازسازی می‌کند.</p>
                    <p>ترتیب شماره‌گذاری: تاریخ سند (از قدیم به جدید)، سپس شماره سریال سند.</p>
                    <p class="srn-warning">
                        ⚠️ <strong>پیش‌نیاز:</strong> تمام اسناد باید در وضعیت «پیش‌نویس» باشند.
                        اگر حتی یک سند قطعی یا رسیدگی وجود داشته باشد، عملیات برای حفظ امنیت داده‌ها متوقف می‌شود.
                    </p>
                </div>
                <div class="srn-actions">
                    <button class="btn btn-primary" id="srnPreviewBtn">🔍 پیش‌نمایش</button>
                    <button class="btn btn-success" id="srnCommitBtn" disabled>✅ اجرا</button>
                </div>
            </div>
            <div id="srnPreviewPanel"></div>
        `;
    }

    function buildFactorPanel() {
        return `
            <div class="card">
                <div class="card-title">
                    <span>🔄 مرتب‌سازی شماره فاکتورها</span>
                </div>
                <div class="srn-info">
                    <p>این عملیات شماره فاکتورها را برای هر نوع فاکتور <strong>جداگانه از شماره ۱</strong> بازسازی می‌کند.</p>
                    <p>شامل: فاکتور خرید، فاکتور فروش، مرجوع از خرید و مرجوع از فروش.</p>
                    <p>ترتیب شماره‌گذاری: تاریخ فاکتور (از قدیم به جدید)، سپس شماره سریال فاکتور.</p>
                    <p class="srn-warning">
                        ⚠️ توجه: پیش‌فاکتورها و فاکتورهای فروش ضایعات در این فرآیند دست نمی‌خورند.
                        همچنین شماره‌گذاری هر نوع فاکتور کاملاً مستقل از انواع دیگر است.
                    </p>
                </div>
                <div class="srn-actions">
                    <button class="btn btn-primary" id="srnPreviewBtn">🔍 پیش‌نمایش</button>
                    <button class="btn btn-success" id="srnCommitBtn" disabled>✅ اجرا</button>
                </div>
            </div>
            <div id="srnPreviewPanel"></div>
        `;
    }

    function bindEvents() {
        document.getElementById('srnPreviewBtn')?.addEventListener('click', onPreview);
        document.getElementById('srnCommitBtn')?.addEventListener('click', onCommit);
    }

    // ═══════════════════════════════════════════════════════════════
    //  PREVIEW
    // ═══════════════════════════════════════════════════════════════
    async function onPreview() {
        const btn = document.getElementById('srnPreviewBtn');
        btn.disabled = true;
        btn.textContent = '⏳ در حال بررسی...';

        try {
            const endpoint = _activeTab === 'sanad'
                ? '/api/sanad-renumber/sanad/preview'
                : '/api/sanad-renumber/factor/preview';

            const result = await window.App.Http.api(endpoint, {
                method: 'POST',
                body: JSON.stringify({}),
                silent: true
            });

            _preview = result;
            _page = 1;
            renderPreview(result);

            const commitBtn = document.getElementById('srnCommitBtn');
            if (commitBtn) {
                commitBtn.disabled = !result.isAllowed || result.changedCount === 0;
            }
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '🔍 پیش‌نمایش';
        }
    }

    function renderPreview(p) {
        const panel = document.getElementById('srnPreviewPanel');
        if (!panel) return;

        if (!p.isAllowed) {
            panel.innerHTML = `
                <div class="card srn-block-card">
                    <div class="srn-block-title">⛔ اجرای عملیات امکان‌پذیر نیست</div>
                    <p class="srn-block-msg">${H.esc(p.blockReason || '')}</p>
                    ${(p.blockItems && p.blockItems.length > 0) ? `
                        <table class="srn-block-table">
                            <thead>
                                <tr>
                                    <th style="width:80px;">شماره سند</th>
                                    <th style="width:100px;">تاریخ سند</th>
                                    <th>شرح سند</th>
                                    <th style="width:100px;">وضعیت سند</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${p.blockItems.map(b => `
                                    <tr>
                                        <td class="num">${H.fmt(b.no)}</td>
                                        <td class="num">${H.esc(b.date || '-')}</td>
                                        <td>${H.esc(b.sharh || '-')}</td>
                                        <td style="color:#B91C1C;font-weight:600;">${b.vazeit === 1 ? 'رسیدگی شده' : 'قطعی شده'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : ''}
                </div>`;
            return;
        }

        const summary = `
            <div class="srn-summary">
                <div class="srn-summary-card srn-summary-total">
                    <div class="srn-summary-title">📊 تعداد کل</div>
                    <div class="srn-summary-value">${H.fmt(p.totalCount)}</div>
                </div>
                <div class="srn-summary-card srn-summary-changed">
                    <div class="srn-summary-title">🔄 تعداد تغییرات</div>
                    <div class="srn-summary-value">${H.fmt(p.changedCount)}</div>
                </div>
                <div class="srn-summary-card srn-summary-old">
                    <div class="srn-summary-title">📍 محدوده شماره‌های فعلی</div>
                    <div class="srn-summary-value">${H.fmt(p.oldMinNo)} تا ${H.fmt(p.oldMaxNo)}</div>
                </div>
                <div class="srn-summary-card srn-summary-new">
                    <div class="srn-summary-title">🎯 محدوده شماره‌های جدید</div>
                    <div class="srn-summary-value">${H.fmt(p.newMinNo)} تا ${H.fmt(p.newMaxNo)}</div>
                </div>
            </div>`;

        const total = p.rows?.length || 0;
        const pageSize = S.getSettings().pageSize || 100;
        const totalPages = Math.ceil(total / pageSize);
        const start = (_page - 1) * pageSize;
        const pageRows = (p.rows || []).slice(start, start + pageSize);

        panel.innerHTML = `
            ${summary}
            <div class="card">
                <div class="card-title">
                    <span>📋 جزئیات تغییرات (${H.fmt(total)})</span>
                </div>
                ${buildPreviewTable(pageRows, start)}
                ${totalPages > 1 ? buildPagination(_page, totalPages, total, pageRows.length) : ''}
            </div>`;

        bindPaginationEvents();
    }

    function buildPreviewTable(rows, startIdx) {
        if (!rows || rows.length === 0) {
            return '<div class="empty" style="padding:40px;text-align:center;color:#94A3B8;">موردی برای نمایش وجود ندارد</div>';
        }

        const isSanad = _activeTab === 'sanad';
        const headers = isSanad
            ? ['ردیف', 'شماره فعلی سند', 'شماره جدید سند', 'تاریخ سند', 'شرح سند', 'تعداد ردیف‌های سند']
            : ['ردیف', 'نوع فاکتور', 'شماره فعلی فاکتور', 'شماره جدید فاکتور', 'تاریخ فاکتور', 'شرح فاکتور', 'تعداد ردیف‌های فاکتور'];

        let rowsHtml = '';
        rows.forEach((r, idx) => {
            const changed = r.oldNo != r.newNo;
            const rowCls = changed ? 'srn-row-changed' : '';
            const kindCell = isSanad
                ? ''
                : `<td class="text-center"><span class="badge badge-info">${_KIND_LABELS[r.kind] || '-'}</span></td>`;

            const newColor = changed ? '#2563EB' : '#22C55E';

            rowsHtml += `
                <tr class="${rowCls}">
                    <td class="num text-center">${startIdx + idx + 1}</td>
                    ${kindCell}
                    <td class="num text-center">${H.fmt(r.oldNo)}</td>
                    <td class="num text-center"><strong style="color:${newColor};">${H.fmt(r.newNo)}</strong></td>
                    <td class="num text-center">${H.esc(r.date || '-')}</td>
                    <td>${H.esc(r.sharh || '-')}</td>
                    <td class="num text-center">${H.fmt(r.itemCount)}</td>
                </tr>`;
        });

        return `
            <div class="table-wrapper">
                <table class="tq-table srn-preview-table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div id="srnPagination"></div>`;
    }

    function buildPagination(page, totalPages, totalCount, itemCount) {
        const maxBtn = 7;
        let startPage = Math.max(1, page - Math.floor(maxBtn / 2));
        let endPage = Math.min(totalPages, startPage + maxBtn - 1);
        if (endPage - startPage + 1 < maxBtn) startPage = Math.max(1, endPage - maxBtn + 1);

        let pageBtns = '';
        for (let p = startPage; p <= endPage; p++) {
            pageBtns += `<button class="page-btn ${p === page ? 'active' : ''}" data-srn-page="${p}">${p}</button>`;
        }

        return `<div class="pagination-bar">
            <div class="pagination-info">نمایش ${H.fmt(itemCount)} از ${H.fmt(totalCount)}</div>
            <div class="pagination-controls">
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-srn-page="1">«</button>
                <button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-srn-page="${page - 1}">‹</button>
                ${pageBtns}
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-srn-page="${page + 1}">›</button>
                <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-srn-page="${totalPages}">»</button>
            </div>
        </div>`;
    }

    function bindPaginationEvents() {
        document.querySelectorAll('[data-srn-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.srnPage, 10);
                if (!p || p < 1) return;
                _page = p;
                renderPreview(_preview);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  COMMIT
    // ═══════════════════════════════════════════════════════════════
    async function onCommit() {
        if (_committing || !_preview) return;

        const label = _activeTab === 'sanad' ? 'اسناد' : 'فاکتورها';
        const total = _preview.totalCount || 0;
        const changed = _preview.changedCount || 0;

        const ok = await window.App.confirm(
            `آیا از اجرای مرتب‌سازی ${label} مطمئن هستید؟\n\n` +
            `تعداد کل: ${H.fmt(total)}\n` +
            `تعداد تغییرات: ${H.fmt(changed)}\n\n` +
            `⚠️ این عملیات شماره‌ها را برای همیشه تغییر می‌دهد.`,
            { danger: true, okText: '✅ بله، اجرا کن', cancelText: '✕ انصراف' }
        );
        if (!ok) return;

        _committing = true;
        const btn = document.getElementById('srnCommitBtn');
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ در حال اجرا...';

        try {
            const endpoint = _activeTab === 'sanad'
                ? '/api/sanad-renumber/sanad/commit'
                : '/api/sanad-renumber/factor/commit';

            const result = await window.App.Http.api(endpoint, {
                method: 'POST',
                body: JSON.stringify({}),
                successMsg: 'عملیات با موفقیت انجام شد'
            });

            const panel = document.getElementById('srnPreviewPanel');
            if (panel) {
                panel.innerHTML = `
                    <div class="srn-success-card">
                        <div class="srn-success-title">✅ مرتب‌سازی با موفقیت انجام شد</div>
                        <div class="srn-success-stats">
                            <div>تعداد پردازش‌شده: <strong>${H.fmt(result.processedCount)}</strong></div>
                            ${_activeTab === 'sanad'
                        ? `<div>ردیف‌های سند به‌روزرسانی‌شده: <strong>${H.fmt(result.affectedItemsCount)}</strong></div>`
                        : ''}
                        </div>
                        <button class="btn btn-ghost" id="srnReloadBtn">↻ پیش‌نمایش مجدد</button>
                    </div>`;

                document.getElementById('srnReloadBtn')?.addEventListener('click', () => {
                    _preview = null;
                    _page = 1;
                    renderBody();
                });
            }

            _preview = null;
            const commitBtn = document.getElementById('srnCommitBtn');
            if (commitBtn) {
                commitBtn.disabled = true;
                commitBtn.textContent = orig;
            }
        } catch (err) {
            window.App.toast('خطا: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = orig;
        } finally {
            _committing = false;
        }
    }

    return { render };
})();