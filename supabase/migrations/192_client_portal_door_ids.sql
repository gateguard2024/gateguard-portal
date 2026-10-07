-- Migration 192: per-portal door whitelist (mirrors camera_ids).
-- NULL / empty  = show ALL doors the site's Brivo account exposes.
-- Non-empty      = show ONLY these Brivo door ids.
-- Run on BETA first, verify, then prod. (ALTER only — no GRANT needed.)

ALTER TABLE public.client_portals ADD COLUMN IF NOT EXISTS door_ids TEXT[];
