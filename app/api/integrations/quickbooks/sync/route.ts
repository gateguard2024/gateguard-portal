/**
 * /api/integrations/quickbooks/sync — corporate only.
 *   POST → run a sync now (pull changes + send what's waiting, even if auto-sync is off)
 *   GET  → recent sync log + invoices/commissions with problems
 */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { qdb, runSync } from '@/lib/qbo-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'QuickBooks is Gate Guard corporate only.' }, { status: 403 })
  const r = await runSync({ force: true, budgetMs: 48000 })
  if (!r.ok) return NextResponse.json({ error: r.error ?? r.skipped }, { status: r.skipped ? 409 : 500 })
  return NextResponse.json(r)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'QuickBooks is Gate Guard corporate only.' }, { status: 403 })
  const db = qdb()
  const [log, inv, com] = await Promise.all([
    db.from('qbo_sync_log').select('*').order('created_at', { ascending: false }).limit(80),
    db.from('invoices').select('id, invoice_number, total, status, qb_sync_error, qb_invoice_id').not('qb_sync_error', 'is', null).order('updated_at', { ascending: false }).limit(50),
    db.from('commission_payouts').select('id, amount, pay_period, qb_sync_error').not('qb_sync_error', 'is', null).limit(50),
  ])
  if (log.error) return NextResponse.json({ error: log.error.message }, { status: 500 })
  return NextResponse.json({ log: log.data ?? [], invoiceProblems: inv.data ?? [], commissionProblems: com.data ?? [] })
}
