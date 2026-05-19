ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS show_lead_id uuid REFERENCES show_leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_act_show_lead
  ON crm_activities (show_lead_id, created_at DESC)
  WHERE show_lead_id IS NOT NULL;
