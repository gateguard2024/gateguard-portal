/**
 * POST /api/quotes/[id]/send — email the proposal to the client.
 *
 * Connective tissue for sending: composes a cover email with links to the
 * client-facing proposal (and matching service agreement), sends it through the
 * rep's connected Gmail (falls back to Resend), marks the quote 'sent', and logs
 * a CRM activity on the linked opportunity so the timeline stays complete.
 *
 * Gated by the review workflow: a partnership proposal must be 'approved' (or the
 * sender is corporate) before it can go out.
 *
 * Body: { to?, subject?, message? } — all optional; sensible defaults from the quote.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { getProfileId } from '@/lib/org-scope'
import { sendViaGmail } from '@/lib/mail-send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'
const HOLD = ['draft', 'pending', 'changes_requested']

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user?.id || user.id === 'system') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = params.id

  const { data: quote, error } = await supabase
    .from('quotes')
    .select('id, quote_number, property_name, client_name, client_email, opportunity_id, dealer_org_id, review_status, quote_mode, partnership, created_by_name')
    .eq('id', id).single()
  if (error || !quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Review gate — a partnership proposal must be approved before it goes to the client.
  const isPartnership = quote.quote_mode === 'partnership' || !!quote.partnership
  if (isPartnership && !user.isCorporate && HOLD.includes(String(quote.review_status))) {
    return NextResponse.json({ error: 'This proposal must be approved before it can be sent.' }, { status: 403 })
  }

  const to = String(body.to || quote.client_email || '').trim()
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: 'A valid client email is required.' }, { status: 400 })
  }

  const property = quote.property_name || quote.client_name || 'your property'
  const subject = String(body.subject || `Your GateGuard proposal — ${property}`)
  const message = String(body.message || `Thank you again for your time. Please find our GateGuard Property Partnership proposal for ${property} at the link below — it includes the full terms and the matching service agreement, and you can review and sign online.`)
  const proposalLink = `${APP_URL}/quotes/${id}/proposal`
  const agreementLink = `${APP_URL}/quotes/${id}/agreement`
  const senderName = quote.created_by_name || 'Gate Guard'

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#17293e;line-height:1.6">
    <p>${message.replace(/\n/g, '<br>')}</p>
    <p style="margin:20px 0">
      <a href="${proposalLink}" style="display:inline-block;background:#2f7fb8;color:#fff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:10px">View &amp; sign your proposal ↗</a>
    </p>
    <p style="font-size:13px;color:#5a708c">Or paste this link: ${proposalLink}<br>Service agreement: ${agreementLink}</p>
    <p style="margin-top:22px">Respectfully,<br><b>${senderName}</b><br><span style="color:#5a708c">Gate Guard, LLC · (770) 776-8095 · rfeldman@gateguard.co</span></p>
  </div>`
  const text = `${message}\n\nView & sign your proposal: ${proposalLink}\nService agreement: ${agreementLink}\n\n${senderName} — Gate Guard, LLC`

  // Prefer the sender's connected Gmail so it comes from the rep; fall back to Resend.
  let via = ''
  let sent = false
  let sendError = ''
  const { data: gmail } = await supabase
    .from('message_channels')
    .select('oauth_refresh_token, address, from_address')
    .eq('user_id', user.id).eq('channel_type', 'gmail')
    .not('oauth_refresh_token', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (gmail?.oauth_refresh_token) {
    const from = String(gmail.address || gmail.from_address || '')
    const r = await sendViaGmail(String(gmail.oauth_refresh_token), from, { to, subject, html, text, fromName: senderName })
    sent = r.ok; via = 'gmail'; if (!r.ok) sendError = r.error ?? 'Gmail send failed'
  }

  if (!sent) {
    const key = process.env.RESEND_API_KEY
    if (key) {
      const fromEmail = process.env.RESEND_DOCUMENTS_FROM_EMAIL || 'documents@nexus.gateguard.co'
      try {
        const rr = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: `Gate Guard <${fromEmail}>`, to: [to], subject, html, reply_to: 'rfeldman@gateguard.co' }),
        })
        sent = rr.ok; via = via || 'resend'; if (!rr.ok) sendError = `Resend failed: ${rr.status}`
      } catch (e) { sendError = e instanceof Error ? e.message : 'Resend exception' }
    } else if (!via) {
      return NextResponse.json({ error: 'No send channel: connect Gmail (Messages → Settings) or set RESEND_API_KEY.' }, { status: 400 })
    }
  }

  if (!sent) return NextResponse.json({ error: sendError || 'Could not send the proposal.' }, { status: 502 })

  // Mark sent + log to the opportunity timeline.
  const ts = new Date().toISOString()
  await supabase.from('quotes').update({ status: 'sent', sent_at: ts, updated_at: ts }).eq('id', id)
  if (quote.opportunity_id) {
    const profileId = await getProfileId(user.id)
    await supabase.from('crm_activities').insert({
      dealer_org_id: quote.dealer_org_id, created_by: profileId, type: 'email',
      subject: `Proposal sent — ${property}`, body: `Sent to ${to} via ${via}.`,
      opportunity_id: quote.opportunity_id, completed_at: ts,
    })
  }

  return NextResponse.json({ ok: true, via, to })
}
