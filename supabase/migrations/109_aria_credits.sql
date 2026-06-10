-- Migration 109: ARIA v9 — Credit System
--
-- Tables:
--   credit_balances     — one row per org, tracks available + reserved credits
--   credit_transactions — full audit ledger (purchases, spends, grants, trials, demos)
--   credit_packages     — product catalog for Stripe Checkout (4 tiers)
--
-- Key RPCs:
--   spend_aria_credits()  — atomic row-level lock prevents double-spend
--   grant_aria_credits()  — handles purchase/bonus/trial/demo/plan_included grants
--
-- Per-search cost: 100 credits
-- Pricing tiers:
--   Starter    500 credits / $5.00   → $1.00/search
--   Standard  2000 credits / $19.00  → $0.95/search
--   Pro       5000 credits / $45.00  → $0.90/search
--   Enterprise 10000 credits / $85.00 → $0.85/search
--
-- Demo/trial credits:
--   Corporate users can grant time-limited trial or demo credits to any org.
--   credits_transactions.expires_at + granted_by tracks all grants.
--   grant_aria_credits() with transaction_type = 'trial' | 'demo' | 'plan_included'

-- ─── Defensive cleanup ────────────────────────────────────────────────────────
-- If credit_transactions was created in a prior partial run with a different schema
-- (e.g. missing transaction_type), drop it so CREATE TABLE IF NOT EXISTS re-runs correctly.
-- Safe on beta — no production data in this table yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credit_transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'credit_transactions'
      AND column_name = 'transaction_type'
  ) THEN
    DROP TABLE public.credit_transactions CASCADE;
    RAISE NOTICE 'Dropped credit_transactions (missing transaction_type column) — will recreate below.';
  END IF;
END;
$$;

-- ─── credit_balances ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_balances (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT        NOT NULL UNIQUE,
  balance         INT         NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved        INT         NOT NULL DEFAULT 0 CHECK (reserved >= 0),  -- pre-reserved for in-flight searches
  lifetime_spent  INT         NOT NULL DEFAULT 0,
  lifetime_earned INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.credit_balances TO postgres, anon, authenticated, service_role;

-- ─── credit_transactions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT        NOT NULL,
  user_id          TEXT,       -- user who triggered the transaction (null for org-level purchases)
  transaction_type TEXT        NOT NULL CHECK (transaction_type IN (
    'purchase',        -- credits bought via Stripe Checkout
    'spend',           -- credits consumed by an ARIA search
    'bonus',           -- manual bonus (no expiry, from Russel/admin)
    'trial',           -- new user / new dealer welcome credits (with expiry)
    'demo',            -- credits granted for a specific demo call / POC
    'plan_included',   -- credits bundled with a software plan tier
    'refund',          -- Stripe refund — credits reversed
    'adjustment'       -- manual correction
  )),
  amount           INT         NOT NULL,  -- positive = credit, negative = debit
  balance_after    INT         NOT NULL,  -- snapshot of balance after this transaction
  -- Purchase / Stripe
  stripe_payment_intent_id TEXT,
  stripe_session_id         TEXT,
  credit_package_id         UUID,         -- FK to credit_packages
  price_paid_cents          INT,          -- actual amount paid (0 for trial/bonus/demo)
  -- Grant metadata (for trial / demo / plan_included / bonus)
  granted_by       TEXT,       -- user_id of the GateGuard corporate user who issued the grant
  granted_by_name  TEXT,       -- denormalized display name
  note             TEXT,       -- human-readable reason ("Demo call with Elm Creek Apts", "Q2 bonus")
  -- Expiry (only relevant for trial / demo credits)
  expires_at       TIMESTAMPTZ,          -- null = never expires
  -- Audit
  search_run_id    UUID        REFERENCES public.aria_search_runs(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.credit_transactions TO postgres, anon, authenticated, service_role;

-- ─── credit_packages ─────────────────────────────────────────────────────────
-- Product catalog — seeded below. stripe_price_id populated after Stripe config.
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT    NOT NULL UNIQUE,
  credits           INT     NOT NULL,           -- credits granted on purchase
  price_cents       INT     NOT NULL,           -- USD cents (e.g. 500 = $5.00)
  price_per_search  NUMERIC(5,2),               -- computed: price_cents / (credits/100)
  stripe_price_id   TEXT,                       -- e.g. price_XXXXXXXXXXXXX
  badge             TEXT,                       -- UI badge: "Most Popular", "Best Value", etc.
  description       TEXT,                       -- e.g. "5 deep searches"
  sort_order        INT     NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.credit_packages TO postgres, anon, authenticated, service_role;

-- ─── Seed credit packages ─────────────────────────────────────────────────────
INSERT INTO public.credit_packages (name, credits, price_cents, price_per_search, stripe_price_id, badge, description, sort_order)
VALUES
  ('Starter',    500,   500,  1.00, NULL, NULL,           '5 deep searches',   1),
  ('Standard',  2000,  1900,  0.95, NULL, 'Most Popular', '20 deep searches',  2),
  ('Pro',       5000,  4500,  0.90, NULL, NULL,           '50 deep searches',  3),
  ('Enterprise',10000, 8500,  0.85, NULL, 'Best Value',   '100 deep searches', 4)
ON CONFLICT (name) DO UPDATE SET
  credits           = EXCLUDED.credits,
  price_cents       = EXCLUDED.price_cents,
  price_per_search  = EXCLUDED.price_per_search,
  badge             = EXCLUDED.badge,
  description       = EXCLUDED.description,
  sort_order        = EXCLUDED.sort_order;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_credit_transactions_org        ON public.credit_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user       ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type       ON public.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created    ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_expires    ON public.credit_transactions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_pi  ON public.credit_transactions(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ─── spend_aria_credits() RPC ─────────────────────────────────────────────────
-- Atomically deduct credits from an org's balance.
-- Uses SELECT ... FOR UPDATE to prevent race conditions on concurrent searches.
-- Returns:
--   { success: true, balance_after: N }  — deduction succeeded
--   { success: false, reason: '...' }    — insufficient credits or org not found
--
-- The caller MUST check success before proceeding with the search.
-- If success=false, return HTTP 402 to the client.
CREATE OR REPLACE FUNCTION public.spend_aria_credits(
  p_org_id       TEXT,
  p_user_id      TEXT,
  p_amount       INT,
  p_search_run_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance      INT;
  v_balance_after INT;
BEGIN
  -- Row-level lock: prevents concurrent spends from double-counting
  SELECT balance INTO v_balance
  FROM public.credit_balances
  WHERE org_id = p_org_id
  FOR UPDATE;

  -- Org has no balance row yet — treat as zero
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_balance_record', 'balance', 0);
  END IF;

  -- Expire any time-limited credits that have passed their expiry
  -- (This is a soft-expire: balance is already counted at grant time,
  --  so we simply verify sufficient balance. Hard expiry via cron is a future TODO.)

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_credits', 'balance', v_balance);
  END IF;

  v_balance_after := v_balance - p_amount;

  -- Deduct balance
  UPDATE public.credit_balances
  SET
    balance        = v_balance_after,
    lifetime_spent = lifetime_spent + p_amount,
    updated_at     = now()
  WHERE org_id = p_org_id;

  -- Record transaction
  INSERT INTO public.credit_transactions (
    org_id, user_id, transaction_type, amount, balance_after, search_run_id
  ) VALUES (
    p_org_id, p_user_id, 'spend', -p_amount, v_balance_after, p_search_run_id
  );

  RETURN jsonb_build_object('success', true, 'balance_after', v_balance_after);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_aria_credits(TEXT, TEXT, INT, UUID)
  TO postgres, anon, authenticated, service_role;

-- ─── grant_aria_credits() RPC ─────────────────────────────────────────────────
-- Grants credits to an org from any source (purchase, bonus, trial, demo, plan).
-- Creates the credit_balances row if it doesn't exist yet (upsert).
-- Returns:
--   { success: true, balance_after: N }
--
-- p_transaction_type: 'purchase' | 'bonus' | 'trial' | 'demo' | 'plan_included' | 'adjustment'
-- p_expires_at:       TIMESTAMPTZ or NULL (null = credits never expire)
-- p_granted_by:       user_id of the corporate user issuing the grant (null for Stripe purchases)
CREATE OR REPLACE FUNCTION public.grant_aria_credits(
  p_org_id           TEXT,
  p_user_id          TEXT,
  p_amount           INT,
  p_transaction_type TEXT DEFAULT 'bonus',
  p_note             TEXT DEFAULT NULL,
  p_granted_by       TEXT DEFAULT NULL,
  p_granted_by_name  TEXT DEFAULT NULL,
  p_expires_at       TIMESTAMPTZ DEFAULT NULL,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_credit_package_id UUID DEFAULT NULL,
  p_price_paid_cents  INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_after INT;
BEGIN
  -- Upsert credit_balances row — creates it if this org has never had credits
  INSERT INTO public.credit_balances (org_id, balance, lifetime_earned)
  VALUES (p_org_id, p_amount, p_amount)
  ON CONFLICT (org_id) DO UPDATE SET
    balance        = credit_balances.balance + p_amount,
    lifetime_earned = credit_balances.lifetime_earned + p_amount,
    updated_at     = now()
  RETURNING balance INTO v_balance_after;

  -- Record transaction
  INSERT INTO public.credit_transactions (
    org_id,
    user_id,
    transaction_type,
    amount,
    balance_after,
    note,
    granted_by,
    granted_by_name,
    expires_at,
    stripe_session_id,
    credit_package_id,
    price_paid_cents
  ) VALUES (
    p_org_id,
    p_user_id,
    p_transaction_type,
    p_amount,
    v_balance_after,
    p_note,
    p_granted_by,
    p_granted_by_name,
    p_expires_at,
    p_stripe_session_id,
    p_credit_package_id,
    p_price_paid_cents
  );

  RETURN jsonb_build_object('success', true, 'balance_after', v_balance_after);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_aria_credits(TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, UUID, INT)
  TO postgres, anon, authenticated, service_role;

-- ─── Auto-grant 200 trial credits on new dealer onboarding ───────────────────
-- NOTE: This is informational — the actual grant call happens in the
-- onboard-dealer API route, which calls grant_aria_credits() with type='trial'
-- and expires_at = now() + interval '30 days' after org creation.
-- No trigger here to keep things explicit and auditable.
COMMENT ON FUNCTION public.grant_aria_credits IS
'Grant credits to an org. For new dealer onboarding, call with type=''trial'', amount=200, expires_at=now()+30days. For demo calls, type=''demo''. For purchased credits, type=''purchase'' with stripe_session_id.';
