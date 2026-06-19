-- Migration 122: playbooks (reusable work-order step templates)
-- org_id NULL = global GateGuard library (visible to all); non-null = dealer-private.
-- Same catalog model as products.

CREATE TABLE IF NOT EXISTS public.playbooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES public.organizations(id) ON DELETE CASCADE,  -- NULL = global
  title       TEXT NOT NULL,
  category    TEXT,                         -- e.g. 'Camera', 'Gate', 'Access Control'
  description TEXT,
  steps       JSONB NOT NULL DEFAULT '[]',  -- array of step titles (strings) or {title}
  created_by  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.playbooks TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS playbooks_org_idx ON public.playbooks (org_id);

-- Seed a couple of global playbooks (idempotent on title where org_id is null)
INSERT INTO public.playbooks (org_id, title, category, description, steps)
SELECT NULL, 'Camera Health Check', 'Camera', 'Standard monthly camera inspection.',
       '["Verify online status","Clean lens","Check view angle","Confirm recording","Check night vision"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.playbooks WHERE org_id IS NULL AND title = 'Camera Health Check');

INSERT INTO public.playbooks (org_id, title, category, description, steps)
SELECT NULL, 'Access Control Test', 'Access Control', 'Verify readers and door hardware.',
       '["Test reader","Test mobile pass","Check door strike","Confirm event log","Verify REX / motion"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.playbooks WHERE org_id IS NULL AND title = 'Access Control Test');

INSERT INTO public.playbooks (org_id, title, category, description, steps)
SELECT NULL, 'Gate Operator Service', 'Gate', 'Preventive service for slide/swing gate operators.',
       '["Power off at disconnect","Inspect chain / belt tension","Lubricate moving parts","Test safety loops & photo eyes","Test obstruction reverse","Confirm open/close limits","Power on & cycle 3x"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.playbooks WHERE org_id IS NULL AND title = 'Gate Operator Service');
