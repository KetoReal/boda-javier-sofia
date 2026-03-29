/* ══════════════════════════════════════════════
   INVITADOS — Read-only list of RSVP registered guests
   Edit/Delete for admin corrections.
   Manual match to link real → virtual.
   ALL DATA IN SUPABASE (no localStorage)
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

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
        async patch(table, match, data) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
                method: 'PATCH',
                headers: authHeaders('return=representation'),
                body: JSON.stringify(data),
            });
            return res.ok ? res.json() : [];
        },
    };

    let guests = [];
    let virtualGuests = [];

    async function fetchAll() {
        [guests, virtualGuests] = await Promise.all([
            api.get('guests', 'select=*&order=created_at.desc'),
            api.get('virtual_guests', 'select=id,nombre,apellidos,matched_guest_id,menu,autobus,alergias'),
        ]);
    }

    async function upsertGuest(guest) {
        const isEdit = !!guest.id;
        const method = isEdit ? 'PATCH' : 'POST';
        const url = isEdit ? `${SUPABASE_URL}/rest/v1/guests?id=eq.${guest.id}` : `${SUPABASE_URL}/rest/v1/guests`;
        const body = { ...guest };
        delete body.id;
        const res = await fetch(url, { method, headers: authHeaders('return=representation'), body: JSON.stringify(body) });
        return res.json();
    }

    async function deleteGuest(id) {
        // Unlink any virtual guest matched to this real guest
        await api.patch('virtual_guests', `matched_guest_id=eq.${id}`, { matched_guest_id: null });
        await fetch(`${SUPABASE_URL}/rest/v1/guests?id=eq.${id}`, { method: 'DELETE', headers: authHeaders() });
    }

    // ── Match helpers ──
    function isMatched(guestId) {
        return virtualGuests.some(v => String(v.matched_guest_id) === String(guestId));
    }

    function getMatchedVirtualId(realGuestId) {
        const vg = virtualGuests.find(v => String(v.matched_guest_id) === String(realGuestId));
        return vg ? vg.id : null;
    }

    function normalize(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function similarity(a, b) {
        const na = normalize(a), nb = normalize(b);
        if (na === nb) return 1;
        if (na.includes(nb) || nb.includes(na)) return 0.8;
        const wa = na.split(' '), wb = nb.split(' ');
        const common = wa.filter(w => wb.includes(w)).length;
        const total = Math.max(wa.length, wb.length);
        return total > 0 ? common / total : 0;
    }

    // ── Sync properties from real to virtual on match ──
    async function syncToVirtual(virtualId, realGuest) {
        const updates = {};
        if (realGuest.menu) updates.menu = realGuest.menu;
        if (realGuest.autobus) updates.autobus = realGuest.autobus;
        if (realGuest.alergias) updates.alergias = realGuest.alergias;
        if (Object.keys(updates).length > 0) {
            await api.patch('virtual_guests', `id=eq.${encodeURIComponent(virtualId)}`, updates);
        }
    }

    // ── Render ──
    function render() {
        document.getElementById('total-count').textContent = guests.length;

        // Stats
        const adultsCount = guests.filter(g => !g.is_child).length;
        const childrenCount = guests.filter(g => g.is_child).length;
        const familyGroups = new Set(guests.map(g => g.family_group).filter(Boolean));
        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('stat-total', guests.length);
        el('stat-adults', adultsCount);
        el('stat-children', childrenCount);
        el('stat-families', familyGroups.size);

        const list = document.getElementById('guests-list');
        const empty = document.getElementById('inv-empty');
        const hint = document.getElementById('inv-hint');

        if (!guests.length) {
            list.innerHTML = '';
            empty.style.display = '';
            hint.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        hint.style.display = '';
        list.innerHTML = '';

        // Group by family_group
        const families = {};
        const solos = [];

        guests.forEach(g => {
            if (g.family_group) {
                if (!families[g.family_group]) families[g.family_group] = [];
                families[g.family_group].push(g);
            } else {
                solos.push(g);
            }
        });

        // Sort families by first member's created_at (newest first)
        const familyKeys = Object.keys(families).sort((a, b) => {
            const da = families[a][0].created_at || '';
            const db = families[b][0].created_at || '';
            return db.localeCompare(da);
        });

        // Render family groups
        familyKeys.forEach(fgKey => {
            const members = families[fgKey];
            // First non-child member is the "titular"
            const titular = members.find(m => !m.is_child) || members[0];
            const familyLabel = `Familia de ${titular.nombre} ${titular.apellidos}`;

            const wrapper = document.createElement('div');
            wrapper.className = 'inv-family-group';
            wrapper.innerHTML = `
                <div class="inv-family-group__header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    <span class="inv-family-group__title">${esc(familyLabel)}</span>
                    <span class="inv-family-group__count">${members.length} personas</span>
                </div>
            `;
            members.forEach(guest => wrapper.appendChild(createGuestRow(guest)));
            list.appendChild(wrapper);
        });

        // Render solo guests (no family group)
        solos.sort((a, b) => {
            const am = isMatched(a.id) ? 0 : 1;
            const bm = isMatched(b.id) ? 0 : 1;
            return am - bm || a.nombre.localeCompare(b.nombre);
        });
        solos.forEach(guest => list.appendChild(createGuestRow(guest)));
    }

    function createGuestRow(guest) {
        const matched = isMatched(guest.id);
        const initials = ((guest.nombre || '')[0] || '') + ((guest.apellidos || '')[0] || '');
        const menuLabel = guest.menu ? guest.menu.charAt(0).toUpperCase() + guest.menu.slice(1) : '';
        const busLabel = guest.autobus === 'no' ? 'Propio' : guest.autobus === 'plaza-castilla' ? 'P. Castilla' : guest.autobus === 'alcobendas' ? 'Alcobendas' : '';

        let badges = '';
        badges += guest.is_child
            ? '<span class="inv-guest__badge inv-guest__badge--child">Niño/a</span>'
            : '<span class="inv-guest__badge inv-guest__badge--adult">Adulto</span>';
        if (guest.menu) badges += `<span class="inv-guest__badge inv-guest__badge--${guest.menu}">${menuLabel}</span>`;
        if (guest.autobus && guest.autobus !== 'no') badges += `<span class="inv-guest__badge inv-guest__badge--bus">${busLabel}</span>`;
        else if (guest.autobus === 'no') badges += `<span class="inv-guest__badge inv-guest__badge--car">Propio</span>`;
        if (guest.alergias) badges += `<span class="inv-guest__badge inv-guest__badge--allergy">${esc(guest.alergias)}</span>`;

        const row = document.createElement('div');
        row.className = 'inv-guest' + (guest.family_group ? ' inv-guest--in-family' : '');
        row.innerHTML = `
            <div class="inv-guest__avatar ${matched ? 'inv-guest__avatar--confirmed' : ''}">${initials.toUpperCase()}</div>
            <div class="inv-guest__info">
                <div class="inv-guest__name">${esc(guest.nombre)} ${esc(guest.apellidos)}</div>
                <div class="inv-guest__meta">
                    ${guest.created_at ? `<span>${new Date(guest.created_at).toLocaleDateString('es-ES')}</span>` : ''}
                </div>
            </div>
            <div class="inv-guest__badges">${badges}</div>
            <span class="inv-guest__match-status ${matched ? 'inv-guest__match-status--green' : 'inv-guest__match-status--gray'}">
                ${matched
                    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg> Vinculado'
                    : 'Sin vincular'}
            </span>
            <button class="inv-guest__btn-link" title="Vincular con virtual">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            </button>
            <button class="inv-guest__edit" title="Editar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="inv-guest__delete" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        `;

        row.querySelector('.inv-guest__btn-link').addEventListener('click', (e) => {
            e.stopPropagation();
            openLinkModal(guest);
        });

        row.querySelector('.inv-guest__edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(guest);
        });

        row.querySelector('.inv-guest__delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`Eliminar a ${guest.nombre} ${guest.apellidos}?`)) return;
            await deleteGuest(guest.id);
            await fetchAll(); render();
        });

        return row;
    }

    // ── Edit Modal ──
    function openEditModal(guest) {
        document.getElementById('modal-title').textContent = 'Editar invitado';
        document.getElementById('guest-id').value = guest.id;
        document.getElementById('f-nombre').value = guest.nombre || '';
        document.getElementById('f-apellidos').value = guest.apellidos || '';
        document.getElementById('f-autobus').value = guest.autobus || '';
        document.getElementById('f-menu').value = guest.menu || '';
        document.getElementById('f-alergias').value = guest.alergias || '';
        document.getElementById('f-is-child').value = guest.is_child ? '1' : '0';
        document.getElementById('modal-delete').style.display = 'inline-flex';
        document.getElementById('guest-modal').classList.add('active');
        document.getElementById('f-nombre').focus();
    }

    function closeGuestModal() {
        document.getElementById('guest-modal').classList.remove('active');
    }

    document.getElementById('guest-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('guest-id').value;
        const data = {
            nombre: document.getElementById('f-nombre').value.trim(),
            apellidos: document.getElementById('f-apellidos').value.trim(),
            autobus: document.getElementById('f-autobus').value || null,
            menu: document.getElementById('f-menu').value || null,
            alergias: document.getElementById('f-alergias').value.trim() || null,
            is_child: document.getElementById('f-is-child').value === '1',
        };
        if (!data.nombre || !data.apellidos) return;

        const saveBtn = document.getElementById('modal-save');
        saveBtn.textContent = 'Guardando...';
        saveBtn.disabled = true;

        if (id) data.id = parseInt(id);

        try {
            await upsertGuest(data);
            // If this real guest is matched to a virtual, sync properties
            const vid = getMatchedVirtualId(id);
            if (vid) {
                await syncToVirtual(vid, data);
            }
            await fetchAll(); render();
        } catch (err) { console.error('Save error:', err); }

        saveBtn.textContent = 'Guardar';
        saveBtn.disabled = false;
        closeGuestModal();
    });

    document.getElementById('modal-delete').addEventListener('click', async () => {
        const id = document.getElementById('guest-id').value;
        if (!id || !confirm('Eliminar este invitado?')) return;
        await deleteGuest(parseInt(id));
        await fetchAll(); render(); closeGuestModal();
    });

    document.getElementById('modal-cancel').addEventListener('click', closeGuestModal);

    // ── Link Modal (link real → virtual) ──
    let currentRealGuest = null;

    function openLinkModal(realGuest) {
        currentRealGuest = realGuest;
        document.getElementById('link-for').querySelector('strong').textContent = `${realGuest.nombre} ${realGuest.apellidos}`;
        document.getElementById('link-search').value = '';
        const vid = getMatchedVirtualId(realGuest.id);
        document.getElementById('link-unlink').style.display = vid ? 'inline-flex' : 'none';
        renderLinkResults('');
        document.getElementById('link-modal').classList.add('active');
        document.getElementById('link-search').focus();
    }

    function renderLinkResults(query) {
        const container = document.getElementById('link-results');
        const q = normalize(query);

        let candidates = virtualGuests.map(vg => {
            const fullName = `${vg.nombre} ${vg.apellidos}`;
            const score = q ? similarity(fullName, query) : similarity(fullName, `${currentRealGuest.nombre} ${currentRealGuest.apellidos}`);
            const alreadyMatched = !!vg.matched_guest_id && String(vg.matched_guest_id) !== String(currentRealGuest.id);
            const isCurrentMatch = String(vg.matched_guest_id) === String(currentRealGuest.id);
            return { ...vg, score, alreadyMatched, isCurrentMatch };
        });

        if (q) {
            candidates = candidates.filter(c => normalize(`${c.nombre} ${c.apellidos}`).includes(q) || c.score > 0.3);
        }

        candidates.sort((a, b) => b.score - a.score);

        container.innerHTML = candidates.slice(0, 20).map(vg => {
            const initials = ((vg.nombre || '')[0] || '') + ((vg.apellidos || '')[0] || '');
            return `
                <div class="match-result" data-virtual-id="${vg.id}" ${vg.alreadyMatched ? 'style="opacity:0.4"' : ''}>
                    <div class="match-result__avatar">${initials.toUpperCase()}</div>
                    <div class="match-result__info">
                        <div class="match-result__name">${esc(vg.nombre)} ${esc(vg.apellidos)}</div>
                        <div class="match-result__detail">${vg.menu || '\u2014'} · ${vg.autobus || '\u2014'}${vg.alreadyMatched ? ' · Ya vinculado' : ''}</div>
                    </div>
                    <span class="match-result__pick">${vg.isCurrentMatch ? '\u2713 Vinculado' : 'Elegir'}</span>
                </div>
            `;
        }).join('') || '<p style="text-align:center;color:#999;padding:20px">No hay virtuales que coincidan</p>';

        container.querySelectorAll('.match-result').forEach(el => {
            el.addEventListener('click', async () => {
                const virtualId = el.dataset.virtualId;
                // Unlink any previous virtual guest matched to this real guest
                const prevVid = getMatchedVirtualId(currentRealGuest.id);
                if (prevVid) {
                    await api.patch('virtual_guests', `id=eq.${encodeURIComponent(prevVid)}`, { matched_guest_id: null });
                }
                // Link the new virtual guest
                await api.patch('virtual_guests', `id=eq.${encodeURIComponent(virtualId)}`, { matched_guest_id: currentRealGuest.id });
                // Sync properties to virtual
                await syncToVirtual(virtualId, currentRealGuest);
                await fetchAll(); render();
                document.getElementById('link-modal').classList.remove('active');
            });
        });
    }

    document.getElementById('link-search').addEventListener('input', (e) => {
        renderLinkResults(e.target.value);
    });

    document.getElementById('link-cancel').addEventListener('click', () => {
        document.getElementById('link-modal').classList.remove('active');
    });

    document.getElementById('link-unlink').addEventListener('click', async () => {
        if (currentRealGuest) {
            const vid = getMatchedVirtualId(currentRealGuest.id);
            if (vid) {
                await api.patch('virtual_guests', `id=eq.${encodeURIComponent(vid)}`, { matched_guest_id: null });
            }
            await fetchAll(); render();
        }
        document.getElementById('link-modal').classList.remove('active');
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

    async function init() { await fetchAll(); render(); }
    init();
})();
