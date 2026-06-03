-- Migration 107: ARIA v8 — Case File Architecture
-- Adds three tables that turn every ARIA search into a durable case file:
--   aria_search_runs  — one record per pipeline execution
--   aria_candidates   — ALL discovered properties, never deleted
--   aria_evidence_packets — every found fact with source + confidence
-- Rule: No synthesis without ledger. No deletion without human action.

-- ─── aria_search_runs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aria_search_runs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                TEXT,
  user_id               TEXT,
  raw_query             TEXT        NOT NULL,
  intent_type           TEXT,       -- specific_property | city_prospect | criteria_prospect | contract_prospect
  rewritten_query       JSONB,      -- structured output from Phase 0 rewrite
  status                TEXT        NOT NULL DEFAULT 'running',  -- running | complete | failed
  candidate_count       INT         NOT NULL DEFAULT 0,
  selected_candidate_id UUID,       -- FK to aria_candidates (set after selection)
  evidence_count        INT         NOT NULL DEFAULT 0,
  quality_gates_passed  JSONB,      -- { units: true, phone: true, address: true, ... }
  total_cost_cents      INT,        -- estimated API cost in cents
  duration_ms           INT,        -- total pipeline duration
  engine_version        TEXT        DEFAULT 'v8.0',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.aria_search_runs TO postgres, anon, authenticated, service_role;

-- ─── aria_candidates ─────────────────────────────────────────────────────────
-- Every property discovered in a search run — none are deleted.
-- status tracks lifecycle from discovery through selection or rejection.
CREATE TABLE IF NOT EXISTS public.aria_candidates (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_run_id         UUID        NOT NULL REFERENCES public.aria_search_runs(id) ON DELETE CASCADE,
  rank_position         INT,        -- 1 = top match; lower is better
  confidence_score      NUMERIC(5,2),  -- 0.00–100.00

  -- Core identity (from Phase 1A)
  property_name         TEXT,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  zip                   TEXT,
  units                 INT,
  year_built            INT,
  property_type         TEXT,
  management_company    TEXT,
  owner_entity          TEXT,
  phone                 TEXT,
  website               TEXT,

  -- ISP / tech summary (from Phase 2-3)
  isp_providers         TEXT[],
  bulk_agreement_hint   BOOLEAN     DEFAULT false,
  gate_issue_detected   BOOLEAN     DEFAULT false,
  pain_signals          TEXT[],

  -- Lifecycle
  status                TEXT        NOT NULL DEFAULT 'pending',
  -- pending | selected | rejected_by_score | rejected_by_user | needs_review
  rejection_reason      TEXT,       -- why it was not selected
  selected_at           TIMESTAMPTZ,
  selected_by           TEXT,       -- 'auto' or user_id

  -- Evidence summary (denormalized for quick display)
  evidence_count        INT         NOT NULL DEFAULT 0,
  top_evidence_snippet  TEXT,       -- most compelling single piece of evidence

  -- Link to full intel (if deeply enriched)
  aria_property_id      UUID        REFERENCES public.aria_properties(id),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.aria_candidates TO postgres, anon, authenticated, service_role;

-- ─── aria_evidence_packets ───────────────────────────────────────────────────
-- Every fact found during a search, linked to its candidate and source.
-- Late-arriving data attaches to the right candidate after the fact.
-- This is the audit trail and the synthesis input.
CREATE TABLE IF NOT EXISTS public.aria_evidence_packets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_run_id     UUID        NOT NULL REFERENCES public.aria_search_runs(id) ON DELETE CASCADE,
  candidate_id      UUID        REFERENCES public.aria_candidates(id) ON DELETE SET NULL,

  -- Source
  source_url        TEXT,
  source_type       TEXT,       -- listing | review | news | county | management | fcc | apollo | ninjapear | social | db
  source_authority  INT         DEFAULT 5,  -- 1–10 from SOURCE_AUTHORITY_WEIGHTS

  -- Fact
  fact_type         TEXT,       -- units | address | phone | owner | isp | video | gate_issue | contact | price | roe | pain_signal | proptech
  extracted_value   TEXT,
  confidence        NUMERIC(5,2) DEFAULT 50,  -- 0–100

  -- Raw evidence
  raw_snippet       TEXT,       -- up to 600 chars of source text

  -- Metadata
  phase_found       INT         DEFAULT 0,  -- 0=QueryRewrite 1=Discovery 2=Enrichment 3=Intelligence 4=Synthesis
  arrival_order     INT,        -- sequence within the run (for debugging out-of-order delivery)

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.aria_evidence_packets TO postgres, anon, authenticated, service_role;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_aria_search_runs_user      ON public.aria_search_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_aria_search_runs_org       ON public.aria_search_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_aria_search_runs_created   ON public.aria_search_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aria_candidates_run        ON public.aria_candidates(search_run_id);
CREATE INDEX IF NOT EXISTS idx_aria_candidates_status     ON public.aria_candidates(status);
CREATE INDEX IF NOT EXISTS idx_aria_candidates_rank       ON public.aria_candidates(search_run_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_aria_evidence_run          ON public.aria_evidence_packets(search_run_id);
CREATE INDEX IF NOT EXISTS idx_aria_evidence_candidate    ON public.aria_evidence_packets(candidate_id);
CREATE INDEX IF NOT EXISTS idx_aria_evidence_fact_type    ON public.aria_evidence_packets(fact_type);

-- ─── Helper RPC: get_search_run_with_candidates ───────────────────────────
-- Returns a search run with all its candidates ordered by rank.
CREATE OR REPLACE FUNCTION public.get_search_run_with_candidates(p_run_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'run',       to_jsonb(r),
    'candidates', (
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.rank_position)
      FROM public.aria_candidates c
      WHERE c.search_run_id = p_run_id
    )
  )
  FROM public.aria_search_runs r
  WHERE r.id = p_run_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_search_run_with_candidates(UUID) TO postgres, anon, authenticated, service_role;
