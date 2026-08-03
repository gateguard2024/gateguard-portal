/**
 * lib/aria-save-cap.ts — ARIA per-dealer monthly save cap (G5).
 *
 * Corporate can limit how many NEW properties a dealer org saves to the Intel DB
 * per calendar month. A "save" = a new `aria_properties` row stamped with the
 * org's id this month (the learning-loop upsert reuses existing rows, so a
 * re-save of a known property does NOT count). NULL/absent cap = unlimited.
 */
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function monthStartISO(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

export type SaveCapStatus = {
  limit: number | null   // null = unlimited
  used: number           // new saves this month
  remaining: number | null
  allowed: boolean       // room for at least one more
}

/** Current month's save-cap status for an org. Corporate/no-org = unlimited. */
export async function getSaveCapStatus(orgId: string | null | undefined): Promise<SaveCapStatus> {
  if (!orgId) return { limit: null, used: 0, remaining: null, allowed: true }
  const supa = db()

  const { data: capRow } = await supa
    .from('aria_dealer_save_caps')
    .select('monthly_limit')
    .eq('org_id', orgId)
    .maybeSingle()
  const limit = capRow?.monthly_limit ?? null
  if (limit == null) return { limit: null, used: 0, remaining: null, allowed: true }

  const { count } = await supa
    .from('aria_properties')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', monthStartISO())
  const used = count ?? 0
  const remaining = Math.max(0, limit - used)
  return { limit, used, remaining, allowed: remaining > 0 }
}
