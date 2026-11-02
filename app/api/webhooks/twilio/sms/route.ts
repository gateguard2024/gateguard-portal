/**
 * POST /api/webhooks/twilio/sms — Twilio calls this when someone texts our number.
 * Set it on the Twilio number: Messaging → "A message comes in" → Webhook → HTTP POST →
 *   https://portal.gateguard.co/api/webhooks/twilio/sms   (beta: the beta URL)
 *
 * No Clerk session (middleware bypass); every request must carry a valid
 * X-Twilio-Signature (signed with TWILIO_AUTH_TOKEN). Set TWILIO_SMS_WEBHOOK_URL if the
 * address Twilio calls differs from what this server sees (a proxy / custom domain).
 *
 * The text is matched to a job (lib/wo-texts.ts → matchInbound), saved on its thread
 * and noted in the job's Notes. Unmatched texts are kept for Gate Guard to place.
 * A Twilio retry of the same message is saved once (unique MessageSid).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logJobText, matchInbound, maskPhone, toE164, verifyTwilio } from '@/lib/wo-texts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const twiml = (status = 200) => new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { status, headers: { 'Content-Type': 'text/xml' } })

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const url = process.env.TWILIO_SMS_WEBHOOK_URL || `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`
  if (!process.env.TWILIO_AUTH_TOKEN) return NextResponse.json({ error: 'Twilio is not set up' }, { status: 503 })
  if (!verifyTwilio(url, params, req.headers.get('x-twilio-signature'))) return NextResponse.json({ error: 'Bad signature' }, { status: 403 })

  const phone = toE164(params.From) ?? String(params.From ?? '').slice(0, 20)
  const media = Number(params.NumMedia ?? 0)
  const body = (String(params.Body ?? '').trim() || (media ? `[sent ${media} picture${media === 1 ? '' : 's'}]` : '')).slice(0, 4000)
  if (!phone || !body) return twiml()

  const job = await matchInbound(phone)
  const err = await logJobText({ ...job, direction: 'in', phone, body, kind: 'inbound', status: 'received', twilio_sid: params.MessageSid ?? null })
  // Saving failed (not a duplicate) → 500 so Twilio retries later instead of losing the text.
  if (err) { console.error('[twilio/sms] save failed:', err); return twiml(500) }
  if (job.work_order_id) {
    const { error } = await sb.from('wo_comments').insert({ work_order_id: job.work_order_id, author_name: 'Customer (text)', content: `💬 Text from ${maskPhone(phone)}: ${body}` })
    if (error) console.error('[twilio/sms] note failed:', error.message)
  }
  return twiml()
}
