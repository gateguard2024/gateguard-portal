/**
 * GET  /api/aria/properties — paginated list of all discovered properties
 * ?limit=50&offset=0&stage=prospect&urgency=high&expiry_before=2027&search=greystar
 * POST /api/aria/properties — internal upsert called by the deep research route
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { upsertAriaProperties } from '@/lib/aria-upsert'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    await getCurrentUser()
    const { searchParams } = new URL(req.url)

    const limit         = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
    const offset        = parseInt(searchParams.get('offset') ?? '0')
    const stage         = searchParams.get('stage')           // 'prospect','contacted',etc
    const urgency       = searchParams.get('urgency')         // 'critical','high','medium','low'
    const expiryBefore  = searchParams.get('expiry_before')   // year e.g. '2027'
    const expiryAfter   = searchParams.get('expiry_after')
    const search        = searchParams.get('search')          // free text (name/mgmt/address)
    const sara          = searchParams.get('sara') === 'true'
    const orderBy       = searchParams.get('order_by') ?? 'last_researched_at'
    const dir           = searchParams.get('dir') === 'asc'

    let query = supabase
      .from('aria_properties')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending: dir })
      .range(offset, offset + limit - 1)

    if (stage)        query = query.eq('sales_stage', stage)
    if (urgency)      query = query.eq('urgency', urgency)
    if (sara)         query = query.eq('sara_signals', true)
    if (expiryBefore) query = query.lte('contract_expiry_year', parseInt(expiryBefore))
    if (expiryAfter)  query = query.gte('contract_expiry_year', parseInt(expiryAfter))
    if (search) {
      query = query.or(
        `property_name.ilike.%${search}%,management_company.ilike.%${search}%,address.ilike.%${search}%,owner_entity.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ properties: [], total: 0 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ properties: data ?? [], total: count ?? 0 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── Internal upsert — thin wrapper over the shared lib ───────────────────────
// The write logic lives in lib/aria-upsert.ts so the deep research route can
// call it DIRECTLY instead of fetching this endpoint over HTTP (that self-call
// resolved to localhost:3000 on Vercel and silently saved nothing).
export async function POST(req: NextRequest) {
  try {
    // Auth: accept either a valid Clerk session OR the internal service key
    const serviceKey = req.headers.get('x-service-key')
    const validServiceKey = process.env.ARIA_SERVICE_KEY
    if (!serviceKey || !validServiceKey || serviceKey !== validServiceKey) {
      // Fall back to Clerk auth for portal calls
      try { await getCurrentUser() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const prospects: any[] = body.prospects ?? []

    if (!prospects.length) return NextResponse.json({ upserted: 0 })

    const { upserted, errors: writeErrors, tech_providers_seen } = await upsertAriaProperties(prospects)

    // Report failures loudly. A 200 with { upserted: 0 } is how this silently
    // lost every property for months — never let that happen quietly again.
    if (writeErrors.length && upserted === 0) {
      return NextResponse.json(
        { upserted: 0, errors: writeErrors, error: `Nothing saved: ${writeErrors[0]}` },
        { status: 500 }
      )
    }
    return NextResponse.json({
      upserted,
      tech_providers_seen,
      ...(writeErrors.length ? { errors: writeErrors } : {}),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
