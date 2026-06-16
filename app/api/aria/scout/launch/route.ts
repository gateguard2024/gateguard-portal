/**
 * POST /api/aria/scout/launch
 *
 * SCOUT — AI-powered outreach launcher.
 * Takes ARIA-imported leads and sends the best personalized email via Resend.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

const DEFAULT_FROM_NAME  = 'Russel Feldman'
const DEFAULT_FROM_EMAIL = 'rfeldman@gateguard.co'

// ─── HTML email wrapper ────────────────────────────────────────────────────

function buildScoutHtml(body: string, subject: string): string {
  const paragraphs = body
    .split('\n\n')
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; }
    .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; }
    .hdr  { background:#0C111D; padding:22px 32px; }
    .hdr-tag { color:#6B7EFF; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-top:8px; }
    .body { padding:32px; }
    p { font-size:14px; line-height:1.75; color:#334155; margin:0 0 16px; }
    .sig  { border-top:1px solid #e2e8f0; padding-top:20px; margin-top:24px; }
    .sig-name  { font-weight:700; color:#0f172a; font-size:14px; }
    .sig-info  { color:#64748b; font-size:13px; margin-top:4px; }
    .sig-email { color:#6B7EFF; font-size:13px; }
    .ftr { background:#f8fafc; padding:14px 32px; text-align:center; }
    .ftr p { font-size:11px; color:#94a3b8; margin:0; }
    .scout-badge { display:inline-block; background:#EEF0FF; color:#6B7EFF; font-size:10px; font-weight:700; letter-spacing:.5px; padding:3px 8px; border-radius:999px; margin-bottom:4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div style="color:#fff;font-size:15px;font-weight:700;">GateGuard</div>
      <div class="hdr-tag">The OS for Multifamily Access</div>
    </div>
    <div class="body">
      ${paragraphs}
      <div class="sig">
        <div class="sig-name">${DEFAULT_FROM_NAME}</div>
        <div class="sig-info">Business Development · GateGuard</div>
        <div class="sig-email">${DEFAULT_FROM_EMAIL}</div>
        <div class="sig-info">(404) 842-5072</div>
      </div>
    </div>
    <div class="ftr">
      <p><span class="scout-badge">SCOUT</span> · GateGuard AI Outreach Engine · <a href="https://portal.gateguard.co/unsubscribe" style="color:#94a3b8;">unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user.isCorporate && user.role !== 'admin' && user.role !== 'agent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { lead_ids, from_name, from_email } = await req.json()
    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ error: 'lead_ids array required' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
    }

    const senderName  = from_name  ?? DEFAULT_FROM_NAME
    const senderEmail = from_email ?? DEFAULT_FROM_EMAIL

    const { data: leads, error: fetchErr } = await supabase
      .from('leads')
      .select('id, contact_name, email, property_name, property_intel, scout_status')
      .in('id', lead_ids)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const results: Array<{
      lead_id: string;
      property_name: string;
      status: 'sent' | 'skipped' | 'error';
      reason?: string;
      resend_id?: string;
    }> = []

    for (const lead of (leads ?? [])) {
      if (!lead.email) {
        results.push({ lead_id: lead.id, property_name: lead.property_name, status: 'skipped', reason: 'no email' })
        continue
      }
      if (['sent', 'opened', 'replied'].includes(lead.scout_status)) {
        results.push({ lead_id: lead.id, property_name: lead.property_name, status: 'skipped', reason: `already ${lead.scout_status}` })
        continue
      }

      const intel = lead.property_intel as any ?? {}
      const variants: Array<{ angle: string; subject: string; body: string; predicted_reply_rate: number }> = intel.email_variants ?? []

      let subject: string
      let body: string

      if (variants.length > 0) {
        const best = variants.reduce((a, b) => (b.predicted_reply_rate ?? 0) > (a.predicted_reply_rate ?? 0) ? b : a)
        subject = best.subject
        body    = best.body
      } else {
        // AI-Powered Fallback: Leverage the Triangulated OSINT
        const propName = lead.property_name ?? 'your property'
        const hook = intel.pitch_strategy?.primary_hook || 
                     intel.scout_brief?.key_data_points?.[0] || 
                     `We noticed access control and telecom infrastructure is a priority at ${propName}.`
                     
        const vendor = intel.current_vendor && intel.current_vendor !== 'Unknown' 
                     ? `We work alongside or can completely replace legacy ${intel.current_vendor} systems.` 
                     : `We work alongside or replace legacy systems to handle everything: gates, cameras, resident access, and ongoing service.`

        subject = `Quick question about access control at ${propName}`
        body    = `Hi ${lead.contact_name?.split(' ')[0] ?? 'there'},\n\n${hook}\n\nI wanted to reach out about GateGuard — we're a managed access control platform built specifically for multifamily. ${vendor} We operate on one flat monthly fee per unit.\n\nMost property managers see an immediate lift in resident satisfaction and a reduction in maintenance calls.\n\nWould you be open to a 15-minute call to see if it's a fit for ${propName}?\n\nBest,\n${senderName}`
      }

      try {
        const { data: emailData, error: emailErr } = await resend.emails.send({
          from:    `${senderName} <${senderEmail}>`,
          to:      lead.email,
          subject,
          html:    buildScoutHtml(body, subject),
          text:    body,
          headers: { 'X-GateGuard-Lead': lead.id },
        })

        if (emailErr) throw new Error((emailErr as any).message ?? 'Resend error')

        const resendId = (emailData as any)?.id ?? null

        await supabase.from('campaign_sends').insert({
          lead_id:           lead.id,
          lead_email:        lead.email,
          lead_name:         lead.contact_name ?? null,
          campaign_name:     'scout_aria',
          status:            'sent',
          resend_message_id: resendId,
          sent_at:           new Date().toISOString(),
        })

        await supabase.from('leads').update({
          scout_status:  'sent',
          scout_sent_at: new Date().toISOString(),
        }).eq('id', lead.id)

        await supabase.from('crm_activities').insert({
          lead_id: lead.id,
          type:         'email',
          direction:    'outbound',
          subject:      subject,
          body:         body.slice(0, 500),
          outcome:      'sent',
          performed_by: user.id,
          performed_by_name: senderName,
          created_at:   new Date().toISOString(),
        })

        results.push({ lead_id: lead.id, property_name: lead.property_name, status: 'sent', resend_id: resendId })

      } catch (sendErr: any) {
        await supabase.from('campaign_sends').insert({
          lead_id:       lead.id,
          lead_email:    lead.email,
          lead_name:     lead.contact_name ?? null,
          campaign_name: 'scout_aria',
          status:        'failed',
          error_message: sendErr.message,
          sent_at:       new Date().toISOString(),
        })
        results.push({ lead_id: lead.id, property_name: lead.property_name, status: 'error', reason: sendErr.message })
      }
    }

    const sent    = results.filter(r => r.status === 'sent').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors  = results.filter(r => r.status === 'error').length

    return NextResponse.json({ ok: true, sent, skipped, errors, results })

  } catch (err: any) {
    console.error('[aria/scout/launch]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}