-- ============================================================
-- Migration 176 — Gate re-boot sequences (per-site, camera-monitored power cycle)
-- Run on BETA first, verify, then prod.
--
-- A "gate re-boot" = power off a Shelly relay, wait N seconds, power it back on,
-- then actuate the gate (Brivo door unlock OR a momentary pulse on a second Shelly
-- relay). The operator watches the mapped camera live through the whole cycle.
-- Steps run client-side through the existing secured /api/shelly + /api/brivo
-- endpoints; this table just stores each gate's reboot recipe.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gate_reboots (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name                   text NOT NULL,               -- e.g. "P3 Exit Gate re-boot"

  -- Camera to watch during the reset
  camera_id              text,
  camera_name            text,

  -- Power relay to cycle (Shelly)
  power_device_id        text NOT NULL,
  power_channel          int  NOT NULL DEFAULT 0,
  power_relay_name       text,
  wait_seconds           int  NOT NULL DEFAULT 30,

  -- Final actuation once power is back: 'brivo' (unlock a door) or 'shelly' (pulse a 2nd relay)
  actuation_type         text NOT NULL DEFAULT 'brivo' CHECK (actuation_type IN ('brivo','shelly','none')),
  actuation_door_id      text,
  actuation_door_name    text,
  actuation_device_id    text,
  actuation_channel      int,
  actuation_pulse_seconds int DEFAULT 1,
  actuation_relay_name   text,

  created_by             text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gate_reboots_site_idx ON public.gate_reboots(site_id);

-- RLS on (app uses the service-role key, which bypasses RLS; this locks out anon).
ALTER TABLE public.gate_reboots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_gate_reboots"
  ON public.gate_reboots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.gate_reboots TO postgres, anon, authenticated, service_role;
