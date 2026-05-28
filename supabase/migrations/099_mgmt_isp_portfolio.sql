-- Migration 099: Management Company ISP Portfolio knowledge base
-- Stores confirmed/known ISP deals at the management-company portfolio level.
-- Every ARIA search checks this table — if the mgmt company has a known
-- Gigstreem / Comcast / etc. deal, that intel is injected into synthesis
-- so ARIA doesn't need to re-discover it from scratch every time.

CREATE TABLE IF NOT EXISTS public.mgmt_isp_portfolio (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  management_company  TEXT NOT NULL,              -- normalized lowercase, e.g. 'cortland'
  management_company_display TEXT NOT NULL,       -- display name, e.g. 'Cortland'
  isp_name            TEXT NOT NULL,              -- e.g. 'Gigstreem', 'Xfinity', 'Spectrum'
  agreement_type      TEXT NOT NULL DEFAULT 'bulk'
                        CHECK (agreement_type IN ('bulk','exclusive','preferred','managed_wifi','unknown')),
  coverage_states     TEXT[] DEFAULT '{}',        -- e.g. '{TX,GA,NC,AZ}' — empty = nationwide
  coverage_notes      TEXT,                       -- e.g. 'TX portfolio confirmed, rollout ongoing in GA'
  confidence          TEXT NOT NULL DEFAULT 'reported'
                        CHECK (confidence IN ('confirmed','reported','suspected')),
  source              TEXT,                       -- e.g. 'GateGuard field sales', 'press release', 'SEC filing'
  source_url          TEXT,
  active              BOOLEAN NOT NULL DEFAULT true,
  times_confirmed     INTEGER NOT NULL DEFAULT 1, -- increments when ARIA finds corroborating evidence
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.mgmt_isp_portfolio TO postgres, anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.mgmt_isp_portfolio_id_seq TO postgres, anon, authenticated, service_role;

-- Index for fast lookup by management company name
CREATE INDEX IF NOT EXISTS idx_mgmt_isp_portfolio_company
  ON public.mgmt_isp_portfolio (lower(management_company));

CREATE INDEX IF NOT EXISTS idx_mgmt_isp_portfolio_isp
  ON public.mgmt_isp_portfolio (lower(isp_name));

-- ─── Seed: known confirmed ISP-management company relationships ─────────────
-- Source: GateGuard field sales + public press releases

INSERT INTO public.mgmt_isp_portfolio
  (management_company, management_company_display, isp_name, agreement_type, coverage_states, coverage_notes, confidence, source)
VALUES

-- Cortland — confirmed Gigstreem across TX portfolio (GateGuard field intel)
('cortland', 'Cortland', 'Gigstreem', 'bulk', '{TX,GA,NC,AZ,FL,CO}',
 'Cortland rolled out Gigstreem managed WiFi across Texas and Southeast portfolio. Properties show "Community WiFi" amenity with mandatory monthly technology fee (~$40-55/mo) billed through lease. Confirmed by GateGuard field sales.',
 'confirmed', 'GateGuard field sales'),

-- Greystar — Xfinity MDU (Comcast Communities) in many markets
('greystar', 'Greystar', 'Xfinity', 'preferred', '{CA,WA,OR,TX,FL,NC,GA}',
 'Greystar has preferred provider agreements with Comcast/Xfinity in many West Coast and Sunbelt markets. Not exclusive — AT&T Fiber competes at many Greystar properties.',
 'reported', 'industry press'),

-- MAA (Mid-America Apartment Communities) — Xfinity MDU agreements
('maa', 'MAA', 'Xfinity', 'bulk', '{TX,TN,GA,FL,NC,SC,VA}',
 'MAA (Mid-America Apartment Communities) has bulk MDU agreements with Comcast/Xfinity across Southeast portfolio. 300+ properties.',
 'reported', 'SEC 10-K filings + industry press'),

-- NexPoint — Spectrum
('nexpoint', 'NexPoint', 'Spectrum', 'preferred', '{TX,TN,FL}',
 'NexPoint Residential Trust properties in Texas and Tennessee market often carry Spectrum preferred/bulk agreements.',
 'suspected', 'resident reviews'),

-- Aimco — Hotwire Communications (Florida) and others
('aimco', 'Aimco', 'Hotwire', 'bulk', '{FL}',
 'Aimco Florida properties (Boca Raton, Fort Lauderdale, Miami areas) confirmed Hotwire bulk internet deals.',
 'reported', 'industry press + resident reviews'),

-- Camden Property Trust — AT&T Fiber MDU agreements
('camden', 'Camden Property Trust', 'AT&T Fiber', 'preferred', '{TX,AZ,CO,GA,FL,NC,VA,DC}',
 'Camden Property Trust has AT&T Connected Communities agreements at many properties. AT&T Fiber is the preferred provider; Spectrum/Xfinity also present at some communities.',
 'reported', 'AT&T Connected Communities press releases'),

-- UDR — mixed, but Boingo/Managed WiFi in some markets
('udr', 'UDR', 'Boingo', 'managed_wifi', '{CA,CO,VA,MD}',
 'UDR has Boingo managed WiFi deployments at select properties, particularly in high-density urban markets (DC, Denver, San Francisco). Not portfolio-wide.',
 'reported', 'Boingo press releases 2019-2022'),

-- Equity Residential — Comcast/Xfinity preferred
('equity residential', 'Equity Residential', 'Xfinity', 'preferred', '{CA,WA,DC,MD,VA,NY,MA,CO}',
 'Equity Residential (EQR) has Comcast/Xfinity MDU agreements at many coastal markets. Not exclusive.',
 'reported', 'industry press'),

-- Invitation Homes — AT&T Fiber (single-family rental bulk deals)
('invitation homes', 'Invitation Homes', 'AT&T Fiber', 'bulk', '{TX,GA,FL,AZ,CA,CO,NC,TN}',
 'Invitation Homes (largest SFR REIT) signed a bulk AT&T Fiber deal covering ~80,000 single-family homes. Mandatory technology fee in lease.',
 'confirmed', 'AT&T press release 2021 + SEC 8-K'),

-- Progress Residential — Gigstreem (SFR)
('progress residential', 'Progress Residential', 'Gigstreem', 'bulk', '{TX,GA,FL,AZ,TN,NC}',
 'Progress Residential (Pretium Partners SFR portfolio) has Gigstreem managed WiFi bulk deal across Sunbelt portfolio.',
 'reported', 'Gigstreem press release 2022'),

-- Starwood Capital Group multifamily — varies
('starwood', 'Starwood Capital Group', 'Gigstreem', 'bulk', '{TX,FL,GA}',
 'Starwood Capital multifamily assets in Texas and Florida have been confirmed with Gigstreem managed WiFi.',
 'suspected', 'resident reviews + GateGuard field intel'),

-- Landmark Apartment Trust / Resource Apartment — Gigstreem
('landmark', 'Landmark Apartment Trust', 'Gigstreem', 'bulk', '{GA,NC,SC,TX,FL}',
 'Landmark/Resource apartment communities in Southeast frequently use Gigstreem managed WiFi.',
 'reported', 'Gigstreem case studies');
