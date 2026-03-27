/* ══════════════════════════════════════════════
   SIMULACION — Virtual guests as source of truth
   Groups, Familias, Properties, Auto/Manual Match
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://lpatzgviideumccecfew.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY2MDMsImV4cCI6MjA5MDA5MjYwM30.jWQrW6FqArq87w50YALA9CUxahyPzwHBQLd9kI7U4qY';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNjYwMywiZXhwIjoyMDkwMDkyNjAzfQ.-CM_Wku1-fWqtbz8flSb3MFabrxFnoED047cT81hgAs';

    let realGuests = [];
    let virtualGuests = JSON.parse(localStorage.getItem('wedding_virtual_guests') || '[]');
    let matches = JSON.parse(localStorage.getItem('wedding_matches') || '{}');
    let groups = JSON.parse(localStorage.getItem('wedding_virtual_groups') || '[]');
    let vGuestGroups = JSON.parse(localStorage.getItem('wedding_vguest_groups') || '{}');
    let vGuestFamilias = JSON.parse(localStorage.getItem('wedding_vguest_familias') || '{}');

    async function fetchRealGuests() {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/guests?order=created_at.desc`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` },
            });
            const data = await res.json();
            if (Array.isArray(data)) realGuests = data;
        } catch (_) { realGuests = []; }
    }

    function save() {
        localStorage.setItem('wedding_virtual_guests', JSON.stringify(virtualGuests));
        localStorage.setItem('wedding_matches', JSON.stringify(matches));
        if (window.updateBudgetBar) window.updateBudgetBar();
    }

    function saveGroups() { localStorage.setItem('wedding_virtual_groups', JSON.stringify(groups)); }
    function saveVGuestGroups() { localStorage.setItem('wedding_vguest_groups', JSON.stringify(vGuestGroups)); }
    function saveVGuestFamilias() { localStorage.setItem('wedding_vguest_familias', JSON.stringify(vGuestFamilias)); }

    // ── Normalize for matching ──
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

    function findBestMatch(vg) {
        const vName = `${vg.nombre} ${vg.apellidos}`;
        let best = null, bestScore = 0;
        const matchedRealIds = new Set(Object.values(matches));

        realGuests.forEach(rg => {
            if (matchedRealIds.has(String(rg.id))) return;
            const rName = `${rg.nombre} ${rg.apellidos}`;
            const score = similarity(vName, rName);
            if (score > bestScore) { bestScore = score; best = rg; }
        });

        return bestScore >= 0.6 ? best : null;
    }

    // ── Sync properties from real guest to virtual guest on match ──
    function syncFromReal(vg, rg) {
        if (rg.menu) vg.menu = rg.menu;
        if (rg.autobus) vg.autobus = rg.autobus;
        if (rg.alergias) vg.alergias = rg.alergias;
        save();
    }

    // ── Get familia members for drag ──
    function getFamiliaMembers(vgId) {
        const fam = vGuestFamilias[vgId];
        if (!fam) return [String(vgId)];
        return virtualGuests.filter(v => vGuestFamilias[v.id] === fam).map(v => String(v.id));
    }

    // ── Badge HTML helper ──
    function badgesHtml(vg) {
        let badges = '';
        if (vg.menu) {
            const label = vg.menu.charAt(0).toUpperCase() + vg.menu.slice(1);
            badges += `<span class="inv-guest__badge inv-guest__badge--${vg.menu}">${label}</span>`;
        }
        if (vg.autobus && vg.autobus !== 'no') {
            const busLabel = vg.autobus === 'plaza-castilla' ? 'P. Castilla' : 'Alcobendas';
            badges += `<span class="inv-guest__badge inv-guest__badge--bus">${busLabel}</span>`;
        } else if (vg.autobus === 'no') {
            badges += `<span class="inv-guest__badge inv-guest__badge--car">Propio</span>`;
        }
        if (vg.alergias) {
            badges += `<span class="inv-guest__badge inv-guest__badge--allergy">${esc(vg.alergias)}</span>`;
        }
        return badges;
    }

    // ── Render ──
    function render() {
        const matchedCount = Object.keys(matches).length;
        document.getElementById('stat-total').textContent = virtualGuests.length;
        document.getElementById('stat-matched').textContent = matchedCount;
        document.getElementById('stat-pending').textContent = virtualGuests.length - matchedCount;

        const empty = document.getElementById('sim-empty');
        const groupsContainer = document.getElementById('groups-container');
        const ungroupedSection = document.getElementById('ungrouped-section');

        if (virtualGuests.length === 0) {
            empty.style.display = '';
            groupsContainer.innerHTML = '';
            ungroupedSection.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        groupsContainer.innerHTML = '';

        // Render each group
        groups.forEach(group => {
            const groupVGuests = virtualGuests.filter(v => vGuestGroups[v.id] === group.id);
            const section = document.createElement('div');
            section.className = 'inv-group';
            section.style.borderLeftColor = group.color || '#C9A96E';

            section.innerHTML = `
                <div class="inv-group__header">
                    <div style="display:flex;align-items:center;gap:12px">
                        <h3 class="inv-group__title">${esc(group.name)}</h3>
                        <span class="inv-group__count">${groupVGuests.length}</span>
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
            renderVGuestsInList(list, groupVGuests);

            if (groupVGuests.length === 0) {
                list.innerHTML = '<div class="inv-empty">Arrastra invitados aqui</div>';
            }

            section.querySelector('.inv-group__btn--delete').addEventListener('click', () => {
                if (!confirm(`Eliminar el grupo "${group.name}"?`)) return;
                Object.keys(vGuestGroups).forEach(vid => {
                    if (vGuestGroups[vid] === group.id) delete vGuestGroups[vid];
                });
                groups = groups.filter(gr => gr.id !== group.id);
                saveGroups(); saveVGuestGroups(); render();
            });

            setupDropZone(section, group.id);
            groupsContainer.appendChild(section);
        });

        // Ungrouped
        const ungrouped = virtualGuests.filter(v => !vGuestGroups[v.id]);
        document.getElementById('ungrouped-count').textContent = ungrouped.length;
        const ungroupedList = document.getElementById('ungrouped-list');
        ungroupedList.innerHTML = '';

        if (ungrouped.length === 0 && groups.length > 0) {
            ungroupedList.innerHTML = '<div class="inv-empty">Todos los invitados estan asignados a un grupo</div>';
        } else {
            renderVGuestsInList(ungroupedList, ungrouped);
        }

        ungroupedSection.style.display = '';
        setupDropZone(ungroupedSection, null);
    }

    // ── Render virtual guests grouped by familia within a list ──
    function renderVGuestsInList(listEl, guestList) {
        const familias = {};
        const noFamilia = [];

        // Sort: matched first
        const sorted = [...guestList].sort((a, b) => {
            const am = matches[a.id] ? 0 : 1;
            const bm = matches[b.id] ? 0 : 1;
            return am - bm || a.nombre.localeCompare(b.nombre);
        });

        sorted.forEach(vg => {
            const fam = vGuestFamilias[vg.id];
            if (fam) {
                if (!familias[fam]) familias[fam] = [];
                familias[fam].push(vg);
            } else {
                noFamilia.push(vg);
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
            members.forEach(vg => block.appendChild(createVGuestRow(vg)));
            listEl.appendChild(block);
        });

        // Render loose guests
        noFamilia.forEach(vg => listEl.appendChild(createVGuestRow(vg)));
    }

    function createVGuestRow(vg) {
        const isMatched = !!matches[vg.id];
        const matchedReal = isMatched ? realGuests.find(r => String(r.id) === String(matches[vg.id])) : null;
        const initials = ((vg.nombre || '')[0] || '') + ((vg.apellidos || '')[0] || '');
        const famName = vGuestFamilias[vg.id] || '';

        const row = document.createElement('div');
        row.className = `vguest ${isMatched ? 'vguest--matched' : 'vguest--pending'}`;
        row.draggable = true;
        row.dataset.vguestId = vg.id;

        row.innerHTML = `
            <div class="inv-guest__drag" title="Arrastra para mover">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
            </div>
            <div class="vguest__avatar">${initials.toUpperCase()}</div>
            <div class="vguest__info">
                <div class="vguest__name">${esc(vg.nombre)} ${esc(vg.apellidos)}</div>
                <div class="vguest__meta">
                    ${famName ? `<span class="inv-guest__fam-tag">${esc(famName)}</span>` : ''}
                    ${isMatched && matchedReal
                        ? `Registrado: ${esc(matchedReal.nombre)} ${esc(matchedReal.apellidos)}`
                        : 'Sin confirmar'}
                </div>
            </div>
            <div class="inv-guest__badges">${badgesHtml(vg)}</div>
            <span class="vguest__match-tag ${isMatched ? 'vguest__match-tag--green' : 'vguest__match-tag--gray'}">
                ${isMatched
                    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg> Match'
                    : 'Pendiente'}
            </span>
            <div class="vguest__actions">
                <button class="vguest__btn vguest__btn--link" title="Vincular">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                </button>
                <button class="vguest__btn vguest__btn--edit" title="Editar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="vguest__btn vguest__btn--delete" title="Eliminar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        `;

        // Link button → match modal
        row.querySelector('.vguest__btn--link').addEventListener('click', (e) => {
            e.stopPropagation();
            openMatchModal(vg);
        });

        // Edit button → edit modal
        row.querySelector('.vguest__btn--edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(vg);
        });

        // Delete
        row.querySelector('.vguest__btn--delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm(`Eliminar a ${vg.nombre} ${vg.apellidos}?`)) return;
            virtualGuests = virtualGuests.filter(v => v.id !== vg.id);
            delete matches[vg.id];
            delete vGuestGroups[vg.id];
            delete vGuestFamilias[vg.id];
            save(); saveVGuestGroups(); saveVGuestFamilias(); render();
        });

        // Click row → match modal
        row.addEventListener('click', () => openMatchModal(vg));

        // Drag — moves familia block
        row.addEventListener('dragstart', (e) => {
            const ids = getFamiliaMembers(vg.id);
            e.dataTransfer.setData('application/json', JSON.stringify(ids));
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('vguest--dragging');
            ids.forEach(id => {
                const el = document.querySelector(`.vguest[data-vguest-id="${id}"]`);
                if (el) el.classList.add('vguest--dragging');
            });
            setTimeout(() => {
                document.querySelectorAll('.inv-group').forEach(g => g.classList.add('inv-group--drop-ready'));
            }, 0);
        });

        row.addEventListener('dragend', () => {
            document.querySelectorAll('.vguest--dragging').forEach(r => r.classList.remove('vguest--dragging'));
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
                if (groupId) vGuestGroups[id] = groupId;
                else delete vGuestGroups[id];
            });
            saveVGuestGroups();
            render();
        });
    }

    // ── Auto-match all ──
    document.getElementById('btn-auto-match').addEventListener('click', () => {
        let found = 0;
        virtualGuests.forEach(vg => {
            if (matches[vg.id]) return;
            const best = findBestMatch(vg);
            if (best) {
                matches[vg.id] = String(best.id);
                syncFromReal(vg, best);
                found++;
            }
        });
        save(); render();
        alert(found > 0 ? `${found} match(es) encontrados automaticamente.` : 'No se encontraron nuevos matches.');
    });

    // ── Manual Match Modal ──
    let currentVGuest = null;

    function openMatchModal(vg) {
        currentVGuest = vg;
        document.getElementById('match-for').querySelector('strong').textContent = `${vg.nombre} ${vg.apellidos}`;
        document.getElementById('match-search').value = '';
        document.getElementById('match-unlink').style.display = matches[vg.id] ? 'inline-flex' : 'none';
        renderMatchResults('');
        document.getElementById('match-modal').classList.add('active');
        document.getElementById('match-search').focus();
    }

    function renderMatchResults(query) {
        const container = document.getElementById('match-results');
        const matchedRealIds = new Set(Object.values(matches));
        const q = normalize(query);

        let candidates = realGuests.map(rg => {
            const fullName = `${rg.nombre} ${rg.apellidos}`;
            const score = q ? similarity(fullName, query) : similarity(fullName, `${currentVGuest.nombre} ${currentVGuest.apellidos}`);
            const alreadyMatched = matchedRealIds.has(String(rg.id)) && String(matches[currentVGuest.id]) !== String(rg.id);
            return { ...rg, score, alreadyMatched };
        });

        if (q) {
            candidates = candidates.filter(c => normalize(`${c.nombre} ${c.apellidos}`).includes(q) || c.score > 0.3);
        }

        candidates.sort((a, b) => b.score - a.score);

        container.innerHTML = candidates.slice(0, 20).map(rg => {
            const initials = ((rg.nombre || '')[0] || '') + ((rg.apellidos || '')[0] || '');
            const isCurrent = String(matches[currentVGuest.id]) === String(rg.id);
            return `
                <div class="match-result" data-real-id="${rg.id}" ${rg.alreadyMatched ? 'style="opacity:0.4"' : ''}>
                    <div class="match-result__avatar">${initials.toUpperCase()}</div>
                    <div class="match-result__info">
                        <div class="match-result__name">${esc(rg.nombre)} ${esc(rg.apellidos)}</div>
                        <div class="match-result__detail">${rg.menu || '\u2014'} · ${rg.autobus || '\u2014'}${rg.alreadyMatched ? ' · Ya vinculado' : ''}</div>
                    </div>
                    <span class="match-result__pick">${isCurrent ? '\u2713 Vinculado' : 'Elegir'}</span>
                </div>
            `;
        }).join('') || '<p style="text-align:center;color:#999;padding:20px">No hay registros que coincidan</p>';

        container.querySelectorAll('.match-result').forEach(el => {
            el.addEventListener('click', () => {
                const realId = el.dataset.realId;
                const realGuest = realGuests.find(r => String(r.id) === realId);
                matches[currentVGuest.id] = realId;
                if (realGuest) syncFromReal(currentVGuest, realGuest);
                save(); render();
                document.getElementById('match-modal').classList.remove('active');
            });
        });
    }

    document.getElementById('match-search').addEventListener('input', (e) => {
        renderMatchResults(e.target.value);
    });

    document.getElementById('match-cancel').addEventListener('click', () => {
        document.getElementById('match-modal').classList.remove('active');
    });

    document.getElementById('match-unlink').addEventListener('click', () => {
        if (currentVGuest) {
            delete matches[currentVGuest.id];
            save(); render();
        }
        document.getElementById('match-modal').classList.remove('active');
    });

    // ── Edit Virtual Guest Modal ──
    function populateGroupSelect(selEl, selectedGroupId) {
        selEl.innerHTML = '<option value="">Sin grupo</option>';
        groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            if (g.id === selectedGroupId) opt.selected = true;
            selEl.appendChild(opt);
        });
    }

    function populateFamiliaDatalist() {
        const dl = document.getElementById('vfamilias-list');
        if (!dl) return;
        const unique = [...new Set(Object.values(vGuestFamilias).filter(Boolean))];
        dl.innerHTML = unique.map(f => `<option value="${esc(f)}">`).join('');
    }

    function openEditModal(vg) {
        document.getElementById('edit-modal-title').textContent = 'Editar invitado virtual';
        document.getElementById('edit-id').value = vg.id;
        document.getElementById('ef-nombre').value = vg.nombre || '';
        document.getElementById('ef-apellidos').value = vg.apellidos || '';
        document.getElementById('ef-menu').value = vg.menu || '';
        document.getElementById('ef-autobus').value = vg.autobus || '';
        document.getElementById('ef-alergias').value = vg.alergias || '';
        document.getElementById('ef-familia').value = vGuestFamilias[vg.id] || '';
        document.getElementById('edit-delete').style.display = 'inline-flex';
        populateGroupSelect(document.getElementById('ef-grupo'), vGuestGroups[vg.id] || '');
        populateFamiliaDatalist();
        document.getElementById('edit-modal').classList.add('active');
        document.getElementById('ef-nombre').focus();
    }

    function closeEditModal() {
        document.getElementById('edit-modal').classList.remove('active');
    }

    document.getElementById('edit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const vg = virtualGuests.find(v => v.id === id);
        if (!vg) return;

        const nombre = document.getElementById('ef-nombre').value.trim();
        if (!nombre) return;

        vg.nombre = nombre;
        vg.apellidos = document.getElementById('ef-apellidos').value.trim();
        vg.menu = document.getElementById('ef-menu').value || null;
        vg.autobus = document.getElementById('ef-autobus').value || null;
        vg.alergias = document.getElementById('ef-alergias').value.trim() || null;

        // Group
        const groupId = document.getElementById('ef-grupo').value;
        if (groupId) vGuestGroups[vg.id] = groupId;
        else delete vGuestGroups[vg.id];

        // Familia
        const fam = document.getElementById('ef-familia').value.trim();
        if (fam) vGuestFamilias[vg.id] = fam;
        else delete vGuestFamilias[vg.id];

        save(); saveVGuestGroups(); saveVGuestFamilias(); render();
        closeEditModal();
    });

    document.getElementById('edit-delete').addEventListener('click', () => {
        const id = document.getElementById('edit-id').value;
        const vg = virtualGuests.find(v => v.id === id);
        if (!vg || !confirm(`Eliminar a ${vg.nombre} ${vg.apellidos}?`)) return;
        virtualGuests = virtualGuests.filter(v => v.id !== id);
        delete matches[id];
        delete vGuestGroups[id];
        delete vGuestFamilias[id];
        save(); saveVGuestGroups(); saveVGuestFamilias(); render();
        closeEditModal();
    });

    document.getElementById('edit-cancel').addEventListener('click', closeEditModal);

    // ── Group Modal ──
    let selectedColor = '#C9A96E';

    document.getElementById('btn-add-group').addEventListener('click', () => {
        document.getElementById('g-nombre').value = '';
        selectedColor = '#C9A96E';
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        const defaultDot = document.querySelector('.color-dot[data-color="#C9A96E"]');
        if (defaultDot) defaultDot.classList.add('active');
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

    // ── Import ──
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-text').value = '';
        document.getElementById('import-file').value = '';
        document.getElementById('import-modal').classList.add('active');
    });

    document.getElementById('import-cancel').addEventListener('click', () => {
        document.getElementById('import-modal').classList.remove('active');
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { document.getElementById('import-text').value = reader.result; };
        reader.readAsText(file);
    });

    document.getElementById('import-confirm').addEventListener('click', () => {
        const text = document.getElementById('import-text').value.trim();
        if (!text) return;

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let added = 0;

        lines.forEach(line => {
            if (/^nombre/i.test(line)) return;

            let parts = line.split(/[\t;]/);
            if (parts.length < 2) parts = line.split(',');
            if (parts.length < 2) {
                const idx = line.lastIndexOf(' ');
                if (idx > 0) parts = [line.slice(0, idx), line.slice(idx + 1)];
                else parts = [line, ''];
            }

            const nombre = parts[0].trim();
            const apellidos = parts.slice(1).join(' ').trim();

            if (!nombre) return;

            const exists = virtualGuests.some(v =>
                normalize(v.nombre) === normalize(nombre) &&
                normalize(v.apellidos) === normalize(apellidos)
            );
            if (exists) return;

            virtualGuests.push({
                id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                nombre,
                apellidos,
                menu: null,
                autobus: null,
                alergias: null,
            });
            added++;
        });

        save(); render();
        document.getElementById('import-modal').classList.remove('active');
        alert(`${added} invitado(s) importado(s).`);
    });

    // ── Quick Add ──
    document.getElementById('btn-quick-add').addEventListener('click', () => {
        document.getElementById('qa-nombre').value = '';
        document.getElementById('qa-apellidos').value = '';
        document.getElementById('quickadd-modal').classList.add('active');
        document.getElementById('qa-nombre').focus();
    });

    document.getElementById('qa-cancel').addEventListener('click', () => {
        document.getElementById('quickadd-modal').classList.remove('active');
    });

    document.getElementById('qa-save').addEventListener('click', () => {
        const nombre = document.getElementById('qa-nombre').value.trim();
        const apellidos = document.getElementById('qa-apellidos').value.trim();
        if (!nombre) return;

        virtualGuests.push({
            id: 'v_' + Date.now(),
            nombre,
            apellidos: apellidos || '',
            menu: null,
            autobus: null,
            alergias: null,
        });
        save(); render();

        // Keep modal open for rapid entry
        document.getElementById('qa-nombre').value = '';
        document.getElementById('qa-apellidos').value = '';
        document.getElementById('qa-nombre').focus();
    });

    // ── Logout ──
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('admin_auth');
        localStorage.removeItem('admin_token');
        window.location.href = 'index.html';
    });

    // Close modals on overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    async function init() {
        await fetchRealGuests();
        render();
    }
    init();
})();
