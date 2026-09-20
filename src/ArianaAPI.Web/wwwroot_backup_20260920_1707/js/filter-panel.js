/* ═══════════════════════════════════════════════════
   FilterPanel — پنل فیلتر حرفه‌ای با بخش‌های تاشو
   + ذخیره‌سازی خودکار + پریست‌ها
   ═══════════════════════════════════════════════════
   استفاده:
       FilterPanel.render(container, {
           pageKey: 'sanad',
           sections: [ { title, icon, fields: [...] } ],
           values: { ... },
           onRun: (values) => { ... }
       });
   ═══════════════════════════════════════════════════ */

const FilterPanel = {

    _storageKey: 'ariana_filters_v2',
    _presetsKey: 'ariana_filter_presets',
    _current: null,

    // ═══════════════════════════════════════════
    //  API
    // ═══════════════════════════════════════════
    render(container, opts) {
        this._injectStyle();

        const pageKey = opts.pageKey || 'default';
        const saved = this._loadValues(pageKey);
        const values = { ...(opts.values || {}), ...saved };

        this._current = {
            container,
            pageKey,
            opts,
            values,
            refs: {},
            sectionsCollapsed: this._loadCollapsed(pageKey)
        };

        container.innerHTML = this._buildHtml(opts, values);
        this._bind(container);
        this._updateActiveCount();
    },

    // گرفتن مقادیر فعلی
    getValues() {
        if (!this._current) return {};
        const out = {};
        Object.entries(this._current.refs).forEach(([name, ref]) => {
            out[name] = ref.getValue();
        });
        return out;
    },

    setValues(v) {
        if (!this._current) return;
        Object.assign(this._current.values, v);
        Object.entries(this._current.refs).forEach(([name, ref]) => {
            ref.setValue(v[name]);
        });
        this._updateActiveCount();
    },

    reset() {
        if (!this._current) return;
        const { pageKey } = this._current;
        localStorage.removeItem(this._storageKey + '_' + pageKey);
        this._current.values = {};
        this._current.container.innerHTML = this._buildHtml(this._current.opts, {});
        this._bind(this._current.container);
        this._updateActiveCount();
    },

    // ═══════════════════════════════════════════
    //  HTML
    // ═══════════════════════════════════════════
    _buildHtml(opts, values) {
        const { pageKey } = this._current;
        const sectionsHtml = (opts.sections || []).map((sec, sIdx) => {
            const collapsed = this._current.sectionsCollapsed[sIdx] ? 'collapsed' : '';
            const fieldsHtml = (sec.fields || [])
                .map(f => this._renderField(f, values[f.name]))
                .join('');

            return `
                <div class="fp-section ${collapsed}" data-sec="${sIdx}">
                    <div class="fp-sec-header" data-toggle="${sIdx}">
                        ${sec.icon ? `<span class="fp-sec-icon">${sec.icon}</span>` : ''}
                        <span class="fp-sec-title">${this._esc(sec.title)}</span>
                        <span class="fp-sec-badge" data-sec-badge="${sIdx}"></span>
                        <span class="fp-sec-arrow">▼</span>
                    </div>
                    <div class="fp-sec-body">
                        <div class="fp-grid" data-cols="${sec.cols || 4}">
                            ${fieldsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const presets = this._loadPresets(pageKey);

        return `
            <div class="fp-wrapper">
                <div class="fp-header">
                    <div class="fp-title">
                        <span class="fp-title-icon">🔍</span>
                        <span>فیلترها</span>
                        <span class="fp-active-badge hidden" data-active-badge>0</span>
                    </div>
                    <div class="fp-header-actions">
                        <button type="button" class="fp-tool-btn" data-act="collapse-all" title="بستن همه">
                            🔼
                        </button>
                        <button type="button" class="fp-tool-btn" data-act="expand-all" title="باز کردن همه">
                            🔽
                        </button>
                        ${presets.length ? `
                            <div class="fp-preset-wrap">
                                <button type="button" class="fp-tool-btn" data-act="load-preset" title="پریست‌ها">
                                    📌 پریست‌ها
                                </button>
                                <div class="fp-preset-menu hidden" data-preset-menu>
                                    ${presets.map((p, i) => `
                                        <div class="fp-preset-item" data-preset-idx="${i}">
                                            <span class="fp-preset-name">${this._esc(p.name)}</span>
                                            <button type="button" class="fp-preset-del" data-del-preset="${i}" title="حذف">✕</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>` : ''}
                        <button type="button" class="fp-tool-btn" data-act="save-preset" title="ذخیره پریست">
                            💾 ذخیره پریست
                        </button>
                        <button type="button" class="fp-tool-btn fp-tool-reset" data-act="reset" title="پاک کردن همه">
                            ↺ ریست
                        </button>
                    </div>
                </div>

                <div class="fp-body">
                    ${sectionsHtml}
                </div>

                ${opts.showRunButton !== false ? `
                    <div class="fp-footer">
                        <button type="button" class="btn btn-primary" data-act="run">
                            ${opts.runButtonText || '📊 تهیه گزارش'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  رندر یک فیلد
    // ═══════════════════════════════════════════
    _renderField(f, value) {
        const id = 'fp_' + Math.random().toString(36).slice(2, 9);
        const col = f.col === 'full' ? 'fp-col-full'
            : f.col === 2 ? 'fp-col-2'
                : f.col === 3 ? 'fp-col-3'
                    : '';

        let inner = '';

        switch (f.type) {
            case 'select':
            case 'custom-select':
                inner = this._renderCustomSelect(id, f, value);
                break;

            case 'radio':
                inner = `
                    <div class="fp-radio-group">
                        ${(f.options || []).map(o => `
                            <label class="fp-radio-item">
                                <input type="radio" name="${id}" value="${this._esc(o.value)}"
                                    ${String(value ?? '') === String(o.value) ? 'checked' : ''}>
                                <span>${this._esc(o.label)}</span>
                            </label>
                        `).join('')}
                    </div>`;
                break;

            case 'checkbox':
                inner = `
                    <label class="fp-checkbox-label">
                        <input type="checkbox" id="${id}" ${value ? 'checked' : ''}>
                        <span>${this._esc(f.checkboxLabel || f.label || '')}</span>
                    </label>`;
                break;

            case 'number':
            case 'decimal':
                inner = `<input type="text" id="${id}" class="fp-input fp-num"
                            inputmode="decimal" dir="ltr"
                            placeholder="${this._esc(f.placeholder || '')}"
                            value="${this._esc(value ?? '')}">`;
                break;

            case 'date':
                inner = `<input type="text" id="${id}" class="fp-input fp-date"
                            placeholder="${this._esc(f.placeholder || '1404/01/01')}"
                            value="${this._esc(value ?? '')}">`;
                break;

            default:
                inner = `<input type="text" id="${id}" class="fp-input"
                            placeholder="${this._esc(f.placeholder || '')}"
                            value="${this._esc(value ?? '')}"
                            dir="${f.dir || 'rtl'}">`;
        }

        return `
            <div class="fp-field ${col}" data-field="${f.name}">
                ${f.label && f.type !== 'checkbox' ? `
                    <label class="fp-label" for="${id}">${this._esc(f.label)}</label>
                ` : ''}
                ${inner}
            </div>
        `;
    },

    _renderCustomSelect(id, f, value) {
        const opts = f.options || [];
        const selected = opts.find(o => String(o.value) === String(value));
        const display = selected ? selected.label : (f.placeholder || 'همه');

        return `
            <div class="custom-select fp-custom-select" data-name="${f.name}">
                <button type="button" class="custom-select-trigger" id="${id}">
                    <span class="custom-select-value">${this._esc(display)}</span>
                    <span class="custom-select-arrow">▼</span>
                </button>
                <div class="custom-select-menu">
                    ${f.allowEmpty !== false
                ? `<div class="custom-select-option ${!selected ? 'selected' : ''}" data-value="">${this._esc(f.placeholder || 'همه')}</div>`
                : ''}
                    ${opts.map(o => `
                        <div class="custom-select-option ${String(o.value) === String(value) ? 'selected' : ''}"
                             data-value="${this._esc(o.value)}">${this._esc(o.label)}</div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  Bind
    // ═══════════════════════════════════════════
    _bind(container) {
        const c = this._current;

        // ─── بخش‌های تاشو ───
        container.querySelectorAll('.fp-sec-header').forEach(h => {
            h.addEventListener('click', () => {
                const sIdx = parseInt(h.dataset.toggle);
                const sec = h.closest('.fp-section');
                sec.classList.toggle('collapsed');
                c.sectionsCollapsed[sIdx] = sec.classList.contains('collapsed');
                this._saveCollapsed(c.pageKey, c.sectionsCollapsed);
            });
        });

        // ─── field refs ───
        c.refs = {};

        (c.opts.sections || []).forEach(sec => {
            (sec.fields || []).forEach(f => {
                const wrap = container.querySelector(`[data-field="${f.name}"]`);
                if (!wrap) return;
                this._bindField(f, wrap, c);
            });
        });

        // ─── ابزارها ───
        container.querySelector('[data-act="reset"]')?.addEventListener('click', () => this.reset());
        container.querySelector('[data-act="run"]')?.addEventListener('click', () => this._run());
        container.querySelector('[data-act="collapse-all"]')?.addEventListener('click', () => {
            container.querySelectorAll('.fp-section').forEach((s, i) => {
                s.classList.add('collapsed');
                c.sectionsCollapsed[i] = true;
            });
            this._saveCollapsed(c.pageKey, c.sectionsCollapsed);
        });
        container.querySelector('[data-act="expand-all"]')?.addEventListener('click', () => {
            container.querySelectorAll('.fp-section').forEach((s, i) => {
                s.classList.remove('collapsed');
                c.sectionsCollapsed[i] = false;
            });
            this._saveCollapsed(c.pageKey, c.sectionsCollapsed);
        });

        container.querySelector('[data-act="save-preset"]')?.addEventListener('click', () => this._savePreset());
        container.querySelector('[data-act="load-preset"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = container.querySelector('[data-preset-menu]');
            menu?.classList.toggle('hidden');
        });

        container.querySelectorAll('[data-preset-idx]').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('[data-del-preset]')) return;
                const idx = parseInt(item.dataset.presetIdx);
                this._applyPreset(idx);
            });
        });

        container.querySelectorAll('[data-del-preset]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.delPreset);
                this._deletePreset(idx);
            });
        });

        // بستن پریست منو با کلیک بیرون
        if (!this._outsideBound) {
            this._outsideBound = true;
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.fp-preset-wrap')) {
                    document.querySelectorAll('[data-preset-menu]')
                        .forEach(m => m.classList.add('hidden'));
                }

                // ⭐ بستن همه‌ی dropdown های باز + برگرداندن overflow
                document.querySelectorAll('.custom-select.open, .fp-custom-select.open')
                    .forEach(el => {
                        if (!el.contains(e.target)) {
                            el.classList.remove('open');
                            if (el._savedOverflows) this._relockOverflow(el);
                        }
                    });
            });
        }
    },

    _bindField(f, wrap, c) {
        const name = f.name;

        // ─── custom-select ───
        if (f.type === 'select' || f.type === 'custom-select') {
            const cs = wrap.querySelector('.fp-custom-select');
            const trigger = cs.querySelector('.custom-select-trigger');
            const menu = cs.querySelector('.custom-select-menu');
            const valueEl = cs.querySelector('.custom-select-value');

            trigger.addEventListener('click', e => {
                e.stopPropagation();

                // بستن بقیه
                document.querySelectorAll('.custom-select.open, .fp-custom-select.open')
                    .forEach(other => {
                        if (other !== cs) {
                            other.classList.remove('open');
                            // ⭐ برگرداندن overflow بقیه
                            if (other._savedOverflows) this._relockOverflow(other);
                        }
                    });

                // ⭐ باز/بسته کردن + قفل/آزاد کردن overflow
                const isOpen = cs.classList.toggle('open');
                if (isOpen) {
                    this._unlockOverflow(cs);
                } else {
                    this._relockOverflow(cs);
                }
            });

            menu.querySelectorAll('.custom-select-option').forEach(opt => {
                opt.addEventListener('click', e => {
                    e.stopPropagation();
                    const v = opt.dataset.value;
                    const finalV = v === '' ? null : this._coerce(v, f);
                    c.values[name] = finalV;
                    valueEl.textContent = opt.textContent.trim();
                    menu.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    cs.classList.remove('open');

                    // ⭐ بعد از انتخاب، overflow رو برگردون
                    this._relockOverflow(cs);

                    this._saveValues(c.pageKey, c.values);
                    this._updateActiveCount();
                    f.onChange?.(finalV, c.values);
                });
            });

    // ...

            c.refs[name] = {
                getValue: () => c.values[name],
                setValue: (v) => {
                    c.values[name] = v;
                    const opt = menu.querySelector(`[data-value="${v}"]`);
                    if (opt) {
                        valueEl.textContent = opt.textContent.trim();
                        menu.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                        opt.classList.add('selected');
                    } else {
                        // ریست
                        const first = menu.querySelector('.custom-select-option');
                        if (first) {
                            valueEl.textContent = first.textContent.trim();
                            menu.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                            first.classList.add('selected');
                        }
                    }
                }
            };
            return;
        }

        // ─── checkbox ───
        if (f.type === 'checkbox') {
            const inp = wrap.querySelector('input[type=checkbox]');
            inp.addEventListener('change', () => {
                c.values[name] = inp.checked;
                this._saveValues(c.pageKey, c.values);
                this._updateActiveCount();
            });
            c.refs[name] = {
                getValue: () => c.values[name],
                setValue: (v) => { c.values[name] = !!v; inp.checked = !!v; }
            };
            return;
        }

        // ─── radio ───
        if (f.type === 'radio') {
            const inputs = wrap.querySelectorAll('input[type=radio]');
            inputs.forEach(inp => {
                inp.addEventListener('change', () => {
                    if (inp.checked) {
                        c.values[name] = this._coerce(inp.value, f);
                        this._saveValues(c.pageKey, c.values);
                        this._updateActiveCount();
                    }
                });
            });
            c.refs[name] = {
                getValue: () => c.values[name],
                setValue: (v) => {
                    c.values[name] = v;
                    inputs.forEach(inp => inp.checked = String(inp.value) === String(v));
                }
            };
            return;
        }

        // ─── عدد / تاریخ / متن ───
        const inp = wrap.querySelector('.fp-input');
        if (!inp) return;

        if (f.type === 'date') {
            inp.addEventListener('input', () => {
                let v = inp.value.replace(/[^\d]/g, '');
                if (v.length > 4) v = v.slice(0, 4) + '/' + v.slice(4);
                if (v.length > 7) v = v.slice(0, 7) + '/' + v.slice(7);
                if (v.length > 10) v = v.slice(0, 10);
                inp.value = v;
            });
        }

        inp.addEventListener('input', () => {
            if (f.type === 'number' || f.type === 'decimal') {
                const v = inp.value.replace(/[,\s]/g, '');
                const n = v === '' ? null : parseFloat(v);
                c.values[name] = isNaN(n) ? null : n;
            } else {
                c.values[name] = inp.value.trim() || null;
            }
            this._saveValues(c.pageKey, c.values);
            this._updateActiveCount();
        });

        // Enter → run
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._run();
        });

        c.refs[name] = {
            getValue: () => c.values[name],
            setValue: (v) => {
                c.values[name] = v;
                inp.value = v ?? '';
            }
        };
    },

    // ═══════════════════════════════════════════
    //  Run
    // ═══════════════════════════════════════════
    _run() {
        const c = this._current;
        if (!c) return;
        const values = this.getValues();
        c.opts.onRun?.(values);
    },

    // ═══════════════════════════════════════════
    //  فعال بودن فیلترها
    // ═══════════════════════════════════════════
    _updateActiveCount() {
        const c = this._current;
        if (!c) return;

        let total = 0;
        const perSection = {};

        (c.opts.sections || []).forEach((sec, sIdx) => {
            let count = 0;
            (sec.fields || []).forEach(f => {
                const v = c.values[f.name];
                const isEmpty = v == null || v === ''
                    || (Array.isArray(v) && !v.length)
                    || (f.type === 'radio' && v === f.ignoreValue)
                    || (f.type === 'select' && v === f.ignoreValue);

                // برای فیلترهایی که خودشون پیش‌فرض غیرخالی دارن مثل 'all'
                if (!isEmpty && f.ignoreValue !== undefined && v === f.ignoreValue) return;
                if (isEmpty && !f.required) return;
                if (f.ignoreValue !== undefined && v === f.ignoreValue) return;
                if (isEmpty) return;
                if (f.type === 'checkbox' && !v) return;
                count++;
            });
            perSection[sIdx] = count;
            total += count;
        });

        // badge کلی
        const badge = c.container.querySelector('[data-active-badge]');
        if (badge) {
            if (total > 0) {
                badge.textContent = total;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // badge هر بخش
        c.container.querySelectorAll('[data-sec-badge]').forEach(el => {
            const idx = parseInt(el.dataset.secBadge);
            const n = perSection[idx] || 0;
            if (n > 0) {
                el.textContent = n;
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
    },

    // ═══════════════════════════════════════════
    //  Persistence
    // ═══════════════════════════════════════════
    _saveValues(pageKey, values) {
        try {
            const all = JSON.parse(localStorage.getItem(this._storageKey) || '{}');
            all[pageKey] = values;
            localStorage.setItem(this._storageKey, JSON.stringify(all));
        } catch (e) { /* ignore */ }
    },

    _loadValues(pageKey) {
        try {
            const all = JSON.parse(localStorage.getItem(this._storageKey) || '{}');
            return all[pageKey] || {};
        } catch (e) { return {}; }
    },

    _saveCollapsed(pageKey, collapsed) {
        try {
            const all = JSON.parse(localStorage.getItem(this._storageKey + '_collapsed') || '{}');
            all[pageKey] = collapsed;
            localStorage.setItem(this._storageKey + '_collapsed', JSON.stringify(all));
        } catch (e) { /* ignore */ }
    },

    _loadCollapsed(pageKey) {
        try {
            const all = JSON.parse(localStorage.getItem(this._storageKey + '_collapsed') || '{}');
            return all[pageKey] || {};
        } catch (e) { return {}; }
    },

    // ═══════════════════════════════════════════
    //  Presets
    // ═══════════════════════════════════════════
    _loadPresets(pageKey) {
        try {
            const all = JSON.parse(localStorage.getItem(this._presetsKey) || '{}');
            return all[pageKey] || [];
        } catch (e) { return []; }
    },

    _savePresets(pageKey, presets) {
        try {
            const all = JSON.parse(localStorage.getItem(this._presetsKey) || '{}');
            all[pageKey] = presets;
            localStorage.setItem(this._presetsKey, JSON.stringify(all));
        } catch (e) { /* ignore */ }
    },

    _savePreset() {
        const c = this._current;
        if (!c) return;
        const name = prompt('نام پریست:');
        if (!name || !name.trim()) return;

        const presets = this._loadPresets(c.pageKey);
        presets.push({
            name: name.trim(),
            values: { ...this.getValues() },
            ts: Date.now()
        });
        this._savePresets(c.pageKey, presets);

        // رندر مجدد پنل
        c.container.innerHTML = this._buildHtml(c.opts, c.values);
        this._bind(c.container);
        this._updateActiveCount();
        App?.toast?.('پریست ذخیره شد', 'success');
    },

    _applyPreset(idx) {
        const c = this._current;
        if (!c) return;
        const presets = this._loadPresets(c.pageKey);
        const preset = presets[idx];
        if (!preset) return;

        this.setValues(preset.values);
        this._saveValues(c.pageKey, c.values);

        // بستن منو
        c.container.querySelector('[data-preset-menu]')?.classList.add('hidden');
        App?.toast?.(`پریست «${preset.name}» اعمال شد`, 'success');
    },

    _deletePreset(idx) {
        const c = this._current;
        if (!c) return;
        const presets = this._loadPresets(c.pageKey);
        if (!confirm(`حذف پریست «${presets[idx].name}»؟`)) return;

        presets.splice(idx, 1);
        this._savePresets(c.pageKey, presets);

        c.container.innerHTML = this._buildHtml(c.opts, c.values);
        this._bind(c.container);
        this._updateActiveCount();
    },

    // ═══════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════
    _coerce(v, f) {
        if (v === '' || v == null) return null;
        if (f.type === 'number') { const n = parseInt(v); return isNaN(n) ? null : n; }
        if (f.type === 'decimal') { const n = parseFloat(v); return isNaN(n) ? null : n; }
        return v;
    },
    // ═══════════════════════════════════════════
    //  مدیریت overflow برای dropdown
    // ═══════════════════════════════════════════
    _unlockOverflow(el) {
        el._savedOverflows = [];
        let cur = el.parentElement;
        while (cur && cur !== document.body) {
            const cs = getComputedStyle(cur);
            if (cs.overflow !== 'visible' || cs.overflowY !== 'visible') {
                el._savedOverflows.push({ el: cur, overflow: cur.style.overflow });
                cur.style.overflow = 'visible';
            }
            cur = cur.parentElement;
        }
    },

    _relockOverflow(el) {
        (el._savedOverflows || []).forEach(({ el: e, overflow }) => {
            e.style.overflow = overflow;
        });
        el._savedOverflows = null;
    },
    _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    // ═══════════════════════════════════════════
    //  Style
    // ═══════════════════════════════════════════
    _styleInjected: false,
    _injectStyle() {
        if (this._styleInjected) return;
        this._styleInjected = true;

        const style = document.createElement('style');
        style.textContent = `
            .fp-wrapper {
                background: #fff;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                box-shadow: var(--shadow-sm);
            }

            /* ═══ Header ═══ */
            .fp-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: linear-gradient(180deg, #fff, #F9FAFB);
                border-bottom: 1px solid var(--border);
                flex-wrap: wrap;
                gap: 10px;
            }
            .fp-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 700;
                font-size: 14px;
                color: var(--text);
            }
            .fp-title-icon { font-size: 15px; }
            .fp-active-badge {
                background: var(--primary);
                color: #fff;
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 10px;
                min-width: 20px;
                text-align: center;
            }
            .fp-header-actions {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .fp-tool-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 6px 11px;
                font-family: inherit;
                font-size: 12px;
                font-weight: 500;
                border-radius: 7px;
                border: 1px solid var(--border);
                background: #fff;
                color: var(--text);
                cursor: pointer;
                transition: all 0.15s;
                white-space: nowrap;
            }
            .fp-tool-btn:hover {
                background: var(--primary-light);
                border-color: var(--primary);
                color: var(--primary);
            }
            .fp-tool-reset:hover {
                background: #FEF2F2;
                border-color: var(--danger);
                color: var(--danger);
            }

            /* پریست */
            .fp-preset-wrap { position: relative; }
            .fp-preset-menu {
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                min-width: 200px;
                background: #fff;
                border: 1px solid var(--border);
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.12);
                z-index: 50;
                padding: 4px;
                max-height: 280px;
                overflow-y: auto;
            }
            .fp-preset-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                transition: background 0.1s;
            }
            .fp-preset-item:hover { background: var(--primary-light); }
            .fp-preset-name { flex: 1; }
            .fp-preset-del {
                background: none;
                border: none;
                color: var(--danger);
                cursor: pointer;
                font-size: 14px;
                padding: 0 4px;
                border-radius: 4px;
            }
            .fp-preset-del:hover { background: #FEE2E2; }

            /* ═══ Body ═══ */
            .fp-body { padding: 0; }
            .fp-section { border-bottom: 1px solid var(--border); }
            .fp-section:last-child { border-bottom: none; }
            .fp-sec-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 11px 16px;
                cursor: pointer;
                user-select: none;
                transition: background 0.12s;
            }
            .fp-sec-header:hover { background: #F9FAFB; }
            .fp-sec-icon { font-size: 15px; }
            .fp-sec-title { flex: 1; font-size: 13.5px; font-weight: 600; color: var(--text); }
            .fp-sec-badge {
                background: var(--primary);
                color: #fff;
                font-size: 10.5px;
                font-weight: 700;
                padding: 1px 7px;
                border-radius: 10px;
                min-width: 18px;
                text-align: center;
            }
            .fp-sec-arrow {
                font-size: 10px;
                color: var(--text-muted);
                transition: transform 0.2s;
            }
            .fp-section.collapsed .fp-sec-arrow { transform: rotate(-90deg); }
            .fp-sec-body {
                padding: 4px 16px 16px;
                overflow: hidden;
                max-height: 800px;
                transition: max-height 0.25s ease, padding 0.25s ease;
            }
            .fp-section.collapsed .fp-sec-body {
                max-height: 0;
                padding: 0 16px;
            }

            /* Grid */
            .fp-grid {
                display: grid;
                gap: 12px;
                grid-template-columns: repeat(4, minmax(0, 1fr));
            }
            .fp-grid[data-cols="1"] { grid-template-columns: 1fr; }
            .fp-grid[data-cols="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .fp-grid[data-cols="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }

            .fp-col-full { grid-column: 1 / -1; }
            .fp-col-2 { grid-column: span 2; }
            .fp-col-3 { grid-column: span 3; }

            /* فیلد */
            .fp-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
            .fp-label {
                font-size: 12px;
                font-weight: 500;
                color: var(--text-muted);
            }
            .fp-input {
                width: 100%;
                padding: 9px 12px;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                font-family: inherit;
                font-size: 13.5px;
                background: #fff;
                color: var(--text);
                transition: all 0.15s;
                min-height: 40px;
            }
            .fp-input:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 0 3px var(--primary-light);
            }
            .fp-num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; }

            /* radio */
            .fp-radio-group {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .fp-radio-item {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 6px 11px;
                border: 1.5px solid var(--border);
                border-radius: 7px;
                cursor: pointer;
                font-size: 12.5px;
                font-weight: 500;
                transition: all 0.15s;
                background: #fff;
            }
            .fp-radio-item:hover { border-color: var(--primary); background: var(--primary-light); }
            .fp-radio-item:has(input:checked) {
                border-color: var(--primary);
                background: var(--primary-light);
                color: var(--primary);
                font-weight: 600;
            }
            .fp-radio-item input { cursor: pointer; accent-color: var(--primary); margin: 0; }

            /* checkbox */
            .fp-checkbox-label {
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 9px 12px;
                background: #F9FAFB;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.15s;
            }
            .fp-checkbox-label:hover { border-color: var(--primary); background: var(--primary-light); }
            .fp-checkbox-label input { cursor: pointer; accent-color: var(--primary); }

            /* ═══ Footer ═══ */
            .fp-footer {
                padding: 12px 16px;
                background: #F9FAFB;
                border-top: 1px solid var(--border);
                display: flex;
                justify-content: flex-start;
            }
            .fp-footer .btn { min-width: 180px; }

            /* ═══ Responsive ═══ */
            @media (max-width: 900px) {
                .fp-grid,
                .fp-grid[data-cols="3"],
                .fp-grid[data-cols="4"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (max-width: 640px) {
                .fp-grid,
                .fp-grid[data-cols="2"],
                .fp-grid[data-cols="3"],
                .fp-grid[data-cols="4"] { grid-template-columns: 1fr; }
                .fp-col-2, .fp-col-3 { grid-column: auto; }
                .fp-header { padding: 10px 12px; }
                .fp-tool-btn { padding: 5px 9px; font-size: 11px; }
                .fp-footer .btn { width: 100%; min-width: 0; }
            }
        `;
        document.head.appendChild(style);
    }
};