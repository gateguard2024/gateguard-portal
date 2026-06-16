-- Migration 117: let an email thread be assigned to any CRM record
-- (lead / contact / customer / opportunity / job). message_threads already has
-- specific linked_wo_id/linked_quote_id/linked_site_id; this adds a generic link.
ALTER TABLE public.message_threads ADD COLUMN IF NOT EXISTS linked_type  text;   -- lead | contact | customer | opportunity | job
ALTER TABLE public.message_threads ADD COLUMN IF NOT EXISTS linked_id    uuid;
ALTER TABLE public.message_threads ADD COLUMN IF NOT EXISTS linked_label text;   -- display name, so the UI needn't re-fetch
CREATE INDEX IF NOT EXISTS idx_message_threads_linked ON public.message_threads (linked_type, linked_id);
