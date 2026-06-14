/**
 * POST /api/webhooks/clerk
 *
 * Clerk webhook (verified via Svix). On user.created / user.updated, mirror the
 * user into the Supabase `profiles` table so the rest of the app has an internal
 * record to join on. Bypasses Clerk middleware (see middleware.ts) — the Svix
 * signature IS the auth.
 *
 * Setup: in the Clerk dashboard create an endpoint to this URL, subscribe to
 * user.created + user.updated, and set CLERK_WEBHOOK_SECRET on Vercel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { upsertProfileFromClerk, fromWebhookData } from '@/lib/profile-sync'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CLERK_WEBHOOK_SECRET not configured' }, { status: 500 })
  }

  const payload = await req.text()
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let evt: { type: string; data: any }
  try {
    evt = new Webhook(secret).verify(payload, headers) as { type: string; data: any }
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const result = await upsertProfileFromClerk(fromWebhookData(evt.data))
    if (!result.ok) {
      // Acknowledge so Clerk doesn't retry forever; log the reason.
      console.warn('[clerk webhook] profile not synced:', result.reason)
    }
  }

  return NextResponse.json({ received: true })
}
