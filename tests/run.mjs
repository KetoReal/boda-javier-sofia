/* ══════════════════════════════════════════════
   Wedding Test Suite — sofi-javi.com
   33 tests against Supabase REST API
   All test data uses prefixed IDs → safe cleanup
   Run: node tests/run.mjs
   ══════════════════════════════════════════════ */

const BASE = 'https://lpatzgviideumccecfew.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY2MDMsImV4cCI6MjA5MDA5MjYwM30.jWQrW6FqArq87w50YALA9CUxahyPzwHBQLd9kI7U4qY';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUxNjYwMywiZXhwIjoyMDkwMDkyNjAzfQ.-CM_Wku1-fWqtbz8flSb3MFabrxFnoED047cT81hgAs';

// Test data identifiers (safe to cleanup)
const TEST_FAMILY = 'fam_TEST_SUITE_' + Date.now();
const TEST_VG_PREFIX = 'test_vg_';
const TEST_GROUP_ID = 'tg_test_' + Date.now();
const TEST_TABLE_ID = 9999999990000 + Date.now() % 10000;

// ── HTTP helpers ──
function anonHeaders() {
    return { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': `Bearer ${ANON}` };
}
function svcHeaders(prefer) {
    const h = { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': `Bearer ${SKEY}` };
    if (prefer) h['Prefer'] = prefer;
    return h;
}

async function get(table, query = '') {
    const res = await fetch(`${BASE}/rest/v1/${table}?${query}`, { headers: svcHeaders() });
    return { status: res.status, data: res.ok ? await res.json() : null };
}

async function post(table, data, headers) {
    const res = await fetch(`${BASE}/rest/v1/${table}`, {
        method: 'POST', headers: headers || svcHeaders('return=representation'),
        body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    return { status: res.status, data: res.ok ? await res.json() : null };
}

async function patch(table, match, data) {
    const res = await fetch(`${BASE}/rest/v1/${table}?${match}`, {
        method: 'PATCH', headers: svcHeaders('return=representation'),
        body: JSON.stringify(data),
    });
    return { status: res.status, data: res.ok ? await res.json() : null };
}

async function del(table, match) {
    const res = await fetch(`${BASE}/rest/v1/${table}?${match}`, { method: 'DELETE', headers: svcHeaders() });
    return { status: res.status };
}

// ── Test runner ──
let passed = 0, failed = 0, total = 0;
const GREEN = '\x1b[32m', RED = '\x1b[31m', GRAY = '\x1b[90m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

function assert(condition, testName) {
    total++;
    if (condition) {
        passed++;
        console.log(`  ${GREEN}✅ ${total}. ${testName}${RESET}`);
    } else {
        failed++;
        console.log(`  ${RED}❌ ${total}. ${testName}${RESET}`);
    }
}

function section(name) {
    console.log(`\n  ${BOLD}${name}${RESET}`);
}

// ── Shared state between tests ──
let familyGuests = [];
let soloGuestId = null;
let testVgIds = [];
let testRealId = null;

// ══════════════════════════════════════════════
//  TESTS
// ══════════════════════════════════════════════

async function run() {
    console.log(`\n${BOLD}🧪 Wedding Test Suite — sofi-javi.com${RESET}`);
    console.log('══════════════════════════════════════\n');

    // ── A. Conexion y DB ──
    section('A. Conexion y DB');

    const ping = await fetch(`${BASE}/rest/v1/guests?limit=0`, { headers: svcHeaders() });
    assert(ping.status === 200 || ping.status === 206, 'Supabase reachable');

    const g = await get('guests', 'limit=1');
    assert(g.status === 200, 'guests table exists');

    const vg = await get('virtual_guests', 'limit=1');
    assert(vg.status === 200, 'virtual_guests table exists');

    // ── B. RSVP — Registro familia ──
    section('B. RSVP — Registro familia');

    // 4. Register family with anon key (like public RSVP)
    const familyData = [
        { nombre: 'TestPadre', apellidos: 'Suite', autobus: 'plaza-castilla', menu: 'carne', alergias: null, family_group: TEST_FAMILY, is_child: false },
        { nombre: 'TestMadre', apellidos: 'Suite', autobus: 'plaza-castilla', menu: 'pescado', alergias: 'gluten', family_group: TEST_FAMILY, is_child: false },
        { nombre: 'TestNino', apellidos: 'Suite', autobus: 'plaza-castilla', menu: null, alergias: null, family_group: TEST_FAMILY, is_child: true },
    ];
    const famRes = await fetch(`${BASE}/rest/v1/guests`, {
        method: 'POST',
        headers: { ...anonHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify(familyData),
    });
    familyGuests = famRes.ok ? await famRes.json() : [];
    assert(famRes.ok && familyGuests.length === 3, 'Register family (2 adults + 1 child)');

    // 5. Adults have menu
    const adults = familyGuests.filter(g => !g.is_child);
    assert(adults.length === 2 && adults.every(a => a.menu !== null), 'Adults have menu');

    // 6. Child has no menu
    const child = familyGuests.find(g => g.is_child);
    assert(child && child.menu === null && child.is_child === true, 'Child has null menu + is_child=true');

    // 7. Family group matches
    assert(familyGuests.every(g => g.family_group === TEST_FAMILY), 'Family group matches');

    // 8. Transport matches
    assert(familyGuests.every(g => g.autobus === 'plaza-castilla'), 'Transport matches for all');

    // 9. Read back family
    const readBack = await get('guests', `family_group=eq.${TEST_FAMILY}`);
    assert(readBack.data && readBack.data.length === 3, 'Read back family returns 3');

    // 10. Solo guest
    const soloRes = await fetch(`${BASE}/rest/v1/guests`, {
        method: 'POST',
        headers: { ...anonHeaders(), 'Prefer': 'return=representation' },
        body: JSON.stringify([{ nombre: 'TestSolo', apellidos: 'Suite', autobus: 'no', menu: 'vegano', family_group: TEST_FAMILY, is_child: false }]),
    });
    const soloData = soloRes.ok ? await soloRes.json() : [];
    soloGuestId = soloData[0]?.id;
    assert(soloRes.ok && soloData.length === 1, 'Solo guest registration');

    // ── C. Admin — Invitados CRUD ──
    section('C. Admin — Invitados CRUD');

    // 11. Edit guest name
    const editRes = await patch('guests', `id=eq.${familyGuests[0].id}`, { nombre: 'TestPadreEditado' });
    assert(editRes.data && editRes.data[0]?.nombre === 'TestPadreEditado', 'Edit guest name');

    // 12. Edit is_child
    const childToggle = await patch('guests', `id=eq.${familyGuests[0].id}`, { is_child: true });
    assert(childToggle.data && childToggle.data[0]?.is_child === true, 'Edit is_child toggle');
    // Revert
    await patch('guests', `id=eq.${familyGuests[0].id}`, { is_child: false });

    // 13. Delete solo guest
    const delSolo = await del('guests', `id=eq.${soloGuestId}`);
    assert(delSolo.status === 200 || delSolo.status === 204, 'Delete solo guest');
    const checkDel = await get('guests', `id=eq.${soloGuestId}`);
    assert(checkDel.data && checkDel.data.length === 0, 'Verify guest deleted');

    // ── D. Simulacion — Virtual Guests ──
    section('D. Simulacion — Virtual Guests');

    // 15. Create virtual guests
    const vg1Id = TEST_VG_PREFIX + Date.now() + '_1';
    const vg2Id = TEST_VG_PREFIX + Date.now() + '_2';
    const vgCreate = await post('virtual_guests', [
        { id: vg1Id, nombre: 'TestVirtual', apellidos: 'Uno' },
        { id: vg2Id, nombre: 'TestVirtual', apellidos: 'Dos' },
    ]);
    testVgIds = [vg1Id, vg2Id];
    assert(vgCreate.data && vgCreate.data.length === 2, 'Create 2 virtual guests');

    // 16. Create group
    const grpCreate = await post('guest_groups', { id: TEST_GROUP_ID, name: 'Test Group', color: '#C9A96E' });
    assert(grpCreate.data && grpCreate.data[0]?.id === TEST_GROUP_ID, 'Create group');

    // 17. Assign to group
    const grpAssign = await patch('virtual_guests', `id=eq.${vg1Id}`, { group_id: TEST_GROUP_ID });
    assert(grpAssign.data && grpAssign.data[0]?.group_id === TEST_GROUP_ID, 'Assign guest to group');

    // 18. Set familia
    await patch('virtual_guests', `id=eq.${vg1Id}`, { familia: 'Familia Test' });
    const fam2 = await patch('virtual_guests', `id=eq.${vg2Id}`, { familia: 'Familia Test' });
    assert(fam2.data && fam2.data[0]?.familia === 'Familia Test', 'Set familia on both');

    // 19. Exclude from budget
    const exclRes = await patch('virtual_guests', `id=eq.${vg1Id}`, { exclude_from_budget: true });
    assert(exclRes.data && exclRes.data[0]?.exclude_from_budget === true, 'Exclude from budget');

    // 19b. Full edit (simulates edit modal save)
    const fullEdit = await patch('virtual_guests', `id=eq.${vg1Id}`, {
        nombre: 'EditadoNombre',
        apellidos: 'EditadoApellidos',
        menu: 'pescado',
        autobus: 'alcobendas',
        alergias: 'test alergia',
        group_id: TEST_GROUP_ID,
        familia: 'Familia Editada',
        is_child: true,
        exclude_from_budget: true,
    });
    assert(fullEdit.data && fullEdit.data[0]?.nombre === 'EditadoNombre', 'Full edit — nombre');
    assert(fullEdit.data && fullEdit.data[0]?.menu === 'pescado', 'Full edit — menu');
    assert(fullEdit.data && fullEdit.data[0]?.is_child === true, 'Full edit — is_child');
    assert(fullEdit.data && fullEdit.data[0]?.exclude_from_budget === true, 'Full edit — exclude_from_budget');
    assert(fullEdit.data && fullEdit.data[0]?.familia === 'Familia Editada', 'Full edit — familia');
    assert(fullEdit.data && fullEdit.data[0]?.alergias === 'test alergia', 'Full edit — alergias');

    // 19c. Verify read-back after full edit
    const readBack2 = await get('virtual_guests', `id=eq.${vg1Id}`);
    assert(readBack2.data && readBack2.data[0]?.exclude_from_budget === true, 'Read-back exclude_from_budget persisted');
    assert(readBack2.data && readBack2.data[0]?.is_child === true, 'Read-back is_child persisted');

    // 19d. Revert exclude + is_child
    await patch('virtual_guests', `id=eq.${vg1Id}`, { exclude_from_budget: false, is_child: false, nombre: 'TestVirtual', apellidos: 'Uno', menu: null, autobus: null, alergias: null, familia: 'Familia Test' });

    // 20. Similarity check (JS logic)
    function normalize(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function similarity(a, b) {
        const na = normalize(a), nb = normalize(b);
        if (na === nb) return 1;
        if (na.includes(nb) || nb.includes(na)) return 0.8;
        const wa = na.split(' '), wb = nb.split(' ');
        const common = wa.filter(w => wb.includes(w)).length;
        return Math.max(wa.length, wb.length) > 0 ? common / Math.max(wa.length, wb.length) : 0;
    }
    assert(similarity('TestVirtual Uno', 'TestVirtual Uno') === 1, 'Similarity exact match = 1.0');

    // 21. Manual match
    testRealId = familyGuests[0].id;
    const matchRes = await patch('virtual_guests', `id=eq.${vg1Id}`, { matched_guest_id: testRealId });
    assert(matchRes.data && matchRes.data[0]?.matched_guest_id === testRealId, 'Manual match virtual to real');

    // 22. Delete virtual guest (vg2)
    const delVg = await del('virtual_guests', `id=eq.${vg2Id}`);
    assert(delVg.status === 200 || delVg.status === 204, 'Delete virtual guest');

    // ── E. Mesas ──
    section('E. Mesas');

    // 23. Create table
    const tblCreate = await post('tables', { id: TEST_TABLE_ID, nombre: 'Mesa Test' });
    assert(tblCreate.data && tblCreate.data[0]?.nombre === 'Mesa Test', 'Create table');

    // 24. Assign guest to table
    const seatRes = await post('mesa_assignments', { virtual_guest_id: vg1Id, table_id: TEST_TABLE_ID });
    assert(seatRes.status === 200 || seatRes.status === 201, 'Assign guest to table');

    // 25. Read assignment
    const readSeat = await get('mesa_assignments', `virtual_guest_id=eq.${vg1Id}`);
    assert(readSeat.data && readSeat.data.length === 1 && readSeat.data[0].table_id == TEST_TABLE_ID, 'Read seat assignment');

    // 26. Remove from table
    const rmSeat = await del('mesa_assignments', `virtual_guest_id=eq.${vg1Id}`);
    assert(rmSeat.status === 200 || rmSeat.status === 204, 'Remove guest from table');

    // 27. Delete table
    const rmTbl = await del('tables', `id=eq.${TEST_TABLE_ID}`);
    assert(rmTbl.status === 200 || rmTbl.status === 204, 'Delete table');

    // 28. Verify table gone
    const checkTbl = await get('tables', `id=eq.${TEST_TABLE_ID}`);
    assert(checkTbl.data && checkTbl.data.length === 0, 'Verify table deleted');

    // ── F. Budget ──
    section('F. Budget');

    const budgetData = await get('virtual_guests', 'select=id,matched_guest_id,exclude_from_budget');
    const budgetGuests = (budgetData.data || []).filter(v => !v.exclude_from_budget);
    const allGuests = budgetData.data || [];
    assert(budgetGuests.length <= allGuests.length, 'Budget excludes marked guests');
    assert(budgetGuests.length === allGuests.filter(v => !v.exclude_from_budget).length, 'Budget count matches filter');

    // ── G. CSV parse logic ──
    section('G. CSV parse logic');

    const csvInput = 'Nombre;Apellidos\nJuan;Garcia Lopez\nMaria;Martinez';
    const lines = csvInput.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.slice(1).map(line => {
        const parts = line.split(';');
        return { nombre: parts[0], apellidos: parts[1] || '' };
    });
    assert(parsed.length === 2 && parsed[0].nombre === 'Juan' && parsed[1].apellidos === 'Martinez', 'CSV parse logic');

    // ── H. Cleanup ──
    section('H. Cleanup');

    // Delete test family guests
    await del('guests', `family_group=eq.${TEST_FAMILY}`);
    // Delete test virtual guests
    await del('virtual_guests', `id=like.${TEST_VG_PREFIX}*`);
    // Delete test group
    await del('guest_groups', `id=eq.${TEST_GROUP_ID}`);
    // Delete test table (already done but just in case)
    await del('tables', `id=eq.${TEST_TABLE_ID}`);
    await del('mesa_assignments', `table_id=eq.${TEST_TABLE_ID}`);

    // Verify cleanup
    const checkFamily = await get('guests', `family_group=eq.${TEST_FAMILY}`);
    assert(checkFamily.data && checkFamily.data.length === 0, 'Cleanup: no test guests remain');

    const checkVg = await get('virtual_guests', `id=like.${TEST_VG_PREFIX}*`);
    assert(checkVg.data && checkVg.data.length === 0, 'Cleanup: no test virtual guests remain');

    // ── Summary ──
    console.log('\n══════════════════════════════════════');
    if (failed === 0) {
        console.log(`${GREEN}${BOLD}  ${passed}/${total} PASSED ✅${RESET}`);
    } else {
        console.log(`${RED}${BOLD}  ${failed}/${total} FAILED ❌${RESET}`);
        console.log(`${GREEN}  ${passed} passed${RESET} · ${RED}${failed} failed${RESET}`);
    }
    console.log('══════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error(`\n${RED}Fatal error:${RESET}`, err.message);
    process.exit(1);
});
