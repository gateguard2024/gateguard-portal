-- Migration 214: Gate Watch email alerts. ALTER only.
-- info@gateguard.co always gets every gate alert (in code, lib/gate-watch.ts GATE_ALWAYS_EMAIL);
-- notify_emails = extra people for this gate (up to 5).
ALTER TABLE public.gate_watches ADD COLUMN IF NOT EXISTS notify_emails text[] NOT NULL DEFAULT '{}';
