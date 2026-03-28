/* ══════════════════════════════════════════════
   MESAS — Drag & Drop table assignment
   Uses VIRTUAL guests for planning.
   Shows green/gray based on match status.
   Shows group/familia info in tooltips.
   ALL DATA IN SUPABASE (no localStorage)
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    const SEATS_PER_TABLE = 8;

    const SUPABASE_URL = 'https://lpatzgviideumccecfew.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY2MDMsImV4cCI6MjA5MDA5MjYwM30.jWQrW6FqArq87w50YALA9CUxahyPzwHBQLd9kI7U4qY';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNjYwMywiZXhwIjoyMDkwMDkyNjAzfQ.-CM_Wku1-fWqtbz8flSb3MFabrxFnoED047cT81hgAs';

    function authHeaders(prefer) {
        const h = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        };
        if (prefer) h['Prefer'] = prefer;
        return h;
    }

    const api = {
        async get(table, query = '') {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: authHeaders() });
            return res.ok ? res.json() : [];
        },
        async upsert(table, data) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
                method: 'POST',
                headers: authHeaders('return=representation,resolution=merge-duplicates'),
                body: JSON.stringify(Array.isArray(data) ? data : [data]),
            });
            return res.ok ? res.json() : [];
        },
        async del(table, match) {
            await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
                method: 'DELETE', headers: authHeaders(),
            });
        },
    };

    let guests = [];           // virtual guests
    let tables = [];           // mesas
    let assignments = {};      // { virtualGuestId: tableId }
    let groups = [];           // guest groups

    async function loadData() {
        const [vGuests, mesasData, assignData, groupsData] = await Promise.all([
            api.get('virtual_guests', 'order=created_at.asc'),
            api.get('tables', 'order=created_at.asc'),
            api.get('mesa_assignments', 'order=created_at.asc'),
            api.get('guest_groups', 'order=created_at.asc'),
        ]);

        guests = vGuests;
        tables = mesasData;
        groups = groupsData;

        // Build assignments map
        assignments = {};
        assignData.forEach(a => { assignments[a.virtual_guest_id] = a.table_id; });

        // Auto-create tables if none exist
        if (!tables.length && guests.length > 0) {
            const numTables = Math.ceil(guests.length / SEATS_PER_TABLE);
            const newTables = [];
            for (let i = 1; i <= numTables; i++) {
                newTables.push({ id: Date.now() + i, nombre: 'Mesa ' + i });
            }
            const created = await api.upsert('tables', newTables);
            if (created.length) tables = created;
        }

        render();
    }

    async function saveMesa(mesa) {
        await api.upsert('tables', { id: mesa.id, nombre: mesa.nombre });
    }

    async function saveAssignment(guestId, tableId) {
        assignments[guestId] = tableId;
        await api.upsert('mesa_assignments', { virtual_guest_id: guestId, table_id: tableId });
    }

    async function removeAssignment(guestId) {
        delete assignments[guestId];
        await api.del('mesa_assignments', `virtual_guest_id=eq.${encodeURIComponent(guestId)}`);
    }

    function getInitials(g) {
        return (((g.nombre || '')[0] || '') + ((g.apellidos || '')[0] || '')).toUpperCase();
    }

    function isConfirmed(g) {
        return !!g.matched_guest_id;
    }

    function getGroupName(guest) {
        if (!guest.group_id) return '';
        const group = groups.find(g => g.id === guest.group_id);
        return group ? group.name : '';
    }

    function getFamilia(guest) {
        return guest.familia || '';
    }

    // ── Chip ──
    function createChip(guest, isSeated) {
        const confirmed = isConfirmed(guest);
        const chip = document.createElement('div');
        chip.className = 'guest-chip' + (isSeated ? ' guest-chip--seated' : '') + (confirmed ? ' guest-chip--confirmed' : ' guest-chip--pending');
        chip.draggable = true;
        chip.dataset.guestId = guest.id;
        chip.textContent = getInitials(guest);

        // Build tooltip with group/familia info
        const groupName = getGroupName(guest);
        const familia = getFamilia(guest);
        let tooltipText = `${guest.nombre} ${guest.apellidos}`;
        if (groupName) tooltipText += ` | ${groupName}`;
        if (familia) tooltipText += ` | ${familia}`;
        if (confirmed) tooltipText += ' \u2713';
        if (guest.menu) tooltipText += ` | ${guest.menu}`;

        const tooltip = document.createElement('span');
        tooltip.className = 'guest-chip__tooltip';
        tooltip.textContent = tooltipText;
        chip.appendChild(tooltip);

        if (isSeated) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'guest-chip__remove';
            removeBtn.textContent = '\u00d7';
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await removeAssignment(guest.id);
                render();
            });
            chip.appendChild(removeBtn);
        }

        chip.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', guest.id);
            chip.classList.add('dragging');
            setTimeout(() => chip.style.opacity = '0.4', 0);
        });

        chip.addEventListener('dragend', () => {
            chip.classList.remove('dragging');
            chip.style.opacity = '';
        });

        return chip;
    }

    // ── Render ──
    function render() {
        const poolList = document.getElementById('pool-list');
        const tablesArea = document.getElementById('tables-area');

        const unassigned = guests.filter(g => !assignments[g.id]);
        document.getElementById('unassigned-count').textContent = unassigned.length;

        poolList.innerHTML = '';
        unassigned.forEach(g => poolList.appendChild(createChip(g, false)));

        const pool = document.getElementById('guest-pool');
        pool.addEventListener('dragover', (e) => { e.preventDefault(); pool.style.background = '#faf8f0'; });
        pool.addEventListener('dragleave', () => { pool.style.background = ''; });
        pool.addEventListener('drop', async (e) => {
            e.preventDefault();
            pool.style.background = '';
            const guestId = e.dataTransfer.getData('text/plain');
            if (guestId && assignments[guestId]) {
                await removeAssignment(guestId);
                render();
            }
        });

        tablesArea.innerHTML = '';
        tables.forEach(table => {
            const slot = document.createElement('div');
            slot.className = 'table-slot';
            slot.dataset.tableId = table.id;

            const seatedGuests = guests.filter(g => assignments[g.id] === table.id);
            const confirmedCount = seatedGuests.filter(g => isConfirmed(g)).length;

            slot.innerHTML = `
                <div class="table-slot__header">
                    <span class="table-slot__name" title="Doble click para renombrar">${esc(table.nombre)}</span>
                    <span class="table-slot__count">${seatedGuests.length}/${SEATS_PER_TABLE} <span class="table-slot__confirmed">(${confirmedCount} conf.)</span></span>
                    <button class="table-slot__rename" title="Renombrar mesa">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="table-slot__delete" title="Eliminar mesa">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
                <div class="table-slot__seats"></div>
            `;

            const seats = slot.querySelector('.table-slot__seats');

            if (seatedGuests.length === 0) {
                seats.innerHTML = '<span class="table-slot__empty">Arrastra invitados aqui</span>';
            } else {
                seatedGuests.forEach(g => seats.appendChild(createChip(g, true)));
            }

            slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('drag-over'); });
            slot.addEventListener('dragleave', (e) => { if (!slot.contains(e.relatedTarget)) slot.classList.remove('drag-over'); });
            slot.addEventListener('drop', async (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                const guestId = e.dataTransfer.getData('text/plain');
                if (!guestId) return;
                if (seatedGuests.length >= SEATS_PER_TABLE && assignments[guestId] !== table.id) {
                    slot.style.animation = 'shake 0.3s';
                    setTimeout(() => slot.style.animation = '', 300);
                    return;
                }
                await saveAssignment(guestId, table.id);
                render();
            });

            // Rename
            const nameEl = slot.querySelector('.table-slot__name');
            function startRename() {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = table.nombre;
                input.className = 'table-slot__name-input';
                nameEl.replaceWith(input);
                input.focus();
                input.select();

                async function finishRename() {
                    const newName = input.value.trim() || table.nombre;
                    table.nombre = newName;
                    await saveMesa(table);
                    render();
                }

                input.addEventListener('blur', finishRename);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') input.blur();
                    if (e.key === 'Escape') { input.value = table.nombre; input.blur(); }
                });
            }

            slot.querySelector('.table-slot__rename').addEventListener('click', startRename);
            nameEl.addEventListener('dblclick', startRename);

            // Delete
            slot.querySelector('.table-slot__delete').addEventListener('click', async () => {
                // Remove assignments for guests at this table
                const deletes = seatedGuests.map(g => removeAssignment(g.id));
                await Promise.all(deletes);
                await api.del('tables', `id=eq.${table.id}`);
                tables = tables.filter(t => t.id !== table.id);
                render();
            });

            tablesArea.appendChild(slot);
        });

        if (window.updateBudgetBar) window.updateBudgetBar();
    }

    // ── Add table ──
    document.getElementById('btn-add-table').addEventListener('click', async () => {
        const mesa = { id: Date.now(), nombre: 'Mesa ' + (tables.length + 1) };
        const created = await api.upsert('tables', mesa);
        if (created.length) tables.push(created[0]);
        else tables.push(mesa);
        render();
    });

    // ── Generate fake guests -> creates virtual guests ──
    const NOMBRES_M = ['Alejandro','Carlos','Daniel','David','Eduardo','Fernando','Gonzalo','Hugo','Javier','Luis','Manuel','Miguel','Pablo','Pedro','Rafael','Sergio','Antonio','Roberto','Alberto','Marcos'];
    const NOMBRES_F = ['Ana','Beatriz','Carmen','Claudia','Elena','Isabel','Laura','Lucia','Maria','Marta','Natalia','Paula','Raquel','Sara','Sofia','Teresa','Veronica','Alba','Cristina','Patricia'];
    const APELLIDOS = ['Garcia','Lopez','Martinez','Sanchez','Fernandez','Gonzalez','Rodriguez','Perez','Ruiz','Diaz','Hernandez','Moreno','Munoz','Alvarez','Jimenez','Romero','Navarro','Torres','Dominguez','Gil'];

    document.getElementById('btn-generate').addEventListener('click', () => {
        document.getElementById('generate-modal').classList.add('active');
    });

    document.getElementById('generate-cancel').addEventListener('click', () => {
        document.getElementById('generate-modal').classList.remove('active');
    });

    document.getElementById('generate-confirm').addEventListener('click', async () => {
        const count = parseInt(document.getElementById('generate-count').value) || 70;

        const newGuests = [];
        for (let i = 0; i < count; i++) {
            const isFemale = Math.random() > 0.5;
            const nombres = isFemale ? NOMBRES_F : NOMBRES_M;
            newGuests.push({
                id: 'v_' + Date.now() + '_' + i,
                nombre: nombres[Math.floor(Math.random() * nombres.length)],
                apellidos: APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)] + ' ' + APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)],
                menu: null,
                autobus: null,
                alergias: null,
                matched_guest_id: null,
                group_id: null,
                familia: null,
            });
        }

        // Clear old assignments and virtual guests
        await api.del('mesa_assignments', 'virtual_guest_id=neq.IMPOSSIBLE');
        await api.del('virtual_guests', 'id=neq.IMPOSSIBLE');

        // Insert new virtual guests
        await api.upsert('virtual_guests', newGuests);
        guests = newGuests;
        assignments = {};

        // Create tables
        const numTables = Math.ceil(count / SEATS_PER_TABLE);
        await api.del('tables', 'id=neq.-1');
        const newTables = [];
        for (let i = 1; i <= numTables; i++) {
            newTables.push({ id: Date.now() + i, nombre: 'Mesa ' + i });
        }
        const created = await api.upsert('tables', newTables);
        tables = created.length ? created : newTables;

        document.getElementById('generate-modal').classList.remove('active');
        render();
        if (window.updateBudgetBar) window.updateBudgetBar();
    });

    // ── Logout ──
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('admin_auth');
        window.location.href = 'index.html';
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    loadData();

    // Inject styles for confirmed/pending chips + shake
    const style = document.createElement('style');
    style.textContent = `
        .guest-chip--confirmed {
            background: linear-gradient(135deg, #2e7d32, #66bb6a) !important;
        }
        .guest-chip--pending {
            background: linear-gradient(135deg, #bbb, #ddd) !important;
        }
        .table-slot__confirmed {
            color: #2e7d32;
            font-weight: 600;
        }
        .table-slot__rename {
            background: none;
            border: none;
            cursor: pointer;
            color: #ccc;
            padding: 4px;
            transition: color 0.2s;
        }
        .table-slot__rename:hover { color: #C9A96E; }
        .table-slot__name {
            cursor: default;
        }
        .table-slot__name-input {
            font-family: 'Playfair Display', serif;
            font-weight: 600;
            font-size: 1.1rem;
            border: none;
            border-bottom: 2px solid #C9A96E;
            outline: none;
            background: transparent;
            padding: 2px 4px;
            width: 140px;
        }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
    `;
    document.head.appendChild(style);
})();
