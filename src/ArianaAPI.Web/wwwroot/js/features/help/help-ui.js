/* ═══════════════════════════════════════════════════
   Help UI — پنل کشویی + FAB + کلید میان‌بر Shift+?
   ═══════════════════════════════════════════════════ */

window.HelpUI = (function () {

    let _panelEl = null;
    let _overlayEl = null;
    let _fabEl = null;
    let _isOpen = false;

    // ═══════════════════════════════════════════════
    //  تعیین کلید راهنما بر اساس صفحه‌ی فعلی
    // ═══════════════════════════════════════════════
    function _resolvePageKey() {
        // ⭐ اگه داخل فرم سند هستیم (مودال باز)
        if (document.querySelector('[data-help="sanad-form"], .sanad-form, #sanadFormModal')) {
            return 'sanad-form';
        }
        // ⭐ اگه داخل فرم کالا هستیم
        if (document.querySelector('[data-help="article-form"], .article-form, #articleFormModal')) {
            return 'article-form';
        }
        // ⭐ از state صفحه‌ی فعلی
        const page = window.App?.state?.currentPage;
        if (page) return page;

        // ⭐ fallback
        return '__default__';
    }

    // ═══════════════════════════════════════════════
    //  Render
    // ═══════════════════════════════════════════════
    function _renderContent(content) {
        if (!content) {
            return `
                <div class="help-empty">
                    <div class="help-empty-icon">📭</div>
                    <div class="help-empty-title">راهنمایی یافت نشد</div>
                    <div class="help-empty-text">برای این صفحه راهنمایی تعریف نشده است.</div>
                </div>
            `;
        }

        const sections = content.sections || [];
        let html = '';
        for (const sec of sections) html += _renderSection(sec);

        return html || `
            <div class="help-empty">
                <div class="help-empty-icon">📭</div>
                <div class="help-empty-title">محتوای خالی</div>
                <div class="help-empty-text">این صفحه راهنما ندارد.</div>
            </div>
        `;
    }

    function _renderSection(sec) {
        if (!sec) return '';
        const icon = sec.icon || '';

        if (sec.type === 'text') {
            return `
                <div class="help-section">
                    <div class="help-section-title">
                        ${icon ? `<span class="help-section-icon">${icon}</span>` : ''}
                        <span>${_esc(sec.title || '')}</span>
                    </div>
                    <div class="help-text">${sec.body || ''}</div>
                </div>
            `;
        }

        if (sec.type === 'keys') {
            const items = sec.items || [];
            return `
                <div class="help-section">
                    <div class="help-section-title">
                        ${icon ? `<span class="help-section-icon">${icon}</span>` : ''}
                        <span>${_esc(sec.title || 'کلیدهای میان‌بر')}</span>
                    </div>
                    <div class="help-keys">
                        ${items.map(it => `
                            <div class="help-key-row">
                                <span class="help-key-badge">${_esc(it.keys)}</span>
                                <span class="help-key-desc">${_esc(it.desc)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (sec.type === 'steps') {
            const items = sec.items || [];
            return `
                <div class="help-section">
                    <div class="help-section-title">
                        ${icon ? `<span class="help-section-icon">${icon}</span>` : ''}
                        <span>${_esc(sec.title || 'آموزش گام‌به‌گام')}</span>
                    </div>
                    <div class="help-steps">
                        ${items.map((it, i) => `
                            <div class="help-step">
                                <div class="help-step-num">${_toFa(i + 1)}</div>
                                <div class="help-step-text">${_esc(it)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (sec.type === 'tip') {
            const variant = sec.variant || 'info';
            const iconTip = sec.icon || '💡';
            return `
                <div class="help-section">
                    <div class="help-tip ${variant}">
                        <span class="help-tip-icon">${iconTip}</span>
                        <span>${sec.text || ''}</span>
                    </div>
                </div>
            `;
        }

        return '';
    }

    function _toFa(n) {
        return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    }

    function _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ═══════════════════════════════════════════════
    //  Build DOM
    // ═══════════════════════════════════════════════
    function _buildDom() {
        // FAB
        _fabEl = document.createElement('button');
        _fabEl.type = 'button';
        _fabEl.className = 'help-fab';
        _fabEl.title = 'راهنما (Shift + ?)';
        _fabEl.setAttribute('aria-label', 'راهنما');
        _fabEl.textContent = '؟';
        _fabEl.addEventListener('click', open);
        document.body.appendChild(_fabEl);

        // Overlay
        _overlayEl = document.createElement('div');
        _overlayEl.className = 'help-panel-overlay';
        _overlayEl.addEventListener('click', close);
        document.body.appendChild(_overlayEl);

        // Panel
        _panelEl = document.createElement('aside');
        _panelEl.className = 'help-panel';
        _panelEl.setAttribute('role', 'dialog');
        _panelEl.setAttribute('aria-modal', 'true');
        _panelEl.innerHTML = `
            <div class="help-panel-header">
                <div class="help-panel-icon">؟</div>
                <div class="help-panel-title-wrap">
                    <div class="help-panel-title" id="helpPanelTitle">راهنما</div>
                    <div class="help-panel-subtitle" id="helpPanelSubtitle">راهنمای این صفحه</div>
                </div>
                <button type="button" class="help-panel-close" id="helpPanelClose" aria-label="بستن">✕</button>
            </div>
            <div class="help-panel-body" id="helpPanelBody"></div>
            <div class="help-panel-footer">
                <div class="help-shortcut-hint">
                    <span>باز کردن سریع:</span>
                    <kbd>Shift</kbd> + <kbd>?</kbd>
                </div>
                <div>آریانا • راهنما</div>
            </div>
        `;
        document.body.appendChild(_panelEl);

        _panelEl.querySelector('#helpPanelClose').addEventListener('click', close);

        // ⭐ FAB فقط وقتی کاربر لاگین است نمایش داده بشه
        const appView = document.getElementById('appView');
        if (appView) {
            const sync = () => {
                const hidden = appView.classList.contains('hidden');
                if (_fabEl) _fabEl.hidden = hidden;
            };
            sync();
            new MutationObserver(sync).observe(appView, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    // ═══════════════════════════════════════════════
    //  Open / Close
    // ═══════════════════════════════════════════════
    async function open() {
        if (!_panelEl) _buildDom();

        // ⭐ اگه کاربر لاگین نیست، کاری نکن
        const appView = document.getElementById('appView');
        if (appView && appView.classList.contains('hidden')) return;

        const pageKey = _resolvePageKey();

        const titleEl = _panelEl.querySelector('#helpPanelTitle');
        const subtitleEl = _panelEl.querySelector('#helpPanelSubtitle');
        const bodyEl = _panelEl.querySelector('#helpPanelBody');

        // ⭐ نمایش فوری پنل با حالت لودینگ
        titleEl.textContent = 'راهنما';
        subtitleEl.textContent = 'در حال بارگذاری...';
        bodyEl.innerHTML = '<div class="help-loading">⏳ در حال بارگذاری راهنما...</div>';
        bodyEl.scrollTop = 0;

        _panelEl.classList.add('open');
        _overlayEl.classList.add('open');
        _isOpen = true;
        document.body.style.overflow = 'hidden';

        // ⭐ لود async
        let content = null;
        try {
            content = await window.HelpRegistry.get(pageKey);
        } catch (err) {
            console.error('[Help] خطا در لود:', err);
        }

        // ⭐ اگه کاربر تا حالا پنل رو بست، render نکن
        if (!_isOpen) return;

        titleEl.textContent = content?.title || 'راهنما';
        subtitleEl.textContent = content?.subtitle || 'راهنمای این صفحه';
        bodyEl.innerHTML = _renderContent(content);
        bodyEl.scrollTop = 0;
    }
    function close() {
        if (!_isOpen) return;
        _panelEl?.classList.remove('open');
        _overlayEl?.classList.remove('open');
        _isOpen = false;
        document.body.style.overflow = '';
    }

    function toggle() { _isOpen ? close() : open(); }

    // ═══════════════════════════════════════════════
    //  Keyboard: Shift+?
    //  پشتیبانی از US ('?') و FA ('؟') و fallback ('/' + shift)
    // ═══════════════════════════════════════════════
    function _handleKeydown(e) {
        // اگه داخل input/textarea هستیم → بی‌خیال
        const tag = (e.target?.tagName || '').toLowerCase();
        const isField = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;

        if (isField) {
            // فقط Escape رو برای بستن پنل قبول کن
            if (e.key === 'Escape' && _isOpen) { e.preventDefault(); close(); }
            return;
        }

        // Shift + ? یا Shift + / یا Shift + ؟
        if (e.shiftKey && (e.key === '?' || e.key === '/' || e.key === '؟')) {
            e.preventDefault();
            toggle();
            return;
        }

        // Escape → بستن پنل
        if (e.key === 'Escape' && _isOpen) {
            e.preventDefault();
            close();
        }
    }

    // ═══════════════════════════════════════════════
    //  Init
    // ═══════════════════════════════════════════════
    function init() {
        if (_panelEl) return;  // already init
        _buildDom();
        document.addEventListener('keydown', _handleKeydown);
        console.log('[HelpUI] ✓ راهنما فعال شد — Shift + ?');
    }

    return { init, open, close, toggle };
})();