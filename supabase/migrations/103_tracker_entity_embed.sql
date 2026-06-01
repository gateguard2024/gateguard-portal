-- Migration 103: Tracker entity embedding
-- Allows tracker_groups (and their items) to be linked to any portal entity:
-- opportunity, work_order, site, lead, dealer, quote, etc.
-- org_id becomes optional — null when the board is tied directly to an entity.

ALTER TABLE public.tracker_groups
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id   UUID;

-- Make org_id optional so entity-linked boards don't require an org_id
ALTER TABLE public.tracker_groups
  ALTER COLUMN org_id DROP NOT NULL;

-- Fast lookup by entity
CREATE INDEX IF NOT EXISTS idx_tracker_groups_entity
  ON public.tracker_groups(entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

-- Retain fast lookup by org (for standalone boards)
CREATE INDEX IF NOT EXISTS idx_tracker_groups_org_id
  ON public.tracker_groups(org_id)
  WHERE org_id IS NOT NULL;
