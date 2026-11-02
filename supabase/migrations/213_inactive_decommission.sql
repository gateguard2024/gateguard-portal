-- Migration 213: mark properties + customers inactive, and take a property offline
-- (remove equipment, shut systems off, close out). ALTER only — no new tables.
--
-- sites.status (text, no CHECK) gains: 'inactive' | 'decommissioning' | 'decommissioned'
--   active          normal
--   inactive        turned off (billing stops — monthly invoices only bill 'active')
--   decommissioning being taken offline (removal job open)
--   decommissioned  equipment out, closed out, kept for history
-- organizations.status (account_status enum) already has 'inactive'; is_active (bool) is kept in step.

ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS inactive_at       timestamptz;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS inactive_reason   text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS inactive_by       text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS last_service_date date;
-- Take-offline progress: { started_at, removal_wo_id, billing_todo_id, paused_watch_ids[], paused_portal_ids[], shutoff_at, closed_at, prev_status }
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS decommission      jsonb;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS inactive_at     timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS inactive_reason text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS inactive_by     text;

-- site_assets.status already uses 'removed' (hidden from the site page). Where did it go?
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS removed_at    timestamptz;
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS removed_to    text;   -- 'stock' | 'disposed' | 'left_on_site'
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS removed_by    text;
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS removal_wo_id uuid;
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS removal_photo text;  -- URL

CREATE INDEX IF NOT EXISTS idx_site_assets_removed_to ON public.site_assets (removed_to) WHERE removed_to IS NOT NULL;
