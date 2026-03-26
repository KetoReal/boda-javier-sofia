/* ══════════════════════════════════════════════
   SIMULACIÓN — Virtual guests + auto/manual match
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://lpatzgviideumccecfew.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY2MDMsImV4cCI6MjA5MDA5MjYwM30.jWQrW6FqArq87w50YALA9CUxahyPzwHBQLd9kI7U4qY';

    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNjYwMywiZXhwIjoyMDkwMDkyNjAzfQ.-CM_Wku1-fWqtbz8flSb3MFabrxFnoED047cT81hgAs';

    let realGuests = [];
    let virtualGuests = JSON.parse(localStorage.getItem('wedding_virtual_guests') || '[]');
    let matches = JSON.parse(localStorage.getItem('wedding_matches') || '{}');

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
    }

    // ── Normalize for matching ──
    function normalize(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function similarity(a, b) {
        const na = normalize(a), nb = normalize(b);
        if (na === nb) return 1;
        if (na.includes(nb) || nb.includes(na)) return 0.8;
        // Word overlap
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
            if (matchedRealIds.has(String(rg.id))) return; // Already matched
            const rName = `${rg.nombre} ${rg.apellidos}`;
            const score = similarity(vName, rName);
            if (score > bestScore) {
                bestScore = score;
                best = rg;
            }
        });

        return bestScore >= 0.6 ? best : null;
    }

    // ── Render ──
    function render() {
        const list = document.getElementById('vguests-list');
        const empty = document.getElementById('sim-empty');

        const matchedCount = Object.keys(matches).length;
        document.getElementById('stat-total').textContent = virtualGuests.length;
        document.getElementById('stat-matched').textContent = matchedCount;
        document.getElementById('stat-pending').textContent = virtualGuests.length - matchedCount;

        if (virtualGuests.length === 0) {
            list.innerHTML = '';
            empty.style.display = '';
            return;
        }

        empty.style.display = 'none';

        // Sort: matched first, then pending
        const sorted = [...virtualGuests].sort((a, b) => {
            const am = matches[a.id] ? 0 : 1;
            const bm = matches[b.id] ? 0 : 1;
            return am - bm || a.nombre.localeCompare(b.nombre);
        });

        list.innerHTML = '';
        sorted.forEach(vg => {
            const isMatched = !!matches[vg.id];
            const matchedReal = isMatched ? realGuests.find(r => String(r.id) === String(matches[vg.id])) : null;
            const initials = ((vg.nombre || '')[0] || '') + ((vg.apellidos || '')[0] || '');

            const row = document.createElement('div');
            row.className = `vguest ${isMatched ? 'vguest--matched' : 'vguest--pending'}`;

            row.innerHTML = `
                <div class="vguest__avatar">${initials.toUpperCase()}</div>
                <div class="vguest__info">
                    <div class="vguest__name">${esc(vg.nombre)} ${esc(vg.apellidos)}</div>
                    <div class="vguest__meta">
                        ${isMatched && matchedReal
                            ? `Registrado: ${esc(matchedReal.nombre)} ${esc(matchedReal.apellidos)} · ${matchedReal.menu || '—'}`
                            : 'Sin confirmar'}
                    </div>
                </div>
                <span class="vguest__match-tag ${isMatched ? 'vguest__match-tag--green' : 'vguest__match-tag--gray'}">
                    ${isMatched
                        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg> Match'
                        : 'Pendiente'}
                </span>
                <div class="vguest__actions">
                    <button class="vguest__btn vguest__btn--link" title="Vincular">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    </button>
                    <button class="vguest__btn vguest__btn--edit" title="Editar nombre">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="vguest__btn vguest__btn--delete" title="Eliminar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            `;

            // Link button
            row.querySelector('.vguest__btn--link').addEventListener('click', (e) => {
                e.stopPropagation();
                openMatchModal(vg);
            });

            // Edit button
            row.querySelector('.vguest__btn--edit').addEventListener('click', (e) => {
                e.stopPropagation();
                const newName = prompt('Nombre:', vg.nombre);
                if (newName === null) return;
                const newApellidos = prompt('Apellidos:', vg.apellidos);
                if (newApellidos === null) return;
                vg.nombre = newName.trim() || vg.nombre;
                vg.apellidos = newApellidos.trim();
                save(); render();
            });

            // Delete
            row.querySelector('.vguest__btn--delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (!confirm(`¿Eliminar a ${vg.nombre} ${vg.apellidos}?`)) return;
                virtualGuests = virtualGuests.filter(v => v.id !== vg.id);
                delete matches[vg.id];
                save(); render();
            });

            row.addEventListener('click', () => openMatchModal(vg));
            list.appendChild(row);
        });
    }

    // ── Auto-match all ──
    document.getElementById('btn-auto-match').addEventListener('click', () => {
        let found = 0;
        virtualGuests.forEach(vg => {
            if (matches[vg.id]) return; // Already matched
            const best = findBestMatch(vg);
            if (best) {
                matches[vg.id] = String(best.id);
                found++;
            }
        });
        save(); render();
        alert(found > 0 ? `${found} match(es) encontrados automáticamente.` : 'No se encontraron nuevos matches.');
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

        // Show all real guests, sorted by relevance
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
                        <div class="match-result__detail">${rg.menu || '—'} · ${rg.autobus || '—'}${rg.alreadyMatched ? ' · Ya vinculado' : ''}</div>
                    </div>
                    <span class="match-result__pick">${isCurrent ? '✓ Vinculado' : 'Elegir'}</span>
                </div>
            `;
        }).join('') || '<p style="text-align:center;color:#999;padding:20px">No hay registros que coincidan</p>';

        // Click to match
        container.querySelectorAll('.match-result').forEach(el => {
            el.addEventListener('click', () => {
                const realId = el.dataset.realId;
                matches[currentVGuest.id] = realId;
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
            // Skip header rows
            if (/^nombre/i.test(line)) return;

            // Split by tab, comma, or semicolon
            let parts = line.split(/[\t;]/);
            if (parts.length < 2) parts = line.split(',');
            if (parts.length < 2) {
                // Try splitting by last space
                const idx = line.lastIndexOf(' ');
                if (idx > 0) parts = [line.slice(0, idx), line.slice(idx + 1)];
                else parts = [line, ''];
            }

            const nombre = parts[0].trim();
            const apellidos = parts.slice(1).join(' ').trim();

            if (!nombre) return;

            // Check duplicates
            const exists = virtualGuests.some(v =>
                normalize(v.nombre) === normalize(nombre) &&
                normalize(v.apellidos) === normalize(apellidos)
            );
            if (exists) return;

            virtualGuests.push({
                id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                nombre,
                apellidos,
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
