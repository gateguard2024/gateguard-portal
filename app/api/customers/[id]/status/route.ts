/**
 * /api/customers/[id]/status — make a customer (organization) inactive or active again. CORPORATE ONLY.
 *
 *   GET                                           { status, is_active, inactive_*, sites: { total, active } }
 *   POST { active: false, reason, sites?, last_day? }   sites=true also turns off their properties
 *   POST { active: true, sites? }                        sites=true turns back on properties that were inactive (not decommissioned)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { isInactiveSite, setCustomerActive } from '@/lib/decommission'

export const dynamic = 'force-dynamic'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const UUID = /^[0-9a-f-]{36}$/i

async function snapshot(id: string) {
  const { data: org, error } = await sb.from('organizations').select('id, name, tier, status, is_active, inactive_at, inactive_reason, inactive_by').eq('id', id).maybeSingle()
  if (error) return { error: /inactive_/.test(error.message) ? 'This needs migration 213.' : error.message }
  if (!org) return { error: 'Customer not found.' }
  const { data: sites } = await sb.from('sites').select('id, status').eq('org_id', id)
  const all = sites ?? []
  return { customer: org, sites: { total: all.length, active: all.filter(s => !isInactiveSite(s.status)).length } }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Only Gate Guard corporate can do this.' }, { status: 403 })
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Bad customer.' }, { status: 400 })
  const s = await snapshot(params.id)
  if (!s.customer) return NextResponse.json({ error: s.error }, { status: s.error === 'Customer not found.' ? 404 : 500 })
  return NextResponse.json(s)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Only Gate Guard corporate can do this.' }, { status: 403 })
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Bad customer.' }, { status: 400 })
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'Say active or inactive.' }, { status: 400 })
  const r = await setCustomerActive(params.id, body.active, { id: user.id, name: user.name, org_id: user.org_id }, {
    reason: body.reason ? String(body.reason) : '', sites: !!body.sites, lastDay: body.last_day ? String(body.last_day) : null,
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  const s = await snapshot(params.id)
  return NextResponse.json({ ok: true, changedSites: r.sites ?? 0, warning: r.warnings?.length ? r.warnings.join(' ') : null, ...s })
}
