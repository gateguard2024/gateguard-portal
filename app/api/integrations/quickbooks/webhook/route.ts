/**
 * POST /api/integrations/quickbooks/webhook — called by Intuit when something
 * changes in QuickBooks. Public (no Clerk): authenticated by the intuit-signature
 * header = base64(HMAC-SHA256(QBO_WEBHOOK_VERIFIER, raw body)).
 *
 * It doesn't trust or parse the payload's details — it just wakes the sync job,
 * which reads the real changes from QuickBooks (Change Data Capture). That keeps
 * it working whether Intuit sends the classic or the CloudEvents format.
 */
import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const verifier = process.env.QBO_WEBHOOK_VERIFIER
  if (!verifier) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  const raw = await req.text()
  const sig = req.headers.get('intuit-signature') ?? ''
  const want = crypto.createHmac('sha256', verifier).update(raw).digest('base64')
  const a = Buffer.from(sig), b = Buffer.from(want)
  if (!sig || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  try {
    await inngest.send({ name: 'qbo/changed', data: { at: new Date().toISOString() } })
  } catch (e) {
    // Intuit retries on non-200; the 15-minute job also catches up, so this is safe either way.
    console.error('[qbo/webhook] could not queue sync', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not queue sync' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
