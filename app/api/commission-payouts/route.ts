import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// ─── GET /api/commission-payouts ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const status     = searchParams.get('status')
  const org_id_q   = searchParams.get('org_id')
  const pay_period = searchParams.get('pay_period')

  let query = supabase
    .from('commission_payouts')
    .select(`
      id, org_id, rep_id, invoice_id, site_id,
      payout_type, amount, rate_percent, status,
      pay_period, approved_at, approved_by, paid_at, notes,
      created_at, updated_at
    `)
    .order('created_at', { ascending: false })

  // Org isolation
  query = applyOrgScope(query, scope, 'org_id')

  if (status)     query = query.eq('status', status)
  if (org_id_q)   query = query.eq('org_id', org_id_q)
  if (pay_period) query = query.eq('pay_period', pay_period)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const records = data ?? []

  // Enrich with site + invoice numbers
  const siteIds     = [...new Set(records.map(r => r.site_id).filter(Boolean))]
  const invoiceIds  = [...new Set(records.map(r => r.invoice_id).filter(Boolean))]
  const orgIds      = [...new Set(records.map(r => r.org_id).filter(Boolean))]

  const siteMap: Record<string, string>    = {}
  const invoiceMap: Record<string, string> = {}
  const orgMap: Record<string, string>     = {}

  if (siteIds.length > 0) {
    const { data: sites } = await supabase.from('sites').select('id, name').in('id', siteIds)
    ;(sites ?? []).forEach(s => { siteMap[s.id] = s.name })
  }
  if (invoiceIds.length > 0) {
    const { data: invs } = await supabase.from('invoices').select('id, invoice_number').in('id', invoiceIds)
    ;(invs ?? []).forEach(i => { invoiceMap[i.id] = i.invoice_number })
  }
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds)
    ;(orgs ?? []).forEach(o => { orgMap[o.id] = o.name })
  }

  const enriched = records.map(r => ({
    ...r,
    site_name:      r.site_id    ? (siteMap[r.site_id]       ?? null) : null,
    invoice_number: r.invoice_id ? (invoiceMap[r.invoice_id] ?? null) : null,
    org_name:       r.org_id     ? (orgMap[r.org_id]         ?? null) : null,
  }))

  return NextResponse.json({ records: enriched, total: enriched.length })
}

// ─── PATCH /api/commission-payouts ───────────────────────────────────────────
// Bulk approve / mark paid / hold
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.canViewCommissions) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { ids, action } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }
  if (!['approve', 'hold', 'mark_paid'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve | hold | mark_paid' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (action === 'approve') {
    updates.status      = 'approved'
    updates.approved_at = new Date().toISOString()
    updates.approved_by = user.name
  } else if (action === 'hold') {
    updates.status = 'held'
  } else if (action === 'mark_paid') {
    updates.status  = 'paid'
    updates.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('commission_payouts')
    .update(updates)
    .in('id', ids)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ updated: (data ?? []).length })
}
