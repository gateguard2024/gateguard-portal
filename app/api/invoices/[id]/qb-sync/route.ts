/**
 * POST /api/invoices/[id]/qb-sync — send one invoice (and any payment on it) to
 * Gate Guard's QuickBooks now. Corporate only. Creates it, updates it while
 * nothing has been paid on it, or voids it — see lib/qbo-sync.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getQboAuth } from '@/lib/qbo'
import { getSettings, pushInvoice, pushPayment } from '@/lib/qbo-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user.isCorporate) return NextResponse.json({ error: 'QuickBooks is Gate Guard corporate only.' }, { status: 403 })
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  const auth = await getQboAuth()
  if (!auth.ok) return NextResponse.json({ skipped: true, reason: auth.reason })
  const settings = await getSettings()
  const r = await pushInvoice(auth, params.id, settings)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
  const p = await pushPayment(auth, params.id, settings)
  return NextResponse.json({ ok: true, qb_invoice_id: r.qboId, ...(r.note ? { note: r.note } : {}), payment_sent: p.ok ? p.amount : 0, ...(p.ok ? {} : { payment_error: p.error }) })
}
