import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// ─── GET /api/invoices/[id] ───────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, org_id, client_org_id, site_id,
      status, issue_date, due_date,
      subtotal, tax_amount, total, amount_paid, balance_due,
      notes, stripe_payment_link, stripe_payment_intent_id,
      qb_invoice_id, qb_synced_at,
      paid_at, sent_at, voided_at, created_at, updated_at,
      invoice_line_items (
        id, service_type, description, qty, unit_price, amount,
        is_recurring, sort_order, created_at
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Org scope check
  if (!scope.all && invoice.org_id && !scope.ids.includes(invoice.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Enrich with site + client org name
  let site_name: string | null = null
  let client_name: string | null = null

  if (invoice.site_id) {
    const { data: site } = await supabase
      .from('sites')
      .select('name, units')
      .eq('id', invoice.site_id)
      .single()
    site_name = site?.name ?? null
  }

  if (invoice.client_org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', invoice.client_org_id)
      .single()
    client_name = org?.name ?? null
  }

  // Sort line items
  const sortedItems = (invoice.invoice_line_items ?? []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  // Fetch related commission payouts
  const { data: payouts } = await supabase
    .from('commission_payouts')
    .select('id, payout_type, amount, rate_percent, status, pay_period, org_id')
    .eq('invoice_id', params.id)

  return NextResponse.json({
    invoice: {
      ...invoice,
      invoice_line_items: sortedItems,
      site_name,
      client_name,
      commission_payouts: payouts ?? [],
    }
  })
}

// ─── PATCH /api/invoices/[id] ─────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body  = await req.json()

  // Verify access
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, org_id, status')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (!scope.all && existing.org_id && !scope.ids.includes(existing.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow certain fields to be patched
  const allowed = ['status', 'notes', 'due_date', 'paid_at', 'amount_paid', 'stripe_payment_link']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: data })
}

// ─── DELETE /api/invoices/[id] — soft void ────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, org_id')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (!scope.all && existing.org_id && !scope.ids.includes(existing.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'void', voided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
