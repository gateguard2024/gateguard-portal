import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { getQboAuth, qboQuery } from '@/lib/qbo'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

type QBInvoice = {
  Id: string
  DocNumber?: string
  TxnDate?: string
  DueDate?: string
  TotalAmt?: number
  Balance?: number
  CustomerRef?: { value: string; name?: string }
  CustomerMemo?: { value?: string }
  PrivateNote?: string
}

// POST /api/integrations/quickbooks/import
// INBOUND: pull open (Balance > 0) invoices from QBO and upsert them into the
// portal so balances show on the billing page + customer portal. Matches each
// QBO invoice to a client org via organizations.qbo_customer_id.
export async function POST() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const auth = await getQboAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 400 })

  const q = await qboQuery<QBInvoice>(auth, "select * from Invoice where Balance > '0' maxresults 1000")
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: 502 })

  // Map QBO Customer Id → portal org id.
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, qbo_customer_id')
    .not('qbo_customer_id', 'is', null)
  const orgByCustomer = new Map<string, string>()
  for (const o of orgs ?? []) if (o.qbo_customer_id) orgByCustomer.set(o.qbo_customer_id, o.id)

  const today = new Date().toISOString().slice(0, 10)
  let processed = 0
  let skippedNoMapping = 0
  const failures: string[] = []

  for (const inv of q.rows) {
    const custId = inv.CustomerRef?.value
    const orgId = custId ? orgByCustomer.get(custId) : undefined
    if (!orgId) { skippedNoMapping++; continue }

    const total = Number(inv.TotalAmt ?? 0)
    const balance = Number(inv.Balance ?? 0)
    const dueDate = inv.DueDate || inv.TxnDate || today
    const status = balance <= 0 ? 'paid' : (dueDate < today ? 'overdue' : 'sent')

    const row = {
      org_id: orgId,
      client_org_id: orgId,
      invoice_number: `QB-${inv.DocNumber || inv.Id}`,
      status,
      issue_date: inv.TxnDate || today,
      due_date: dueDate,
      subtotal: total,
      tax_amount: 0,
      total,
      amount_paid: Math.max(0, total - balance), // balance_due is generated = total - amount_paid
      notes: inv.CustomerMemo?.value || inv.PrivateNote || null,
      qb_invoice_id: inv.Id,
      qb_synced_at: new Date().toISOString(),
      source: 'quickbooks',
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('invoices').upsert(row, { onConflict: 'qb_invoice_id' })
    if (error) failures.push(`${row.invoice_number}: ${error.message}`)
    else processed++
  }

  return NextResponse.json({
    ok: true,
    total_open_in_qbo: q.rows.length,
    imported_or_updated: processed,
    skipped_no_customer_mapping: skippedNoMapping,
    failures,
  })
}
