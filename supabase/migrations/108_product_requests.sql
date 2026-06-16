-- Migration 108: rep-submitted "please add this product" requests from the
-- survey device picker. Captured + sent to corporate; no review queue yet.
CREATE TABLE IF NOT EXISTS public.product_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by    TEXT,                 -- profiles.id of the requester
  requester_name  TEXT,
  org_id          UUID,                 -- requester's org
  opportunity_id  UUID,                 -- where the request came from (optional)
  survey_id       UUID,                 -- survey it was added on (optional)
  name            TEXT NOT NULL,        -- product / device name
  brand           TEXT,
  model           TEXT,
  category        TEXT,
  est_cost        NUMERIC,              -- rep's guess at what it costs
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | added | declined
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.product_requests TO postgres, anon, authenticated, service_role;
