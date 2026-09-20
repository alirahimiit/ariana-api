/* ═══════════════════════════════════════════════════
   FormBuilder — ساخت فرم‌های داینامیک با طرح‌بندی و اعتبارسنجی
   ═══════════════════════════════════════════════════
   انواع فیلد:
     text, number, decimal, money, date, time,
     select, custom-select, radio, checkbox, textarea,
     password, readonly
   ═══════════════════════════════════════════════════ */

const FormBuilder = {

    // ═══════════════════════════════════════════
    //  API عمومی
    // ═══════════════════════════════════════════
    create(schema) {
        const state = {
            schema,
            values: this._initValues(schema),
            errors: {},
            refs: {},          // name → { input, wrapper, getValue, setValue }
            container: null
        };

        const api = {
            render: (c) => this._render(state, c),
            getValues: () => this._collect(state),
            setValues: (v) => { Object.assign(state.values, v); this._reapplyAll(state); },
            setValue: (n, v) => { state.values[n] = v; this._reapplyOne(state, n); },
            getValue: (n) => state.values[n],
            validate: () => this._validate(state),
            reset: () => { state.values = this._initValues(state.schema); state.errors = {}; this._reapplyAll(state); this._clearErrors(state); },
            setError: (n, msg) => this._setFieldError(state, n, msg),
            clearErrors: () => this._clearErrors(state),
            focus: (n) => state.refs[n]?.input?.focus(),
            el: () => state.container,
            destroy: () => { if (state.container) state.container.innerHTML = ''; }
        };
        return api;
    },

    // ═══════════════════════════════════════════
    //  مقدار اولیه
    // ═══════════════════════════════════════════
    _initValues(schema) {
        const v = { ...(schema.data || {}) };
        (schema.sections || []).forEach(sec => {
            (sec.fields || []).forEach(f => {
                if (!(f.name in v) && f.defaultValue !== undefined) {
                    v[f.name] = f.defaultValue;
                }
            });
        });
        return v;
    },

    // ═══════════════════════════════════════════
    //  رندر
    // ═══════════════════════════════════════════
    _render(state, container) {
        this._injectStyle();
        state.container = container;
        state.refs = {};

        const { schema } = state;
        const submitText = schema.submitText || '💾 ذخیره';
        const cancelText = schema.cancelText || 'انصراف';
        const showFooter = schema.showFooter !== false;

        const sectionsHtml = (schema.sections || []).map((sec, sIdx) => {
            const fieldsHtml = (sec.fields || []).map(f => this._renderField(state, f)).join('');
            const collapsed = sec.collapsed ? 'collapsed' : '';
            const hasHeader = !!sec.title;

            return `
                <div class="fb-section ${collapsed}" data-sec="${sIdx}">
                    ${hasHeader ? `
                        <div class="fb-section-header" data-toggle-sec="${sIdx}">
                            ${sec.icon ? `<span class="fb-sec-icon">${sec.icon}</span>` : ''}
                            <span class="fb-sec-title">${this._esc(sec.title)}</span>
                            <span class="fb-sec-arrow">▼</span>
                        </div>` : ''}
                    <div class="fb-section-body">
                        <div class="fb-grid" data-cols="${sec.cols || schema.cols || 2}">
                            ${fieldsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <form class="fb-form" onsubmit="return false;">
                ${schema.title ? `<div class="fb-title">${this._esc(schema.title)}</div>` : ''}
                ${schema.description ? `<div class="fb-desc">${this._esc(schema.description)}</div>` : ''}
                ${sectionsHtml}
                ${showFooter ? `
                    <div class="fb-footer">
                        <div class="fb-footer-right">
                            <button type="button" class="btn btn-primary" data-act="submit">${submitText}</button>
                            <button type="button" class="btn btn-ghost" data-act="cancel">${cancelText}</button>
                        </div>
                        ${schema.extraFooter || ''}
                    </div>
                ` : ''}
            </form>
        `;

        // ─── bind رویدادها ───
        container.querySelectorAll('.fb-section-header').forEach(h => {
            h.addEventListener('click', () => {
                const sec = h.closest('.fb-section');
                sec.classList.toggle('collapsed');
            });
        });

        const submitBtn = container.querySelector('[data-act="submit"]');
        const cancelBtn = container.querySelector('[data-act="cancel"]');

        submitBtn?.addEventListener('click', async () => {
            if (!this._validate(state)) {
                // فوکوس روی اولین فیلد خطادار
                const firstErr = Object.keys(state.errors)[0];
                state.refs[firstErr]?.input?.focus();
                App?.toast?.('لطفاً خطاهای فرم را برطرف کنید', 'error');
                return;
            }
            const values = this._collect(state);
            try {
                submitBtn.disabled = true;
                const orig = submitBtn.textContent;
                submitBtn.textContent = '⏳ در حال ذخیره...';
                await schema.onSubmit?.(values, api);
                submitBtn.textContent = orig;
            } catch (err) {
                App?.toast?.(err.message || 'خطا در ذخیره', 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });

        cancelBtn?.addEventListener('click', () => {
            schema.onCancel?.();
        });
    },

    // ═══════════════════════════════════════════
    //  رندر یک فیلد
    // ═══════════════════════════════════════════
    _renderField(state, f) {
        const id = 'fb_' + Math.random().toString(36).slice(2, 9);
        const name = f.name;
        const value = state.values[name];
        const colCls = this._colClass(f.col);
        const required = f.required ? 'required' : '';
        const disabled = f.disabled ? 'disabled' : '';
        const readonly = f.readonly ? 'readonly' : '';

        let inner = '';

        switch (f.type) {
            case 'readonly':
                inner = `<div class="fb-readonly">${this._esc(f.format ? f.format(value) : value) || '-'}</div>`;
                state.refs[name] = { input: null, getValue: () => state.values[name], setValue: () => { } };
                break;

            case 'textarea':
                inner = `<textarea id="${id}" class="fb-input" rows="${f.rows || 3}"
                            placeholder="${this._esc(f.placeholder || '')}"
                            ${disabled} ${readonly}>${this._esc(value ?? '')}</textarea>`;
                break;

            case 'select':
            case 'custom-select':
                inner = this._renderCustomSelect(id, f, value, state);
                break;

            case 'checkbox':
                return `
                    <div class="fb-field ${colCls} fb-field-checkbox">
                        <label class="fb-checkbox-label">
                            <input type="checkbox" id="${id}" ${value ? 'checked' : ''} ${disabled}>
                            <span>${this._esc(f.label)}</span>
                        </label>
                        ${f.help ? `<div class="fb-help">${this._esc(f.help)}</div>` : ''}
                    </div>
                `;

            case 'radio':
                inner = `
                    <div class="fb-radio-group">
                        ${(f.options || []).map(o => `
                            <label class="fb-radio-item">
                                <input type="radio" name="${id}" value="${this._esc(o.value)}"
                                    ${String(value) === String(o.value) ? 'checked' : ''} ${disabled}>
                                <span>${this._esc(o.label)}</span>
                            </label>
                        `).join('')}
                    </div>`;
                break;

            case 'money':
            case 'decimal':
            case 'number':
                inner = `<input type="text" id="${id}" class="fb-input fb-num"
                            inputmode="decimal" dir="ltr"
                            placeholder="${this._esc(f.placeholder || '')}"
                            value="${this._esc(this._displayNumber(value, f.type))}"
                            ${disabled} ${readonly}>`;
                break;

            case 'date':
                inner = `<input type="text" id="${id}" class="fb-input fb-date"
                            placeholder="${this._esc(f.placeholder || '1404/01/01')}"
                            value="${this._esc(value ?? '')}"
                            ${disabled} ${readonly}>`;
                break;

            case 'time':
                inner = `<input type="text" id="${id}" class="fb-input fb-time"
                            placeholder="${this._esc(f.placeholder || '12:30')}"
                            value="${this._esc(value ?? '')}"
                            ${disabled} ${readonly}>`;
                break;

            case 'password':
                inner = `<input type="password" id="${id}" class="fb-input"
                            placeholder="${this._esc(f.placeholder || '')}"
                            value="${this._esc(value ?? '')}" ${disabled} ${readonly}>`;
                break;

            default: // text
                inner = `<input type="text" id="${id}" class="fb-input"
                            placeholder="${this._esc(f.placeholder || '')}"
                            value="${this._esc(value ?? '')}"
                            dir="${f.dir || 'rtl'}" ${disabled} ${readonly}>`;
        }

        // ─── wrapper ───
        const html = `
            <div class="fb-field ${colCls}" data-field="${name}">
                ${f.label && f.type !== 'checkbox' ? `
                    <label class="fb-label" for="${id}">
                        ${this._esc(f.label)}
                        ${f.required ? '<span class="fb-required">*</span>' : ''}
                    </label>` : ''}
                ${inner}
                ${f.help ? `<div class="fb-help">${this._esc(f.help)}</div>` : ''}
                <div class="fb-error"></div>
            </div>
        `;

        // ─── ذخیره ref بعد از درج در DOM ───
        setTimeout(() => {
            const wrapper = state.container?.querySelector(`[data-field="${name}"]`);
            if (!wrapper) return;
            this._bindField(state, f, wrapper);
        }, 0);

        return html;
    },

    // ═══════════════════════════════════════════
    //  Custom Select (RTL-safe)
    // ═══════════════════════════════════════════
    _renderCustomSelect(id, f, value, state) {
        const opts = f.options || [];
        const selected = opts.find(o => String(o.value) === String(value));
        const displayValue = selected ? selected.label : (f.placeholder || '-- انتخاب کنید --');

        return `
            <div class="custom-select fb-custom-select" data-for="${f.name}">
                <button type="button" class="custom-select-trigger" id="${id}">
                    <span class="custom-select-value">${this._esc(displayValue)}</span>
                    <span class="custom-select-arrow">▼</span>
                </button>
                <div class="custom-select-menu">
                    ${f.allowEmpty !== false
                ? `<div class="custom-select-option ${!selected ? 'selected' : ''}" data-value="">${this._esc(f.placeholder || '-- انتخاب کنید --')}</div>`
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
    //  Bind رویدادهای یک فیلد
    // ═══════════════════════════════════════════
    _bindField(state, f, wrapper) {
        const name = f.name;
        const type = f.type || 'text';

        // ─── custom-select ───
        if (type === 'select' || type === 'custom-select') {
            const wrap = wrapper.querySelector('.fb-custom-select');
            const trigger = wrap.querySelector('.custom-select-trigger');
            const menu = wrap.querySelector('.custom-select-menu');
            const valueEl = wrap.querySelector('.custom-select-value');

            trigger.addEventListener('click', e => {
                e.stopPropagation();

                document.querySelectorAll('.custom-select.open, .fb-custom-select.open')
                    .forEach(other => {
                        if (other !== wrap) {
                            other.classList.remove('open');
                            if (other._savedOverflows) this._relockOverflow(other);
                        }
                    });

                const isOpen = wrap.classList.toggle('open');
                if (isOpen) this._unlockOverflow(wrap);
                else this._relockOverflow(wrap);
            });
            menu.querySelectorAll('.custom-select-option').forEach(opt => {
                opt.addEventListener('click', e => {
                    e.stopPropagation();
                    const v = opt.dataset.value;
                    state.values[name] = v === '' ? null : this._coerceValue(v, f);
                    valueEl.textContent = opt.textContent.trim();
                    menu.querySelectorAll('.custom-select-option')
                        .forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    wrap.classList.remove('open');
                    this._relockOverflow(wrap);
                    this._clearFieldError(state, name);
                    f.onChange?.(state.values[name], state.values);
                });
            });

            // بستن با کلیک بیرون (یک‌بار برای همیشه)
            if (!this._globalClickBound) {
                this._globalClickBound = true;
                document.addEventListener('click', () => {
                    document.querySelectorAll('.custom-select.open, .fb-custom-select.open')
                        .forEach(el => {
                            el.classList.remove('open');
                            if (el._savedOverflows) this._relockOverflow(el);
                        });
                });
            }

            state.refs[name] = {
                input: trigger,
                getValue: () => state.values[name],
                setValue: (v) => {
                    state.values[name] = v;
                    const opt = menu.querySelector(`[data-value="${v}"]`);
                    if (opt) {
                        valueEl.textContent = opt.textContent.trim();
                        menu.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                        opt.classList.add('selected');
                    }
                }
            };
            return;
        }

        // ─── چک‌باکس ───
        if (type === 'checkbox') {
            const inp = wrapper.querySelector('input[type=checkbox]');
            inp.addEventListener('change', () => {
                state.values[name] = inp.checked;
            });
            state.refs[name] = {
                input: inp,
                getValue: () => state.values[name],
                setValue: (v) => { state.values[name] = !!v; inp.checked = !!v; }
            };
            return;
        }

        // ─── رادیو ───
        if (type === 'radio') {
            const inputs = wrapper.querySelectorAll('input[type=radio]');
            inputs.forEach(inp => {
                inp.addEventListener('change', () => {
                    if (inp.checked) {
                        state.values[name] = this._coerceValue(inp.value, f);
                        this._clearFieldError(state, name);
                    }
                });
            });
            state.refs[name] = {
                input: inputs[0],
                getValue: () => state.values[name],
                setValue: (v) => {
                    state.values[name] = v;
                    inputs.forEach(inp => inp.checked = String(inp.value) === String(v));
                }
            };
            return;
        }

        // ─── عددی / تاریخ / متن ───
        const inp = wrapper.querySelector('.fb-input');
        if (!inp) return;

        // فرمت‌بندی زنده برای money
        if (type === 'money') {
            inp.addEventListener('input', () => {
                const raw = inp.value.replace(/[^\d.\-]/g, '');
                const num = parseFloat(raw);
                if (!isNaN(num)) {
                    // همون لحظه فقط ارقام رو نگه‌دار، موقع blur فرمت کن
                }
            });
            inp.addEventListener('blur', () => {
                const num = this._parseNumber(inp.value);
                state.values[name] = num;
                inp.value = num == null ? '' : num.toLocaleString('fa-IR');
            });
            inp.addEventListener('focus', () => {
                const v = state.values[name];
                inp.value = v == null ? '' : String(v);
            });
        }

        if (type === 'number' || type === 'decimal') {
            inp.addEventListener('blur', () => {
                const v = inp.value.replace(/[,\s]/g, '');
                if (v === '') { state.values[name] = null; return; }
                const n = parseFloat(v);
                state.values[name] = isNaN(n) ? null : (type === 'number' ? Math.round(n) : n);
                inp.value = state.values[name] == null ? '' : String(state.values[name]);
            });
        }

        // ماسک تاریخ
        if (type === 'date') {
            inp.addEventListener('input', () => {
                let v = inp.value.replace(/[^\d]/g, '');
                if (v.length > 4) v = v.slice(0, 4) + '/' + v.slice(4);
                if (v.length > 7) v = v.slice(0, 7) + '/' + v.slice(7);
                if (v.length > 10) v = v.slice(0, 10);
                inp.value = v;
            });
            inp.addEventListener('blur', () => {
                state.values[name] = inp.value.trim() || null;
            });
        }

        // ذخیره‌ی مقدار
        inp.addEventListener('input', () => {
            if (type === 'money' || type === 'number' || type === 'decimal') return;
            if (type === 'date') return;
            state.values[name] = inp.value;
            this._clearFieldError(state, name);
        });

        state.refs[name] = {
            input: inp,
            getValue: () => state.values[name],
            setValue: (v) => {
                state.values[name] = v;
                inp.value = type === 'money'
                    ? (v == null ? '' : Number(v).toLocaleString('fa-IR'))
                    : (v ?? '');
            }
        };
    },

    // ═══════════════════════════════════════════
    //  Collect values
    // ═══════════════════════════════════════════
    _collect(state) {
        const out = {};
        Object.keys(state.refs).forEach(name => {
            out[name] = state.refs[name].getValue();
        });
        return out;
    },

    _reapplyAll(state) {
        Object.keys(state.refs).forEach(name => {
            state.refs[name].setValue(state.values[name]);
        });
    },

    _reapplyOne(state, name) {
        state.refs[name]?.setValue(state.values[name]);
    },

    // ═══════════════════════════════════════════
    //  Validation
    // ═══════════════════════════════════════════
    _validate(state) {
        state.errors = {};
        this._clearErrors(state);

        (state.schema.sections || []).forEach(sec => {
            (sec.fields || []).forEach(f => {
                const v = state.values[f.name];

                // required
                if (f.required) {
                    const isEmpty = v == null || v === '' || (typeof v === 'string' && !v.trim());
                    if (isEmpty) {
                        state.errors[f.name] = f.requiredMessage || `${f.label} الزامی است`;
                        return;
                    }
                }

                if (v == null || v === '') return;

                // min / max
                if ((f.type === 'number' || f.type === 'decimal' || f.type === 'money')) {
                    const n = Number(v);
                    if (f.min != null && n < f.min) {
                        state.errors[f.name] = `حداقل مقدار ${f.min} است`;
                        return;
                    }
                    if (f.max != null && n > f.max) {
                        state.errors[f.name] = `حداکثر مقدار ${f.max} است`;
                        return;
                    }
                }

                // الگوی تاریخ
                if (f.type === 'date' && v) {
                    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(String(v))) {
                        state.errors[f.name] = 'قالب تاریخ: 1404/01/01';
                        return;
                    }
                }

                // pattern
                if (f.pattern && !f.pattern.test(String(v))) {
                    state.errors[f.name] = f.patternMessage || 'قالب نامعتبر';
                    return;
                }

                // custom validator
                if (typeof f.validate === 'function') {
                    const r = f.validate(v, state.values);
                    if (r !== true && r !== undefined) {
                        state.errors[f.name] = typeof r === 'string' ? r : 'مقدار نامعتبر';
                    }
                }
            });
        });

        // نمایش خطاها
        Object.entries(state.errors).forEach(([name, msg]) => {
            this._setFieldError(state, name, msg);
        });

        return Object.keys(state.errors).length === 0;
    },

    _setFieldError(state, name, msg) {
        const wrapper = state.container?.querySelector(`[data-field="${name}"]`);
        if (!wrapper) return;
        const errEl = wrapper.querySelector('.fb-error');
        if (errEl) errEl.textContent = msg;
        wrapper.classList.add('has-error');
    },

    _clearFieldError(state, name) {
        const wrapper = state.container?.querySelector(`[data-field="${name}"]`);
        if (!wrapper) return;
        wrapper.classList.remove('has-error');
        const errEl = wrapper.querySelector('.fb-error');
        if (errEl) errEl.textContent = '';
    },

    _clearErrors(state) {
        state.container?.querySelectorAll('.fb-field').forEach(w => w.classList.remove('has-error'));
        state.container?.querySelectorAll('.fb-error').forEach(e => e.textContent = '');
    },

    // ═══════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════
    _colClass(col) {
        if (col === 'full') return 'fb-col-full';
        if (col === 'half') return 'fb-col-half';
        if (col === 'third') return 'fb-col-third';
        if (col === 1 || col === 2 || col === 3) return `fb-col-${col}`;
        return '';
    },

    _displayNumber(v, type) {
        if (v == null || v === '') return '';
        const n = Number(v);
        if (isNaN(n)) return '';
        if (type === 'money') return n.toLocaleString('fa-IR');
        return String(n);
    },

    _parseNumber(str) {
        if (!str) return null;
        const norm = String(str)
            .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
            .replace(/[,\s٬،]/g, '');
        const n = parseFloat(norm);
        return isNaN(n) ? null : n;
    },

    _coerceValue(v, f) {
        if (v === '' || v == null) return null;
        if (f.type === 'number') return parseInt(v);
        if (f.type === 'decimal' || f.type === 'money') return parseFloat(v);
        return v;
    },
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
            .fb-form { display: flex; flex-direction: column; gap: 16px; }
            .fb-title { font-size: 16px; font-weight: 700; color: var(--text); }
            .fb-desc { font-size: 13px; color: var(--text-muted); margin-top: -8px; }

            .fb-section {
                background: #fff;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
            }
            .fb-section-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                background: #F9FAFB;
                border-bottom: 1px solid var(--border);
                cursor: pointer;
                user-select: none;
                transition: background 0.15s;
            }
            .fb-section-header:hover { background: #F3F4F6; }
            .fb-sec-icon { font-size: 16px; }
            .fb-sec-title { flex: 1; font-size: 14px; font-weight: 600; color: var(--text); }
            .fb-sec-arrow { font-size: 10px; color: var(--text-muted); transition: transform 0.2s; }
            .fb-section.collapsed .fb-sec-arrow { transform: rotate(-90deg); }

            .fb-section-body {
                padding: 18px;
                overflow: hidden;
                max-height: 3000px;
                transition: max-height 0.25s ease, padding 0.25s ease;
            }
            .fb-section.collapsed .fb-section-body {
                max-height: 0;
                padding: 0 18px;
            }

            .fb-grid {
                display: grid;
                gap: 16px;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .fb-grid[data-cols="1"] { grid-template-columns: 1fr; }
            .fb-grid[data-cols="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .fb-grid[data-cols="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }

            .fb-col-full { grid-column: 1 / -1; }
            .fb-col-half { grid-column: span 1; }
            .fb-col-third { grid-column: span 1; }

            .fb-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
            .fb-label {
                font-size: 13px;
                font-weight: 500;
                color: var(--text);
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .fb-required { color: var(--danger); font-weight: 700; }

            .fb-input {
                width: 100%;
                padding: 10px 14px;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                font-family: inherit;
                font-size: 14px;
                background: #fff;
                color: var(--text);
                transition: all 0.15s;
                min-height: 42px;
            }
            .fb-input:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 0 3px var(--primary-light);
            }
            .fb-input:disabled,
            .fb-input[readonly] { background: #F9FAFB; color: var(--text-muted); cursor: not-allowed; }
            .fb-num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; }
            textarea.fb-input { resize: vertical; min-height: 80px; line-height: 1.6; }

            .fb-readonly {
                padding: 10px 14px;
                background: #F9FAFB;
                border-radius: var(--radius-sm);
                font-size: 14px;
                color: var(--text);
                min-height: 42px;
                display: flex;
                align-items: center;
            }

            .fb-help { font-size: 11.5px; color: var(--text-muted); line-height: 1.5; }
            .fb-error { font-size: 11.5px; color: var(--danger); min-height: 0; line-height: 1.4; }

            .fb-field.has-error .fb-input,
            .fb-field.has-error .custom-select-trigger {
                border-color: var(--danger) !important;
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12) !important;
            }

            .fb-field-checkbox { flex-direction: row; align-items: center; }
            .fb-checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 13.5px;
                font-weight: 500;
                padding: 10px 14px;
                background: #F9FAFB;
                border-radius: var(--radius-sm);
                border: 1px solid var(--border);
                width: 100%;
                transition: all 0.15s;
            }
            .fb-checkbox-label:hover { border-color: var(--primary); background: var(--primary-light); }
            .fb-checkbox-label input { cursor: pointer; accent-color: var(--primary); }

            .fb-radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
            .fb-radio-item {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                padding: 8px 14px;
                border: 1.5px solid var(--border);
                border-radius: 8px;
                background: #fff;
                transition: all 0.15s;
            }
            .fb-radio-item:hover { border-color: var(--primary); background: var(--primary-light); }
            .fb-radio-item input { cursor: pointer; accent-color: var(--primary); }
            .fb-radio-item:has(input:checked) {
                border-color: var(--primary);
                background: var(--primary-light);
                color: var(--primary);
                font-weight: 600;
            }

            .fb-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                padding-top: 16px;
                border-top: 1px solid var(--border);
                flex-wrap: wrap;
            }
            .fb-footer-right { display: flex; gap: 10px; flex-wrap: wrap; }

            /* موبایل */
            @media (max-width: 768px) {
                .fb-grid,
                .fb-grid[data-cols="3"],
                .fb-grid[data-cols="4"] { grid-template-columns: 1fr; }
                .fb-col-half, .fb-col-third { grid-column: auto; }
                .fb-footer { flex-direction: column-reverse; align-items: stretch; }
                .fb-footer-right { flex-direction: column; }
                .fb-footer-right .btn { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }
};