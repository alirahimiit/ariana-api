/* ═══════════════════════════════════════════════════
   Feature / User Management — جلسه ۶۱
   مدیریت کاربران، گروه‌ها و سطوح دسترسی
   ═══════════════════════════════════════════════════ */

window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.UserManagement = (function () {
    'use strict';

    const H = window.App.Helpers;
    const CS = window.App.UI.CustomSelect;

    let _groupsCache = [];
    let _allMenus = [];
    let _allOps = [];

    // ═══════════════════════════════════════════
    //  RENDER — صفحه اصلی
    // ═══════════════════════════════════════════
    async function render() {
        const c = document.getElementById('content');
        c.innerHTML = `<div class="loading"><div class="spinner"></div><p>در حال بارگذاری...</p></div>`;

        try {
            // Load lookups for groups, menus, ops
            [_groupsCache, _allMenus, _allOps] = await Promise.all([
                window.App.Http.get('/api/permission/groups').catch(() => []),
                window.App.Http.get('/api/permission/menus').catch(() => []),
                window.App.Http.get('/api/permission/operations').catch(() => [])
            ]);

            c.innerHTML = `
            <div class="um-wrapper">
                <div class="card">
                    <div class="um-tabs">
                        <button class="um-tab active" data-tab="users">👥 کاربران</button>
                        <button class="um-tab" data-tab="groups">👨‍👩‍👧‍👦 گروه‌ها</button>
                        <button class="um-tab" data-tab="permissions">🔐 سطوح دسترسی</button>
                    </div>
                    
                    <div id="umPaneUsers" class="um-pane active">
                        <div id="umUsersList"><div class="loading"><div class="spinner"></div></div></div>
                    </div>
                    
                    <div id="umPaneGroups" class="um-pane">
                        <div id="umGroupsList"><div class="loading"><div class="spinner"></div></div></div>
                    </div>
                    
                    <div id="umPanePermissions" class="um-pane">
                        <div class="card-title" style="margin-bottom:12px;">دسترسی‌های گروه</div>
                        <div class="um-form-group" style="max-width:300px;">
                            <label>انتخاب گروه کاربری</label>
                            <div id="umGroupSelectWrap"></div>
                        </div>
                        <div id="umTreeContainer"></div>
                        <div style="margin-top:16px; display:flex; justify-content:flex-end;">
                            <button class="btn btn-primary" id="umBtnSavePerms">💾 ذخیره دسترسی‌ها</button>
                        </div>
                    </div>
                </div>
            </div>`;

            // Bind Tabs
            document.querySelectorAll('.um-tab').forEach(btn => {
                btn.addEventListener('click', function () {
                    document.querySelectorAll('.um-tab').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.um-pane').forEach(p => p.classList.remove('active'));
                    this.classList.add('active');
                    document.getElementById(`umPane${this.dataset.tab.charAt(0).toUpperCase() + this.dataset.tab.slice(1)}`).classList.add('active');
                });
            });

            // Load Tab 1 & 2
            loadUsers();
            loadGroups();
            initPermissionsTab();

        } catch (err) {
            c.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    // ═══════════════════════════════════════════
    //  TAB 1: USERS
    // ═══════════════════════════════════════════
    async function loadUsers() {
        const container = document.getElementById('umUsersList');
        try {
            const users = await window.App.Http.get('/api/user/list') || [];

            let rows = users.map(u => `
                <tr>
                    <td class="num">${H.esc(u.userCode)}</td>
                    <td>${H.esc(u.name)}</td>
                    <td><span class="um-badge um-badge-info">${H.esc(u.groupName || '-')}</span></td>
                    <td class="text-center">
                        ${u.hasPasswordHash
                    ? '<span class="um-badge um-badge-success" title="BCrypt">🔐 امن</span>'
                    : '<span class="um-badge um-badge-warning" title="Plaintext">⚠️ قدیمی</span>'}
                    </td>
                    <td class="text-center">
                        <button class="um-btn-icon" onclick="App.Features.UserManagement.editUser(${u.usersId})" title="ویرایش">✏️</button>
                        <button class="um-btn-icon" onclick="App.Features.UserManagement.resetPassword(${u.usersId}, '${H.esc(u.userCode)}')" title="تغییر رمز">🔑</button>
                        <button class="um-btn-icon danger" onclick="App.Features.UserManagement.deleteUser(${u.usersId}, '${H.esc(u.userCode)}')" title="حذف">🗑️</button>
                    </td>
                </tr>
            `).join('');

            if (users.length === 0) {
                rows = `<tr><td colspan="5" class="text-center" style="padding:20px; color:#94A3B8;">کاربری یافت نشد</td></tr>`;
            }

            container.innerHTML = `
                <div style="margin-bottom:12px; display:flex; justify-content:flex-end;">
                    <button class="btn btn-primary btn-sm" onclick="App.Features.UserManagement.createUser()">➕ کاربر جدید</button>
                </div>
                <div class="table-wrapper">
                    <table class="um-table">
                        <thead>
                            <tr>
                                <th>کد کاربری</th>
                                <th>نام کامل</th>
                                <th>گروه</th>
                                <th class="text-center">وضعیت رمز</th>
                                <th class="text-center">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function createUser() {
        openUserModal(null);
    }

    async function editUser(id) {
        try {
            const u = await window.App.Http.get(`/api/user/${id}`);
            openUserModal(u);
        } catch (err) {
            window.App.toast('خطا در دریافت کاربر', 'error');
        }
    }

    function openUserModal(user) {
        const isEdit = !!user;

        // ساخت گزینه‌های CustomSelect برای گروه‌ها
        const groupOpts = _groupsCache.map(g => ({ value: String(g.userGroupCode), label: g.groupName }));
        const selectedGroup = user ? String(user.userGroupCode) : '';

        const html = `
            <div class="um-form-group">
                <label>کد کاربری</label>
                <input type="text" id="umUserCode" value="${user ? H.esc(user.userCode) : ''}" dir="ltr">
            </div>
            <div class="um-form-group">
                <label>نام کامل</label>
                <input type="text" id="umUserName" value="${user ? H.esc(user.name) : ''}">
            </div>
            <div class="um-form-group">
                <label>گروه کاربری</label>
                ${CS.html('umUserGroupSelect', groupOpts, selectedGroup, 'انتخاب گروه...')}
            </div>
            ${!isEdit ? `
            <div class="um-form-group">
                <label>رمز عبور</label>
                <input type="password" id="umUserPassword" dir="ltr">
            </div>` : ''}
            <div style="margin-top:24px; text-align:left;">
                <button class="btn btn-primary" id="umBtnSaveUser">💾 ذخیره</button>
            </div>
        `;

        window.App.openModal(isEdit ? 'ویرایش کاربر' : 'کاربر جدید', html);
        CS.bindAll(document.getElementById('modalBody'));

        document.getElementById('umBtnSaveUser').addEventListener('click', async () => {
            const code = document.getElementById('umUserCode').value.trim();
            const name = document.getElementById('umUserName').value.trim();
            const grp = CS.getValue('umUserGroupSelect');
            const pwd = document.getElementById('umUserPassword')?.value;

            if (!code || !name || !grp) return window.App.toast('لطفاً فیلدهای الزامی را پر کنید', 'warning');
            if (!isEdit && !pwd) return window.App.toast('رمز عبور را وارد کنید', 'warning');

            const payload = {
                userCode: code,
                name: name,
                userGroupCode: parseInt(grp)
            };

            try {
                if (isEdit) {
                    await window.App.Http.put(`/api/user/${user.usersId}`, payload);
                    window.App.toast('کاربر ویرایش شد', 'success');
                } else {
                    payload.password = pwd;
                    await window.App.Http.post('/api/user', payload);
                    window.App.toast('کاربر ایجاد شد', 'success');
                }
                window.App.closeModal();
                loadUsers();
            } catch (err) {
                // Http.api error toast handles itself
            }
        });
    }

    async function resetPassword(id, code) {
        const ok = await window.App.confirm(`آیا می‌خواهید رمز کاربر «${code}» را تغییر دهید؟`, { title: 'تغییر رمز' });
        if (!ok) return;

        const html = `
            <div class="um-form-group">
                <label>رمز عبور جدید</label>
                <input type="password" id="umNewPassword" dir="ltr">
            </div>
            <div style="margin-top:24px; text-align:left;">
                <button class="btn btn-primary" id="umBtnDoResetPwd">🔑 تغییر رمز</button>
            </div>
        `;
        window.App.openModal('تغییر رمز عبور', html);

        document.getElementById('umBtnDoResetPwd').addEventListener('click', async () => {
            const newPwd = document.getElementById('umNewPassword').value;
            if (!newPwd) return window.App.toast('رمز جدید را وارد کنید', 'warning');

            try {
                await window.App.Http.post(`/api/user/${id}/reset-password`, { newPassword: newPwd });
                window.App.toast('رمز با موفقیت تغییر کرد', 'success');
                window.App.closeModal();
                loadUsers(); // refresh to show hash status
            } catch (err) { }
        });
    }

    async function deleteUser(id, code) {
        const ok = await window.App.confirm(`آیا از حذف کاربر «${code}» مطمئن هستید؟`, { danger: true, okText: 'حذف' });
        if (!ok) return;

        try {
            await window.App.Http.del(`/api/user/${id}`);
            window.App.toast('کاربر حذف شد', 'success');
            loadUsers();
        } catch (err) { }
    }

    // ═══════════════════════════════════════════
    //  TAB 2: GROUPS
    // ═══════════════════════════════════════════
    async function loadGroups() {
        const container = document.getElementById('umGroupsList');
        try {
            // Refresh cache
            _groupsCache = await window.App.Http.get('/api/permission/groups') || [];

            let rows = _groupsCache.map(g => `
                <tr>
                    <td class="num">${g.userGroupCode}</td>
                    <td>${H.esc(g.groupName)}</td>
                    <td>${H.esc(g.description || '-')}</td>
                    <td class="text-center">${g.enVi ? '✅ بله' : '❌ خیر'}</td>
                    <td class="text-center"><span class="um-badge um-badge-info">${g.userCount} نفر</span></td>
                    <td class="text-center">
                        <button class="um-btn-icon" onclick="App.Features.UserManagement.editGroup(${g.userGroupCode})" title="ویرایش">✏️</button>
                        <button class="um-btn-icon danger" onclick="App.Features.UserManagement.deleteGroup(${g.userGroupCode}, '${H.esc(g.groupName)}', ${g.userCount})" title="حذف">🗑️</button>
                    </td>
                </tr>
            `).join('');

            if (_groupsCache.length === 0) {
                rows = `<tr><td colspan="6" class="text-center" style="padding:20px; color:#94A3B8;">گروهی یافت نشد</td></tr>`;
            }

            container.innerHTML = `
                <div style="margin-bottom:12px; display:flex; justify-content:flex-end;">
                    <button class="btn btn-primary btn-sm" onclick="App.Features.UserManagement.createGroup()">➕ گروه جدید</button>
                </div>
                <div class="table-wrapper">
                    <table class="um-table">
                        <thead>
                            <tr>
                                <th>کد</th>
                                <th>نام گروه</th>
                                <th>توضیحات</th>
                                <th class="text-center">منوها مخفی (EnVi)</th>
                                <th class="text-center">تعداد کاربر</th>
                                <th class="text-center">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    function createGroup() {
        openGroupModal(null);
    }

    async function editGroup(code) {
        const g = _groupsCache.find(x => x.userGroupCode === code);
        if (g) openGroupModal(g);
    }

    function openGroupModal(group) {
        const isEdit = !!group;
        const html = `
            <div class="um-form-group">
                <label>نام گروه</label>
                <input type="text" id="umGroupName" value="${group ? H.esc(group.groupName) : ''}">
            </div>
            <div class="um-form-group">
                <label>توضیحات</label>
                <textarea id="umGroupDesc" rows="2">${group ? H.esc(group.description || '') : ''}</textarea>
            </div>
            <div class="um-form-group">
                <label class="um-form-check">
                    <input type="checkbox" id="umGroupEnVi" ${group && group.enVi ? 'checked' : ''}>
                    <span>منوهای غیرمجاز کاملاً مخفی شوند (در غیر این صورت غیرفعال می‌شوند)</span>
                </label>
            </div>
            <div style="margin-top:24px; text-align:left;">
                <button class="btn btn-primary" id="umBtnSaveGroup">💾 ذخیره</button>
            </div>
        `;

        window.App.openModal(isEdit ? 'ویرایش گروه' : 'گروه جدید', html);

        document.getElementById('umBtnSaveGroup').addEventListener('click', async () => {
            const name = document.getElementById('umGroupName').value.trim();
            const desc = document.getElementById('umGroupDesc').value.trim();
            const enVi = document.getElementById('umGroupEnVi').checked;

            if (!name) return window.App.toast('نام گروه الزامی است', 'warning');

            const payload = {
                userGroupCode: isEdit ? group.userGroupCode : 0,
                groupName: name,
                description: desc,
                enVi: enVi
            };

            try {
                await window.App.Http.post('/api/permission/groups', payload);
                window.App.toast('گروه ذخیره شد', 'success');
                window.App.closeModal();
                loadGroups(); // refresh
            } catch (err) { }
        });
    }

    async function deleteGroup(code, name, userCount) {
        let msg = `آیا از حذف گروه «${name}» مطمئن هستید؟`;
        if (userCount > 0) {
            msg += `\n\n⚠️ هشدار: این گروه دارای ${userCount} کاربر است. با حذف گروه، تمامی این کاربران نیز حذف خواهند شد!`;
        }

        const ok = await window.App.confirm(msg, { danger: true, okText: 'حذف گروه' });
        if (!ok) return;

        try {
            await window.App.Http.del(`/api/permission/groups/${code}`);
            window.App.toast('گروه حذف شد', 'success');
            loadGroups();
            loadUsers(); // Refresh users because they might be deleted
        } catch (err) { }
    }

    // ═══════════════════════════════════════════
    //  TAB 3: PERMISSIONS
    // ═══════════════════════════════════════════
    function initPermissionsTab() {
        const groupOpts = _groupsCache.map(g => ({ value: String(g.userGroupCode), label: g.groupName }));

        document.getElementById('umGroupSelectWrap').innerHTML = CS.html('umPermGroupSelect', groupOpts, '', 'انتخاب کنید...');
        CS.bind('umPermGroupSelect', (val) => {
            loadPermissionsForGroup(Number(val));
        });

        document.getElementById('umBtnSavePerms').addEventListener('click', async () => {
            const code = CS.getValue('umPermGroupSelect');
            if (!code) return window.App.toast('ابتدا یک گروه انتخاب کنید', 'warning');

            const container = document.getElementById('umTreeContainer');
            const payload = window.App.Features.PermissionTree.collect(container);

            try {
                await window.App.Http.put(`/api/permission/groups/${code}`, payload);
                window.App.toast('سطوح دسترسی با موفقیت ذخیره شد', 'success');
            } catch (err) { }
        });
    }

    async function loadPermissionsForGroup(code) {
        const container = document.getElementById('umTreeContainer');
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const perms = await window.App.Http.get(`/api/permission/groups/${code}`);
            window.App.Features.PermissionTree.render(container, _allMenus, _allOps, perms);
        } catch (err) {
            container.innerHTML = `<div class="error-box">${H.esc(err.message)}</div>`;
        }
    }

    // ═══════════════════════════════════════════
    //  EXPORT
    // ═══════════════════════════════════════════
    return {
        render,
        createUser, editUser, resetPassword, deleteUser,
        createGroup, editGroup, deleteGroup
    };
})();