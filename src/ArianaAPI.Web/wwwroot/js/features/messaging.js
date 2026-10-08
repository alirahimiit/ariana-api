/* ═══════════════════════════════════════════════════
   Ariana - Support Chat (Relay Web) — Per-User Isolation
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.Messaging = {

    _pollTimer: null,
    _fabPollTimer: null,
    _lastMsgId: 0,
    _lastMessagesJson: '',
    _popupOpen: false,
    _escHandler: null,

    // ═══════════════════════════════════════════
    //  SESSION MANAGEMENT (Per User)
    // ═══════════════════════════════════════════
    _getSessionKey() {
        const u = window.App.state?.user || {};
        const orgId = u.orgId || 0;
        const fyId = u.fyId || 0;
        const userId = u.userId || 0;
        return `ariana_support_session_${orgId}_${fyId}_${userId}`;
    },

    _getReadKey() {
        const u = window.App.state?.user || {};
        const orgId = u.orgId || 0;
        const fyId = u.fyId || 0;
        const userId = u.userId || 0;
        return `ariana_support_last_read_${orgId}_${fyId}_${userId}`;
    },

    _getSessionId() {
        const key = this._getSessionKey();
        let sid = localStorage.getItem(key);
        if (!sid) {
            sid = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
            localStorage.setItem(key, sid);
        }
        return sid;
    },

    _getUserId() {
        const u = window.App.state?.user || {};
        return u.userId || null;
    },

    _getUserName() {
        const u = window.App.state?.user || {};
        return u.fullName || u.username || null;
    },

    // ═══════════════════════════════════════════
    //  FAB
    // ═══════════════════════════════════════════
    initFab() {
        document.getElementById('msgFab')?.remove();
        document.getElementById('msgPopupOverlay')?.remove();

        const fab = document.createElement('button');
        fab.id = 'msgFab';
        fab.className = 'msg-fab';
        fab.type = 'button';
        fab.title = 'تماس با پشتیبان';
        fab.innerHTML = `
            <span class="msg-fab-icon">💬</span>
            <span class="msg-fab-label">تماس با پشتیبان</span>
            <span class="msg-fab-badge" id="msgFabBadge" style="display:none;">0</span>
        `;
        document.body.appendChild(fab);

        fab.addEventListener('click', () => this.openPopup());

        this._startFabPolling();
    },

    _startFabPolling() {
        this._stopFabPolling();
        this._updateFabBadge();
        this._fabPollTimer = setInterval(() => {
            if (!document.getElementById('msgFab')) {
                this._stopFabPolling();
                return;
            }
            this._updateFabBadge();
        }, 10000);
    },

    _stopFabPolling() {
        if (this._fabPollTimer) {
            clearInterval(this._fabPollTimer);
            this._fabPollTimer = null;
        }
    },

    async _updateFabBadge() {
        try {
            const sessionId = this._getSessionId();
            const lastRead = parseInt(localStorage.getItem(this._getReadKey()) || '0');

            const r = await this._pollApi(sessionId, 0);
            const items = r.items || [];
            const unread = items.filter(m => m.direction === 2 && m.id > lastRead).length;

            const badge = document.getElementById('msgFabBadge');
            if (!badge) return;

            if (unread > 0) {
                badge.textContent = unread > 99 ? '99+' : unread;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        } catch { /* silent */ }
    },

    // ═══════════════════════════════════════════
    //  POPUP
    // ═══════════════════════════════════════════
    openPopup() {
        if (this._popupOpen) return;

        const overlay = document.createElement('div');
        overlay.id = 'msgPopupOverlay';
        overlay.className = 'msg-popup-overlay';
        overlay.innerHTML = `
            <div class="msg-popup-panel support-chat-panel" id="msgPopupPanel">
                <div class="msg-popup-header">
                    <div class="msg-popup-title">
                        <span class="msg-popup-header-icon">🎧</span>
                        <div>
                            <div>پشتیبانی آریانا</div>
                            <div class="msg-popup-sub">معمولاً در کمتر از ۱ ساعت پاسخ می‌دهیم</div>
                        </div>
                    </div>
                    <button class="msg-popup-close" id="msgPopupClose" title="بستن">✕</button>
                </div>
                <div class="messaging-messages" id="msgMessages">
                    <div class="messaging-empty">
                        <div class="messaging-empty-icon">💬</div>
                        <p>پیامی بفرستید تا پشتیبانی پاسخ دهد</p>
                    </div>
                </div>
                <div class="messaging-send-box">
                    <textarea id="msgInput" placeholder="متن پیام..." rows="1"></textarea>
                    <button class="btn btn-primary" id="msgSendBtn">ارسال ✉️</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => overlay.classList.add('visible'));

        this._popupOpen = true;
        this._lastMessagesJson = '';

        document.getElementById('msgPopupClose').addEventListener('click', () => this.closePopup());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closePopup();
        });

        this._escHandler = (e) => {
            if (e.key === 'Escape') this.closePopup();
        };
        document.addEventListener('keydown', this._escHandler);

        this._bindEvents();
        this._loadMessages();
        this._startPolling();

        setTimeout(() => this._markRead(), 1500);
    },

    closePopup() {
        const overlay = document.getElementById('msgPopupOverlay');
        if (!overlay) return;

        overlay.classList.remove('visible');
        document.body.style.overflow = '';
        this._popupOpen = false;

        this._stopPolling();
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }

        this._markRead();

        setTimeout(() => {
            overlay.remove();
            this._updateFabBadge();
        }, 250);
    },

    _markRead() {
        const items = this._lastMessagesJson ? JSON.parse(this._lastMessagesJson) : [];
        if (items.length > 0) {
            const maxId = Math.max(...items.map(m => m.id));
            localStorage.setItem(this._getReadKey(), maxId.toString());
        }
    },

    // ═══════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════
    _bindEvents() {
        const self = this;
        const input = document.getElementById('msgInput');
        const sendBtn = document.getElementById('msgSendBtn');

        input?.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        input?.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                self._sendMessage();
            }
        });

        sendBtn?.addEventListener('click', () => self._sendMessage());
        setTimeout(() => input?.focus(), 100);
    },

    // ═══════════════════════════════════════════
    //  API
    // ═══════════════════════════════════════════
    async _sendApi(sessionId, userId, userName, message) {
        const r = await fetch('/api/local-support/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, userId, userName, message })
        });
        if (!r.ok) {
            const err = await r.json().catch(() => ({ message: 'خطا' }));
            throw new Error(err.message || 'خطا');
        }
        return await r.json();
    },

    async _pollApi(sessionId, sinceId) {
        const r = await fetch('/api/local-support/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, sinceId })
        });
        if (!r.ok) return { items: [] };
        return await r.json();
    },

    // ═══════════════════════════════════════════
    //  MESSAGES
    // ═══════════════════════════════════════════
    async _loadMessages() {
        try {
            const sessionId = this._getSessionId();
            const r = await this._pollApi(sessionId, 0);
            const items = r.items || [];

            const json = JSON.stringify(items);
            if (json !== this._lastMessagesJson) {
                this._lastMessagesJson = json;
                this._renderMessages(items);
                if (items.length > 0) {
                    this._lastMsgId = items[items.length - 1].id;
                }
            }
        } catch (err) {
            console.error('loadMessages error', err);
        }
    },

    _renderMessages(items) {
        const box = document.getElementById('msgMessages');
        if (!box) return;

        if (items.length === 0) {
            box.innerHTML = `<div class="messaging-empty">
                <div class="messaging-empty-icon">💬</div>
                <p>پیامی بفرستید تا پشتیبانی پاسخ دهد</p>
            </div>`;
            return;
        }

        box.innerHTML = items.map(m => {
            const isOut = m.direction === 1;
            const time = m.createdAt ? this._formatTime(m.createdAt) : '';
            const text = this._escapeHtml(m.message).replace(/\n/g, '<br>');

            return `
                <div class="msg-bubble-row ${isOut ? 'out' : 'in'}">
                    <div class="msg-bubble ${isOut ? 'out' : 'in'}">
                        <div class="msg-text">${text}</div>
                        <div class="msg-time">${time}</div>
                    </div>
                </div>`;
        }).join('');

        box.scrollTop = box.scrollHeight;
    },

    // ═══════════════════════════════════════════
    //  SEND
    // ═══════════════════════════════════════════
    async _sendMessage() {
        const input = document.getElementById('msgInput');
        const sendBtn = document.getElementById('msgSendBtn');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        const sessionId = this._getSessionId();
        const userId = this._getUserId();
        const userName = this._getUserName();

        sendBtn.disabled = true;
        input.disabled = true;
        const orig = sendBtn.textContent;
        sendBtn.textContent = '⏳';

        try {
            await this._sendApi(sessionId, userId, userName, text);
            input.value = '';
            input.style.height = 'auto';
            this._lastMessagesJson = '';
            await this._loadMessages();
        } catch (err) {
            window.App.toast?.(err.message || 'خطا در ارسال پیام', 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = orig;
            input.disabled = false;
            input.focus();
        }
    },

    // ═══════════════════════════════════════════
    //  POLLING
    // ═══════════════════════════════════════════
    _startPolling() {
        this._stopPolling();
        this._pollTimer = setInterval(() => {
            if (!document.getElementById('msgMessages')) {
                this._stopPolling();
                return;
            }
            this._loadMessages();
        }, 4000);
    },

    _stopPolling() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
    },

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════
    _formatTime(dateStr) {
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const sameDay = d.toDateString() === now.toDateString();
            const time = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            if (sameDay) return time;
            return d.toLocaleDateString('fa-IR') + ' — ' + time;
        } catch { return ''; }
    },

    _escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};