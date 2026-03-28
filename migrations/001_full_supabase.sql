-- ══════════════════════════════════════════════
--  Boda Javier-Sofía: Full Supabase Migration
--  Run this in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════

-- 1. Virtual guests (the planning list)
CREATE TABLE IF NOT EXISTS virtual_guests (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellidos TEXT DEFAULT '',
    menu TEXT,
    autobus TEXT,
    alergias TEXT,
    matched_guest_id BIGINT REFERENCES guests(id) ON DELETE SET NULL,
    group_id TEXT,
    familia TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Guest groups for organizing virtual guests
CREATE TABLE IF NOT EXISTS guest_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#C9A96E',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Mesa assignments for virtual guests
--    (the existing table_assignments references real guests,
--     we need one for virtual guests)
CREATE TABLE IF NOT EXISTS mesa_assignments (
    virtual_guest_id TEXT PRIMARY KEY REFERENCES virtual_guests(id) ON DELETE CASCADE,
    table_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add foreign key on virtual_guests.group_id → guest_groups
ALTER TABLE virtual_guests
    ADD CONSTRAINT fk_virtual_guests_group
    FOREIGN KEY (group_id) REFERENCES guest_groups(id) ON DELETE SET NULL;

-- 5. Enable RLS (Row Level Security) but allow all for service role
ALTER TABLE virtual_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesa_assignments ENABLE ROW LEVEL SECURITY;

-- Policies: allow all via service_role key (admin panel uses service key)
CREATE POLICY "Allow all for service role" ON virtual_guests
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON guest_groups
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON mesa_assignments
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_virtual_guests_group ON virtual_guests(group_id);
CREATE INDEX IF NOT EXISTS idx_virtual_guests_familia ON virtual_guests(familia);
CREATE INDEX IF NOT EXISTS idx_virtual_guests_matched ON virtual_guests(matched_guest_id);
CREATE INDEX IF NOT EXISTS idx_mesa_assignments_table ON mesa_assignments(table_id);
