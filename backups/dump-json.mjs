// Backup via Supabase REST API → JSON dump
// Uso: node backups/dump-json.mjs
// Guarda: backups/boda-snapshot-YYYYMMDD-HHmm/*.json

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://lpatzgviideumccecfew.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNjYwMywiZXhwIjoyMDkwMDkyNjAzfQ.-CM_Wku1-fWqtbz8flSb3MFabrxFnoED047cT81hgAs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TABLES = ['guests', 'virtual_guests', 'guest_groups', 'tables', 'mesa_assignments'];

function ts() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function fetchAll(table) {
    const res = await fetch(`${BASE}/rest/v1/${table}?select=*&order=created_at.asc&limit=10000`, {
        headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    return res.json();
}

const snapshotDir = resolve(__dirname, `boda-snapshot-${ts()}`);
await mkdir(snapshotDir, { recursive: true });

const summary = {};
for (const table of TABLES) {
    try {
        const rows = await fetchAll(table);
        const file = resolve(snapshotDir, `${table}.json`);
        await writeFile(file, JSON.stringify(rows, null, 2));
        summary[table] = rows.length;
        console.log(`✔ ${table}: ${rows.length} filas → ${file}`);
    } catch (err) {
        summary[table] = `ERROR: ${err.message}`;
        console.error(`✖ ${table}: ${err.message}`);
    }
}

await writeFile(resolve(snapshotDir, '_summary.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    supabase_ref: 'lpatzgviideumccecfew',
    counts: summary,
}, null, 2));

console.log(`\nBackup completo en: ${snapshotDir}`);
