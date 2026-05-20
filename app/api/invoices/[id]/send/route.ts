import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// ─── POST /api/invoices/[id]/send ─────────────────────────────────────────────
// Creates a Stripe Payment Link for the invoice total, stores it, marks status=sent.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  const { data: invoice, error: fetchErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, org_id, total, status, stripe_payment_link')
    .eq('id', params.id)
    .single()

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }
  if (!scope.all && invoice.org_id && !scope.ids.includes(invoice.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (invoice.status === 'void') {
    return NextResponse.json({ error: 'Cannot send a voided invoice' }, { status: 400 })
  }

  let paymentLinkUrl: string

  if (!process.env.STRIPE_SECRET_KEY) {
    // Development fallback — return a mock URL so the invoice flow is not blocked
    console.warn('[invoices/send] STRIPE_SECRET_KEY not set — using mock payment link')
    paymentLinkUrl = `https://billing.stripe.com/mock/${invoice.invoice_number}`
  } else {
    // Dynamically import Stripe to avoid module-level instantiation issues
    const Stripe = (await import('stripe')).default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' as any })

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency:      'usd',
            product_data:  { name: `GateGuard Invoice ${invoice.invoice_number}` },
            unit_amount:   Math.round(invoice.total * 100),
          },
          quantity: 1,
        },
      ],
      after_completion: {
        type:     'redirect',
        redirect: { url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'}/billing` },
      },
      metadata: { invoice_id: params.id },
    })

    paymentLinkUrl = paymentLink.url
  }

  // Update invoice: status=sent, store payment link
  const { data: updated, error: updateErr } = await supabase
    .from('invoices')
    .update({
      status:              'sent',
      sent_at:             new Date().toISOString(),
      stripe_payment_link: paymentLinkUrl,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ invoice: updated, payment_link: paymentLinkUrl })
}
