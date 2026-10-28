/**
 * ⭐ PermissionTree — TreeView دسترسی‌ها
 * ساخت درخت منوها + عملیات برای ویرایش دسترسی گروه
 */
window.App = window.App || {};
window.App.Features = window.App.Features || {};

window.App.Features.PermissionTree = (function () {
    'use strict';

    const H = window.App.Helpers;

    // ═══════════════════════════════════════════
    //  Render Tree
    // ═══════════════════════════════════════════
    function render(container, menus, operations, currentPerms) {
        if (!container) return;

        const currentMenuNames = new Set(currentPerms?.menus || []);
        const currentOps = new Set((currentPerms?.operations || []).map(String));

        // ۱. گروه‌بندی منوها بر اساس Category
        const menusByCat = {};
        menus.forEach(m => {
            if (!menusByCat[m.category]) menusByCat[m.category] = [];
            menusByCat[m.category].push(m);
        });

        // ۲. ساخت HTML
        let html = '<div class="um-tree-wrapper">';

        // ─── بخش منوها ───
        html += `<div class="um-tree-category">
            <div class="um-tree-category-title">📄 منوهای سیستم</div>`;

        for (const cat in menusByCat) {
            html += `<div class="um-tree-category">`;
            html += `<div class="um-tree-category-title" style="color:#4338CA; font-size:12px; font-weight:700; margin-top:12px;">${H.esc(cat)}</div>`;

            // ساخت درخت
            const menuTree = buildMenuTree(menusByCat[cat]);
            html += renderTreeNodes(menuTree, currentMenuNames);

            html += `</div>`;
        }
        html += `</div>`;

        // ─── بخش عملیات ───
        html += `<div class="um-tree-category" style="margin-top:24px;">
            <div class="um-tree-category-title">⚙️ عملیات‌ها</div>
            <div class="um-tree-children" style="display:block; border:none; margin:0; padding:0;">
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:8px;">`;

        operations.forEach(op => {
            const isChecked = currentOps.has(String(op.code));
            html += `<label class="um-tree-label">
                <input type="checkbox" class="um-op-cb" value="${op.code}" ${isChecked ? 'checked' : ''}>
                <span>${H.esc(op.description || '')} <small style="color:#94A3B8;">(${op.code})</small></span>
            </label>`;
        });

        html += `   </div>
            </div>
        </div>`;

        html += '</div>'; // end um-tree-wrapper

        container.innerHTML = html;

        // ۳. Bind Events
        bindTreeEvents(container);
    }

    // ═══════════════════════════════════════════
    //  Build Menu Tree Structure
    // ═══════════════════════════════════════════
    function buildMenuTree(menuItems) {
        // items with subKey === '' are parents/standalone
        // items with subKey !== '' are children of menuKey

        const parents = {};
        const children = {};

        menuItems.forEach(m => {
            if (!m.subKey) {
                parents[m.menuKey] = { ...m, children: [] };
            } else {
                if (!children[m.menuKey]) children[m.menuKey] = [];
                children[m.menuKey].push(m);
            }
        });

        // اتصال فرزندان به والدین
        for (const pKey in parents) {
            if (children[pKey]) {
                parents[pKey].children = children[pKey];
            }
        }

        return Object.values(parents).sort((a, b) => a.sortOrder - b.sortOrder);
    }

    // ═══════════════════════════════════════════
    //  Render Tree Nodes (Recursive)
    // ═══════════════════════════════════════════
    function renderTreeNodes(nodes, currentMenuNames) {
        let html = '';
        nodes.forEach(node => {
            const hasChildren = node.children && node.children.length > 0;

            // بررسی وضعیت چک‌باکس
            const isChecked = node.windowsMenuName && currentMenuNames.has(node.windowsMenuName);

            // اگر فرزند داره، بررسی میکنیم که همه فرزندان چک هستن یا نه
            let allChildrenChecked = true;
            let anyChildChecked = false;
            if (hasChildren) {
                node.children.forEach(c => {
                    const cc = c.windowsMenuName && currentMenuNames.has(c.windowsMenuName);
                    if (cc) anyChildChecked = true;
                    else allChildrenChecked = false;
                });
            }

            // برای پرنت، اگه همه فرزندان چک باشن یا خودش چک باشه
            const parentChecked = isChecked || (hasChildren && allChildrenChecked);
            const indeterminate = hasChildren && !allChildrenChecked && anyChildChecked;

            html += `<div class="um-tree-node um-tree-node-parent" data-node-key="${node.menuKey}">`;

            // لیبل والد
            html += `<label class="um-tree-label">
                ${hasChildren ? `<span class="um-tree-arrow">▼</span>` : `<span class="um-tree-arrow" style="visibility:hidden;">▼</span>`}
                <input type="checkbox" class="um-menu-parent-cb" 
                       data-windowsname="${node.windowsMenuName || ''}"
                       ${parentChecked ? 'checked' : ''}
                       ${!node.requiresPermission ? 'data-noreq="1"' : ''}>
                <span style="font-weight:${hasChildren ? '600' : '400'}; color:${node.requiresPermission ? '#334155' : '#94A3B8'};">
                    ${H.esc(node.title)}
                    ${!node.requiresPermission ? ' <small style="font-size:10px; color:#94A3B8;">(همیشه فعال)</small>' : ''}
                </span>
            </label>`;

            // فرزندان
            if (hasChildren) {
                html += `<div class="um-tree-children">`;
                node.children.forEach(child => {
                    const childChecked = child.windowsMenuName && currentMenuNames.has(child.windowsMenuName);
                    html += `<label class="um-tree-label">
                        <input type="checkbox" class="um-menu-child-cb" 
                               data-windowsname="${child.windowsMenuName || ''}"
                               data-parent-key="${node.menuKey}"
                               ${childChecked ? 'checked' : ''}>
                        <span>${H.esc(child.title)}</span>
                    </label>`;
                });
                html += `</div>`;
            }

            html += `</div>`;
        });
        return html;
    }

    // ═══════════════════════════════════════════
    //  Bind Events (Parent-Child Check logic)
    // ═══════════════════════════════════════════
    function bindTreeEvents(container) {
        // آیکن‌های جمع/باز شدن
        container.querySelectorAll('.um-tree-arrow').forEach(arrow => {
            arrow.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.toggle('collapsed');
                const childrenDiv = this.closest('.um-tree-node').querySelector('.um-tree-children');
                if (childrenDiv) childrenDiv.classList.toggle('hidden');
            });
        });

        // چک باکس والد
        container.querySelectorAll('.um-menu-parent-cb').forEach(cb => {
            cb.addEventListener('change', function () {
                const node = this.closest('.um-tree-node');
                const children = node.querySelectorAll('.um-menu-child-cb');

                // اگر خودش unchecked شد، همه فرزندان unchecked
                // اگر checked شد، همه فرزندان checked
                children.forEach(c => {
                    c.checked = this.checked;
                });
            });
        });

        // چک باکس فرزند
        container.querySelectorAll('.um-menu-child-cb').forEach(cb => {
            cb.addEventListener('change', function () {
                const parentKey = this.getAttribute('data-parent-key');
                const parentNode = container.querySelector(`.um-tree-node[data-node-key="${parentKey}"]`);
                if (!parentNode) return;

                const parentCb = parentNode.querySelector('.um-menu-parent-cb');
                const allChildren = parentNode.querySelectorAll('.um-menu-child-cb');
                const allChecked = Array.from(allChildren).every(c => c.checked);

                parentCb.checked = allChecked;
            });
        });
    }

    // ═══════════════════════════════════════════
    //  Collect Selected Permissions
    // ═══════════════════════════════════════════
    function collect(container) {
        const menus = new Set();
        const operations = new Set();

        // منوها
        container.querySelectorAll('.um-menu-parent-cb, .um-menu-child-cb').forEach(cb => {
            if (!cb.checked) return;
            const wname = cb.getAttribute('data-windowsname');
            if (wname) menus.add(wname);
        });

        // عملیات‌ها
        container.querySelectorAll('.um-op-cb').forEach(cb => {
            if (cb.checked) operations.add(Number(cb.value));
        });

        return {
            menus: Array.from(menus),
            operations: Array.from(operations),
            sharhs: [],
            sarfasls: []
        };
    }

    return {
        render,
        collect
    };
})();