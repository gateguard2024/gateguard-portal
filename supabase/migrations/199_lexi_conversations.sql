-- Migration 199: Lexi (Nexus AI assistant) — saved conversations.
-- One conversation per chat thread, owned by one Clerk user. Lexi reads and
-- writes these through the service role only (API routes check the owner).
-- Run on beta first, then prod.

CREATE TABLE IF NOT EXISTS public.lexi_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,              -- Clerk user id (owner)
  org_id      uuid,                       -- owner's company at the time (null = corporate)
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lexi_conversations TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS lexi_conversations_user_idx ON public.lexi_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.lexi_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.lexi_conversations(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL DEFAULT '',
  cards            jsonb,                 -- result cards / actions shown with the reply
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lexi_messages TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS lexi_messages_conv_idx ON public.lexi_messages (conversation_id, created_at);

-- Private by default: RLS on, only the service role (our API routes) may touch rows.
ALTER TABLE public.lexi_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexi_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lexi_conversations_service ON public.lexi_conversations;
CREATE POLICY lexi_conversations_service ON public.lexi_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lexi_messages_service ON public.lexi_messages;
CREATE POLICY lexi_messages_service ON public.lexi_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
