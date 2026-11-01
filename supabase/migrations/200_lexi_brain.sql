-- Migration 200: Lexi Phase 2 — the Brain (company knowledge + personal memory)
-- and recordings (meeting / call transcripts turned into notes and to-dos).
-- Lexi reads and writes these through the service role only; the API routes
-- check the owner / company. Run on beta first, then prod.

-- ── Brain ────────────────────────────────────────────────────────────────────
-- scope = 'company'  → shared with everyone in org_id (null org = Gate Guard corporate)
-- scope = 'personal' → only user_id sees it ("remember that I like…")
CREATE TABLE IF NOT EXISTS public.lexi_brain (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope            text NOT NULL CHECK (scope IN ('company', 'personal')),
  org_id           uuid,
  user_id          text,                 -- owner of a personal memory (Clerk user id)
  category         text NOT NULL DEFAULT 'fact',   -- fact | pricing | policy | script | voice | preference
  title            text,
  body             text NOT NULL,
  created_by       text NOT NULL,
  created_by_name  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lexi_brain TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS lexi_brain_company_idx  ON public.lexi_brain (scope, org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS lexi_brain_personal_idx ON public.lexi_brain (user_id, updated_at DESC) WHERE scope = 'personal';

-- ── Recordings ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lexi_recordings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  org_id        uuid,
  title         text,
  transcript    text NOT NULL,
  summary       text,
  result        jsonb,                  -- to-dos, CRM note, follow-up draft, suggested links
  linked_type   text,                   -- opportunity | site | work_order
  linked_id     uuid,
  linked_label  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lexi_recordings TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS lexi_recordings_user_idx ON public.lexi_recordings (user_id, created_at DESC);

-- Private by default: RLS on, only the service role (our API routes) may touch rows.
ALTER TABLE public.lexi_brain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexi_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lexi_brain_service ON public.lexi_brain;
CREATE POLICY lexi_brain_service ON public.lexi_brain FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lexi_recordings_service ON public.lexi_recordings;
CREATE POLICY lexi_recordings_service ON public.lexi_recordings FOR ALL TO service_role USING (true) WITH CHECK (true);
