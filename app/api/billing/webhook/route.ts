/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler for ARIA credit fulfillment.
 * Listens for checkout.session.completed events and calls grant_aria_credits().
 *
 * IMPORTANT: This route MUST be in the Clerk bypass list in middleware.ts
 * (Stripe sends raw HTTP — no Clerk session) and must use the raw body
 * for webhook signature verification.
 *
 * Stripe Dashboard → Webhooks → endpoint URL: https://portal.gateguard.co/api/billing/webhook
 * Events to listen: checkout.session.completed
 *
 * Required env var: STRIPE_WEBHOOK_SECRET (from Stripe Dashboard webhook signing secret)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// Must read raw body for Stripe signature verification
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia' as const,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[billing/webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // Read raw body for signature verification
  let rawBody: Buffer
  try {
    const bodyText = await req.text()
    rawBody = Buffer.from(bodyText)
  } catch {
    return NextResponse.json({ error: 'Could not read request body' }, { status: 400 })
  }

  // Verify Stripe signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[billing/webhook] Signature error:', msg)
    return NextResponse.json({ error: `Webhook signature error: ${msg}` }, { status: 400 })
  }

  // Only handle checkout completion
  if (event.type !== 'checkout.session.completed') {
    // Acknowledge other events silently
    return NextResponse.json({ received: true, event_type: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // Extract metadata we embedded at checkout creation
  const { org_id, user_id, credit_package_id, credits, price_cents } = session.metadata ?? {}

  if (!org_id || !credits) {
    console.error('[billing/webhook] Missing metadata on session', session.id)
    // Return 200 to Stripe so it doesn't retry — this is a data integrity issue
    return NextResponse.json({ received: true, error: 'Missing metadata — credits not granted' })
  }

  const creditAmount = parseInt(credits, 10)
  const priceCents = parseInt(price_cents ?? '0', 10)

  // Check idempotency — has this session been fulfilled already?
  const { data: existing } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (existing) {
    console.log('[billing/webhook] Session already fulfilled:', session.id)
    return NextResponse.json({ received: true, already_fulfilled: true })
  }

  // Grant credits via RPC
  const { data: result, error: grantError } = await supabase.rpc('grant_aria_credits', {
    p_org_id: org_id,
    p_user_id: user_id ?? null,
    p_amount: creditAmount,
    p_transaction_type: 'purchase',
    p_note: `Stripe checkout: ${session.id}`,
    p_granted_by: null,
    p_granted_by_name: null,
    p_expires_at: null,          // purchases never expire
    p_stripe_session_id: session.id,
    p_credit_package_id: credit_package_id ? credit_package_id : null,
    p_price_paid_cents: priceCents,
  })

  if (grantError) {
    console.error('[billing/webhook] grant_aria_credits RPC error:', grantError.message)
    // Return 500 so Stripe retries
    return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 })
  }

  const grantResult = result as { success: boolean; balance_after: number }

  console.log('[billing/webhook] Credits granted:', {
    org_id,
    credits: creditAmount,
    balance_after: grantResult.balance_after,
    session_id: session.id,
  })

  return NextResponse.json({
    received: true,
    granted: true,
    credits: creditAmount,
    balance_after: grantResult.balance_after,
    org_id,
  })
}
