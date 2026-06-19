-- Migration 125: manual figures (images extracted from product manuals) so a
-- diagnostic step can SHOW the diagram/part, not just cite a page.
-- Populated by scripts/extract_manual_figures.py at manual-ingest time.

CREATE TABLE IF NOT EXISTS public.manual_figures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID REFERENCES public.products(id) ON DELETE CASCADE,
  manual_url    TEXT,
  page_number   INT,
  section_title TEXT,
  figure_type   TEXT,          -- 'wiring' | 'dimension' | 'photo' | 'table' | 'other'
  caption       TEXT,
  bbox          JSONB,         -- {x1,y1,x2,y2} normalized 0–1 on the page
  image_url     TEXT NOT NULL, -- cropped figure (or full page) in Supabase Storage
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.manual_figures TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS manual_figures_product_idx ON public.manual_figures (product_id);
CREATE INDEX IF NOT EXISTS manual_figures_page_idx    ON public.manual_figures (product_id, page_number);

-- Each text chunk can point at its rendered source page image
ALTER TABLE public.manual_chunks ADD COLUMN IF NOT EXISTS page_image_url TEXT;
