-- ─────────────────────────────────────────────────────────────────────────────
-- 004_kb_vectors.sql
-- GateGuard Dealer Portal — Knowledge Base Vector Layer
--
-- Adds semantic search + AI troubleshooting on top of the existing
-- products table (003_products.sql).
--
-- Prerequisites:
--   1. Enable pgvector in Supabase Dashboard → Database → Extensions → vector
--   2. Run 003_products.sql first
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Add manual fields to products ─────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS manual_url       text,
  ADD COLUMN IF NOT EXISTS manual_path      text,     -- Supabase Storage path
  ADD COLUMN IF NOT EXISTS install_time_hrs numeric(4,1),
  ADD COLUMN IF NOT EXISTS tags             text[];

-- ── manual_chunks ─────────────────────────────────────────────────────────────
-- Each row is one ~400-token passage from a product manual PDF,
-- with its OpenAI text-embedding-3-small vector (1536 dims).
CREATE TABLE IF NOT EXISTS public.manual_chunks (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid         NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  manual_url     text,
  page_number    int,
  section_title  text,
  chunk_index    int          NOT NULL,
  content        text         NOT NULL,
  embedding      vector(1536),
  token_count    int,
  processed_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_chunks_product_idx   ON public.manual_chunks (product_id);

-- IVFFlat index for fast cosine similarity search
-- Rebuild after bulk inserts: REINDEX INDEX manual_chunks_embedding_idx
CREATE INDEX IF NOT EXISTS manual_chunks_embedding_idx
  ON public.manual_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── troubleshoot_sessions ─────────────────────────────────────────────────────
-- Logs every dealer diagnostic session for analytics + improving the AI.
CREATE TABLE IF NOT EXISTS public.troubleshoot_sessions (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid         REFERENCES public.products(id) ON DELETE SET NULL,
  user_id         text,
  symptom         text         NOT NULL,
  error_code      text,
  steps_taken     jsonb        NOT NULL DEFAULT '[]'::jsonb,
  chunks_used     uuid[]       NOT NULL DEFAULT '{}',
  resolved        boolean,
  resolution_note text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS troubleshoot_sessions_product_idx  ON public.troubleshoot_sessions (product_id);
CREATE INDEX IF NOT EXISTS troubleshoot_sessions_created_idx  ON public.troubleshoot_sessions (created_at DESC);

DROP TRIGGER IF EXISTS troubleshoot_sessions_updated_at ON public.troubleshoot_sessions;
CREATE TRIGGER troubleshoot_sessions_updated_at
  BEFORE UPDATE ON public.troubleshoot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── kb_articles ───────────────────────────────────────────────────────────────
-- Hand-authored troubleshooting articles (supplement to AI search).
-- Also embedded for semantic search.
CREATE TABLE IF NOT EXISTS public.kb_articles (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid         REFERENCES public.products(id) ON DELETE SET NULL,
  category       text         NOT NULL,
  title          text         NOT NULL,
  description    text,
  content        text,
  difficulty     text         NOT NULL DEFAULT 'Basic'
                              CHECK (difficulty IN ('Basic','Intermediate','Advanced','Installation')),
  helpful_count  int          NOT NULL DEFAULT 0,
  author         text,
  embedding      vector(1536),
  active         boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_articles_category_idx ON public.kb_articles (category);
CREATE INDEX IF NOT EXISTS kb_articles_product_idx  ON public.kb_articles (product_id);
CREATE INDEX IF NOT EXISTS kb_articles_embedding_idx
  ON public.kb_articles
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

DROP TRIGGER IF EXISTS kb_articles_updated_at ON public.kb_articles;
CREATE TRIGGER kb_articles_updated_at
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RPC: match_knowledge ──────────────────────────────────────────────────────
-- Unified semantic search across both manual chunks AND kb articles.
-- Called by the AI diagnostic API with the user's symptom embedding.
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.42,
  match_count      int     DEFAULT 8,
  filter_product   uuid    DEFAULT NULL
)
RETURNS TABLE (
  source         text,     -- 'manual' or 'article'
  id             uuid,
  product_id     uuid,
  product_name   text,
  product_sku    text,
  manual_url     text,
  page_number    int,
  section_title  text,
  content        text,
  similarity     float
)
LANGUAGE sql STABLE AS $$
  -- Manual chunks
  SELECT
    'manual'                                         AS source,
    mc.id,
    mc.product_id,
    p.name                                           AS product_name,
    p.sku                                            AS product_sku,
    mc.manual_url,
    mc.page_number,
    mc.section_title,
    mc.content,
    1 - (mc.embedding <=> query_embedding)           AS similarity
  FROM   public.manual_chunks mc
  JOIN   public.products p ON p.id = mc.product_id
  WHERE  mc.embedding IS NOT NULL
    AND  (filter_product IS NULL OR mc.product_id = filter_product)
    AND  1 - (mc.embedding <=> query_embedding) > match_threshold

  UNION ALL

  -- KB articles
  SELECT
    'article'                                        AS source,
    ka.id,
    ka.product_id,
    COALESCE(p2.name, '')                            AS product_name,
    COALESCE(p2.sku, '')                             AS product_sku,
    NULL                                             AS manual_url,
    NULL                                             AS page_number,
    ka.category                                      AS section_title,
    COALESCE(ka.content, ka.description, '')         AS content,
    1 - (ka.embedding <=> query_embedding)           AS similarity
  FROM   public.kb_articles ka
  LEFT   JOIN public.products p2 ON p2.id = ka.product_id
  WHERE  ka.embedding IS NOT NULL
    AND  ka.active = TRUE
    AND  (filter_product IS NULL OR ka.product_id = filter_product)
    AND  1 - (ka.embedding <=> query_embedding) > match_threshold

  ORDER  BY similarity DESC
  LIMIT  match_count;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.manual_chunks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troubleshoot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read manual_chunks"
  ON public.manual_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read kb_articles"
  ON public.kb_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own troubleshoot sessions"
  ON public.troubleshoot_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
