-- Migration 071: MDU provider reference tables for ARIA intelligence
-- Run on beta Supabase first, verify ARIA searches work, then prod.

-- ── mdu_providers — master list of ISPs and video providers ──────────────────
CREATE TABLE IF NOT EXISTS mdu_providers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,               -- e.g. 'gigstreem', 'directv-mdu'
  provider_type text NOT NULL CHECK (provider_type IN ('isp','video','both')),
  tier          text NOT NULL CHECK (tier IN ('national','specialist','regional')),
  mdu_program   text,                               -- e.g. 'DirecTV Bulk Stream'
  coverage      text,                               -- human-readable states/regions
  property_page_pattern text,                       -- URL pattern: 'gigstreem.com/{property}'
  operator_page_pattern text,                       -- URL pattern: 'gigstreem.com/{operator}'
  partner_logo_url text,                            -- their partner logos page
  dealer_phone  text,                               -- sales/dealer contact
  notes         text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── mdu_provider_detections — confirmed/suspected provider at a property ─────
-- One row per property+provider combination, updated as ARIA gathers evidence.
CREATE TABLE IF NOT EXISTS mdu_provider_detections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid NOT NULL REFERENCES mdu_providers(id) ON DELETE CASCADE,
  -- Link to CRM opportunity OR a known site
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  site_id        uuid REFERENCES sites(id) ON DELETE SET NULL,
  -- Property info (denormalized for fast lookup even before a site record exists)
  property_name  text,
  property_address text,
  -- Evidence
  confidence     text NOT NULL CHECK (confidence IN ('confirmed','high','medium','low','suspected')),
  source_type    text NOT NULL,   -- 'field-verified','isp-site','listing-amenity','reddit','press-release','fcc-map'
  source_url     text,
  source_snippet text,            -- quote from source that confirmed this
  contract_start_year  int,       -- estimated
  contract_end_year    int,       -- estimated
  contract_notes text,
  verified_by    text,            -- 'aria' | user name
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS mdu_providers_type_idx ON mdu_providers(provider_type);
CREATE INDEX IF NOT EXISTS mdu_providers_tier_idx ON mdu_providers(tier);
CREATE INDEX IF NOT EXISTS mdu_provider_detections_opp_idx ON mdu_provider_detections(opportunity_id);
CREATE INDEX IF NOT EXISTS mdu_provider_detections_site_idx ON mdu_provider_detections(site_id);
CREATE INDEX IF NOT EXISTS mdu_provider_detections_provider_idx ON mdu_provider_detections(provider_id);

-- Unique constraint for ARIA upsert: one detection row per provider+property combination
-- Allows ARIA to safely upsert without creating duplicates on repeat searches
CREATE UNIQUE INDEX IF NOT EXISTS mdu_provider_detections_provider_property_idx
  ON mdu_provider_detections (provider_id, property_name)
  WHERE property_name IS NOT NULL;

-- RLS
ALTER TABLE mdu_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mdu_provider_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON mdu_providers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON mdu_provider_detections FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Seed: ISP providers ───────────────────────────────────────────────────────
INSERT INTO mdu_providers (name, slug, provider_type, tier, mdu_program, coverage, property_page_pattern, operator_page_pattern, partner_logo_url, dealer_phone, notes) VALUES

-- Tier 1: National carriers
('AT&T', 'att', 'both', 'national', 'AT&T Connected Communities / AT&T Instant On', '21 states (fiber); broader DSL', NULL, NULL, 'att.com/att/multifamily-property/', NULL, 'Bulk internet + bulk DirecTV Stream combo available'),
('Comcast / Xfinity', 'comcast-xfinity', 'both', 'national', 'Xfinity Communities / Xfinity WiFi Ready', '39 states', NULL, NULL, 'xfinity.com/multifamily', NULL, 'Market leader 31M+ subs. Bulk Cable + WiFi Ready pre-installed'),
('Charter / Spectrum', 'charter-spectrum', 'both', 'national', 'Spectrum Community Solutions / Spectrum Ready', '41 states', NULL, NULL, 'spectrum.com/community-solutions', NULL, '29.7M internet subs. Spectrum Ready = pre-installed WiFi 6E, instant activation Oct 2024'),
('Cox Communications', 'cox', 'both', 'national', 'Cox Quick Connect / Cox MDU Solutions', 'AZ, AR, CA, CT, FL, GA, IA, ID, KS, LA, ME, MA, MO, NE, NV, NJ, NC, OH, OK, OR, RI, TX, VA', NULL, NULL, NULL, NULL, 'Being absorbed into Charter footprint'),
('Frontier / Ziply', 'frontier-ziply', 'both', 'national', 'Frontier Fiber MDU / Ziply Fiber MDU', 'CT, CA, TX, FL, IL, IN, OH, WI, MI, NY (Frontier); WA, OR, ID, MT (Ziply)', NULL, NULL, NULL, NULL, 'Ziply = Frontier Pacific NW spinoff'),
('Lumen / CenturyLink / Quantum Fiber', 'lumen-quantum', 'isp', 'national', 'Quantum Fiber MDU / CenturyLink Instant On', '18+ states, heavy Mountain West and Midwest', NULL, NULL, NULL, NULL, 'Consumer brand = Quantum Fiber'),
('Brightspeed', 'brightspeed', 'isp', 'national', 'Brightspeed MDU', 'SE + Midwest (former CenturyLink territory)', NULL, NULL, NULL, NULL, 'Spun off from Lumen 2022; actively expanding fiber MDU'),
('Verizon', 'verizon', 'isp', 'national', 'Verizon MDU / Fios MDU', 'Northeast US (Fios); broader for Fixed Wireless', NULL, NULL, NULL, NULL, 'Acquired Starry 2025-2026; expanding fixed wireless MDU'),
('Google Fiber', 'google-fiber', 'isp', 'national', 'Google Fiber MDU', 'Atlanta, Austin, Charlotte, Kansas City, Nashville, Provo, RDU, San Antonio, SLC', NULL, NULL, NULL, NULL, 'Limited markets; high-value target for premium MDU'),

-- Tier 2: MDU specialists
('Gigstreem', 'gigstreem', 'isp', 'specialist', 'Gigstreem Bulk Managed WiFi', '26 states, 100K+ units', 'gigstreem.com/{property}', 'gigstreem.com/{operator}', 'gigstreem.com/#partners', NULL, 'Raised $59M 2023. Partner logos on homepage. Key operators: AMLI, UDR, Greystar. Property slugs: gigstreem.com/[property-name]'),
('Dojo Networks', 'dojo-networks', 'isp', 'specialist', 'Dojo Managed WiFi + Bulk TV', 'Nationwide', NULL, NULL, 'dojonetworks.com', NULL, 'Positions as #1 alternative to Spectrum/Comcast bulk cable. Also packages DirecTV Bulk Stream'),
('Pavlov Media', 'pavlov-media', 'isp', 'specialist', 'Pavlov Media Managed WiFi', '44 states, 325+ communities', 'pavlovmedia.com/{property}', NULL, 'pavlovmedia.com', NULL, 'One of oldest MDU-only ISPs. Strong Midwest/South. 5-10yr contracts'),
('Zentro Internet', 'zentro', 'isp', 'specialist', 'Zentro MDU Internet', 'East of Mississippi: Chicago, Atlanta, Miami, Richmond, Detroit, Cleveland, Milwaukee, Columbus', NULL, NULL, 'zentrointernet.com', NULL, 'Largest independent MDU ISP east of Mississippi. Zero retail presence'),
('Launch Broadband', 'launch-broadband', 'isp', 'specialist', 'Launch Broadband MDU', 'Southeastern US + growing', NULL, NULL, 'launchbroadband.com', NULL, 'Specializes in properties overlooked by major carriers'),
('Boingo Wireless', 'boingo', 'isp', 'specialist', 'Boingo MDU Managed WiFi', 'Nationwide, 2200 communities, 300K residents', NULL, NULL, 'boingo.com', NULL, 'Acquired Elauwit 2024. Strong military base + MDU presence'),
('Elauwit Networks', 'elauwit', 'isp', 'specialist', 'Elauwit MDU Managed WiFi', '25+ states, 25K+ units', NULL, NULL, NULL, NULL, 'Nov 2025 IPO; merged with Boingo'),
('Spot On Networks', 'spot-on-networks', 'isp', 'specialist', 'Spot On MDU Managed WiFi / PAN', 'Nationwide', NULL, NULL, 'spotonnetworks.com', NULL, 'Per-unit private networks (PAN model). Premium product.'),
('Mereo Fiber', 'mereo-fiber', 'isp', 'specialist', 'Mereo Fiber MDU', 'Growing nationally', NULL, NULL, 'cxponent.com/directory/vendor/mereo-fiber', NULL, 'High-speed bulk internet + managed WiFi for MDU/commercial'),
('Single Digits', 'single-digits', 'isp', 'specialist', 'Single Digits Connected Life Platform', 'Nationwide', NULL, NULL, 'singledigits.com', NULL, 'MDU + hospitality + senior living. CLP platform.'),
('Aerwave', 'aerwave', 'isp', 'specialist', 'Aerwave MDU Managed WiFi', 'Nationwide', NULL, NULL, NULL, NULL, '2025 Broadband Communities Award winner. 30%+ support ticket reduction'),
('MDU Datacom', 'mdu-datacom', 'video', 'specialist', 'DirecTV Bulk Stream MSO', 'National focus CA, TX, FL', NULL, NULL, 'mdudatacom.com', '866-255-5020', 'Primary DirecTV Bulk Stream MSO in LA market. Also does AT&T bulk internet. CALL TO CONFIRM DirecTV at specific property'),
('ResTech Services', 'restech-services', 'video', 'specialist', 'DirecTV MDU System Operator', 'Nationwide (focus South/Southeast)', NULL, NULL, 'restechservices.net/directv-for-mdu/', NULL, 'Authorized DirecTV MDU System Operator. Installation + maintenance + customer service'),
('CSS DTV', 'css-dtv', 'video', 'specialist', 'DirecTV Bulk Stream MSO', 'Nationwide', NULL, NULL, 'cssdtv.com', NULL, 'DirecTV MDU dealer + system operator'),
('Get Grooven / Grooven', 'grooven', 'both', 'specialist', 'DirecTV Bulk Stream + Managed WiFi bundle', 'Nationwide', NULL, NULL, 'getgrooven.com/solutions/tv-wi-fi-phone/directv/multifamily/', NULL, 'Resells DirecTV Bulk Stream + managed WiFi as combined amenity package'),
('TouchStone1', 'touchstone1', 'both', 'specialist', 'DirecTV Bulk Stream + MDU Internet bundle', 'Nationwide', NULL, NULL, 'touchstone1.com/mdu/directv-stream/', NULL, 'Multifamily internet + DirecTV Stream bundler'),

-- Tier 3: Regional / niche
('Metronet', 'metronet', 'isp', 'regional', 'Metronet 100% Fiber MDU', 'Midwest', NULL, NULL, 'metronetbusiness.com/mdu', NULL, '100% fiber. MDU expansion accelerating'),
('MIDCO', 'midco', 'both', 'regional', 'MIDCO MDU Cable/Fiber', 'ND, SD, MN, WI, KS', NULL, NULL, NULL, NULL, 'Strong MDU presence in underserved Midwest markets'),
('Atlantic Broadband / Breezeline', 'breezeline', 'both', 'regional', 'Breezeline MDU Cable/Fiber', 'PA, NY, MD, OH, WV, ME, NH, VT', NULL, NULL, NULL, NULL, 'Acquired by Cogeco; MDU cable/fiber'),
('WideOpenWest (WOW!)', 'wow', 'both', 'regional', 'WOW MDU Bulk', 'Southeast + Midwest', NULL, NULL, NULL, NULL, 'Cable overbuilder; MDU bulk agreements'),
('ALLO Communications', 'allo', 'isp', 'regional', 'ALLO Fiber MDU', 'NE, CO', NULL, NULL, NULL, NULL, 'Fiber MDU; strong in college towns'),
('Consolidated Communications', 'consolidated', 'both', 'regional', 'Consolidated MDU Fiber', 'NH, VT, ME, CA, TX, IL, WA', NULL, NULL, NULL, NULL, 'Regional fiber; MDU programs'),
('TDS Telecom', 'tds-telecom', 'both', 'regional', 'TDS Fiber + DSL MDU', '30+ states (rural focus)', NULL, NULL, NULL, NULL, 'MDU fiber + DSL; larger in small markets'),
('Mediacom', 'mediacom', 'both', 'regional', 'Mediacom MDU Cable Bulk', 'Midwest + Southeast', NULL, NULL, NULL, NULL, 'Cable; MDU bulk cable agreements'),
('Astound (RCN/Wave/Grande)', 'astound', 'both', 'regional', 'Astound MDU Fiber/Cable', 'NY, DC, CHI, SF, SEA, TX', NULL, NULL, NULL, NULL, 'Dense urban fiber/cable; MDU focus'),

-- Video providers
('DirecTV (MDU Bulk Stream)', 'directv-mdu', 'video', 'national', 'DirecTV Bulk Stream', 'National', NULL, NULL, 'directv-multifamily.com', '833-923-9779', 'DOMINANT bulk video for Class A multifamily. Streaming over internet, no dishes. B2B contracts NOT publicly disclosed. To confirm: call MDU Datacom (866-255-5020) or ResTech Services. Contract: 3-5yr, auto-renew 1-yr extensions'),
('Dish Network MDU', 'dish-mdu', 'video', 'national', 'Dish MDU (legacy satellite, declining)', 'National (satellite)', NULL, NULL, NULL, NULL, 'Nearly bankrupt 2025. EchoStar/Dish merger failed; absorbed by DirecTV parent TPG/AT&T. Satellite dish installs in MDU rapidly declining. Do not recommend for new contracts'),
('Verizon Fios TV MDU', 'fios-tv', 'video', 'regional', 'Fios TV MDU', 'NY, NJ, PA, VA, MD, RI, MA, CT, DE', NULL, NULL, NULL, NULL, 'Only in Fios footprint. High quality but geographically very limited')

ON CONFLICT (slug) DO NOTHING;
