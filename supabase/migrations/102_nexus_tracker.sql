-- Migration 102: Nexus Tracker
-- Fluid canvas bug & enhancement tracker built into Nexus.
-- Replaces Monday.com for internal ops — groups → cards → drawer → AI triage.
-- Feature-gated via nexus.tracker in feature_catalog.

-- ─── tracker_groups ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracker_groups (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  color      TEXT    NOT NULL DEFAULT '#6B7EFF',
  position   INTEGER NOT NULL DEFAULT 0,
  org_id     UUID    REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.tracker_groups TO postgres, anon, authenticated, service_role;

-- ─── tracker_items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracker_items (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID    NOT NULL REFERENCES public.tracker_groups(id) ON DELETE CASCADE,
  title            TEXT    NOT NULL,
  type             TEXT    NOT NULL DEFAULT 'bug'
    CHECK (type IN ('bug','enhancement','question','task')),
  module           TEXT,
  severity         TEXT
    CHECK (severity IN ('1_info','2_minor','3_moderate','4_major','5_critical')),
  priority         TEXT
    CHECK (priority IN ('low','medium','high','critical')),
  status           TEXT    NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_progress','done','blocked','on_hold')),
  owner_user_id    TEXT,
  owner_name       TEXT,
  reporter_user_id TEXT,
  reporter_name    TEXT,
  date_reported    DATE    DEFAULT CURRENT_DATE,
  target_release   TEXT,
  affected_site_id UUID    REFERENCES public.sites(id) ON DELETE SET NULL,
  notes            TEXT,
  position         INTEGER NOT NULL DEFAULT 0,
  parent_item_id   UUID    REFERENCES public.tracker_items(id) ON DELETE CASCADE,
  org_id           UUID    REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.tracker_items TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_tracker_items_group ON public.tracker_items(group_id);
CREATE INDEX IF NOT EXISTS idx_tracker_items_status ON public.tracker_items(status);
CREATE INDEX IF NOT EXISTS idx_tracker_items_org ON public.tracker_items(org_id);

-- ─── tracker_comments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracker_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES public.tracker_items(id) ON DELETE CASCADE,
  author_user_id  TEXT,
  author_name     TEXT NOT NULL,
  author_initials TEXT NOT NULL DEFAULT '?',
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.tracker_comments TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_tracker_comments_item ON public.tracker_comments(item_id);

-- ─── feature_catalog: nexus.tracker ─────────────────────────────────────────
-- tier_defaults: corporate + master_dealer + full_dealer can use tracker in edit mode.
-- All other tiers default none. Org admin can override per-org. User admin can override per-user.
INSERT INTO public.feature_catalog (
  key,
  label,
  section,
  section_label,
  href,
  description,
  sort_order,
  is_beta,
  tier_defaults
)
VALUES (
  'nexus.tracker',
  'Nexus Tracker',
  'nexus',
  'Nexus',
  '/tracker',
  'Fluid canvas bug & enhancement tracker. Replaces Monday.com. Groups → cards → AI triage → L10 integration. Feature-gated per org and per user.',
  10,
  true,
  '{"corporate":"edit","master_dealer":"edit","full_dealer":"edit","master_agent":"none","service_dealer":"none","install_contractor":"none","sales_partner":"none","client":"none"}'::jsonb
)
ON CONFLICT (key) DO UPDATE
  SET label         = EXCLUDED.label,
      description   = EXCLUDED.description,
      tier_defaults = EXCLUDED.tier_defaults,
      is_beta       = EXCLUDED.is_beta,
      updated_at    = now();
