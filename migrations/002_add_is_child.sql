-- Add is_child column to virtual_guests
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE virtual_guests
    ADD COLUMN IF NOT EXISTS is_child BOOLEAN DEFAULT false;
