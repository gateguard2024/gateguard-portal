-- Migration 142: record the real API cost (COGS / money-out) of each ARIA search.
-- cost_cents   = actual $ spent on that search (Serper + Tavily + Anthropic + Apollo).
-- cost_points  = cents * 2   ($1 = 200 credits, so 1 cent = 2 credits/points).
-- cost_breakdown = per-provider detail (calls, tokens, cents) for auditing.
-- Feeds the corporate money-in / money-out reporting later; the front end shows points.
ALTER TABLE public.aria_search_runs ADD COLUMN IF NOT EXISTS cost_cents      numeric(10,2);
ALTER TABLE public.aria_search_runs ADD COLUMN IF NOT EXISTS cost_points     integer;
ALTER TABLE public.aria_search_runs ADD COLUMN IF NOT EXISTS cost_breakdown  jsonb;
