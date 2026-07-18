-- Migration 158: Dealer margins on catalog service lines
--
-- Dealers may add margin ON TOP of corporate pricing — percent or fixed $ per
-- line. Markup only: margin_value >= 0, so a dealer can never sell below the
-- corporate price; the corporate floor/target bands (157) stay intact underneath.
-- One row per (org, service line). CPQ reads: dealer_price = corporate price
-- + margin. Run beta → prod.

CREATE TABLE IF NOT EXISTS public.dealer_service_margins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id   uuid NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  margin_type  text NOT NULL DEFAULT 'percent' CHECK (margin_type IN ('percent','fixed')),
  margin_value numeric NOT NULL DEFAULT 0 CHECK (margin_value >= 0),  -- markup only, never below corporate
  updated_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, service_id)
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.dealer_service_margins TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_dealer_service_margins_org ON public.dealer_service_margins (org_id);
