-- Migration 171: per-org isolation for the ARIA intelligence DB.
-- aria_properties had no org column, so any authenticated user could read every
-- tenant's prospect intel + decision-maker PII. Add org_id and scope reads to it.
-- Legacy rows stay NULL (visible to corporate only) until re-researched by an org.
ALTER TABLE public.aria_properties
  ADD COLUMN IF NOT EXISTS org_id UUID;

CREATE INDEX IF NOT EXISTS idx_aria_properties_org ON public.aria_properties(org_id)
  WHERE org_id IS NOT NULL;
