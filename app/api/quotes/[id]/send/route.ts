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
import { buildProposalEmail } from '@/lib/partnership-proposal'
import { agreementPdfBuffer } from '@/lib/partnership-agreement-pdf'
import { proposalPdfBuffer } from '@/lib/partnership-proposal-pdf'
import { surveyPdfBuffer } from '@/lib/survey-doc-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

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
  const proposalLink = `${APP_URL}/quotes/${id}/proposal`
  const agreementLink = `${APP_URL}/quotes/${id}/agreement`
  const senderName = quote.created_by_name || 'Gate Guard'

  // CC — accepts an array or a comma/semicolon/space-separated string; keep only valid addresses.
  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
  const ccRaw = Array.isArray(body.cc) ? body.cc.map(String) : String(body.cc || '').split(/[,;\s]+/)
  const ccList = ccRaw.map((s: string) => s.trim()).filter((s: string) => emailRe.test(s))

  // Body IS the proposal (house-format subject + full letter) so nothing is copy-pasted.
  const cfg = (quote.partnership && typeof quote.partnership === 'object') ? quote.partnership : {}
  const built = buildProposalEmail(quote, cfg, { proposalLink, agreementLink })
  const subject = String(body.subject || built.subject)
  const html = built.html
  const text = built.text

  // Attachments — the rep chooses which PDFs ride along (proposal, agreement,
  // survey). Each is best-effort: a failure skips that file, never the send.
  const safeName = String(property).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'Property'
  const wantProposal = body.attach_proposal !== false   // default on
  const wantAgreement = body.attach_agreement !== false  // default on
  const wantSurvey = body.attach_survey === true          // default off
  const attachments: { filename: string; content: Buffer; contentType: string }[] = []

  if (wantProposal) {
    try { attachments.push({ filename: `${safeName}_Proposal.pdf`, content: await proposalPdfBuffer(quote, cfg), contentType: 'application/pdf' }) } catch { /* skip */ }
  }
  if (wantAgreement) {
    try { attachments.push({ filename: `${safeName}_Service_Agreement.pdf`, content: await agreementPdfBuffer(quote, cfg), contentType: 'application/pdf' }) } catch { /* skip */ }
  }
  if (wantSurvey && quote.opportunity_id) {
    try {
      const { data: sv } = await supabase.from('surveys').select('*').eq('opportunity_id', quote.opportunity_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (sv) attachments.push({ filename: `${safeName}_Pre-Proposal_Survey.pdf`, content: await surveyPdfBuffer(sv, (sv.survey_doc && typeof sv.survey_doc === 'object') ? sv.survey_doc : {}), contentType: 'application/pdf' })
    } catch { /* skip */ }
  }

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
    const r = await sendViaGmail(String(gmail.oauth_refresh_token), from, { to, cc: ccList, subject, html, text, fromName: senderName, attachments })
    sent = r.ok; via = 'gmail'; if (!r.ok) sendError = r.error ?? 'Gmail send failed'
  }

  if (!sent) {
    const key = process.env.RESEND_API_KEY
    if (key) {
      const fromEmail = process.env.RESEND_DOCUMENTS_FROM_EMAIL || 'documents@nexus.gateguard.co'
      try {
        const rr = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `Gate Guard <${fromEmail}>`, to: [to],
            cc: ccList.length ? ccList : undefined,
            subject, html, reply_to: 'rfeldman@gateguard.co',
            attachments: attachments.map(a => ({ filename: a.filename, content: a.content.toString('base64') })),
          }),
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
      subject: `Proposal sent — ${property}`,
      body: `Sent to ${to}${ccList.length ? `, cc ${ccList.join(', ')}` : ''} via ${via}.${attachments.length ? ` Attached: ${attachments.map(a => a.filename).join(', ')}.` : ''}`,
      opportunity_id: quote.opportunity_id, completed_at: ts,
    })
  }

  return NextResponse.json({ ok: true, via, to, cc: ccList, attached: attachments.length > 0 })
}
