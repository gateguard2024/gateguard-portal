-- ─────────────────────────────────────────────────────────────────────────────
-- 006_sync_tables.sql
-- Residents table, sync_log table, and Brivo/UniFi fields on organizations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend organizations with per-org Brivo auth + UniFi connection ───────────
ALTER TABLE organizations
  -- Brivo per-account auth (property manager login — not the developer app creds)
  ADD COLUMN IF NOT EXISTS brivo_username        text,
  ADD COLUMN IF NOT EXISTS brivo_password        text,          -- stored encrypted; never returned in API responses
  ADD COLUMN IF NOT EXISTS brivo_access_token    text,          -- cached OAuth token
  ADD COLUMN IF NOT EXISTS brivo_token_expires   timestamptz,   -- expiry for cached token
  -- UniFi Network integration (per client site)
  ADD COLUMN IF NOT EXISTS unifi_host            text,          -- e.g. 192.168.1.1 or unifi.property.com
  ADD COLUMN IF NOT EXISTS unifi_api_key         text,          -- UniFi Network API key (UI → Settings → API)
  ADD COLUMN IF NOT EXISTS unifi_site_id         text DEFAULT 'default',  -- UniFi site name (slug)
  ADD COLUMN IF NOT EXISTS unifi_resident_group  text DEFAULT 'Residents'; -- UniFi client group name for residents

-- ── Residents ─────────────────────────────────────────────────────────────────
-- One row per person credentialed in Brivo for a GateGuard-managed property.
-- Sourced from Brivo; augmented with UniFi MAC once device is known.
CREATE TABLE IF NOT EXISTS public.residents (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Brivo identity
  brivo_user_id   text NOT NULL,
  first_name      text NOT NULL DEFAULT '',
  last_name       text NOT NULL DEFAULT '',
  email           text,
  phone           text,           -- E.164
  unit_number     text,

  -- Network identity (set manually or via GateCard device registration)
  mac_address     text,           -- primary device MAC (UniFi format: aa:bb:cc:dd:ee:ff)
  unifi_group_id  text,           -- UniFi usergroup _id once synced

  -- Status
  active          boolean NOT NULL DEFAULT true,
  last_synced_at  timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, brivo_user_id)
);

CREATE INDEX IF NOT EXISTS idx_residents_org_id     ON public.residents (org_id);
CREATE INDEX IF NOT EXISTS idx_residents_brivo_id   ON public.residents (brivo_user_id);
CREATE INDEX IF NOT EXISTS idx_residents_mac        ON public.residents (mac_address) WHERE mac_address IS NOT NULL;

-- ── Sync log ──────────────────────────────────────────────────────────────────
-- Immutable append-only record of every sync run for debugging + audit.
CREATE TABLE IF NOT EXISTS public.sync_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid REFERENCES organizations(id) ON DELETE SET NULL,
  sync_type     text NOT NULL,   -- 'brivo_residents' | 'unifi_clients' | 'full'
  status        text NOT NULL,   -- 'success' | 'partial' | 'error'
  upserted      int  DEFAULT 0,
  deactivated   int  DEFAULT 0,
  unifi_synced  int  DEFAULT 0,
  error_msg     text,
  details       jsonb,
  duration_ms   int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_org_id     ON public.sync_log (org_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON public.sync_log (created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; all sync jobs use the service role key.
-- Dealer/admin users can read their own org's residents.
CREATE POLICY "residents_service_all" ON public.residents
  USING (auth.role() = 'service_role');

CREATE POLICY "sync_log_service_all" ON public.sync_log
  USING (auth.role() = 'service_role');

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_residents_updated_at ON public.residents;
CREATE TRIGGER trg_residents_updated_at
  BEFORE UPDATE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
