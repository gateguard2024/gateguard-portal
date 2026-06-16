/**
 * GET  /api/labor-rates   → global defaults + the caller's org rates
 * POST /api/labor-rates   → dealer adds a rate for their instance only
 *
 * Mirrors the dealer catalog layer: org_id NULL = global default (corporate),
 * org_id set = private to that dealer's org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, getProfileId } from '@/lib/org-scope'

export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function GET() {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  let query = supabase
    .from('labor_rates')
    .select('id, org_id, name, rate, unit, notes, active')
    .eq('active', true)
    .order('org_id', { nullsFirst: true })
    .order('name')

  if (!scope.all) {
    const ids = scope.ids.filter(Boolean)
    query = ids.length > 0
      ? query.or(`org_id.is.null,org_id.in.(${ids.join(',')})`)
      : query.is('org_id', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ labor_rates: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body = await req.json().catch(() => ({}))

  const name = clean(body.name)
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Dealers create rates for their own org; corporate can create a global default.
  const org_id = scope.all ? (clean(body.org_id) || null) : (scope.own_id ?? null)
  const rate = body.rate != null && body.rate !== '' ? Number(body.rate) : 0

  const { data, error } = await supabase
    .from('labor_rates')
    .insert({
      org_id,
      name,
      rate: Number.isFinite(rate) ? rate : 0,
      unit: clean(body.unit) || 'hour',
      notes: clean(body.notes) || null,
      created_by: await getProfileId(user.id),
    })
    .select('id, org_id, name, rate, unit, notes, active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ labor_rate: data }, { status: 201 })
}
