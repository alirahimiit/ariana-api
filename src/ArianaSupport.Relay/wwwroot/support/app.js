/* ═══════════════════════════════════════════════════
   Ariana Support Panel
   ═══════════════════════════════════════════════════ */

let tickets = [];
let activeTicket = null;   // { installId, sessionId, installName }
let lastMsgId = 0;
let pollTimer = null;
let lastTicketsJson = '';

const $ = (s) => document.querySelector(s);

// ═══ API helper ═══
async function api(path, options = {}) {
    const r = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (r.status === 401) {
        window.location.href = 'login.html';
        throw new Error('unauthorized');
    }
    if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || 'خطا');
    }
    return r.json();
}

// ═══ Init ═══
document.addEventListener('DOMContentLoaded', () => {
    $('#refreshBtn').addEventListener('click', () => loadTickets(true));
    $('#logoutBtn').addEventListener('click', logout);
    $('#sendBtn').addEventListener('click', sendReply);

    const input = $('#replyInput');
    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendReply();
        }
    });

    loadTickets();
    updateUnread();
    pollTimer = setInterval(() => {
        loadTickets();
        updateUnread();
        if (activeTicket) loadMessages(activeTicket.installId, activeTicket.sessionId, false);
    }, 5000);
});

async function logout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => { });
    window.location.href = 'login.html';
}

// ═══ Tickets ═══
async function loadTickets(showToast = false) {
    try {
        const r = await api('/api/admin/tickets');
        const json = JSON.stringify(r.items);
        if (json !== lastTicketsJson) {
            lastTicketsJson = json;
            tickets = r.items;
            renderTickets();
        }
    } catch (e) {
        if (showToast) alert('خطا در بارگذاری تیکت‌ها');
    }
}

function renderTickets() {
    const box = $('#ticketList');
    if (!tickets.length) {
        box.innerHTML = '<div class="loading">هنوز پیامی نیست</div>';
        return;
    }
    box.innerHTML = tickets.map(t => {
        const active = activeTicket &&
            activeTicket.installId === t.installId &&
            activeTicket.sessionId === t.sessionId;
        const unread = t.unreadCount > 0
            ? `<span class="ticket-badge">${t.unreadCount}</span>` : '';
        const hasUnread = t.unreadCount > 0 ? 'has-unread' : '';
        const cls = `${active ? 'active' : ''} ${hasUnread}`;
        return `
            <div class="ticket-item ${cls}" data-install="${t.installId}" data-session="${t.sessionId}">
                <div class="ticket-name">
                    <span>${escapeHtml(t.installName)}</span>
                    ${unread}
                </div>
                <div class="ticket-preview">${escapeHtml(t.lastMessage || '')}</div>
                <div class="ticket-time">${formatTime(t.lastAt)}</div>
            </div>`;
    }).join('');

    box.querySelectorAll('.ticket-item').forEach(el => {
        el.addEventListener('click', () => {
            const installId = parseInt(el.dataset.install);
            const sessionId = el.dataset.session;
            const t = tickets.find(x => x.installId === installId && x.sessionId === sessionId);
            selectTicket(installId, sessionId, t?.installName || '');
        });
    });
}

async function selectTicket(installId, sessionId, installName) {
    activeTicket = { installId, sessionId, installName };
    lastMsgId = 0;

    $('#chatHeader').innerHTML = `
        <div>
            <div class="chat-ticket-title">${escapeHtml(installName)}</div>
            <div class="chat-ticket-meta">#${installId} / ${sessionId.substring(0, 12)}</div>
        </div>`;
    $('#replyInput').disabled = false;
    $('#sendBtn').disabled = false;

    await api(`/api/admin/tickets/${installId}/${sessionId}/read`, { method: 'POST' }).catch(() => { });
    await loadMessages(installId, sessionId, true);
    renderTickets();
    updateUnread();
    $('#replyInput').focus();
}

// ═══ Messages ═══
async function loadMessages(installId, sessionId, scroll) {
    try {
        const r = await api(`/api/admin/tickets/${installId}/${sessionId}/messages?sinceId=0`);
        const items = r.items || [];
        renderMessages(items);
        lastMsgId = items.length ? items[items.length - 1].id : 0;
        if (scroll) scrollToBottom();
    } catch (e) { /* silent */ }
}

function renderMessages(items) {
    const box = $('#chatMessages');
    if (!items.length) {
        box.innerHTML = '<div class="chat-empty"><div class="chat-empty-icon">📭</div><p>پیامی نیست</p></div>';
        return;
    }
    box.innerHTML = items.map(m => {
        const isIn = m.direction === 1;
        const time = formatTime(m.createdAt);
        const sender = isIn
            ? `<div class="msg-sender">${escapeHtml(m.userName || 'کاربر')}</div>` : '';
        return `
            <div class="msg-row ${isIn ? 'in' : 'out'}">
                <div class="msg-bubble ${isIn ? 'in' : 'out'}">
                    ${sender}
                    <div>${escapeHtml(m.message).replace(/\n/g, '<br>')}</div>
                    <div class="msg-time">${time}</div>
                </div>
            </div>`;
    }).join('');
}

// ═══ Send Reply ═══
async function sendReply() {
    if (!activeTicket) return;
    const input = $('#replyInput');
    const text = input.value.trim();
    if (!text) return;

    const btn = $('#sendBtn');
    btn.disabled = true;
    input.disabled = true;

    try {
        await api(`/api/admin/tickets/${activeTicket.installId}/${activeTicket.sessionId}/reply`, {
            method: 'POST',
            body: JSON.stringify({ message: text })
        });
        input.value = '';
        input.style.height = 'auto';
        await loadMessages(activeTicket.installId, activeTicket.sessionId, true);
    } catch (e) {
        alert('خطا در ارسال: ' + e.message);
    } finally {
        btn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

// ═══ Unread ═══
async function updateUnread() {
    try {
        const r = await api('/api/admin/unread-count');
        const badge = $('#unreadBadge');
        if (r.count > 0) {
            badge.textContent = r.count > 99 ? '99+' : r.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (e) { /* silent */ }
}

// ═══ Helpers ═══
function scrollToBottom() {
    const box = $('#chatMessages');
    box.scrollTop = box.scrollHeight;
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        const time = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        if (sameDay) return time;
        return d.toLocaleDateString('fa-IR', { month: '2-digit', day: '2-digit' }) + ' — ' + time;
    } catch { return ''; }
}