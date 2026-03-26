/* ══════════════════════════════════════════════
   INVITADOS — Guest Management with Groups,
   Familias (sub-groups), Multi-select & DnD
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://lpatzgviideumccecfew.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY2MDMsImV4cCI6MjA5MDA5MjYwM30.jWQrW6FqArq87w50YALA9CUxahyPzwHBQLd9kI7U4qY';

    let guests = [];
    let groups = JSON.parse(localStorage.getItem('wedding_groups') || '[]');
    let guestGroups = JSON.parse(localStorage.getItem('wedding_guest_groups') || '{}');
    let guestFamilias = JSON.parse(localStorage.getItem('wedding_guest_familias') || '{}');
    let selected = new Set();

    // Match awareness: check if a real guest is matched with a virtual
    function isConfirmed(guestId) {
        const matches = JSON.parse(localStorage.getItem('wedding_matches') || '{}');
        return Object.values(matches).includes(String(guestId));
    }

    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNjYwMywiZXhwIjoyMDkwMDkyNjAzfQ.-CM_Wku1-fWqtbz8flSb3MFabrxFnoED047cT81hgAs';

    // ── Supabase helpers ──
    function authHeaders() {
        return {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        };
    }

    async function fetchGuests() {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/guests?order=created_at.desc`, { headers: authHeaders() });
            const data = await res.json();
            if (Array.isArray(data)) guests = data;
        } catch (err) { guests = []; }
    }

    async function upsertGuest(guest) {
        const isEdit = !!guest.id;
        const method = isEdit ? 'PATCH' : 'POST';
        const url = isEdit ? `${SUPABASE_URL}/rest/v1/guests?id=eq.${guest.id}` : `${SUPABASE_URL}/rest/v1/guests`;
        const body = { ...guest };
        // Never send id in body — Supabase uses it in the URL for PATCH
        delete body.id;
        const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
        return res.json();
    }

    async function deleteGuest(id) {
        await fetch(`${SUPABASE_URL}/rest/v1/guests?id=eq.${id}`, { method: 'DELETE', headers: authHeaders() });
    }

    function saveGroups() { localStorage.setItem('wedding_groups', JSON.stringify(groups)); }
    function saveGuestGroups() { localStorage.setItem('wedding_guest_groups', JSON.stringify(guestGroups)); }
    function saveGuestFamilias() { localStorage.setItem('wedding_guest_familias', JSON.stringify(guestFamilias)); }

    // ── Get all familia members ──
    function getFamiliaMembers(guestId) {
        const fam = guestFamilias[guestId];
        if (!fam) return [String(guestId)];
        return guests.filter(g => guestFamilias[g.id] === fam).map(g => String(g.id));
    }

    // ── Get IDs to move (selected or familia block) ──
    function getIdsToMove(triggerId) {
        if (selected.size > 0 && selected.has(String(triggerId))) {
            return [...selected];
        }
        return getFamiliaMembers(triggerId);
    }

    // ── Selection toolbar ──
    function updateToolbar() {
        const bar = document.getElementById('selection-toolbar');
        const count = document.getElementById('sel-count');
        if (selected.size > 0) {
            bar.classList.add('active');
            count.textContent = selected.size;
        } else {
            bar.classList.remove('active');
        }
    }

    function toggleSelect(guestId) {
        const id = String(guestId);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        // Update checkbox visuals
        document.querySelectorAll('.inv-guest').forEach(row => {
            const cb = row.querySelector('.inv-guest__check');
            if (cb) cb.checked = selected.has(row.dataset.guestId);
            row.classList.toggle('inv-guest--selected', selected.has(row.dataset.guestId));
        });
        updateToolbar();
    }

    function clearSelection() {
        selected.clear();
        document.querySelectorAll('.inv-guest--selected').forEach(r => r.classList.remove('inv-guest--selected'));
        document.querySelectorAll('.inv-guest__check').forEach(cb => cb.checked = false);
        updateToolbar();
    }

    // ── Render ──
    function render() {
        document.getElementById('total-count').textContent = guests.length;
        const container = document.getElementById('groups-container');
        container.innerHTML = '';

        groups.forEach(group => {
            const groupGuests = guests.filter(g => guestGroups[g.id] === group.id);
            const section = document.createElement('div');
            section.className = 'inv-group';
            section.style.borderLeftColor = group.color || '#C9A96E';

            section.innerHTML = `
                <div class="inv-group__header">
                    <div style="display:flex;align-items:center;gap:12px">
                        <h3 class="inv-group__title">${esc(group.name)}</h3>
                        <span class="inv-group__count">${groupGuests.length}</span>
                    </div>
                    <div class="inv-group__actions">
                        <button class="inv-group__btn inv-group__btn--delete" title="Eliminar grupo">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </div>
                <div class="inv-group__list"></div>
            `;

            const list = section.querySelector('.inv-group__list');
            renderGuestsInList(list, groupGuests);

            if (groupGuests.length === 0) {
                list.innerHTML = '<div class="inv-empty">Arrastra invitados aquí</div>';
            }

            section.querySelector('.inv-group__btn--delete').addEventListener('click', () => {
                if (!confirm(`¿Eliminar el grupo "${group.name}"?`)) return;
                Object.keys(guestGroups).forEach(gid => {
                    if (guestGroups[gid] === group.id) delete guestGroups[gid];
                });
                groups = groups.filter(gr => gr.id !== group.id);
                saveGroups(); saveGuestGroups(); render();
            });

            setupDropZone(section, group.id);
            container.appendChild(section);
        });

        // Ungrouped
        const ungrouped = guests.filter(g => !guestGroups[g.id]);
        document.getElementById('ungrouped-count').textContent = ungrouped.length;
        const ungroupedList = document.getElementById('ungrouped-list');
        ungroupedList.innerHTML = '';

        if (ungrouped.length === 0 && groups.length > 0 && guests.length > 0) {
            ungroupedList.innerHTML = '<div class="inv-empty">Todos los invitados están asignados a un grupo</div>';
        } else if (guests.length === 0) {
            ungroupedList.innerHTML = '<div class="inv-empty">Aún no hay invitados registrados</div>';
        } else {
            renderGuestsInList(ungroupedList, ungrouped);
        }

        const ungroupedSection = document.getElementById('ungrouped-section');
        setupDropZone(ungroupedSection, null);
        ungroupedSection.style.display = (groups.length === 0 && ungrouped.length === 0) ? 'none' : '';

        updateToolbar();
    }

    // ── Render guests grouped by familia within a list ──
    function renderGuestsInList(listEl, guestList) {
        // Sort: group by familia, then ungrouped
        const familias = {};
        const noFamilia = [];

        guestList.forEach(g => {
            const fam = guestFamilias[g.id];
            if (fam) {
                if (!familias[fam]) familias[fam] = [];
                familias[fam].push(g);
            } else {
                noFamilia.push(g);
            }
        });

        // Render familia blocks
        Object.entries(familias).forEach(([famName, members]) => {
            const block = document.createElement('div');
            block.className = 'inv-familia';
            block.innerHTML = `<div class="inv-familia__label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                ${esc(famName)}
            </div>`;
            members.forEach(g => block.appendChild(createGuestRow(g)));
            listEl.appendChild(block);
        });

        // Render loose guests
        noFamilia.forEach(g => listEl.appendChild(createGuestRow(g)));
    }

    function createGuestRow(guest) {
        const row = document.createElement('div');
        row.className = 'inv-guest' + (selected.has(String(guest.id)) ? ' inv-guest--selected' : '');
        row.dataset.guestId = String(guest.id);
        row.draggable = true;

        const initials = ((guest.nombre || '')[0] || '') + ((guest.apellidos || '')[0] || '');
        const menuLabel = guest.menu ? guest.menu.charAt(0).toUpperCase() + guest.menu.slice(1) : '';
        const busLabel = guest.autobus === 'no' ? 'Propio' : guest.autobus === 'plaza-castilla' ? 'P. Castilla' : guest.autobus === 'alcobendas' ? 'Alcobendas' : '';
        const famName = guestFamilias[guest.id] || '';

        let badges = '';
        if (guest.menu) badges += `<span class="inv-guest__badge inv-guest__badge--${guest.menu}">${menuLabel}</span>`;
        if (guest.autobus && guest.autobus !== 'no') badges += `<span class="inv-guest__badge inv-guest__badge--bus">${busLabel}</span>`;
        else if (guest.autobus === 'no') badges += `<span class="inv-guest__badge inv-guest__badge--car">Propio</span>`;
        if (guest.alergias) badges += `<span class="inv-guest__badge inv-guest__badge--allergy">${esc(guest.alergias)}</span>`;

        const confirmed = isConfirmed(guest.id);

        row.innerHTML = `
            <input type="checkbox" class="inv-guest__check" ${selected.has(String(guest.id)) ? 'checked' : ''}>
            <div class="inv-guest__drag" title="Arrastra para mover">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
            </div>
            <div class="inv-guest__avatar ${confirmed ? 'inv-guest__avatar--confirmed' : ''}">${initials.toUpperCase()}</div>
            <div class="inv-guest__info">
                <div class="inv-guest__name">${esc(guest.nombre)} ${esc(guest.apellidos)}</div>
                <div class="inv-guest__meta">
                    ${famName ? `<span class="inv-guest__fam-tag">${esc(famName)}</span>` : ''}
                    ${guest.created_at ? `<span>${new Date(guest.created_at).toLocaleDateString('es-ES')}</span>` : ''}
                </div>
            </div>
            <div class="inv-guest__badges">${badges}</div>
            <button class="inv-guest__edit" title="Editar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="inv-guest__delete" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        `;

        // Checkbox
        row.querySelector('.inv-guest__check').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSelect(guest.id);
        });

        // Delete
        row.querySelector('.inv-guest__delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`¿Eliminar a ${guest.nombre} ${guest.apellidos}?`)) return;
            await deleteGuest(guest.id);
            delete guestGroups[guest.id];
            delete guestFamilias[guest.id];
            selected.delete(String(guest.id));
            saveGuestGroups(); saveGuestFamilias();
            await fetchGuests(); render();
        });

        // Edit
        row.querySelector('.inv-guest__edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(guest);
        });

        // Drag — moves selected or whole familia
        row.addEventListener('dragstart', (e) => {
            const ids = getIdsToMove(guest.id);
            e.dataTransfer.setData('application/json', JSON.stringify(ids));
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('inv-guest--dragging');
            // Mark all dragged rows
            ids.forEach(id => {
                const el = document.querySelector(`.inv-guest[data-guest-id="${id}"]`);
                if (el) el.classList.add('inv-guest--dragging');
            });
            setTimeout(() => {
                document.querySelectorAll('.inv-group').forEach(g => g.classList.add('inv-group--drop-ready'));
            }, 0);
        });

        row.addEventListener('dragend', () => {
            document.querySelectorAll('.inv-guest--dragging').forEach(r => r.classList.remove('inv-guest--dragging'));
            document.querySelectorAll('.inv-group').forEach(g => g.classList.remove('inv-group--drop-ready', 'inv-group--drag-over'));
        });

        return row;
    }

    // ── Drop zones ──
    function setupDropZone(element, groupId) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            element.classList.add('inv-group--drag-over');
        });
        element.addEventListener('dragleave', (e) => {
            if (!element.contains(e.relatedTarget)) element.classList.remove('inv-group--drag-over');
        });
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('inv-group--drag-over');
            let ids = [];
            try { ids = JSON.parse(e.dataTransfer.getData('application/json')); } catch (_) {}
            if (!ids.length) return;

            ids.forEach(id => {
                if (groupId) guestGroups[id] = groupId;
                else delete guestGroups[id];
            });
            saveGuestGroups();
            clearSelection();
            render();
        });
    }

    function getGroupName(guestId) {
        const gid = guestGroups[guestId];
        if (!gid) return '';
        const group = groups.find(g => g.id === gid);
        return group ? group.name : '';
    }

    // ── Populate selects ──
    function populateGroupSelect(selectedGroupId) {
        const sel = document.getElementById('f-grupo');
        sel.innerHTML = '<option value="">Sin grupo</option>';
        groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            if (g.id === selectedGroupId) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function populateFamiliaDatalist() {
        const dl = document.getElementById('familias-list');
        if (!dl) return;
        const unique = [...new Set(Object.values(guestFamilias).filter(Boolean))];
        dl.innerHTML = unique.map(f => `<option value="${esc(f)}">`).join('');
    }

    // ── Guest Modal ──
    function openAddModal() {
        document.getElementById('modal-title').textContent = 'Nuevo invitado';
        document.getElementById('guest-id').value = '';
        document.getElementById('f-nombre').value = '';
        document.getElementById('f-apellidos').value = '';
        document.getElementById('f-autobus').value = '';
        document.getElementById('f-menu').value = '';
        document.getElementById('f-alergias').value = '';
        document.getElementById('f-familia').value = '';
        document.getElementById('modal-delete').style.display = 'none';
        populateGroupSelect('');
        populateFamiliaDatalist();
        document.getElementById('guest-modal').classList.add('active');
        document.getElementById('f-nombre').focus();
    }

    function openEditModal(guest) {
        document.getElementById('modal-title').textContent = 'Editar invitado';
        document.getElementById('guest-id').value = guest.id;
        document.getElementById('f-nombre').value = guest.nombre || '';
        document.getElementById('f-apellidos').value = guest.apellidos || '';
        document.getElementById('f-autobus').value = guest.autobus || '';
        document.getElementById('f-menu').value = guest.menu || '';
        document.getElementById('f-alergias').value = guest.alergias || '';
        document.getElementById('f-familia').value = guestFamilias[guest.id] || '';
        document.getElementById('modal-delete').style.display = 'inline-flex';
        populateGroupSelect(guestGroups[guest.id] || '');
        populateFamiliaDatalist();
        document.getElementById('guest-modal').classList.add('active');
        document.getElementById('f-nombre').focus();
    }

    function closeGuestModal() {
        document.getElementById('guest-modal').classList.remove('active');
    }

    // Save guest
    document.getElementById('guest-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('guest-id').value;
        const data = {
            nombre: document.getElementById('f-nombre').value.trim(),
            apellidos: document.getElementById('f-apellidos').value.trim(),
            autobus: document.getElementById('f-autobus').value || null,
            menu: document.getElementById('f-menu').value || null,
            alergias: document.getElementById('f-alergias').value.trim() || null,
        };
        if (!data.nombre || !data.apellidos) {
            ['f-nombre', 'f-apellidos'].forEach(id => {
                const el = document.getElementById(id);
                if (!el.value.trim()) {
                    el.style.borderColor = '#e74c3c';
                    el.addEventListener('input', function fix() { el.style.borderColor = ''; el.removeEventListener('input', fix); });
                }
            });
            return;
        }

        const saveBtn = document.getElementById('modal-save');
        saveBtn.textContent = 'Guardando...';
        saveBtn.disabled = true;

        if (id) data.id = parseInt(id);

        try {
            const result = await upsertGuest(data);
            const savedGuest = Array.isArray(result) ? result[0] : result;
            const guestId = savedGuest ? savedGuest.id : parseInt(id);

            // Group
            const groupId = document.getElementById('f-grupo').value;
            if (groupId) guestGroups[guestId] = groupId;
            else delete guestGroups[guestId];

            // Familia
            const fam = document.getElementById('f-familia').value.trim();
            if (fam) guestFamilias[guestId] = fam;
            else delete guestFamilias[guestId];

            saveGuestGroups(); saveGuestFamilias();
            await fetchGuests(); render();
        } catch (err) { console.error('Save error:', err); }

        saveBtn.textContent = 'Guardar';
        saveBtn.disabled = false;
        closeGuestModal();
    });

    // Delete from modal
    document.getElementById('modal-delete').addEventListener('click', async () => {
        const id = document.getElementById('guest-id').value;
        if (!id || !confirm('¿Eliminar este invitado?')) return;
        await deleteGuest(parseInt(id));
        delete guestGroups[id]; delete guestFamilias[id];
        saveGuestGroups(); saveGuestFamilias();
        await fetchGuests(); render(); closeGuestModal();
    });

    document.getElementById('modal-cancel').addEventListener('click', closeGuestModal);
    document.getElementById('btn-add-guest').addEventListener('click', openAddModal);

    // ── Selection toolbar actions ──
    document.getElementById('sel-clear').addEventListener('click', clearSelection);

    document.getElementById('sel-delete').addEventListener('click', async () => {
        if (!confirm(`¿Eliminar ${selected.size} invitados?`)) return;
        for (const id of selected) {
            await deleteGuest(parseInt(id));
            delete guestGroups[id]; delete guestFamilias[id];
        }
        selected.clear();
        saveGuestGroups(); saveGuestFamilias();
        await fetchGuests(); render();
    });

    document.getElementById('sel-move').addEventListener('click', () => {
        document.getElementById('bulk-move-modal').classList.add('active');
        const sel = document.getElementById('bulk-grupo');
        sel.innerHTML = '<option value="">Sin grupo</option>';
        groups.forEach(g => {
            sel.innerHTML += `<option value="${g.id}">${esc(g.name)}</option>`;
        });
    });

    document.getElementById('bulk-cancel').addEventListener('click', () => {
        document.getElementById('bulk-move-modal').classList.remove('active');
    });

    document.getElementById('bulk-confirm').addEventListener('click', () => {
        const groupId = document.getElementById('bulk-grupo').value;
        selected.forEach(id => {
            if (groupId) guestGroups[id] = groupId;
            else delete guestGroups[id];
        });
        saveGuestGroups();
        document.getElementById('bulk-move-modal').classList.remove('active');
        clearSelection(); render();
    });

    // ── Group Modal ──
    let selectedColor = '#C9A96E';

    document.getElementById('btn-add-group').addEventListener('click', () => {
        document.getElementById('g-nombre').value = '';
        selectedColor = '#C9A96E';
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        document.querySelector('.color-dot[data-color="#C9A96E"]').classList.add('active');
        document.getElementById('group-modal').classList.add('active');
        document.getElementById('g-nombre').focus();
    });

    document.getElementById('group-cancel').addEventListener('click', () => {
        document.getElementById('group-modal').classList.remove('active');
    });

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            selectedColor = dot.dataset.color;
        });
    });

    document.getElementById('group-save').addEventListener('click', () => {
        const name = document.getElementById('g-nombre').value.trim();
        if (!name) return;
        groups.push({ id: 'g_' + Date.now(), name, color: selectedColor });
        saveGroups();
        document.getElementById('group-modal').classList.remove('active');
        render();
    });

    // ── Logout ──
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('admin_auth');
        localStorage.removeItem('admin_token');
        window.location.href = 'index.html';
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    async function init() { await fetchGuests(); render(); }
    init();
})();
