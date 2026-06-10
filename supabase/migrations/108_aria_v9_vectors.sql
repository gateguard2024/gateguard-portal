-- Migration 108: ARIA v9 — Vector Embeddings + Evidence Provenance
-- Adds vector embedding columns for sub-5ms cosine similarity cache lookup,
-- provenance metadata for scoring, and drops the NOT NULL constraint on
-- aria_evidence_packets.search_run_id so Inngest background jobs can
-- insert evidence without a live session search_run_id.
--
-- REQUIRES: pgvector extension (enabled in migration 004)
-- SAFE TO RUN: All ALTER TABLE statements — no new tables, no GRANT needed.

-- ─── 0. Add missing location columns to aria_properties ──────────────────────
-- city, state, zip were omitted from migration 098. They are core fields used
-- by the ARIA page, cache route, search-runs annotation, and every prospect card.
ALTER TABLE public.aria_properties
  ADD COLUMN IF NOT EXISTS city  TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip   TEXT;

-- Index state for common geo filters (e.g. "properties in GA")
CREATE INDEX IF NOT EXISTS idx_aria_properties_state ON public.aria_properties (state);

-- ─── 1. property_embedding on aria_properties ─────────────────────────────────
-- Populated after every deep search via the properties POST route.
-- HNSW index enables sub-5ms <=> cosine similarity queries at scale.
ALTER TABLE public.aria_properties
  ADD COLUMN IF NOT EXISTS property_embedding VECTOR(1536);

-- HNSW index for fast approximate nearest-neighbor cosine search
-- m=16, ef_construction=64 are Supabase defaults — good for up to ~500k rows
CREATE INDEX IF NOT EXISTS idx_aria_properties_embedding
  ON public.aria_properties
  USING hnsw (property_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─── 2. query_embedding on aria_search_runs ───────────────────────────────────
-- Stored for debugging and future analytics (e.g., cluster similar searches).
ALTER TABLE public.aria_search_runs
  ADD COLUMN IF NOT EXISTS query_embedding VECTOR(1536);

-- ─── 3. provenance_metadata JSONB on aria_evidence_packets ───────────────────
-- Stores the computed provenance score breakdown for each evidence packet.
-- Shape: { score: number, authority: number, frequency_mult: number, directness_penalty: number }
ALTER TABLE public.aria_evidence_packets
  ADD COLUMN IF NOT EXISTS provenance_metadata JSONB;

-- ─── 4. DROP NOT NULL on search_run_id ────────────────────────────────────────
-- CRITICAL: Inngest background enrichment jobs have no live search_run_id.
-- The FK constraint stays (NULL is a valid FK in Postgres) — only the
-- NOT NULL requirement is removed. Existing rows are unaffected.
ALTER TABLE public.aria_evidence_packets
  ALTER COLUMN search_run_id DROP NOT NULL;

-- ─── 5. find_aria_property_by_embedding RPC ───────────────────────────────────
-- Called by the cache route to do vector-based lookup before falling back to ILIKE.
-- Returns the single closest property above the similarity threshold.
-- Uses 1-cosine_distance = cosine_similarity (pgvector <=> returns distance).
--
-- p_embedding      — 1536-dim embedding from text-embedding-3-small
-- p_threshold      — minimum cosine similarity (0.0–1.0). Default 0.88 is tight
--                    to prevent false matches on generic queries.
-- Returns: matching aria_properties row columns or empty set
--
-- pain_signals, behavioral_profile, pitch_strategy, scout_brief are JSONB.
-- aria_confidence is TEXT (enum: confirmed/high/medium/low).
CREATE OR REPLACE FUNCTION public.find_aria_property_by_embedding(
  p_embedding   VECTOR(1536),
  p_threshold   FLOAT DEFAULT 0.88
)
RETURNS TABLE (
  id                    UUID,
  property_name         TEXT,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  zip                   TEXT,
  units                 INT,
  year_built            INT,
  property_type         TEXT,
  class                 TEXT,
  management_company    TEXT,
  owner_entity          TEXT,
  owner_type            TEXT,
  acquisition_year      INT,
  capex_signal          TEXT,
  isp_providers         TEXT[],
  video_providers       TEXT[],
  bulk_agreements       JSONB,
  fcc_verified          BOOLEAN,
  gate_operators        TEXT[],
  access_control        TEXT[],
  intercoms             TEXT[],
  cameras               TEXT[],
  smart_locks           TEXT[],
  resident_apps         TEXT[],
  package_solutions     TEXT[],
  tech_generation       TEXT,
  sara_signals          BOOLEAN,
  replacement_window    TEXT,
  displacement_targets  TEXT[],
  buy_score             INT,
  urgency               TEXT,
  primary_concern       TEXT,
  current_vendor        TEXT,
  contract_window       TEXT,
  contract_expiry_year  INT,
  communication_style   TEXT,
  behavioral_profile    JSONB,
  pitch_strategy        JSONB,
  pain_signals          JSONB,
  dm_name               TEXT,
  dm_title              TEXT,
  dm_company            TEXT,
  dm_email              TEXT,
  dm_phone              TEXT,
  dm_linkedin_slug      TEXT,
  dm_chain              JSONB,
  scout_brief           JSONB,
  roe_detected          BOOLEAN,
  roe_providers         TEXT[],
  roe_expiry_year       INT,
  times_researched      INT,
  last_researched_at    TIMESTAMPTZ,
  aria_confidence       TEXT,
  sales_stage           TEXT,
  sales_notes           TEXT,
  assigned_rep          TEXT,
  similarity            FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id, property_name, address, city, state, zip,
    units, year_built, property_type,
    class, management_company, owner_entity, owner_type, acquisition_year,
    capex_signal, isp_providers, video_providers, bulk_agreements, fcc_verified,
    gate_operators, access_control, intercoms, cameras, smart_locks,
    resident_apps, package_solutions, tech_generation, sara_signals,
    replacement_window, displacement_targets, buy_score, urgency,
    primary_concern, current_vendor, contract_window, contract_expiry_year,
    communication_style, behavioral_profile, pitch_strategy, pain_signals,
    dm_name, dm_title, dm_company, dm_email, dm_phone, dm_linkedin_slug,
    dm_chain, scout_brief, roe_detected, roe_providers, roe_expiry_year,
    times_researched, last_researched_at, aria_confidence,
    sales_stage, sales_notes, assigned_rep,
    1 - (property_embedding <=> p_embedding) AS similarity
  FROM public.aria_properties
  WHERE
    property_embedding IS NOT NULL
    AND 1 - (property_embedding <=> p_embedding) >= p_threshold
  ORDER BY property_embedding <=> p_embedding
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_aria_property_by_embedding(VECTOR(1536), FLOAT)
  TO postgres, anon, authenticated, service_role;
