/* ══════════════════════════════════════════════
   ADMIN DASHBOARD — Logic
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://lpatzgviideumccecfew.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY2MDMsImV4cCI6MjA5MDA5MjYwM30.jWQrW6FqArq87w50YALA9CUxahyPzwHBQLd9kI7U4qY';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNjYwMywiZXhwIjoyMDkwMDkyNjAzfQ.-CM_Wku1-fWqtbz8flSb3MFabrxFnoED047cT81hgAs';

    // ── Logout ──
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('admin_auth');
        localStorage.removeItem('admin_token');
        window.location.href = 'index.html';
    });

    // ── Load guests ──
    async function loadGuests() {
        let guests = [];

        if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/guests?order=created_at.desc`, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    },
                });
                guests = await res.json();
            } catch (err) {
                console.warn('Supabase fetch failed:', err);
            }
        }

        // Fallback to localStorage
        if (!guests.length) {
            guests = JSON.parse(localStorage.getItem('wedding_guests') || '[]');
        }

        renderDashboard(guests);
    }

    function isConfirmed(guestId) {
        const matches = JSON.parse(localStorage.getItem('wedding_matches') || '{}');
        return Object.values(matches).includes(String(guestId));
    }

    // ── Render ──
    function renderDashboard(guests) {
        // Stats
        document.getElementById('stat-total').textContent = guests.length;
        const busCount = guests.filter(g => g.autobus && g.autobus !== 'no').length;
        document.getElementById('stat-bus').textContent = busCount;
        const allergyCount = guests.filter(g => g.alergias).length;
        document.getElementById('stat-allergies').textContent = allergyCount;

        // Menu chart
        const menuCounts = { carne: 0, pescado: 0, vegetariano: 0, vegano: 0 };
        guests.forEach(g => { if (g.menu && menuCounts[g.menu] !== undefined) menuCounts[g.menu]++; });
        const menuColors = { carne: '#c62828', pescado: '#1565c0', vegetariano: '#2e7d32', vegano: '#558b2f' };
        renderChart('menu-chart', menuCounts, menuColors, guests.length);

        // Transport chart
        const transportCounts = { 'plaza-castilla': 0, 'alcobendas': 0, 'no': 0 };
        const transportLabels = { 'plaza-castilla': 'Plaza Castilla', 'alcobendas': 'Alcobendas', 'no': 'Propio' };
        guests.forEach(g => { if (g.autobus && transportCounts[g.autobus] !== undefined) transportCounts[g.autobus]++; });
        const transportColors = { 'plaza-castilla': '#C9A96E', 'alcobendas': '#7D8C6C', 'no': '#999' };
        renderChart('transport-chart', transportCounts, transportColors, guests.length, transportLabels);

        // Table
        const tbody = document.getElementById('guests-tbody');
        const emptyMsg = document.getElementById('table-empty');

        if (!guests.length) {
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';
        tbody.innerHTML = guests.map(g => {
            const menuBadge = g.menu ? `<span class="badge badge--${g.menu}">${capitalize(g.menu)}</span>` : '-';
            const busBadge = g.autobus === 'no'
                ? '<span class="badge badge--car">Propio</span>'
                : `<span class="badge badge--bus">${g.autobus === 'plaza-castilla' ? 'P. Castilla' : 'Alcobendas'}</span>`;
            const date = g.created_at ? new Date(g.created_at).toLocaleDateString('es-ES') : '-';

            const confirmed = isConfirmed(g.id);
            const confirmBadge = confirmed
                ? '<span class="badge" style="background:#e8f5e9;color:#2e7d32">✓ Vinculado</span>'
                : '<span class="badge" style="background:#f5f5f5;color:#999">Pendiente</span>';

            return `<tr${confirmed ? ' style="background:#f6fef6"' : ''}>
                <td><strong>${esc(g.nombre)}</strong> ${esc(g.apellidos)}</td>
                <td>${busBadge}</td>
                <td>${menuBadge}</td>
                <td>${g.alergias ? esc(g.alergias) : '<span style="color:#ccc">—</span>'}</td>
                <td>${confirmBadge}</td>
                <td style="color:#999;font-size:0.8rem">${date}</td>
            </tr>`;
        }).join('');
    }

    function renderChart(containerId, counts, colors, total, labelOverrides) {
        const container = document.getElementById(containerId);
        const max = Math.max(...Object.values(counts), 1);

        container.innerHTML = Object.entries(counts).map(([key, val]) => {
            const pct = total > 0 ? (val / total) * 100 : 0;
            const label = labelOverrides ? (labelOverrides[key] || key) : capitalize(key);
            return `<div class="chart-bar">
                <span class="chart-bar__label">${label}</span>
                <div class="chart-bar__track">
                    <div class="chart-bar__fill" style="width:${pct}%;background:${colors[key]}"></div>
                </div>
                <span class="chart-bar__count">${val}</span>
            </div>`;
        }).join('');
    }

    // ── Export CSV ──
    document.getElementById('export-csv').addEventListener('click', () => {
        let guests = JSON.parse(localStorage.getItem('wedding_guests') || '[]');
        if (!guests.length) { alert('No hay datos para exportar'); return; }

        const headers = ['Nombre', 'Apellidos', 'Email', 'Autobus', 'Menu', 'Alergias', 'Fecha'];
        const rows = guests.map(g => [
            g.nombre, g.apellidos, g.email, g.autobus, g.menu, g.alergias || '', g.created_at || ''
        ]);

        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invitados_boda_sj_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // ── Helpers ──
    function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

    // ── Init ──
    loadGuests();
})();
