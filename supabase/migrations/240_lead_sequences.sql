-- Migration 240: Email sequences in Leads.
--
-- ADD-ON ONLY. Nothing is dropped, renamed or overwritten:
--   • 4 NEW tables: lead_sequences, lead_sequence_steps, lead_sequence_runs, lead_sequence_sends
--   • 1 NEW column: leads.do_not_email
--   • 2 starter sequences for Gate Guard (inserted only if no sequence has that name yet).
-- Safe to run twice.
--
-- The model:
--   lead_sequences       a sequence ("New lead — 4 emails"). org_id NULL = Gate Guard's own;
--                        otherwise the dealer's company.
--   lead_sequence_steps  each email: day it goes (days after the start), subject, body with
--                        {first_name} {property} {units} {city} {company} {rep_name} {rep_first},
--                        and whether it goes as a reply in the same email conversation.
--   lead_sequence_runs   one lead in one sequence: who sends it (their own Gmail), which step
--                        is next, when, and why it stopped (replied / bounced / lost / won …).
--                        Only ONE active or paused run per lead.
--   lead_sequence_sends  every email sent (one row per run + step — a step can never go twice).
--                        Also counts the 50-a-day cap per rep.
--   leads.do_not_email   set when a lead replies "stop" (or a rep ticks it). Nothing is ever
--                        sent to that lead again until someone clears it.
--
-- Rules live in lib/lead-sequences.ts. Security: every table is RLS on, service-role only
-- (the API decides who sees what).

-- ── 1. Sequences ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_sequences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid REFERENCES public.organizations(id) ON DELETE CASCADE,  -- NULL = Gate Guard
  name         text NOT NULL,
  description  text,
  active       boolean NOT NULL DEFAULT true,
  created_by   text,               -- Clerk user id
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lead_sequences TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS lead_sequences_org_idx ON public.lead_sequences (org_id);

-- ── 2. Steps (each email) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_sequence_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id  uuid NOT NULL REFERENCES public.lead_sequences(id) ON DELETE CASCADE,
  step_no      integer NOT NULL CHECK (step_no >= 1),
  day_offset   integer NOT NULL DEFAULT 0 CHECK (day_offset >= 0 AND day_offset <= 365),
  subject      text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  same_thread  boolean NOT NULL DEFAULT true,   -- go as a reply in the first email's conversation
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lead_sequence_steps TO postgres, anon, authenticated, service_role;

CREATE UNIQUE INDEX IF NOT EXISTS lead_sequence_steps_uniq ON public.lead_sequence_steps (sequence_id, step_no);

-- ── 3. Runs (one lead in one sequence) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_sequence_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id      uuid NOT NULL REFERENCES public.lead_sequences(id) ON DELETE CASCADE,
  org_id           uuid,                 -- the lead's company (for scoping)
  user_id          text NOT NULL,        -- Clerk id of the rep whose Gmail sends it
  sender_name      text,
  sender_email     text,
  channel_id       uuid,                 -- message_channels.id (the rep's Gmail)
  to_email         text NOT NULL,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished', 'stopped')),
  sent_count       integer NOT NULL DEFAULT 0,     -- steps sent (next step = sent_count + 1)
  step_total       integer NOT NULL DEFAULT 0,
  next_send_at     timestamptz,
  started_at       timestamptz NOT NULL DEFAULT now(),
  last_sent_at     timestamptz,
  gmail_thread_id  text,                 -- the conversation step 1 started
  first_subject    text,
  step1_subject    text,                 -- the rep's edits to email 1 on the Start screen
  step1_body       text,                 --   (kept so they're used even if email 1 waits)
  pause_reason     text,
  stop_reason      text,                 -- replied · bounced · lost · won · stuck · do_not_email · no_email · manual …
  stopped_at       timestamptz,
  fail_count       integer NOT NULL DEFAULT 0,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lead_sequence_runs TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS lead_sequence_runs_lead_idx ON public.lead_sequence_runs (lead_id);
CREATE INDEX IF NOT EXISTS lead_sequence_runs_due_idx  ON public.lead_sequence_runs (next_send_at) WHERE status = 'active';
-- One live (active or paused) run per lead.
CREATE UNIQUE INDEX IF NOT EXISTS lead_sequence_runs_live_uniq ON public.lead_sequence_runs (lead_id) WHERE status IN ('active', 'paused');

-- ── 4. Every email sent ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_sequence_sends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES public.lead_sequence_runs(id) ON DELETE CASCADE,
  lead_id           uuid NOT NULL,
  user_id           text NOT NULL,
  step_no           integer NOT NULL,
  status            text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
  subject           text,
  gmail_message_id  text,
  gmail_thread_id   text,
  error             text,
  sent_at           timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lead_sequence_sends TO postgres, anon, authenticated, service_role;

-- A step can only ever be sent once per run.
CREATE UNIQUE INDEX IF NOT EXISTS lead_sequence_sends_step_uniq ON public.lead_sequence_sends (run_id, step_no);
CREATE INDEX IF NOT EXISTS lead_sequence_sends_user_day_idx ON public.lead_sequence_sends (user_id, sent_at);

-- ── 5. Do not email ─────────────────────────────────────────────────────────
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS do_not_email boolean NOT NULL DEFAULT false;

-- ── 6. Security: RLS on, service role only ──────────────────────────────────
ALTER TABLE public.lead_sequences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sequence_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sequence_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY lead_sequences_service      ON public.lead_sequences      FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY lead_sequence_steps_service ON public.lead_sequence_steps FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY lead_sequence_runs_service  ON public.lead_sequence_runs  FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY lead_sequence_sends_service ON public.lead_sequence_sends FOR ALL TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. Two starter sequences for Gate Guard (edit them in Leads → Sequences) ─
DO $$
DECLARE sid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lead_sequences WHERE org_id IS NULL AND name = 'New lead (4 emails)') THEN
    INSERT INTO public.lead_sequences (org_id, name, description)
      VALUES (NULL, 'New lead (4 emails)', 'First contact with a new property lead — 4 short emails over 2 weeks.')
      RETURNING id INTO sid;
    INSERT INTO public.lead_sequence_steps (sequence_id, step_no, day_offset, subject, body, same_thread) VALUES
    (sid, 1, 0, 'Gates and access at {property}',
'Hi {first_name},

I''m {rep_first} with Gate Guard. We take over the gates, access control and gate cameras at apartment communities — we install it, monitor it and fix it, for one monthly price.

Most properties we talk to are tired of surprise repair bills and gates stuck open. With us, residents pay a one-time move-in access fee, and the property gets a system that just works with no capital outlay.

Would it be worth a quick 15-minute call to see if it fits {property}?

Thanks,', true),
    (sid, 2, 3, '',
'Hi {first_name},

Wanted to bring this back to the top of your inbox. Happy to come out and walk the property for free — about 30 minutes, and you''d get a real number for {property}, no obligation.

Is there a day this week or next that works?', true),
    (sid, 3, 7, '',
'Hi {first_name},

One thing property managers like: we handle every gate repair call, so your team stops chasing vendors, and an open or broken gate gets flagged to us automatically.

If someone else handles access decisions for {property}, could you point me to the right person?', true),
    (sid, 4, 14, '',
'Hi {first_name},

I don''t want to keep filling your inbox, so this is my last note for now. If gates or access ever become a headache at {property}, just reply here and I''ll pick it right up.

All the best,', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.lead_sequences WHERE org_id IS NULL AND name = 'Gone quiet (3 emails)') THEN
    INSERT INTO public.lead_sequences (org_id, name, description)
      VALUES (NULL, 'Gone quiet (3 emails)', 'For a lead we talked to that went silent — 3 light check-ins over 3 weeks.')
      RETURNING id INTO sid;
    INSERT INTO public.lead_sequence_steps (sequence_id, step_no, day_offset, subject, body, same_thread) VALUES
    (sid, 1, 0, 'Checking in on {property}',
'Hi {first_name},

It''s been a little while since we talked about the gates and access at {property}, so I wanted to check in. Has anything changed on your side, or is now still not the right time?

Happy to send an updated number or come walk the property again.', true),
    (sid, 2, 7, '',
'Hi {first_name},

Quick follow-up — if budget timing is the hold-up, we can start with a site evaluation now so you have real numbers ready when the time comes. No cost for that.', true),
    (sid, 3, 21, '',
'Hi {first_name},

I''ll stop checking in for now. Whenever you''re ready to look at gates and access for {property}, just reply to this email and I''ll take it from there.

Thanks,', true);
  END IF;
END $$;
