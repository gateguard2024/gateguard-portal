/**
 * POST /api/move-in/{token}/pay — finish setup.
 *  - Nothing owed (property pays / collects / code covers) → access turns on now.
 *  - Otherwise → Stripe Checkout; returns { url } to send the resident to.
 * Public, token-based. Payments go through Stripe, never in-app purchase.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getInvite, inviteCode, inviteQuote, setupUrl, updateInvite } from '@/lib/move-in'
import { completeInvite } from '@/lib/move-in-complete'
import { getStripe, MOVE_IN_KIND } from '@/lib/move-in-stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const r = await getInvite(params.token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.error === 'not_found' ? 404 : 410 })
  const { invite } = r
  if (invite.status === 'complete') return NextResponse.json({ done: true })
  if (!invite.details_confirmed_at || !invite.access_confirmed_at) {
    return NextResponse.json({ error: 'Please finish the earlier steps first.' }, { status: 400 })
  }

  const code = await inviteCode(invite)
  const quote = inviteQuote(invite, code)

  if (quote.dueCents === 0) {
    const done = await completeInvite(invite.id, { status: 'not_required' })
    return done.ok ? NextResponse.json({ done: true }) : NextResponse.json({ error: 'We couldn’t finish setup. Please try again.' }, { status: 500 })
  }

  const back = setupUrl(invite.token)
  const unit = invite.unit_number ? ` · Unit ${invite.unit_number}` : ''
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: invite.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: quote.dueCents,
        product_data: {
          name: `Parking & access — ${r.propertyName}${unit}`,
          description: quote.lines.map((l) => l.label).join(' · ').slice(0, 500),
        },
      },
    }],
    metadata: { kind: MOVE_IN_KIND, invite_id: invite.id, site_id: invite.site_id },
    payment_intent_data: { metadata: { kind: MOVE_IN_KIND, invite_id: invite.id, site_id: invite.site_id } },
    success_url: `${back}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: back,
  })
  await updateInvite(invite.id, { stripe_session_id: session.id, payment_status: 'pending', amount_due_cents: quote.dueCents, property_owes_cents: quote.propertyCoversCents })
  return NextResponse.json({ url: session.url })
}
