// POST /api/integrations/quickbooks/import — corporate only.
// INBOUND: pull open (Balance > 0) invoices from QuickBooks into the portal so
// balances show on Billing and the customer portal. Same rules as the automatic
// sync (lib/qbo-sync.ts applyQboInvoice): linked invoices get their paid amount,
// QuickBooks-made invoices come in for customers linked to a property or client.
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getQboAuth, qboQuery } from '@/lib/qbo'
import { applyQboInvoice } from '@/lib/qbo-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export async function POST() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const auth = await getQboAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 400 })
  const q = await qboQuery<Row>(auth, "select * from Invoice where Balance > '0' maxresults 1000")
  if (!q.ok) return NextResponse.json({ error: q.error }, { status: 502 })
  let processed = 0, skippedNoMapping = 0, failed = 0
  for (const inv of q.rows) {
    const r = await applyQboInvoice(inv)
    if (r === 'updated' || r === 'created') processed++
    else if (r === 'skipped') skippedNoMapping++
    else failed++
  }
  return NextResponse.json({ ok: true, total_open_in_qbo: q.rows.length, imported_or_updated: processed, skipped_no_customer_mapping: skippedNoMapping, failures: failed ? [`${failed} invoice(s) failed — see the QuickBooks sync log`] : [] })
}
