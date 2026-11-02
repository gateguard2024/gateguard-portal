/**
 * POST /api/maintenance/[id]/notify-customer  { event, tech_eta? }
 * Sends a customer-facing SMS for this job (on-my-way / arrived / complete / review)
 * to the site's contact phone, using the shared Twilio templates. Logged on the job.
 *
 * POST { custom: { preset, label, subject, message, channels: ['sms','email'], to: ['contact','pm'], extra_email?, extra_phone? } }
 * Sends a written update (a draft from lib/wo-updates.ts the person edited) by text
 * and/or email to the site contact / property manager. Refuses a message that still
 * has [blanks] in it. The message is logged on the job.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSMS, type SMSEvent } from '@/lib/sms'
import { getCurrentUser } from '@/lib/current-user'
import { guardWorkOrder } from '@/lib/ops-scope'
import { sendEmail } from '@/lib/email-sender'
import { blanksIn } from '@/lib/wo-updates'
import { logJobText, sendJobText, toE164 as e164 } from '@/lib/wo-texts'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED: SMSEvent[] = ['scheduled', 'in_route', 'on_site', 'completed', 'review_request']
const LABEL: Record<string, string> = { scheduled: 'Scheduled notice', in_route: 'On my way', on_site: 'Arrived', completed: 'Job complete', review_request: 'Review request' }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await guardWorkOrder(req, params.id))) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    let user: { name?: string } | null = null
    try { user = await getCurrentUser() } catch { user = null }
    const body = await req.json().catch(() => ({}))
    if (body.custom) return await sendCustom(params.id, body.custom, user?.name ?? 'Someone')
    const event = body.event as SMSEvent
    if (!ALLOWED.includes(event)) return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })

    const { data: wo } = await supabase
      .from('work_orders')
      .select('wo_number, title, customer_name, assignee_name, site_id, org_id, scheduled_date')
      .eq('id', params.id).single()
    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

    let phone: string | null = null, propertyName: string | null = wo.customer_name ?? null
    if (wo.site_id) {
      const { data: s } = await supabase.from('sites').select('primary_contact_phone, pm_phone, name').eq('id', wo.site_id).maybeSingle()
      phone = (s?.primary_contact_phone ?? s?.pm_phone) as string | null
      propertyName = (s?.name as string) ?? propertyName
    }
    if (!phone) return NextResponse.json({ error: 'No customer phone on file for this site. Add a primary contact phone on the site.' }, { status: 400 })

    const sent = await sendSMS({
      event, to: phone,
      wo_number: wo.wo_number ?? '', title: wo.title ?? 'Service',
      customer_name: wo.customer_name ?? propertyName ?? 'Customer',
      tech_name: wo.assignee_name ?? undefined,
      tech_eta: body.tech_eta || undefined,
      scheduled_date: wo.scheduled_date ?? undefined,
      property_name: propertyName ?? undefined,
      review_url: process.env.GOOGLE_REVIEW_URL || undefined,
    })
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 })
    // Show it on the job's text thread too, so replies have context.
    const p164 = e164(phone)
    if (p164) { const tErr = await logJobText({ work_order_id: params.id, site_id: wo.site_id, org_id: wo.org_id, direction: 'out', phone: p164, body: `${LABEL[event] ?? event} — standard text${body.tech_eta ? ` (ETA ${body.tech_eta})` : ''}`, kind: 'status', status: 'sent', twilio_sid: sent.ok && 'sid' in sent ? sent.sid ?? null : null, author_name: user?.name ?? null }); if (tErr) console.error('[notify-customer] thread log failed', tErr) }

    // Log it on the job timeline (the text already went, so a log failure is reported, not fatal).
    const { error: logErr } = await supabase.from('wo_comments').insert({ work_order_id: params.id, author_name: user?.name ?? 'System', content: `📱 Texted customer: ${LABEL[event] ?? event}${body.tech_eta ? ` (ETA ${body.tech_eta})` : ''}` })
    if (logErr) console.error('[notify-customer] log failed', logErr.message)

    return NextResponse.json({ ok: true, sent_to: phone.replace(/\d(?=\d{4})/g, '•') })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not send' }, { status: 500 })
  }
}

// ── Written updates (drafts the person chose and edited) ─────────────────────
const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const toE164 = (raw: unknown) => { const d = String(raw ?? '').replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : null }
const isEmail = (v: unknown) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const mask = (p: string) => p.replace(/\d(?=\d{4})/g, '•')


// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendCustom(woId: string, c: any, userName: string) {
  const message = String(c?.message ?? '').trim().slice(0, 4000)
  const subject = String(c?.subject ?? '').trim().slice(0, 200) || 'Update from Gate Guard'
  const label = String(c?.label ?? 'Customer update').slice(0, 60)
  const channels: string[] = Array.isArray(c?.channels) ? c.channels.filter((x: unknown) => x === 'sms' || x === 'email') : []
  const who: string[] = Array.isArray(c?.to) ? c.to.filter((x: unknown) => x === 'contact' || x === 'pm') : []
  if (!message) return NextResponse.json({ error: 'Write the message first.' }, { status: 400 })
  const blanks = blanksIn(message + ' ' + subject)
  if (blanks.length) return NextResponse.json({ error: `Fill in the parts in [brackets] first: ${blanks.slice(0, 3).join(', ')}${blanks.length > 3 ? '…' : ''}` }, { status: 400 })
  if (!channels.length) return NextResponse.json({ error: 'Pick text, email or both.' }, { status: 400 })

  const { data: wo, error: woErr } = await supabase.from('work_orders').select('wo_number, site_id, org_id').eq('id', woId).single()
  if (woErr || !wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let site: any = null
  if (wo.site_id) {
    const { data } = await supabase.from('sites').select('primary_contact_phone, primary_contact_email, pm_phone, pm_email').eq('id', wo.site_id).maybeSingle()
    site = data
  }
  const phones = new Set<string>(), emails = new Set<string>()
  if (who.includes('contact')) { const p = toE164(site?.primary_contact_phone); if (p) phones.add(p); if (isEmail(site?.primary_contact_email)) emails.add(String(site.primary_contact_email).trim()) }
  if (who.includes('pm')) { const p = toE164(site?.pm_phone); if (p) phones.add(p); if (isEmail(site?.pm_email)) emails.add(String(site.pm_email).trim()) }
  if (c?.extra_phone) { const p = toE164(c.extra_phone); if (!p) return NextResponse.json({ error: 'That extra phone number doesn’t look right.' }, { status: 400 }); phones.add(p) }
  if (c?.extra_email) { if (!isEmail(c.extra_email)) return NextResponse.json({ error: 'That extra email doesn’t look right.' }, { status: 400 }); emails.add(String(c.extra_email).trim()) }
  const wantSms = channels.includes('sms'), wantEmail = channels.includes('email')
  if (wantSms && !phones.size && !(wantEmail && emails.size)) return NextResponse.json({ error: 'No phone number for who you picked. Add one on the site or type one in.' }, { status: 400 })
  if (wantEmail && !emails.size && !(wantSms && phones.size)) return NextResponse.json({ error: 'No email for who you picked. Add one on the site or type one in.' }, { status: 400 })

  const sent: string[] = [], failed: string[] = []
  // Texts go through the job thread so the customer's reply lands on this job.
  if (wantSms) for (const p of [...phones].slice(0, 5)) { const r = await sendJobText({ work_order_id: woId, site_id: wo.site_id, org_id: wo.org_id }, p, message, 'update', userName); if (!r.ok) failed.push(`text to ${mask(p)}: ${r.error}`); else sent.push(`text to ${mask(p)}`) }
  if (wantEmail && emails.size) {
    const html = `<div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;font-size:15px;line-height:1.55;color:#1D1D1F;max-width:600px">${esc(message).replace(/\n/g, '<br>')}</div>`
    const r = await sendEmail({ to: [...emails].slice(0, 5), subject, html })
    if (r.success) sent.push(`email to ${[...emails].join(', ')}`); else failed.push(`email: ${r.error ?? 'didn’t send'}`)
  }
  if (!sent.length) return NextResponse.json({ error: failed.join(' · ') || 'Nothing was sent.' }, { status: 502 })

  // Keep a record on the job: what went, to whom, and the words.
  const { error: logErr } = await supabase.from('wo_comments').insert({ work_order_id: woId, author_name: userName, content: `✉️ Sent customer update — ${label} (${sent.join('; ')})\n\n${message}` })
  if (logErr) console.error('[notify-customer] log failed', logErr.message)
  return NextResponse.json({ ok: true, sent, ...(failed.length ? { failed } : {}), logged: !logErr })
}
