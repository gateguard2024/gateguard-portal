-- Migration 083: EOS Meetings
-- Persists L10 and other EOS meeting definitions per organization

CREATE TABLE IF NOT EXISTS eos_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'L10 Meeting',
  meeting_type text NOT NULL DEFAULT 'l10'
    CHECK (meeting_type IN ('l10', 'quarterly', 'annual', 'department', 'custom')),
  day_of_week text,
  time_of_day text,
  duration_minutes integer NOT NULL DEFAULT 90,
  attendees jsonb DEFAULT '[]'::jsonb,
  agenda jsonb DEFAULT '[]'::jsonb,
  recurrence text DEFAULT 'weekly'
    CHECK (recurrence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'once')),
  next_meeting_at timestamptz,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eos_meetings_org_id_idx ON eos_meetings(org_id);

CREATE TABLE IF NOT EXISTS eos_meeting_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES eos_meetings(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  attendees_present jsonb DEFAULT '[]'::jsonb,
  ratings jsonb DEFAULT '[]'::jsonb,
  avg_rating numeric,
  notes text,
  todos_reviewed integer DEFAULT 0,
  issues_resolved integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eos_meeting_instances_meeting_id_idx ON eos_meeting_instances(meeting_id);

-- Updated_at trigger (reuse existing function from migration 010)
DROP TRIGGER IF EXISTS eos_meetings_updated_at ON eos_meetings;
CREATE TRIGGER eos_meetings_updated_at
  BEFORE UPDATE ON eos_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE eos_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE eos_meeting_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON eos_meetings;
DROP POLICY IF EXISTS "Service role full access" ON eos_meeting_instances;

CREATE POLICY "Service role full access" ON eos_meetings FOR ALL USING (true);
CREATE POLICY "Service role full access" ON eos_meeting_instances FOR ALL USING (true);
