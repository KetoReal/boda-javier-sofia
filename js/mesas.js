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

        // Group unassigned by group_id
        const byGroup = {};
        const noGroup = [];
        unassigned.forEach(g => {
            if (g.group_id) {
                if (!byGroup[g.group_id]) byGroup[g.group_id] = [];
                byGroup[g.group_id].push(g);
            } else {
                noGroup.push(g);
            }
        });

        // Render grouped sections
        groups.forEach(group => {
            const members = byGroup[group.id];
            if (!members || !members.length) return;
            const section = document.createElement('div');
            section.className = 'pool-group';
            section.innerHTML = `<div class="pool-group__label" style="border-left-color:${group.color || '#C9A96E'}">${esc(group.name)} <span style="color:#bbb;font-weight:400">(${members.length})</span></div>`;
            const chips = document.createElement('div');
            chips.className = 'pool-group__chips';
            members.forEach(g => chips.appendChild(createChip(g, false)));
            section.appendChild(chips);
            poolList.appendChild(section);
        });

        // Render ungrouped
        if (noGroup.length) {
            if (Object.keys(byGroup).length > 0) {
                const section = document.createElement('div');
                section.className = 'pool-group';
                section.innerHTML = `<div class="pool-group__label" style="border-left-color:#ccc">Sin grupo <span style="color:#bbb;font-weight:400">(${noGroup.length})</span></div>`;
                const chips = document.createElement('div');
                chips.className = 'pool-group__chips';
                noGroup.forEach(g => chips.appendChild(createChip(g, false)));
                section.appendChild(chips);
                poolList.appendChild(section);
            } else {
                noGroup.forEach(g => poolList.appendChild(createChip(g, false)));
            }
        }

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

        // ── 2D Table rendering ──
        tablesArea.innerHTML = '';
        const COLS = 3;
        const TABLE_W = 220;
        const TABLE_H = 220;
        const GAP = 40;

        // Load saved positions or auto-layout in grid
        let positions = {};
        try { positions = JSON.parse(localStorage.getItem('boda_table_positions') || '{}'); } catch (_) {}

        // Ensure canvas is big enough
        const rows = Math.ceil(tables.length / COLS);
        tablesArea.style.minHeight = Math.max(600, rows * (TABLE_H + GAP) + GAP) + 'px';
        tablesArea.style.minWidth = Math.max(800, COLS * (TABLE_W + GAP) + GAP) + 'px';

        tables.forEach((table, idx) => {
            const seatedGuests = guests.filter(g => assignments[g.id] === table.id);
            const confirmedCount = seatedGuests.filter(g => isConfirmed(g)).length;

            // Position: saved or auto-grid
            const defaultX = GAP + (idx % COLS) * (TABLE_W + GAP);
            const defaultY = GAP + Math.floor(idx / COLS) * (TABLE_H + GAP);
            const pos = positions[table.id] || { x: defaultX, y: defaultY };

            const el = document.createElement('div');
            el.className = 'table-2d';
            el.dataset.tableId = table.id;
            el.style.left = pos.x + 'px';
            el.style.top = pos.y + 'px';
            el.style.width = TABLE_W + 'px';
            el.style.height = TABLE_H + 'px';

            // Circle container
            const circle = document.createElement('div');
            circle.className = 'table-2d__circle';

            // Center (table label)
            const center = document.createElement('div');
            center.className = 'table-2d__center';
            center.innerHTML = `
                <span class="table-2d__name">${esc(table.nombre)}</span>
                <span class="table-2d__count">${seatedGuests.length}/${SEATS_PER_TABLE}</span>
                <div class="table-2d__actions">
                    <button class="table-2d__btn table-2d__btn--rename" title="Renombrar">&#9998;</button>
                    <button class="table-2d__btn table-2d__btn--delete" title="Eliminar">&#128465;</button>
                </div>
            `;
            circle.appendChild(center);

            // Chairs around the table
            const CHAIR_RADIUS = 88;
            for (let s = 0; s < SEATS_PER_TABLE; s++) {
                const angle = (2 * Math.PI * s / SEATS_PER_TABLE) - Math.PI / 2;
                const cx = 100 + CHAIR_RADIUS * Math.cos(angle) - 20;
                const cy = 100 + CHAIR_RADIUS * Math.sin(angle) - 20;

                const chair = document.createElement('div');
                chair.className = 'table-2d__chair';
                chair.style.left = cx + 'px';
                chair.style.top = cy + 'px';
                chair.dataset.seatIdx = s;

                const guest = seatedGuests[s];
                if (guest) {
                    chair.classList.add('table-2d__chair--occupied');
                    if (isConfirmed(guest)) chair.classList.add('guest-chip--confirmed');
                    chair.textContent = getInitials(guest);
                    chair.dataset.guestId = guest.id;

                    // Tooltip
                    const tip = document.createElement('span');
                    tip.className = 'table-2d__chair-tooltip';
                    tip.textContent = `${guest.nombre} ${guest.apellidos}`;
                    chair.appendChild(tip);

                    // Remove button
                    const rm = document.createElement('span');
                    rm.className = 'table-2d__chair-remove';
                    rm.textContent = '\u00d7';
                    rm.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await removeAssignment(guest.id);
                        render();
                    });
                    chair.appendChild(rm);
                }

                // Drop guest onto chair
                chair.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    chair.classList.add('drag-over-chair');
                });
                chair.addEventListener('dragleave', () => chair.classList.remove('drag-over-chair'));
                chair.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    chair.classList.remove('drag-over-chair');
                    const guestId = e.dataTransfer.getData('text/plain');
                    if (!guestId) return;
                    if (seatedGuests.length >= SEATS_PER_TABLE && !assignments[guestId]) return;
                    await saveAssignment(guestId, table.id);
                    render();
                });

                circle.appendChild(chair);
            }

            el.appendChild(circle);

            // Drop on whole table (fallback)
            el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over-table'); });
            el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over-table'); });
            el.addEventListener('drop', async (e) => {
                e.preventDefault();
                el.classList.remove('drag-over-table');
                const guestId = e.dataTransfer.getData('text/plain');
                if (!guestId) return;
                if (seatedGuests.length >= SEATS_PER_TABLE && assignments[guestId] !== table.id) return;
                await saveAssignment(guestId, table.id);
                render();
            });

            // Drag table to reposition
            let isDragging = false, dragOff = { x: 0, y: 0 };
            center.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
                isDragging = true;
                center.classList.add('dragging-table');
                dragOff.x = e.clientX - el.offsetLeft;
                dragOff.y = e.clientY - el.offsetTop;
                e.preventDefault();
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const nx = e.clientX - dragOff.x;
                const ny = e.clientY - dragOff.y;
                el.style.left = Math.max(0, nx) + 'px';
                el.style.top = Math.max(0, ny) + 'px';
            });
            document.addEventListener('mouseup', () => {
                if (!isDragging) return;
                isDragging = false;
                center.classList.remove('dragging-table');
                positions[table.id] = { x: parseInt(el.style.left), y: parseInt(el.style.top) };
                localStorage.setItem('boda_table_positions', JSON.stringify(positions));
            });

            // Rename
            center.querySelector('.table-2d__btn--rename').addEventListener('click', (e) => {
                e.stopPropagation();
                const newName = prompt('Nombre de la mesa:', table.nombre);
                if (newName && newName.trim()) {
                    table.nombre = newName.trim();
                    saveMesa(table);
                    render();
                }
            });

            // Delete
            center.querySelector('.table-2d__btn--delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm(`Eliminar ${table.nombre}?`)) return;
                const deletes = seatedGuests.map(g => removeAssignment(g.id));
                await Promise.all(deletes);
                await api.del('tables', `id=eq.${table.id}`);
                tables = tables.filter(t => t.id !== table.id);
                delete positions[table.id];
                localStorage.setItem('boda_table_positions', JSON.stringify(positions));
                render();
            });

            tablesArea.appendChild(el);
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
        .pool-group { margin-bottom: 12px; }
        .pool-group__label {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #888;
            padding: 4px 0 4px 10px;
            border-left: 3px solid #C9A96E;
            margin-bottom: 6px;
        }
        .pool-group__chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
    `;
    document.head.appendChild(style);
})();
