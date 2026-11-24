/**
 * lib/service-updates.ts — tell the person who asked when their service request moves
 * (Nov 24 2026). Requests made in the property portal are logged as site_events
 * 'portal_service_request' { request_id, email, phone, last } (request-service route).
 * Every 10 min (Inngest nexus-portal-service-updates) each one from the last 60 days is
 * re-read: the request, or the job it became; when its status label changes (Being
 * reviewed, Scheduled, Tech on the way, Done…) we email and/or text the contact once
 * and save the new label. Never repeats a message; stops once Done / Closed / Cancelled.
 */
import { createClient } from '@supabase/supabase-js'
import { jobStage, requestStage } from '@/lib/portal-service'
import { sendEmail } from '@/lib/email-sender'
import { sendText } from '@/lib/sms'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
type Meta = { request_id: string; title: string; email: string | null; phone: string | null; last: string; slug: string; finished?: boolean }
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export async function logPortalRequest(siteId: string, slug: string, requestId: string, title: string, email: string | null, phone: string | null) {
  if (!email && !phone) return
  const meta: Meta = { request_id: requestId, title, email, phone, last: 'Received', slug }
  const { error } = await db().from('site_events').insert({ site_id: siteId, event_type: 'portal_service_request', title: `Service request from the portal: ${title}`, metadata: meta })
  if (error) console.error('[service-updates] log failed:', error.message)
}

export async function sendServiceUpdates(): Promise<{ checked: number; sent: number }> {
  const since = new Date(Date.now() - 60 * 864e5).toISOString()
  const { data: rows } = await db().from('site_events').select('id, site_id, metadata').eq('event_type', 'portal_service_request').gte('created_at', since).limit(500)
  let checked = 0, sent = 0
  for (const row of (rows ?? []) as { id: string; site_id: string; metadata: Meta }[]) {
    const m = row.metadata
    if (!m || m.finished) continue
    checked++
    const { data: rq } = await db().from('wo_requests').select('status, converted_wo_id').eq('id', m.request_id).maybeSingle()
    if (!rq) continue
    let label = requestStage(String(rq.status ?? 'new')).label, done = rq.status === 'closed', when = ''
    if (rq.converted_wo_id) {
      const { data: wo } = await db().from('work_orders').select('status, scheduled_date, wo_number').eq('id', rq.converted_wo_id).maybeSingle()
      if (wo) {
        const st = jobStage(String(wo.status ?? ''))
        label = st.label; done = st.stage === 'done' || st.stage === 'closed'
        if (st.stage === 'scheduled' && wo.scheduled_date) when = ` for ${new Date(`${String(wo.scheduled_date).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
      }
    }
    if (label === m.last) continue
    const { data: site } = await db().from('sites').select('name').eq('id', row.site_id).maybeSingle()
    const text = `${site?.name ?? 'Your property'}: your service request “${m.title}” is now ${label.toLowerCase()}${when}.`
    let ok = false
    if (m.email) {
      const r = await sendEmail({ to: m.email, subject: `Service request update — ${label}`, html: `<p>${esc(text)}</p><p style="color:#6E6E73;font-size:12px">See all your requests in the property portal → Service.</p>` })
      ok = ok || r.success
    }
    if (m.phone) { const r = await sendText(m.phone, `${text} Reply STOP to opt out.`); ok = ok || r.ok }
    if (ok) sent++
    const { error } = await db().from('site_events').update({ metadata: { ...m, last: label, finished: done } }).eq('id', row.id)
    if (error) console.error('[service-updates] save failed:', error.message)
  }
  return { checked, sent }
}
