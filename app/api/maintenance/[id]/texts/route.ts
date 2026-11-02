/**
 * /api/maintenance/[id]/texts — the job's text thread (Twilio, table wo_texts).
 *   GET                       → { texts, contacts, unread }   (marks the customer's texts read)
 *   GET ?unmatched=1          → { unmatched } texts nobody could match to a job (Gate Guard corporate only)
 *   POST { action:'send', body, to:'contact'|'pm'|'other', phone? }  → text the customer from this job
 *   POST { action:'claim', text_id }   → put an unmatched text on this job (corporate only)
 * Same access rule as the job itself (guardWorkOrder).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardWorkOrder } from '@/lib/ops-scope'
import { getCurrentUser } from '@/lib/current-user'
import { maskPhone, sendJobText, toE164 } from '@/lib/wo-texts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })
const notReady = (m: string) => (/wo_texts/.test(m) && /does not exist|schema cache/i.test(m) ? 'Job texts need migration 212.' : m)

async function jobAndContacts(id: string) {
  const { data: wo, error } = await sb.from('work_orders').select('id, site_id, org_id').eq('id', id).single()
  if (error || !wo) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let site: any = null
  if (wo.site_id) { const { data } = await sb.from('sites').select('primary_contact_name, primary_contact_phone, pm_name, pm_phone').eq('id', wo.site_id).maybeSingle(); site = data }
  return {
    wo,
    contacts: [
      { key: 'contact', label: 'Site contact', name: site?.primary_contact_name ?? null, phone: toE164(site?.primary_contact_phone) },
      { key: 'pm', label: 'Property manager', name: site?.pm_name ?? null, phone: toE164(site?.pm_phone) },
    ].filter(c => c.phone) as { key: string; label: string; name: string | null; phone: string }[],
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return bad('Not found', 404)
  if (req.nextUrl.searchParams.get('unmatched') === '1') {
    const user = await getCurrentUser()
    if (!user.isCorporate) return NextResponse.json({ unmatched: [] })
    const { data, error } = await sb.from('wo_texts').select('id, phone, body, created_at').is('work_order_id', null).eq('direction', 'in').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(50)
    if (error) return bad(notReady(error.message), 500)
    return NextResponse.json({ unmatched: (data ?? []).map(t => ({ ...t, phone: maskPhone(t.phone) })) })
  }
  const j = await jobAndContacts(params.id)
  if (!j) return bad('Not found', 404)
  const { data, error } = await sb.from('wo_texts').select('id, direction, phone, body, kind, status, error, author_name, created_at, read_at').eq('work_order_id', params.id).order('created_at', { ascending: true }).limit(300)
  if (error) return bad(notReady(error.message), 500)
  const unreadIds = (data ?? []).filter(t => t.direction === 'in' && !t.read_at).map(t => t.id)
  if (unreadIds.length) {
    const { error: rErr } = await sb.from('wo_texts').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
    if (rErr) console.error('[texts] mark read failed:', rErr.message)
  }
  const nameOf = (p: string) => j.contacts.find(c => c.phone === p)
  return NextResponse.json({
    texts: (data ?? []).map(t => ({ ...t, who: nameOf(t.phone)?.name || nameOf(t.phone)?.label || maskPhone(t.phone), phone: maskPhone(t.phone), unread: unreadIds.includes(t.id) })),
    contacts: j.contacts.map(c => ({ key: c.key, label: c.label, name: c.name, phone: maskPhone(c.phone) })),
    unread: unreadIds.length,
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await guardWorkOrder(req, params.id))) return bad('Not found', 404)
  const user = await getCurrentUser()
  const b = await req.json().catch(() => ({}))
  const j = await jobAndContacts(params.id)
  if (!j) return bad('Not found', 404)
  if (b.action === 'claim') {
    if (!user.isCorporate) return bad('Only Gate Guard can move unmatched texts.', 403)
    const { data, error } = await sb.from('wo_texts').update({ work_order_id: params.id, site_id: j.wo.site_id, org_id: j.wo.org_id }).eq('id', String(b.text_id ?? '')).is('work_order_id', null).select('id, phone, body')
    if (error) return bad(notReady(error.message), 500)
    if (!data?.length) return bad('That text was already placed on a job.', 409)
    const { error: cErr } = await sb.from('wo_comments').insert({ work_order_id: params.id, author_name: 'Customer (text)', content: `💬 Text from ${maskPhone(data[0].phone)}: ${data[0].body}` })
    if (cErr) console.error('[texts] note failed:', cErr.message)
    return NextResponse.json({ ok: true })
  }
  if (b.action !== 'send') return bad('Nothing to do.')
  const text = String(b.body ?? '').trim()
  if (!text) return bad('Write the text first.')
  let phone: string | null = null
  if (b.to === 'other') phone = toE164(b.phone)
  else {
    const site = await sb.from('sites').select('primary_contact_phone, pm_phone').eq('id', j.wo.site_id ?? '00000000-0000-0000-0000-000000000000').maybeSingle()
    phone = toE164(b.to === 'pm' ? site.data?.pm_phone : site.data?.primary_contact_phone)
  }
  if (!phone) return bad(b.to === 'other' ? 'That phone number doesn’t look right.' : 'No cell number on the site for that person. Add it on the site, or pick "Someone else".')
  const r = await sendJobText({ work_order_id: params.id, site_id: j.wo.site_id, org_id: j.wo.org_id }, phone, text, 'manual', user.name)
  if (!r.ok) return bad(r.error ?? 'It didn’t send.', 502)
  return NextResponse.json({ ok: true, sent_to: maskPhone(phone), ...(r.logError ? { warning: `Sent, but it didn’t save on the thread: ${r.logError}` } : {}) })
}
