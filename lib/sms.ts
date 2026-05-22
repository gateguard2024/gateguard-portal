/**
 * lib/sms.ts — GateGuard Twilio SMS utility
 *
 * Sends automated customer-facing SMS at each work order milestone.
 * Uses Twilio REST API (no SDK dependency — raw fetch).
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (+1XXXXXXXXXX format)
 *
 * All sends are fire-and-forget (non-blocking). Never throw — log only.
 */

export type SMSEvent =
  | 'scheduled'
  | 'in_route'
  | 'on_site'
  | 'completed'
  | 'review_request'
  | 'payment_link'

export interface SMSPayload {
  event:          SMSEvent
  to:             string          // E.164 phone number e.g. +13055551234
  wo_number:      string
  title:          string
  customer_name:  string
  tech_name?:     string
  scheduled_date?: string         // ISO date string
  tech_eta?:      string          // human-readable ETA e.g. "2:30 PM"
  payment_url?:   string          // Stripe payment link (payment_link event)
  review_url?:    string          // Google review link (review_request event)
  property_name?: string
}

// ── Message templates ─────────────────────────────────────────────────────────

function buildMessage(p: SMSPayload): string {
  const tech   = p.tech_name    ?? 'Your GateGuard technician'
  const prop   = p.property_name ?? p.customer_name
  const date   = p.scheduled_date
    ? new Date(p.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : null

  switch (p.event) {
    case 'scheduled':
      return `Hi! Your GateGuard tech is scheduled for ${date ?? 'an upcoming date'}. WO #${p.wo_number}: ${p.title}. We'll text again when ${tech.split(' ')[0]} is on the way. Questions? Reply here.`

    case 'in_route':
      return `${tech} from GateGuard is on the way to ${prop}! ${p.tech_eta ? `ETA: ${p.tech_eta}. ` : ''}WO #${p.wo_number}. Reply STOP to opt out.`

    case 'on_site':
      return `${tech} from GateGuard has arrived at ${prop} and is working on WO #${p.wo_number}: ${p.title}.`

    case 'completed':
      return `✓ GateGuard service complete at ${prop}. WO #${p.wo_number}: ${p.title}. Thank you — we appreciate your business!`

    case 'review_request':
      return `Hi! GateGuard just completed service at ${prop}. How did we do? 30 seconds → ${p.review_url ?? 'https://g.page/gateguard'} — it means the world to our team!`

    case 'payment_link':
      return `GateGuard invoice ready for WO #${p.wo_number}: ${p.title}. Pay securely here: ${p.payment_url} (card or ACH, no account needed).`
  }
}

// ── Twilio send ───────────────────────────────────────────────────────────────

export async function sendSMS(payload: SMSPayload): Promise<void> {
  const SID   = process.env.TWILIO_ACCOUNT_SID
  const TOKEN = process.env.TWILIO_AUTH_TOKEN
  const FROM  = process.env.TWILIO_FROM_NUMBER

  if (!SID || !TOKEN || !FROM) {
    console.warn('[sms] Twilio env vars not set — skipping SMS')
    return
  }

  // Normalize to E.164
  const to = payload.to.replace(/\D/g, '')
  const e164 = to.startsWith('1') ? `+${to}` : `+1${to}`
  if (e164.length < 12) {
    console.warn('[sms] Invalid phone number:', payload.to)
    return
  }

  const body = buildMessage(payload)
  const url  = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`
  const auth = Buffer.from(`${SID}:${TOKEN}`).toString('base64')

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: FROM, To: e164, Body: body }).toString(),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[sms] Twilio error:', res.status, err)
    } else {
      console.log('[sms] Sent', payload.event, 'to', e164)
    }
  } catch (err) {
    console.error('[sms] fetch failed:', err)
  }
}

// ── Convenience: fire WO status SMS + delayed review request ─────────────────

export async function notifyWOSMS(params: {
  event:          SMSEvent
  to:             string
  wo_number:      string
  title:          string
  customer_name:  string
  tech_name?:     string
  scheduled_date?: string
  tech_eta?:      string
  property_name?: string
  review_url?:    string
}): Promise<void> {
  await sendSMS({ ...params, payment_url: undefined })

  // On completion, schedule a review request SMS 2 hours later via Twilio delayed message
  if (params.event === 'completed' && params.review_url) {
    const sendAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const SID    = process.env.TWILIO_ACCOUNT_SID
    const TOKEN  = process.env.TWILIO_AUTH_TOKEN
    const FROM   = process.env.TWILIO_FROM_NUMBER

    if (!SID || !TOKEN || !FROM) return

    const to  = params.to.replace(/\D/g, '')
    const e164 = to.startsWith('1') ? `+${to}` : `+1${to}`
    const body = buildMessage({ ...params, event: 'review_request', payment_url: undefined })
    const url  = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`
    const auth = Buffer.from(`${SID}:${TOKEN}`).toString('base64')

    void fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From:    FROM,
        To:      e164,
        Body:    body,
        SendAt:  sendAt,
        ScheduleType: 'fixed',
        MessagingServiceSid: process.env.TWILIO_MESSAGING_SID ?? '',
      }).toString(),
    }).catch(console.error)
  }
}
