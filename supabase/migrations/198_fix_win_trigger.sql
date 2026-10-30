-- ============================================================
-- Migration 198 — Fix "relation customers does not exist" when a deal is won
-- Run on BETA first, then prod. Safe to run more than once.
--
-- Migration 002 added trigger trg_opp_won → create_customer_on_win(), which inserts
-- into public.customers whenever a deal moves to "won". Migration 134 dropped the
-- customers table (customers became organizations + site lifecycle) but left the
-- trigger behind — so EVERY "Mark won" has failed since then.
--
-- Won deals are now handed off through the job (work_orders) + provisioning kickoff,
-- so the customers insert is removed. The function keeps its other job: stamping
-- won_at / lost_at when the stage changes.
-- No new tables, so no GRANT block is needed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_customer_on_win()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage = 'won' AND OLD.stage IS DISTINCT FROM 'won' THEN
    NEW.won_at := COALESCE(NEW.won_at, now());
  END IF;
  IF NEW.stage = 'lost' AND OLD.stage IS DISTINCT FROM 'lost' THEN
    NEW.lost_at := COALESCE(NEW.lost_at, now());
  END IF;
  RETURN NEW;
END;
$$;
