import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// ─── POST /api/invoices/[id]/mark-paid ───────────────────────────────────────
// Marks an invoice as paid. Triggers QB sync attempt and activates commission payouts.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const body  = await req.json().catch(() => ({}))

  const {
    amount_paid,
    paid_at = new Date().toISOString(),
    notes,
  } = body

  const { data: invoice, error: fetchErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, org_id, total, status')
    .eq('id', params.id)
    .single()

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }
  if (!scope.all && invoice.org_id && !scope.ids.includes(invoice.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (invoice.status === 'void') {
    return NextResponse.json({ error: 'Cannot mark a voided invoice as paid' }, { status: 400 })
  }

  const paidAmount = amount_paid != null ? parseFloat(String(amount_paid)) : invoice.total

  // Mark paid
  const { data: updated, error: updateErr } = await supabase
    .from('invoices')
    .update({
      status:      'paid',
      amount_paid: paidAmount,
      paid_at:     paid_at,
      notes:       notes ?? null,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Move related commission payouts to 'pending' (ready for admin approval)
  void (async () => {
    try {
      await supabase
        .from('commission_payouts')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('invoice_id', params.id)
        .eq('status', 'pending') // only touch pending, not already approved/paid
    } catch (_) { /* non-blocking */ }
  })()

  // Fire QB sync in background (non-blocking — failure must not block the paid flow)
  void (async () => {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await fetch(`${base}/api/invoices/${params.id}/qb-sync`, { method: 'POST' })
    } catch (_) { /* non-blocking */ }
  })()

  return NextResponse.json({ invoice: updated })
}
