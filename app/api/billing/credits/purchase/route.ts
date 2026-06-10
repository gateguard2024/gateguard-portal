/**
 * POST /api/billing/credits/purchase
 *
 * Creates a Stripe Checkout Session for ARIA credit purchase.
 * On success, Stripe redirects to /aria?purchase=success&session_id={CHECKOUT_SESSION_ID}
 * The webhook (app/api/billing/webhook/route.ts) fulfills the credits asynchronously.
 *
 * Body: { package_id: string }  — UUID from credit_packages table
 *
 * Response: { checkout_url: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia' as const,
})

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = user.org_id
    if (!orgId) {
      return NextResponse.json({ error: 'No org associated with user' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { package_id } = body as { package_id?: string }

    if (!package_id) {
      return NextResponse.json({ error: 'package_id is required' }, { status: 400 })
    }

    // Fetch package details
    const { data: pkg, error: pkgError } = await supabase
      .from('credit_packages')
      .select('id, name, credits, price_cents, stripe_price_id, description')
      .eq('id', package_id)
      .eq('active', true)
      .maybeSingle()

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Credit package not found' }, { status: 404 })
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // Build Checkout Session
    // If the package has a Stripe price ID, use it. Otherwise fall back to ad-hoc price.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineItem: any = pkg.stripe_price_id
      ? {
          price: pkg.stripe_price_id,
          quantity: 1,
        }
      : {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `ARIA Credits — ${pkg.name}`,
              description: `${pkg.credits} ARIA search credits. ${pkg.description ?? ''}`.trim(),
            },
            unit_amount: pkg.price_cents,
          },
          quantity: 1,
        }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${appUrl}/aria?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/aria?purchase=cancelled`,
      metadata: {
        org_id: orgId,
        user_id: user.id,
        credit_package_id: pkg.id,
        credits: String(pkg.credits),
        price_cents: String(pkg.price_cents),
      },
      customer_email: user.email || undefined,
    })

    return NextResponse.json({ checkout_url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[credits/purchase]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
