-- Migration 187: dealer proposal review gate (Sep 2026)
-- A dealer-created proposal must be reviewed + approved by GateGuard corporate
-- before it can be sent to the client. These columns track that workflow.
--   review_status: null / 'draft' / 'pending' / 'approved' / 'changes_requested'
--     null            → legacy / not gated (existing sent proposals keep working)
--     draft           → dealer is still editing; not client-visible
--     pending         → submitted, awaiting corporate review; not client-visible
--     changes_requested → corporate sent it back; not client-visible
--     approved        → cleared to send; client link + PDF unlocked
-- ALTER TABLE needs no GRANT (existing permissions unchanged).

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS review_status        TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS review_submitted_at  TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS reviewed_by          TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS reviewed_at          TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS review_note          TEXT;
