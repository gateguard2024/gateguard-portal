/**
 * POST /api/move-in/{token}/pay/confirm { session_id } — called when Stripe sends the
 * resident back. Checks the session with Stripe and turns access on. The webhook does
 * the same thing (whichever comes first wins; both are safe to repeat).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getInvite } from '@/lib/move-in'
import { completeInvite } from '@/lib/move-in-complete'
import { getStripe, MOVE_IN_KIND } from '@/lib/move-in-stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const r = await getInvite(params.token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.error === 'not_found' ? 404 : 410 })
  const { invite } = r
  if (invite.status === 'complete') return NextResponse.json({ done: true })

  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body?.session_id === 'string' ? body.session_id : ''
  if (!sessionId.startsWith('cs_')) return NextResponse.json({ error: 'Missing payment session' }, { status: 400 })

  const session = await getStripe().checkout.sessions.retrieve(sessionId)
  if (session.metadata?.kind !== MOVE_IN_KIND || session.metadata?.invite_id !== invite.id) {
    return NextResponse.json({ error: 'That payment doesn’t match this setup link.' }, { status: 400 })
  }
  if (session.payment_status !== 'paid') return NextResponse.json({ pending: true })

  const done = await completeInvite(invite.id, { status: 'paid', stripeSessionId: session.id })
  return done.ok ? NextResponse.json({ done: true }) : NextResponse.json({ error: 'Payment received, but we couldn’t finish setup. The office has been notified.' }, { status: 500 })
}
