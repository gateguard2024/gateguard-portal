-- Migration 106: Project Management OS expansion
-- Adds rich column types, dependencies, automations, and dashboard support

-- Add column_schema to tracker_groups (defines custom column types for the board)
ALTER TABLE tracker_groups ADD COLUMN IF NOT EXISTS column_schema JSONB DEFAULT '[]';

-- Add rich fields to tracker_items
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100);
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2);
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(6,2);
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS watcher_ids TEXT[] DEFAULT '{}';
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE tracker_items ADD COLUMN IF NOT EXISTS owner_user_id TEXT;

-- Item dependencies (for Gantt)
CREATE TABLE IF NOT EXISTS tracker_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_item_id UUID NOT NULL REFERENCES tracker_items(id) ON DELETE CASCADE,
  to_item_id UUID NOT NULL REFERENCES tracker_items(id) ON DELETE CASCADE,
  dep_type TEXT DEFAULT 'finish_to_start',
  lag_days INTEGER DEFAULT 0,
  org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_item_id, to_item_id)
);
GRANT ALL ON TABLE public.tracker_dependencies TO postgres, anon, authenticated, service_role;

-- Automation rules
CREATE TABLE IF NOT EXISTS tracker_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  board_id UUID,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}',
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.tracker_automations TO postgres, anon, authenticated, service_role;

-- Activity log per item
CREATE TABLE IF NOT EXISTS tracker_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES tracker_items(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  field_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.tracker_activity TO postgres, anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS tracker_activity_item_idx ON tracker_activity(item_id);

-- Dashboard configs
CREATE TABLE IF NOT EXISTS tracker_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL DEFAULT 'My Dashboard',
  widgets JSONB DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.tracker_dashboards TO postgres, anon, authenticated, service_role;

-- Indexes
CREATE INDEX IF NOT EXISTS tracker_deps_from_idx ON tracker_dependencies(from_item_id);
CREATE INDEX IF NOT EXISTS tracker_deps_to_idx ON tracker_dependencies(to_item_id);
CREATE INDEX IF NOT EXISTS tracker_automations_org_idx ON tracker_automations(org_id);
