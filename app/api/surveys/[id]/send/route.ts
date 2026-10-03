/**
 * POST /api/surveys/[id]/send — email the Pre-Proposal Survey record to the client.
 *
 * Builds a short cover email, attaches the survey record as a PDF, sends through the
 * rep's connected Gmail (Resend fallback), stamps sent_at, and logs a CRM activity
 * on the linked opportunity. Body: { to, cc?, subject? }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { getProfileId } from '@/lib/org-scope'
import { sendViaGmail } from '@/lib/mail-send'
import { surveyPdfBuffer } from '@/lib/survey-doc-pdf'
import { resolveSurvey } from '@/lib/survey-doc'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.gateguard.co'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user?.id || user.id === 'system') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = params.id

  const { data: survey, error } = await supabase.from('surveys').select('*').eq('id', id).single()
  if (error || !survey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const to = String(body.to || survey.client_email || '').trim()
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: 'A valid client email is required.' }, { status: 400 })
  }
  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
  const ccRaw = Array.isArray(body.cc) ? body.cc.map(String) : String(body.cc || '').split(/[,;\s]+/)
  const ccList = ccRaw.map((x: string) => x.trim()).filter((x: string) => emailRe.test(x))

  const cfg = (survey.survey_doc && typeof survey.survey_doc === 'object') ? survey.survey_doc : {}
  const r = resolveSurvey(survey, cfg)
  const property = survey.property_name || 'your property'
  const repFirst = (String(survey.surveyor_name || '').trim().split(/\s+/)[0]) || 'Gate Guard'
  const senderName = survey.surveyor_name || 'Gate Guard'
  const subject = String(body.subject || `${property} - GateGuard Pre-Proposal Survey from ${repFirst}`)
  const link = `${APP_URL}/survey/${id}/document`

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#17293e;line-height:1.6;max-width:620px">
    <p>Hi${r.preparedForContact ? ` ${r.preparedForContact.split(/\\s+/)[0]}` : ''},</p>
    <p>Thank you for your time on site. Attached is our GateGuard Pre-Proposal Survey for <b>${property}</b> — every opening we documented on the walk, with photos, status, a scope schedule, and our recommendations.</p>
    <p>It records <b>${r.totalPhotos} photos</b> across ${r.openings.length} opening${r.openings.length === 1 ? '' : 's'}. The PDF is attached, and you can also view it online:</p>
    <p style="margin:16px 0"><a href="${link}" style="display:inline-block;background:#c2410c;color:#fff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:10px">View the survey record ↗</a></p>
    <p style="margin-top:20px">Respectfully,<br><b>${senderName}</b><br><span style="color:#5a708c">Gate Guard, LLC · (770) 776-8095 · rfeldman@gateguard.co</span></p>
  </div>`
  const text = `Attached is our GateGuard Pre-Proposal Survey for ${property} — ${r.totalPhotos} photos across ${r.openings.length} openings, with status, scope schedule and recommendations.\n\nView online: ${link}\n\n${senderName} — Gate Guard, LLC`

  // Build the survey PDF (best-effort — send even if it fails).
  const attachments: { filename: string; content: Buffer; contentType: string }[] = []
  try {
    const pdf = await surveyPdfBuffer(survey, cfg)
    const safe = String(property).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'Property'
    attachments.push({ filename: `${safe}_Pre-Proposal_Survey.pdf`, content: pdf, contentType: 'application/pdf' })
  } catch { /* attachment best-effort */ }

  let via = '', sent = false, sendError = ''
  const { data: gmail } = await supabase
    .from('message_channels')
    .select('oauth_refresh_token, address, from_address')
    .eq('user_id', user.id).eq('channel_type', 'gmail')
    .not('oauth_refresh_token', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (gmail?.oauth_refresh_token) {
    const from = String(gmail.address || gmail.from_address || '')
    const res = await sendViaGmail(String(gmail.oauth_refresh_token), from, { to, cc: ccList, subject, html, text, fromName: senderName, attachments })
    sent = res.ok; via = 'gmail'; if (!res.ok) sendError = res.error ?? 'Gmail send failed'
  }
  if (!sent) {
    const key = process.env.RESEND_API_KEY
    if (key) {
      const fromEmail = process.env.RESEND_DOCUMENTS_FROM_EMAIL || 'documents@nexus.gateguard.co'
      try {
        const rr = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: `Gate Guard <${fromEmail}>`, to: [to], cc: ccList.length ? ccList : undefined, subject, html, reply_to: 'rfeldman@gateguard.co', attachments: attachments.map(a => ({ filename: a.filename, content: a.content.toString('base64') })) }),
        })
        sent = rr.ok; via = via || 'resend'; if (!rr.ok) sendError = `Resend failed: ${rr.status}`
      } catch (e) { sendError = e instanceof Error ? e.message : 'Resend exception' }
    } else if (!via) {
      return NextResponse.json({ error: 'No send channel: connect Gmail (Messages → Settings) or set RESEND_API_KEY.' }, { status: 400 })
    }
  }
  if (!sent) return NextResponse.json({ error: sendError || 'Could not send the survey.' }, { status: 502 })

  const ts = new Date().toISOString()
  await supabase.from('surveys').update({ sent_at: ts, updated_at: ts }).eq('id', id)
  if (survey.opportunity_id) {
    const profileId = await getProfileId(user.id)
    await supabase.from('crm_activities').insert({
      dealer_org_id: survey.dealer_org_id ?? null, created_by: profileId, type: 'email',
      subject: `Survey sent — ${property}`,
      body: `Sent to ${to}${ccList.length ? `, cc ${ccList.join(', ')}` : ''} via ${via}.${attachments.length ? ' Survey PDF attached.' : ''}`,
      opportunity_id: survey.opportunity_id, completed_at: ts,
    })
  }

  return NextResponse.json({ ok: true, via, to, cc: ccList, attached: attachments.length > 0 })
}
