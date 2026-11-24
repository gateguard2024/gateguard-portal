-- Migration 242: gate reset in the property portal — ADD-ON only (ALTER, no new tables).
-- Gate Guard tunes each reset recipe in Nexus (corporate only); the portal just runs it.
--   portal_door_id   the portal gate (Brivo door id) this reset belongs to (Reset button on that card)
--   portal_enabled   show it in the property portal (default on)
--   draw_watts       power the operator must draw before the gate is opened (default 3 W)
--   sense_seconds    how long to wait for that draw before falling back to "open by hand" (default 90 s)
-- Safe to re-run.
ALTER TABLE public.gate_reboots ADD COLUMN IF NOT EXISTS portal_door_id text;
ALTER TABLE public.gate_reboots ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.gate_reboots ADD COLUMN IF NOT EXISTS draw_watts numeric;
ALTER TABLE public.gate_reboots ADD COLUMN IF NOT EXISTS sense_seconds int;
