import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// ─── GET /api/invoices ────────────────────────────────────────────────────────
// List invoices scoped to the caller's org, with optional filters.
export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { searchParams } = new URL(req.url)
  const status        = searchParams.get('status')
  const site_id       = searchParams.get('site_id')
  const client_org_id = searchParams.get('client_org_id')
  const q             = searchParams.get('q')

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, org_id, client_org_id, site_id,
      status, issue_date, due_date,
      subtotal, tax_amount, total, amount_paid, balance_due,
      notes, stripe_payment_link, qb_invoice_id, qb_synced_at,
      paid_at, sent_at, voided_at, created_at, updated_at,
      phase_group_id, phase_number, phase_label, phase_total_amount,
      invoice_line_items ( id, service_type, description, qty, unit_price, amount, is_recurring, sort_order )
    `)
    .order('created_at', { ascending: false })

  // Org isolation
  query = applyOrgScope(query, scope, 'org_id')

  if (status)        query = query.eq('status', status)
  if (site_id)       query = query.eq('site_id', site_id)
  if (client_org_id) query = query.eq('client_org_id', client_org_id)
  if (q)             query = query.or(`invoice_number.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with site name + client org name
  const records = data ?? []
  const siteIds    = [...new Set(records.map(r => r.site_id).filter(Boolean))]
  const clientIds  = [...new Set(records.map(r => r.client_org_id).filter(Boolean))]

  const siteMap: Record<string, string> = {}
  const clientMap: Record<string, string> = {}

  if (siteIds.length > 0) {
    const { data: sites } = await supabase
      .from('sites')
      .select('id, name, units')
      .in('id', siteIds)
    ;(sites ?? []).forEach(s => { siteMap[s.id] = s.name })
  }

  if (clientIds.length > 0) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', clientIds)
    ;(orgs ?? []).forEach(o => { clientMap[o.id] = o.name })
  }

  const enriched = records.map(inv => ({
    ...inv,
    site_name:   inv.site_id       ? (siteMap[inv.site_id]       ?? null) : null,
    client_name: inv.client_org_id ? (clientMap[inv.client_org_id] ?? null) : null,
    line_item_count: (inv.invoice_line_items ?? []).length,
  }))

  return NextResponse.json({ records: enriched, total: enriched.length })
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────
// Create a new invoice with auto-generated invoice number.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()

  const {
    site_id,
    client_org_id,
    notes,
    due_date,
    line_items = [],
    // Phase billing fields
    phase_group_id,
    phase_number,
    phase_label,
    phase_total_amount,
  } = body

  // Determine org_id
  const org_id = user.org_id ?? body.org_id ?? null

  // Auto-generate invoice number: GG-INV-NNNNNN starting at 120045
  // Pull the max existing number to continue the sequence
  const { data: existing } = await supabase
    .from('invoices')
    .select('invoice_number')
    .order('created_at', { ascending: false })
    .limit(1)

  let nextNum = 120045
  if (existing && existing.length > 0) {
    const lastNum = existing[0].invoice_number.replace('GG-INV-', '')
    const parsed  = parseInt(lastNum, 10)
    if (!isNaN(parsed)) nextNum = parsed + 1
  }
  const invoice_number = `GG-INV-${String(nextNum).padStart(6, '0')}`

  // Calculate totals from line items
  let subtotal = 0
  for (const li of line_items) {
    subtotal += (parseFloat(li.qty ?? 1) * parseFloat(li.unit_price ?? 0))
  }
  const total = subtotal // tax is $0 per billing model

  // Create invoice
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      org_id,
      client_org_id:       client_org_id ?? null,
      site_id:             site_id ?? null,
      invoice_number,
      status:              'draft',
      issue_date:          new Date().toISOString().split('T')[0],
      due_date:            due_date ?? new Date().toISOString().split('T')[0],
      subtotal,
      tax_amount:          0,
      total,
      amount_paid:         0,
      notes:               notes ?? null,
      // Phase billing
      phase_group_id:      phase_group_id      ?? null,
      phase_number:        phase_number        ?? null,
      phase_label:         phase_label         ?? null,
      phase_total_amount:  phase_total_amount  ?? null,
    })
    .select()
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create invoice' }, { status: 500 })
  }

  // Insert line items
  if (line_items.length > 0) {
    const items = line_items.map((li: {
      service_type: string
      description: string
      qty?: number | string
      unit_price?: number | string
      is_recurring?: boolean
      sort_order?: number
    }, idx: number) => ({
      invoice_id:   invoice.id,
      service_type: li.service_type,
      description:  li.description,
      qty:          parseFloat(String(li.qty ?? 1)),
      unit_price:   parseFloat(String(li.unit_price ?? 0)),
      is_recurring: li.is_recurring ?? true,
      sort_order:   li.sort_order ?? idx,
    }))

    const { error: liError } = await supabase
      .from('invoice_line_items')
      .insert(items)

    if (liError) {
      // Roll back invoice
      void (async () => {
        try { await supabase.from('invoices').delete().eq('id', invoice.id) } catch (_) { /* noop */ }
      })()
      return NextResponse.json({ error: liError.message }, { status: 500 })
    }
  }

  // Optionally create commission_payouts if site has a dealer assigned
  if (site_id && org_id) {
    const { data: site } = await supabase
      .from('sites')
      .select('id, master_dealer_id, service_dealer_id')
      .eq('id', site_id)
      .single()

    if (site?.master_dealer_id && total > 0) {
      // Default dealer commission: 10% of invoice total (configurable per org in future)
      const defaultRate = 10
      void (async () => {
        try {
          await supabase.from('commission_payouts').insert({
            org_id:      site.master_dealer_id,
            invoice_id:  invoice.id,
            site_id,
            payout_type: 'dealer',
            amount:      parseFloat((total * defaultRate / 100).toFixed(2)),
            rate_percent: defaultRate,
            status:      'pending',
            pay_period:  new Date().toISOString().slice(0, 7),
          })
        } catch (_) { /* non-blocking */ }
      })()
    }
  }

  return NextResponse.json({ invoice }, { status: 201 })
}
