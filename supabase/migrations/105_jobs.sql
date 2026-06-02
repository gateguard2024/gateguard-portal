-- Migration 105: Jobs — Project OS
-- Tracks installation jobs, service jobs, and small-install-to-service jobs.
-- Jobs are created from won CRM opportunities. Tasks live in tracker_groups/tracker_items
-- via entity_type='job' (migration 103). This migration adds the jobs header table
-- and the start_date + progress_pct columns tracker_items needs for the Gantt view.

-- ─── jobs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jobs (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT    NOT NULL,
  job_type               TEXT    NOT NULL DEFAULT 'new_install'
    CHECK (job_type IN ('new_install', 'service', 'small_install_to_service')),
  status                 TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
  opportunity_id         UUID    REFERENCES public.opportunities(id) ON DELETE SET NULL,
  site_id                UUID    REFERENCES public.sites(id)         ON DELETE SET NULL,
  org_id                 UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_tech_id       UUID    REFERENCES public.technicians(id)   ON DELETE SET NULL,
  assigned_tech_name     TEXT,
  total_value            NUMERIC,
  start_date             DATE,
  target_completion_date DATE,
  completed_at           TIMESTAMPTZ,
  notes                  TEXT,
  site_name              TEXT,                  -- denormalised for fast list queries
  opportunity_name       TEXT,                  -- denormalised
  created_by_user_id     TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.jobs TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_jobs_org        ON public.jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_opp        ON public.jobs(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_site       ON public.jobs(site_id)        WHERE site_id        IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_start_date ON public.jobs(start_date)     WHERE start_date     IS NOT NULL;

-- ─── tracker_items: Gantt columns ────────────────────────────────────────────
-- start_date already exists from migration 104 if run; use IF NOT EXISTS.
ALTER TABLE public.tracker_items
  ADD COLUMN IF NOT EXISTS start_date    DATE,
  ADD COLUMN IF NOT EXISTS progress_pct  INTEGER DEFAULT 0
    CHECK (progress_pct BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_tracker_items_start ON public.tracker_items(start_date)
  WHERE start_date IS NOT NULL;
