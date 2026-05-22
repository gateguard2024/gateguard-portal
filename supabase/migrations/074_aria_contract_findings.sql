-- Migration 074: ARIA Contract Findings
-- Persistent storage for all bulk MDU telecom contract data discovered by ARIA.
-- This table survives search deletions (SET NULL FK), admin updates, and cross-references
-- new searches against previously confirmed data. It is the growing intelligence layer.

CREATE TABLE IF NOT EXISTS aria_contract_findings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Property identification
  property_name       TEXT,
  property_address    TEXT,
  property_city       TEXT,
  property_state      CHAR(2),    -- 2-letter state code: GA, TX, FL, CA, etc.
  management_company  TEXT,
  owner_entity        TEXT,

  -- Provider
  provider_name       TEXT NOT NULL,
  provider_type       TEXT NOT NULL DEFAULT 'isp',          -- 'isp' | 'video' | 'bundled'
  agreement_type      TEXT NOT NULL DEFAULT 'unknown',      -- 'exclusive' | 'bulk' | 'preferred' | 'unknown'
  service_type        TEXT NOT NULL DEFAULT 'internet',     -- 'internet' | 'video' | 'bundled'

  -- Contract dates — THE GOLD
  effective_date      DATE,
  expiry_date         DATE,
  expiry_year         SMALLINT,       -- extracted integer year for fast range queries
  term_years          NUMERIC(4,1),   -- stated contract term length
  auto_renewal_years  NUMERIC(4,1),   -- auto-renewal period if evergreen clause present

  -- Source provenance
  source_type         TEXT NOT NULL,  -- 'contract-pdf' | 'ucc-filing' | 'county-deed' | 'wayback' |
                                      -- 'edgar' | 'isp-press-release' | 'offering-memo' | 'hoa-rfp' | etc.
  source_url          TEXT,
  source_snippet      TEXT,           -- raw excerpt from the source document (≤500 chars)
  confidence          TEXT NOT NULL DEFAULT 'medium',  -- 'confirmed' | 'high' | 'medium-high' | 'medium' | 'low'

  -- Enrichment
  dnb_duns            TEXT,           -- D&B DUNS number of owner/debtor entity
  wayback_first_seen  DATE,           -- Wayback CDX first-crawl date of ISP portfolio page
  ucc_filing_date     DATE,           -- UCC-1 filing date (exact deal start)
  ucc_filing_state    CHAR(2),        -- State where UCC-1 was filed
  county_recording_id TEXT,           -- County recorder instrument/document number

  -- Lifecycle
  found_by_search_id  UUID REFERENCES aria_searches(id) ON DELETE SET NULL,
  verified            BOOLEAN DEFAULT FALSE,
  verified_at         TIMESTAMPTZ,
  verified_by         TEXT,           -- 'aria' | 'manual' | email of GateGuard team member
  notes               TEXT,           -- admin override notes

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

-- Primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_acf_property_name     ON aria_contract_findings (lower(property_name));
CREATE INDEX IF NOT EXISTS idx_acf_property_address  ON aria_contract_findings (lower(property_address));
CREATE INDEX IF NOT EXISTS idx_acf_management_co     ON aria_contract_findings (lower(management_company));
CREATE INDEX IF NOT EXISTS idx_acf_owner             ON aria_contract_findings (lower(owner_entity));
CREATE INDEX IF NOT EXISTS idx_acf_provider          ON aria_contract_findings (lower(provider_name));
CREATE INDEX IF NOT EXISTS idx_acf_state             ON aria_contract_findings (property_state);

-- Contract window queries: "what contracts expire in 2026?"
CREATE INDEX IF NOT EXISTS idx_acf_expiry_year       ON aria_contract_findings (expiry_year);
CREATE INDEX IF NOT EXISTS idx_acf_expiry_date       ON aria_contract_findings (expiry_date);

-- Quality filtering
CREATE INDEX IF NOT EXISTS idx_acf_confidence        ON aria_contract_findings (confidence);
CREATE INDEX IF NOT EXISTS idx_acf_verified          ON aria_contract_findings (verified);
CREATE INDEX IF NOT EXISTS idx_acf_source_type       ON aria_contract_findings (source_type);

-- Upsert deduplication key: same provider at same property = one record, update if confidence improves
CREATE UNIQUE INDEX IF NOT EXISTS idx_acf_unique
  ON aria_contract_findings (lower(provider_name), lower(COALESCE(property_address, property_name)));

-- ─── Trigger: auto-update updated_at ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_aria_contract_findings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER aria_contract_findings_updated_at
  BEFORE UPDATE ON aria_contract_findings
  FOR EACH ROW EXECUTE FUNCTION update_aria_contract_findings_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE aria_contract_findings ENABLE ROW LEVEL SECURITY;

-- Service role has full access (server-side API routes)
CREATE POLICY "service_role_all" ON aria_contract_findings
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated portal users can read (for future /aria/findings page)
CREATE POLICY "authenticated_read" ON aria_contract_findings
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE aria_contract_findings IS
  'Persistent MDU bulk contract intelligence discovered by ARIA. Survives search deletion. '
  'Source of truth for contract expiry dates. Cross-referenced on every new ARIA search. '
  'Updated via /api/aria/findings (admin PATCH) or automatically by the research route.';

COMMENT ON COLUMN aria_contract_findings.expiry_year IS
  'Integer year extracted from expiry_date or expiry_estimate for fast range queries. '
  'Example: SELECT * WHERE expiry_year BETWEEN 2025 AND 2027 ORDER BY confidence DESC';

COMMENT ON COLUMN aria_contract_findings.source_type IS
  'Taxonomy matches ARIA source label system: contract-pdf | ucc-filing | county-deed | '
  'wayback | edgar | isp-press-release | offering-memo | hoa-rfp | city-permit | '
  'provider-slug-page | forced-service | community-social | listing-site';

COMMENT ON COLUMN aria_contract_findings.county_recording_id IS
  'County recorder instrument or document number (varies by state). '
  'Examples: "2023-00123456" (GA GSCCCA), "DOC#2023-0045678" (FL), "Instrument 2023012345" (TX)';
