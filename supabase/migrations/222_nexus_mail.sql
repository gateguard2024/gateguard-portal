-- Migration 222: Nexus Mail (Nov 5 2026) — live two-way Gmail + a real email screen.
-- ALTER only (no new tables → no GRANT needed). Run on beta first, then prod.
--
-- message_channels: where the live sync left off (Gmail historyId) + the last error,
--                   so a dropped Google login shows "Reconnect Gmail" instead of silence.
-- message_threads:  inbox state mirrored from Gmail (archived / starred / trash / labels),
--                   a short snippet + who wrote last (so the list needs no message bodies),
--                   bulk mail flag (newsletters → "Other"), attachments flag, snooze.
-- messages:         Gmail labels, snippet, the RFC Message-ID (replies stay in the thread),
--                   cc list, bulk flag.

ALTER TABLE public.message_channels
  ADD COLUMN IF NOT EXISTS gmail_history_id text,
  ADD COLUMN IF NOT EXISTS last_error       text,
  ADD COLUMN IF NOT EXISTS last_error_at    timestamptz;

ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS snippet          text,
  ADD COLUMN IF NOT EXISTS last_direction   text,          -- inbound | outbound
  ADD COLUMN IF NOT EXISTS last_from_name   text,
  ADD COLUMN IF NOT EXISTS last_from_address text,
  ADD COLUMN IF NOT EXISTS message_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labels           text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_archived      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_starred       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trashed       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bulk          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_attachments  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snoozed_until    timestamptz;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS labels          text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS snippet         text,
  ADD COLUMN IF NOT EXISTS rfc_message_id  text,
  ADD COLUMN IF NOT EXISTS cc_addresses    jsonb  NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_bulk         boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_message_threads_user_last
  ON public.message_threads (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_threads_ext
  ON public.message_threads (channel_id, external_thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_ext
  ON public.messages (channel_id, external_message_id);




-- ── One row per Gmail message / thread (the live sync and the Refresh button can run
--    at the same moment; these keep them from storing the same email twice). ──────
-- 1) Merge duplicate threads (same Gmail thread stored twice) into the oldest one,
--    keeping any record link the duplicate had.
WITH d AS (
  SELECT id, first_value(id) OVER (PARTITION BY channel_id, external_thread_id ORDER BY created_at, id) AS keep
  FROM public.message_threads
  WHERE external_thread_id IS NOT NULL AND channel_id IS NOT NULL
), dup AS (SELECT * FROM d WHERE id <> keep)
UPDATE public.message_threads k SET
  linked_type            = COALESCE(k.linked_type, t.linked_type),
  linked_id              = COALESCE(k.linked_id, t.linked_id),
  linked_label           = COALESCE(k.linked_label, t.linked_label),
  linked_opportunity_id  = COALESCE(k.linked_opportunity_id, t.linked_opportunity_id),
  linked_customer_org_id = COALESCE(k.linked_customer_org_id, t.linked_customer_org_id),
  linked_wo_id           = COALESCE(k.linked_wo_id, t.linked_wo_id),
  linked_site_id         = COALESCE(k.linked_site_id, t.linked_site_id)
FROM dup JOIN public.message_threads t ON t.id = dup.id
WHERE k.id = dup.keep;

WITH d AS (
  SELECT id, first_value(id) OVER (PARTITION BY channel_id, external_thread_id ORDER BY created_at, id) AS keep
  FROM public.message_threads
  WHERE external_thread_id IS NOT NULL AND channel_id IS NOT NULL
)
UPDATE public.messages m SET thread_id = d.keep FROM d WHERE m.thread_id = d.id AND d.id <> d.keep;

WITH d AS (
  SELECT id, first_value(id) OVER (PARTITION BY channel_id, external_thread_id ORDER BY created_at, id) AS keep
  FROM public.message_threads
  WHERE external_thread_id IS NOT NULL AND channel_id IS NOT NULL
)
DELETE FROM public.message_threads t USING d WHERE t.id = d.id AND d.id <> d.keep;

-- 2) Drop duplicate copies of the same Gmail message (keep the first one stored).
WITH d AS (
  SELECT id, row_number() OVER (PARTITION BY channel_id, external_message_id ORDER BY created_at, id) AS rn
  FROM public.messages
  WHERE external_message_id IS NOT NULL AND channel_id IS NOT NULL
)
DELETE FROM public.messages m USING d WHERE m.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_message_threads_channel_ext
  ON public.message_threads (channel_id, external_thread_id) WHERE external_thread_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_channel_ext
  ON public.messages (channel_id, external_message_id) WHERE external_message_id IS NOT NULL;

-- 3) Start every Gmail mailbox over with a full sync so read / archived / starred match Gmail.
UPDATE public.message_channels SET gmail_history_id = NULL WHERE channel_type = 'gmail';
