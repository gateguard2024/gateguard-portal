-- Migration 096: Add entity_type to organizations
-- Tracks legal entity type for each dealer org (LLC, Corp, Sole Prop, etc.)
-- Used in onboarding wizard Step 2 and dealer detail display.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS entity_type TEXT;

-- Optional: comment describing valid values
COMMENT ON COLUMN public.organizations.entity_type IS
  'Legal entity type: LLC, Corporation, S-Corp, Sole Proprietorship, Partnership, Non-Profit, Other';
