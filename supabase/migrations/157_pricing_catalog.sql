-- Migration 157: ONE catalog — extend service_catalog with program pricing
-- (Phase 1 of docs/nexus/CATALOG_IMPORT_PHASES.md)
--
-- Decision (Russel, July 18 2026): the July catalog doc defines SERVICE and
-- LABOR line items, not hardware products. So there is exactly one catalog for
-- recurring/one-time service pricing: service_catalog (070). This migration
-- adds program-pricing columns to it and seeds the GateGuard program lines
-- (provider = 'GateGuard', is_gateguard_program = true). The hardware `products`
-- table stays SKU-only. No new catalog table is created.
--
--   floor_price  = absolute minimum ("no deal below this without dual approval")
--   target_price = the "sweet spot" a deal should meet or exceed
--   status       = approved | for_review | open   ([Open] items are NEVER quotable)
--
-- Idempotent; includes 070's guard-create so it works even if 070 was never
-- run on this environment. Run beta → prod.

-- ─── Guard-create service_catalog (070) in case it is not deployed ───────────
create table if not exists public.service_catalog (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  provider        text not null,
  category        text not null,
  description     text,
  logo_emoji      text default '📦',
  provider_color  text default '#6B7EFF',
  billing_type    text not null default 'per_unit',
  base_price      numeric(10,2) not null,
  unit_label      text default 'unit',
  min_units       integer default 1,
  contract_months integer default 12,
  dealer_commission_pct  numeric(5,2) default 10.00,
  gg_commission_pct      numeric(5,2) default 5.00,
  is_active       boolean default true,
  is_featured     boolean default false,
  requires_enrollment boolean default false,
  enrollment_url  text,
  learn_more_url  text,
  notes           text,
  sort_order      integer default 100,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.service_catalog TO postgres, anon, authenticated, service_role;

-- ─── Widen the CHECK constraints for program/labor lines ─────────────────────
-- category: add 'gate' and 'labor'; billing_type: add one_time / per_foot / case_by_case.
-- The new value lists are SUPERSETS of 070's, so every existing row still passes —
-- this cannot invalidate existing marketplace data. Constraint drop is name-agnostic
-- (looks up pg_constraint) so it works no matter how the env named the old checks.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'service_catalog'
      AND con.contype = 'c'
      AND (pg_get_constraintdef(con.oid) ILIKE '%category%' OR pg_get_constraintdef(con.oid) ILIKE '%billing_type%')
  LOOP
    EXECUTE format('ALTER TABLE public.service_catalog DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.service_catalog ADD CONSTRAINT service_catalog_category_check CHECK (category IN (
    'tv','internet','video_monitoring','package_lockers','access_control',
    'smart_locks','security','network_mgmt','energy','gate','labor','other'
  ));
  ALTER TABLE public.service_catalog ADD CONSTRAINT service_catalog_billing_type_check CHECK (billing_type IN (
    'per_unit','per_property','flat_fee','one_time','per_foot','case_by_case'
  ));
END $$;

-- ─── Program-pricing columns ──────────────────────────────────────────────────
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS item_code            text,     -- catalog doc code, e.g. 'C1.ADDL_GATE'
  ADD COLUMN IF NOT EXISTS bucket               text CHECK (bucket IS NULL OR bucket IN ('A','B','C')),
  ADD COLUMN IF NOT EXISTS floor_price          numeric,  -- absolute floor (null = not defined yet)
  ADD COLUMN IF NOT EXISTS target_price         numeric,  -- sweet spot (null = not defined yet)
  ADD COLUMN IF NOT EXISTS status               text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','for_review','open')),
  ADD COLUMN IF NOT EXISTS quotable             boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dealer_visible       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_gateguard_program boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_catalog_item_code
  ON public.service_catalog (item_code) WHERE item_code IS NOT NULL;

-- ─── Program-level numeric settings (allotments, term, ETF) ──────────────────
CREATE TABLE IF NOT EXISTS public.catalog_pricing_settings (
  key         text PRIMARY KEY,
  value       numeric NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.catalog_pricing_settings TO postgres, anon, authenticated, service_role;

-- ─── Audit trail — every corporate pricing change ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_pricing_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code   text NOT NULL,             -- service_catalog.item_code, name, or 'setting:<key>'
  changed_by  text,
  changes     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.catalog_pricing_log TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_catalog_pricing_log_code ON public.catalog_pricing_log (item_code, created_at DESC);

-- ─── Seed: GateGuard program service & labor lines (catalog v_a.1) ────────────
-- base_price mirrors target (0 when undefined) since 070 declared it NOT NULL.
INSERT INTO public.service_catalog
  (item_code, name, provider, category, billing_type, unit_label, base_price,
   floor_price, target_price, bucket, status, quotable, dealer_visible,
   is_gateguard_program, requires_enrollment, contract_months, notes, sort_order)
VALUES
  -- Base economics (§4)
  ('BASE.UNIT_RATE',      'Base subscription — per-unit rate',           'GateGuard','gate',            'per_unit',     'unit',        10,   NULL, 10,   'A','for_review', true,  true,  true, false, 60, '$10/unit/month drives the base line; property minimum applies.', 10),
  ('BASE.PROPERTY',       'Base subscription — property minimum',        'GateGuard','gate',            'per_property', 'property',    2500, 1800, 2500, 'A','for_review', true,  true,  true, false, 60, 'Floor $1,800 / target $2,500. Below floor = dealer + GateGuard approval; between = written justification. Covers up to 2 gate systems / 8 gates.', 20),
  ('BASE.GATE_BAND',      'Base gate economics (deal check band)',       'GateGuard','gate',            'per_unit',     'gate',        310,  225,  310,  'A','for_review', false, true,  true, false, 60, 'Not a quote line — the deal check: base MRR ÷ gates must hold ≥$310, never <$225. Between = gate-heavy, flag before quote.', 30),
  -- Configured-at-sale setup labor (B.1)
  ('B1.SETUP_WORKING',    'Gate setup fee — Working',                    'GateGuard','labor',           'one_time',     'gate',        500,  500,  500,  'B','for_review', true,  true,  true, false, 60, 'Per gate, set by survey. Brings gate to launch condition.', 40),
  ('B1.SETUP_NONWORKING', 'Gate setup fee — Non-working',                'GateGuard','labor',           'one_time',     'gate',        750,  750,  750,  'B','for_review', true,  true,  true, false, 60, 'Per gate. Any repair required to reach launch = Non-working. When in doubt, classify Non-working.', 50),
  -- Add-ons (C)
  ('C1.ADDL_GATE',        'Additional gate (beyond 8)',                  'GateGuard','gate',            'per_unit',     'gate',        310,  225,  310,  'C','for_review', true,  true,  true, false, 60, 'Same floor/target as base gate economics. Setup fee applies per gate (B.1).', 60),
  ('C2.ADDL_SYSTEM',      'Additional gate system (3rd or later)',       'GateGuard','gate',            'case_by_case', 'gate system', 0,    NULL, NULL, 'C','open',       false, true,  true, false, 60, 'Flagged exception — Sales Engineering prices connectivity (radio/switching/LTE) case by case before quote.', 70),
  ('C3.CALLBOX_TIER2',    'UniFi callbox — Tier 2 upgrade',              'GateGuard','access_control',  'one_time',     'callbox',     2500, 2500, 2500, 'C','for_review', true,  true,  true, false, 60, 'Per callbox. UniFi Gate Access Starter Kit; requires Cat6 to central enclosure.', 80),
  ('C4.DOOR_INTERIOR',    'Managed Access — interior door',              'GateGuard','access_control',  'per_unit',     'door',        100,  NULL, 100,  'C','open',       false, true,  true, false, 60, 'Working proposal only. Rates, product minimum, setup-fee treatment OPEN (§9 item 1).', 90),
  ('C4.DOOR_EXTERIOR',    'Managed Access — exterior door',              'GateGuard','access_control',  'per_unit',     'door',        150,  NULL, 150,  'C','open',       false, true,  true, false, 60, 'Working proposal only. Exterior premium = weatherized hardware + failure exposure.', 100),
  ('C5.CAMERA_NEW',       'Additional camera — new (hardware included)', 'GateGuard','video_monitoring','per_unit',     'camera',      100,  NULL, 100,  'C','for_review', true,  true,  true, false, 60, 'Hardware free with contract. Dealer/Corporate revenue split OPEN (§9 item 7).', 110),
  ('C5.CAMERA_RETAINED',  'Additional camera — retained existing',       'GateGuard','video_monitoring','per_unit',     'camera',      85,   NULL, 85,   'C','for_review', true,  true,  true, false, 60, 'Monitoring only on property''s existing camera.', 120),
  ('C6.VIDEO_CONCIERGE',  'Video Concierge (2-way virtual guard)',       'GateGuard','security',        'case_by_case', 'property',    0,    NULL, NULL, 'C','open',       false, true,  true, false, 60, 'NOT QUOTABLE. Price points, tiers, seller of record, prerequisites OPEN (§9 item 3).', 130),
  ('C7.PGC',              'Physical Gate Coverage',                      'GateGuard','security',        'case_by_case', 'property',    0,    NULL, NULL, 'C','open',       false, true,  true, false, 60, 'NOT QUOTABLE until §9 item 4 resolves (structure, caps, perils, repair obligation, insurability).', 140),
  ('C8.CONDUIT',          'Conduit & quotable extra work',               'GateGuard','labor',           'per_foot',     'foot',        4,    4,    4,    'C','for_review', true,  true,  true, false, 60, '$4/foot from the GateGuard menu. Excluded from ROM presets; explicit line only when scoped.', 150)
ON CONFLICT (item_code) WHERE item_code IS NOT NULL DO NOTHING;

INSERT INTO public.catalog_pricing_settings (key, value, description) VALUES
  ('included_gate_systems', 2,  'Gate systems included in the base subscription'),
  ('included_gates',        8,  'Total gates included across those systems'),
  ('included_cameras_per_system', 1, 'Cameras included (with monitoring) per active gate system'),
  ('term_months',           60, 'Standard agreement term in months'),
  ('etf_year1_pct',         30, 'Early termination fee — % of remaining contract value, year 1'),
  ('etf_year2_pct',         20, 'Early termination fee — year 2'),
  ('etf_year3_pct',         10, 'Early termination fee — year 3'),
  ('etf_year4_pct',         0,  'Early termination fee — year 4+')
ON CONFLICT (key) DO NOTHING;
