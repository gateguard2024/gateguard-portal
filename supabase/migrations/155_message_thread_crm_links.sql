-- Migration 155: Link email threads to CRM records (opportunities + customer orgs)
--
-- Adds opportunity/customer link columns to message_threads so synced Gmail
-- conversations can be attached to an opportunity or a customer organization —
-- either automatically (participant email matched against CRM contact emails)
-- or manually from the new Emails tab. link_source records which one it was so
-- the auto-matcher never overwrites a human decision.
--
-- Idempotent. Run beta → prod. Grants for message_threads already exist (115).

ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS linked_opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_customer_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_source text; -- 'auto' | 'manual' | null (never linked)

CREATE INDEX IF NOT EXISTS idx_message_threads_linked_opp
  ON public.message_threads (linked_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_linked_customer
  ON public.message_threads (linked_customer_org_id);
