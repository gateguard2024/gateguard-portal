-- Migration 212: two-way job texts (Twilio). One row per text, in or out.
--   work_order_id  the job it belongs to (NULL = a customer texted and Nexus couldn't
--                  match it to a job yet — shown to Gate Guard corporate as "unmatched")
--   direction      out = we sent it · in = the customer sent it
--   kind           manual (typed on the job) · update (a draft sent from Customer updates)
--                  · status (On my way / Arrived / Job done / Review) · inbound
--   twilio_sid     Twilio's message id — unique, so a webhook retry is never saved twice
-- Server-only (service role). Run on beta, then prod.

CREATE TABLE IF NOT EXISTS public.wo_texts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  site_id        uuid,
  org_id         uuid,
  direction      text NOT NULL CHECK (direction IN ('out','in')),
  phone          text NOT NULL,                 -- the customer's number, E.164 (+14045550100)
  body           text NOT NULL,
  kind           text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','update','status','inbound')),
  status         text,                          -- sent | failed | received
  error          text,
  twilio_sid     text,
  author_name    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  read_at        timestamptz
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.wo_texts TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_wo_texts_job     ON public.wo_texts(work_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wo_texts_phone   ON public.wo_texts(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wo_texts_unmatched ON public.wo_texts(created_at DESC) WHERE work_order_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wo_texts_sid_uniq ON public.wo_texts(twilio_sid) WHERE twilio_sid IS NOT NULL;

ALTER TABLE public.wo_texts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY wo_texts_service ON public.wo_texts FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
