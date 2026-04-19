-- ══════════════════════════════════════════════
--  Migration 003 — Email aportación opcional
--  Run in Supabase Dashboard → SQL Editor
--
--  Añade dos columnas a `guests`:
--    - email: email del titular que pide info del IBAN (opcional)
--    - info_enviada_at: timestamp de cuando se le envió la info manualmente
--
--  Idempotente (IF NOT EXISTS en todo).
-- ══════════════════════════════════════════════

ALTER TABLE guests
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS info_enviada_at TIMESTAMPTZ;

-- Índice parcial para la vista "pendientes de enviar IBAN" del admin
CREATE INDEX IF NOT EXISTS idx_guests_email_pending
    ON guests (created_at DESC)
    WHERE email IS NOT NULL AND info_enviada_at IS NULL;
