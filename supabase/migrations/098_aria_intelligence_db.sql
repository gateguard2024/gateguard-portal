-- Migration 098: ARIA Self-Learning Intelligence Database
-- Persistent property records + auto-growing tech provider catalog
-- Never deletes discovered properties — database grows stronger over time
-- Run on beta Supabase first, verify ARIA writes work, then prod.

-- ── aria_properties — persistent property intelligence ────────────────────────
-- One row per unique property (upserted by ARIA on every search).
-- NEVER deleted from application code — use Supabase studio for manual removals.
CREATE TABLE IF NOT EXISTS public.aria_properties (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (unique key for upsert)
  property_name         TEXT NOT NULL,
  address               TEXT NOT NULL,

  -- Physical
  units                 INT,
  property_type         TEXT,        -- 'multifamily','senior-living','student','mixed-use'
  class                 TEXT,        -- 'A','B','C'
  year_built            INT,
  occupancy             TEXT,

  -- Ownership / Management
  management_company    TEXT,
  owner_entity          TEXT,
  owner_type            TEXT,        -- 'REIT','private-equity','family-office','owner-operator'
  portfolio_size        TEXT,
  acquisition_year      INT,
  hold_period           TEXT,
  capex_signal          TEXT,
  dnb_duns              TEXT,

  -- Connectivity (ISP / Video)
  isp_providers         TEXT[],      -- e.g. ARRAY['Gigstreem','AT&T']
  video_providers       TEXT[],      -- e.g. ARRAY['DirecTV Bulk Stream']
  bulk_agreements       JSONB,       -- Array of BulkAgreement objects
  fcc_verified          BOOLEAN DEFAULT false,

  -- PropTech stack (auto-discovered, grows over time)
  gate_operators        TEXT[],
  access_control        TEXT[],
  intercoms             TEXT[],
  cameras               TEXT[],
  smart_locks           TEXT[],
  resident_apps         TEXT[],
  package_solutions     TEXT[],
  tech_generation       TEXT CHECK (tech_generation IN ('legacy','modern','hybrid')),
  sara_signals          BOOLEAN DEFAULT false,
  replacement_window    TEXT,
  displacement_targets  TEXT[],

  -- ARIA intelligence profile
  buy_score             INT CHECK (buy_score BETWEEN 0 AND 10),
  urgency               TEXT CHECK (urgency IN ('critical','high','medium','low')),
  primary_concern       TEXT,
  current_vendor        TEXT,
  contract_window       TEXT,
  contract_expiry_year  INT,         -- best-estimate expiry year
  communication_style   TEXT,
  pain_signals          JSONB,       -- Array of PainSignal objects (latest research)
  behavioral_profile    JSONB,       -- personality_type, decision_style, risk_tolerance
  pitch_strategy        JSONB,       -- primary_hook, avoid_topics, best_time_to_call
  freshness_score       INT CHECK (freshness_score BETWEEN 1 AND 5),

  -- Decision maker (primary + chain)
  dm_name               TEXT,
  dm_title              TEXT,
  dm_company            TEXT,
  dm_email              TEXT,
  dm_phone              TEXT,
  dm_linkedin_slug      TEXT,
  dm_chain              JSONB,       -- Array of DecisionMakerChainItem objects
  dm_verified_at        TIMESTAMPTZ, -- when ProxyCurl last validated

  -- SCOUT brief
  scout_brief           JSONB,

  -- ARIA research metadata
  times_researched      INT NOT NULL DEFAULT 1,
  first_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_researched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  aria_confidence       TEXT CHECK (aria_confidence IN ('confirmed','high','medium','low')) DEFAULT 'medium',

  -- Sales cycle (updated by reps)
  crm_opportunity_id    UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  crm_lead_id           UUID REFERENCES show_leads(id) ON DELETE SET NULL,
  sales_stage           TEXT CHECK (sales_stage IN ('prospect','contacted','proposal','negotiation','won','lost','no-contact')) DEFAULT 'prospect',
  sales_notes           TEXT,        -- free text notes from sales team
  last_contacted_at     TIMESTAMPTZ,
  assigned_rep          TEXT,        -- user name of owning rep

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index for upsert (property_name + normalized address)
CREATE UNIQUE INDEX IF NOT EXISTS aria_properties_identity_idx
  ON public.aria_properties (lower(trim(property_name)), lower(trim(address)));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS aria_properties_buy_score_idx ON public.aria_properties (buy_score DESC);
CREATE INDEX IF NOT EXISTS aria_properties_contract_expiry_idx ON public.aria_properties (contract_expiry_year) WHERE contract_expiry_year IS NOT NULL;
CREATE INDEX IF NOT EXISTS aria_properties_management_idx ON public.aria_properties (management_company);
CREATE INDEX IF NOT EXISTS aria_properties_sales_stage_idx ON public.aria_properties (sales_stage);
CREATE INDEX IF NOT EXISTS aria_properties_last_researched_idx ON public.aria_properties (last_researched_at DESC);
CREATE INDEX IF NOT EXISTS aria_properties_sara_idx ON public.aria_properties (sara_signals) WHERE sara_signals = true;
CREATE INDEX IF NOT EXISTS aria_properties_urgency_idx ON public.aria_properties (urgency);

-- ── aria_tech_providers — auto-growing catalog for all proptech vendors ────────
-- Separate from mdu_providers (which is ISP/video only).
-- Populated automatically when ARIA discovers a new gate/access/camera/intercom provider.
CREATE TABLE IF NOT EXISTS public.aria_tech_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,         -- lowercase, hyphens
  category        TEXT NOT NULL CHECK (category IN (
                    'gate','access_control','intercom','camera',
                    'smart_lock','resident_app','package','other'
                  )),
  aliases         TEXT[],                        -- alternate names encountered
  notes           TEXT,
  displacement_target BOOLEAN DEFAULT false,     -- can GateGuard replace this?
  times_detected  INT NOT NULL DEFAULT 1,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aria_tech_providers_category_idx ON public.aria_tech_providers (category);
CREATE INDEX IF NOT EXISTS aria_tech_providers_times_idx ON public.aria_tech_providers (times_detected DESC);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.aria_properties TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.aria_tech_providers TO postgres, anon, authenticated, service_role;

-- RLS — service role has full access; authenticated users can read/update (not delete)
ALTER TABLE public.aria_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aria_tech_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_aria_properties"
  ON public.aria_properties FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_aria_properties"
  ON public.aria_properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_update_aria_properties"
  ON public.aria_properties FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_aria_tech_providers"
  ON public.aria_tech_providers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_aria_tech_providers"
  ON public.aria_tech_providers FOR SELECT TO authenticated USING (true);

-- ── Seed: known tech providers ────────────────────────────────────────────────
INSERT INTO public.aria_tech_providers (name, slug, category, aliases, displacement_target, notes) VALUES
-- Gate operators
('LiftMaster', 'liftmaster', 'gate', ARRAY['LiftMaster CAPXL','LiftMaster CSL24UL'], true, 'Chamberlain Group brand. Very common in MDU. GateGuard integrates directly.'),
('Chamberlain', 'chamberlain', 'gate', ARRAY['Chamberlain Group'], true, 'Parent of LiftMaster. Same HW different branding.'),
('FAAC', 'faac', 'gate', ARRAY['FAAC International'], true, 'Italian brand, high-end. Used in premium communities.'),
('DoorKing', 'doorking', 'gate', ARRAY['DKS','DoorKing DKS'], true, 'Very common legacy access telephone-entry system. Strong SARA bridge signal.'),
('Linear', 'linear', 'gate', ARRAY['Linear Access','Nortek Access'], true, 'Part of Nortek Security & Control. Wide MDU presence.'),
('HySecurity', 'hysecurity', 'gate', ARRAY['HySecurity Gate'], false, 'Heavy-duty industrial gate. Less common in residential MDU.'),
('Viking Access Systems', 'viking-access', 'gate', ARRAY['Viking'], true, 'Common in HOA and gated community segment.'),
('Nice Apollo', 'nice-apollo', 'gate', ARRAY['Apollo Gate Operators','Nice Group'], true, 'Italian parent (Nice); US brand Apollo. Growing MDU presence.'),
('BFT', 'bft', 'gate', ARRAY['BFT Automation'], false, 'Italian brand. Less common in US MDU.'),
('Elite Gates', 'elite-gates', 'gate', ARRAY['Elite Gate Operators'], true, 'Residential-grade but appears in smaller communities.'),
-- Access control
('Brivo', 'brivo', 'access_control', ARRAY['Brivo Access'], false, 'Cloud access control. GateGuard partner. NOT a displacement target.'),
('Salto', 'salto', 'access_control', ARRAY['Salto Systems','Salto KS'], true, 'European brand, growing US MDU. Targets high-end multifamily.'),
('Openpath', 'openpath', 'access_control', ARRAY['Openpath Access','Avigilon Alta'], true, 'Motorola Solutions subsidiary (rebranded Avigilon Alta). Cloud access.'),
('Avigilon', 'avigilon', 'access_control', ARRAY['Avigilon Alta','Avigilon Control Center'], true, 'Motorola. Enterprise-grade. Higher-end communities.'),
('Verkada', 'verkada', 'access_control', ARRAY['Verkada Access'], true, 'Cloud-first. Growing rapidly in Class A. Bundled with cameras.'),
('Genetec', 'genetec', 'access_control', ARRAY['Genetec Synergis'], false, 'Enterprise VMS/access. Usually corporate, less common in MDU.'),
('Lenel', 'lenel', 'access_control', ARRAY['LenelS2','Lenel OnGuard'], false, 'Carrier/UTC brand. Enterprise. Rarely MDU.'),
('PDK', 'pdk', 'access_control', ARRAY['ProdataKey','PDK io'], true, 'Cloud access control, growing MDU presence.'),
('Kastle', 'kastle', 'access_control', ARRAY['Kastle Systems'], true, 'Full-service managed access + video. Subscription model. MDU & commercial.'),
-- Intercoms
('2N', '2n', 'intercom', ARRAY['2N Telekomunikace','Axis 2N'], true, 'Czech brand (Axis subsidiary). IP intercoms, very common MDU.'),
('Aiphone', 'aiphone', 'intercom', ARRAY['Aiphone Corp'], true, 'Japanese brand. Very common US MDU. Telephone-style. Legacy displacement target.'),
('Comelit', 'comelit', 'intercom', ARRAY['Comelit Group'], true, 'Italian brand. Video intercoms. Growing US MDU.'),
('Fermax', 'fermax', 'intercom', ARRAY['Fermax Electronica'], true, 'Spanish brand. Growing US presence.'),
('ButterflyMX', 'butterflyMX', 'intercom', ARRAY['Butterfly MX'], true, 'Cloud video intercom, strong MDU growth. Displacement target.'),
('Latch', 'latch', 'intercom', ARRAY['Latch Inc','Latch R'], true, 'NY-based smart intercom + lock. High-end multifamily focus.'),
('Swiftlane', 'swiftlane', 'intercom', ARRAY['Swift Lane'], true, 'Cloud video intercom. Growing.'),
('Siedle', 'siedle', 'intercom', ARRAY['Siedle & Söhne'], false, 'German premium. Rare in US MDU.'),
-- Cameras
('Axis', 'axis', 'camera', ARRAY['Axis Communications'], false, 'Swedish. Industry-standard IP cameras. GateGuard-compatible.'),
('Hanwha', 'hanwha', 'camera', ARRAY['Hanwha Vision','Samsung Techwin'], false, 'Korean. Common MDU. Was Samsung cameras.'),
('Hikvision', 'hikvision', 'camera', ARRAY['HIK'], false, 'Chinese. High market share but banned from federal use.'),
('Dahua', 'dahua', 'camera', ARRAY['Dahua Technology'], false, 'Chinese. Similar to Hikvision.'),
('Bosch', 'bosch-security', 'camera', ARRAY['Bosch Security Systems'], false, 'German. Enterprise. Less common MDU.'),
('Pelco', 'pelco', 'camera', ARRAY['Pelco by Motorola'], false, 'US brand. Enterprise. Declining market share.'),
('Verkada Cameras', 'verkada-cameras', 'camera', ARRAY['Verkada'], false, 'Cloud-first. Bundled with access control. Growing rapidly.'),
('Avigilon Cameras', 'avigilon-cameras', 'camera', ARRAY['Avigilon H5A'], false, 'Motorola. High-resolution. Enterprise-grade.'),
-- Smart locks
('Schlage', 'schlage', 'smart_lock', ARRAY['Schlage Encode','Schlage Control'], true, 'Allegion brand. Very common MDU smart lock.'),
('Yale', 'yale', 'smart_lock', ARRAY['Yale Access','Yale Assure'], true, 'ASSA ABLOY brand. Common MDU.'),
('August', 'august', 'smart_lock', ARRAY['August Smart Lock'], true, 'Yale/ASSA ABLOY. Consumer-grade.'),
('Kwikset', 'kwikset', 'smart_lock', ARRAY['Kwikset Halo'], true, 'Spectrum Brands. Consumer-grade MDU.'),
('Dormakaba', 'dormakaba', 'smart_lock', ARRAY['Dorma Kaba'], false, 'Swiss. Enterprise/hospitality. Less common MDU.'),
-- Resident apps
('Entrata', 'entrata', 'resident_app', ARRAY['Entrata PMS'], false, 'Property management + resident portal. Common MDU.'),
('RealPage', 'realpage', 'resident_app', ARRAY['RealPage LeasingDesk'], false, 'PMS + resident app. Very common. AIMCO, Greystar etc.'),
('Yardi', 'yardi', 'resident_app', ARRAY['Yardi Voyager','RentCafe'], false, 'PMS dominant. RentCafe resident portal.'),
('AppFolio', 'appfolio', 'resident_app', ARRAY['AppFolio Property Manager'], false, 'SMB-focused PMS.'),
('Zego', 'zego', 'resident_app', ARRAY['Zego by PayLease'], false, 'Resident payment + app.'),
('Notifii', 'notifii', 'resident_app', ARRAY['Notifii Track'], false, 'Package notifications.'),
('Package Concierge', 'package-concierge', 'package', ARRAY['Package Concierge Locker'], false, 'Smart package lockers. Very common Class A.'),
('Luxer One', 'luxer-one', 'package', ARRAY['Luxer One Lockers'], false, 'Smart lockers. Growing.'),
('Parcel Pending', 'parcel-pending', 'package', ARRAY['Parcel Pending by Quadient'], false, 'Smart lockers. Growing.')
ON CONFLICT (slug) DO NOTHING;

-- ── Helper RPCs for atomic counter increments ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_aria_property_research_count(
  p_name text, p_addr text
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.aria_properties
  SET times_researched = times_researched + 1
  WHERE lower(trim(property_name)) = lower(trim(p_name))
    AND lower(trim(address))       = lower(trim(p_addr));
$$;

CREATE OR REPLACE FUNCTION public.increment_aria_tech_provider_count(
  p_slug text
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.aria_tech_providers
  SET times_detected = times_detected + 1,
      last_seen_at   = now()
  WHERE slug = p_slug;
$$;

GRANT EXECUTE ON FUNCTION public.increment_aria_property_research_count TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_aria_tech_provider_count TO service_role, authenticated;
