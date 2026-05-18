-- Migration 032: Field Tickets + Work Order Time Tracking
-- Field tickets = lightweight on-site reports a tech fills out during / after a job
-- Time entries = clock in / clock out per tech per work order (labor actuals)

-- ── Field Tickets ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS field_tickets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  site_id           uuid REFERENCES sites(id) ON DELETE SET NULL,
  org_id            uuid REFERENCES organizations(id) ON DELETE SET NULL,

  -- Who wrote it
  technician_id     text,           -- Clerk user ID (optional)
  technician_name   text NOT NULL DEFAULT '',

  -- Ticket content
  title             text NOT NULL DEFAULT '',
  findings          text,           -- What the tech found on site
  work_performed    text,           -- What was done
  materials_used    text,           -- Free-text materials note
  labor_hours       numeric(5,2),   -- Manual override if not using time clock
  recommendations   text,           -- What should be done next

  -- Media
  photos            jsonb DEFAULT '[]'::jsonb,  -- [{url, caption, uploaded_at}]
  signature_url     text,           -- Customer signature image

  -- Workflow status
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','approved','rejected')),
  submitted_at      timestamptz,
  approved_at       timestamptz,
  approved_by       text,           -- name of approver
  rejection_reason  text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS field_tickets_work_order_id_idx ON field_tickets (work_order_id);
CREATE INDEX IF NOT EXISTS field_tickets_site_id_idx       ON field_tickets (site_id);
CREATE INDEX IF NOT EXISTS field_tickets_org_id_idx        ON field_tickets (org_id);
CREATE INDEX IF NOT EXISTS field_tickets_status_idx        ON field_tickets (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_field_tickets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_field_tickets_updated_at ON field_tickets;
CREATE TRIGGER trg_field_tickets_updated_at
  BEFORE UPDATE ON field_tickets
  FOR EACH ROW EXECUTE FUNCTION update_field_tickets_updated_at();

COMMENT ON TABLE  field_tickets                    IS 'On-site field reports written by techs during / after a work order';
COMMENT ON COLUMN field_tickets.photos             IS 'Array of {url, caption, uploaded_at} objects';
COMMENT ON COLUMN field_tickets.status             IS 'draft → submitted → approved | rejected';

-- ── Work Order Time Entries ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_order_time_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  org_id            uuid REFERENCES organizations(id) ON DELETE SET NULL,

  technician_id     text,           -- Clerk user ID (optional)
  technician_name   text NOT NULL DEFAULT '',

  clock_in          timestamptz NOT NULL DEFAULT now(),
  clock_out         timestamptz,    -- null = currently clocked in

  -- Computed labor (minutes). Stored for fast aggregation; recalculated on clock_out PATCH.
  duration_mins     integer,        -- null until clock_out is set

  notes             text,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wote_work_order_id_idx ON work_order_time_entries (work_order_id);
CREATE INDEX IF NOT EXISTS wote_org_id_idx        ON work_order_time_entries (org_id);

COMMENT ON TABLE  work_order_time_entries              IS 'Clock-in / clock-out records per technician per work order';
COMMENT ON COLUMN work_order_time_entries.clock_out    IS 'NULL while the tech is currently clocked in (active entry)';
COMMENT ON COLUMN work_order_time_entries.duration_mins IS 'Populated on clock_out: EXTRACT(EPOCH FROM clock_out - clock_in)/60';
