-- ============================================================
-- Migration 197 — Deal page: quotes ⇄ deals ⇄ activities (Part 1 · Dealer)
-- Run on BETA first, verify, then prod. Safe to run more than once.
--
--   quotes.view_count / first_viewed_at / last_viewed_at
--       counted when the customer opens the public proposal (deal timeline "viewed 3 times")
--   invoices.opportunity_id
--       so a deposit invoice shows on its deal (was only carried in the "new invoice" URL)
--   crm_activities.quote_id
--       quote events (created / sent / viewed / accepted / declined) land on the deal timeline
--   opportunities.values_locked
--       false = deal MRR / install fee follow the primary quote (opportunities.quote_id);
--       true  = someone typed their own values, so we show "differs from quote" instead of overwriting
--   opportunities.quote_synced_at
--       last time deal values were copied from the primary quote
--
-- No new tables, so no GRANT block is needed.
-- ============================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS view_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at  timestamptz;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;

ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS values_locked   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_synced_at timestamptz;

-- Primary quote for deals that don't have one yet: their newest non-declined quote.
UPDATE public.opportunities o
   SET quote_id = (
     SELECT q.id FROM public.quotes q
      WHERE q.opportunity_id = o.id AND q.status::text <> 'declined'
      ORDER BY (q.status::text = 'accepted') DESC, q.created_at DESC
      LIMIT 1)
 WHERE o.quote_id IS NULL
   AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.opportunity_id = o.id AND q.status::text <> 'declined');

CREATE INDEX IF NOT EXISTS idx_invoices_opportunity       ON public.invoices (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_quote       ON public.crm_activities (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_opportunity         ON public.quotes (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_threads_linked_opp2 ON public.message_threads (linked_opportunity_id) WHERE linked_opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_linked_opportunity   ON public.todos (linked_id) WHERE linked_type = 'opportunity';
