-- Migration 139: Quick Log — one frictionless capture inbox.
-- Every call note, to-do, and random idea lands here first (one bucket), then
-- gets triaged into a To-Do or attached to a lead/opportunity/job.
CREATE TABLE IF NOT EXISTS public.capture_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid,                       -- dealer_org_id of the creator (nullable for corporate)
  user_id         text NOT NULL,              -- Clerk id of who captured it
  user_name       text,
  body            text NOT NULL,              -- the raw captured text
  source          text NOT NULL DEFAULT 'text',   -- 'text' | 'voice'
  kind            text,                       -- 'call' | 'todo' | 'idea' | 'note' (best-effort guess, editable)
  about           text,                       -- free-text "who/what it's about"
  status          text NOT NULL DEFAULT 'open',   -- 'open' | 'done' | 'triaged'
  linked_type     text,                       -- 'lead' | 'opportunity' | 'work_order' once attached
  linked_id       uuid,
  promoted_todo_id uuid,                       -- set when turned into a to-do
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.capture_log TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS capture_log_user_idx   ON public.capture_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS capture_log_status_idx ON public.capture_log (user_id, status);
CREATE INDEX IF NOT EXISTS capture_log_org_idx    ON public.capture_log (org_id);
