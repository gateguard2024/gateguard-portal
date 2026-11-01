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
 * Events to listen: checkout.session.completed, checkout.session.async_payment_succeeded
 * Handles ARIA credit purchases AND invoice payment links (marks the invoice paid).
 *
 * Required env var: STRIPE_WEBHOOK_SECRET (from Stripe Dashboard webhook signing secret)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { inngest } from '@/inngest/client'
import { releaseHeldCommissions } from '@/lib/qbo-sync'

export const dynamic = 'force-dynamic'

// Must read raw body for Stripe signature verification
export const runtime = 'nodejs'

// Stripe initialized inside handler — avoids Next.js build-time module evaluation
// when STRIPE_SECRET_KEY is not set in the build environment.
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia' as const,
  })
}

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
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[billing/webhook] Signature error:', msg)
    return NextResponse.json({ error: `Webhook signature error: ${msg}` }, { status: 400 })
  }

  // Only handle checkout completion
  // ACH (us_bank_account) payments finish later with async_payment_succeeded.
  if (event.type === 'checkout.session.async_payment_succeeded') {
    return handleInvoicePayment(event.data.object as Stripe.Checkout.Session)
  }
  if (event.type !== 'checkout.session.completed') {
    // Acknowledge other events silently
    return NextResponse.json({ received: true, event_type: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // ── Invoice payment links (field "collect payment" + invoice links) ─────────
  // Not an ARIA credit purchase → find the invoice this payment link belongs to
  // and mark it paid. Idempotent: a retried webhook finds it already paid.
  if (!session.metadata?.credits) {
    return handleInvoicePayment(session)
  }

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

/** Mark the invoice behind a paid Stripe payment link as paid (once). */
async function handleInvoicePayment(session: Stripe.Checkout.Session) {
  if (session.payment_status && session.payment_status !== 'paid') {
    // ACH can complete checkout before the money clears — wait for the async event.
    return NextResponse.json({ received: true, pending_payment: true })
  }
  const linkId = typeof session.payment_link === 'string' ? session.payment_link : session.payment_link?.id
  const woId = session.metadata?.work_order_id
  const invoiceId = session.metadata?.invoice_id
  let q = supabase.from('invoices').select('id, total, status, amount_paid')
  if (invoiceId) q = q.eq('id', invoiceId)
  else if (linkId) q = q.eq('stripe_payment_link_id', linkId)
  else if (woId) q = q.eq('work_order_id', woId).neq('status', 'void')
  else return NextResponse.json({ received: true, ignored: 'no invoice reference' })
  const { data: rows, error } = await q.order('created_at', { ascending: false }).limit(1)
  if (error) {
    console.error('[billing/webhook] invoice lookup failed:', error.message)
    return NextResponse.json({ error: 'Invoice lookup failed' }, { status: 500 })   // Stripe retries
  }
  const inv = rows?.[0]
  if (!inv) return NextResponse.json({ received: true, ignored: 'invoice not found' })
  if (inv.status === 'paid') return NextResponse.json({ received: true, already_paid: true })
  if (inv.status === 'void') {
    console.error('[billing/webhook] payment received on a VOID invoice', inv.id, session.id)
    return NextResponse.json({ received: true, warning: 'invoice is void' })
  }
  const paid = Math.round(((session.amount_total ?? 0) / 100) * 100) / 100
  const newPaid = Math.round(((Number(inv.amount_paid) || 0) + paid) * 100) / 100
  const full = newPaid + 0.005 >= Number(inv.total || 0)
  const now = new Date().toISOString()
  const { error: uErr } = await supabase.from('invoices')
    .update({ status: full ? 'paid' : 'partial', amount_paid: newPaid, ...(full ? { paid_at: now } : {}), updated_at: now })
    .eq('id', inv.id).neq('status', 'paid')
  if (uErr) {
    console.error('[billing/webhook] invoice update failed:', uErr.message)
    return NextResponse.json({ error: 'Invoice update failed' }, { status: 500 })
  }
  if (full) await releaseHeldCommissions(inv.id)
  try { await inngest.send({ name: 'qbo/sync.now', data: { invoice_id: inv.id } }) }
  catch (e) { console.warn('[billing/webhook] QuickBooks sync not queued:', e instanceof Error ? e.message : e) }
  return NextResponse.json({ received: true, invoice_id: inv.id, status: full ? 'paid' : 'partial' })
}
