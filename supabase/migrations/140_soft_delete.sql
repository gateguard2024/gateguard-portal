-- Migration 140: safe two-stage delete (recycle bin).
-- Records are soft-deleted (moved to Deleted Items) by setting deleted_at,
-- then can be restored or permanently removed from the bin. Nothing is hard-
-- deleted on the first action, so a mistake is always recoverable.
ALTER TABLE public.leads          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.leads          ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE public.opportunities  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.opportunities  ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE public.organizations  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.organizations  ADD COLUMN IF NOT EXISTS deleted_by text;

CREATE INDEX IF NOT EXISTS leads_deleted_idx         ON public.leads (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS opportunities_deleted_idx ON public.opportunities (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS organizations_deleted_idx ON public.organizations (deleted_at) WHERE deleted_at IS NOT NULL;
