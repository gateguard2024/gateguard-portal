/**
 * GET/PATCH /api/aria/save-caps  — CORPORATE-ONLY (G5)
 *
 * View and set each dealer org's monthly ARIA save cap. A "save" = a new
 * aria_properties row stamped with that org this calendar month. NULL = unlimited.
 *
 * GET   → { orgs: [{ org_id, name, org_tier, monthly_limit, used, remaining }] }
 * PATCH → body { org_id, monthly_limit }  (monthly_limit null/'' = unlimited)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function monthStartISO(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only' }, { status: 403 })

  // All non-corporate orgs (the ones that can be capped).
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, org_tier')
    .neq('org_tier', 'corporate')
    .order('name')
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 })

  const [{ data: caps }, { data: savedThisMonth }] = await Promise.all([
    supabase.from('aria_dealer_save_caps').select('org_id, monthly_limit'),
    supabase.from('aria_properties').select('org_id').gte('created_at', monthStartISO()),
  ])

  const capMap = new Map<string, number | null>()
  for (const c of caps ?? []) capMap.set(c.org_id, c.monthly_limit)
  const usedMap = new Map<string, number>()
  for (const r of savedThisMonth ?? []) {
    if (!r.org_id) continue
    usedMap.set(r.org_id, (usedMap.get(r.org_id) ?? 0) + 1)
  }

  const rows = (orgs ?? []).map((o) => {
    const monthly_limit = capMap.has(o.id) ? capMap.get(o.id)! : null
    const used = usedMap.get(o.id) ?? 0
    return {
      org_id: o.id,
      name: o.name,
      org_tier: o.org_tier,
      monthly_limit,
      used,
      remaining: monthly_limit == null ? null : Math.max(0, monthly_limit - used),
    }
  })
  return NextResponse.json({ orgs: rows })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Corporate only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const org_id: string | undefined = body.org_id
  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const raw = body.monthly_limit
  let monthly_limit: number | null = null
  if (raw !== null && raw !== '' && raw !== undefined) {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'monthly_limit must be a non-negative number or blank' }, { status: 400 })
    }
    monthly_limit = Math.floor(n)
  }

  const { error } = await supabase
    .from('aria_dealer_save_caps')
    .upsert({
      org_id,
      monthly_limit,
      note: typeof body.note === 'string' ? body.note : null,
      updated_by: user.email || user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, org_id, monthly_limit })
}
